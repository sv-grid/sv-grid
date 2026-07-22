<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 158. Waterfall chart (signed P&L)
   * ----------------------------------
   * `type: 'waterfall'` renders a running-total bar chart - each bar
   * starts where the previous one ended. Mark a bar as a total via
   * `waterfallTotals: boolean[]` (parallel to `categories`) and that bar
   * spans from 0 instead of stacking, so it reads as a subtotal /
   * grand total. Bars colour-code by sign (green positive, red negative)
   * and total bars get a neutral slate by default - override via
   * `waterfallColors`. Thin connector lines link bar tops so the
   * cumulative trend reads at a glance.
   *
   * This demo: a quarterly P&L driven by the grid. Toggle a row's
   * `isTotal` checkbox to mark it as a subtotal; the chart re-renders
   * with the new running calculation.
   */
  import {
    SvGrid,
    SvGridChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; label: string; value: number; isTotal: boolean }
  const seed: Row[] = [
    { id: 0, label: 'Revenue',          value: 1_240_000, isTotal: false },
    { id: 1, label: 'Discounts',        value:   -85_000, isTotal: false },
    { id: 2, label: 'Refunds',          value:   -32_000, isTotal: false },
    { id: 3, label: 'Net revenue',      value:         0, isTotal: true  },
    { id: 4, label: 'COGS',             value:  -480_000, isTotal: false },
    { id: 5, label: 'Gross profit',     value:         0, isTotal: true  },
    { id: 6, label: 'Marketing',        value:  -180_000, isTotal: false },
    { id: 7, label: 'R&D',              value:  -210_000, isTotal: false },
    { id: 8, label: 'G&A',              value:   -95_000, isTotal: false },
    { id: 9, label: 'Operating income', value:         0, isTotal: true  },
  ]
  let rows = $state<Row[]>(seed)

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'label',   header: 'Line item', width: 220 },
    { field: 'value',   header: 'Amount',    width: 150, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'isTotal', header: 'Total?',    width: 100 },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const spec = $derived.by<ChartSpec>(() => ({
    type: 'waterfall',
    categories: displayed.map((r) => r.label),
    series: [{
      label: 'Amount',
      values: displayed.map((r) => r.value),
    }],
    waterfallTotals: displayed.map((r) => r.isTotal),
    width: 720,
    height: 360,
    yAxisTitle: 'USD',
  }))

  const compact = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M'
    if (a >= 1e3) return (v / 1e3).toFixed(0) + 'k'
    return String(Math.round(v))
  }

  function toggleTotal(id: number) {
    rows = rows.map((r) => (r.id === id ? { ...r, isTotal: !r.isTotal } : r))
    sync()
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Waterfall chart for a quarterly P&amp;L
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Each green/red bar starts where the previous one ended. The slate "total" bars span from 0,
      showing the cumulative position. Click a row's <em>Total?</em> badge to flip its role - the
      waterfall reflows in real time.
    </p>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        enableRowSummaries={false}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onCellClick={(e) => {
          if (e.columnId === 'isTotal' && e.row) toggleTotal((e.row as Row).id)
        }}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 780px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={compact} dataLabels />
    </div>
  </div>
</section>
