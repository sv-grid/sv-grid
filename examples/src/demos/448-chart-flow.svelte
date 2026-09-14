<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 448. Sankey and chord diagrams
   * ------------------------------
   * Where things go: energy from its sources through the carriers to its
   * uses, and trade between five regions.
   *
   * - A sankey takes `sankeyNodes` and `sankeyLinks` (`source`, `target`,
   *   `value`); nodes are placed in columns by their depth and the ribbon
   *   width is the value. Three columns here: source, carrier, use. Hover a
   *   ribbon for its value, a node for its total.
   * - A chord takes the same nodes and links but arranges them on a circle,
   *   which is the shape for flows that go both ways: exports from A to B
   *   and from B to A are two ribbons between the same arcs.
   * - `specToSankey` builds nodes and links from a split spec when the data
   *   comes from rows.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const energy: ChartSpec = {
    type: 'sankey',
    categories: [],
    series: [],
    sankeyNodes: [
      { id: 'Solar', color: '#f59e0b' }, { id: 'Wind', color: '#0ea5e9' }, { id: 'Gas', color: '#94a3b8' }, { id: 'Nuclear', color: '#8b5cf6' }, { id: 'Hydro', color: '#2563eb' },
      { id: 'Electricity', color: '#16a34a' }, { id: 'Heat', color: '#ef4444' },
      { id: 'Homes' }, { id: 'Industry' }, { id: 'Transport' }, { id: 'Losses', color: '#cbd5e1' },
    ],
    sankeyLinks: [
      { source: 'Solar', target: 'Electricity', value: 18 },
      { source: 'Wind', target: 'Electricity', value: 27 },
      { source: 'Gas', target: 'Electricity', value: 22 },
      { source: 'Gas', target: 'Heat', value: 31 },
      { source: 'Nuclear', target: 'Electricity', value: 19 },
      { source: 'Hydro', target: 'Electricity', value: 9 },
      { source: 'Electricity', target: 'Homes', value: 30 },
      { source: 'Electricity', target: 'Industry', value: 36 },
      { source: 'Electricity', target: 'Transport', value: 14 },
      { source: 'Electricity', target: 'Losses', value: 15 },
      { source: 'Heat', target: 'Homes', value: 19 },
      { source: 'Heat', target: 'Industry', value: 12 },
    ],
    title: 'Energy flows',
    subtitle: 'Sources to carriers to uses, terawatt-hours',
    height: 380,
  }

  const regions = ['Europe', 'N. America', 'Asia', 'S. America', 'Africa']
  const trade = [
    [0, 62, 88, 21, 17],
    [58, 0, 74, 33, 9],
    [95, 81, 0, 26, 24],
    [18, 29, 22, 0, 6],
    [14, 8, 27, 5, 0],
  ]
  const chord: ChartSpec = {
    type: 'chord',
    categories: [],
    series: [],
    sankeyNodes: regions.map((r) => ({ id: r })),
    sankeyLinks: regions.flatMap((from, i) => regions.map((to, j) => ({ source: from, target: to, value: trade[i]![j]! })).filter((l) => l.value > 0)),
    title: 'Trade between regions',
    subtitle: 'Exports both ways, billions',
    height: 380,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <span class="note">
      A three-column sankey with the ribbon width as the value, and a chord diagram for flows that
      run both ways between the same arcs. Hover a ribbon or a node.
    </span>
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={energy} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={energy} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={chord} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={chord} />
      {/if}
    </div>
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
  .row {
    display: flex;
    flex: none;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pane {
    flex: 1 1 420px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
</style>
