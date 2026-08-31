<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 160. Funnel chart (signup conversion)
   * --------------------------------------
   * `type: 'funnel'` renders a series of strictly-decreasing values as a
   * stack of trapezoids - level N+1 is automatically narrower than level
   * N proportional to its value. Each segment shows the absolute count
   * plus the cumulative conversion vs. the top of the funnel; hover for
   * the step drop-off. Click any segment to drill the grid to that stage.
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
    type ChartSelection,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; stage: string; users: number; note: string }
  const stages = [
    { stage: 'Visited',       users: 12_400, note: 'All visits to /pricing' },
    { stage: 'Signed up',     users:  3_180, note: 'Free trial start' },
    { stage: 'Verified email',users:  2_640, note: 'Clicked the activation link' },
    { stage: 'Onboarded',     users:  1_790, note: 'Finished the 4-step setup' },
    { stage: 'Activated',     users:  1_250, note: 'Created their first project' },
    { stage: 'Paid',          users:    432, note: 'Upgraded to a paid plan' },
  ]
  const rows: Row[] = stages.map((s, id) => ({ id, ...s }))

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'stage', header: 'Stage', width: 160 },
    { field: 'users', header: 'Users', width: 110, align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'note',  header: 'Definition', width: 280 },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let highlighted = $state<string | null>(null)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const compact = (v: number) => (Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(Math.round(v)))

  const spec = $derived.by<ChartSpec>(() => ({
    type: 'funnel',
    categories: displayed.map((r) => r.stage),
    series: [{
      label: 'Users',
      values: displayed.map((r) => r.users),
    }],
    width: 540,
    height: 360,
    palette: ['#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#312e81', '#3730a3'],
  }))

  function onSelect(sel: ChartSelection) {
    highlighted = sel.category
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Funnel: signup conversion across 6 stages
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Each trapezoid's width is proportional to its value relative to the top. Conversion shown
      inline; hover for the step drop-off vs. the previous stage.
      {#if highlighted}<span style="color: var(--sg-accent); margin-left: 8px;">Last clicked: {highlighted}</span>{/if}
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
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 580px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={compact} {onSelect} />
    </div>
  </div>
</section>
