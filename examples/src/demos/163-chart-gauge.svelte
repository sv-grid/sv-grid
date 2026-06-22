<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 163. Gauge dial (KPI dashboard)
   * --------------------------------
   * `type: 'gauge'` renders a semicircle dial with:
   *  - a grey track arc
   *  - a coloured fill arc representing the current `gaugeValue`
   *  - optional red/amber/green range bands via `gaugeRanges`
   *  - an optional target tick via `gaugeTarget`
   *
   * The grid holds the data; the dial reads one row at a time. Click any
   * row to display that KPI on the dial.
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

  type Row = {
    id: number; metric: string;
    value: number; target: number; max: number; unit: string;
  }
  const rows: Row[] = [
    { id: 0, metric: 'Uptime',                  value: 99.82, target: 99.9,  max: 100,  unit: '%'  },
    { id: 1, metric: 'p95 latency',             value:   180, target: 150,   max: 400,  unit: 'ms' },
    { id: 2, metric: 'Error rate',              value:  0.45, target: 0.30,  max: 5,    unit: '%'  },
    { id: 3, metric: 'NPS',                     value:    62, target:   55,  max: 100,  unit: ''   },
    { id: 4, metric: 'Trial -> paid conversion',value:   8.4, target:  12.0, max: 25,   unit: '%'  },
  ]

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'metric', header: 'Metric', width: 200 },
    { field: 'value',  header: 'Value',  width: 100, align: 'right' },
    { field: 'target', header: 'Target', width: 100, align: 'right' },
    { field: 'max',    header: 'Scale',  width: 90,  align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let selected = $state<Row>(rows[0]!)

  /** Pick range bands based on whether higher or lower is better. p95
   *  latency + error rate are "lower better"; the rest are "higher better". */
  function ranges(r: Row): ChartSpec['gaugeRanges'] {
    const higherBetter = !['p95 latency', 'Error rate'].includes(r.metric)
    if (higherBetter) {
      return [
        { from: 0,           to: r.target * 0.7,  color: '#ef4444' },
        { from: r.target * 0.7, to: r.target,     color: '#f59e0b' },
        { from: r.target,    to: r.max,           color: '#16a34a' },
      ]
    } else {
      return [
        { from: 0,             to: r.target,     color: '#16a34a' },
        { from: r.target,      to: r.target * 1.5, color: '#f59e0b' },
        { from: r.target * 1.5,to: r.max,        color: '#ef4444' },
      ]
    }
  }

  const spec = $derived.by<ChartSpec>(() => ({
    type: 'gauge',
    categories: [],
    series: [],
    gaugeValue:  selected.value,
    gaugeTarget: selected.target,
    gaugeMin:    0,
    gaugeMax:    selected.max,
    gaugeUnit:   selected.unit,
    gaugeRanges: ranges(selected),
    width:  340,
    height: 230,
  }))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Gauge dial - one KPI at a time
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Click any row to display that KPI on the dial. The red/amber/green bands flip direction
      based on whether higher or lower is better. The target tick shows the goal value; the
      filled arc is the current reading.
    </p>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="row"
        enableRowSummaries={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a }}
        onRowClick={(e: { row: Row }) => { if (e.row) selected = e.row }}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 380px; border-color: var(--sg-border); background: var(--sg-bg);">
      <div class="mb-2 text-xs font-semibold" style="color: var(--sg-muted);">{selected.metric}</div>
      <SvGridChart {spec} />
    </div>
  </div>
</section>
