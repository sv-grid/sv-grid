<script lang="ts">
  /**
   * SvGridChartView - the built-in renderer for the grid's `chart` view. It is a
   * thin adapter: take the grid's filtered + sorted rows, map the ChartViewConfig
   * onto `rowsToChartSpec`, and render the standalone SvChart (SvGridChart) sized
   * to fill the container. This is the piece that makes "chart" a view of the
   * grid, and it stays a thin wrapper precisely because the chart primitive is
   * reusable on its own (unlike the board / scheduler renderers).
   *
   * The grid lazy-loads this by default; a host can replace it via
   * `registerChartView` when it needs a richer renderer.
   */
  import SvGridChart from "./SvGridChart.svelte";
  import { rowsToChartSpec, type ChartSpec } from "./chart";
  import type { ChartViewConfig } from "./SvGrid.types";

  let {
    data,
    chart,
  }: {
    data: ReadonlyArray<Record<string, unknown>>;
    /** Present for parity with board/scheduler renderers; unused here. */
    columns?: unknown;
    getRowId?: unknown;
    chart: ChartViewConfig;
  } = $props();

  // Container size -> chart viewBox, so the chart fills the grid area and
  // re-lays out on resize (the same responsive behaviour a table view has).
  let w = $state(0);
  let h = $state(0);

  const spec = $derived.by<ChartSpec>(() => {
    const s = rowsToChartSpec((data ?? []) as ReadonlyArray<Record<string, unknown>>, {
      type: chart.type ?? "bar",
      category: chart.category,
      value: chart.value,
      series: chart.series,
      reduce: chart.reduce,
      stacked: chart.stacked,
      stacked100: chart.stacked100,
      sort: chart.sort,
      topN: chart.topN,
      palette: chart.palette,
    });
    if (chart.valueFormat) s.valueFormat = chart.valueFormat;
    return s;
  });
</script>

<div class="sv-grid-chart-view" bind:clientWidth={w} bind:clientHeight={h}>
  {#if w > 0 && h > 0}
    <SvGridChart
      {spec}
      width={w}
      height={h}
      legend={chart.legend ?? true}
      dataLabels={chart.dataLabels ?? false}
    />
  {/if}
</div>

<style>
  .sv-grid-chart-view {
    width: 100%;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
  }
</style>
