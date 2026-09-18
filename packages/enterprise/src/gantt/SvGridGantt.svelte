<script
  lang="ts"
  generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData"
>
  // Gantt renderer for SvGrid. Rendered in place of the table when the `gantt`
  // prop is set. Like the Kanban board (SvGridBoard) and the calendar
  // (SvGridScheduler) it is a pure *view of the grid*:
  //   - reads the grid's already filtered + sorted rows
  //   - resolves them into bars, nested into a work-breakdown tree
  //   - draws a task table beside a time chart, with dependency arrows
  //   - writes back only through callbacks, never mutating the rows
  // The layout math lives in ./gantt-model (pure + unit-tested); the arrow
  // geometry in ./timeline-arrows, shared with the scheduler's timeline.
  //
  // Scrolling is ONE container for both axes: the task pane sticks to the left
  // and the axis header to the top. Two scrollers kept in sync is the usual
  // shape for this layout and the usual source of a header that drifts a pixel
  // behind its bars on a trackpad.
  import type {
    ColumnDef,
    GanttConfig,
    GanttDependency,
    RowData,
    TableFeatures,
  } from "@svgrid/grid";
  import { portalToBody } from "@svgrid/grid";
  import { violations, type SchedulerDependency } from "../scheduler-dependencies";
  import { dependencyArrows, type BarRect } from "./timeline-arrows";
  import {
    ganttAxis,
    ganttTickWidth,
    ganttTree,
    isWorkingDay,
    makeCalendar,
    nodeIndex,
    projectRange,
    resolveTasks,
    visibleAnchor,
    workingDays,
    type GanttNode,
    type GanttTaskSpec,
    type ResolvedTask,
  } from "./gantt-model";
  import type { GanttProConfig } from "./gantt-config";

  let {
    data,
    columns,
    gantt,
    getRowId,
  }: {
    data: ReadonlyArray<TData>;
    columns: Array<ColumnDef<TFeatures, TData>>;
    gantt: GanttConfig<TFeatures, TData>;
    getRowId?: (row: TData, index: number) => string;
  } = $props();

  const MS_DAY = 86_400_000;
  const ZOOMS = ["day", "week", "month", "quarter", "year"] as const;
  type Zoom = (typeof ZOOMS)[number];

  // The Pro fields are read through a cast: the renderer is registered untyped,
  // so the free grid's GanttConfig stays unchanged. Mirrors the scheduler's
  // `pcfg`. Only the fields Phase 1 honours are read here.
  const pcfg = $derived(gantt as unknown as GanttProConfig<TFeatures, TData>);

  // --- config with defaults ---
  const rowH = $derived(Math.max(18, gantt.rowHeight ?? 32));
  const barH = $derived(Math.max(8, rowH - 10));
  const zoomLadder = $derived<ReadonlyArray<Zoom>>(
    (gantt.zoomLevels?.length ? gantt.zoomLevels : ZOOMS) as ReadonlyArray<Zoom>,
  );
  let zoomOverride = $state<Zoom | null>(null);
  const zoom = $derived<Zoom>(zoomOverride ?? (gantt.zoom as Zoom) ?? "week");
  const weekStartsOn = $derived(gantt.weekStartsOn ?? 0);
  const cal = $derived(makeCalendar(gantt.nonWorkingDays ?? [0, 6], gantt.holidays ?? []));
  const summaryBars = $derived(gantt.summaryBars !== false);
  const labelPosition = $derived(gantt.labelPosition ?? "inside");
  const showNonWorking = $derived(gantt.showNonWorking !== false);
  const showTodayLine = $derived(gantt.todayLine !== false);

  // The clock, read once a minute rather than per render, so the today line
  // and the "today" tick stay right through a long session without making
  // every derived value depend on Date.now().
  let today = $state(startOfToday());
  function startOfToday(): Date {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  $effect(() => {
    const id = setInterval(() => {
      const next = startOfToday();
      if (next.getTime() !== today.getTime()) today = next;
    }, 60_000);
    return () => clearInterval(id);
  });

  // --- stable per-row key (getRowId, else a synthetic id pinned to the row
  // object) so any future drag overlay survives data adds / removes + re-sorts.
  const synthetic = new WeakMap<object, string>();
  let nextSynthetic = 0;
  function key(row: TData): string {
    if (getRowId) return getRowId(row, data.indexOf(row));
    const obj = row as unknown as object;
    let id = synthetic.get(obj);
    if (!id) {
      id = `gantt-${nextSynthetic++}`;
      synthetic.set(obj, id);
    }
    return id;
  }

  // --- the edit overlay: never mutates the consumer's rows. Phase 1 is
  // read-only, so it stays empty; the spec already reads through it so editing
  // only has to write here.
  let startOf = $state<Record<string, Date>>({});
  let endOf = $state<Record<string, Date>>({});
  let progressOf = $state<Record<string, number>>({});
  let edits = $state<Record<string, Record<string, unknown>>>({});

  function fieldValue(row: TData, field: string): unknown {
    const e = edits[key(row)];
    if (e && field in e) return e[field];
    return (row as Record<string, unknown>)[field];
  }

  // --- columns lookup + default title field ---
  const fieldColumns = $derived(columns.filter((c) => typeof c.field === "string"));
  const titleField = $derived(
    gantt.titleField ?? (fieldColumns[0]?.field as string | undefined),
  );

  // --- resolve rows into tasks, then into a tree ---
  const spec = $derived.by<GanttTaskSpec<TData>>(() => ({
    getKey: (r) => key(r),
    getStart: (r) => startOf[key(r)] ?? (fieldValue(r, gantt.startField) as never),
    getEnd: (r) =>
      endOf[key(r)] ??
      (gantt.endField ? (fieldValue(r, gantt.endField) as never) : undefined),
    getDuration: (r) =>
      gantt.durationField ? (fieldValue(r, gantt.durationField) as never) : undefined,
    getTitle: (r) => (titleField ? String(fieldValue(r, titleField) ?? "") : ""),
    getProgress: (r) =>
      progressOf[key(r)] ??
      (gantt.progressField ? (fieldValue(r, gantt.progressField) as never) : undefined),
    getParent: (r) =>
      gantt.parentField
        ? (fieldValue(r, gantt.parentField) as string | null | undefined)
        : undefined,
    getMilestone: (r) =>
      gantt.milestoneField ? !!fieldValue(r, gantt.milestoneField) : false,
    getColor: (r) =>
      gantt.colorField
        ? ((fieldValue(r, gantt.colorField) as string | undefined) ?? gantt.color)
        : gantt.color,
  }));

  const tasks = $derived(resolveTasks(data, spec, cal));

  // Collapse state: the config owns it when `collapsed` is set, else we do.
  let collapsedLocal = $state<Set<string>>(new Set());
  const collapsed = $derived(
    gantt.collapsed ? new Set(gantt.collapsed) : collapsedLocal,
  );
  function setCollapsed(next: Set<string>) {
    if (!gantt.collapsed) collapsedLocal = next;
    gantt.onCollapseChange?.([...next]);
  }
  function toggleCollapse(k: string) {
    const next = new Set(collapsed);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setCollapsed(next);
  }
  const parentKeys = $derived(
    new Set(tasks.filter((t) => t.parentKey != null).map((t) => t.parentKey as string)),
  );
  const anyCollapsible = $derived(parentKeys.size > 0);
  const allCollapsed = $derived(
    anyCollapsible && [...parentKeys].every((k) => collapsed.has(k)),
  );

  // The tree is built from EVERY task, not the visible rows, so a collapsed
  // phase still rolls its children up into its summary bar.
  const nodes = $derived(ganttTree(tasks, collapsed));
  const rowIndexOf = $derived(nodeIndex(nodes));
  const anchorOf = $derived(visibleAnchor(nodes, tasks));

  // --- the axis, and the ONE function that turns a date into an x ---
  const range = $derived(
    projectRange(tasks, {
      paddingDays: gantt.rangePaddingDays ?? 7,
      today,
      minDate: gantt.minDate ?? null,
      maxDate: gantt.maxDate ?? null,
    }),
  );
  const axis = $derived(
    ganttAxis(range.start, range.end, zoom, { weekStartsOn, today: showTodayLine ? today : null }),
  );
  const axisPx = $derived(
    Math.max(240, Math.round(axis.ticks.length * ganttTickWidth[zoom])),
  );
  /** Date -> x offset (px) in the chart body. Every bar, gridline, band, arrow
   *  anchor and the today line goes through this; nothing else maps a date. */
  const xOf = $derived(
    (d: Date) => ((d.getTime() - axis.start.getTime()) / axis.totalMs) * axisPx,
  );
  const bodyH = $derived(Math.max(rowH, nodes.length * rowH));

  // Non-working columns, as day bands. Under a day-granular axis these are
  // whole days; a tick coarser than a day (week / month) is never wholly
  // non-working, so the shading is simply skipped there rather than lying.
  const shadeBands = $derived.by(() => {
    if (!showNonWorking || (zoom !== "day" && zoom !== "week")) return [];
    const out: Array<{ left: number; width: number }> = [];
    for (const t of axis.ticks) {
      if (isWorkingDay(t.start, cal)) continue;
      const left = xOf(t.start);
      out.push({ left, width: Math.max(1, xOf(t.end) - left) });
    }
    return out;
  });
  const todayX = $derived(
    showTodayLine &&
      today.getTime() >= axis.start.getTime() &&
      today.getTime() < axis.end.getTime()
      ? xOf(today)
      : null,
  );

  // --- bars -----------------------------------------------------------------
  type Bar = {
    key: string;
    node: GanttNode<TData>;
    row: TData;
    title: string;
    kind: "task" | "summary" | "milestone";
    left: number;
    width: number;
    progress: number;
    color: string | undefined;
    index: number;
    start: Date;
    end: Date;
  };

  /** The dates a row DRAWS at: a parent shows its rollup, a leaf its own. */
  function drawnSpan(n: GanttNode<TData>): { start: Date; end: Date; progress: number } {
    if (n.hasChildren && summaryBars && n.summary) return n.summary;
    return { start: n.task.start, end: n.task.end, progress: n.task.progress };
  }

  const bars = $derived.by<Bar[]>(() =>
    nodes.map((n, i) => {
      const span = drawnSpan(n);
      const left = xOf(span.start);
      const isMilestone = n.task.milestone && !n.hasChildren;
      const kind: Bar["kind"] = isMilestone
        ? "milestone"
        : n.hasChildren && summaryBars
          ? "summary"
          : "task";
      return {
        key: n.task.key,
        node: n,
        row: n.task.row,
        title: n.task.title,
        kind,
        left,
        width: Math.max(2, xOf(span.end) - left),
        progress: span.progress,
        color: n.task.color,
        index: i,
        start: span.start,
        end: span.end,
      };
    }),
  );

  // --- dependency arrows ----------------------------------------------------
  /** The links, from the flat list and / or a per-row field. `lag` is days on
   *  the Gantt and minutes in the shared cascade helpers, so it converts here. */
  const depList = $derived.by<SchedulerDependency[]>(() => {
    const out: SchedulerDependency[] = [];
    const push = (d: GanttDependency) => {
      if (!d || !d.from || !d.to || d.from === d.to) return;
      out.push({
        id: d.id,
        from: String(d.from),
        to: String(d.to),
        type: d.type,
        lag: (d.lag ?? 0) * 1440,
      });
    };
    for (const d of gantt.dependencies ?? []) push(d);
    const f = gantt.dependencyField;
    if (f) {
      for (const row of data) {
        const raw = fieldValue(row, f);
        if (!Array.isArray(raw)) continue;
        const from = key(row);
        for (const entry of raw) {
          if (typeof entry === "string") {
            push({ id: `${from}->${entry}`, from, to: entry });
          } else if (entry && typeof entry === "object") {
            const d = entry as GanttDependency;
            push({ ...d, from: d.from ?? from, id: d.id ?? `${from}->${d.to}` });
          }
        }
      }
    }
    return out;
  });
  const hasDeps = $derived(depList.length > 0);
  const depTimes = $derived(
    new Map(tasks.map((t) => [t.key, { start: t.start, end: t.end }])),
  );
  const depBad = $derived(
    hasDeps ? new Set(violations(depTimes, depList).map((d) => d.id)) : new Set<string>(),
  );
  const barRects = $derived.by(() => {
    const m = new Map<string, BarRect>();
    for (const b of bars) {
      m.set(b.key, {
        left: b.left,
        right: b.left + b.width,
        midY: b.index * rowH + rowH / 2,
      });
    }
    return m;
  });
  /** Arrows, with each end re-pointed at the visible row that stands for it -
   *  a link into a collapsed phase draws to that phase's summary bar. */
  const arrows = $derived.by(() => {
    if (!hasDeps) return [];
    const resolved = depList.map((d) => ({
      id: d.id,
      from: anchorOf.get(d.from) ?? d.from,
      to: anchorOf.get(d.to) ?? d.to,
      type: d.type,
    }));
    return dependencyArrows(barRects, resolved, depBad, rowH);
  });

  // --- the task table -------------------------------------------------------
  type TableCol = {
    id: string;
    label: string;
    width: number;
    kind: "field" | "duration" | "progress";
    field?: string;
    numeric?: boolean;
  };
  /** Two columns a consumer can name in `tableColumns` without defining them. */
  const BUILT_IN: Record<string, TableCol> = {
    __duration: { id: "__duration", label: "Days", width: 70, kind: "duration", numeric: true },
    __progress: { id: "__progress", label: "Progress", width: 110, kind: "progress" },
  };
  function colId(c: ColumnDef<TFeatures, TData>): string {
    return c.id ?? (c.field as string) ?? "";
  }
  const tableCols = $derived.by<TableCol[]>(() => {
    const fromDef = (c: ColumnDef<TFeatures, TData>): TableCol => ({
      id: colId(c),
      label: typeof c.header === "string" ? c.header : ((c.field as string) ?? ""),
      width: c.width ?? 140,
      kind: "field",
      field: c.field as string | undefined,
    });
    const want = gantt.tableColumns;
    if (!want) return fieldColumns.map(fromDef);
    const byId = new Map(fieldColumns.map((c) => [colId(c), c]));
    const out: TableCol[] = [];
    for (const id of want) {
      if (BUILT_IN[id]) out.push(BUILT_IN[id]!);
      else {
        const c = byId.get(id);
        if (c) out.push(fromDef(c));
      }
    }
    return out;
  });
  const tableColsWidth = $derived(tableCols.reduce((n, c) => n + c.width, 0))
  /**
   * The first column FLEXES and the rest keep their width, so the columns
   * always add up to the pane exactly. A `tableWidth` narrower than the columns
   * would otherwise spill them over the chart, and one wider would leave a gap
   * at the end of every row.
   */
  function colStyle(col: TableCol, i: number): string {
    return i === 0
      ? `flex:1 1 ${col.width}px; min-width:0`
      : `flex:none; width:${col.width}px`
  };
  let tableW = $state(0);
  let tableWSeeded = false;
  $effect(() => {
    // Seed once from the config (or the columns' own widths), then leave the
    // splitter in charge - re-seeding would undo every drag.
    if (tableWSeeded) return;
    tableWSeeded = true;
    tableW = gantt.tableWidth ?? Math.min(520, Math.max(180, tableColsWidth));
  });
  const showTable = $derived(tableCols.length > 0 && tableW > 0);

  /** The board's display rule: dates read locally, everything else as text. */
  function fmt(value: unknown): string {
    if (value == null) return "";
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }
  function cellText(col: TableCol, n: GanttNode<TData>): string {
    if (col.kind === "duration") {
      // A parent carries no dates of its own, so read the span it DRAWS -
      // otherwise every phase reports zero days.
      const span = drawnSpan(n);
      return String(workingDays(span.start, span.end, cal));
    }
    if (col.kind === "field" && col.field) return fmt(fieldValue(n.task.row, col.field));
    return "";
  }

  // --- splitter -------------------------------------------------------------
  let splitDrag: { startX: number; startW: number } | null = null;
  function startSplit(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    splitDrag = { startX: e.clientX, startW: tableW };
    window.addEventListener("pointermove", onSplitMove);
    window.addEventListener("pointerup", endSplit, { once: true });
  }
  function onSplitMove(e: PointerEvent) {
    if (!splitDrag) return;
    tableW = Math.max(0, Math.min(900, splitDrag.startW + (e.clientX - splitDrag.startX)));
  }
  function endSplit() {
    window.removeEventListener("pointermove", onSplitMove);
    splitDrag = null;
  }

  // --- row windowing --------------------------------------------------------
  // Above the threshold only the rows near the viewport render. Rows are
  // absolutely positioned by index, so nothing else in the layout changes.
  const WINDOW_FROM = 300;
  const OVERSCAN = 20;
  let scrollEl = $state<HTMLElement | null>(null);
  let scrollTop = $state(0);
  let viewportH = $state(0);
  function onScroll() {
    if (scrollEl) scrollTop = scrollEl.scrollTop;
  }
  const visibleBars = $derived.by(() => {
    if (bars.length <= WINDOW_FROM || viewportH <= 0) return bars;
    const first = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
    const last = Math.min(bars.length, Math.ceil((scrollTop + viewportH) / rowH) + OVERSCAN);
    return bars.slice(first, last);
  });
  const visibleRows = $derived.by(() => {
    if (nodes.length <= WINDOW_FROM || viewportH <= 0) {
      return nodes.map((n, i) => ({ node: n, index: i }));
    }
    const first = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
    const last = Math.min(nodes.length, Math.ceil((scrollTop + viewportH) / rowH) + OVERSCAN);
    return nodes.slice(first, last).map((n, i) => ({ node: n, index: first + i }));
  });

  // --- zoom -----------------------------------------------------------------
  const zoomIndex = $derived(Math.max(0, zoomLadder.indexOf(zoom)));
  function setZoom(next: Zoom) {
    if (next === zoom) return;
    zoomOverride = next;
    gantt.onZoomChange?.(next);
  }
  function stepZoom(dir: -1 | 1) {
    // -1 zooms IN (a finer preset sits earlier in the ladder).
    const i = Math.max(0, Math.min(zoomLadder.length - 1, zoomIndex + dir));
    const next = zoomLadder[i];
    if (next) setZoom(next);
  }
  function onWheel(e: WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    // Keep the date under the pointer put: note it, change preset, re-scroll.
    const el = scrollEl;
    const before = el ? dateAtClientX(e.clientX) : null;
    stepZoom(e.deltaY > 0 ? 1 : -1);
    if (!el || !before) return;
    const offset = e.clientX - el.getBoundingClientRect().left;
    queueMicrotask(() => {
      el.scrollLeft = xOf(before) + (showTable ? tableW : 0) - offset;
    });
  }
  function dateAtClientX(clientX: number): Date | null {
    if (!scrollEl) return null;
    const rect = scrollEl.getBoundingClientRect();
    const x = clientX - rect.left + scrollEl.scrollLeft - (showTable ? tableW : 0);
    return new Date(axis.start.getTime() + (x / axisPx) * axis.totalMs);
  }

  /** Centre the chart on today (or the first task) when it first has a width. */
  let scrolledIn = false;
  $effect(() => {
    const el = scrollEl;
    if (!el || scrolledIn || !axisPx) return;
    const target = todayX ?? (bars.length ? bars[0]!.left : null);
    if (target == null) return;
    scrolledIn = true;
    const half = el.clientWidth ? el.clientWidth / 2 : 0;
    el.scrollLeft = Math.max(0, target + (showTable ? tableW : 0) - half);
  });

  /** The window the chart spans, as its first and last header groups. */
  const rangeLabel = $derived.by(() => {
    const first = axis.majors[0]?.label
    const last = axis.majors[axis.majors.length - 1]?.label
    if (!first) return ""
    return !last || last === first ? first : `${first} - ${last}`
  })

  // --- tooltip --------------------------------------------------------------
  const tooltipCfg = $derived(gantt.tooltip);
  const hasTooltip = $derived(!!tooltipCfg);
  const tooltipSnippet = $derived(typeof tooltipCfg === "function" ? tooltipCfg : undefined);
  let tipBar = $state<Bar | null>(null);
  let tipPos = $state({ x: 0, y: 0 });
  let tipTimer: ReturnType<typeof setTimeout> | undefined;
  function onBarEnter(e: MouseEvent, bar: Bar) {
    if (!hasTooltip) return;
    clearTimeout(tipTimer);
    const target = e.currentTarget as HTMLElement;
    tipTimer = setTimeout(() => {
      const r = target.getBoundingClientRect();
      tipPos = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top) };
      tipBar = bar;
    }, gantt.tooltipDelay ?? 400);
  }
  function onBarLeave() {
    clearTimeout(tipTimer);
    tipBar = null;
  }
  $effect(() => () => clearTimeout(tipTimer));

  // --- labels ---------------------------------------------------------------
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  /** The INCLUSIVE last day of a bar, which is what a person reads off a plan.
   *  `end` is exclusive, so a task ending Wed 00:00 finishes on Tuesday. */
  function lastDay(b: { start: Date; end: Date }): Date {
    if (b.end.getTime() <= b.start.getTime()) return b.start;
    return new Date(b.end.getTime() - MS_DAY);
  }
  function barRange(b: { start: Date; end: Date }): string {
    const from = fmtDay(b.start);
    const to = fmtDay(lastDay(b));
    return from === to ? from : `${from} - ${to}`;
  }
  function barAria(b: Bar): string {
    const days = workingDays(b.start, b.end, cal);
    if (b.kind === "milestone") return `${b.title || "Milestone"}, ${fmtDay(b.start)}`;
    return `${b.title}, ${barRange(b)}, ${days} ${days === 1 ? "day" : "days"}, ${Math.round(b.progress)}%`;
  }
  /** Rough px a label needs, to decide whether it fits inside its bar. */
  const labelFits = (b: Bar) => b.width >= (b.title.length + 2) * 6.6;
  function labelInside(b: Bar): boolean {
    if (labelPosition === "none" || b.kind === "milestone") return false;
    if (labelPosition === "right") return false;
    return b.kind !== "summary" && labelFits(b);
  }
  function labelOutside(b: Bar): boolean {
    return labelPosition !== "none" && !labelInside(b) && !!b.title;
  }
</script>

<div class="sv-gantt" style={`--gantt-row-h:${rowH}px; --gantt-bar-h:${barH}px; --gantt-table-w:${tableW}px`}>
  <div class="sv-gantt-toolbar">
    <span class="sv-gantt-title">{rangeLabel}</span>
    <div class="sv-gantt-tools">
      {#if anyCollapsible}
        <button
          type="button"
          class="sv-gantt-btn"
          onclick={() => setCollapsed(allCollapsed ? new Set() : new Set(parentKeys))}
        >{allCollapsed ? "Expand all" : "Collapse all"}</button>
      {/if}
      {#if zoomLadder.length > 1}
        <div class="sv-gantt-zoom">
          <button
            type="button"
            class="sv-gantt-btn"
            aria-label="Zoom in"
            disabled={zoomIndex <= 0}
            onclick={() => stepZoom(-1)}
          >-</button>
          <span class="sv-gantt-zoom-label">{zoom}</span>
          <button
            type="button"
            class="sv-gantt-btn"
            aria-label="Zoom out"
            disabled={zoomIndex >= zoomLadder.length - 1}
            onclick={() => stepZoom(1)}
          >+</button>
        </div>
      {/if}
    </div>
  </div>

  <!-- One scroll container for BOTH axes; the task pane sticks left and the
       axis header sticks top, so neither can drift out of step with the bars. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sv-gantt-scroll"
    bind:this={scrollEl}
    bind:clientHeight={viewportH}
    onscroll={onScroll}
    onwheel={onWheel}
  >
    <div class="sv-gantt-panes" style={`min-width:${(showTable ? tableW : 0) + axisPx}px`}>
      {#if showTable}
        <div class="sv-gantt-table" style={`width:${tableW}px`}>
          <div class="sv-gantt-table-head">
            {#each tableCols as col, ci (col.id)}
              <div
                class="sv-gantt-th"
                class:sv-gantt-num={col.numeric}
                style={colStyle(col, ci)}
              >{col.label}</div>
            {/each}
          </div>
          <div class="sv-gantt-table-body" style={`height:${bodyH}px`}>
            {#each visibleRows as { node, index } (node.task.key)}
              <div
                class="sv-gantt-tr"
                class:sv-gantt-parent={node.hasChildren}
                style={`top:${index * rowH}px`}
              >
                {#each tableCols as col, ci (col.id)}
                  <div
                    class="sv-gantt-td"
                    class:sv-gantt-num={col.numeric}
                    style={`${colStyle(col, ci)}${ci === 0 ? `; padding-left:${8 + node.depth * 14}px` : ""}`}
                  >
                    {#if ci === 0 && node.hasChildren}
                      <button
                        type="button"
                        class="sv-gantt-chevron"
                        class:sv-gantt-chevron-shut={node.collapsed}
                        aria-expanded={!node.collapsed}
                        aria-label={`${node.collapsed ? "Expand" : "Collapse"} ${node.task.title}`}
                        onclick={() => toggleCollapse(node.task.key)}
                      >&#9662;</button>
                    {:else if ci === 0}
                      <span class="sv-gantt-chevron-gap"></span>
                    {/if}
                    {#if col.kind === "progress"}
                      <span class="sv-gantt-meter" aria-hidden="true">
                        <span
                          class="sv-gantt-meter-fill"
                          style={`width:${Math.round(drawnSpan(node).progress)}%`}
                        ></span>
                      </span>
                      <span class="sv-gantt-meter-pct">{Math.round(drawnSpan(node).progress)}%</span>
                    {:else}
                      <span class="sv-gantt-cell-text">{cellText(col, node)}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="sv-gantt-splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the task table"
            onpointerdown={startSplit}
          ></div>
        </div>
      {/if}

      <div class="sv-gantt-chart" style={`width:${axisPx}px`}>
        <div class="sv-gantt-axis" style={`width:${axisPx}px`}>
          <div class="sv-gantt-majors">
            {#each axis.majors as m (m.leftPct)}
              <div
                class="sv-gantt-major"
                style={`left:${m.leftPct}%; width:${m.widthPct}%`}
              ><span>{m.label}</span></div>
            {/each}
          </div>
          <div class="sv-gantt-ticks">
            {#each axis.ticks as t (t.start.getTime())}
              <div
                class="sv-gantt-tick"
                class:sv-gantt-tick-today={t.today}
                style={`left:${t.leftPct}%; width:${t.widthPct}%`}
              ><span>{t.label}</span></div>
            {/each}
          </div>
        </div>

        <div class="sv-gantt-body" style={`width:${axisPx}px; height:${bodyH}px`}>
          {#each shadeBands as band, i (i)}
            <div
              class="sv-gantt-shade"
              style={`left:${band.left}px; width:${band.width}px`}
              aria-hidden="true"
            ></div>
          {/each}
          {#each axis.ticks as t (t.start.getTime())}
            <div
              class="sv-gantt-gridline"
              style={`left:${t.leftPct}%`}
              aria-hidden="true"
            ></div>
          {/each}

          {#if arrows.length}
            <!-- Dependency arrows over the bars. Pointer-transparent. -->
            <svg
              class="sv-gantt-deps"
              width={axisPx}
              height={bodyH}
              aria-hidden="true"
            >
              {#each arrows as a (a.id)}
                <path class="sv-gantt-dep-line" class:sv-gantt-dep-bad={a.bad} d={a.d} />
                <path
                  class="sv-gantt-dep-arrow"
                  class:sv-gantt-dep-bad={a.bad}
                  d={`M${a.hx},${a.hy} l-6,-3.5 l0,7 z`}
                />
              {/each}
            </svg>
          {/if}

          {#each visibleBars as b (b.key)}
            <div class="sv-gantt-row" style={`top:${b.index * rowH}px`}>
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <div
                class="sv-gantt-bar sv-gantt-bar-{b.kind}"
                class:sv-gantt-bar-done={b.progress >= 100}
                data-key={b.key}
                style={`left:${b.left}px; ${b.kind === "milestone" ? "" : `width:${b.width}px;`}${b.color ? ` --sv-gantt-accent:${b.color};` : ""}`}
                role="row"
                tabindex="0"
                aria-label={barAria(b)}
                onmouseenter={(e) => onBarEnter(e, b)}
                onmouseleave={onBarLeave}
              >
                {#if b.kind !== "milestone"}
                  <span
                    class="sv-gantt-progress"
                    style={`width:${Math.max(0, Math.min(100, b.progress))}%`}
                    aria-hidden="true"
                  ></span>
                {/if}
                {#if gantt.task}
                  <span class="sv-gantt-bar-body">{@render gantt.task(b.row)}</span>
                {:else if labelInside(b)}
                  <span class="sv-gantt-bar-label">{b.title}</span>
                {/if}
              </div>
              {#if !gantt.task && labelOutside(b)}
                <span
                  class="sv-gantt-label"
                  style={`left:${b.left + (b.kind === "milestone" ? 12 : b.width) + 8}px`}
                >{b.title}</span>
              {/if}
            </div>
          {/each}

          {#if todayX != null}
            <div class="sv-gantt-today" style={`left:${todayX}px`} aria-hidden="true"></div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

{#if tipBar}
  <div
    class="sv-gantt-tooltip"
    use:portalToBody
    role="tooltip"
    style:position="fixed"
    style:left={`${tipPos.x}px`}
    style:top={`${tipPos.y}px`}
  >
    {#if tooltipSnippet}
      {@render tooltipSnippet(tipBar.row)}
    {:else}
      <div class="sv-gantt-tooltip-title">{tipBar.title}</div>
      <div class="sv-gantt-tooltip-meta">{barRange(tipBar)}</div>
      {#if tipBar.kind !== "milestone"}
        <div class="sv-gantt-tooltip-meta">
          {workingDays(tipBar.start, tipBar.end, cal)} working days, {Math.round(tipBar.progress)}%
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .sv-gantt {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font-size: 0.85rem;
    color: var(--sg-fg, #1f2937);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    overflow: hidden;
    /* Dragging the splitter must not select the labels it passes over. */
    -webkit-user-select: none;
    user-select: none;
  }

  /* ---- toolbar ---- */
  .sv-gantt-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    flex: 0 0 auto;
  }
  .sv-gantt-title { flex: 1 1 auto; font-weight: 600; font-size: 0.95rem; }
  .sv-gantt-tools { display: flex; align-items: center; gap: 8px; }
  .sv-gantt-zoom { display: inline-flex; align-items: center; gap: 4px; }
  .sv-gantt-zoom-label {
    font-size: 0.76rem;
    color: var(--sg-muted, #6b7280);
    min-width: 54px;
    text-align: center;
    text-transform: capitalize;
  }
  .sv-gantt-btn {
    padding: 3px 9px;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .sv-gantt-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent);
  }
  .sv-gantt-btn:disabled { opacity: 0.45; cursor: default; }

  /* ---- the single scroll container ---- */
  .sv-gantt-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; position: relative; }
  .sv-gantt-panes { display: flex; align-items: flex-start; min-height: 100%; }

  /* ---- task table (sticks to the left through horizontal scroll) ---- */
  .sv-gantt-table {
    position: sticky;
    left: 0;
    /* Above everything the chart draws: the body scrolls horizontally UNDER
       this pane, so bars, arrows and the today line must pass beneath it. */
    z-index: 6;
    flex: none;
    background: var(--sg-bg, #fff);
    border-right: 1px solid var(--sg-border, #e5e7eb);
    /* The pane is a fixed width the splitter owns; anything a column cannot
       fit into it is clipped rather than drawn over the chart. */
    overflow: hidden;
  }
  .sv-gantt-table-head,
  .sv-gantt-tr { display: flex; align-items: stretch; }
  .sv-gantt-table-head {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 48px;
    background: var(--sg-bg, #fff);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .sv-gantt-th,
  .sv-gantt-td {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    min-width: 0;
    overflow: hidden;
  }
  .sv-gantt-th {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--sg-muted, #6b7280);
    align-self: flex-end;
    height: 28px;
  }
  .sv-gantt-num { justify-content: flex-end; font-variant-numeric: tabular-nums; }
  .sv-gantt-table-body { position: relative; }
  .sv-gantt-tr {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--gantt-row-h);
    border-bottom: 1px solid color-mix(in srgb, var(--sg-border, #e5e7eb) 55%, transparent);
  }
  .sv-gantt-parent { font-weight: 600; }
  .sv-gantt-cell-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-gantt-chevron {
    flex: none;
    width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--sg-muted, #6b7280);
    font-size: 0.7rem;
    line-height: 1;
    cursor: pointer;
    transition: transform 0.12s ease;
  }
  .sv-gantt-chevron:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 8%, transparent); }
  .sv-gantt-chevron-shut { transform: rotate(-90deg); }
  .sv-gantt-chevron-gap { flex: none; width: 16px; }
  .sv-gantt-meter {
    flex: 1 1 auto;
    height: 6px;
    min-width: 24px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 10%, transparent);
    overflow: hidden;
  }
  .sv-gantt-meter-fill {
    display: block;
    height: 100%;
    background: var(--sg-accent, #4f46e5);
  }
  .sv-gantt-meter-pct {
    flex: none;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--sg-muted, #6b7280);
  }
  .sv-gantt-splitter {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 4;
  }
  .sv-gantt-splitter:hover {
    background: color-mix(in srgb, var(--sg-accent, #4f46e5) 35%, transparent);
  }

  /* ---- chart ---- */
  .sv-gantt-chart { flex: none; position: relative; }
  .sv-gantt-axis {
    position: sticky;
    top: 0;
    /* Above the bars and arrows that scroll under it, below the task pane. */
    z-index: 5;
    height: 48px;
    background: var(--sg-bg, #fff);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .sv-gantt-majors,
  .sv-gantt-ticks { position: relative; height: 24px; }
  .sv-gantt-majors { border-bottom: 1px solid color-mix(in srgb, var(--sg-border, #e5e7eb) 60%, transparent); }
  .sv-gantt-major,
  .sv-gantt-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    white-space: nowrap;
    border-left: 1px solid color-mix(in srgb, var(--sg-border, #e5e7eb) 60%, transparent);
  }
  .sv-gantt-major { font-size: 0.74rem; font-weight: 600; justify-content: flex-start; }
  /* A month cell is far wider than the viewport, so a centred label sits
     off-screen the moment you scroll into the middle of it - the header then
     reads "r 2026". The label sticks just right of the task pane instead, so
     you can always see which month you are looking at. */
  .sv-gantt-major > span {
    position: sticky;
    left: calc(var(--gantt-table-w, 0px) + 10px);
    padding-right: 10px;
    white-space: nowrap;
  }
  .sv-gantt-tick { font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .sv-gantt-tick-today { color: var(--sg-accent, #4f46e5); font-weight: 700; }

  .sv-gantt-body { position: relative; }
  .sv-gantt-shade {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 4%, transparent);
    pointer-events: none;
  }
  .sv-gantt-gridline {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: color-mix(in srgb, var(--sg-border, #e5e7eb) 55%, transparent);
    pointer-events: none;
  }
  .sv-gantt-today {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 2px dashed var(--sg-accent, #4f46e5);
    pointer-events: none;
    z-index: 4;
  }

  .sv-gantt-row { position: absolute; left: 0; right: 0; height: var(--gantt-row-h); }
  .sv-gantt-bar {
    position: absolute;
    top: calc((var(--gantt-row-h) - var(--gantt-bar-h)) / 2);
    height: var(--gantt-bar-h);
    display: flex;
    align-items: center;
    border-radius: 4px;
    background: var(--sv-gantt-accent, var(--sg-accent, #4f46e5));
    color: #fff;
    overflow: hidden;
    cursor: default;
    z-index: 2;
  }
  .sv-gantt-bar:focus-visible {
    outline: 2px solid var(--sg-accent, #4f46e5);
    outline-offset: 2px;
  }
  .sv-gantt-progress {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, #000 28%, transparent);
    pointer-events: none;
  }
  .sv-gantt-bar-label,
  .sv-gantt-bar-body {
    position: relative;
    z-index: 1;
    padding: 0 6px;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-gantt-label {
    position: absolute;
    top: 0;
    height: var(--gantt-row-h);
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    white-space: nowrap;
    pointer-events: none;
    color: var(--sg-fg, #1f2937);
  }

  /* A parent's rolled-up span: a slim spine with end caps, so it reads as a
     container rather than as work of its own. */
  .sv-gantt-bar-summary {
    height: 8px;
    top: calc((var(--gantt-row-h) - 8px) / 2);
    border-radius: 2px;
    background: color-mix(in srgb, var(--sv-gantt-accent, var(--sg-fg, #1f2937)) 75%, transparent);
  }
  .sv-gantt-bar-summary::before,
  .sv-gantt-bar-summary::after {
    content: "";
    position: absolute;
    top: 100%;
    border-top: 5px solid color-mix(in srgb, var(--sv-gantt-accent, var(--sg-fg, #1f2937)) 75%, transparent);
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
  }
  .sv-gantt-bar-summary::before { left: 0; }
  .sv-gantt-bar-summary::after { right: 0; }

  .sv-gantt-bar-milestone {
    width: var(--gantt-bar-h);
    border-radius: 2px;
    transform: translateX(-50%) rotate(45deg);
    background: var(--sv-gantt-accent, var(--sg-accent, #4f46e5));
  }

  /* ---- dependency arrows (shared geometry with the scheduler timeline) ---- */
  .sv-gantt-deps {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    overflow: visible;
    z-index: 3;
  }
  .sv-gantt-dep-line {
    fill: none;
    stroke: var(--sv-gantt-dep, color-mix(in srgb, var(--sg-fg, #1f2937) 45%, transparent));
    stroke-width: 1.5;
  }
  .sv-gantt-dep-arrow {
    fill: var(--sv-gantt-dep, color-mix(in srgb, var(--sg-fg, #1f2937) 45%, transparent));
  }
  .sv-gantt-dep-line.sv-gantt-dep-bad,
  .sv-gantt-dep-arrow.sv-gantt-dep-bad {
    stroke: var(--sv-gantt-dep-bad, #dc2626);
    fill: var(--sv-gantt-dep-bad, #dc2626);
  }
  .sv-gantt-dep-line.sv-gantt-dep-bad { stroke-dasharray: 4 3; }

  /* ---- tooltip ---- */
  .sv-gantt-tooltip {
    z-index: 2147483002;
    transform: translate(-50%, calc(-100% - 8px));
    max-width: 260px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--sg-bg, #fff);
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 92%, transparent);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    pointer-events: none;
  }
  .sv-gantt-tooltip-title { font-weight: 600; }
  .sv-gantt-tooltip-meta { opacity: 0.85; font-variant-numeric: tabular-nums; }
</style>
