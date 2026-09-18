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
  import {
    portalToBody,
    popIn,
    createDismissableLayer,
    onScrollOutside,
    SvDrawer,
    SvForm,
    SvMenuList,
    type FormField,
    type FormFieldType,
    type MenuItem,
  } from "@svgrid/grid";
  import {
    cascade,
    hasCycle,
    violations,
    type CascadeBound,
    type SchedulerDependency,
  } from "../scheduler-dependencies";
  import { criticalPath, slackDays } from "./gantt-critical-path";
  import { dependencyArrows, type BarRect } from "./timeline-arrows";
  import {
    ganttAxis,
    ganttScale,
    ganttTickWidth,
    ganttTree,
    isWorkingDay,
    makeCalendar,
    nodeIndex,
    projectRange,
    parseDay,
    resolveTasks,
    snapToWorkingDay,
    startOfDay,
    addDays,
    visibleAnchor,
    workingDays,
    type GanttNode,
    type GanttTaskSpec,
    type ResolvedTask,
  } from "./gantt-model";
  import {
    overallocations,
    resourceLoad,
    type ResourceAssignment,
  } from "./gantt-resources";
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
  /** Height of the two-row axis header, shared with the CSS. */
  const axisHeadH = 48;
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
  const editable = $derived(gantt.editable === true);
  const respectWorking = $derived(gantt.respectWorkingTime !== false);
  const historyEnabled = $derived(gantt.history === true);

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
  const fullPx = $derived(
    Math.max(240, Math.round(axis.ticks.length * ganttTickWidth[zoom])),
  );
  /** Fold whole non-working days out of the axis (Pro). Only a day-granular
   *  zoom has weekend columns to fold, so coarser presets ignore it rather
   *  than silently shrinking a week tick by part of itself. */
  const collapseOff = $derived(
    pcfg.collapseWeekends === true && (zoom === "day" || zoom === "week"),
  );
  /** The chart's date <-> pixel mapping, and the only thing that owns it. */
  const scale = $derived(
    ganttScale(axis.start, axis.end, fullPx, {
      collapsed: collapseOff ? (d: Date) => !isWorkingDay(d, cal) : null,
      gapPx: pcfg.collapsedGapPx ?? 12,
    }),
  );
  const axisPx = $derived(scale.totalPx);
  /** Date -> x offset (px) in the chart body. Every bar, gridline, band, arrow
   *  anchor and the today line goes through this; nothing else maps a date. */
  const xOf = $derived((d: Date) => scale.xOf(d));
  /** A header cell's px span, from the percentages the axis reports. */
  const pctDate = $derived(
    (pct: number) => new Date(axis.start.getTime() + (pct / 100) * axis.totalMs),
  );
  const bodyH = $derived(Math.max(rowH, nodes.length * rowH));

  // Non-working columns, as day bands. Under a day-granular axis these are
  // whole days; a tick coarser than a day (week / month) is never wholly
  // non-working, so the shading is simply skipped there rather than lying.
  const shadeBands = $derived.by(() => {
    if (zoom !== "day" && zoom !== "week") return [];
    // Folded away, a run of non-working days is drawn as ONE narrow gap
    // marker rather than a wide shaded column - that is the whole point of
    // folding it, and a per-day band would just stripe the marker.
    if (collapseOff) {
      return scale.segments
        .filter((sg) => sg.collapsed && sg.px > 0)
        .map((sg) => ({ left: sg.x, width: sg.px, gap: true }));
    }
    if (!showNonWorking) return [];
    const out: Array<{ left: number; width: number; gap: boolean }> = [];
    for (const t of axis.ticks) {
      if (isWorkingDay(t.start, cal)) continue;
      const left = xOf(t.start);
      out.push({ left, width: Math.max(1, xOf(t.end) - left), gap: false });
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

  // --- Gantt Pro: critical path, baselines, constraints ----------------------
  // Read through `pcfg` (the untyped Pro cast) so the free grid's GanttConfig
  // stays unchanged. Each is inert unless its field is configured.

  /**
   * The span every row DRAWS, keyed for the planning passes. A parent carries
   * its rollup, so a link naming a phase means "after the whole phase" without
   * the critical path needing a special case for it.
   */
  const drawnTimes = $derived(
    new Map(nodes.map((n) => [n.task.key, (({ start, end }) => ({ start, end }))(drawnSpan(n))])),
  );

  const criticalOn = $derived(pcfg.criticalPath === true && hasDeps);
  const cpm = $derived(criticalOn ? criticalPath(drawnTimes, depList) : null);
  const criticalKeys = $derived(cpm?.critical ?? new Set<string>());
  /** An arrow is critical when both of its ends are. */
  const criticalArrows = $derived.by(() => {
    if (!cpm) return new Set<string>();
    const out = new Set<string>();
    for (const d of depList) {
      if (criticalKeys.has(d.from) && criticalKeys.has(d.to)) out.add(d.id);
    }
    return out;
  });
  $effect(() => {
    if (!cpm) return;
    pcfg.onCriticalPathChange?.([...cpm.critical]);
  });

  // --- baselines -------------------------------------------------------------
  const baselineOn = $derived(!!pcfg.baselineStartField && !!pcfg.baselineEndField);
  type Baseline = { left: number; width: number; varianceDays: number };
  /** The originally agreed span for a row, as a ghost bar under its task. */
  function baselineFor(n: GanttNode<TData>): Baseline | null {
    if (!baselineOn) return null;
    const bs = parseDay(fieldValue(n.task.row, pcfg.baselineStartField as string) as never);
    const beRaw = fieldValue(n.task.row, pcfg.baselineEndField as string);
    const be = parseDay(beRaw as never);
    if (!bs || !be) return null;
    // Same inclusive-date-only rule the task spans use.
    const end =
      typeof beRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(beRaw)
        ? addDays(startOfDay(be), 1)
        : be;
    const left = xOf(bs);
    const span = drawnSpan(n);
    return {
      left,
      width: Math.max(2, xOf(end) - left),
      // Positive means late against the baseline, which is the direction that
      // matters; the tooltip says which way.
      varianceDays: Math.round((span.end.getTime() - end.getTime()) / MS_DAY),
    };
  }

  // --- constraints -----------------------------------------------------------
  const constraintOn = $derived(!!pcfg.constraintField && !!pcfg.constraintDateField);
  type Constraint = { kind: string; date: Date };
  function constraintOf(row: TData): Constraint | null {
    if (!constraintOn) return null;
    const kind = String(fieldValue(row, pcfg.constraintField as string) ?? "").toUpperCase();
    if (!kind || kind === "ASAP") return null;
    const date = parseDay(fieldValue(row, pcfg.constraintDateField as string) as never);
    return date ? { kind, date: startOfDay(date) } : null;
  }
  /**
   * The floor / ceiling each constraint puts on the cascade. `MSO` and `SNET`
   * raise the floor; `MFO` and `FNLT` cap the finish; `SNLT` caps the start,
   * which is the finish minus the duration.
   */
  const cascadeBounds = $derived.by<Map<string, CascadeBound> | undefined>(() => {
    if (!constraintOn) return undefined;
    const out = new Map<string, CascadeBound>();
    for (const t of tasks) {
      const c = constraintOf(t.row);
      if (!c) continue;
      const dur = t.end.getTime() - t.start.getTime();
      switch (c.kind) {
        case "MSO":
        case "SNET":
          out.set(t.key, { minStart: c.date });
          break;
        case "MFO":
        case "FNLT":
          out.set(t.key, { maxEnd: c.date });
          break;
        case "SNLT":
          out.set(t.key, { maxEnd: new Date(c.date.getTime() + dur) });
          break;
        default:
          break; // FNET / ALAP: nothing the forward cascade can enforce.
      }
    }
    return out.size ? out : undefined;
  });
  /** Rows whose constraint their current dates already break. */
  const constraintBroken = $derived.by(() => {
    const out = new Set<string>();
    if (!constraintOn) return out;
    for (const t of tasks) {
      const c = constraintOf(t.row);
      if (!c) continue;
      const late = t.end.getTime() > c.date.getTime();
      const early = t.start.getTime() < c.date.getTime();
      if (
        ((c.kind === "MFO" || c.kind === "FNLT") && late) ||
        (c.kind === "SNLT" && t.start.getTime() > c.date.getTime()) ||
        ((c.kind === "MSO" || c.kind === "SNET") && early) ||
        (c.kind === "FNET" && t.end.getTime() < c.date.getTime())
      ) out.add(t.key);
    }
    return out;
  });
  const CONSTRAINT_GLYPH: Record<string, string> = {
    MSO: "\u25C6", MFO: "\u25C6",
    SNET: "\u25B8", FNET: "\u25B8",
    SNLT: "\u25C2", FNLT: "\u25C2",
    ALAP: "\u25C2",
  };

  // --- resource load (Pro) ---------------------------------------------------
  // Who is booked on what, summed per axis column. Leaves only: a phase is its
  // children, so counting it too would book its owner twice for the same work.
  const resourceField = $derived(pcfg.resourceField ?? null);
  const histoCfg = $derived(
    pcfg.resourceHistogram === true ? {} : (pcfg.resourceHistogram || null),
  );
  const histoOn = $derived(histoCfg != null && resourceField != null);
  function resourceOf(row: TData): string | null {
    if (!resourceField) return null;
    const v = (row as Record<string, unknown>)[resourceField];
    return v == null || v === "" ? null : String(v);
  }
  const assignments = $derived.by<ResourceAssignment[]>(() => {
    if (!histoOn) return [];
    const out: ResourceAssignment[] = [];
    for (const n of nodes) {
      if (n.hasChildren) continue;
      const r = resourceOf(n.task.row);
      if (!r) continue;
      const span = drawnSpan(n);
      out.push({ key: n.task.key, resource: r, start: span.start, end: span.end });
    }
    return out;
  });
  const loadRows = $derived.by(() => {
    if (!histoOn) return [];
    const capField = histoCfg?.capacityField ?? null;
    const capOf = (id: string): number => {
      if (!capField) return 1;
      const r = pcfg.resources?.find((x) => String(x.id) === id) as
        | Record<string, unknown>
        | undefined;
      const v = r?.[capField];
      return typeof v === "number" && v > 0 ? v : 1;
    };
    return resourceLoad(
      assignments,
      axis.ticks.map((t) => ({ start: t.start, end: t.end })),
      { resources: pcfg.resources ?? null, capacityOf: capOf },
    );
  });
  const overloaded = $derived(new Set(overallocations(loadRows)));
  /** Height of one resource's strip, from the total the config asks for. */
  const histoRowH = $derived(
    Math.max(16, Math.round((histoCfg?.height ?? 88) / Math.max(1, loadRows.length))),
  );
  /** Column geometry, shared by every strip: one cell per axis tick. */
  const histoCols = $derived(
    axis.ticks.map((t) => {
      const left = xOf(t.start);
      return { left, width: Math.max(1, xOf(t.end) - left) };
    }),
  );

  // --- editing --------------------------------------------------------------
  // One drag state for every gesture: moving a bar, dragging either edge,
  // sliding the progress grip, and drawing a link. They share a threshold, a
  // commit and a history entry, so a fix to any of that lands in all of them.
  // Mirrors SvGridScheduler's timeline drag, which is the same shape.
  type DragMode = "move" | "resize-start" | "resize-end" | "progress" | "link";
  type BarDrag = {
    key: string;
    bar: Bar;
    mode: DragMode;
    startX: number;
    startY: number;
    moved: boolean;
    /** Where in the bar the pointer grabbed it, in ms. */
    grabOffsetMs: number;
    durationMs: number;
    origStart: Date;
    origEnd: Date;
    origProgress: number;
    /** For a parent: every descendant's original span, shifted with it. */
    subtree: Array<{ key: string; start: Date; end: Date }>;
    /** `link` mode only. */
    fromEdge: "start" | "end";
    pointer: { x: number; y: number };
    targetKey?: string;
    targetEdge?: "start" | "end";
  };
  let drag = $state<BarDrag | null>(null);
  /** Set on release so the click that ends a drag does not also open the drawer. */
  let suppressClick = false;
  /** Keys flashed red because an edit was refused (a cycle, a duplicate link). */
  let refused = $state<Set<string>>(new Set());
  let refusedTimer: ReturnType<typeof setTimeout> | undefined;
  function refuse(keys: string[]) {
    clearTimeout(refusedTimer);
    refused = new Set(keys);
    refusedTimer = setTimeout(() => (refused = new Set()), 320);
  }

  const DRAG_THRESHOLD = 3;

  /** key -> its descendants, so moving a phase moves everything under it. */
  const descendantsOf = $derived.by(() => {
    const kids = new Map<string, string[]>();
    for (const t of tasks) {
      if (t.parentKey == null) continue;
      (kids.get(t.parentKey) ?? kids.set(t.parentKey, []).get(t.parentKey)!).push(t.key);
    }
    const out = new Map<string, string[]>();
    const walk = (k: string): string[] => {
      const hit = out.get(k);
      if (hit) return hit;
      const acc: string[] = [];
      out.set(k, acc); // guard a cycle: the partial list is already in place
      for (const c of kids.get(k) ?? []) {
        acc.push(c, ...walk(c));
      }
      return acc;
    };
    for (const t of tasks) walk(t.key);
    return out;
  });
  const taskByKey = $derived(new Map(tasks.map((t) => [t.key, t])));

  /** The day a drag snaps to. Ends land on the NEXT midnight, so a bar covers
   *  whole days either way. */
  const snapStart = (d: Date) => startOfDay(d);
  const snapEnd = (d: Date) => {
    const floor = startOfDay(d);
    return floor.getTime() === d.getTime() ? floor : addDays(floor, 1);
  };
  /** Clamp a span to `minDate` / `maxDate` without changing its length. */
  function clampSpan(start: Date, end: Date): { start: Date; end: Date } {
    const min = gantt.minDate ? startOfDay(new Date(gantt.minDate as never)) : null;
    const max = gantt.maxDate ? startOfDay(new Date(gantt.maxDate as never)) : null;
    const len = end.getTime() - start.getTime();
    let s = start;
    if (min && s.getTime() < min.getTime()) s = min;
    if (max && s.getTime() + len > max.getTime()) {
      s = new Date(Math.max(min?.getTime() ?? -Infinity, max.getTime() - len));
    }
    return { start: s, end: new Date(s.getTime() + len) };
  }

  function beginDrag(e: PointerEvent, bar: Bar, mode: DragMode, fromEdge: "start" | "end" = "end") {
    if (e.button !== 0 || !editable) return;
    // A summary bar is a rollup: it moves its subtree, but it has no edges of
    // its own to resize and no progress of its own to set.
    if (bar.kind === "summary" && mode !== "move" && mode !== "link") return;
    if (bar.kind === "milestone" && (mode === "resize-start" || mode === "resize-end" || mode === "progress")) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = false;
    const sub =
      mode === "move"
        ? (descendantsOf.get(bar.key) ?? []).flatMap((k) => {
            const t = taskByKey.get(k);
            return t ? [{ key: k, start: t.start, end: t.end }] : [];
          })
        : [];
    drag = {
      key: bar.key,
      bar,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      grabOffsetMs: Math.max(0, (dateAtClientX(e.clientX)?.getTime() ?? bar.start.getTime()) - bar.start.getTime()),
      durationMs: bar.end.getTime() - bar.start.getTime(),
      origStart: bar.start,
      origEnd: bar.end,
      origProgress: bar.progress,
      subtree: sub,
      fromEdge,
      pointer: { x: e.clientX, y: e.clientY },
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }

  function onDragMove(e: PointerEvent) {
    const d = drag;
    if (!d) return;
    if (!d.moved) {
      if (
        Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD &&
        Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD
      ) return;
      d.moved = true;
    }
    d.pointer = { x: e.clientX, y: e.clientY };

    if (d.mode === "link") {
      const hit = barAtPoint(e.clientX, e.clientY);
      d.targetKey = hit?.key;
      d.targetEdge = hit?.edge;
      return;
    }

    const at = dateAtClientX(e.clientX);
    if (!at) return;

    if (d.mode === "progress") {
      const el = barEl(d.key);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const frac = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
      // 5% steps: fine enough to mean something, coarse enough to hit.
      d.origProgress = d.origProgress; // keep the undo value
      progressOf[d.key] = Math.max(0, Math.min(100, Math.round((frac * 100) / 5) * 5));
      return;
    }

    if (d.mode === "move") {
      let ns = snapStart(new Date(at.getTime() - d.grabOffsetMs));
      if (respectWorking) ns = snapToWorkingDay(ns, 1, cal);
      const span = clampSpan(ns, new Date(ns.getTime() + d.durationMs));
      applyMove(d, span.start.getTime() - d.origStart.getTime());
      return;
    }

    if (d.mode === "resize-end") {
      const ne = snapEnd(at);
      // Never shorter than a day - a zero-width bar cannot be grabbed again.
      endOf[d.key] = new Date(Math.max(ne.getTime(), d.origStart.getTime() + MS_DAY));
      startOf[d.key] = d.origStart;
    } else {
      const ns = snapStart(at);
      startOf[d.key] = new Date(Math.min(ns.getTime(), d.origEnd.getTime() - MS_DAY));
      endOf[d.key] = d.origEnd;
    }
  }

  /** Write a move of `deltaMs` into the overlay, for the bar AND its subtree. */
  function applyMove(d: BarDrag, deltaMs: number) {
    startOf[d.key] = new Date(d.origStart.getTime() + deltaMs);
    endOf[d.key] = new Date(d.origEnd.getTime() + deltaMs);
    for (const k of d.subtree) {
      startOf[k.key] = new Date(k.start.getTime() + deltaMs);
      endOf[k.key] = new Date(k.end.getTime() + deltaMs);
    }
  }

  function onDragEnd() {
    window.removeEventListener("pointermove", onDragMove);
    const d = drag;
    drag = null;
    if (!d) return;
    if (!d.moved) {
      // A click, not a drag: leave the overlay alone so nothing moved.
      if (d.mode === "progress") delete progressOf[d.key];
      return;
    }
    suppressClick = true;

    if (d.mode === "link") {
      commitLink(d);
      return;
    }
    if (d.mode === "progress") {
      const next = progressOf[d.key] ?? d.origProgress;
      gantt.onProgressChange?.({ row: d.bar.row, progress: next });
      pushHistory({ kind: "progress", key: d.key, row: d.bar.row, before: { progress: d.origProgress }, after: { progress: next } });
      return;
    }

    const ns = startOf[d.key] ?? d.origStart;
    const ne = endOf[d.key] ?? d.origEnd;
    const subtreeAfter = d.subtree.map((k) => ({
      key: k.key,
      start: startOf[k.key] ?? k.start,
      end: endOf[k.key] ?? k.end,
    }));

    if (d.mode === "move") {
      gantt.onTaskMove?.({
        row: d.bar.row,
        start: ns,
        end: ne,
        subtree: subtreeAfter.length
          ? subtreeAfter.flatMap((k) => {
              const t = taskByKey.get(k.key);
              return t ? [{ row: t.row, start: k.start, end: k.end }] : [];
            })
          : undefined,
      });
    } else {
      gantt.onTaskResize?.({
        row: d.bar.row,
        start: ns,
        end: ne,
        edge: d.mode === "resize-start" ? "start" : "end",
      });
    }

    const moves = cascadeFrom(d.key);
    pushHistory({
      kind: d.mode === "move" ? "move" : "resize",
      key: d.key,
      row: d.bar.row,
      edge: d.mode === "resize-start" ? "start" : d.mode === "resize-end" ? "end" : undefined,
      before: { start: d.origStart, end: d.origEnd, subtree: d.subtree },
      after: { start: ns, end: ne, subtree: subtreeAfter },
      cascaded: moves,
    });
  }

  /** Cancel an active drag, restoring whatever it had written. */
  function cancelDrag() {
    const d = drag;
    if (!d) return;
    window.removeEventListener("pointermove", onDragMove);
    drag = null;
    if (d.mode === "progress") {
      if (d.origProgress != null) progressOf[d.key] = d.origProgress;
      return;
    }
    startOf[d.key] = d.origStart;
    endOf[d.key] = d.origEnd;
    for (const k of d.subtree) {
      startOf[k.key] = k.start;
      endOf[k.key] = k.end;
    }
  }

  /** The bar element for a key, for geometry the derived state does not carry.
   *  Scans rather than building a selector: a row id is the consumer's, and may
   *  hold quotes, spaces or anything else a selector would choke on. */
  function barEl(k: string): HTMLElement | null {
    if (!rootEl) return null;
    for (const el of rootEl.querySelectorAll<HTMLElement>(".sv-gantt-bar")) {
      if (el.dataset.key === k) return el;
    }
    return null;
  }
  /** Which bar (and which half of it) is under the pointer, for link drawing. */
  function barAtPoint(x: number, y: number): { key: string; edge: "start" | "end" } | undefined {
    const el = document.elementFromPoint(x, y)?.closest?.(".sv-gantt-bar") as HTMLElement | null;
    const k = el?.dataset.key;
    if (!k) return undefined;
    const r = el!.getBoundingClientRect();
    return { key: k, edge: x < r.left + r.width / 2 ? "start" : "end" };
  }

  // --- auto-reschedule -------------------------------------------------------
  const autoReschedule = $derived(gantt.autoReschedule ?? hasDeps);
  /**
   * Push successors forward so every link stays legal, writing the shifts into
   * the overlay and reporting them. Returns what moved, for the undo entry.
   */
  function cascadeFrom(_key: string): Array<{ key: string; start: Date; end: Date; before: { start: Date; end: Date } }> {
    if (!autoReschedule || !hasDeps) return [];
    const times = new Map<string, { start: Date; end: Date }>();
    for (const t of tasks) times.set(t.key, { start: t.start, end: t.end });
    const shifts = cascade(times, depList, {
      snapForward: respectWorking ? (d) => snapToWorkingDay(d, 1, cal) : undefined,
      bounds: cascadeBounds,
    });
    if (!shifts.size) return [];
    const out: Array<{ key: string; start: Date; end: Date; before: { start: Date; end: Date } }> = [];
    for (const [k, t] of shifts) {
      const was = times.get(k);
      startOf[k] = t.start;
      endOf[k] = t.end;
      if (was) out.push({ key: k, start: t.start, end: t.end, before: was });
    }
    gantt.onDependenciesChange?.(out.map((m) => ({ id: m.key, start: m.start, end: m.end })));
    return out;
  }

  // --- drawing a link --------------------------------------------------------
  function commitLink(d: BarDrag) {
    const to = d.targetKey;
    if (!to || to === d.key) return;
    const type =
      d.fromEdge === "end"
        ? d.targetEdge === "end" ? "FF" : "FS"
        : d.targetEdge === "end" ? "SF" : "SS";
    // A duplicate says nothing new; a cycle has no legal schedule at all, and
    // the cascade would have to ignore it anyway. Both flash rather than throw.
    const already = depList.some((x) => x.from === d.key && x.to === to);
    const candidate = { id: `dep-${d.key}-${to}`, from: d.key, to, type } as SchedulerDependency;
    if (already || hasCycle([...depList, candidate])) {
      refuse([d.key, to]);
      return;
    }
    gantt.onDependencyAdd?.({
      id: `dep-${d.key}-${to}-${Date.now()}`,
      from: d.key,
      to,
      type,
    });
  }

  // --- undo / redo -----------------------------------------------------------
  type SpanState = { start?: Date; end?: Date; progress?: number; subtree?: Array<{ key: string; start: Date; end: Date }> };
  type HistCmd = {
    kind: "move" | "resize" | "progress";
    key: string;
    row: TData;
    edge?: "start" | "end";
    before: SpanState;
    after: SpanState;
    cascaded?: Array<{ key: string; start: Date; end: Date; before: { start: Date; end: Date } }>;
  };
  let undoStack: HistCmd[] = [];
  let redoStack: HistCmd[] = [];
  function pushHistory(cmd: HistCmd) {
    if (!historyEnabled) return;
    undoStack.push(cmd);
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }
  /** Apply one side of a command, re-firing the callbacks so the data follows. */
  function applyState(cmd: HistCmd, s: SpanState, cascadeSide: "before" | "after") {
    if (cmd.kind === "progress") {
      if (s.progress != null) progressOf[cmd.key] = s.progress;
      gantt.onProgressChange?.({ row: cmd.row, progress: s.progress ?? 0 });
      return;
    }
    if (s.start) startOf[cmd.key] = s.start;
    if (s.end) endOf[cmd.key] = s.end;
    for (const k of s.subtree ?? []) {
      startOf[k.key] = k.start;
      endOf[k.key] = k.end;
    }
    // The cascade travelled with the edit, so it has to travel back with it.
    const moves: Array<{ id: string; start: Date; end: Date }> = [];
    for (const m of cmd.cascaded ?? []) {
      const t = cascadeSide === "after" ? { start: m.start, end: m.end } : m.before;
      startOf[m.key] = t.start;
      endOf[m.key] = t.end;
      moves.push({ id: m.key, start: t.start, end: t.end });
    }
    if (cmd.kind === "move") {
      gantt.onTaskMove?.({
        row: cmd.row,
        start: s.start!,
        end: s.end!,
        subtree: s.subtree?.flatMap((k) => {
          const t = taskByKey.get(k.key);
          return t ? [{ row: t.row, start: k.start, end: k.end }] : [];
        }),
      });
    } else {
      gantt.onTaskResize?.({ row: cmd.row, start: s.start!, end: s.end!, edge: cmd.edge ?? "end" });
    }
    if (moves.length) gantt.onDependenciesChange?.(moves);
  }
  function undo() {
    const cmd = undoStack.pop();
    if (!cmd) return;
    applyState(cmd, cmd.before, "before");
    redoStack.push(cmd);
  }
  function redo() {
    const cmd = redoStack.pop();
    if (!cmd) return;
    applyState(cmd, cmd.after, "after");
    undoStack.push(cmd);
  }
  $effect(() => {
    if (!historyEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Read the FOCUS rather than the event target: a key dispatched on the
      // window has a target that is not a Node, and `contains` throws on one.
      const active = document.activeElement as HTMLElement | null;
      // Never steal the shortcut from a field the user is typing in.
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
      ) return;
      // Only ours when the focus is inside this Gantt, or nowhere in particular.
      const mine = !active || active === document.body || !!rootEl?.contains(active);
      if (!mine) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- keyboard on a focused bar ---------------------------------------------
  function onBarKey(e: KeyboardEvent, bar: Bar) {
    if (e.key === "Escape" && drag) {
      e.preventDefault();
      cancelDrag();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDrawer(bar);
      return;
    }
    if (!editable) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!gantt.onTaskDelete) return;
      e.preventDefault();
      gantt.onTaskDelete(bar.row);
      return;
    }
    if (e.key === "+" || e.key === "-") {
      if (bar.kind !== "task") return;
      e.preventDefault();
      const next = Math.max(0, Math.min(100, Math.round(bar.progress) + (e.key === "+" ? 5 : -5)));
      progressOf[bar.key] = next;
      gantt.onProgressChange?.({ row: bar.row, progress: next });
      pushHistory({ kind: "progress", key: bar.key, row: bar.row, before: { progress: bar.progress }, after: { progress: next } });
      return;
    }
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const days = (e.shiftKey ? 7 : 1) * dir;
    const sub = (descendantsOf.get(bar.key) ?? []).flatMap((k) => {
      const t = taskByKey.get(k);
      return t ? [{ key: k, start: t.start, end: t.end }] : [];
    });
    if (e.altKey) {
      // Alt: stretch the finish instead of moving the whole bar.
      if (bar.kind !== "task") return;
      const ne = new Date(Math.max(addDays(bar.end, days).getTime(), bar.start.getTime() + MS_DAY));
      startOf[bar.key] = bar.start;
      endOf[bar.key] = ne;
      gantt.onTaskResize?.({ row: bar.row, start: bar.start, end: ne, edge: "end" });
      const moves = cascadeFrom(bar.key);
      pushHistory({ kind: "resize", key: bar.key, row: bar.row, edge: "end", before: { start: bar.start, end: bar.end }, after: { start: bar.start, end: ne }, cascaded: moves });
      return;
    }
    const span = clampSpan(addDays(bar.start, days), addDays(bar.end, days));
    const delta = span.start.getTime() - bar.start.getTime();
    const fake: BarDrag = {
      key: bar.key, bar, mode: "move", startX: 0, startY: 0, moved: true,
      grabOffsetMs: 0, durationMs: bar.end.getTime() - bar.start.getTime(),
      origStart: bar.start, origEnd: bar.end, origProgress: bar.progress,
      subtree: sub, fromEdge: "end", pointer: { x: 0, y: 0 },
    };
    applyMove(fake, delta);
    gantt.onTaskMove?.({
      row: bar.row,
      start: span.start,
      end: span.end,
      subtree: sub.length
        ? sub.flatMap((k) => {
            const t = taskByKey.get(k.key);
            return t ? [{ row: t.row, start: new Date(k.start.getTime() + delta), end: new Date(k.end.getTime() + delta) }] : [];
          })
        : undefined,
    });
    const moves = cascadeFrom(bar.key);
    pushHistory({
      kind: "move", key: bar.key, row: bar.row,
      before: { start: bar.start, end: bar.end, subtree: sub },
      after: {
        start: span.start, end: span.end,
        subtree: sub.map((k) => ({ key: k.key, start: new Date(k.start.getTime() + delta), end: new Date(k.end.getTime() + delta) })),
      },
      cascaded: moves,
    });
  }

  /** Double-clicking empty chart space creates a task on that day. */
  function onBodyDblClick(e: MouseEvent) {
    if (!editable || !gantt.onTaskAdd) return;
    if ((e.target as HTMLElement).closest(".sv-gantt-bar")) return;
    const at = dateAtClientX(e.clientX);
    if (!at) return;
    let start = startOfDay(at);
    if (respectWorking) start = snapToWorkingDay(start, 1, cal);
    // Under the pointer's row, so the new task lands in that phase.
    const body = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const i = Math.floor((e.clientY - body.top) / rowH);
    const parent = nodes[i]?.task.parentKey ?? undefined;
    gantt.onTaskAdd(start, addDays(start, 1), parent ?? undefined);
  }

  // --- the task table -------------------------------------------------------
  type TableCol = {
    id: string;
    label: string;
    width: number;
    kind: "field" | "duration" | "progress" | "slack";
    field?: string;
    numeric?: boolean;
  };
  /** Two columns a consumer can name in `tableColumns` without defining them. */
  const BUILT_IN: Record<string, TableCol> = {
    __duration: { id: "__duration", label: "Days", width: 70, kind: "duration", numeric: true },
    __progress: { id: "__progress", label: "Progress", width: 110, kind: "progress" },
    __slack: { id: "__slack", label: "Slack", width: 70, kind: "slack", numeric: true },
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
    if (col.kind === "slack") {
      // Only meaningful with the critical path on; blank rather than a
      // confident zero when it is off.
      return cpm ? String(slackDays(cpm, n.task.key)) : "";
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
  let rootEl = $state<HTMLElement | null>(null);
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
    return scale.dateAt(x);
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

  // --- the detail drawer ------------------------------------------------------
  // Built from the grid's own columns, like the scheduler's: the header becomes
  // the label and `editorType` the control, so a column set already describes
  // its edit form. Start / Finish / Progress are pinned first because they are
  // what a plan is about.
  const drawerCfg = $derived(
    typeof gantt.drawer === "object" ? gantt.drawer : undefined,
  );
  const hasDrawer = $derived(!!gantt.drawer);
  let drawerOpen = $state(false);
  let drawerBar = $state<Bar | null>(null);
  let drawerValues = $state<Record<string, unknown>>({});

  type DrawerCol = ColumnDef<TFeatures, TData> & { field: string };
  const drawerFieldCols = $derived.by<DrawerCol[]>(() => {
    const wanted = drawerCfg?.fields as ReadonlyArray<string> | undefined;
    const base = wanted?.length
      ? wanted
          .map((f) => fieldColumns.find((c) => c.field === f))
          .filter((c): c is DrawerCol => !!c)
      : (fieldColumns as DrawerCol[]);
    // The pinned date + progress rows already cover these.
    const pinned = new Set(
      [gantt.startField, gantt.endField, gantt.progressField].filter(Boolean) as string[],
    );
    return base.filter((c) => !pinned.has(c.field));
  });

  function formType(t: string | undefined): FormFieldType {
    switch (t) {
      case "number": return "number";
      case "checkbox": return "checkbox";
      case "date":
      case "date-native":
      case "datetime":
      case "datetime-native": return "date";
      case "textarea": return "textarea";
      case "color": return "color";
      case "list":
      case "select": return "select";
      default: return "text";
    }
  }
  function drawerOptions(col: DrawerCol, row: TData) {
    const raw =
      typeof col.editorOptions === "function" ? col.editorOptions(row) : col.editorOptions;
    if (!raw || !Array.isArray(raw)) return undefined;
    const opts: ReadonlyArray<string | number | { value: string | number; label?: string }> = raw;
    return opts.map((o) =>
      typeof o === "object"
        ? { value: o.value, label: String(o.label ?? o.value) }
        : { value: o, label: String(o) },
    );
  }

  const drawerFields = $derived.by<FormField[]>(() => {
    const bar = drawerBar;
    if (!bar) return [];
    const out: FormField[] = [
      { name: "__start", label: "Start", type: "date" },
      { name: "__end", label: "Finish", type: "date" },
    ];
    if (gantt.progressField) out.push({ name: "__progress", label: "Progress %", type: "number" });
    for (const col of drawerFieldCols) {
      out.push({
        name: col.field,
        label: typeof col.header === "string" ? col.header : col.field,
        type: formType(col.editorType as string | undefined),
        options: drawerOptions(col, bar.row),
      } satisfies FormField);
    }
    return out;
  });
  const drawerTitle = $derived(drawerBar?.title || "Task");

  /** `yyyy-mm-dd` for a date input, in LOCAL time (never toISOString, which
   *  shifts the day for anyone east or west of UTC). */
  function dayInput(d: Date): string {
    const p2 = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }

  function openDrawer(bar: Bar) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (!hasDrawer) return;
    const next: Record<string, unknown> = {
      __start: dayInput(bar.start),
      // The form shows the INCLUSIVE finish, which is the date on the plan.
      __end: dayInput(lastDay(bar)),
      __progress: Math.round(bar.progress),
    };
    for (const col of drawerFieldCols) next[col.field] = fieldValue(bar.row, col.field);
    drawerValues = next;
    drawerBar = bar;
    drawerOpen = true;
  }

  function saveDrawer(values: Record<string, unknown>) {
    const bar = drawerBar;
    if (!bar) return;
    drawerOpen = false;
    const patch: Record<string, unknown> = {};
    for (const col of drawerFieldCols) {
      if (values[col.field] !== undefined) patch[col.field] = values[col.field];
    }

    const ns = parseDay(values.__start as never) ?? bar.start;
    const inclusiveEnd = parseDay(values.__end as never);
    // Back from the inclusive finish the form shows to the exclusive end the
    // model uses.
    const ne = inclusiveEnd ? addDays(startOfDay(inclusiveEnd), 1) : bar.end;
    const movedDates =
      ns.getTime() !== bar.start.getTime() || ne.getTime() !== bar.end.getTime();

    if (movedDates && ne.getTime() > ns.getTime()) {
      startOf[bar.key] = ns;
      endOf[bar.key] = ne;
      if (gantt.startField) patch[gantt.startField] = ns;
      if (gantt.endField) patch[gantt.endField] = ne;
    }
    if (gantt.progressField && values.__progress != null) {
      const pc = Math.max(0, Math.min(100, Number(values.__progress) || 0));
      progressOf[bar.key] = pc;
      patch[gantt.progressField] = pc;
    }
    edits[bar.key] = { ...(edits[bar.key] ?? {}), ...patch };
    gantt.onTaskCommit?.({ row: bar.row, values: patch as Partial<TData> });
    if (movedDates) cascadeFrom(bar.key);
  }

  function deleteFromDrawer() {
    const bar = drawerBar;
    if (!bar) return;
    drawerOpen = false;
    gantt.onTaskDelete?.(bar.row);
  }

  // --- context menu (the board's dismissable-layer pattern) -------------------
  let menuOpen = $state(false);
  let menuItems = $state<MenuItem[]>([]);
  let menuPos = $state({ x: 0, y: 0 });
  let menuPanel = $state<HTMLElement | null>(null);
  function openMenu(e: MouseEvent, bar: Bar) {
    const items: MenuItem[] = [];
    if (hasDrawer) items.push({ label: "Edit", onSelect: () => openDrawer(bar) });
    if (editable && gantt.onTaskAdd) {
      items.push({
        label: "Add subtask",
        onSelect: () => gantt.onTaskAdd?.(bar.start, addDays(bar.start, 1), bar.key),
      });
    }
    if (editable && gantt.onTaskDelete) {
      items.push({ label: "Delete", onSelect: () => gantt.onTaskDelete?.(bar.row) });
    }
    const custom = gantt.taskMenu?.(bar.row);
    if (custom?.length) items.push(...custom);
    if (!items.length) return;
    e.preventDefault();
    menuItems = items;
    menuPos = { x: e.clientX, y: e.clientY };
    menuOpen = true;
  }
  $effect(() => {
    if (!menuOpen) return;
    const layer = createDismissableLayer({
      element: () => menuPanel,
      onDismiss: () => (menuOpen = false),
    });
    layer.activate();
    // A menu pinned to a point has to go when the ground moves under it.
    const offScroll = onScrollOutside(
      () => menuPanel,
      () => (menuOpen = false),
    );
    return () => {
      layer.release();
      offScroll();
    };
  });

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

<div
  class="sv-gantt"
  class:sv-gantt-editable={editable}
  bind:this={rootEl}
  style={`--gantt-row-h:${rowH}px; --gantt-bar-h:${barH}px; --gantt-table-w:${tableW}px`}
>
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
                style={`left:${xOf(pctDate(m.leftPct))}px; width:${xOf(pctDate(m.leftPct + m.widthPct)) - xOf(pctDate(m.leftPct))}px`}
              ><span>{m.label}</span></div>
            {/each}
          </div>
          <div class="sv-gantt-ticks">
            {#each axis.ticks as t (t.start.getTime())}
              <div
                class="sv-gantt-tick"
                class:sv-gantt-tick-today={t.today}
                class:sv-gantt-tick-folded={collapseOff && !isWorkingDay(t.start, cal)}
                style={`left:${xOf(t.start)}px; width:${Math.max(1, xOf(t.end) - xOf(t.start))}px`}
              ><span>{t.label}</span></div>
            {/each}
          </div>
        </div>

        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="sv-gantt-body"
          style={`width:${axisPx}px; height:${bodyH}px`}
          ondblclick={onBodyDblClick}
        >
          {#each shadeBands as band, i (i)}
            <div
              class="sv-gantt-shade"
              class:sv-gantt-gap={band.gap}
              style={`left:${band.left}px; width:${band.width}px`}
              aria-hidden="true"
            ></div>
          {/each}
          {#each axis.ticks as t (t.start.getTime())}
            <div
              class="sv-gantt-gridline"
              style={`left:${xOf(t.start)}px`}
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
                <path
                  class="sv-gantt-dep-line"
                  class:sv-gantt-dep-bad={a.bad}
                  class:sv-gantt-dep-critical={criticalArrows.has(a.id)}
                  d={a.d}
                />
                <path
                  class="sv-gantt-dep-arrow"
                  class:sv-gantt-dep-bad={a.bad}
                  class:sv-gantt-dep-critical={criticalArrows.has(a.id)}
                  d={`M${a.hx},${a.hy} l-6,-3.5 l0,7 z`}
                />
              {/each}
            </svg>
          {/if}

          {#each visibleBars as b (b.key)}
            <div class="sv-gantt-row" style={`top:${b.index * rowH}px`}>
              {#if baselineOn}
                {@const bl = baselineFor(b.node)}
                {#if bl}
                  <span
                    class="sv-gantt-baseline"
                    class:sv-gantt-baseline-late={bl.varianceDays > 0}
                    style={`left:${bl.left}px; width:${bl.width}px`}
                    title={bl.varianceDays === 0
                      ? "On the baseline"
                      : `${Math.abs(bl.varianceDays)} day${Math.abs(bl.varianceDays) === 1 ? "" : "s"} ${bl.varianceDays > 0 ? "later than" : "ahead of"} baseline`}
                  ></span>
                {/if}
              {/if}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <div
                class="sv-gantt-bar sv-gantt-bar-{b.kind}"
                class:sv-gantt-bar-done={b.progress >= 100}
                class:sv-gantt-critical={criticalKeys.has(b.key)}
                class:sv-gantt-constrained={constraintBroken.has(b.key)}
                class:sv-gantt-refused={refused.has(b.key)}
                class:sv-gantt-dragging={drag?.key === b.key && drag?.moved}
                class:sv-gantt-link-target={drag?.mode === "link" && drag?.targetKey === b.key}
                data-key={b.key}
                style={`left:${b.left}px; ${b.kind === "milestone" ? "" : `width:${b.width}px;`}${b.color ? ` --sv-gantt-accent:${b.color};` : ""}`}
                role="row"
                tabindex="0"
                aria-label={barAria(b)}
                onmouseenter={(e) => onBarEnter(e, b)}
                onmouseleave={onBarLeave}
                onpointerdown={(e) => beginDrag(e, b, "move")}
                onclick={() => openDrawer(b)}
                oncontextmenu={(e) => openMenu(e, b)}
                onkeydown={(e) => onBarKey(e, b)}
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
                {#if editable}
                  {#if b.kind === "task"}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-gantt-grip sv-gantt-grip-l"
                      onpointerdown={(e) => beginDrag(e, b, "resize-start")}
                    ></span>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-gantt-grip sv-gantt-grip-r"
                      onpointerdown={(e) => beginDrag(e, b, "resize-end")}
                    ></span>
                    <!-- The progress handle rides the fill's leading edge. -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-gantt-grip-p"
                      style={`left:${Math.max(0, Math.min(100, b.progress))}%`}
                      title="Drag to set progress"
                      onpointerdown={(e) => beginDrag(e, b, "progress")}
                    ></span>
                  {/if}
                {/if}
              </div>
              {#if editable}
                <!-- The link handles sit OUTSIDE the bar, so they cannot live
                     inside it: the bar clips its children to ellipsis its
                     label, which would clip these away entirely. -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                  class="sv-gantt-link-dot"
                  style={`left:${b.left - (b.kind === "milestone" ? barH / 2 : 0) - 13}px`}
                  title="Drag to link from the start"
                  onpointerdown={(e) => beginDrag(e, b, "link", "start")}
                ></span>
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                  class="sv-gantt-link-dot"
                  style={`left:${b.left + (b.kind === "milestone" ? barH / 2 : b.width) + 3}px`}
                  title="Drag to link from the finish"
                  onpointerdown={(e) => beginDrag(e, b, "link", "end")}
                ></span>
              {/if}
              {#if constraintOn}
                {@const c = constraintOf(b.row)}
                {#if c}
                  <span
                    class="sv-gantt-constraint"
                    class:sv-gantt-constraint-broken={constraintBroken.has(b.key)}
                    style={`left:${b.left - 14}px`}
                    title={`${c.kind} ${fmtDay(c.date)}`}
                    aria-hidden="true"
                  >{CONSTRAINT_GLYPH[c.kind] ?? "\u25C6"}</span>
                {/if}
              {/if}
              {#if !gantt.task && labelOutside(b)}
                <span
                  class="sv-gantt-label"
                  style={`left:${b.left + (b.kind === "milestone" ? 12 : b.width) + 8}px`}
                >{b.title}</span>
              {/if}
            </div>
          {/each}

          {#if drag?.mode === "link" && drag.moved}
            {@const from = barRects.get(drag.key)}
            {#if from}
              {@const ox = scrollEl?.getBoundingClientRect().left ?? 0}
              {@const oy = scrollEl?.getBoundingClientRect().top ?? 0}
              <svg class="sv-gantt-linking" width={axisPx} height={bodyH} aria-hidden="true">
                <path
                  d={`M${drag.fromEdge === "end" ? from.right : from.left},${from.midY} L${
                    drag.pointer.x - ox + (scrollEl?.scrollLeft ?? 0) - (showTable ? tableW : 0)
                  },${drag.pointer.y - oy + (scrollEl?.scrollTop ?? 0) - axisHeadH}`}
                />
              </svg>
            {/if}
          {/if}

          {#if todayX != null}
            <div class="sv-gantt-today" style={`left:${todayX}px`} aria-hidden="true"></div>
          {/if}
        </div>

        {#if histoOn && loadRows.length}
          <!-- Resource load. Sticks to the bottom of the scroller so it stays
               in view down a long plan, and shares the chart's x scale so a
               spike sits under the week that caused it. -->
          <div class="sv-gantt-histo" style={`width:${axisPx}px`}>
            {#each loadRows as r (r.id)}
              {@const top = Math.max(r.peak, r.capacity)}
              <div
                class="sv-gantt-histo-row"
                class:sv-gantt-histo-over={overloaded.has(r.id)}
                style={`height:${histoRowH}px`}
              >
                <span class="sv-gantt-histo-label">
                  {r.label}
                  <small>peak {r.peak} / {r.capacity}</small>
                </span>
                {#each r.cells as c, i (i)}
                  {#if c.load > 0}
                    <div
                      class="sv-gantt-histo-cell"
                      class:sv-gantt-histo-cell-over={c.over}
                      style={`left:${histoCols[i]?.left ?? 0}px; width:${histoCols[i]?.width ?? 0}px; height:${Math.round((c.load / top) * (histoRowH - 4))}px`}
                      title={`${r.label}: ${c.load} of ${r.capacity}`}
                    ></div>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

{#if menuOpen}
  <div
    bind:this={menuPanel}
    class="sv-gantt-menu"
    use:portalToBody
    use:popIn={{}}
    style:position="fixed"
    style:top={`${menuPos.y}px`}
    style:left={`${menuPos.x}px`}
    aria-label="Task actions"
  >
    <SvMenuList
      items={menuItems}
      onclose={() => (menuOpen = false)}
      onselect={() => (menuOpen = false)}
    />
  </div>
{/if}

{#if hasDrawer}
  <SvDrawer
    bind:open={drawerOpen}
    title={drawerTitle}
    side={drawerCfg?.side ?? "right"}
    size={drawerCfg?.size ?? "360px"}
    onClosed={() => (drawerBar = null)}
  >
    <SvForm
      fields={drawerFields}
      values={drawerValues}
      columns={drawerCfg?.columns ?? 1}
      submitLabel={drawerCfg?.submitLabel ?? "Save"}
      cancelLabel="Cancel"
      onSubmit={saveDrawer}
      onCancel={() => (drawerOpen = false)}
      onChange={(v) => (drawerValues = v)}
    />
    {#if gantt.onTaskDelete}
      <button type="button" class="sv-gantt-delete" onclick={deleteFromDrawer}>
        Delete task
      </button>
    {/if}
  </SvDrawer>
{/if}

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
      {#if resourceField && resourceOf(tipBar.row)}
        <div class="sv-gantt-tooltip-meta">{resourceOf(tipBar.row)}</div>
      {/if}
      {#if cpm}
        <div class="sv-gantt-tooltip-meta">
          {criticalKeys.has(tipBar.key)
            ? "On the critical path"
            : `${slackDays(cpm, tipBar.key)} days of slack`}
        </div>
      {/if}
      {#if baselineOn}
        {@const bl = baselineFor(tipBar.node)}
        {#if bl && bl.varianceDays !== 0}
          <div class="sv-gantt-tooltip-meta">
            {Math.abs(bl.varianceDays)} day{Math.abs(bl.varianceDays) === 1 ? "" : "s"}
            {bl.varianceDays > 0 ? "later than" : "ahead of"} baseline
          </div>
        {/if}
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
  /* A folded day keeps its column so the header still tiles the chart, but it
     is only a few pixels wide - a squeezed date would read as noise. */
  .sv-gantt-tick-folded > span { display: none; }

  .sv-gantt-body { position: relative; }

  /* --- resource load strip (Pro) --- */
  .sv-gantt-histo {
    position: sticky;
    bottom: 0;
    z-index: 4;
    background: var(--sg-bg, #fff);
    border-top: 1px solid var(--sg-border, #e5e7eb);
  }
  .sv-gantt-histo-row {
    position: relative;
    border-bottom: 1px solid color-mix(in srgb, var(--sg-border, #e5e7eb) 45%, transparent);
  }
  .sv-gantt-histo-row:last-child { border-bottom: 0; }
  /* The label rides the left edge, the way the month caption does, so it is
     readable wherever the chart is scrolled to. */
  .sv-gantt-histo-label {
    position: sticky;
    left: calc(var(--gantt-table-w, 0px) + 8px);
    z-index: 1;
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 1px 6px;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--sg-fg, #374151);
    background: color-mix(in srgb, var(--sg-bg, #fff) 82%, transparent);
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
  }
  .sv-gantt-histo-label small { font-weight: 400; color: var(--sg-muted, #6b7280); }
  .sv-gantt-histo-over .sv-gantt-histo-label { color: #b91c1c; }
  /* Deliberately NOT the theme accent: red has to be the only red in the
     strip, or an over-allocation stops standing out on a warm theme. */
  .sv-gantt-histo-cell {
    position: absolute;
    bottom: 0;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 26%, transparent);
    border-radius: 2px 2px 0 0;
  }
  .sv-gantt-histo-cell-over {
    background: color-mix(in srgb, #dc2626 70%, transparent);
  }
  .sv-gantt-shade {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 4%, transparent);
    pointer-events: none;
  }
  /* The marker left where a weekend was folded out: a hatch, so the break in
     the timeline is visible rather than a silently missing two days. */
  .sv-gantt-gap {
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--sg-fg, #1f2937) 9%, transparent) 0 2px,
      transparent 2px 5px
    );
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


  /* ---- editing: grips, link handles, refusal ---- */
  .sv-gantt-editable .sv-gantt-bar-task,
  .sv-gantt-editable .sv-gantt-bar-summary,
  .sv-gantt-editable .sv-gantt-bar-milestone { cursor: grab; }
  .sv-gantt-bar.sv-gantt-dragging { cursor: grabbing; opacity: 0.85; }

  /* Edge grips. Revealed on hover so a read-only glance stays clean, and wide
     enough (7px) to hit without zooming in. */
  .sv-gantt-grip {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 7px;
    cursor: ew-resize;
    opacity: 0;
    z-index: 2;
  }
  .sv-gantt-grip-l { left: 0; }
  .sv-gantt-grip-r { right: 0; }
  .sv-gantt-bar:hover .sv-gantt-grip,
  .sv-gantt-bar:focus-visible .sv-gantt-grip { opacity: 1; }
  .sv-gantt-grip::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2px;
    height: 10px;
    transform: translate(-50%, -50%);
    border-radius: 1px;
    background: color-mix(in srgb, #fff 75%, transparent);
  }

  /* The progress handle rides the leading edge of the fill. */
  .sv-gantt-grip-p {
    position: absolute;
    top: 50%;
    width: 11px;
    height: 11px;
    margin-left: -5.5px;
    transform: translateY(-50%) rotate(45deg);
    background: var(--sg-bg, #fff);
    border: 1.5px solid color-mix(in srgb, #000 35%, transparent);
    border-radius: 2px;
    cursor: ew-resize;
    opacity: 0;
    z-index: 3;
  }
  .sv-gantt-bar:hover .sv-gantt-grip-p,
  .sv-gantt-bar:focus-visible .sv-gantt-grip-p { opacity: 1; }

  /* Link handles sit just OUTSIDE each end, so grabbing one is never mistaken
     for grabbing the bar. */
  .sv-gantt-link-dot {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    transform: translateY(-50%);
    border-radius: 50%;
    background: var(--sg-bg, #fff);
    border: 2px solid var(--sg-accent, #4f46e5);
    cursor: crosshair;
    opacity: 0;
    z-index: 4;
  }
  /* Revealed by hovering the ROW, since the handles are its children rather
     than the bar's - see the note in the markup. */
  .sv-gantt-row:hover .sv-gantt-link-dot,
  .sv-gantt-row:focus-within .sv-gantt-link-dot { opacity: 1; }
  .sv-gantt-bar.sv-gantt-link-target {
    outline: 2px solid var(--sv-gantt-accent, var(--sg-accent, #4f46e5));
    outline-offset: 2px;
  }

  /* The rubber band while a link is being drawn. */
  .sv-gantt-linking {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    overflow: visible;
    z-index: 4;
  }
  .sv-gantt-linking path {
    fill: none;
    stroke: var(--sv-gantt-accent, var(--sg-accent, #4f46e5));
    stroke-width: 2;
    stroke-dasharray: 4 3;
  }

  /* A refused edit (a cycle, or a link that already exists) flashes rather
     than throwing: the gesture was understood, the result is not legal. */
  .sv-gantt-refused {
    animation: sv-gantt-refuse 0.32s ease;
    outline: 2px solid var(--sv-gantt-dep-bad, #dc2626);
    outline-offset: 2px;
  }
  @keyframes sv-gantt-refuse {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-gantt-refused { animation: none; }
  }

  /* ---- Gantt Pro: critical path, baselines, constraints ---- */
  /* Critical bars keep their own colour and gain a ring, so the plan does not
     lose its phase colouring the moment the path is turned on. */
  .sv-gantt-bar.sv-gantt-critical {
    box-shadow: 0 0 0 2px var(--sv-gantt-critical, #dc2626);
  }
  .sv-gantt-bar-summary.sv-gantt-critical { box-shadow: 0 0 0 1.5px var(--sv-gantt-critical, #dc2626); }
  .sv-gantt-dep-line.sv-gantt-dep-critical,
  .sv-gantt-dep-arrow.sv-gantt-dep-critical {
    stroke: var(--sv-gantt-critical, #dc2626);
    fill: var(--sv-gantt-critical, #dc2626);
  }
  .sv-gantt-dep-line.sv-gantt-dep-critical { stroke-width: 2; }

  /* The baseline: a thin ghost under the bar, so drift reads as the gap
     between the two rather than as a second bar competing with it. */
  .sv-gantt-baseline {
    position: absolute;
    top: calc((var(--gantt-row-h) - var(--gantt-bar-h)) / 2 + var(--gantt-bar-h) - 1px);
    height: 5px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 28%, transparent);
    pointer-events: none;
  }
  .sv-gantt-baseline.sv-gantt-baseline-late {
    background: color-mix(in srgb, var(--sv-gantt-dep-bad, #dc2626) 45%, transparent);
  }

  /* A constraint marker sits just before the bar it pins. */
  .sv-gantt-constraint {
    position: absolute;
    top: 0;
    height: var(--gantt-row-h);
    display: flex;
    align-items: center;
    font-size: 0.68rem;
    line-height: 1;
    color: var(--sg-muted, #6b7280);
    pointer-events: none;
  }
  .sv-gantt-constraint-broken { color: var(--sv-gantt-dep-bad, #dc2626); font-weight: 700; }
  /* A bar whose own dates break its constraint. The cascade stops at the cap
     rather than overrunning it, so this is a state to read, not an error. */
  .sv-gantt-bar.sv-gantt-constrained {
    outline: 1.5px dashed var(--sv-gantt-dep-bad, #dc2626);
    outline-offset: 1px;
  }

  /* ---- context menu + drawer ---- */
  .sv-gantt-menu { z-index: 2147483001; }
  .sv-gantt-delete {
    margin-top: 12px;
    width: 100%;
    padding: 7px 10px;
    border: 1px solid color-mix(in srgb, var(--sv-gantt-dep-bad, #dc2626) 45%, transparent);
    border-radius: 6px;
    background: transparent;
    color: var(--sv-gantt-dep-bad, #dc2626);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .sv-gantt-delete:hover {
    background: color-mix(in srgb, var(--sv-gantt-dep-bad, #dc2626) 10%, transparent);
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
