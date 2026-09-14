<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 447. Tree maps and sunbursts
   * ----------------------------
   * A portfolio as a hierarchy: sectors, then the holdings in each, sized by
   * market value.
   *
   * - `treemap` takes a `TreeNode` tree: `name`, `value` on the leaves,
   *   `children` on the branches, `color` where you want to say so. The
   *   holdings are coloured by their day's move on a red-to-green ramp, the
   *   way a market map reads, and the sector label sits over its block.
   * - `tree` on a sunburst is the same tree as rings: the sectors inside,
   *   their holdings outside. `drillable` zooms into the ring you click and
   *   `bind:drillPath` gives the breadcrumb back.
   * - `specToTreemap` builds this tree from a split spec when the data comes
   *   from rows rather than a hand-made hierarchy.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, type ChartPointRef, type ChartSpec, type TreeNode } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  type Holding = { sector: string; ticker: string; value: number; change: number }
  const holdings: Holding[] = [
    { sector: 'Technology', ticker: 'NVL', value: 420, change: 2.4 },
    { sector: 'Technology', ticker: 'MSQ', value: 380, change: 0.8 },
    { sector: 'Technology', ticker: 'APX', value: 310, change: -1.1 },
    { sector: 'Technology', ticker: 'ORC', value: 140, change: 1.9 },
    { sector: 'Technology', ticker: 'SNW', value: 60, change: -4.2 },
    { sector: 'Health', ticker: 'LLY', value: 210, change: 1.2 },
    { sector: 'Health', ticker: 'UNH', value: 160, change: -0.6 },
    { sector: 'Health', ticker: 'PFZ', value: 90, change: -2.3 },
    { sector: 'Finance', ticker: 'JPM', value: 190, change: 0.4 },
    { sector: 'Finance', ticker: 'VSA', value: 150, change: 1.1 },
    { sector: 'Finance', ticker: 'GSX', value: 80, change: -0.9 },
    { sector: 'Energy', ticker: 'XOM', value: 130, change: 3.1 },
    { sector: 'Energy', ticker: 'CVX', value: 90, change: 2.2 },
    { sector: 'Consumer', ticker: 'AMZ', value: 260, change: -0.3 },
    { sector: 'Consumer', ticker: 'COS', value: 110, change: 0.7 },
    { sector: 'Consumer', ticker: 'NKE', value: 50, change: -3.5 },
  ]
  const SECTOR_COLORS: Record<string, string> = { Technology: '#2563eb', Health: '#16a34a', Finance: '#f59e0b', Energy: '#ef4444', Consumer: '#8b5cf6' }

  /** Red through neutral to green for a day's move, clamped at 4%. */
  const moveColor = (pct: number) => {
    const t = Math.max(-1, Math.min(1, pct / 4))
    const mix = (a: number, b: number) => Math.round(a + (b - a) * Math.abs(t))
    return t >= 0 ? `rgb(${mix(148, 22)}, ${mix(163, 163)}, ${mix(184, 74)})` : `rgb(${mix(148, 220)}, ${mix(163, 38)}, ${mix(184, 38)})`
  }

  let colorBy = $state<'move' | 'sector'>('move')
  let picked = $state<ChartPointRef[]>([])
  let drillPath = $state<string[]>([])

  const tree = $derived<TreeNode>({
    name: 'Portfolio',
    children: [...new Set(holdings.map((h) => h.sector))].map((sector) => ({
      name: sector,
      color: SECTOR_COLORS[sector],
      children: holdings
        .filter((h) => h.sector === sector)
        .map((h) => ({ name: h.ticker, value: h.value, color: colorBy === 'move' ? moveColor(h.change) : SECTOR_COLORS[sector] })),
    })),
  })
  const treemap = $derived<ChartSpec>({
    type: 'treemap',
    categories: [],
    series: [],
    treemap: tree,
    title: 'Portfolio by sector',
    subtitle: colorBy === 'move' ? "Area is market value, colour is the day's move" : 'Area is market value, colour is the sector',
    valueFormat: 'compact',
    height: 380,
  })
  const sunburst = $derived<ChartSpec>({
    type: 'sunburst',
    categories: [],
    series: [],
    tree,
    title: 'The same portfolio as rings',
    subtitle: drillPath.length ? drillPath.join(' / ') : 'Click a sector to zoom in',
    valueFormat: 'compact',
    height: 380,
  })
  const pickedHolding = $derived(picked[0] ? holdings.find((h) => h.ticker === picked[0]!.category) : null)

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Colour by
      <select bind:value={colorBy}>
        <option value="move">Day's move</option>
        <option value="sector">Sector</option>
      </select>
    </label>
    <span class="note">
      {#if pickedHolding}
        {pickedHolding.ticker}: {pickedHolding.value}M, {pickedHolding.change > 0 ? '+' : ''}{pickedHolding.change}% today
      {:else}
        Sectors as blocks and their holdings inside, sized by value and coloured by the day's move; the
        same tree as a sunburst that drills in. Click a holding.
      {/if}
    </span>
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={treemap} legend={false} selectable bind:selected={picked} autosize />
      {:else}
        <ChartDataGrid spec={treemap} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={sunburst} legend={false} drillable bind:drillPath autosize />
      {:else}
        <ChartDataGrid spec={sunburst} />
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
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
  }
  .ctl select {
    font: inherit;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    padding: 2px 6px;
  }
  .row {
    display: flex;
    flex: none;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pane {
    flex: 1 1 400px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
</style>
