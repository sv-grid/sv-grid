<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 451. Annotations, reference marks and notes
   * -------------------------------------------
   * Five years of a company's monthly active users with the story drawn on
   * the chart:
   *
   * - `annotations` pin a label to a data point: a flag for each launch, a
   *   pin for the outage, a plain dot for the pricing change, each with a
   *   `text` the tooltip shows and a `placement` for the label.
   * - `referenceBands` shade the recession quarters on the x axis and the
   *   target band on the y axis; `referenceLines` mark the all-time high
   *   with a pill on the axis and the acquisition on the x axis.
   * - `drawings` are the analyst's marks (a trend line, a rectangle, a note)
   *   as data points, so they stay put when the chart is zoomed or resized;
   *   `drawable` puts the tools in the toolbar to add your own, and the
   *   `annotatable` toggle lets a reader pin a note on a click.
   * - `tooltipSticky` pins the tooltip on a click so a note can be read
   *   without holding the pointer still.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartDrawing, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 17
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const months: string[] = []
  for (let i = 0; i < 60; i += 1) months.push(new Date(Date.UTC(2021, i, 1)).toISOString().slice(0, 10))
  const mau: number[] = []
  let v = 120
  for (let i = 0; i < 60; i += 1) {
    const launch = i === 9 || i === 27 || i === 44 ? 1.18 : 1
    const recession = i >= 30 && i <= 35 ? 0.985 : 1.028
    const outage = i === 38 ? 0.9 : 1
    v = v * recession * launch * outage * (0.98 + rnd() * 0.04)
    mau.push(Math.round(v))
  }
  const peak = mau.indexOf(Math.max(...mau))

  let notes = $state<Array<{ category: string; label: string }>>([])
  let drawings = $state<ChartDrawing[]>([
    { id: 'trend', kind: 'trend', points: [{ x: months[0]!, y: 120 }, { x: months[29]!, y: mau[29]! }], color: '#8b5cf6' },
    { id: 'box', kind: 'rect', points: [{ x: months[36]!, y: mau[36]! * 0.85 }, { x: months[41]!, y: mau[41]! * 1.1 }], color: '#f59e0b' },
    { id: 'note', kind: 'text', points: [{ x: months[50]!, y: mau[50]! * 0.8 }], text: 'Q4 push', color: '#0ea5e9' },
  ])

  const spec = $derived<ChartSpec>({
    type: 'area',
    xType: 'time',
    categories: months,
    series: [{ label: 'Monthly active users', values: mau, color: '#2563eb', gradient: true, smooth: true, marker: 'none' }],
    valueFormat: 'compact',
    title: 'Five years of monthly active users',
    subtitle: 'Thousands, with the launches, the outage and the recession marked',
    yAxis: { title: 'MAU (k)', gridLines: true, min: 0 },
    annotations: [
      { at: { category: months[9]! }, label: 'v2 launch', shape: 'flag', color: '#16a34a', text: 'Version 2 shipped: new editor, mobile app' },
      { at: { category: months[27]! }, label: 'Teams plan', shape: 'flag', color: '#16a34a', text: 'Teams plan launched with shared workspaces' },
      { at: { category: months[38]! }, label: 'Outage', shape: 'pin', color: '#dc2626', placement: 'bottom', text: 'Fourteen hours down after a failed migration' },
      { at: { category: months[44]! }, label: 'Pricing change', shape: 'dot', color: '#f59e0b', text: 'Free tier capped at three projects' },
      ...notes.map((n) => ({ at: { category: n.category }, label: n.label, shape: 'square' as const, color: '#0ea5e9' })),
    ],
    referenceBands: [
      { from: months[30]!, to: months[35]!, axis: 'x', label: 'Recession', color: '#64748b', opacity: 0.1 },
      { from: 900, to: 1000, label: 'Target', color: '#16a34a', opacity: 0.08 },
    ],
    referenceLines: [
      { value: mau[peak]!, label: 'All-time high', pill: true, dashed: true, color: '#2563eb' },
      { value: months[52]!, axis: 'x', label: 'Acquired', color: '#8b5cf6', dashed: true },
    ],
    drawings,
    height: 420,
  })

  let n = 0

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <span class="note">
      Flags, pins and dots on data points with a tooltip text each, shaded bands on both axes, a pill
      for the all-time high, and drawings that travel with the data. Use the toolbar's Annotate
      toggle to pin your own note, or the drawing tools to add a mark; click the plot to pin the tooltip.
    </span>
    {#if notes.length}
      <button type="button" class="btn" onclick={() => (notes = [])}>Clear my notes</button>
    {/if}
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart
        {spec}
        legend={false}
        toolbar
        zoomable
        crosshairLabels
        tooltipSticky
        annotatable
        onAnnotate={(at) => (notes = [...notes, { category: at.category, label: `Note ${(n += 1)}` }])}
        onAnnotationRemove={(i) => {
          const fixed = 4
          if (i >= fixed) notes = notes.filter((_, k) => k !== i - fixed)
        }}
        drawable
        onDrawingsChange={(d) => (drawings = d)}
        autosize
      />
    {:else}
      <ChartDataGrid spec={spec} />
    {/if}
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 10px;
    overflow: auto;
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex: none;
  }
  .note {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .btn {
    font: inherit;
    font-size: 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    padding: 3px 9px;
    cursor: pointer;
  }
  .pane {
    flex: none;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
</style>
