<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
  /**
   * The built-in integrated-chart panel. Opens as a right-side drawer (default)
   * or docks to the bottom edge, and stays live with the grid: it reads the
   * controller's derived
   * `chartSpec` - which itself derives from the displayed rows + the active cell
   * selection - so filtering, sorting, paging, or selecting a range re-draws the
   * chart with no manual sync. Clicking a chart category cross-filters the grid.
   *
   * In `buildSpec` (custom) mode the axis pickers are hidden - the author owns
   * the spec - and the panel is a thin live frame around it.
   *
   * Rendered by SvGrid.svelte and handed `{ctrl}`; not placed by consumers.
   */
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import SvGridChart from "./SvGridChart.svelte";
  import { downloadChartPng, downloadChartSvg, downloadChartCsv, chartToPngBlob } from "./chart-export";
  import type { ChartType, ChartSelection, RowData, TableFeatures } from "./index";
  import type { SvGridController } from "./SvGrid.controller.svelte";

  let { ctrl }: { ctrl: SvGridController<TFeatures, TData> } = $props();

  const config = $derived(ctrl.chartingConfig);
  const cfg = $derived(ctrl.chartCfg);
  const isCustom = $derived(ctrl.chartIsCustom);
  const position = $derived(config?.position ?? "bottom");
  const crossFilter = $derived(config?.crossFilter !== false);
  const spec = $derived(ctrl.chartSpec);
  const columns = $derived(ctrl.chartableColumns);
  const size = $derived(
    ctrl.chartSize ?? (position === "right" ? (config?.width ?? 340) : (config?.height ?? 260)),
  );

  // ---- Pop-out (floating window) state -----------------------------------
  const floating = $derived(ctrl.chartFloating);
  const maximized = $derived(ctrl.chartMaximized);
  const rect = $derived(ctrl.chartFloatRect);
  let sectionEl = $state<HTMLElement | null>(null);

  function parentBox(): { w: number; h: number } {
    const p = sectionEl?.offsetParent as HTMLElement | null;
    return { w: p?.clientWidth ?? 800, h: p?.clientHeight ?? 520 };
  }
  function popOut() {
    if (!ctrl.chartFloatRect) {
      const { w: pw, h: ph } = parentBox();
      const w = Math.min(600, Math.max(360, pw - 80));
      const h = Math.min(430, Math.max(260, ph - 90));
      ctrl.chartFloatRect = { x: Math.round((pw - w) / 2), y: Math.round((ph - h) / 2), w, h };
    }
    ctrl.chartFloating = true;
  }
  function dockBack() {
    ctrl.chartFloating = false;
    ctrl.chartMaximized = false;
  }
  const toggleMax = () => (ctrl.chartMaximized = !ctrl.chartMaximized);

  function startDrag(e: PointerEvent) {
    if (!floating || maximized) return;
    if ((e.target as HTMLElement)?.closest("button")) return; // don't drag from the buttons
    const r = ctrl.chartFloatRect;
    if (!r) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const { w: pw, h: ph } = parentBox();
    const move = (ev: PointerEvent) => {
      const nx = Math.max(0, Math.min(pw - r.w, r.x + ev.clientX - sx));
      const ny = Math.max(0, Math.min(ph - r.h, r.y + ev.clientY - sy));
      ctrl.chartFloatRect = { x: nx, y: ny, w: r.w, h: r.h };
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startFloatResize(e: PointerEvent) {
    const r = ctrl.chartFloatRect;
    if (!r) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      ctrl.chartFloatRect = {
        x: r.x,
        y: r.y,
        w: Math.max(300, r.w + ev.clientX - sx),
        h: Math.max(220, r.h + ev.clientY - sy),
      };
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const floatStyle = $derived(
    floating
      ? maximized
        ? "left:12px; top:12px; right:12px; bottom:12px; width:auto; height:auto;"
        : rect
          ? `left:${rect.x}px; top:${rect.y}px; width:${rect.w}px; height:${rect.h}px;`
          : ""
      : position === "right"
        ? `width:${size}px`
        : `height:${size}px`,
  );

  // Measure the chart area so the chart lays out to fit it (no overflow /
  // clipped axis labels) - the docked panel is a fixed-size container. Reserve
  // room for the legend (rendered below the SVG for >1 series) and the export
  // toolbar, so neither gets clipped.
  let bodyW = $state(0);
  let bodyH = $state(0);
  const seriesCount = $derived(spec ? (spec.type === "pie" ? spec.categories.length : spec.series.length) : 0);
  const reserve = $derived((seriesCount > 1 ? 36 : 0) + (cfg?.export === true ? 30 : 0));
  const chartW = $derived(bodyW > 24 ? bodyW - 8 : undefined);
  const chartH = $derived(bodyH > 24 ? Math.max(120, bodyH - 8 - reserve) : undefined);

  // Aggregation-friendly types offered in the picker; exotic types come via
  // `buildSpec`, where the picker is hidden.
  const TYPES: Array<{ value: ChartType; label: string }> = [
    { value: "bar", label: "Bar" },
    { value: "line", label: "Line" },
    { value: "area", label: "Area" },
    { value: "pie", label: "Pie" },
  ];
  const REDUCERS = [
    { value: "sum", label: "Sum" },
    { value: "avg", label: "Average" },
    { value: "count", label: "Count" },
  ] as const;
  const FORMATS = [
    { value: "number", label: "Number" },
    { value: "currency", label: "Currency" },
    { value: "percent", label: "Percent" },
  ] as const;

  function onChartSelect(sel: ChartSelection) {
    if (crossFilter && sel.category != null) ctrl.applyChartCrossFilter(String(sel.category));
  }

  // ---- Export (PNG / SVG / CSV / copy) -----------------------------------
  let bodyEl = $state<HTMLElement | null>(null);
  let exportOpen = $state(false);
  let copied = $state(false);
  const svgEl = () => bodyEl?.querySelector("svg") ?? null;
  const csvExportable = $derived(!!(spec && spec.categories?.length && spec.series?.length));
  function exportPng() {
    const el = svgEl();
    if (el) void downloadChartPng(el, "chart.png");
    exportOpen = false;
  }
  function exportSvg() {
    const el = svgEl();
    if (el) downloadChartSvg(el, "chart.svg");
    exportOpen = false;
  }
  function exportCsv() {
    if (spec) downloadChartCsv(spec, "chart.csv");
    exportOpen = false;
  }
  async function copyImage() {
    const el = svgEl();
    exportOpen = false;
    if (!el || typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return;
    try {
      const blob = await chartToPngBlob(el);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {
      /* clipboard blocked - no-op */
    }
  }
  $effect(() => {
    if (!exportOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest(".sv-grid-chart-export")) exportOpen = false;
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  });

  // ---- AI "chart this" (enterprise-registered handler) -------------------
  const aiEnabled = $derived(!!ctrl.chartAiHandler);
  let aiOpen = $state(false);
  let aiPrompt = $state("");
  let aiBusy = $state(false);
  let aiError = $state("");
  let aiRationale = $state("");
  async function runAi() {
    const handler = ctrl.chartAiHandler;
    const prompt = aiPrompt.trim();
    if (!handler || !prompt || aiBusy) return;
    aiBusy = true;
    aiError = "";
    aiRationale = "";
    try {
      const cfg = await handler(prompt);
      if (cfg) {
        ctrl.applyChartConfig(cfg as Parameters<typeof ctrl.applyChartConfig>[0]);
        aiRationale = typeof cfg.rationale === "string" ? cfg.rationale : "";
      } else {
        aiError = "Couldn't build a chart from that request.";
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : "Something went wrong.";
    } finally {
      aiBusy = false;
    }
  }

  // ---- Resize by dragging the panel's inner edge -------------------------
  let dragging = $state(false);
  function startResize(e: PointerEvent) {
    e.preventDefault();
    dragging = true;
    const startPos = position === "right" ? e.clientX : e.clientY;
    const startSize = size;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const delta = position === "right" ? startPos - ev.clientX : startPos - ev.clientY;
      ctrl.chartSize = Math.max(160, Math.min(720, startSize + delta));
    };
    const up = () => {
      dragging = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

<section
  bind:this={sectionEl}
  class="sv-grid-chart-panel"
  class:is-right={position === "right" && !floating}
  class:is-bottom={position === "bottom" && !floating}
  class:is-floating={floating}
  class:is-maximized={floating && maximized}
  style={floatStyle}
  aria-label="Chart"
  transition:fly={{
    x: !floating && position === "right" ? size : 0,
    y: !floating && position === "bottom" ? size : 0,
    duration: 180,
    easing: cubicOut,
  }}
>
  {#if !floating}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sv-grid-chart-resizer"
      class:is-dragging={dragging}
      onpointerdown={startResize}
      role="separator"
      aria-orientation={position === "right" ? "vertical" : "horizontal"}
      aria-label="Resize chart panel"
    ></div>
  {/if}

  <header class="sv-grid-chart-panel-head">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sv-grid-chart-drawer-title"
      class:is-drag-handle={floating && !maximized}
      onpointerdown={startDrag}
    >
      <svg class="sv-grid-chart-title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
      </svg>
      <span class="sv-grid-chart-title">Chart</span>
      <div class="sv-grid-chart-actions">
        {#if crossFilter && !isCustom}
          <button type="button" class="sv-grid-chart-btn" onclick={() => ctrl.clearChartCrossFilter()}>Clear filter</button>
        {/if}
        <div class="sv-grid-chart-export">
          <button type="button" class="sv-grid-chart-icon-btn" aria-label="Export chart" title="Export" aria-expanded={exportOpen} onclick={() => (exportOpen = !exportOpen)}>
            {#if copied}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {/if}
          </button>
          {#if exportOpen}
            <div class="sv-grid-chart-export-menu" role="menu">
              <button type="button" role="menuitem" onclick={exportPng}>PNG image</button>
              <button type="button" role="menuitem" onclick={exportSvg}>SVG vector</button>
              <button type="button" role="menuitem" disabled={!csvExportable} onclick={exportCsv}>CSV data</button>
              <button type="button" role="menuitem" onclick={copyImage}>Copy to clipboard</button>
            </div>
          {/if}
        </div>
        {#if aiEnabled && !isCustom}
          <button type="button" class="sv-grid-chart-btn sv-grid-chart-ai-btn" class:is-active={aiOpen} aria-label="Chart with AI" title="Chart with AI" aria-expanded={aiOpen} onclick={() => (aiOpen = !aiOpen)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 4.6L18.5 8.5 13.9 10.4 12 15l-1.9-4.6L5.5 8.5l4.6-1.9L12 2zm6 11l1 2.4 2.4 1-2.4 1L18 21l-1-2.6-2.4-1 2.4-1L18 13zM6 14l.8 2 2 .8-2 .8L6 20l-.8-2.4-2-.8 2-.8L6 14z" /></svg>
            AI
          </button>
        {/if}
        {#if !isCustom}
          <button type="button" class="sv-grid-chart-icon-btn" aria-label="Add chart" title="Add chart" onclick={() => ctrl.addChart()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        {/if}
        {#if floating}
          <button type="button" class="sv-grid-chart-icon-btn" aria-label={maximized ? "Restore" : "Maximize"} title={maximized ? "Restore" : "Maximize"} onclick={toggleMax}>
            {#if maximized}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
            {/if}
          </button>
          <button type="button" class="sv-grid-chart-icon-btn" aria-label="Dock chart" title="Dock" onclick={dockBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
          </button>
        {:else}
          <button type="button" class="sv-grid-chart-icon-btn" aria-label="Pop out chart" title="Pop out" onclick={popOut}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          </button>
        {/if}
        <button type="button" class="sv-grid-chart-close" aria-label="Close chart" onclick={() => (ctrl.chartPanelOpen = false)}>&times;</button>
      </div>
    </div>
    {#if !isCustom && ctrl.charts.length > 1}
      <div class="sv-grid-chart-tabs" role="tablist" aria-label="Charts">
        {#each ctrl.charts as c, i (c.id)}
          <div class="sv-grid-chart-tab" class:is-active={i === ctrl.activeChartIndex}>
            <button
              type="button"
              class="sv-grid-chart-tab-label"
              role="tab"
              aria-selected={i === ctrl.activeChartIndex}
              onclick={() => (ctrl.activeChartIndex = i)}
            >{c.title}</button>
            <button
              type="button"
              class="sv-grid-chart-tab-x"
              aria-label={`Remove ${c.title}`}
              title="Remove"
              onclick={() => ctrl.removeChart(i)}
            >&times;</button>
          </div>
        {/each}
      </div>
    {/if}
    {#if aiEnabled && aiOpen && !isCustom}
      <div class="sv-grid-chart-ai">
        <form
          class="sv-grid-chart-ai-row"
          onsubmit={(e) => {
            e.preventDefault();
            runAi();
          }}
        >
          <input
            class="sv-grid-chart-ai-input"
            type="text"
            placeholder="Describe a chart, e.g. revenue by region stacked by product"
            bind:value={aiPrompt}
            disabled={aiBusy}
          />
          <button type="submit" class="sv-grid-chart-btn" disabled={aiBusy || !aiPrompt.trim()}>
            {aiBusy ? "Thinking..." : "Chart it"}
          </button>
        </form>
        {#if aiError}
          <p class="sv-grid-chart-ai-msg is-error">{aiError}</p>
        {:else if aiRationale}
          <p class="sv-grid-chart-ai-msg">{aiRationale}</p>
        {/if}
      </div>
    {/if}
    <div class="sv-grid-chart-controls">
      {#if !isCustom}
        <label class="sv-grid-chart-ctl">
          <span class="sv-grid-chart-ctl-lbl">Type</span>
          <select value={ctrl.chartType} onchange={(e) => (ctrl.chartType = e.currentTarget.value as ChartType)}>
            {#each TYPES as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
          </select>
        </label>
        <label class="sv-grid-chart-ctl">
          <span class="sv-grid-chart-ctl-lbl">Group by</span>
          <select value={ctrl.chartDimensionId ?? ""} onchange={(e) => (ctrl.chartDimensionId = e.currentTarget.value || null)}>
            {#each columns.dims as d (d.id)}<option value={d.id}>{d.label}</option>{/each}
          </select>
        </label>
        {#if columns.dims.length > 1}
          <label class="sv-grid-chart-ctl">
            <span class="sv-grid-chart-ctl-lbl">Split by</span>
            <select value={ctrl.chartSeriesId ?? ""} onchange={(e) => (ctrl.chartSeriesId = e.currentTarget.value || null)}>
              <option value="">(none)</option>
              {#each columns.dims as d (d.id)}<option value={d.id}>{d.label}</option>{/each}
            </select>
          </label>
        {/if}
        <label class="sv-grid-chart-ctl">
          <span class="sv-grid-chart-ctl-lbl">Value</span>
          <select value={ctrl.chartMeasureId ?? ""} onchange={(e) => (ctrl.chartMeasureId = e.currentTarget.value || null)}>
            {#each columns.measures as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
          </select>
        </label>
        <label class="sv-grid-chart-ctl">
          <span class="sv-grid-chart-ctl-lbl">Aggregate</span>
          <select value={ctrl.chartReduce} onchange={(e) => (ctrl.chartReduce = e.currentTarget.value as "sum" | "avg" | "count")}>
            {#each REDUCERS as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
          </select>
        </label>
        <label class="sv-grid-chart-ctl">
          <span class="sv-grid-chart-ctl-lbl">Format</span>
          <select value={ctrl.chartValueFormat} onchange={(e) => (ctrl.chartValueFormat = e.currentTarget.value as "number" | "currency" | "percent")}>
            {#each FORMATS as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
          </select>
        </label>
        {#if ctrl.chartType !== "pie"}
          <label class="sv-grid-chart-toggle">
            <input type="checkbox" checked={ctrl.chartStacked} onchange={(e) => (ctrl.chartStacked = e.currentTarget.checked)} />
            Stacked
          </label>
        {/if}
        <label class="sv-grid-chart-toggle">
          <input type="checkbox" checked={ctrl.chartDataLabels} onchange={(e) => (ctrl.chartDataLabels = e.currentTarget.checked)} />
          Labels
        </label>
        {#if ctrl.chartType !== "pie"}
          <label class="sv-grid-chart-toggle" title="Logarithmic value axis - flattens wide-range data">
            <input type="checkbox" checked={ctrl.chartLogScale} onchange={(e) => (ctrl.chartLogScale = e.currentTarget.checked)} />
            Log scale
          </label>
        {/if}
        {#if ctrl.chartDimensionIsDate && ctrl.chartType !== "pie"}
          <label class="sv-grid-chart-toggle" title="Space points by actual date - real time ticks and proportional gaps">
            <input type="checkbox" checked={ctrl.chartTimeAxis} onchange={(e) => (ctrl.chartTimeAxis = e.currentTarget.checked)} />
            Date axis
          </label>
        {/if}
      {/if}
    </div>
  </header>

  <div class="sv-grid-chart-panel-body" bind:this={bodyEl} bind:clientWidth={bodyW} bind:clientHeight={bodyH}>
    {#if spec && (spec.series.length || isCustom)}
      <SvGridChart
        {spec}
        width={chartW}
        height={chartH}
        onSelect={onChartSelect}
        interactive
        legend
        dataLabels={ctrl.chartDataLabels}
        zoomable={cfg?.zoom === true}
        brush={cfg?.brush === true}
        toolbar={cfg?.export === true ? true : undefined}
      />
    {:else}
      <p class="sv-grid-chart-empty">
        {#if !columns.dims.length || !columns.measures.length}
          Charting needs at least one text column (to group by) and one numeric column (to measure).
        {:else}
          No data to chart.
        {/if}
      </p>
    {/if}
  </div>

  {#if floating && !maximized}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sv-grid-chart-float-resizer"
      onpointerdown={startFloatResize}
      role="separator"
      aria-label="Resize chart window"
    ></div>
  {/if}
</section>
