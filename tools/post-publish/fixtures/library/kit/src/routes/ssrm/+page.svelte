<script lang="ts">
  import { SvGrid, renderComponent, type GridColumns, type ServerDataSource } from '@svgrid/grid'
  import {
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise/server'

  type Sale = { id: number; region: string; rep: string; amount: number; childCount?: number }

  // The "server": 300 rows in memory, grouped by region on request.
  const DB: Sale[] = Array.from({ length: 300 }, (_, i) => ({
    id: i + 1,
    region: ['Americas', 'EMEA', 'APAC'][i % 3]!,
    rep: `Rep ${1 + (i % 12)}`,
    amount: 100 + ((i * 7919) % 900),
  }))

  const source: ServerDataSource<Sale> = {
    async getRows(req) {
      const groupBy = req.groupBy ?? []
      const keys = req.groupKeys ?? []
      const rows = DB.filter((r) => keys.every((k, i) => String((r as Record<string, unknown>)[groupBy[i]!]) === k))
      if (keys.length < groupBy.length) {
        const field = groupBy[keys.length]!
        const byKey = new Map<string, Sale[]>()
        for (const r of rows) {
          const k = String((r as Record<string, unknown>)[field])
          const list = byKey.get(k) ?? []
          list.push(r)
          byKey.set(k, list)
        }
        const groups = [...byKey.entries()].map(([k, members]) => ({
          id: members.length,
          region: k,
          rep: '',
          amount: members.reduce((t, m) => t + m.amount, 0),
          childCount: members.length,
        }))
        return { rows: groups.slice(req.startRow, req.endRow), rowCount: groups.length }
      }
      return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
    },
  }

  type Row = ServerRowModelGridRow<Sale>
  const ctl = createServerRowModel<Sale>(source, {
    groupBy: ['region'],
    aggregations: [{ col: 'amount', fn: 'sum' }],
    getRowId: (r) => String(r.id),
    childCount: (r) => r.childCount,
    blockSize: 50,
    isGroupOpenByDefault: (route) => route[0] === 'APAC',
  })
  ctl.refresh()
  $effect(() => () => ctl.dispose())

  const columns: GridColumns<Row> = [
    {
      id: 'group',
      header: 'Region / rep',
      width: 240,
      sortable: false,
      filterable: false,
      fieldFn: (row) => serverGroupText(row, 'rep'),
      cell: (ctx) => renderComponent(SvGroupCell, { row: ctx.row.original, onToggle: () => ctl.group.onToggle(ctx.row.original), leafField: 'rep' }),
    },
    { field: 'amount', header: 'Amount', width: 140, align: 'right', format: { type: 'number' } },
  ]
</script>

<h1>ssrm</h1>
<SvGrid rowModel={ctl} {columns} containerHeight={400} />
