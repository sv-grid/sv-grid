<script lang="ts" module>
  type ChartRow = Record<string, unknown>
</script>

<script lang="ts" generics="TData extends ChartRow">
  /**
   * SvSchemaChart - a reusable chart bound to an `EntitySchema`. It picks
   * chart-able fields from the schema (dimensions to group by, measures to
   * reduce), renders built-in controls, and draws with `SvGridChart`.
   *
   * Aggregation is either client-side (pass `rows`) or server-side (pass
   * `getAggregate`, e.g. a SQL / Supabase source's `GROUP BY`), so it scales
   * past what a page holds. Click a category to drill (`onDrill`).
   */
  import { SvGridChart, SvGridDropdown, type ChartSpec, type ChartType, type ChartSelection } from '@svgrid/grid'
  import { titleCase, type EntitySchema } from './schema'
  import {
    aggregateRows,
    chartFieldsFromSchema,
    type AggregateBucket,
    type AggregateReduce,
    type AggregateRequest,
  } from './sources/aggregate'

  type FilterModel = AggregateRequest['filterModel']

  type Props = {
    schema: EntitySchema<TData>
    /** Client-side data to aggregate. Ignored when `getAggregate` is set. */
    rows?: ReadonlyArray<TData>
    /** Server-side aggregation (a data source's `getAggregate`). Takes precedence. */
    getAggregate?: (request: AggregateRequest) => Promise<AggregateBucket[]>
    /** Filter passed to `getAggregate`. */
    filterModel?: FilterModel
    dimension?: string
    measure?: string
    reduce?: AggregateReduce
    type?: ChartType
    /** Show the built-in dimension / measure / type controls. Default true. */
    controls?: boolean
    height?: number
    width?: number
    dataLabels?: boolean
    formatValue?: (v: number) => string
    onDrill?: (category: string, dimension: string) => void
    /** Bump to re-fetch server aggregates (e.g. after a mutation). */
    refreshKey?: unknown
    /** Brand color. Bars / lines use it; pie slices grouped by an enum use the
     *  enum's own option colors (matching status badges). */
    accent?: string
  }

  let {
    schema,
    rows,
    getAggregate,
    filterModel,
    dimension,
    measure,
    reduce,
    type,
    controls = true,
    height = 300,
    width = 460,
    dataLabels = true,
    formatValue,
    onDrill,
    refreshKey,
    accent,
  }: Props = $props()

  const fields = $derived(chartFieldsFromSchema(schema as EntitySchema))

  // Render the chart at its ACTUAL pixel width so the SVG viewBox maps 1:1 to
  // screen pixels (scale factor = 1). Otherwise the SVG stretches to fill a wide
  // block and its text (font-size in user units) scales up with it - "fonts that
  // grow with the chart". Measured width keeps labels at a fixed px size, like
  // the grid. Falls back to the `width` prop until the first measurement.
  let measuredW = $state(0)
  let plotEl: HTMLDivElement | undefined = $state()
  $effect(() => {
    const el = plotEl
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0)
      if (w > 0 && w !== measuredW) measuredW = w
    })
    ro.observe(el)
    return () => ro.disconnect()
  })

  let dim = $state('')
  let msr = $state('')
  let red = $state<AggregateReduce>('sum')
  let ctype = $state<ChartType>('bar')

  // Follow the props reactively, so a controlled parent (e.g. the Studio preview,
  // which hides the dropdowns) updates the chart whenever its dimension / measure /
  // reduce / type change. One effect per prop so a change to one doesn't reset the
  // others; the built-in dropdowns still write to this state and persist, because a
  // dropdown change doesn't feed back into the props (so these effects don't re-run).
  $effect(() => { if (type !== undefined) ctype = type })
  $effect(() => { if (dimension !== undefined) dim = dimension })
  $effect(() => { if (measure !== undefined) msr = measure })
  $effect(() => { if (reduce !== undefined) red = reduce })
  // Keep the dimension / measure valid for the schema.
  $effect(() => {
    if (!dim || !fields.dimensions.includes(dim)) dim = fields.defaultDimension ?? fields.dimensions[0] ?? ''
    if ((!msr || !fields.measures.includes(msr)) && fields.measures.length) msr = fields.defaultMeasure ?? fields.measures[0] ?? ''
  })

  const labelOf = (field: string) => schema.fields.find((f) => f.field === field)?.label ?? titleCase(field)
  const measureLabel = $derived(
    red === 'count' ? 'Count' : `${red[0]!.toUpperCase() + red.slice(1)} ${labelOf(msr)}`,
  )

  let serverBuckets = $state<AggregateBucket[]>([])
  let fetchToken = 0
  $effect(() => {
    if (!getAggregate || !dim) return
    void refreshKey // re-run after a mutation
    const req: AggregateRequest = { dimension: dim, measure: msr || undefined, reduce: red, filterModel }
    const token = ++fetchToken
    getAggregate(req).then((bs) => {
      if (token === fetchToken) serverBuckets = bs
    })
  })

  const buckets = $derived(
    getAggregate
      ? serverBuckets
      : dim
        ? aggregateRows((rows ?? []) as ReadonlyArray<ChartRow>, { dimension: dim, measure: msr || undefined, reduce: red })
        : [],
  )

  // Options for the custom dropdown controls.
  const dimOptions = $derived(fields.dimensions.map((d) => ({ value: d, label: labelOf(d) })))
  const measureOptions = $derived(fields.measures.map((m) => ({ value: m, label: labelOf(m) })))
  const reduceOptions = [
    { value: 'count', label: 'Count' }, { value: 'sum', label: 'Sum' }, { value: 'avg', label: 'Average' },
    { value: 'min', label: 'Min' }, { value: 'max', label: 'Max' },
  ]
  const typeOptions = [
    { value: 'bar', label: 'Bar' }, { value: 'pie', label: 'Pie' }, { value: 'line', label: 'Line' }, { value: 'area', label: 'Area' },
    { value: 'radar', label: 'Radar' }, { value: 'funnel', label: 'Funnel' }, { value: 'waterfall', label: 'Waterfall' }, { value: 'treemap', label: 'Treemap' },
  ]
  // Cartesian types get x/y axis titles; radial / area-partition types don't.
  const CARTESIAN_TYPES = new Set<ChartType>(['bar', 'line', 'area', 'waterfall'])

  // Per-category colors from the dimension's enum options (status/stage/etc), in
  // bucket order, so a pie's slices match the grid's badge colors.
  const categoryColors = $derived.by<string[] | undefined>(() => {
    const opts = schema.fields.find((f) => f.field === dim)?.options
    if (!opts?.length) return undefined
    return buckets.map((b) => {
      const opt = opts.find((o) => String(o.value) === String(b.category))
      return opt?.color || accent || '#6366f1'
    })
  })

  const spec = $derived.by<ChartSpec>(() => {
    const s: ChartSpec = {
      type: ctype,
      categories: buckets.map((b) => b.category),
      // Bars / lines / areas take the brand accent; pie ignores series color and
      // uses the palette (semantic enum colors when available).
      series: [{ label: measureLabel, values: buckets.map((b) => b.value), ...(accent ? { color: accent } : {}) }],
      width: measuredW || width,
      height,
      ...(categoryColors ? { palette: categoryColors } : {}),
    }
    if (ctype === 'pie') s.innerRadius = 0.6
    // Treemap reads a tree, not a category/series pair - build a flat one from
    // the same buckets (each dimension value is a leaf sized by the measure).
    if (ctype === 'treemap') s.treemap = { name: measureLabel, children: buckets.map((b) => ({ name: b.category, value: b.value })) }
    if (CARTESIAN_TYPES.has(ctype)) {
      s.xAxisTitle = labelOf(dim)
      s.yAxisTitle = measureLabel
    }
    return s
  })

  function onSelect(sel: ChartSelection) {
    onDrill?.(String(sel.category), dim)
  }
</script>

<div class="sv-chart">
  {#if controls}
    <div class="sv-chart__controls">
      <div class="sv-chart__ctrl">
        <span>Group by</span>
        <div class="sv-chart__dd"><SvGridDropdown options={dimOptions} value={dim} autoOpen={false} onChange={(v) => (dim = String(v))} /></div>
      </div>
      <div class="sv-chart__ctrl">
        <span>Measure</span>
        <div class="sv-chart__dd"><SvGridDropdown options={reduceOptions} value={red} autoOpen={false} onChange={(v) => (red = v as AggregateReduce)} /></div>
      </div>
      {#if red !== 'count' && fields.measures.length}
        <div class="sv-chart__ctrl">
          <span>of</span>
          <div class="sv-chart__dd"><SvGridDropdown options={measureOptions} value={msr} autoOpen={false} onChange={(v) => (msr = String(v))} /></div>
        </div>
      {/if}
      <div class="sv-chart__ctrl">
        <span>Type</span>
        <div class="sv-chart__dd"><SvGridDropdown options={typeOptions} value={ctype} autoOpen={false} onChange={(v) => (ctype = v as ChartType)} /></div>
      </div>
    </div>
  {/if}

  {#if dim}
    <div class="sv-chart__plot" bind:this={plotEl}>
      <SvGridChart {spec} {dataLabels} {formatValue} {onSelect} />
    </div>
  {:else}
    <p class="sv-chart__empty">No chart-able fields in this schema.</p>
  {/if}
</div>

<style>
  .sv-chart { display: flex; flex-direction: column; gap: 10px; }
  .sv-chart__plot { width: 100%; min-width: 0; }
  .sv-chart__controls { display: flex; flex-wrap: wrap; gap: 10px; }
  .sv-chart__ctrl { display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 600; color: var(--sg-muted, #666); }
  .sv-chart__dd {
    position: relative; height: 32px; min-width: 130px;
    border: 1px solid var(--sg-border, #ccc); border-radius: 8px; background: var(--sg-input-bg, #fff);
  }
  .sv-chart__dd :global(.sv-grid-dropdown),
  .sv-chart__dd :global(.sv-grid-dropdown-trigger) { background: transparent; border-radius: 8px; }
  .sv-chart__empty { color: var(--sg-muted, #888); font-size: 13px; padding: 24px; text-align: center; }
</style>
