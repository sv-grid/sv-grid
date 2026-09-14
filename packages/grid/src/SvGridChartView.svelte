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
    localization,
  }: {
    data: ReadonlyArray<Record<string, unknown>>;
    /** Present for parity with board/scheduler renderers; unused here. */
    columns?: unknown;
    getRowId?: unknown;
    chart: ChartViewConfig;
    /** The grid's localization, so a localized grid gets a localized chart
     *  without saying so twice. Resolved here rather than in SvGrid because
     *  this renderer is lazy: a grid that never charts should not carry the
     *  fallback in its base bundle. */
    localization?: { locale?: string | ReadonlyArray<string> };
  } = $props();

  // The chart fills the grid area and re-lays out on resize (the same
  // responsive behaviour a table view has) through its own `autosize`, which
  // also keeps its legend inside the box instead of below it.

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
    const locale = chart.locale ?? localization?.locale;
    if (locale) s.locale = locale;
    if (chart.currency) s.currency = chart.currency;
    return s;
  });
</script>

<div class="sv-grid-chart-view">
  <SvGridChart
    {spec}
    autosize
    legend={chart.legend ?? true}
    dataLabels={chart.dataLabels ?? false}
  />
</div>

<style>
  /* A grid, so the autosized chart is stretched to the full height rather
     than asking for a percentage of it (which cannot be measured reliably). */
  .sv-grid-chart-view {
    display: grid;
    width: 100%;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
  }
</style>
