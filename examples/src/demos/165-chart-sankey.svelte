<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 165. Sankey diagram (flow)
   * ---------------------------
   * `type: 'sankey'` takes a list of `nodes` and `links` and lays them
   * out in columns by longest-path depth. Each node is a thin rectangle
   * sized by max(totalIn, totalOut); each link is a bezier ribbon whose
   * width is the link value in pixels. Hover any ribbon for the source
   * -> target flow value.
   *
   * This demo: traffic flowing from acquisition channels through
   * onboarding steps to outcomes (purchased / churned / pending).
   */
  import {
    SvGrid,
    SvGridChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; source: string; target: string; value: number }
  const rows: Row[] = [
    // Channels -> trial
    { id: 0,  source: 'Organic',     target: 'Trial',         value: 1820 },
    { id: 1,  source: 'Paid Search', target: 'Trial',         value: 1240 },
    { id: 2,  source: 'Social',      target: 'Trial',         value:  860 },
    { id: 3,  source: 'Referral',    target: 'Trial',         value:  540 },
    // Trial -> onboarding
    { id: 4,  source: 'Trial',       target: 'Onboarded',     value: 3120 },
    { id: 5,  source: 'Trial',       target: 'Bounced',       value: 1340 },
    // Onboarded -> outcomes
    { id: 6,  source: 'Onboarded',   target: 'Activated',     value: 1980 },
    { id: 7,  source: 'Onboarded',   target: 'Inactive',      value: 1140 },
    // Activated -> outcomes
    { id: 8,  source: 'Activated',   target: 'Purchased',     value:  880 },
    { id: 9,  source: 'Activated',   target: 'Churned',       value:  720 },
    { id: 10, source: 'Activated',   target: 'Pending',       value:  380 },
  ]

  const columns: GridColumns<Row> = [
    { field: 'source', header: 'From',  width: 150 },
    { field: 'target', header: 'To',    width: 150 },
    { field: 'value',  header: 'Users', width: 110, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const spec = $derived.by<ChartSpec>(() => {
    // Build nodes from the unique source + target names of displayed links.
    const ids = new Set<string>()
    for (const r of displayed) { ids.add(r.source); ids.add(r.target) }
    return {
      type: 'sankey',
      categories: [],
      series: [],
      sankeyNodes: [...ids].map((id) => ({ id, label: id })),
      sankeyLinks: displayed.map((r) => ({ source: r.source, target: r.target, value: r.value })),
      palette: ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#14b8a6', '#f97316'],
      width: 760,
      height: 400,
    }
  })

  const compact = (v: number) => (Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(Math.round(v)))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-header-bg); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Sankey - user flow from acquisition to outcome
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Each ribbon's width is the user count. Filter the grid to drop a link and the layout
      reflows. Hover any ribbon for the source -> target value.
    </p>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        rowHeight={28}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 800px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={compact} />
    </div>
  </div>
</section>
