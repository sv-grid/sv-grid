<script lang="ts">
  /**
   * Pivot dashboard: one cube, one chart, one drill rail, all over the same
   * facts.
   *
   * The point of the layout is that the three panes cannot disagree. The pivot
   * summarises `facts`; the chart re-aggregates the same array along the first
   * row dimension; the drill rail filters it back down to the rows behind one
   * clicked cell. Change the layout in the designer and all three follow.
   */
  import { SvPivotDesigner, setLicenseKey, type PivotField, type PivotLayout, type PivotRow } from '@svgrid/enterprise'
  import { drillThrough, type Drill } from '$lib/drill'
  import type { Fact } from '$lib/facts'
  import DrillRail from './DrillRail.svelte'
  import TrendChart from './TrendChart.svelte'

  // Swap for your own key. Unlicensed use still runs - it just nudges.
  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  let { data } = $props()
  const facts = $derived(data.facts as Fact[])

  const fields: PivotField[] = [
    { field: 'region', kind: 'dimension', label: 'Region' },
    { field: 'country', kind: 'dimension', label: 'Country' },
    { field: 'city', kind: 'dimension', label: 'City' },
    { field: 'channel', kind: 'dimension', label: 'Channel' },
    { field: 'customer', kind: 'dimension', label: 'Customer' },
    { field: 'year', kind: 'dimension', label: 'Year' },
    { field: 'quarter', kind: 'dimension', label: 'Quarter' },
    { field: 'revenue', kind: 'measure', label: 'Revenue' },
    { field: 'units', kind: 'measure', label: 'Units' },
  ]

  let layout = $state<PivotLayout>({
    rows: ['region', 'country'],
    cols: ['year'],
    values: [{ field: 'revenue', agg: 'sum' }],
    // Required by PivotLayout. Empty means every fact passes.
    filters: [],
  })

  // The designer hands back the rows it rendered. Drill-through needs them to
  // walk a clicked row up to its ancestors.
  let pivotRows = $state<PivotRow[]>([])
  let drill = $state<Drill | null>(null)

  const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const plain = (n: number) => n.toLocaleString()
  const measure = $derived(layout.values[0]?.field ?? 'revenue')
  const format = $derived(measure === 'units' ? plain : money)

  /** Chart series: the active measure totalled by the first row dimension. */
  const series = $derived.by(() => {
    const dimension = layout.rows[0]
    if (!dimension) return []
    const totals = new Map<string, number>()
    for (const fact of facts) {
      const key = String((fact as unknown as Record<string, unknown>)[dimension])
      const value = Number((fact as unknown as Record<string, unknown>)[measure] ?? 0)
      totals.set(key, (totals.get(key) ?? 0) + value)
    }
    return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  })

  /** The chart highlights whichever top-level value the drill is inside. */
  const activeBar = $derived(drill && layout.rows[0] ? (drill.filter[layout.rows[0]] ?? null) : null)

  function onCellClick(event: { row: PivotRow; columnId: string }) {
    // The row-header column is a label, not an aggregation - nothing to drill.
    if (event.columnId === '__pivotRowHeader') return
    drill = drillThrough(facts, event.row, event.columnId, pivotRows, layout)
  }

  /** Clicking a bar drills the whole of that dimension value. */
  function onBarSelect(label: string) {
    const dimension = layout.rows[0]
    if (!dimension) return
    const matched = facts.filter((f) => String((f as unknown as Record<string, unknown>)[dimension]) === label)
    drill = {
      rowLabel: label,
      filter: { [dimension]: label },
      facts: matched,
      measure,
      total: matched.reduce((sum, f) => sum + Number((f as unknown as Record<string, unknown>)[measure] ?? 0), 0),
    }
  }
</script>

<svelte:head><title>Pivot dashboard</title></svelte:head>

<h1>Sales cube</h1>
<p class="lede">
  {plain(facts.length)} facts, summarised on the server and pivoted in the browser.
  Click any aggregated cell to see the rows behind it.
</p>

<div class="layout" class:has-drill={drill !== null}>
  <section class="cube" aria-label="Pivot">
    <SvPivotDesigner
      data={facts}
      {fields}
      bind:layout
      expandable
      panelPosition="right"
      onPivot={(rows: PivotRow[]) => (pivotRows = rows)}
      {onCellClick}
    />
  </section>

  <section class="chart" aria-label="Totals by {layout.rows[0] ?? 'dimension'}">
    <h2>Total {measure} by {layout.rows[0] ?? 'dimension'}</h2>
    <TrendChart {series} {format} active={activeBar} onSelect={onBarSelect} />
  </section>

  {#if drill}
    <DrillRail {drill} {format} onClose={() => (drill = null)} />
  {/if}
</div>

<style>
  h1 { margin: 0 0 0.25rem; font-size: 1.4rem; }
  .lede { margin: 0 0 1.25rem; color: var(--sg-muted, #64748b); }
  .layout { display: grid; gap: 1rem; grid-template-columns: 1fr; }
  .cube { min-width: 0; height: 460px; }
  .chart {
    min-width: 0; padding: 1rem;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
  }
  .chart h2 { margin: 0 0 0.75rem; font-size: 0.95rem; text-transform: capitalize; }
  /* Side by side once there is room. Below this the panes stack, which keeps
     the pivot usable on a phone instead of squeezing three columns in. */
  @media (min-width: 60rem) {
    .layout { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
    .cube { grid-column: 1 / -1; }
    .layout.has-drill .cube { grid-column: 1 / -1; }
  }
</style>
