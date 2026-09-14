<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
  /**
   * The chart builder behind the grid panel's Build button: a modal with a
   * type gallery of live thumbnails, the same pickers the panel shows (one
   * component, SvGridChartPickers, laid out as a form), and a Format tab for
   * the things the derived spec does not carry (titles, axis bounds, legend
   * placement, per-series colour / type / axis / stack, label placement,
   * series and crosshair labels, a compact rule for narrow widths, palette,
   * font and colours).
   *
   * Format edits are plain data ({@link ChartFormatState}) on the chart tab,
   * applied by the engine to every spec the panel derives, so they survive a
   * data change and round-trip through the saved view. Loaded lazily by the
   * panel on the first open. Every label comes from the panel's messages, so
   * `localization.text` translates the builder too.
   */
  import SvModal from "./SvModal.svelte";
  import SvTabs from "./SvTabs.svelte";
  import SvGridChart from "./SvGridChart.svelte";
  import SvGridChartPickers, { type ChartPanelTypeDef } from "./SvGridChartPickers.svelte";
  import { sampleChartThumb } from "./chart-samples";
  import { chartPanelMessage, type GridChartPanelMessages } from "./chart-panel-messages";
  import type { ChartFormatState, ChartMarkerShape, ChartValueFormat, RowData, TableFeatures } from "./index";
  import type { SvGridController } from "./SvGrid.controller.svelte";

  let {
    ctrl,
    open = $bindable(false),
    types,
    messages: m,
  }: {
    ctrl: SvGridController<TFeatures, TData>;
    open?: boolean;
    /** The types the panel offers for the current columns, in its groups. */
    types: ChartPanelTypeDef[];
    messages: GridChartPanelMessages;
  } = $props();

  let tab = $state("type");
  const groups = $derived([...new Set(types.map((t) => t.group))]);
  const spec = $derived(ctrl.chartSpec);
  const palette = $derived(ctrl.chartPalette ?? undefined);
  const seriesLabels = $derived(spec?.series.map((s) => s.label) ?? []);

  const fmt = $derived<ChartFormatState>(ctrl.chartFormat ?? {});
  function patch(p: Partial<ChartFormatState>) {
    ctrl.chartFormat = { ...fmt, ...p };
  }
  function patchAxis(key: "xAxis" | "yAxis" | "y2Axis", p: Record<string, unknown>) {
    patch({ [key]: { ...(fmt[key] ?? {}), ...p } } as Partial<ChartFormatState>);
  }
  function patchSeries(label: string, p: NonNullable<ChartFormatState["series"]>[string]) {
    patch({ series: { ...(fmt.series ?? {}), [label]: { ...(fmt.series?.[label] ?? {}), ...p } } });
  }
  function patchStyle(p: NonNullable<ChartFormatState["style"]>) {
    patch({ style: { ...(fmt.style ?? {}), ...p } });
  }
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  const hasRightAxis = $derived(!!spec?.series.some((s) => s.axis === "right") || !!fmt.series && Object.values(fmt.series).some((s) => s?.axis === "right"));
  /** Stacks only mean something on bars and areas; the column shows for a chart that has any. */
  const hasStackable = $derived(!!spec && ["bar", "area"].includes(spec.type));
  const MARKERS: ChartMarkerShape[] = ["circle", "square", "diamond", "triangle", "cross", "none"];
  const FORMATS: ChartValueFormat[] = ["number", "currency", "percent", "compact"];
</script>

<SvModal bind:open title={m.chartBuilderTitle} size="lg">
  <div class="sv-grid-chart-builder">
    <SvTabs
      tabs={[{ id: "type", label: m.chartBuilderTabType }, { id: "data", label: m.chartBuilderTabData }, { id: "format", label: m.chartBuilderTabFormat }]}
      bind:value={tab}
      ariaLabel={m.chartBuilderTitle}
    >
      {#snippet panel(id)}
        {#if id === "type"}
          <div class="sv-grid-chart-builder-gallery">
            {#each groups as g (g)}
              <div class="sv-grid-chart-builder-group">{g}</div>
              <div class="sv-grid-chart-builder-cards">
                {#each types.filter((t) => t.group === g) as t (t.value)}
                  <button
                    type="button"
                    class="sv-grid-chart-builder-card"
                    class:is-selected={ctrl.chartType === t.value}
                    aria-pressed={ctrl.chartType === t.value}
                    title={t.label}
                    onclick={() => (ctrl.chartType = t.value)}
                  >
                    <div class="sv-grid-chart-builder-thumb">
                      <SvGridChart spec={sampleChartThumb(t.value, palette)} interactive={false} legend={false} toolbar={false} announce={false} />
                    </div>
                    <span class="sv-grid-chart-builder-card-label">{t.label}</span>
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {:else if id === "data"}
          <div class="sv-grid-chart-builder-form">
            <SvGridChartPickers {ctrl} messages={m} scope="builder" />
            <label class="sv-grid-chart-builder-row">
              <span>{m.chartBuilderLinked}</span>
              <input type="checkbox" checked={!ctrl.chartFrozen} onchange={(e) => (e.currentTarget.checked ? ctrl.unfreezeChart() : ctrl.freezeChart())} />
              <small>{ctrl.chartFrozen ? chartPanelMessage(m.chartBuilderFrozenAt, { time: new Date(ctrl.chartFrozen.at).toLocaleTimeString() }) : m.chartBuilderFollows}</small>
            </label>
          </div>
        {:else}
          <div class="sv-grid-chart-builder-form">
            <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderTitleField}</span><input type="text" value={fmt.title ?? ""} oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
            <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderSubtitle}</span><input type="text" value={fmt.subtitle ?? ""} oninput={(e) => patch({ subtitle: e.currentTarget.value })} /></label>
            <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderCaption}</span><input type="text" value={fmt.caption ?? ""} oninput={(e) => patch({ caption: e.currentTarget.value })} /></label>
            <label class="sv-grid-chart-builder-row">
              <span>{m.chartBuilderLegend}</span>
              <select value={fmt.legend === false ? "none" : (fmt.legend ?? "bottom")} onchange={(e) => patch({ legend: e.currentTarget.value === "none" ? false : (e.currentTarget.value as "top" | "bottom" | "left" | "right") })}>
                <option value="bottom">{m.chartLegendBottom}</option><option value="top">{m.chartLegendTop}</option><option value="left">{m.chartLegendLeft}</option><option value="right">{m.chartLegendRight}</option><option value="none">{m.chartLegendHidden}</option>
              </select>
            </label>
            <label class="sv-grid-chart-builder-row">
              <span>{m.chartBuilderDataLabels}</span>
              <select value={fmt.dataLabels === null ? "none" : (fmt.dataLabels ?? "auto")} onchange={(e) => patch({ dataLabels: e.currentTarget.value === "auto" ? undefined : e.currentTarget.value === "none" ? null : (e.currentTarget.value as "inside" | "outside" | "top" | "center") })}>
                <option value="auto">{m.chartBuilderPanelSetting}</option><option value="top">{m.chartLabelsTop}</option><option value="outside">{m.chartLabelsOutside}</option><option value="inside">{m.chartLabelsInside}</option><option value="center">{m.chartLabelsCenter}</option><option value="none">{m.chartLabelsHidden}</option>
              </select>
            </label>
            <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderSeriesLabels}</span><input type="checkbox" checked={fmt.seriesLabels === true} onchange={(e) => patch({ seriesLabels: e.currentTarget.checked })} /></label>
            <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderCrosshairLabels}</span><input type="checkbox" checked={fmt.crosshairLabels !== false} onchange={(e) => patch({ crosshairLabels: e.currentTarget.checked })} /></label>
            <label class="sv-grid-chart-builder-row" title={m.chartBuilderCompactBelowTitle}>
              <span>{m.chartBuilderCompactBelow}</span>
              <input type="number" min="0" step="10" value={fmt.compactBelow ?? ""} placeholder={m.chartBuilderOff} onchange={(e) => patch({ compactBelow: num(e.currentTarget.value) })} />
            </label>
            <fieldset class="sv-grid-chart-builder-fs">
              <legend>{m.chartBuilderValueAxis}</legend>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderTitleField}</span><input type="text" value={fmt.yAxis?.title ?? ""} oninput={(e) => patchAxis("yAxis", { title: e.currentTarget.value })} /></label>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderMin}</span><input type="number" value={fmt.yAxis?.min ?? ""} placeholder={m.chartBuilderAuto} onchange={(e) => patchAxis("yAxis", { min: num(e.currentTarget.value) })} /></label>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderMax}</span><input type="number" value={fmt.yAxis?.max ?? ""} placeholder={m.chartBuilderAuto} onchange={(e) => patchAxis("yAxis", { max: num(e.currentTarget.value) })} /></label>
              <label class="sv-grid-chart-builder-row">
                <span>{m.chartFormat}</span>
                <select value={fmt.yAxis?.format ?? ""} onchange={(e) => patchAxis("yAxis", { format: (e.currentTarget.value || undefined) as ChartValueFormat | undefined })}>
                  <option value="">{m.chartBuilderPanelSetting}</option>{#each FORMATS as f (f)}<option value={f}>{f}</option>{/each}
                </select>
              </label>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderGridLines}</span><input type="checkbox" checked={fmt.yAxis?.gridLines !== false} onchange={(e) => patchAxis("yAxis", { gridLines: e.currentTarget.checked })} /></label>
            </fieldset>
            {#if hasRightAxis}
              <fieldset class="sv-grid-chart-builder-fs">
                <legend>{m.chartBuilderRightAxis}</legend>
                <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderTitleField}</span><input type="text" value={fmt.y2Axis?.title ?? ""} oninput={(e) => patchAxis("y2Axis", { title: e.currentTarget.value })} /></label>
                <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderMin}</span><input type="number" value={fmt.y2Axis?.min ?? ""} placeholder={m.chartBuilderAuto} onchange={(e) => patchAxis("y2Axis", { min: num(e.currentTarget.value) })} /></label>
                <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderMax}</span><input type="number" value={fmt.y2Axis?.max ?? ""} placeholder={m.chartBuilderAuto} onchange={(e) => patchAxis("y2Axis", { max: num(e.currentTarget.value) })} /></label>
              </fieldset>
            {/if}
            <fieldset class="sv-grid-chart-builder-fs">
              <legend>{m.chartBuilderCategoryAxis}</legend>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderTitleField}</span><input type="text" value={fmt.xAxis?.title ?? ""} oninput={(e) => patchAxis("xAxis", { title: e.currentTarget.value })} /></label>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderGridLines}</span><input type="checkbox" checked={fmt.xAxis?.gridLines === true} onchange={(e) => patchAxis("xAxis", { gridLines: e.currentTarget.checked })} /></label>
              <label class="sv-grid-chart-builder-row">
                <span>{m.chartBuilderAxisLabels}</span>
                <select value={fmt.xAxis?.labelRotation === undefined ? "auto" : String(fmt.xAxis.labelRotation)} onchange={(e) => patchAxis("xAxis", { labelRotation: e.currentTarget.value === "auto" ? "auto" : Number(e.currentTarget.value) })}>
                  <option value="auto">{m.chartBuilderLabelsAuto}</option><option value="0">{m.chartBuilderLabelsHorizontal}</option><option value="-45">{m.chartBuilderLabelsTilted}</option><option value="-90">{m.chartBuilderLabelsVertical}</option>
                </select>
              </label>
            </fieldset>
            {#if seriesLabels.length}
              <fieldset class="sv-grid-chart-builder-fs">
                <legend>{m.chartBuilderSeries}</legend>
                <div class="sv-grid-chart-builder-series-head" class:has-stack={hasStackable}><span>{m.chartBuilderSeries}</span><span>{m.chartBuilderColor}</span><span>{m.chartBuilderSeriesType}</span><span>{m.chartBuilderAxis}</span><span>{m.chartBuilderMarker}</span><span>{m.chartBuilderWidth}</span>{#if hasStackable}<span>{m.chartBuilderStack}</span>{/if}</div>
                {#each seriesLabels as label (label)}
                  {@const f = fmt.series?.[label] ?? {}}
                  {@const s = spec?.series.find((x) => x.label === label)}
                  <div class="sv-grid-chart-builder-series" class:has-stack={hasStackable} data-series={label}>
                    <span class="sv-grid-chart-builder-series-name" title={label}>{label}</span>
                    <input type="color" value={f.color ?? s?.color ?? "#2563eb"} aria-label={chartPanelMessage(m.chartBuilderSeriesColorLabel, { series: label })} oninput={(e) => patchSeries(label, { color: e.currentTarget.value })} />
                    <select value={f.type ?? s?.type ?? ""} aria-label={chartPanelMessage(m.chartBuilderSeriesTypeLabel, { series: label })} onchange={(e) => patchSeries(label, { type: (e.currentTarget.value || undefined) as "bar" | "line" | "area" | undefined })}>
                      <option value="">{m.chartBuilderChartType}</option><option value="bar">{m.chartBuilderBar}</option><option value="line">{m.chartBuilderLine}</option><option value="area">{m.chartBuilderArea}</option>
                    </select>
                    <select value={f.axis ?? s?.axis ?? "left"} aria-label={chartPanelMessage(m.chartBuilderSeriesAxisLabel, { series: label })} onchange={(e) => patchSeries(label, { axis: e.currentTarget.value as "left" | "right" })}>
                      <option value="left">{m.chartBuilderLeft}</option><option value="right">{m.chartBuilderRight}</option>
                    </select>
                    <select value={f.marker ?? "circle"} aria-label={chartPanelMessage(m.chartBuilderSeriesMarkerLabel, { series: label })} onchange={(e) => patchSeries(label, { marker: e.currentTarget.value as ChartMarkerShape })}>
                      {#each MARKERS as mk (mk)}<option value={mk}>{mk}</option>{/each}
                    </select>
                    <input type="number" min="0.5" max="8" step="0.5" value={f.strokeWidth ?? 2} aria-label={chartPanelMessage(m.chartBuilderSeriesWidthLabel, { series: label })} onchange={(e) => patchSeries(label, { strokeWidth: Number(e.currentTarget.value) || 2 })} />
                    {#if hasStackable}
                      <input type="text" value={f.stack ?? s?.stack ?? ""} placeholder={m.chartBuilderStackPlaceholder} aria-label={chartPanelMessage(m.chartBuilderSeriesStackLabel, { series: label })} onchange={(e) => patchSeries(label, { stack: e.currentTarget.value.trim() })} />
                    {/if}
                  </div>
                {/each}
              </fieldset>
            {/if}
            <fieldset class="sv-grid-chart-builder-fs">
              <legend>{m.chartBuilderStyle}</legend>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderFontSize}</span><input type="number" min="8" max="32" value={fmt.style?.fontSize ?? ""} placeholder="12" onchange={(e) => patchStyle({ fontSize: num(e.currentTarget.value) ?? undefined })} /></label>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderFontFamily}</span><input type="text" value={fmt.style?.fontFamily ?? ""} oninput={(e) => patchStyle({ fontFamily: e.currentTarget.value || undefined })} /></label>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderBackground}</span><input type="text" value={fmt.style?.background ?? ""} placeholder="transparent" oninput={(e) => patchStyle({ background: e.currentTarget.value || undefined })} /></label>
              <label class="sv-grid-chart-builder-row"><span>{m.chartBuilderTextColor}</span><input type="text" value={fmt.style?.textColor ?? ""} placeholder="inherit" oninput={(e) => patchStyle({ textColor: e.currentTarget.value || undefined })} /></label>
            </fieldset>
            <div class="sv-grid-chart-builder-actions">
              <button type="button" class="sv-grid-chart-btn" onclick={() => (ctrl.chartFormat = null)}>{m.chartBuilderResetFormat}</button>
            </div>
          </div>
        {/if}
      {/snippet}
    </SvTabs>
  </div>
</SvModal>

<style>
  .sv-grid-chart-builder {
    min-height: 420px;
    max-height: 70vh;
    overflow: auto;
    font-size: 12px;
  }
  .sv-grid-chart-builder-group {
    font-size: 11px;
    font-weight: 600;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 10px 0 6px;
  }
  .sv-grid-chart-builder-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .sv-grid-chart-builder-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .sv-grid-chart-builder-card:hover { border-color: var(--sg-accent, #2563eb); }
  .sv-grid-chart-builder-card.is-selected {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #2563eb) 30%, transparent 70%);
  }
  .sv-grid-chart-builder-thumb {
    height: 92px;
    overflow: hidden;
    pointer-events: none;
  }
  .sv-grid-chart-builder-card-label {
    font-size: 11px;
    font-weight: 600;
  }
  .sv-grid-chart-builder-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 2px;
  }
  .sv-grid-chart-builder-row {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 8px;
  }
  .sv-grid-chart-builder-row > span {
    color: var(--sg-muted, #64748b);
  }
  .sv-grid-chart-builder-row > small {
    grid-column: 2;
    color: var(--sg-muted, #64748b);
  }
  .sv-grid-chart-builder-row > input[type="checkbox"] {
    justify-self: start;
  }
  .sv-grid-chart-builder-row input[type="text"],
  .sv-grid-chart-builder-row input[type="number"],
  .sv-grid-chart-builder-row select,
  .sv-grid-chart-builder-series input,
  .sv-grid-chart-builder-series select {
    font: inherit;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    padding: 3px 6px;
    min-width: 0;
  }
  .sv-grid-chart-builder-fs {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    padding: 6px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sv-grid-chart-builder-fs > legend {
    font-weight: 600;
    padding: 0 4px;
  }
  .sv-grid-chart-builder-series,
  .sv-grid-chart-builder-series-head {
    display: grid;
    grid-template-columns: minmax(80px, 1.4fr) 44px 1fr 1fr 1fr 64px;
    gap: 6px;
    align-items: center;
  }
  .sv-grid-chart-builder-series.has-stack,
  .sv-grid-chart-builder-series-head.has-stack {
    grid-template-columns: minmax(80px, 1.4fr) 44px 1fr 1fr 1fr 64px 72px;
  }
  .sv-grid-chart-builder-series-head {
    color: var(--sg-muted, #64748b);
    font-size: 11px;
  }
  .sv-grid-chart-builder-series-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-grid-chart-builder-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
