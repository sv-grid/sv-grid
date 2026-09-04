<!-- Documented in: docs/help/columns/column-groups.md -->
<script lang="ts">
  /**
   * 183. Collapsible column groups (columnGroupShow)
   * ------------------------------------------------
   * Each quarter is a column GROUP with a collapse toggle in its header. The
   * quarter Total is always visible; the month columns are tagged
   * `columnGroupShow: 'open'`, so they appear only when the group is expanded.
   * Groups start collapsed (AG-Grid default) - click a quarter header caret to
   * reveal its months. Q1 starts open via `openByDefault`.
   */
  import { SvGrid, tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'

  type Row = { region: string } & Record<string, number | string>

  const QUARTERS = [
    { gid: 'g1', label: 'Q1', months: ['Jan', 'Feb', 'Mar'], total: 'q1', open: true },
    { gid: 'g2', label: 'Q2', months: ['Apr', 'May', 'Jun'], total: 'q2', open: false },
    { gid: 'g3', label: 'Q3', months: ['Jul', 'Aug', 'Sep'], total: 'q3', open: false },
    { gid: 'g4', label: 'Q4', months: ['Oct', 'Nov', 'Dec'], total: 'q4', open: false },
  ]

  const regions = ['North', 'South', 'EMEA', 'APAC', 'LATAM']
  const rows: Row[] = regions.map((region, ri) => {
    const r: Row = { region }
    QUARTERS.forEach((q, qi) => {
      let sum = 0
      q.months.forEach((m, mi) => {
        const v = 20_000 + ((ri * 7 + qi * 5 + mi * 11) % 40) * 1000
        r[m] = v
        sum += v
      })
      r[q.total] = sum
    })
    return r
  })

  const features = tableFeatures({ rowSortingFeature })
  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'region', header: 'Region', width: 130 },
    ...QUARTERS.map(
      (q): ColumnDef<typeof features, Row> => ({
        id: q.gid,
        header: q.label,
        openByDefault: q.open,
        columns: [
          // Always-visible quarter total.
          { field: q.total, header: 'Total', width: 120, align: 'right', cellDataType: 'number', format: money },
          // Month breakdown - only while the group is expanded.
          ...q.months.map(
            (m): ColumnDef<typeof features, Row> => ({
              field: m,
              header: m,
              width: 100,
              align: 'right',
              cellDataType: 'number',
              format: money,
              columnGroupShow: 'open',
            }),
          ),
        ],
      }),
    ),
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    Each quarter is a <strong>collapsible column group</strong>. The
    <strong>Total</strong> is always shown; the months carry
    <code>columnGroupShow: 'open'</code> so they appear only when the group is
    expanded. Click a quarter's <strong>caret</strong> to expand/collapse - Q1
    starts open via <code>openByDefault</code>.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      selectionMode="none"
      rowHeight={38}
      containerHeight="100%"
    />
  </div>
</section>
