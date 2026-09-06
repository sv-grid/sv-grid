<script lang="ts">
  /**
   * The drill-through rail: the facts behind one clicked pivot cell.
   *
   * The KPI at the top is recomputed from the same rows the grid below lists,
   * so it always matches the cell that was clicked. If it ever did not, the
   * drill filter and the pivot aggregation would have drifted apart.
   */
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { Drill } from '$lib/drill'
  import { drillBreadcrumb } from '$lib/drill'
  import type { Fact } from '$lib/facts'

  type Props = {
    drill: Drill
    format: (value: number) => string
    onClose: () => void
  }

  let { drill, format, onClose }: Props = $props()

  const columns: GridColumns<Fact> = [
    { field: 'customer', header: 'Customer' },
    { field: 'city', header: 'City' },
    { field: 'channel', header: 'Channel' },
    { field: 'quarter', header: 'Qtr' },
    { field: 'revenue', header: 'Revenue', align: 'right' },
    { field: 'units', header: 'Units', align: 'right' },
  ]

  const average = $derived(drill.facts.length ? drill.total / drill.facts.length : 0)
</script>

<aside class="rail" aria-label="Drill-through">
  <header>
    <div>
      <p class="eyebrow">Drill-through</p>
      <h2>{drillBreadcrumb(drill)}</h2>
    </div>
    <button type="button" onclick={onClose} aria-label="Close drill-through">&times;</button>
  </header>

  <dl class="kpis">
    <div><dt>{drill.measure}</dt><dd>{format(drill.total)}</dd></div>
    <div><dt>Facts</dt><dd>{drill.facts.length.toLocaleString()}</dd></div>
    <div><dt>Average</dt><dd>{format(Math.round(average))}</dd></div>
  </dl>

  <div class="grid">
    <SvGrid data={drill.facts} {columns} sortable containerHeight={340} />
  </div>
</aside>

<style>
  .rail {
    display: flex; flex-direction: column; gap: 1rem; min-width: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
    background: var(--sg-bg, #fff); padding: 1rem;
  }
  header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
  .eyebrow {
    margin: 0 0 0.15rem; font-size: 0.6875rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
  }
  h2 { margin: 0; font-size: 1rem; }
  header button {
    font: inherit; font-size: 1.25rem; line-height: 1; padding: 0.1rem 0.4rem; cursor: pointer;
    background: none; border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius, 8px); color: var(--sg-fg, #0f172a);
  }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin: 0; }
  .kpis div {
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
    padding: 0.5rem 0.6rem;
  }
  dt {
    font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--sg-muted, #64748b);
  }
  dd { margin: 0.15rem 0 0; font-size: 1rem; font-weight: 650; font-variant-numeric: tabular-nums; }
  .grid { min-width: 0; }
</style>
