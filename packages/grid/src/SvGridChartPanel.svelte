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
  import { downloadChartPng, downloadChartSvg, downloadChartCsv, chartCsvExportable, chartToPngBlob } from "./chart-export";
  import type { ChartSelection, RowData, TableFeatures } from "./index";
  import SvChartPanes from "./SvChartPanes.svelte";
  import SvGridChartPickers, { chartPanelTypes } from "./SvGridChartPickers.svelte";
  import { chartPanelMessage, resolveChartPanelMessages } from "./chart-panel-messages";
  // The builder is a lazy chunk: a modal with a thumbnail per type, loaded
  // the first time someone opens it.
  let Builder = $state<typeof import("./SvGridChartBuilder.svelte").default | null>(null);
  let builderOpen = $state(false);
  function openBuilder() {
    if (Builder) { builderOpen = true; return; }
    import("./SvGridChartBuilder.svelte").then((m) => { Builder = m.default; builderOpen = true; });
  }
  import type { SvGridController } from "./SvGrid.controller.svelte";

  let { ctrl }: { ctrl: SvGridController<TFeatures, TData> } = $props();

  /** The panel's strings, from `localization.text`; unset keys stay English. */
  const m = $derived(resolveChartPanelMessages(ctrl.localizationText));
  const config = $derived(ctrl.chartingConfig);
  const cfg = $derived(ctrl.chartCfg);
  /** Legend placement from the builder's format; the default is below. */
  const legendProp = $derived(ctrl.chartFormat?.legend === undefined ? true : ctrl.chartFormat.legend);
  const dataLabelsProp = $derived(
    ctrl.chartFormat?.dataLabels === undefined ? ctrl.chartDataLabels : ctrl.chartFormat.dataLabels === null ? false : { placement: ctrl.chartFormat.dataLabels },
  );
  /** The crosshair's axis pills, from the builder's format; on by default. */
  const crosshairLabelsProp = $derived(ctrl.chartFormat?.crosshairLabels !== false);
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

  // The docked panel is a fixed-size container, and the chart sizes itself
  // to it:  measures the body and subtracts the chart's own toolbar,
  // legend and brush. This used to be a reserve heuristic here (36px for a
  // legend, 30px for the toolbar) that was wrong whenever the legend wrapped.

  /** The types the builder's gallery shows for the current columns. */
  const availableTypes = $derived(chartPanelTypes(columns, m));

  function onChartSelect(sel: ChartSelection) {
    if (crossFilter && sel.category != null) ctrl.applyChartCrossFilter(String(sel.category));
  }

  // ---- Export (PNG / SVG / CSV / copy) -----------------------------------
  let bodyEl = $state<HTMLElement | null>(null);
  let exportOpen = $state(false);
  let copied = $state(false);
  const svgEl = () => bodyEl?.querySelector("svg") ?? null;
  // One source of truth with the serializer: a scatter chart has no categories
  // but does have points, so the old shape test greyed out an export that works.
  const csvExportable = $derived(!!spec && chartCsvExportable(spec));
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
  async function exportPdf() {
    const el = svgEl();
    exportOpen = false;
    if (!el) return;
    const m = await import("./chart-export-pdf");
    await m.downloadChartPdf(el, "chart.pdf", { title: spec?.title ?? ctrl.charts[ctrl.activeChartIndex]?.title });
  }
  async function printChart() {
    const el = svgEl();
    exportOpen = false;
    if (!el) return;
    const m = await import("./chart-export-pdf");
    m.printChart(el, { title: spec?.title ?? ctrl.charts[ctrl.activeChartIndex]?.title });
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
  // A popover closes on a click outside and on Escape, and Escape hands
  // focus back to the button that opened it. Without the key the export
  // menu and the saved-charts dialog stayed open until something was
  // clicked, which the keyboard could not do.
  let exportBtn = $state<HTMLButtonElement | null>(null);
  let savedBtn = $state<HTMLButtonElement | null>(null);
  function dismissable(scope: string, close: () => void, trigger: () => HTMLButtonElement | null) {
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest(scope)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
      trigger()?.focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }
  $effect(() => {
    if (!exportOpen) return;
    return dismissable(".sv-grid-chart-export", () => (exportOpen = false), () => exportBtn);
  });

  // ---- Saved charts: name the active tab, apply or remove a saved one -----
  let savedOpen = $state(false);
  let saveName = $state("");
  function saveChart() {
    const name = saveName.trim();
    if (!name) return;
    ctrl.saveChart(name);
    saveName = "";
  }
  $effect(() => {
    if (!savedOpen) return;
    return dismissable(".sv-grid-chart-saved", () => (savedOpen = false), () => savedBtn);
  });

  // ---- Describe: the chart's summary sentence to the clipboard ------------
  async function describeChart() {
    exportOpen = false;
    if (!spec) return;
    const { chartSummary } = await import("./chart-summary");
    const text = chartSummary(spec);
    try { await navigator.clipboard?.writeText(text); } catch { /* no clipboard */ }
    aiRationale = text;
  }

  // ---- AI "chart this" (enterprise-registered handler) -------------------
  const aiEnabled = $derived(!!ctrl.chartAiHandler);
  const explainEnabled = $derived(!!ctrl.chartExplainHandler);
  async function explainChart() {
    const handler = ctrl.chartExplainHandler;
    if (!handler || aiBusy) return;
    aiBusy = true;
    aiError = "";
    aiRationale = "";
    try {
      const out = await handler();
      aiRationale = out ? [out.summary, ...out.insights].filter(Boolean).join(" ") : "";
      if (!out) aiError = m.chartAiNoExplanation;
    } catch (e) {
      aiError = e instanceof Error ? e.message : m.chartAiFailed;
    } finally {
      aiBusy = false;
    }
  }
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
        aiError = m.chartAiNoChart;
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : m.chartAiFailed;
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
  aria-label={m.chartPanelTitle}
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
      aria-label={m.chartResize}
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
      <span class="sv-grid-chart-title">{m.chartPanelTitle}</span>
      <div class="sv-grid-chart-actions">
        {#if crossFilter && !isCustom}
          <button type="button" class="sv-grid-chart-btn" onclick={() => ctrl.clearChartCrossFilter()}>{m.chartClearFilter}</button>
        {/if}
        <div class="sv-grid-chart-export">
          <button type="button" class="sv-grid-chart-icon-btn" aria-label={m.chartExportLabel} title={m.chartExport} aria-expanded={exportOpen} bind:this={exportBtn} onclick={() => (exportOpen = !exportOpen)}>
            {#if copied}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {/if}
          </button>
          {#if exportOpen}
            <div class="sv-grid-chart-export-menu" role="menu">
              <button type="button" role="menuitem" onclick={exportPng}>{m.chartExportPng}</button>
              <button type="button" role="menuitem" onclick={exportSvg}>{m.chartExportSvg}</button>
              <button type="button" role="menuitem" onclick={exportPdf}>{m.chartExportPdf}</button>
              <button type="button" role="menuitem" disabled={!csvExportable} onclick={exportCsv}>{m.chartExportCsv}</button>
              <button type="button" role="menuitem" onclick={copyImage}>{m.chartExportCopy}</button>
              <button type="button" role="menuitem" onclick={printChart}>{m.chartExportPrint}</button>
              <button type="button" role="menuitem" onclick={describeChart}>{m.chartExportDescribe}</button>
            </div>
          {/if}
        </div>
        {#if aiEnabled && !isCustom}
          <button type="button" class="sv-grid-chart-btn sv-grid-chart-ai-btn" class:is-active={aiOpen} aria-label={m.chartAiLabel} title={m.chartAiLabel} aria-expanded={aiOpen} onclick={() => (aiOpen = !aiOpen)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 4.6L18.5 8.5 13.9 10.4 12 15l-1.9-4.6L5.5 8.5l4.6-1.9L12 2zm6 11l1 2.4 2.4 1-2.4 1L18 21l-1-2.6-2.4-1 2.4-1L18 13zM6 14l.8 2 2 .8-2 .8L6 20l-.8-2.4-2-.8 2-.8L6 14z" /></svg>
            {m.chartAi}
          </button>
        {/if}
        {#if !isCustom}
          <button type="button" class="sv-grid-chart-btn sv-grid-chart-build-btn" aria-label={m.chartBuildLabel} title={m.chartBuildTitle} aria-haspopup="dialog" onclick={openBuilder}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            {m.chartBuild}
          </button>
          <div class="sv-grid-chart-export sv-grid-chart-saved">
            <button type="button" class="sv-grid-chart-icon-btn sv-grid-chart-saved-btn" aria-label={m.chartSaveLabel} title={m.chartSavedTitle} aria-expanded={savedOpen} aria-haspopup="dialog" bind:this={savedBtn} onclick={() => (savedOpen = !savedOpen)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            </button>
            {#if savedOpen}
              <div class="sv-grid-chart-export-menu sv-grid-chart-saved-menu" role="dialog" aria-label={m.chartSavedTitle}>
                <form class="sv-grid-chart-saved-row" onsubmit={(e) => { e.preventDefault(); saveChart(); }}>
                  <input class="sv-grid-chart-saved-name" type="text" aria-label={m.chartSaveName} placeholder={m.chartSaveNamePlaceholder} bind:value={saveName} />
                  <button type="submit" class="sv-grid-chart-btn" disabled={!saveName.trim()}>{m.chartSave}</button>
                </form>
                {#if ctrl.savedCharts.length}
                  <ul class="sv-grid-chart-saved-list">
                    {#each ctrl.savedCharts as sc (sc.name)}
                      <li class="sv-grid-chart-saved-item">
                        <button type="button" class="sv-grid-chart-saved-apply" title={m.chartSaveApply} onclick={() => { ctrl.applySavedChart(sc.name); savedOpen = false; }}>{sc.name}</button>
                        <button type="button" class="sv-grid-chart-saved-x" aria-label={`${m.chartSaveRemove}: ${sc.name}`} title={m.chartSaveRemove} onclick={() => ctrl.removeSavedChart(sc.name)}>&times;</button>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="sv-grid-chart-saved-empty">{m.chartSavedEmpty}</p>
                {/if}
              </div>
            {/if}
          </div>
          <button
            type="button"
            class="sv-grid-chart-icon-btn sv-grid-chart-link-btn"
            class:is-unlinked={!!ctrl.chartFrozen}
            aria-label={ctrl.chartFrozen ? m.chartLinkBack : m.chartUnlink}
            aria-pressed={!!ctrl.chartFrozen}
            title={ctrl.chartFrozen ? m.chartUnlinkedTitle : m.chartLinkedTitle}
            onclick={() => (ctrl.chartFrozen ? ctrl.unfreezeChart() : ctrl.freezeChart())}
          >
            {#if ctrl.chartFrozen}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" /><line x1="8" y1="2" x2="8" y2="5" /><line x1="2" y1="8" x2="5" y2="8" /><line x1="16" y1="19" x2="16" y2="22" /><line x1="19" y1="16" x2="22" y2="16" /></svg>
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            {/if}
          </button>
          <button type="button" class="sv-grid-chart-icon-btn" aria-label={m.chartAdd} title={m.chartAdd} onclick={() => ctrl.addChart()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        {/if}
        {#if floating}
          <button type="button" class="sv-grid-chart-icon-btn" aria-label={maximized ? m.chartRestore : m.chartMaximize} title={maximized ? m.chartRestore : m.chartMaximize} onclick={toggleMax}>
            {#if maximized}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
            {/if}
          </button>
          <button type="button" class="sv-grid-chart-icon-btn" aria-label={m.chartDockLabel} title={m.chartDock} onclick={dockBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
          </button>
        {:else}
          <button type="button" class="sv-grid-chart-icon-btn" aria-label={m.chartPopOutLabel} title={m.chartPopOut} onclick={popOut}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          </button>
        {/if}
        <button type="button" class="sv-grid-chart-close" aria-label={m.chartClose} onclick={() => (ctrl.chartPanelOpen = false)}>&times;</button>
      </div>
    </div>
    {#if !isCustom && ctrl.charts.length > 1}
      <div class="sv-grid-chart-tabs" role="tablist" aria-label={m.chartTabs}>
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
              aria-label={chartPanelMessage(m.chartRemoveTab, { title: c.title })}
              title={m.chartRemove}
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
            placeholder={m.chartAiPlaceholder}
            bind:value={aiPrompt}
            disabled={aiBusy}
          />
          <button type="submit" class="sv-grid-chart-btn" disabled={aiBusy || !aiPrompt.trim()}>
            {aiBusy ? m.chartAiThinking : m.chartAiRun}
          </button>
          {#if explainEnabled}
            <button type="button" class="sv-grid-chart-btn sv-grid-chart-explain-btn" disabled={aiBusy || !spec} onclick={explainChart} title={m.chartAiExplainTitle}>{m.chartAiExplain}</button>
          {/if}
        </form>
        {#if aiError}
          <p class="sv-grid-chart-ai-msg is-error">{aiError}</p>
        {:else if aiRationale}
          <p class="sv-grid-chart-ai-msg">{aiRationale}</p>
        {/if}
      </div>
    {/if}
    {#if !isCustom}
      <SvGridChartPickers {ctrl} messages={m} />
    {/if}
  </header>

  <div class="sv-grid-chart-panel-body" bind:this={bodyEl}>
    <!-- A gauge is one number, so it legitimately carries no series and no
         categories. Gating purely on `series.length` sent it to the "No data"
         message even with a perfectly good spec. -->
    {#if spec && ctrl.chartIndicatorPanes.length && spec.series[0]?.ohlc}
      <div class="sv-grid-chart-panes-host">
        <SvChartPanes
          {spec}
          indicators={ctrl.chartIndicatorPanes}
          onSelect={onChartSelect}
          interactive
          legend={false}
          zoomable={cfg?.zoom ?? false}
          bind:zoom={ctrl.chartZoom}
          rangePresets={cfg?.rangePresets}
          syncGroup={cfg?.syncGroup}
          contextMenu={cfg?.contextMenu}
          animate={cfg?.animate}
          localeText={cfg?.localeText}
          crosshairLabels={crosshairLabelsProp}
          toolbar={cfg?.export === true ? true : undefined}
        />
      </div>
    {:else if spec && (spec.series.length || spec.gaugeValue != null || isCustom)}
      <SvGridChart
        {spec}
        autosize
        onSelect={onChartSelect}
        interactive
        legend={legendProp}
        dataLabels={dataLabelsProp}
        zoomable={cfg?.zoom ?? false}
        bind:zoom={ctrl.chartZoom}
        brush={cfg?.brush === true}
        rangePresets={cfg?.rangePresets}
        syncGroup={cfg?.syncGroup}
        contextMenu={cfg?.contextMenu}
        animate={cfg?.animate}
        localeText={cfg?.localeText}
        crosshairLabels={crosshairLabelsProp}
        toolbar={cfg?.export === true ? true : undefined}
      />
    {:else}
      <p class="sv-grid-chart-empty">
        {#if !columns.dims.length || !columns.measures.length}
          {m.chartEmptyColumns}
        {:else}
          {m.chartEmptyData}
        {/if}
      </p>
    {/if}
  </div>

  {#if Builder}
    <Builder {ctrl} bind:open={builderOpen} types={availableTypes} messages={m} />
  {/if}

  {#if floating && !maximized}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sv-grid-chart-float-resizer"
      onpointerdown={startFloatResize}
      role="separator"
      aria-label={m.chartResizeWindow}
    ></div>
  {/if}
</section>
