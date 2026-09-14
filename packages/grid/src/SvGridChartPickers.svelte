<script lang="ts" module>
  /**
   * The chart panel's pickers: type, the columns a chart reads, the
   * aggregate, and the per-type switches (stacked, horizontal, donut, log
   * scale, labels, bucket, date axis, bins, funnel shape, candle style,
   * indicator chips), plus the sentence that says why the chosen type cannot
   * draw yet. One component rendered twice: as a row under the panel head,
   * and as a form on the builder's Data tab, so the two never disagree about
   * what a type needs.
   *
   * Every label comes from `GridChartPanelMessages`, so the panel and the
   * builder localize together through `localization.text`.
   */
  import type { ChartReducer, ChartType } from "./chart-types";
  import type { ChartPanelIndicator } from "./chart-financial";
  import type { ChartTimeBucket } from "./chart-stats";
  import type { GridChartPanelMessages } from "./chart-panel-messages";

  /** What the type picker knows about a chart type. */
  export type ChartPanelTypeDef = { value: ChartType; label: string; group: string };
  type Shape = { dims: unknown[]; measures: unknown[]; dates: unknown[] };
  type TypeSeed = { value: ChartType; label: keyof GridChartPanelMessages; group: keyof GridChartPanelMessages; needs?: (c: Shape) => boolean };

  /**
   * The chart types the picker offers, grouped by what they are FOR.
   *
   * `needs` gates on COLUMN SHAPE only, never on the data. Column shape is
   * stable while the user filters; row counts are not, and a picker whose
   * options vanish mid-session because a filter emptied a group is worse than
   * one that explains itself. Data-level problems get a sentence instead, see
   * `typeIssue` below.
   */
  const TYPES: TypeSeed[] = [
    { value: "bar", label: "chartTypeBar", group: "chartGroupCompare" },
    { value: "line", label: "chartTypeLine", group: "chartGroupCompare" },
    { value: "area", label: "chartTypeArea", group: "chartGroupCompare" },
    { value: "lollipop", label: "chartTypeLollipop", group: "chartGroupCompare" },
    { value: "pareto", label: "chartTypePareto", group: "chartGroupCompare" },
    { value: "range-bar", label: "chartTypeRangeBar", group: "chartGroupCompare", needs: (c) => c.measures.length >= 2 },
    { value: "range-area", label: "chartTypeRangeArea", group: "chartGroupCompare", needs: (c) => c.measures.length >= 2 },
    { value: "dumbbell", label: "chartTypeDumbbell", group: "chartGroupCompare", needs: (c) => c.measures.length >= 2 },
    { value: "radial-column", label: "chartTypeRadialColumn", group: "chartGroupCompare" },
    { value: "radial-bar", label: "chartTypeRadialBar", group: "chartGroupCompare" },
    { value: "nightingale", label: "chartTypeNightingale", group: "chartGroupCompare" },
    { value: "pie", label: "chartTypePie", group: "chartGroupPartOfWhole" },
    { value: "treemap", label: "chartTypeTreemap", group: "chartGroupPartOfWhole" },
    { value: "sunburst", label: "chartTypeSunburst", group: "chartGroupPartOfWhole" },
    { value: "funnel", label: "chartTypeFunnel", group: "chartGroupFlow" },
    { value: "waterfall", label: "chartTypeWaterfall", group: "chartGroupFlow" },
    { value: "sankey", label: "chartTypeSankey", group: "chartGroupFlow", needs: (c) => c.dims.length >= 2 },
    { value: "chord", label: "chartTypeChord", group: "chartGroupFlow", needs: (c) => c.dims.length >= 2 },
    { value: "radar", label: "chartTypeRadar", group: "chartGroupDistribution" },
    { value: "heatmap", label: "chartTypeHeatmap", group: "chartGroupDistribution", needs: (c) => c.dims.length >= 2 },
    { value: "scatter", label: "chartTypeScatter", group: "chartGroupDistribution", needs: (c) => c.measures.length >= 2 },
    { value: "boxplot", label: "chartTypeBoxplot", group: "chartGroupDistribution" },
    { value: "histogram", label: "chartTypeHistogram", group: "chartGroupDistribution" },
    { value: "gauge", label: "chartTypeGauge", group: "chartGroupSingleValue" },
    { value: "bullet", label: "chartTypeBullet", group: "chartGroupSingleValue" },
    { value: "calendar", label: "chartTypeCalendar", group: "chartGroupOverTime", needs: (c) => c.dates.length >= 1 },
    { value: "stream", label: "chartTypeStream", group: "chartGroupOverTime", needs: (c) => c.dims.length >= 2 },
    { value: "candlestick", label: "chartTypeCandlestick", group: "chartGroupOverTime", needs: (c) => c.dates.length >= 1 && c.measures.length >= 4 },
    { value: "ohlc", label: "chartTypeOhlc", group: "chartGroupOverTime", needs: (c) => c.dates.length >= 1 && c.measures.length >= 4 },
  ];

  /** The types the panel offers for these columns, labelled in the given language. */
  export function chartPanelTypes(columns: Shape, m: GridChartPanelMessages): ChartPanelTypeDef[] {
    return TYPES.filter((t) => !t.needs || t.needs(columns)).map((t) => ({ value: t.value, label: m[t.label], group: m[t.group] }));
  }

  /** The reducers the Aggregate picker offers, in its order. */
  export function chartPanelReducers(m: GridChartPanelMessages): Array<{ value: ChartReducer; label: string }> {
    return [
      { value: "sum", label: m.chartReduceSum },
      { value: "avg", label: m.chartReduceAvg },
      { value: "count", label: m.chartReduceCount },
      { value: "min", label: m.chartReduceMin },
      { value: "max", label: m.chartReduceMax },
      { value: "median", label: m.chartReduceMedian },
      { value: "p90", label: m.chartReduceP90 },
      { value: "first", label: m.chartReduceFirst },
      { value: "last", label: m.chartReduceLast },
      { value: "countDistinct", label: m.chartReduceCountDistinct },
    ];
  }

  /** Named series palettes. "Theme" defers to --sg-chart-1..8 and the defaults. */
  export const CHART_PANEL_PALETTES: Array<{ key: string; label: keyof GridChartPanelMessages; colors: string[] | null }> = [
    { key: "theme", label: "chartPaletteTheme", colors: null },
    { key: "ocean", label: "chartPaletteOcean", colors: ["#0ea5e9", "#14b8a6", "#6366f1", "#8b5cf6", "#06b6d4"] },
    { key: "sunset", label: "chartPaletteSunset", colors: ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#f97316"] },
    { key: "forest", label: "chartPaletteForest", colors: ["#16a34a", "#65a30d", "#0d9488", "#4d7c0f", "#0891b2"] },
    { key: "slate", label: "chartPaletteSlate", colors: ["#475569", "#0ea5e9", "#64748b", "#38bdf8", "#94a3b8"] },
  ];

  /** The indicator chips a price chart offers: panes first, then overlays. */
  const INDICATORS: Array<{ value: ChartPanelIndicator; label: keyof GridChartPanelMessages; title: keyof GridChartPanelMessages }> = [
    { value: "volume", label: "chartIndVolume", title: "chartIndVolumeTitle" },
    { value: "rsi", label: "chartIndRsi", title: "chartIndRsiTitle" },
    { value: "macd", label: "chartIndMacd", title: "chartIndMacdTitle" },
    { value: "stochastic", label: "chartIndStochastic", title: "chartIndStochasticTitle" },
    { value: "atr", label: "chartIndAtr", title: "chartIndAtrTitle" },
    { value: "obv", label: "chartIndObv", title: "chartIndObvTitle" },
    { value: "sma", label: "chartIndSma", title: "chartIndSmaTitle" },
    { value: "ema", label: "chartIndEma", title: "chartIndEmaTitle" },
    { value: "bb", label: "chartIndBb", title: "chartIndBbTitle" },
    { value: "vwap", label: "chartIndVwap", title: "chartIndVwapTitle" },
  ];
  const OVERLAY_KINDS: ChartPanelIndicator[] = ["sma", "ema", "bb", "vwap"];
  /** The price columns a candlestick / OHLC chart reads, in picker order. */
  const OHLC_FIELDS: Array<{ key: "open" | "high" | "low" | "close" | "volume"; label: keyof GridChartPanelMessages }> = [
    { key: "open", label: "chartOpen" },
    { key: "high", label: "chartHigh" },
    { key: "low", label: "chartLow" },
    { key: "close", label: "chartClosePrice" },
    { key: "volume", label: "chartVolume" },
  ];

  // Which controls this type can actually use. Allow-lists rather than "not
  // pie" guards: with thirty types, "everything except pie" hands a gauge a
  // Stacked checkbox.
  const CARTESIAN: ChartType[] = ["bar", "line", "area", "lollipop", "pareto", "range-bar", "range-area", "dumbbell", "stream"];
  /** Types whose second measure is the HIGH end (or the target) rather than a Y. */
  const TWO_MEASURE: ChartType[] = ["range-bar", "range-area", "dumbbell"];
  const BUCKETS: Array<{ value: ChartTimeBucket | ""; label: keyof GridChartPanelMessages }> = [
    { value: "", label: "chartBucketExact" },
    { value: "day", label: "chartBucketDay" },
    { value: "week", label: "chartBucketWeek" },
    { value: "month", label: "chartBucketMonth" },
    { value: "quarter", label: "chartBucketQuarter" },
    { value: "year", label: "chartBucketYear" },
  ];
</script>

<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
  import type { RowData, TableFeatures } from "./index";
  import type { SvGridController } from "./SvGrid.controller.svelte";
  import { pivotChartType } from "./chart-pivot";

  let {
    ctrl,
    messages: m,
    scope = "panel",
  }: {
    ctrl: SvGridController<TFeatures, TData>;
    messages: GridChartPanelMessages;
    /** `panel`: the row under the panel head, Type first. `builder`: the
     *  Data tab's form, without Type (the gallery picks it). */
    scope?: "panel" | "builder";
  } = $props();

  const columns = $derived(ctrl.chartableColumns);
  /** Pivot mode: the pivot on screen is the chart, so the data pickers go and the
   *  type list keeps the shapes a pivot can take (no scatter, gauge, ranges, candles). */
  const pivot = $derived(ctrl.pivotResult != null);
  const availableTypes = $derived(chartPanelTypes(columns, m).filter((t) => !pivot || pivotChartType(t.value) === t.value));
  const typeGroups = $derived([...new Set(availableTypes.map((t) => t.group))]);
  const reducers = $derived(chartPanelReducers(m));

  function toggleIndicator(kind: ChartPanelIndicator) {
    const on = ctrl.chartIndicators.includes(kind);
    // One overlay at a time: a series carries a single `overlay`.
    const base = OVERLAY_KINDS.includes(kind) ? ctrl.chartIndicators.filter((k) => !OVERLAY_KINDS.includes(k)) : ctrl.chartIndicators;
    ctrl.chartIndicators = on ? base.filter((k) => k !== kind) : [...base, kind];
  }

  const activePalette = $derived(
    CHART_PANEL_PALETTES.find((x) => x.colors && ctrl.chartPalette && x.colors.join() === ctrl.chartPalette.join())?.key ?? "theme",
  );
  const wantsHorizontal = $derived(ctrl.chartType === "bar");
  const wantsDonut = $derived(ctrl.chartType === "pie" || ctrl.chartType === "sunburst");
  const wantsGroupBy = $derived(!pivot && ctrl.chartType !== "gauge" && ctrl.chartType !== "histogram");
  const wantsSplitBy = $derived(
    !pivot && columns.dims.length > 1 &&
      !["pie", "gauge", "waterfall", "funnel", "calendar", "bullet", "pareto", "radial-bar"].includes(ctrl.chartType),
  );
  const wantsStacked = $derived(["bar", "line", "area", "radial-column"].includes(ctrl.chartType));
  const wantsLogScale = $derived(
    CARTESIAN.includes(ctrl.chartType) || ctrl.chartType === "scatter" || ctrl.chartType === "boxplot" || ctrl.chartType === "histogram",
  );
  const wantsDataLabels = $derived(
    !["gauge", "sankey", "calendar", "treemap", "scatter", "boxplot", "chord", "sunburst", "stream"].includes(ctrl.chartType),
  );
  const wantsSecondMeasure = $derived(!pivot && (ctrl.chartType === "scatter" || TWO_MEASURE.includes(ctrl.chartType) || ctrl.chartType === "bullet"));
  /** What the second measure picker is labelled: Y for a scatter, High for a
   *  range, Target for a bullet. */
  const secondMeasureLabel = $derived(ctrl.chartType === "scatter" ? m.chartY : ctrl.chartType === "bullet" ? m.chartTarget : m.chartHigh);
  const wantsFunnelShape = $derived(ctrl.chartType === "funnel");
  const wantsCandleStyle = $derived(ctrl.chartType === "candlestick");
  const wantsOhlc = $derived(!pivot && ctrl.chartIsOhlc);
  const wantsBins = $derived(!pivot && ctrl.chartType === "histogram");
  const wantsValue = $derived(!pivot && !ctrl.chartIsOhlc);
  /**
   * A box plot is the one type that reduces its groups itself: the whole point
   * is the spread of the sample, so `sum | avg | count` has nothing to say
   * about it. Showing an Aggregate select that changes nothing is worse than
   * not showing one.
   */
  const wantsReduce = $derived(!pivot && ctrl.chartType !== "scatter" && ctrl.chartType !== "boxplot" && ctrl.chartType !== "histogram" && !ctrl.chartIsOhlc);

  /**
   * Why the current type cannot draw anything useful yet, as a sentence.
   *
   * The alternative - removing the option - means a chart can disappear from
   * under the user when they filter. Saying what is missing keeps the picker
   * honest without making it unstable.
   */
  const typeIssue = $derived.by<string | null>(() => {
    const t = ctrl.chartType;
    const cats = ctrl.chartSpec?.categories.length ?? 0;
    if (t === "heatmap" && !ctrl.chartSeriesId && columns.dims.length > 1) return m.chartIssueHeatmap;
    if (t === "sankey" && !ctrl.chartSeriesId) return m.chartIssueSankey;
    if (t === "radar" && cats > 0 && cats < 3) return m.chartIssueRadar;
    if (t === "funnel" && cats === 1) return m.chartIssueFunnel;
    if (t === "chord" && !ctrl.chartSeriesId) return m.chartIssueChord;
    if (t === "stream" && !ctrl.chartSeriesId) return m.chartIssueStream;
    if (TWO_MEASURE.includes(t) && !ctrl.effectiveChartMeasure2Id) return m.chartIssueSecondMeasure;
    if (ctrl.chartIsOhlc) {
      const o = ctrl.chartOhlc;
      if (!ctrl.chartOhlcDateId) return m.chartIssueOhlcDate;
      if (!o.open || !o.high || !o.low || !o.close) return m.chartIssueOhlcColumns;
    }
    return null;
  });
</script>

<div class="sv-grid-chart-controls" class:is-form={scope === "builder"} data-scope={scope}>
  {#if scope === "panel"}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{m.chartType}</span>
      <select value={ctrl.chartType} onchange={(e) => (ctrl.chartType = e.currentTarget.value as ChartType)}>
        <!-- Grouped: a flat thirty-item list is a wall. optgroup is native,
             so this costs no new component. -->
        {#each typeGroups as g (g)}
          <optgroup label={g}>
            {#each availableTypes.filter((t) => t.group === g) as t (t.value)}
              <option value={t.value}>{t.label}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
  {/if}
  {#if wantsOhlc}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{m.chartDate}</span>
      <select value={ctrl.chartOhlcDateId ?? ""} onchange={(e) => (ctrl.chartDimensionId = e.currentTarget.value || null)}>
        {#each columns.dates as d (d.id)}<option value={d.id}>{d.label}</option>{/each}
      </select>
    </label>
    {#each OHLC_FIELDS as f (f.key)}
      <label class="sv-grid-chart-ctl">
        <span class="sv-grid-chart-ctl-lbl">{m[f.label]}</span>
        <select value={ctrl.chartOhlc[f.key] ?? ""} onchange={(e) => (ctrl.chartOhlc = { ...ctrl.chartOhlc, [f.key]: e.currentTarget.value || null })}>
          {#if f.key === "volume"}<option value="">{m.chartNone}</option>{/if}
          {#each columns.measures as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
        </select>
      </label>
    {/each}
  {:else if wantsGroupBy}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{ctrl.chartType === "sankey" ? m.chartFrom : ctrl.chartType === "heatmap" ? m.chartColumns : m.chartGroupBy}</span>
      <select value={ctrl.chartDimensionId ?? ""} onchange={(e) => (ctrl.chartDimensionId = e.currentTarget.value || null)}>
        {#each columns.dims as d (d.id)}<option value={d.id}>{d.label}</option>{/each}
      </select>
    </label>
  {/if}
  {#if wantsSplitBy}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{ctrl.chartType === "sankey" ? m.chartTo : ctrl.chartType === "heatmap" ? m.chartRows : m.chartSplitBy}</span>
      <select value={ctrl.chartSeriesId ?? ""} onchange={(e) => (ctrl.chartSeriesId = e.currentTarget.value || null)}>
        <option value="">{m.chartNone}</option>
        {#each columns.dims as d (d.id)}<option value={d.id}>{d.label}</option>{/each}
      </select>
    </label>
  {/if}
  {#if wantsValue}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{ctrl.chartType === "scatter" ? m.chartX : TWO_MEASURE.includes(ctrl.chartType) ? m.chartLow : ctrl.chartType === "gauge" ? m.chartMetric : m.chartValue}</span>
      <select value={ctrl.chartMeasureId ?? ""} onchange={(e) => (ctrl.chartMeasureId = e.currentTarget.value || null)}>
        {#each columns.measures as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
      </select>
    </label>
  {/if}
  {#if wantsSecondMeasure}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{secondMeasureLabel}</span>
      <select value={ctrl.effectiveChartMeasure2Id ?? ""} onchange={(e) => (ctrl.chartMeasure2Id = e.currentTarget.value || null)}>
        {#each columns.measures as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
      </select>
    </label>
  {/if}
  {#if wantsReduce}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{m.chartAggregate}</span>
      <select value={ctrl.chartReduce} onchange={(e) => (ctrl.chartReduce = e.currentTarget.value as ChartReducer)}>
        {#each reducers as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
      </select>
    </label>
  {/if}
  {#if wantsBins}
    <label class="sv-grid-chart-ctl" title={m.chartBinsTitle}>
      <span class="sv-grid-chart-ctl-lbl">{m.chartBins}</span>
      <input class="sv-grid-chart-num" type="number" min="1" max="200" value={ctrl.chartBins ?? ""} placeholder={m.chartBuilderAuto} onchange={(e) => (ctrl.chartBins = e.currentTarget.value ? Number(e.currentTarget.value) : null)} />
    </label>
  {/if}
  {#if wantsFunnelShape}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{m.chartShape}</span>
      <select value={ctrl.chartFunnelShape ?? "trapezoid"} onchange={(e) => (ctrl.chartFunnelShape = e.currentTarget.value as "trapezoid" | "pyramid" | "cone")}>
        <option value="trapezoid">{m.chartShapeFunnel}</option>
        <option value="pyramid">{m.chartShapePyramid}</option>
        <option value="cone">{m.chartShapeCone}</option>
      </select>
    </label>
  {/if}
  {#if wantsCandleStyle}
    <label class="sv-grid-chart-ctl">
      <span class="sv-grid-chart-ctl-lbl">{m.chartCandles}</span>
      <select value={ctrl.chartCandleStyle ?? "classic"} onchange={(e) => (ctrl.chartCandleStyle = e.currentTarget.value as "classic" | "hollow" | "heikin-ashi")}>
        <option value="classic">{m.chartCandlesClassic}</option>
        <option value="hollow">{m.chartCandlesHollow}</option>
        <option value="heikin-ashi">{m.chartCandlesHeikinAshi}</option>
      </select>
    </label>
  {/if}
  {#if wantsOhlc}
    <span class="sv-grid-chart-ctl sv-grid-chart-indicators" role="group" aria-label={m.chartIndicators}>
      <span class="sv-grid-chart-ctl-lbl">{m.chartIndicators}</span>
      <span class="sv-grid-chart-chips">
        {#each INDICATORS as ind (ind.value)}
          <button
            type="button"
            class="sv-grid-chart-chip"
            class:is-on={ctrl.chartIndicators.includes(ind.value)}
            aria-pressed={ctrl.chartIndicators.includes(ind.value)}
            title={m[ind.title]}
            onclick={() => toggleIndicator(ind.value)}
          >{m[ind.label]}</button>
        {/each}
      </span>
    </span>
  {/if}
  <label class="sv-grid-chart-ctl">
    <span class="sv-grid-chart-ctl-lbl">{m.chartFormat}</span>
    <select value={ctrl.chartValueFormat} onchange={(e) => (ctrl.chartValueFormat = e.currentTarget.value as "number" | "currency" | "percent")}>
      <option value="number">{m.chartFormatNumber}</option>
      <option value="currency">{m.chartFormatCurrency}</option>
      <option value="percent">{m.chartFormatPercent}</option>
    </select>
  </label>
  {#if wantsStacked}
    <label class="sv-grid-chart-toggle">
      <input type="checkbox" checked={ctrl.chartStacked} onchange={(e) => (ctrl.chartStacked = e.currentTarget.checked)} />
      {m.chartStacked}
    </label>
    <label class="sv-grid-chart-toggle" title={m.chartStacked100Title}>
      <input type="checkbox" checked={ctrl.chartStacked100} onchange={(e) => (ctrl.chartStacked100 = e.currentTarget.checked)} />
      {m.chartStacked100}
    </label>
  {/if}
  {#if wantsHorizontal}
    <label class="sv-grid-chart-toggle" title={m.chartHorizontalTitle}>
      <input
        type="checkbox"
        checked={ctrl.chartOrientation === "horizontal"}
        onchange={(e) => (ctrl.chartOrientation = e.currentTarget.checked ? "horizontal" : "vertical")}
      />
      {m.chartHorizontal}
    </label>
  {/if}
  {#if wantsDonut}
    <label class="sv-grid-chart-toggle">
      <input type="checkbox" checked={ctrl.chartDonut} onchange={(e) => (ctrl.chartDonut = e.currentTarget.checked)} />
      {m.chartDonut}
    </label>
  {/if}
  <label class="sv-grid-chart-ctl">
    <span class="sv-grid-chart-ctl-lbl">{m.chartColours}</span>
    <select
      value={activePalette}
      onchange={(e) => (ctrl.chartPalette = CHART_PANEL_PALETTES.find((x) => x.key === e.currentTarget.value)?.colors ?? null)}
    >
      {#each CHART_PANEL_PALETTES as pal (pal.key)}<option value={pal.key}>{m[pal.label]}</option>{/each}
    </select>
  </label>
  {#if wantsDataLabels}
    <label class="sv-grid-chart-toggle">
      <input type="checkbox" checked={ctrl.chartDataLabels} onchange={(e) => (ctrl.chartDataLabels = e.currentTarget.checked)} />
      {m.chartLabels}
    </label>
  {/if}
  {#if wantsLogScale}
    <label class="sv-grid-chart-toggle" title={m.chartLogScaleTitle}>
      <input type="checkbox" checked={ctrl.chartLogScale} onchange={(e) => (ctrl.chartLogScale = e.currentTarget.checked)} />
      {m.chartLogScale}
    </label>
  {/if}
  {#if ctrl.chartDimensionIsDate && wantsGroupBy}
    <label class="sv-grid-chart-ctl" title={m.chartBucketTitle}>
      <span class="sv-grid-chart-ctl-lbl">{m.chartBucket}</span>
      <select value={ctrl.chartBucket ?? ""} onchange={(e) => (ctrl.chartBucket = (e.currentTarget.value || null) as ChartTimeBucket | null)}>
        {#each BUCKETS as b (b.value)}<option value={b.value}>{m[b.label]}</option>{/each}
      </select>
    </label>
  {/if}
  {#if ctrl.chartDimensionIsDate && CARTESIAN.includes(ctrl.chartType)}
    <label class="sv-grid-chart-toggle" title={m.chartDateAxisTitle}>
      <input type="checkbox" checked={ctrl.chartTimeAxis} onchange={(e) => (ctrl.chartTimeAxis = e.currentTarget.checked)} />
      {m.chartDateAxis}
    </label>
  {/if}
  {#if pivot}
    <p class="sv-grid-chart-hint sv-grid-chart-pivot-hint" role="note">{m.chartPivotHint}</p>
  {:else if typeIssue}
    <p class="sv-grid-chart-hint" role="note">{typeIssue}</p>
  {/if}
</div>
