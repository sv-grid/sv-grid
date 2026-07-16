<script lang="ts" module>
  type DashRow = Record<string, unknown>
</script>

<script lang="ts" generics="TData extends DashRow">
  /**
   * SvSchemaDashboard - a schema-driven dashboard: KPI tiles + charts composed
   * from a declarative `DashboardSpec` (defaults to `dashboardFromSchema`). It's
   * a data *view*, not a page builder - the spec is plain data and every chart is
   * an `SvSchemaChart` with its controls off. KPI tiles reduce over the passed
   * `rows`; charts prefer a server `getAggregate` when given, else `rows`.
   */
  import SvSchemaChart from './SvSchemaChart.svelte'
  import type { EntitySchema } from './schema'
  import { dashboardFromSchema, reduceValue, type DashboardSpec } from './sources/dashboard'
  import type { AggregateBucket, AggregateRequest, AggregateReduce } from './sources/aggregate'

  type Props = {
    schema: EntitySchema<TData>
    /** Rows for KPI tiles (and charts when there's no `getAggregate`). */
    rows?: ReadonlyArray<TData>
    /**
     * Server-side aggregation (a data source's `getAggregate`). When set, KPI
     * tiles AND charts are computed server-side (KPIs via a dimension-less
     * request), so they're correct over the whole table, not just a page.
     */
    getAggregate?: (request: AggregateRequest) => Promise<AggregateBucket[]>
    /** Filter applied to every widget (KPIs + charts), same shape the grid emits. */
    filterModel?: AggregateRequest['filterModel']
    /** Widget layout. Defaults to a sensible set from the schema. */
    spec?: DashboardSpec
    /** Bump to re-fetch server aggregates after a mutation. */
    refreshKey?: unknown
    onDrill?: (category: string, dimension: string) => void
    title?: string
  }

  let { schema, rows, getAggregate, filterModel, spec, refreshKey, onDrill, title }: Props = $props()

  const widgets = $derived((spec ?? dashboardFromSchema(schema as EntitySchema)).widgets)
  const data = $derived((rows ?? []) as ReadonlyArray<TData>)

  const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
  const fmt = (v: number, f?: (v: number) => string) => (f ? f(v) : compact.format(v))

  // Server KPIs: when `getAggregate` is set, fetch each KPI as a dimension-less
  // aggregate (a grand total over the whole table), re-running on refresh/filter.
  let serverKpis = $state<number[]>([])
  let kpiToken = 0
  $effect(() => {
    if (!getAggregate) return
    void refreshKey
    const reqs = widgets.map((w) =>
      w.kind === 'kpi' ? getAggregate({ measure: w.measure, reduce: w.reduce, filterModel }) : null,
    )
    const token = ++kpiToken
    Promise.all(reqs.map((r) => (r ? r.then((bs) => bs[0]?.value ?? 0) : Promise.resolve(0)))).then((vals) => {
      if (token === kpiToken) serverKpis = vals
    })
  })
  const kpiValue = (w: { measure?: string; reduce: AggregateReduce }, i: number) =>
    getAggregate ? (serverKpis[i] ?? 0) : reduceValue(data, { measure: w.measure, reduce: w.reduce })
</script>

<section class="dash">
  {#if title}<h3 class="dash__title">{title}</h3>{/if}
  <div class="dash__grid">
    {#each widgets as w, i (i)}
      {#if w.kind === 'kpi'}
        <div class="dash__kpi">
          <span class="dash__kpi-label">{w.label}</span>
          <span class="dash__kpi-value">{fmt(kpiValue(w, i), w.format)}</span>
        </div>
      {:else}
        <div class="dash__chart" style="grid-column: span {Math.min(w.span ?? 2, 3)}">
          {#if w.label}<span class="dash__chart-label">{w.label}</span>{/if}
          <SvSchemaChart
            schema={schema as EntitySchema}
            rows={getAggregate ? undefined : (data as ReadonlyArray<DashRow>)}
            {getAggregate}
            {filterModel}
            dimension={w.dimension}
            measure={w.measure}
            reduce={w.reduce}
            type={w.type}
            controls={false}
            height={230}
            width={420}
            {refreshKey}
            onDrill={(category, dimension) => onDrill?.(category, dimension)}
          />
        </div>
      {/if}
    {/each}
  </div>
</section>

<style>
  .dash { display: flex; flex-direction: column; gap: 12px; }
  .dash__title { margin: 0; font-size: 15px; font-weight: 650; color: var(--sg-fg, #0f172a); }
  .dash__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    /* Size rows to content; otherwise implicit auto rows stretch to fill a
       bounded-height container and shrink below each widget, overlapping them. */
    grid-auto-rows: max-content;
    gap: 12px;
    align-items: start;
  }
  .dash__kpi {
    display: flex; flex-direction: column; gap: 6px;
    padding: 16px 16px 18px;
    border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px;
    background: var(--sg-bg, #fff);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  }
  .dash__kpi-label { font-size: 12.5px; font-weight: 550; color: var(--sg-muted, #64748b); }
  .dash__kpi-value { font-size: 26px; font-weight: 720; letter-spacing: -0.02em; color: var(--sg-fg, #0f172a); }
  .dash__chart {
    display: flex; flex-direction: column; gap: 8px;
    padding: 14px 14px 12px; min-width: 0;
    border: 1px solid var(--sg-border, #e6e8ec); border-radius: 12px;
    background: var(--sg-bg, #fff);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  }
  .dash__chart-label { font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  @media (max-width: 620px) {
    .dash__chart { grid-column: span 1 !important; }
  }
</style>
