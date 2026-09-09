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
    type GridColumns,
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

  /**
   * Every row is a different KPI, so the numbers are in different units: a
   * percentage, milliseconds, an unitless NPS score. A bare "180" next to a
   * bare "99.82" tells the reader nothing, so each cell carries its own unit
   * the same way the dial's readout does.
   */
  const withUnit = (v: unknown, row: Row) =>
    v == null || v === '' ? '' : row.unit ? `${v} ${row.unit}` : String(v)

  const columns: GridColumns<Row> = [
    { field: 'metric', header: 'Metric', width: 190 },
    { field: 'value',  header: 'Value',  width: 104, align: 'right', cell: (ctx) => withUnit(ctx.getValue(), ctx.row.original) },
    { field: 'target', header: 'Target', width: 104, align: 'right', cell: (ctx) => withUnit(ctx.getValue(), ctx.row.original) },
    { field: 'max',    header: 'Scale',  width: 96,  align: 'right', cell: (ctx) => withUnit(ctx.getValue(), ctx.row.original) },
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

  /** Pane size, so the dial fills its card rather than a fixed viewBox. */
  let paneW = $state(0)
  let paneH = $state(0)

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
    <div class="flex-1 min-w-0 min-h-0">
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="row"
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a }}
        onRowClick={(e: { row: Row }) => { if (e.row) selected = e.row }}
      />
    </div>
    <div class="rounded-lg border p-3 flex flex-col" style="flex: 0 1 380px; min-width: 0; min-height: 0; border-color: var(--sg-border); background: var(--sg-bg);">
      <div class="mb-2 shrink-0 text-xs font-semibold" style="color: var(--sg-muted);">{selected.metric}</div>
      <!-- A dial is a semicircle, so unlike the other charts it should NOT be
           stretched to fill: given a tall card it just sits at the bottom with
           dead space above the arc. Keep its own ~0.68 aspect and centre it. -->
      <div
        class="flex-1 min-h-0 flex items-center justify-center"
        style="width: 100%;"
        bind:clientWidth={paneW}
        bind:clientHeight={paneH}
      >
        {#if paneW > 40 && paneH > 40}
          <SvGridChart {spec} width={paneW} height={Math.min(paneH, Math.round(paneW * 0.68))} />
        {/if}
      </div>
    </div>
  </div>
</section>
