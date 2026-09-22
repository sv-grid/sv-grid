<!-- Documented in: docs/help/server/server-grouping.md -->
<script lang="ts">
  /**
   * 496. Server grouping (row model)
   * --------------------------------
   * Server-side grouping through ONE getRows contract. The
   * request carries groupBy + groupKeys; createServerRowModel owns the group
   * tree (lazy expand per level, a block cache per level, aggregation,
   * race-safety) and the grid mounts it through the one `rowModel` prop.
   * Here a 63,000-row in-memory "server" behind 200ms latency - the grid only
   * ever holds what you expand.
   *
   * Three ways to walk the leaves under a country: scroll them in block by
   * block, click "Load N more" per block, or page the whole tree.
   *
   * The row model and its chrome are Enterprise. The datasource contract it
   * runs on (ServerDataSource, ServerRequest) is free in @svgrid/grid.
   */
  import { SvGrid, renderComponent, tableFeatures, type GridColumns, type ServerDataSource } from '@svgrid/grid'
  import {
    setLicenseKey,
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    SvRowGroupPanel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({})

  // Group rows carry an `n` (row count) the server adds beside the sums.
  type Sale = { region: string; country: string; rep: string; product: string; qty: number; amount: number; n?: number }
  const REGIONS: Record<string, string[]> = {
    Americas: ['US', 'BR', 'CA'],
    EMEA: ['DE', 'UK', 'FR'],
    APAC: ['JP', 'AU', 'IN'],
  }
  const PRODUCTS = ['Desk', 'Chair', 'Lamp', 'Monitor', 'Cabinet', 'Whiteboard']

  // The "database": 63,000 rows that never touch the grid wholesale.
  const DB: Sale[] = (() => {
    const out: Sale[] = []
    let i = 0
    for (const [region, countries] of Object.entries(REGIONS))
      for (const country of countries)
        for (let k = 0; k < 7000; k++, i++) {
          // Hashed rather than cycled, so the per-country sums differ.
          const h = Math.imul(i, 2654435761) >>> 0
          const qty = 1 + (h % 12)
          out.push({ region, country, rep: `Rep ${i % 50}`, product: PRODUCTS[i % PRODUCTS.length]!, qty, amount: qty * (120 + ((h >>> 8) % 880)) })
        }
    return out
  })()

  // The server: GROUP BY the requested level within groupKeys, or return leaves.
  let requests = $state(0)
  const source: ServerDataSource<Sale> = {
    async getRows(req) {
      requests += 1
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
          const g = map.get(key) ?? { [field]: (r as Record<string, unknown>)[field], amount: 0, qty: 0, n: 0 }
          g.amount = (g.amount as number) + r.amount
          g.qty = (g.qty as number) + r.qty
          g.n = (g.n as number) + 1
          map.set(key, g)
        }
        const rows = [...map.values()] as unknown as Sale[]
        return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
      }
      // Honor the requested block: the model asks for one block at a time.
      return { rows: subset.slice(req.startRow, req.endRow), rowCount: subset.length }
    },
  }

  // How the leaves under a country arrive. The block cache is the same in all
  // three; only what drives it changes.
  type Mode = 'scroll' | 'more' | 'paged'
  const MODES: Array<{ id: Mode; label: string; hint: string }> = [
    { id: 'scroll', label: 'Scroll', hint: 'blocks load as you scroll, per level' },
    { id: 'more', label: 'Load more', hint: 'a "Load 20 more" row per block under each country' },
    { id: 'paged', label: 'Paged', hint: 'the whole tree, 25 rows a page, groups included' },
  ]
  let mode = $state<Mode>('scroll')
  let view = $state<ServerRowModelState<Sale>>()

  function makeModel(m: Mode) {
    const model = createServerRowModel<Sale>(source, {
      groupBy: ['region', 'country'],
      aggregations: [
        { col: 'amount', fn: 'sum' },
        { col: 'qty', fn: 'sum' },
      ],
      blockSize: 20, // small, so the blocks are visible in every mode
      groupFooters: true, // subtotal row after each expanded group
      childCount: (row) => row.n, // the server's per-group row count, shown beside the key
      // Americas and its first country open on load, so the level cascade
      // (region request, country request, first leaf block) shows at once.
      isGroupOpenByDefault: (route) => route[0] === 'Americas' && (route.length === 1 || (route.length === 2 && route[1] === 'US')),
      // Under a country (level 2) the leaves come one block per click.
      levelParams: m === 'more' ? (level) => (level === 2 ? { loadMore: true } : {}) : undefined,
      pagination: m === 'paged' ? { pageSize: 25, pageSizes: [10, 25, 50], paginateChildRows: true } : undefined,
      onChange: (s) => (view = s),
    })
    model.refresh()
    return model
  }
  let ctl = $state.raw(makeModel('scroll'))
  $effect(() => () => ctl.dispose())
  function setMode(next: Mode) {
    if (next === mode) return
    ctl.dispose()
    mode = next
    ctl = makeModel(next)
  }
  const modeHint = $derived(MODES.find((m) => m.id === mode)!.hint)

  // Columns the row-group panel lets you group / regroup by (drives ctl.setGroupBy).
  const groupCols = [
    { id: 'region', label: 'Region' },
    { id: 'country', label: 'Country' },
    { id: 'rep', label: 'Rep' },
    { id: 'product', label: 'Product' },
  ]

  // The model's grid rows carry each row's fields plus `__group`; the built-in
  // SvGroupCell draws the expander, the indent and the "Load more" row.
  type GridRow = ServerRowModelGridRow<Sale>
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const columns: GridColumns<GridRow> = [
    {
      id: 'group',
      header: 'Group',
      width: 300,
      sortable: false,
      filterable: false,
      // The text behind the expander, for copy and export.
      fieldFn: (row) => serverGroupText(row, 'rep'),
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original,
          onToggle: () => ctl.group.onToggle(ctx.row.original),
          leafField: 'rep',
        }),
    },
    { field: 'product', header: 'Product', width: 140 },
    { field: 'qty', header: 'Qty', width: 100, align: 'right', format: { type: 'number' } },
    { field: 'amount', header: 'Amount', width: 150, align: 'right', format: usd },
  ]
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="seg mode-seg" role="group" aria-label="How leaves load">
      {#each MODES as m (m.id)}
        <button type="button" class:is-on={mode === m.id} aria-pressed={mode === m.id} title={m.hint} onclick={() => setMode(m.id)}>{m.label}</button>
      {/each}
    </div>
    <span class="note">
      Click a region to drill into its countries, then into the raw rows. Each expand is one
      <code>getRows</code> with a longer <code>groupKeys</code>; 63,000 rows stay on the "server" and
      the grid holds only what you expand. In this mode {modeHint}.
    </span>
  </header>
  <SvRowGroupPanel columns={groupCols} groupBy={view?.groupBy ?? []} onChange={(g) => ctl.setGroupBy(g)} />
  {#key mode}
    <div class="gridpane">
      <SvGrid
        responsive={true}
        columnResize
        fitColumns
        rowModel={ctl}
        stickyGroupRows
        {columns}
        {features}
        pageable={mode === 'paged'}
        containerHeight="100%"
      />
    </div>
  {/key}
  <footer class="foot">
    <span class="stat"><span class="stat-label">Requests</span><strong>{requests}</strong></span>
    <span class="stat"><span class="stat-label">On screen</span><strong>{(view?.gridRows.length ?? 0).toLocaleString()}</strong> rows of 63,000</span>
    <span class="stat"><span class="stat-label">Open</span><strong>{view?.expandedGroups.length ?? 0}</strong> group{(view?.expandedGroups.length ?? 0) === 1 ? '' : 's'}</span>
    {#if view?.error}<span class="stat err">{String((view.error as Error).message ?? view.error)}</span>{/if}
  </footer>
</section>
