<!-- Documented in: docs/help/server/server-grouping.md -->
<script lang="ts">
  /**
   * 344. Server grouping (first-class)
   * ----------------------------------
   * First-class server-side grouping through ONE getRows contract. The
   * request carries groupBy + groupKeys; createServerGroupModel owns the group
   * tree (lazy expand per level, aggregation, per-node cache, race-safety) and
   * hands back a flat displayRows list to render. Here a 60,000-row in-memory
   * "server" behind 200ms latency - the grid only ever holds what you expand.
   */
  import {
    SvGrid,
    createServerGroupModel,
    serverGroupRows,
    serverGroupNav,
    SvGroupCell,
    SvRowGroupPanel,
    renderComponent,
    tableFeatures,
    type GridColumns,
    type ServerDataSource,
    type ServerGroupState,
    type ServerGroupGridRow,
  } from '@svgrid/grid'

  const features = tableFeatures({})

  type Sale = { region: string; country: string; rep: string; amount: number }
  const REGIONS: Record<string, string[]> = {
    Americas: ['US', 'BR', 'CA'],
    EMEA: ['DE', 'UK', 'FR'],
    APAC: ['JP', 'AU', 'IN'],
  }

  // The "database": 63,000 rows that never touch the grid wholesale.
  const DB: Sale[] = (() => {
    const out: Sale[] = []
    let i = 0
    for (const [region, countries] of Object.entries(REGIONS))
      for (const country of countries)
        for (let k = 0; k < 7000; k++)
          out.push({ region, country, rep: `Rep ${i % 50}`, amount: 500 + ((i++ * 7919) % 9500) })
    return out
  })()

  // The server: GROUP BY the requested level within groupKeys, or return leaves.
  const source: ServerDataSource<Sale> = {
    async getRows(req) {
      await new Promise((r) => setTimeout(r, 200)) // simulated latency
      // `groupBy` / `groupKeys` are optional on ServerRequest (a flat source may
      // omit them); this grouped source is always called with both.
      const subset = DB.filter((r) =>
        req.groupKeys!.every((k, i) => String((r as Record<string, unknown>)[req.groupBy![i]!]) === k),
      )
      const level = req.groupKeys!.length
      if (level < req.groupBy!.length) {
        const field = req.groupBy![level]!
        const map = new Map<string, Record<string, unknown>>()
        for (const r of subset) {
          const key = String((r as Record<string, unknown>)[field])
          const g = map.get(key) ?? { [field]: (r as Record<string, unknown>)[field], amount: 0, n: 0 }
          g.amount = (g.amount as number) + r.amount
          g.n = (g.n as number) + 1
          map.set(key, g)
        }
        const rows = [...map.values()] as unknown as Sale[]
        return { rows, rowCount: rows.length }
      }
      // Honor the requested block so intra-group paging returns one page at a time.
      return { rows: subset.slice(req.startRow, req.endRow), rowCount: subset.length }
    },
  }

  let view = $state<ServerGroupState<Sale>>()
  const ctl = createServerGroupModel<Sale>(source, {
    groupBy: ['region', 'country'],
    aggregations: [{ col: 'amount', fn: 'sum' }],
    pageSize: 20, // small block so intra-group "Load more" is visible on the leaves
    groupFooters: true, // subtotal row after each expanded group
    onChange: (s) => (view = s),
  })
  // Columns the row-group panel lets you group / regroup by (drives ctl.setGroupBy).
  const groupCols = [
    { id: 'region', label: 'Region' },
    { id: 'country', label: 'Country' },
    { id: 'rep', label: 'Rep' },
  ]
  ctl.refresh()
  // One handler drives both the SvGroupCell clicks and the grid's keyboard.
  const nav = serverGroupNav(ctl)

  // serverGroupRows maps the controller's displayRows to grid rows; the built-in
  // SvGroupCell draws the expander + indent. No hand-written cell recipe.
  type GridRow = ServerGroupGridRow<Sale> & { n?: number }
  const rows = $derived<GridRow[]>(serverGroupRows(view))

  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const columns: GridColumns<GridRow> = [
    {
      field: 'region',
      header: 'Group',
      width: 300,
      cell: (ctx) => renderComponent(SvGroupCell, { row: ctx.row.original, onToggle: () => nav.onToggle(ctx.row.original), leafField: 'rep' }),
    },
    { field: 'n', header: 'Rows', width: 110, align: 'right' },
    { field: 'amount', header: 'Amount', width: 170, align: 'right', format: usd },
  ]
</script>

<div class="wrap">
  <p class="hint">
    Click a region to drill into its countries, then into the raw rows. Each expand is one
    <code>getRows</code> with a longer <code>groupKeys</code> - 63,000 rows on the "server", the grid
    holds only what you expand.
  </p>
  <SvRowGroupPanel columns={groupCols} groupBy={view?.groupBy ?? []} onChange={(g) => ctl.setGroupBy(g)} />
  <div class="grid"><SvGrid responsive={true}
      columnResize data={rows} {columns} {features} serverGroup={nav} /></div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; }
  .hint { font-size: 13px; color: var(--sg-muted, #64748b); margin: 0; }
  .grid { flex: 1; min-height: 0; }
</style>
