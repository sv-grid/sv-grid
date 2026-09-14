<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 450. Gauges and bullet charts
   * -----------------------------
   * A KPI strip: three gauges for the numbers that get watched, and bullet
   * charts for the ones that get compared to a target.
   *
   * - A gauge is `gaugeValue` between `gaugeMin` and `gaugeMax`, with
   *   `gaugeRanges` as the coloured bands behind the needle, `gaugeTarget`
   *   as a tick, and `gaugeUnit` after the number. Drag the sliders: the
   *   needle sweeps to the new value (`animate`).
   * - A bullet chart is a bar against its target with qualitative ranges
   *   behind it (`bulletRanges`: poor, fair, good), one row per KPI; the
   *   compact way to put six targets on one screen.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let uptime = $state(99.93)
  let latency = $state(184)
  let errors = $state(0.42)
  let animate = $state(true)

  const gauge = (value: number, opts: Omit<ChartSpec, 'type' | 'categories' | 'series' | 'gaugeValue'>): ChartSpec => ({
    type: 'gauge', categories: [], series: [], gaugeValue: value, height: 220, ...opts,
  })
  const gauges = $derived<ChartSpec[]>([
    gauge(uptime, { title: 'Uptime', gaugeMin: 99, gaugeMax: 100, gaugeTarget: 99.95, gaugeUnit: '%', gaugeRanges: [{ from: 99, to: 99.5, color: '#ef4444' }, { from: 99.5, to: 99.9, color: '#f59e0b' }, { from: 99.9, to: 100, color: '#16a34a' }] }),
    gauge(latency, { title: 'p95 latency', gaugeMin: 0, gaugeMax: 500, gaugeTarget: 200, gaugeUnit: 'ms', gaugeRanges: [{ from: 0, to: 200, color: '#16a34a' }, { from: 200, to: 350, color: '#f59e0b' }, { from: 350, to: 500, color: '#ef4444' }] }),
    gauge(errors, { title: 'Error rate', gaugeMin: 0, gaugeMax: 2, gaugeTarget: 0.5, gaugeUnit: '%', gaugeRanges: [{ from: 0, to: 0.5, color: '#16a34a' }, { from: 0.5, to: 1, color: '#f59e0b' }, { from: 1, to: 2, color: '#ef4444' }] }),
  ])

  const bullets: ChartSpec = {
    type: 'bullet',
    categories: ['Revenue', 'New customers', 'Net retention', 'Support CSAT', 'Deploy frequency', 'Cost per lead'],
    series: [
      { label: 'Actual', values: [82, 64, 108, 91, 73, 58], targets: [90, 70, 100, 85, 80, 50] },
    ],
    bulletRanges: [{ from: 0, to: 50, color: '#e2e8f0' }, { from: 50, to: 80, color: '#cbd5e1' }, { from: 80, to: 120, color: '#94a3b8' }],
    title: 'Quarter to date against target',
    subtitle: 'Percent of target; the tick is the target, the bands are poor, fair and good',
    yAxis: { max: 120 },
    height: 300,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">Uptime <input type="range" min="99" max="100" step="0.01" bind:value={uptime} /><span class="muted">{uptime.toFixed(2)}%</span></label>
    <label class="ctl">Latency <input type="range" min="0" max="500" step="1" bind:value={latency} /><span class="muted">{latency} ms</span></label>
    <label class="ctl">Errors <input type="range" min="0" max="2" step="0.01" bind:value={errors} /><span class="muted">{errors.toFixed(2)}%</span></label>
    <label class="chk"><input type="checkbox" bind:checked={animate} /> Animate</label>
    <span class="note">Three gauges with coloured bands and a target tick, and six KPIs as bullet charts against their targets.</span>
  </header>

  <div class="row">
    {#each gauges as g (g.title)}
      <div class="pane pane-gauge">
        {#if view === 'chart'}
          <SvChart spec={g} legend={false} {animate} autosize />
        {:else}
          <ChartDataGrid spec={g} />
        {/if}
      </div>
    {/each}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={bullets} legend={false} autosize />
    {:else}
      <ChartDataGrid spec={bullets} />
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
  .note,
  .muted {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .chk,
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
  }
  .ctl input[type='range'] {
    width: 90px;
  }
  .row {
    display: flex;
    flex: none;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pane {
    flex: none;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
  .pane-gauge {
    flex: 1 1 220px;
  }
</style>
