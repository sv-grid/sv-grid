<script
  lang="ts"
  generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData"
>
  // Calendar / scheduler renderer for SvGrid. Rendered in place of the table
  // when the `scheduler` prop is set. Like the Kanban board (SvGridBoard) it is
  // a pure *view of the grid*:
  //   - reads the grid's already filtered + sorted rows
  //   - resolves them into events for the visible window (recurring rows are
  //     expanded via the shared recurrence engine)
  //   - renders Month / Week / Day / Agenda, optionally splitting Day into
  //     per-resource columns
  //   - drag-to-move + edge-resize are computed and applied here as a per-row
  //     overlay keyed by row id, so consumers write no move code; `onEventMove`
  //     / `onEventResize` fire purely as notifications for persistence.
  // Themes entirely from the grid's `--sg-*` tokens; the model math lives in
  // ./scheduler-model (pure + unit-tested).
  import { untrack } from "svelte";
  import type {
    ColumnDef,
    RowData,
    TableFeatures,
    SchedulerConfig,
    SchedulerEventMoveEvent,
    SchedulerEventResizeEvent,
    SchedulerView,
    SchedulerResource,
    MenuItem,
    FormField,
    FormFieldType,
    EventSpec,
    ResolvedEvent,
    RecurrenceRule,
  } from "@svgrid/grid";
  import {
    startOfDay,
    startOfMonth,
    addDays,
    monthMatrix,
    weekdayOrder,
    isSameDay,
    snapMinute,
    toDate,
    resolveEvents,
    eventsOnDay,
    layoutDayEvents,
    monthWeekSegments,
    agendaGroups,
    rangeForView,
    daysForView,
    navigateAnchor,
    timelineAxis,
    timelineGeom,
    timelineRows,
    hasConflict,
    overlapCount,
    overlapsBands,
    workingIntervals,
    withinWorking,
    normalizeTimeZone,
    toZonedLocal,
    fromZonedLocal,
    zoneAbbr,
    zoneParts,
    instantFromWallClock,
    SvMenuList,
    SvForm,
    SvDrawer,
    SvDateTimePicker,
    SvCheckBox,
    SvNumberInput,
    SvDropDownList,
    portalToBody,
    popIn,
    createDismissableLayer,
    onScrollOutside,
    type TimelineAxis,
  } from "@svgrid/grid";
  // Scheduler Pro feature models (this package).
  import { cascade, violations, type SchedulerDependency } from "./scheduler-dependencies";
  import { expandAssignments, resourceLoad, type SchedulerAssignment } from "./scheduler-assignments";
  import { columnSummaries } from "./scheduler-summary";
  import { buildAxis, timeToX, xToTime, resolveZoom, zoomPresets, type Axis, type ZoomLevel } from "./scheduler-axis";
  import { buildResourceRows, visibleResourceIds, type ResourceRow } from "./scheduler-resource-tree";
  import { heatCells, heatPeak, type HeatCell } from "./scheduler-heatmap";
  import { respectsBuffer, withinDurationBounds, afterLead, type BusyEvent } from "./scheduler-booking";
  import { availableSlots, type Slot, type Interval as SlotInterval } from "./scheduler-slots";
  import type { SchedulerProConfig } from "./scheduler-config";

  let {
    data,
    columns,
    scheduler,
    getRowId,
  }: {
    data: ReadonlyArray<TData>;
    columns: Array<ColumnDef<TFeatures, TData>>;
    scheduler: SchedulerConfig<TFeatures, TData>;
    getRowId?: (row: TData, index: number) => string;
  } = $props();

  // --- config with defaults ---
  const views = $derived(scheduler.views ?? (["month", "week", "day", "agenda"] as SchedulerView[]));
  const weekStartsOn = $derived(scheduler.weekStartsOn ?? 0);
  // Slot size: config default, optionally overridden at runtime by the ruler
  // slot-size picker (`slotSizes`). Snap granularity + ruler subdivision.
  let slotOverride = $state<number | null>(null);
  const slotMinutes = $derived(Math.max(5, slotOverride ?? scheduler.slotMinutes ?? 30));
  const slotSizes = $derived(scheduler.slotSizes ?? []);
  const dayStartHour = $derived(scheduler.dayStartHour ?? 0);
  const dayEndHour = $derived(scheduler.dayEndHour ?? 24);
  const agendaDays = $derived(scheduler.agendaDays ?? 30);
  const editable = $derived(scheduler.editable === true);
  const resourceField = $derived(scheduler.resourceField);
  const collisionMode = $derived(scheduler.collisionMode ?? "split");
  const maxColumns = $derived(scheduler.maxColumns ?? 3);

  // svelte-ignore state_referenced_locally
  let view = $state<SchedulerView>(scheduler.initialView ?? "month");

  // --- time zone -----------------------------------------------------------
  // The calendar runs in "pseudo-local" time: every absolute instant is shifted
  // so its LOCAL wall-clock equals its wall-clock in `timeZone`, letting all the
  // existing local date math position it in that zone. `toZ` does that at the
  // read boundary (row field -> Date); `fromZ` reverses it when emitting a user
  // edit back to the consumer (which stores a real instant).
  const tz = $derived(normalizeTimeZone(scheduler.timeZone));
  const toZ = (v: unknown): Date | undefined => {
    const d = toDate(v as never);
    return d ? toZonedLocal(d, tz) : undefined;
  };
  const fromZ = (d: Date): Date => fromZonedLocal(d, tz);
  // Emit boundary: user edits are computed in pseudo-local time; convert their
  // start/end back to real instants before handing them to consumer callbacks.
  type MoveEv = Parameters<NonNullable<typeof scheduler.onEventMove>>[0];
  type ResizeEv = Parameters<NonNullable<typeof scheduler.onEventResize>>[0];
  type RangeArg = Parameters<NonNullable<typeof scheduler.onRangeSelect>>[0];
  function emitMove(e: MoveEv) {
    scheduler.onEventMove?.({ ...e, start: fromZ(e.start), end: fromZ(e.end) });
  }
  function emitResize(e: ResizeEv) {
    scheduler.onEventResize?.({ ...e, start: fromZ(e.start), end: fromZ(e.end) });
  }
  function emitRange(sel: RangeArg) {
    scheduler.onRangeSelect?.({ ...sel, start: fromZ(sel.start), end: fromZ(sel.end), days: sel.days.map(fromZ) });
  }
  function emitAdd(start: Date, end: Date, resourceId?: string, allDay?: boolean) {
    scheduler.onEventAdd?.(fromZ(start), fromZ(end), resourceId, allDay);
  }

  // --- recurring-occurrence editing ("This event" vs "All events") ---------
  // When a recurrenceExceptionsField + onOccurrenceChange are set, editing one
  // occurrence of a series asks which scope to apply. Otherwise edits fall back
  // to the whole series (backward compatible).
  const hasExceptions = $derived(!!scheduler.recurrenceExceptionsField && !!scheduler.onOccurrenceChange);
  let recurScope = $state<{ x: number; y: number; title: string; kind: "edit" | "delete"; occurrence: () => void; following?: () => void; series: () => void } | null>(null);
  function askRecurScope(x: number, y: number, ev: ResolvedEvent<TData>, kind: "edit" | "delete", occurrence: () => void, series: () => void, following?: () => void) {
    if (!hasExceptions || !ev.occurrenceStart) { series(); return; }
    // Keep the popover fully on-screen (a drop near the viewport edge would push
    // its buttons off the bottom / right).
    const cx = Math.max(6, Math.min(x, window.innerWidth - 184));
    const cy = Math.max(6, Math.min(y, window.innerHeight - (following ? 146 : 118)));
    recurScope = { x: cx, y: cy, title: ev.title, kind, occurrence, following, series };
  }
  // Emit a per-occurrence override as a real instant (converts out of pseudo-local).
  // `scope` = 'occurrence' (merge into the row) or 'following' (split the series).
  function emitOccurrence(ev: ResolvedEvent<TData>, opts: { start?: Date; end?: Date; deleted?: boolean; title?: string; allDay?: boolean; fields?: Record<string, unknown> }, scope: "occurrence" | "following" = "occurrence") {
    if (!ev.occurrenceStart) return;
    const occ = fromZ(ev.occurrenceStart);
    scheduler.onOccurrenceChange?.({
      row: ev.row,
      occurrenceStart: occ,
      scope,
      exception: {
        occurrenceStart: occ,
        ...(opts.deleted ? { deleted: true } : {}),
        ...(opts.start ? { start: fromZ(opts.start) } : {}),
        ...(opts.end ? { end: fromZ(opts.end) } : {}),
        ...(opts.title != null ? { title: opts.title } : {}),
        ...(opts.allDay != null ? { allDay: opts.allDay } : {}),
        ...(opts.fields && Object.keys(opts.fields).length ? { fields: opts.fields } : {}),
      },
    });
  }

  // Component context: the arg-less `new Date()` is fine here (runtime), unlike
  // the pure model. Default the anchor to today, at the zone's midnight.
  // svelte-ignore state_referenced_locally
  let anchor = $state<Date>(startOfDay(toZonedLocal(toDate(scheduler.initialDate) ?? new Date(), normalizeTimeZone(scheduler.timeZone))));

  // --- value access + stable per-row key (mirrors SvGridBoard) ---
  const indexOf = $derived(new Map<TData, number>(data.map((r, i) => [r, i])));
  const synthetic = new WeakMap<object, string>();
  let synthSeq = 0;
  function key(row: TData): string {
    if (getRowId) return getRowId(row, indexOf.get(row) ?? 0);
    const obj = row as unknown as object;
    let id = synthetic.get(obj);
    if (!id) {
      id = `__s${++synthSeq}`;
      synthetic.set(obj, id);
    }
    return id;
  }
  function fieldValue(row: TData, field: string): unknown {
    const e = edits[key(row)];
    if (e && field in e) return e[field];
    return (row as Record<string, unknown>)[field];
  }

  // --- the move / edit overlay: never mutates the consumer's rows ---
  let startOfE = $state<Record<string, Date>>({});
  let endOfE = $state<Record<string, Date>>({});
  let resourceOfE = $state<Record<string, string>>({});
  let allDayOf = $state<Record<string, boolean>>({});
  let edits = $state<Record<string, Record<string, unknown>>>({});

  // --- columns lookup + default title field ---
  const fieldColumns = $derived(columns.filter((c) => typeof c.field === "string"));
  const titleField = $derived(
    scheduler.titleField ?? (fieldColumns[0]?.field as string | undefined),
  );
  function headerLabel(field: string): string {
    const col = fieldColumns.find((c) => c.field === field);
    return col && typeof col.header === "string" ? col.header : field;
  }

  // --- build the event spec from config + overlay, then resolve for the window ---
  const spec = $derived.by<EventSpec<TData>>(() => {
    void tz; // re-resolve events (their positions) when the display zone changes
    return {
    getKey: (r) => key(r),
    getStart: (r) => startOfE[key(r)] ?? (toZ(fieldValue(r, scheduler.startField)) as never),
    getEnd: (r) =>
      endOfE[key(r)] ??
      (scheduler.endField ? (toZ(fieldValue(r, scheduler.endField)) as never) : undefined),
    getAllDay: (r) =>
      allDayOf[key(r)] ?? (scheduler.allDayField ? !!fieldValue(r, scheduler.allDayField) : false),
    getTitle: (r) => (titleField ? String(fieldValue(r, titleField) ?? "") : ""),
    getColor: (r) =>
      scheduler.colorField
        ? (fieldValue(r, scheduler.colorField) as string | undefined)
        : calendarColorOf(r) ?? scheduler.color,
    getSecondaryColor: (r) =>
      scheduler.secondaryColorField
        ? (fieldValue(r, scheduler.secondaryColorField) as string | undefined)
        : undefined,
    getStatus: (r) =>
      scheduler.statusField
        ? (fieldValue(r, scheduler.statusField) as string | undefined)
        : undefined,
    getResource: (r) =>
      resourceOfE[key(r)] ??
      (resourceField ? (fieldValue(r, resourceField) as string | undefined) : undefined),
    getRecurrence: (r) =>
      recurEnabled ? (fieldValue(r, recurField) as never) : undefined,
    getExceptions: (r) => {
      const f = scheduler.recurrenceExceptionsField;
      if (!f) return undefined;
      const arr = fieldValue(r, f) as ReadonlyArray<{ occurrenceStart: unknown; deleted?: boolean; start?: unknown; end?: unknown; title?: string; allDay?: boolean; fields?: Record<string, unknown> }> | undefined;
      return arr?.map((e) => ({
        occurrenceStart: toZ(e.occurrenceStart) ?? new Date(NaN),
        deleted: e.deleted,
        start: e.start != null ? toZ(e.start) : undefined,
        end: e.end != null ? toZ(e.end) : undefined,
        title: e.title,
        allDay: e.allDay,
        fields: e.fields,
      }));
    },
    defaultDurationMin: scheduler.defaultDurationMin ?? 60,
    };
  });
  // Recurrence works when a `recurrenceField` is set OR the drawer is on (so any
  // event can be made recurring from the drawer). Falls back to a default field
  // name to store the rule when the consumer didn't name one.
  const recurEnabled = $derived(!!scheduler.recurrenceField || !!scheduler.drawer);
  const recurField = $derived(scheduler.recurrenceField ?? "recurrence");

  const range = $derived(rangeForView(view, anchor, weekStartsOn, agendaDays));
  const events = $derived(resolveEvents(data, spec, range.start, range.end));

  // --- resources: full list (for the legend/grouping) derived from config or
  // the data. `hiddenResources` is a per-view filter applied to `viewEvents`. ---
  const resources = $derived.by<SchedulerResource[]>(() => {
    if (!resourceField) return [];
    if (scheduler.resources?.length) return [...scheduler.resources];
    const seen = new Set<string>();
    const out: SchedulerResource[] = [];
    for (const e of events) {
      const id = e.resourceId ?? "";
      if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, title: id || "(none)" });
      }
    }
    return out;
  });
  let hiddenResources = $state<Set<string>>(new Set());
  // --- Scheduler Pro config ---------------------------------------------------
  // The renderer receives config untyped (registered as Component<any>); read the
  // Pro fields through a cast so the free grid's SchedulerConfig stays unchanged.
  // Declared here rather than beside the dependency code further down: half the
  // derivations below read it, and a `const` used above its declaration is a type
  // error even though `$derived` is lazy enough to work at runtime.
  const pcfg = $derived(scheduler as unknown as SchedulerProConfig<TFeatures, TData>);
  // --- multi-calendar overlay ---
  const calendars = $derived(pcfg.calendars ?? []);
  const calField = $derived(pcfg.calendarField);
  const calById = $derived(new Map(calendars.map((c) => [c.id, c])));
  const calendarColorOf = (r: TData): string | undefined =>
    calField ? calById.get(String(fieldValue(r, calField as string) ?? ""))?.color : undefined;
  // Seed hidden calendars from any `hidden: true` in the config (once).
  let hiddenCalendars = $state<Set<string>>(new Set());
  let calSeeded = false;
  $effect(() => {
    if (calSeeded || !calendars.length) return;
    calSeeded = true;
    const init = calendars.filter((c) => c.hidden).map((c) => c.id);
    if (init.length) hiddenCalendars = new Set(init);
  });
  function toggleCalendar(id: string) {
    const next = new Set(hiddenCalendars);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    hiddenCalendars = next;
  }
  // The events actually rendered: `events` minus filtered-out resources / calendars.
  // Used by EVERY view so the filters work everywhere.
  const viewEvents = $derived.by(() => {
    let out = events;
    if (resourceField && hiddenResources.size) out = out.filter((e) => !hiddenResources.has(e.resourceId ?? ""));
    if (calField && hiddenCalendars.size) out = out.filter((e) => !hiddenCalendars.has(String(fieldValue(e.row, calField as string) ?? "")));
    return out;
  });
  function toggleResource(id: string) {
    const next = new Set(hiddenResources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    hiddenResources = next;
  }

  // Resource grouping applies to the time-grid (Week / Day) views.
  const resourcesEnabled = $derived(!!resourceField && (view === "day" || view === "week"));
  const groupByDate = $derived(scheduler.groupByDate === true);

  // --- timeline views (horizontal: time left→right, resources as rows) ---
  const isTimeline = $derived(view.startsWith("timeline"));
  const tlLaneH = $derived(scheduler.timelineLaneHeight ?? 26);
  const tlResW = $derived(scheduler.resourceAreaWidth ?? 160);
  const tlSlot = $derived(Math.max(1, scheduler.timelineSlotMinutes ?? slotMinutes));
  const tlAxis = $derived(
    axisPro
      ? proTimelineAxis()
      : timelineAxis(view, range.start, range.end, {
          dayStartHour,
          dayEndHour,
          today: startOfDay(toZonedLocal(new Date(), tz)),
        }),
  );
  // One tick is at least this wide; the axis scrolls horizontally past it. A
  // `timelineTickMinWidth` config widens it (room for narrow sub-day event labels).
  const TL_TICK_MIN = $derived(
    ((scheduler as SchedulerProConfig<TFeatures, TData>).timelineTickMinWidth ?? 0) > 0
      ? (scheduler as SchedulerProConfig<TFeatures, TData>).timelineTickMinWidth!
      : view === "timelineMonth" ? 42 : view === "timelineDay" ? 68 : view === "timelineYear" ? 80 : 96,
  );
  // Measured width of the timeline scroller, so the axis can STRETCH to fill it
  // (week / year) yet still scroll when the ticks genuinely overflow (month).
  let tlOuterW = $state(0);
  const tlAxisWidth = $derived(
    axisPro && proAxisData
      ? Math.max(proAxisData.axis.totalPx, tlOuterW ? tlOuterW - tlResW : 0, 320)
      : Math.max(tlAxis.ticks.length * TL_TICK_MIN, tlOuterW ? tlOuterW - tlResW : 0, 320),
  );
  const tlRows = $derived(
    timelineRows(
      resourceField ? (visibleResIds ? resources.filter((r) => visibleResIds.has(r.id)) : resources) : null,
      tlEventsForRows,
    ),
  );

  // --- Grouped / tree resources (timeline) ----------------------------------
  const GROUP_ROW_H = 30;
  const hasGroups = $derived(isTimeline && !!resourceField && !!(pcfg.resourceGroups && pcfg.resourceGroups.length));
  let collapsedGroups = $state<Set<string>>(new Set());
  $effect(() => {
    const k = pcfg.groupPersistKey;
    if (!k) return;
    try {
      const s = localStorage.getItem(k);
      if (s) collapsedGroups = new Set(JSON.parse(s) as string[]);
    } catch { /* ignore */ }
  });
  function toggleGroup(id: string) {
    const next = new Set(collapsedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedGroups = next;
    const k = pcfg.groupPersistKey;
    if (k) try { localStorage.setItem(k, JSON.stringify([...next])); } catch { /* ignore */ }
  }
  const treeRows = $derived(
    hasGroups ? buildResourceRows(resources, pcfg.resourceGroups!, pcfg.resourceGroupOf ?? (() => undefined), collapsedGroups) : [],
  );
  const visibleResIds = $derived(hasGroups ? new Set(visibleResourceIds(treeRows)) : null);
  // The unified list the timeline body iterates: group-header rows interleaved
  // with resource rows (each carrying its lane-packed tlRow + its tlRows index).
  type TlPacked = (typeof tlRows)[number];
  type TlRenderRow =
    | { kind: "group"; group: ResourceRow<SchedulerResource>; row: null; ri: -1; depth: number }
    | { kind: "resource"; group: null; row: TlPacked; ri: number; depth: number };
  const tlRenderRows = $derived.by<TlRenderRow[]>(() => {
    if (!hasGroups) return tlRows.map((row, ri) => ({ kind: "resource", group: null, row, ri, depth: 0 }));
    const byId = new Map(tlRows.map((r, ri) => [r.resource?.id ?? "", { r, ri }]));
    const out: TlRenderRow[] = [];
    for (const tr of treeRows) {
      if (tr.kind === "group") out.push({ kind: "group", group: tr as ResourceRow<SchedulerResource>, row: null, ri: -1, depth: tr.depth });
      else {
        const hit = byId.get(tr.id);
        if (hit) out.push({ kind: "resource", group: null, row: hit.r, ri: hit.ri, depth: tr.depth });
      }
    }
    return out;
  });

  // Resolve dependency links from the flat list + any per-row `dependencyField`.
  const depList = $derived.by<SchedulerDependency[]>(() => {
    const out: SchedulerDependency[] = [];
    if (pcfg.dependencies) out.push(...pcfg.dependencies);
    const f = pcfg.dependencyField;
    if (f) {
      for (const row of data) {
        const raw = fieldValue(row, f);
        if (!Array.isArray(raw)) continue;
        const fromKey = key(row);
        for (const d of raw) {
          if (typeof d === "string") out.push({ id: `${fromKey}->${d}`, from: fromKey, to: d });
          else if (d && typeof d === "object" && "to" in d) {
            const o = d as { id?: string; from?: string; to: string; type?: SchedulerDependency["type"]; lag?: number };
            out.push({ id: o.id ?? `${o.from ?? fromKey}->${o.to}`, from: o.from ?? fromKey, to: o.to, type: o.type, lag: o.lag });
          }
        }
      }
    }
    return out;
  });
  const hasDeps = $derived(depList.length > 0);
  const autoReschedule = $derived(hasDeps && pcfg.autoReschedule !== false);
  // Optional working-time snap when cascading: push a start that lands before the
  // business-hours window forward to its opening (a light, business-hours-only
  // version of the model's `snapForward` hook).
  const depSnapForward = $derived.by<((s: Date) => Date) | undefined>(() => {
    const bh = scheduler.businessHours;
    if (!pcfg.dependencyRespectWorkingTime || !bh) return undefined;
    return (s: Date) => {
      const h = s.getHours() + s.getMinutes() / 60;
      if (h >= bh.start && h < bh.end) return s;
      // Before opening -> today's open; at/after close -> next day's open.
      const base = startOfDay(s);
      if (h < bh.start) return new Date(base.getTime() + bh.start * 3_600_000);
      return new Date(addDays(base, 1).getTime() + bh.start * 3_600_000);
    };
  });
  // Current resolved [start,end] of every row (overlay-aware) for cascade / arrows.
  const depTimes = $derived.by(() => {
    const m = new Map<string, { start: Date; end: Date }>();
    for (const ev of events) if (!m.has(ev.rowKey)) m.set(ev.rowKey, { start: ev.start, end: ev.end });
    return m;
  });
  const depViolations = $derived(hasDeps ? violations(depTimes, depList) : []);

  // Pixel rects for each row's bars in the timeline body (for the arrow overlay).
  const tlBarRects = $derived.by(() => {
    const byKey = new Map<string, { left: number; right: number; midY: number }>();
    let top = 0;
    for (const dr of tlRenderRows) {
      if (dr.kind === "group") { top += GROUP_ROW_H; continue; }
      const row = dr.row;
      const rowH = Math.max(1, row.laneCount) * tlLaneH + 6 + histH;
      for (const it of row.items) {
        const g = tlGeom(it.event.start, it.event.end);
        if (!g) continue;
        const left = (g.leftPct / 100) * tlAxisWidth;
        const right = left + (g.widthPct / 100) * tlAxisWidth;
        const midY = top + it.lane * tlLaneH + 3 + (tlLaneH - 4) / 2;
        if (!byKey.has(it.event.rowKey)) byKey.set(it.event.rowKey, { left, right, midY });
      }
      top += rowH;
    }
    return { byKey, height: top };
  });
  // SVG path + state for each dependency arrow (elbow connector, pred finish -> succ start).
  const tlDepArrows = $derived.by(() => {
    if (!isTimeline || !hasDeps) return [] as Array<{ id: string; d: string; bad: boolean; hx: number; hy: number }>;
    const rects = tlBarRects.byKey;
    const bad = new Set(depViolations.map((d) => d.id));
    const out: Array<{ id: string; d: string; bad: boolean; hx: number; hy: number }> = [];
    for (const dep of depList) {
      const a = rects.get(dep.from);
      const b = rects.get(dep.to);
      if (!a || !b) continue;
      const type = dep.type ?? "FS";
      const x1 = type === "SS" || type === "SF" ? a.left : a.right;
      const x2 = type === "FF" || type === "SF" ? b.right : b.left;
      out.push({ id: dep.id, d: depElbow(x1, a.midY, x2, b.midY), bad: bad.has(dep.id), hx: x2, hy: b.midY });
    }
    return out;
  });
  // Orthogonal elbow connector between two anchor points; loops around when the
  // successor sits left of the predecessor (a backward / violating link).
  function depElbow(x1: number, y1: number, x2: number, y2: number): string {
    const s = 10;
    const p = x1 + s;
    if (x2 >= p) return `M${x1},${y1} L${p},${y1} L${p},${y2} L${x2},${y2}`;
    const q = x2 - s;
    const midY = y2 >= y1 ? y1 + tlLaneH : y1 - tlLaneH;
    return `M${x1},${y1} L${p},${y1} L${p},${midY} L${q},${midY} L${q},${y2} L${x2},${y2}`;
  }
  // Cascade successors forward after a move / resize, writing the shifts into the
  // overlay and reporting them (never mutating source rows).
  function cascadeDeps(movedKey: string, ns: Date, ne: Date) {
    if (!autoReschedule) return;
    const times = new Map<string, { start: Date; end: Date }>();
    for (const [k, v] of depTimes) times.set(k, v);
    times.set(movedKey, { start: ns, end: ne });
    const shifts = cascade(times, depList, { snapForward: depSnapForward });
    if (!shifts.size) return;
    const moves: Array<{ id: string; start: Date; end: Date }> = [];
    for (const [k, t] of shifts) {
      startOfE[k] = t.start;
      endOfE[k] = t.end;
      moves.push({ id: k, start: fromZ(t.start), end: fromZ(t.end) });
    }
    pcfg.onDependenciesChange?.(moves);
  }

  // --- Scheduler Pro: multi-assignment + resource histogram + column summary --
  // Resolve assignments from the flat list + any per-row `assignmentField`.
  const assignmentsList = $derived.by<SchedulerAssignment[]>(() => {
    const out: SchedulerAssignment[] = [];
    if (pcfg.assignments) out.push(...pcfg.assignments);
    const f = pcfg.assignmentField;
    if (f) {
      for (const row of data) {
        const raw = fieldValue(row, f);
        if (!Array.isArray(raw)) continue;
        const evId = key(row);
        for (const r of raw) {
          if (typeof r === "string") out.push({ id: `${evId}@${r}`, eventId: evId, resourceId: r });
          else if (r && typeof r === "object" && "resourceId" in r) {
            const o = r as { id?: string; resourceId: string; units?: number };
            out.push({ id: o.id ?? `${evId}@${o.resourceId}`, eventId: evId, resourceId: o.resourceId, units: o.units });
          }
        }
      }
    }
    return out;
  });
  const hasAssignments = $derived(assignmentsList.length > 0 || !!pcfg.assignmentField);
  // Flattened (event x resource) allocations for the visible timeline events.
  const tlAllocations = $derived.by(() => {
    if (!isTimeline || !resourceField) return [];
    return expandAssignments(viewEvents, assignmentsList, {
      keyOf: (e) => e.rowKey,
      startOf: (e) => e.start,
      endOf: (e) => e.end,
      resourceOf: (e) => e.resourceId,
    });
  });
  // Events fed to timelineRows: expanded per assigned resource when assignments
  // are in play (one event can then appear under several resources), else plain.
  const tlEventsForRows = $derived(
    hasAssignments
      ? tlAllocations.map((a) => ({ ...a.event, key: `${a.event.key}@${a.resourceId}`, resourceId: a.resourceId }))
      : viewEvents,
  );
  // Resource utilization histogram (timeline): a bar per axis tick under each row.
  const histCfg = $derived(typeof pcfg.resourceHistogram === "object" ? pcfg.resourceHistogram : {});
  const histOn = $derived(!!pcfg.resourceHistogram && isTimeline && !!resourceField);
  const histH = $derived(histOn ? Math.max(12, histCfg.height ?? 18) : 0);
  const histCapField = $derived(histCfg.capacityField);
  function resourceCapacity(res: SchedulerResource | null): number {
    if (res && histCapField) {
      const v = (res as Record<string, unknown>)[histCapField as string];
      if (typeof v === "number" && v > 0) return v;
    }
    return 1;
  }
  // ONE global scale for every row's bars (per-row peaks made a single shift look
  // like a full block, and heights were not comparable between people).
  const histPeak = $derived.by(() => {
    if (!histOn) return 1;
    let peak = 1;
    for (const res of resources) {
      const cap = resourceCapacity(res);
      for (const t of tlAxis.ticks) peak = Math.max(peak, cap, resourceLoad(tlAllocations, res.id, t.start, t.end));
    }
    return peak;
  });
  // Per-resource histogram bars (one per tick), on the shared `histPeak` scale.
  function histBars(res: SchedulerResource | null): Array<{ leftPct: number; widthPct: number; hPct: number; over: boolean }> {
    if (!histOn || !res) return [];
    const cap = resourceCapacity(res);
    const peak = histPeak;
    const out: Array<{ leftPct: number; widthPct: number; hPct: number; over: boolean }> = [];
    for (const t of tlAxis.ticks) {
      const load = resourceLoad(tlAllocations, res.id, t.start, t.end);
      if (load <= 0) continue; // skip idle ticks so bars read as discrete
      out.push({ leftPct: t.leftPct, widthPct: t.widthPct, hPct: Math.min(100, (load / peak) * 100), over: load > cap + 1e-9 });
    }
    return out;
  }
  // --- utilization heatmap (row-background tint) ------------------------------
  const heatOn = $derived(!!pcfg.utilizationHeatmap && isTimeline && !!resourceField);
  const heatCapField = $derived(typeof pcfg.utilizationHeatmap === "object" ? pcfg.utilizationHeatmap.capacityField : undefined);
  function heatCapacity(res: SchedulerResource | null): number {
    if (res && heatCapField) {
      const v = (res as Record<string, unknown>)[heatCapField as string];
      if (typeof v === "number" && v > 0) return v;
    }
    return 1;
  }
  // One shared load scale across all resources so rows are comparable.
  const heatScale = $derived.by(() => {
    if (!heatOn) return 1;
    const rows = resources.map((res) => tlAxis.ticks.map((t) => resourceLoad(tlAllocations, res.id, t.start, t.end)));
    return heatPeak(rows, 1);
  });
  function heatCellsFor(res: SchedulerResource | null): HeatCell[] {
    if (!heatOn || !res) return [];
    const loads = tlAxis.ticks.map((t) => resourceLoad(tlAllocations, res.id, t.start, t.end));
    return heatCells(tlAxis.ticks, loads, heatCapacity(res), heatScale);
  }
  // --- bookable slots / find-a-time (Day timeline) ---------------------------
  const bookableCfg = $derived(pcfg.bookable && typeof pcfg.bookable === "object" ? pcfg.bookable : null);
  const bookableOn = $derived(!!bookableCfg && view === "timelineDay" && !!resourceField);
  function bookableSlotsFor(res: SchedulerResource | null): Slot[] {
    if (!bookableOn || !res || !bookableCfg) return [];
    const day = startOfDay(range.start);
    const avail = (res as Record<string, unknown>).availability as ReadonlyArray<{ days?: number[]; start: number; end: number }> | undefined;
    const windows = avail && avail.length
      ? avail
      : scheduler.businessHours
        ? [{ start: scheduler.businessHours.start, end: scheduler.businessHours.end }]
        : [{ start: dayStartHour, end: dayEndHour }];
    const iv = workingIntervals(day.getDay(), windows, dayStartHour * 60, dayEndHour * 60);
    const working: SlotInterval[] = iv.map(([a, b]) => ({ start: new Date(day.getTime() + a * 60_000), end: new Date(day.getTime() + b * 60_000) }));
    const busy: SlotInterval[] = viewEvents.filter((e) => (e.resourceId ?? "") === res.id).map((e) => ({ start: e.start, end: e.end }));
    const lead = pcfg.minLeadMin ?? 0;
    return availableSlots({
      working,
      busy,
      durationMin: bookableCfg.durationMin,
      stepMin: bookableCfg.stepMin,
      bufferBeforeMin: typeof pcfg.bufferBeforeMin === "number" ? pcfg.bufferBeforeMin : 0,
      bufferAfterMin: typeof pcfg.bufferAfterMin === "number" ? pcfg.bufferAfterMin : 0,
      minStart: lead ? new Date(nowZoned().getTime() + lead * 60_000) : undefined,
    });
  }
  function pickSlot(res: SchedulerResource | null, slot: Slot) {
    suppressClick = true;
    if (pcfg.onSlotPick) pcfg.onSlotPick(fromZ(slot.start), fromZ(slot.end), res?.id);
    else emitAdd(slot.start, slot.end, res?.id, false);
  }
  // --- free/busy availability overlay ---------------------------------------
  const freeBusyOn = $derived(!!pcfg.freeBusyOf && isTimeline && !!resourceField);
  function freeBusyBandsFor(res: SchedulerResource | null): Array<{ leftPct: number; widthPct: number }> {
    if (!freeBusyOn || !res || !pcfg.freeBusyOf) return [];
    const out: Array<{ leftPct: number; widthPct: number }> = [];
    for (const b of pcfg.freeBusyOf(res)) {
      const g = tlGeom(toZ(b.start) ?? b.start, toZ(b.end) ?? b.end);
      if (g) out.push({ leftPct: g.leftPct, widthPct: g.widthPct });
    }
    return out;
  }
  // Per-time-column summary strip (counts / sums / custom reducer) over axis ticks.
  const summaryCfg = $derived(pcfg.columnSummary && pcfg.columnSummary !== false ? pcfg.columnSummary : null);
  const tlSummary = $derived.by(() => {
    if (!summaryCfg || !isTimeline) return null;
    const cols = tlAxis.ticks.map((t) => ({ start: t.start, end: t.end }));
    const vals = columnSummaries(viewEvents, cols, summaryCfg.reducer as never, {
      startOf: (e) => e.start,
      endOf: (e) => e.end,
      rowOf: (e) => e.row,
    });
    return vals;
  });

  // --- Scheduler Pro: non-working-time collapse + continuous zoom ------------
  const collapseOn = $derived(isTimeline && (pcfg.collapseNonWorking === true || pcfg.collapseWeekends === true));
  // Zoom: consumer-controlled `zoom`, overridable by the built-in stepper.
  let zoomOverride = $state<number | null>(null);
  const zoomValue = $derived(zoomOverride ?? pcfg.zoom ?? null);
  const zoomOn = $derived(isTimeline && zoomValue != null);
  const zoomLadder = $derived(pcfg.zoomLevels ?? zoomPresets);
  const axisPro = $derived(collapseOn || zoomOn);
  // The piecewise axis (working spans full width, non-working collapsed) + tick size.
  const proAxisData = $derived.by<{ axis: Axis; tickMinutes: number; level: ZoomLevel | null } | null>(() => {
    if (!axisPro) return null;
    const z = zoomOn ? resolveZoom(zoomValue as number | ZoomLevel, zoomLadder) : null;
    const pxPerMinute = z ? z.pxPerMinute : 0.5;
    const axis = buildAxis(range.start, range.end, {
      pxPerMinute,
      businessHours: scheduler.businessHours,
      nonWorkingDays: scheduler.nonWorkingDays,
      collapseNonWorking: pcfg.collapseNonWorking,
      collapseWeekends: pcfg.collapseWeekends,
      collapsedGapPx: pcfg.collapsedGapPx,
    });
    const tickMinutes = z ? z.level.tickMinutes : view === "timelineDay" ? 60 : 1440;
    return { axis, tickMinutes, level: z?.level ?? null };
  });
  function stepZoom(dir: number) {
    const cur = zoomValue == null ? 3 : typeof zoomValue === "number" ? zoomValue : zoomLadder.indexOf(zoomValue as ZoomLevel);
    const next = Math.max(0, Math.min(zoomLadder.length - 1, (cur < 0 ? 3 : cur) + dir));
    zoomOverride = next;
    pcfg.onZoomChange?.(zoomLadder[next]!);
  }
  const TL_WD_S = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const TL_MO_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function proTickLabel(d: Date, tickMinutes: number): string {
    if (tickMinutes < 1440) { const h = d.getHours(); return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`; }
    if (tickMinutes < 10_080) return `${TL_WD_S[d.getDay()]} ${d.getDate()}`;
    if (tickMinutes < 43_200) return `${TL_MO_S[d.getMonth()]} ${d.getDate()}`;
    return `${TL_MO_S[d.getMonth()]} ${d.getFullYear()}`;
  }
  // Build a TimelineAxis-shaped object from the piecewise Pro axis so the existing
  // timeline template (ticks / majors / gridlines) renders unchanged. Collapsed
  // segments emit no ticks - the visual gap conveys the compression.
  // Annotated with the real `TimelineAxis` rather than `typeof tlAxis`: tlAxis
  // CALLS this function, so referring back to it made the type circular and
  // silently degraded tlAxis (and everything derived from it) to `any`.
  function proTimelineAxis(): TimelineAxis {
    const data = proAxisData!;
    const ax = data.axis;
    const total = ax.totalPx || 1;
    const todayD = startOfDay(toZonedLocal(new Date(), tz));
    const tickMs = data.tickMinutes * 60_000;
    const ticks: Array<{ start: Date; end: Date; leftPct: number; widthPct: number; label: string; today: boolean }> = [];
    for (const seg of ax.segments) {
      if (seg.kind === "collapsed") continue;
      let t = seg.start.getTime();
      const segEnd = seg.end.getTime();
      let guard = 0;
      while (t < segEnd && guard++ < 2000) {
        // Align the next boundary to the tick grid from the axis origin.
        const sinceOrigin = t - ax.start.getTime();
        const aligned = ax.start.getTime() + (Math.floor(sinceOrigin / tickMs) + 1) * tickMs;
        const next = Math.min(segEnd, aligned > t ? aligned : t + tickMs);
        const ts = new Date(t);
        const x1 = timeToX(ts, ax);
        const x2 = timeToX(new Date(next), ax);
        ticks.push({ start: ts, end: new Date(next), leftPct: (x1 / total) * 100, widthPct: ((x2 - x1) / total) * 100, label: proTickLabel(ts, data.tickMinutes), today: isSameDay(ts, todayD) });
        t = next;
      }
    }
    // Majors group ticks by day (sub-day ticks) or month (day+ ticks).
    const subDay = data.tickMinutes < 1440;
    const majors: Array<{ label: string; leftPct: number; widthPct: number }> = [];
    for (const tk of ticks) {
      const kd = subDay ? `${tk.start.getFullYear()}-${tk.start.getMonth()}-${tk.start.getDate()}` : `${tk.start.getFullYear()}-${tk.start.getMonth()}`;
      const label = subDay ? `${TL_WD_S[tk.start.getDay()]}, ${TL_MO_S[tk.start.getMonth()]} ${tk.start.getDate()}` : `${TL_MO_S[tk.start.getMonth()]} ${tk.start.getFullYear()}`;
      const last = majors[majors.length - 1] as (typeof majors[number] & { _k?: string }) | undefined;
      if (last && last._k === kd) last.widthPct += tk.widthPct;
      else majors.push(Object.assign({ label, leftPct: tk.leftPct, widthPct: tk.widthPct }, { _k: kd }));
    }
    return { start: ax.start, end: ax.end, totalMs: ax.end.getTime() - ax.start.getTime(), ticks, majors: majors.map(({ _k, ...m }: any) => m) } as typeof tlAxis;
  }
  // Time -> bar geometry, routed through the piecewise axis when Pro axis is on.
  function tlGeom(a: Date, b: Date) {
    if (axisPro && proAxisData) {
      const ax = proAxisData.axis;
      const total = ax.totalPx || 1;
      const s = Math.max(a.getTime(), ax.start.getTime());
      const e = Math.min(b.getTime(), ax.end.getTime());
      if (e <= ax.start.getTime() || s >= ax.end.getTime() || e <= s) return null;
      const x1 = timeToX(new Date(s), ax);
      const x2 = timeToX(new Date(e), ax);
      if (x2 <= x1) return null;
      return { leftPct: (x1 / total) * 100, widthPct: ((x2 - x1) / total) * 100, continuesLeft: a.getTime() < ax.start.getTime(), continuesRight: b.getTime() > ax.end.getTime() };
    }
    return timelineGeom(a, b, tlAxis.start, tlAxis.totalMs);
  }

  const VIEW_LABELS: Record<SchedulerView, string> = {
    month: "Month",
    week: "Week",
    day: "Day",
    agenda: "Agenda",
    timelineDay: "Timeline · Day",
    timelineWeek: "Timeline · Week",
    timelineMonth: "Timeline · Month",
    timelineYear: "Timeline · Year",
  };
  const viewLabel = (v: SchedulerView) => VIEW_LABELS[v] ?? v;

  // --- time-grid columns: resource x day when grouped, else one per day. ---
  type GridCol = { key: string; label: string; sub: string; date: Date; resourceId?: string; color?: string; today: boolean };
  type GroupHeader = { key: string; label: string; color?: string; span: number };
  const gridDays = $derived(daysForView(view, anchor, weekStartsOn));
  const gridCols = $derived.by<GridCol[]>(() => {
    const isToday = (d: Date) => isSameDay(d, startOfDay(toZonedLocal(new Date(), tz)));
    if (!resourcesEnabled) {
      return gridDays.map((d) => ({
        key: `day:${d.getTime()}`,
        label: wd(d.getDay()),
        sub: `${d.getDate()}`,
        date: d,
        today: isToday(d),
      }));
    }
    const cols: GridCol[] = [];
    if (groupByDate) {
      for (const d of gridDays)
        for (const r of resources)
          cols.push({ key: `${d.getTime()}|${r.id}`, label: r.title ?? r.id, sub: "", date: d, resourceId: r.id, color: r.color, today: false });
    } else {
      for (const r of resources)
        for (const d of gridDays)
          cols.push({ key: `${r.id}|${d.getTime()}`, label: wd(d.getDay()), sub: `${d.getDate()}`, date: d, resourceId: r.id, color: r.color, today: isToday(d) });
    }
    return cols;
  });
  // The spanning header row above the columns (resource groups, or date groups).
  const groupHeaders = $derived.by<GroupHeader[]>(() => {
    if (!resourcesEnabled) return [];
    if (groupByDate)
      return gridDays.map((d) => ({ key: `d:${d.getTime()}`, label: `${wd(d.getDay())} ${d.getDate()}`, span: resources.length }));
    return resources.map((r) => ({ key: `r:${r.id}`, label: r.title ?? r.id, color: r.color, span: gridDays.length }));
  });
  // When grouped there can be many columns, so give them a min width + h-scroll.
  const GROUP_COL_MIN = 96;
  const gridMinWidth = $derived(resourcesEnabled ? 56 + gridCols.length * GROUP_COL_MIN : 0);

  function colEvents(col: GridCol): ResolvedEvent<TData>[] {
    return eventsOnDay(viewEvents, col.date).filter((e) =>
      col.resourceId != null ? (e.resourceId ?? "") === col.resourceId : true,
    );
  }
  // An event belongs in the all-day ROW (not the hourly grid) when it is flagged
  // all-day OR spans more than one calendar day - otherwise a multi-day event
  // would fill whole day columns. Row events render as spanning bars up top.
  function isTimeGridRow(e: ResolvedEvent<TData>): boolean {
    if (e.allDay) return true;
    return startOfDay(new Date(e.end.getTime() - 1)).getTime() > startOfDay(e.start).getTime();
  }
  function colLayout(col: GridCol) {
    return layoutDayEvents(
      colEvents(col).filter((e) => !isTimeGridRow(e)),
      col.date,
      {
        dayStartHour,
        dayEndHour,
        mode: collisionMode,
        maxColumns,
      },
    );
  }
  function colAllDay(col: GridCol) {
    return colEvents(col).filter((e) => isTimeGridRow(e));
  }
  // Spanning bars for the all-day row (non-resource week/day): reuses the month
  // week-segment packing over the visible days.
  const allDayBars = $derived(view === "week" && !resourcesEnabled);
  const allDaySegs = $derived.by(() => {
    if (!allDayBars) return { segments: [], laneCount: 0 };
    const rowEvents = viewEvents.filter((e) => isTimeGridRow(e));
    return monthWeekSegments(rowEvents, gridDays[0] ?? anchor);
  });

  const monthWeeks = $derived(monthMatrix(anchor, weekStartsOn, 6));
  const agenda = $derived(agendaGroups(viewEvents));

  // --- month spanning-bar layout ---
  const MONTH_DAYNUM_H = 22; // px reserved at the top of each cell for the date
  const MONTH_LANE_H = 20; // px per event-bar lane
  const MONTH_MORE_H = 16; // px reserved for the "+N more" row
  let monthBodyH = $state(0);
  const visibleMonthLanes = $derived.by(() => {
    const weekH = monthBodyH / Math.max(1, monthWeeks.length);
    return Math.max(1, Math.floor((weekH - MONTH_DAYNUM_H - MONTH_MORE_H) / MONTH_LANE_H));
  });
  // Events hidden (beyond the visible lanes) that cover a given day column.
  function monthMoreCount(
    segments: ReadonlyArray<{ startCol: number; endCol: number; lane: number }>,
    col: number,
  ): number {
    return segments.filter(
      (s) => s.lane >= visibleMonthLanes && s.startCol <= col && s.endCol >= col,
    ).length;
  }
  // The all-day row is ALWAYS shown in the time-grid so it is always a drop
  // target (drag an event up to make it all-day).
  const hasAllDayRow = $derived(view === "week" || view === "day");
  const bandHours = $derived(Math.max(1, dayEndHour - dayStartHour));
  const hourList = $derived(Array.from({ length: bandHours }, (_, i) => dayStartHour + i));

  // Ruler subdivision: every slot is a fixed SLOT_PX tall, so the hour grows
  // with the granularity (1h -> 30px rows, 30m -> 2x30px = 60px/hour, 15m ->
  // 4x30, 5m -> 12x30). Event positions are percent-based, so this stays correct.
  const SLOT_PX = 30;
  const slotsPerHour = $derived(Math.max(1, Math.round(60 / slotMinutes)));
  const slotPx = SLOT_PX;
  const hourPx = $derived(slotsPerHour * SLOT_PX);
  const gridSlots = $derived.by(() => {
    const out: { min: number; startsOnHour: boolean; endsOnHour: boolean }[] = [];
    const total = bandHours * slotsPerHour;
    for (let i = 0; i < total; i++) {
      const min = dayStartHour * 60 + i * slotMinutes;
      out.push({ min, startsOnHour: min % 60 === 0, endsOnHour: (min + slotMinutes) % 60 === 0 });
    }
    return out;
  });
  const slotSizeLabel = (m: number) => (m % 60 === 0 ? `${m / 60}h` : `${m}m`);
  function slotRulerLabel(s: { min: number; startsOnHour: boolean }): string {
    if (s.startsOnHour) return hourLabel(s.min / 60);
    if (slotMinutes >= 15) return `:${String(s.min % 60).padStart(2, "0")}`;
    return "";
  }

  // --- current-time indicator (the "now" line), ticking each minute ---
  // `now` is kept in pseudo-local time (see `tz`) so it positions in the zone.
  const nowIndicator = $derived(scheduler.nowIndicator !== false);
  // svelte-ignore state_referenced_locally
  let now = $state(toZonedLocal(new Date(), normalizeTimeZone(scheduler.timeZone)));
  $effect(() => {
    if (!nowIndicator && !scheduler.reminderField) return; // tick for the now-line OR reminders
    now = toZonedLocal(new Date(), tz);
    const id = setInterval(() => (now = toZonedLocal(new Date(), tz)), 60_000);
    return () => clearInterval(id);
  });
  const nowMin = $derived(now.getHours() * 60 + now.getMinutes());

  // --- reminders: fire once as an event's lead time is crossed ---------------
  const firedReminders = new Set<string>();
  let reminders = $state<{ id: number; text: string }[]>([]);
  let reminderSeq = 0;
  $effect(() => {
    const field = scheduler.reminderField;
    if (!field) return;
    const nowMs = now.getTime();
    for (const ev of events) {
      const lead = Number(fieldValue(ev.row, field));
      if (!Number.isFinite(lead) || lead < 0) continue;
      const untilMin = (ev.start.getTime() - nowMs) / 60000;
      // Just entered the lead window and not yet started (allow a 1-min slack).
      if (untilMin > lead || untilMin < -1) continue;
      const key = `${ev.rowKey}#${ev.start.getTime()}`;
      if (firedReminders.has(key)) continue;
      firedReminders.add(key);
      const mins = Math.max(0, Math.round(untilMin));
      untrack(() => {
        scheduler.onReminder?.(ev.row, mins);
        const id = ++reminderSeq;
        reminders = [...reminders, { id, text: `${ev.title || "Event"} ${mins <= 0 ? "is starting" : `in ${mins} min`}` }];
        setTimeout(() => (reminders = reminders.filter((r) => r.id !== id)), 6000);
      });
    }
  });

  // --- secondary time-zone rulers (a "world clock" left of the primary gutter) ---
  const primaryZoneLabel = $derived(tz ? zoneAbbr(fromZ(now), tz) : "");
  const secondaryRulers = $derived.by(() => {
    const list = scheduler.secondaryTimeZones;
    if (!list?.length || !hasAllDayRow) return [] as { label: string; rows: string[] }[];
    // Map each primary-band hour to the wall-clock hour in the other zone, using
    // the anchor day for the (DST-dependent) offset.
    return list.map((sz) => {
      const zid = normalizeTimeZone(sz.id);
      const rows = hourList.map((h) => {
        const inst = instantFromWallClock(anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate(), h, 0, 0, tz);
        return hourLabel(zid ? zoneParts(inst, zid).hour : h);
      });
      const headInst = instantFromWallClock(anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate(), 12, 0, 0, tz);
      return { label: sz.label ?? (zid ? zoneAbbr(headInst, zid) : sz.id), rows };
    });
  });
  const gutterCount = $derived(1 + secondaryRulers.length);

  // --- booking rules: working-hours shading + conflict prevention ----------
  const businessHours = $derived(scheduler.businessHours);
  const nonWorkingDaySet = $derived(new Set(scheduler.nonWorkingDays ?? []));
  const shadeUntilNow = $derived(scheduler.shadeUntilNow === true);
  const disableConflicts = $derived(scheduler.disableConflicts === true);
  const isNonWorkingDay = (d: Date) => nonWorkingDaySet.has(d.getDay());
  const resById = $derived(new Map(resources.map((r) => [r.id, r])));
  const anyAvailability = $derived(resources.some((r) => r.availability?.length));
  // Hard booking bounds + highlights (Wave B follow-ups).
  const restrictedHours = $derived(scheduler.restrictedHours ?? []);
  const dayKey = (d: Date) => startOfDay(d).getTime();
  const zDayKey = (v: unknown) => dayKey(toZonedLocal(toDate(v as never) ?? new Date(), tz));
  const restrictedDateSet = $derived(new Set((scheduler.restrictedDates ?? []).map(zDayKey)));
  const specialByDay = $derived(
    new Map((scheduler.specialDates ?? []).map((s) => [zDayKey(s.date), s])),
  );
  const minDate = $derived(scheduler.minDate != null ? startOfDay(toZonedLocal(toDate(scheduler.minDate as never)!, tz)) : null);
  const maxDate = $derived(scheduler.maxDate != null ? startOfDay(toZonedLocal(toDate(scheduler.maxDate as never)!, tz)) : null);
  const maxEventsPerSlot = $derived(scheduler.maxEventsPerSlot);
  const anyDateOverrides = $derived(resources.some((r) => r.dateOverrides?.length));
  const isRestrictedDate = (d: Date) => restrictedDateSet.has(dayKey(d));
  const hasBookingShade = $derived(
    !!businessHours || shadeUntilNow || nonWorkingDaySet.size > 0 || anyAvailability ||
      restrictedHours.length > 0 || restrictedDateSet.size > 0 || anyDateOverrides,
  );
  // A resource's explicit windows for ONE specific date via `dateOverrides`
  // (off -> [], custom windows -> those). Returns null when no override matches.
  function resourceDateWindows(res: SchedulerResource | undefined, date: Date): Array<[number, number]> | null {
    const ov = res?.dateOverrides?.find((o) => isSameDay(toZonedLocal(toDate(o.date as never) ?? new Date(), tz), date));
    if (!ov) return null;
    if (ov.off) return [];
    const bandStart = dayStartHour * 60;
    const bandEnd = dayEndHour * 60;
    return (ov.windows ?? []).map((w) => [Math.max(bandStart, w.start * 60), Math.min(bandEnd, w.end * 60)] as [number, number]).filter(([a, b]) => b > a);
  }
  // The working [startMin, endMin] intervals for a column: the column's RESOURCE
  // availability if it has any (per-doctor hours), else the global businessHours /
  // nonWorkingDays. Empty = the whole day is off.
  function columnWorkIntervals(col: GridCol): Array<[number, number]> {
    const bandStart = dayStartHour * 60;
    const bandEnd = dayEndHour * 60;
    const res = col.resourceId != null ? resById.get(col.resourceId) : undefined;
    const wd = col.date.getDay();
    const override = resourceDateWindows(res, col.date);
    if (override) return override;
    if (res?.availability?.length) return workingIntervals(wd, res.availability, bandStart, bandEnd);
    if (nonWorkingDaySet.has(wd)) return [];
    if (businessHours) return [[Math.max(bandStart, businessHours.start * 60), Math.min(bandEnd, businessHours.end * 60)]];
    return [[bandStart, bandEnd]]; // fully working (no shade)
  }
  // Shaded bands (top% / height%) = the complement of the working intervals.
  function columnShadeBands(col: GridCol): { top: number; height: number }[] {
    const bandStart = dayStartHour * 60;
    const bandEnd = dayEndHour * 60;
    const total = bandHours * 60;
    const out: { top: number; height: number }[] = [];
    let cursor = bandStart;
    for (const [a, b] of columnWorkIntervals(col)) {
      if (a > cursor) out.push({ top: ((cursor - bandStart) / total) * 100, height: ((a - cursor) / total) * 100 });
      cursor = Math.max(cursor, b);
    }
    if (cursor < bandEnd) out.push({ top: ((cursor - bandStart) / total) * 100, height: ((bandEnd - cursor) / total) * 100 });
    return out;
  }
  // Hard-restricted bands (distinct hatch) = the whole day when the date is
  // blocked, else each `restrictedHours` band clamped to the visible band.
  function columnRestrictedBands(col: GridCol): { top: number; height: number }[] {
    const bandStart = dayStartHour * 60;
    const bandEnd = dayEndHour * 60;
    const total = bandHours * 60;
    if (isRestrictedDate(col.date)) return [{ top: 0, height: 100 }];
    const out: { top: number; height: number }[] = [];
    for (const b of restrictedHours) {
      const a = Math.max(bandStart, b.start * 60);
      const z = Math.min(bandEnd, b.end * 60);
      if (z > a) out.push({ top: ((a - bandStart) / total) * 100, height: ((z - a) / total) * 100 });
    }
    return out;
  }
  const restrictToBusinessHours = $derived(scheduler.restrictToBusinessHours === true);
  // A brief flash when a drop/create is rejected (double-book or out-of-hours).
  let conflictMsg = $state<string | null>(null);
  let conflictTimer: ReturnType<typeof setTimeout> | undefined;
  function flashBlocked(msg: string) {
    conflictMsg = msg;
    clearTimeout(conflictTimer);
    conflictTimer = setTimeout(() => (conflictMsg = null), 1500);
  }
  // True when [start,end] falls outside the working windows for `resourceId`
  // (its own availability if set, else the global businessHours / nonWorkingDays).
  function outsideWorkingTime(start: Date, end: Date, resourceId: string | undefined): boolean {
    const bandStart = dayStartHour * 60;
    const bandEnd = dayEndHour * 60;
    const res = resourceId != null ? resById.get(resourceId) : undefined;
    const wd = start.getDay();
    const override = resourceDateWindows(res, start);
    let intervals: Array<[number, number]>;
    if (override) intervals = override;
    else if (res?.availability?.length) intervals = workingIntervals(wd, res.availability, bandStart, bandEnd);
    else if (nonWorkingDaySet.has(wd)) intervals = [];
    else if (businessHours) intervals = [[Math.max(bandStart, businessHours.start * 60), Math.min(bandEnd, businessHours.end * 60)]];
    else return false; // no working-time restriction configured
    const sMin = start.getHours() * 60 + start.getMinutes();
    const rawEnd = end.getHours() * 60 + end.getMinutes();
    const eMin = rawEnd === 0 ? 24 * 60 : rawEnd; // end at midnight = end of day
    return !withinWorking(sMin, eMin, intervals);
  }
  // Returns true (and flashes) when placing [start,end] should be rejected -
  // out-of-hours (when restricted) or a same-resource double-book. Caller reverts.
  // --- eligibility / skill matching ----------------------------------------
  const hasEligibility = $derived(!!pcfg.eligible || !!pcfg.requiresField);
  function eligibleFor(row: TData, resourceId: string | undefined): boolean {
    if (!hasEligibility || resourceId == null) return true;
    const res = resById.get(resourceId);
    if (!res) return true;
    if (pcfg.eligible) return pcfg.eligible(row, res);
    const rf = pcfg.requiresField;
    if (!rf) return true;
    const req = (row as Record<string, unknown>)[rf as string];
    const reqTags = Array.isArray(req) ? (req as unknown[]) : req != null ? [req] : [];
    if (!reqTags.length) return true;
    const skills = pcfg.resourceSkillsOf ? pcfg.resourceSkillsOf(res) : ((res as Record<string, unknown>).skills as unknown);
    const skillSet = new Set(Array.isArray(skills) ? (skills as unknown[]) : []);
    return reqTags.every((t) => skillSet.has(t));
  }
  function bookingBlocked(start: Date, end: Date, resourceId: string | undefined, excludeRowKey: string, row?: TData): boolean {
    // Hard bounds first (always enforced, no opt-in).
    if (row !== undefined && !eligibleFor(row, resourceId)) { flashBlocked("Not eligible"); return true; }
    // Free/busy: the resource is busy elsewhere in this span -> cannot book it.
    if (pcfg.freeBusyOf && resourceId != null) {
      const fbRes = resById.get(resourceId);
      if (fbRes) {
        const s = start.getTime();
        const e = end.getTime();
        for (const b of pcfg.freeBusyOf(fbRes)) {
          const bs = (toZ(b.start) ?? b.start).getTime();
          const be = (toZ(b.end) ?? b.end).getTime();
          if (s < be && e > bs) { flashBlocked("Busy elsewhere"); return true; }
        }
      }
    }
    if (minDate && startOfDay(start).getTime() < minDate.getTime()) { flashBlocked("Before the allowed range"); return true; }
    if (maxDate && startOfDay(start).getTime() > maxDate.getTime()) { flashBlocked("After the allowed range"); return true; }
    if (isRestrictedDate(start)) { flashBlocked("Date is blocked"); return true; }
    if (restrictedHours.length) {
      const sMin = start.getHours() * 60 + start.getMinutes();
      const rawEnd = end.getHours() * 60 + end.getMinutes();
      const eMin = rawEnd === 0 ? 24 * 60 : rawEnd;
      if (overlapsBands(sMin, eMin, restrictedHours)) { flashBlocked("Restricted time"); return true; }
    }
    if (restrictToBusinessHours && outsideWorkingTime(start, end, resourceId)) {
      flashBlocked("Outside working hours");
      return true;
    }
    if (disableConflicts && hasConflict(start, end, resourceId ?? undefined, events, excludeRowKey)) {
      flashBlocked("Time slot already booked");
      return true;
    }
    if (maxEventsPerSlot != null && overlapCount(start, end, resourceId ?? undefined, events, excludeRowKey) >= maxEventsPerSlot) {
      flashBlocked(`Limit of ${maxEventsPerSlot} per slot reached`);
      return true;
    }
    // --- booking-rule depth: lead time, duration bounds, buffers / travel ---
    if (pcfg.minLeadMin != null && !afterLead(start, nowZoned(), pcfg.minLeadMin)) { flashBlocked("Too soon to book"); return true; }
    if (pcfg.minDurationMin != null || pcfg.maxDurationMin != null) {
      if (!withinDurationBounds(start, end, pcfg.minDurationMin, pcfg.maxDurationMin)) {
        const dur = (end.getTime() - start.getTime()) / 60000;
        flashBlocked(pcfg.minDurationMin != null && dur < pcfg.minDurationMin ? "Too short" : "Too long");
        return true;
      }
    }
    if (row !== undefined && (pcfg.bufferBeforeMin != null || pcfg.bufferAfterMin != null || pcfg.travelTimeOf)) {
      const bufB = typeof pcfg.bufferBeforeMin === "function" ? pcfg.bufferBeforeMin(row) : pcfg.bufferBeforeMin ?? 0;
      const bufA = typeof pcfg.bufferAfterMin === "function" ? pcfg.bufferAfterMin(row) : pcfg.bufferAfterMin ?? 0;
      const busy: BusyEvent<TData>[] = events
        .filter((e) => (e.resourceId ?? undefined) === (resourceId ?? undefined))
        .map((e) => ({ start: e.start, end: e.end, key: e.rowKey, data: e.row }));
      const travel = pcfg.travelTimeOf;
      const gapBefore = travel ? (n: BusyEvent<TData>) => bufB + travel(row, n.data as TData) : bufB;
      const gapAfter = travel ? (n: BusyEvent<TData>) => bufA + travel(row, n.data as TData) : bufA;
      if (!respectsBuffer(start, end, busy, gapBefore, gapAfter, excludeRowKey)) { flashBlocked("Needs a gap between bookings"); return true; }
    }
    return false;
  }
  const nowZoned = () => toZonedLocal(new Date(), tz);

  // --- undo / redo of drag-move + resize -----------------------------------
  const historyEnabled = $derived(scheduler.history === true);
  type EvState = { start: Date; end: Date; resource?: string; allDay?: boolean };
  type HistCmd = { key: string; row: TData; before: EvState; after: EvState; kind: "move" | "resize" };
  let undoStack: HistCmd[] = [];
  let redoStack: HistCmd[] = [];
  function pushHistory(cmd: HistCmd) {
    if (!historyEnabled) return;
    undoStack.push(cmd);
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }
  function applyState(cmd: HistCmd, s: EvState) {
    const k = cmd.key;
    startOfE[k] = s.start;
    endOfE[k] = s.end;
    if (s.allDay !== undefined) allDayOf[k] = s.allDay;
    if (s.resource !== undefined) resourceOfE[k] = s.resource;
    if (cmd.kind === "move") emitMove({ row: cmd.row, start: s.start, end: s.end, allDay: s.allDay ?? false, toResource: s.resource });
    else emitResize({ row: cmd.row, start: s.start, end: s.end });
  }
  function undoHistory() {
    const cmd = undoStack.pop();
    if (!cmd) return;
    applyState(cmd, cmd.before);
    redoStack.push(cmd);
  }
  function redoHistory() {
    const cmd = redoStack.pop();
    if (!cmd) return;
    applyState(cmd, cmd.after);
    undoStack.push(cmd);
  }
  $effect(() => {
    if (!historyEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoHistory();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redoHistory();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- custom event content + hover tooltip --------------------------------
  const tooltipCfg = $derived(scheduler.tooltip);
  const hasTooltip = $derived(!!tooltipCfg);
  const tooltipSnippet = $derived(typeof tooltipCfg === "function" ? tooltipCfg : undefined);
  let tipEv = $state<ResolvedEvent<TData> | null>(null);
  let tipPos = $state({ x: 0, y: 0 });
  let tipTimer: ReturnType<typeof setTimeout> | undefined;
  function onEventEnter(e: MouseEvent, ev: ResolvedEvent<TData>) {
    if (!hasTooltip || drag || tlDrag || monthDrag) return;
    clearTimeout(tipTimer);
    const target = e.currentTarget as HTMLElement;
    tipTimer = setTimeout(() => {
      const r = target.getBoundingClientRect();
      tipPos = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top) };
      tipEv = ev;
    }, scheduler.tooltipDelay ?? 400);
  }
  function onEventLeave() {
    clearTimeout(tipTimer);
    tipEv = null;
  }
  const resourceTitle = (id: string | undefined) => resources.find((r) => r.id === id)?.title ?? id;

  // --- unscheduled backlog: drag an item onto the Week/Day grid to schedule it ---
  type BacklogItem = { id: string; title: string; durationMin?: number; color?: string };
  const backlogItems = $derived(scheduler.unscheduled ?? []);
  const hasBacklog = $derived(backlogItems.length > 0 && view !== "agenda");
  let backlogDrag = $state<{ item: BacklogItem; x: number; y: number; over: boolean } | null>(null);
  function startBacklogDrag(item: BacklogItem, e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    backlogDrag = { item, x: e.clientX, y: e.clientY, over: false };
    window.addEventListener("pointermove", onBacklogMove);
    window.addEventListener("pointerup", onBacklogEnd, { once: true });
  }
  function onBacklogMove(e: PointerEvent) {
    if (!backlogDrag) return;
    backlogDrag = { ...backlogDrag, x: e.clientX, y: e.clientY, over: pointInEl(e.clientX, e.clientY, gridScrollEl) };
  }
  function onBacklogEnd(e: PointerEvent) {
    window.removeEventListener("pointermove", onBacklogMove);
    const d = backlogDrag;
    backlogDrag = null;
    if (!d) return;
    const dur = d.item.durationMin ?? scheduler.defaultDurationMin ?? 60;
    if (view === "month") {
      // Drop onto a month day cell -> an all-day event on that date.
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest?.("[data-day]") as HTMLElement | null;
      if (!cell) return;
      const t = Number(cell.getAttribute("data-day"));
      if (!Number.isFinite(t)) return;
      scheduler.onSchedule?.(d.item, fromZ(new Date(t)), undefined);
      return;
    }
    if (isTimeline) {
      // Drop onto the horizontal timeline: x -> time, y -> resource row.
      if (!pointInEl(e.clientX, e.clientY, tlScrollEl)) return;
      const start = snapTlStart(tlTimeAtX(e.clientX));
      const resId = tlResAt(e.clientX, e.clientY);
      const end = new Date(start.getTime() + dur * 60000);
      if (bookingBlocked(start, end, resId, "")) return;
      scheduler.onSchedule?.(d.item, fromZ(start), resId);
      return;
    }
    if (!pointInEl(e.clientX, e.clientY, gridScrollEl)) return;
    const col = colAt(e.clientX);
    if (!col) return;
    const min = snapMinute(minuteAt(e.clientY), slotMinutes);
    const start = dateAtMinute(col.date, min);
    const end = new Date(start.getTime() + dur * 60000);
    if (bookingBlocked(start, end, col.resourceId, "")) return;
    scheduler.onSchedule?.(d.item, fromZ(start), col.resourceId);
  }
  // Fraction (0-1) of the hourly band the current time sits at, or null if the
  // band doesn't include "now" (e.g. a narrow business-hours band at night).
  const nowBandPct = $derived(
    nowIndicator && nowMin >= dayStartHour * 60 && nowMin <= dayEndHour * 60
      ? ((nowMin - dayStartHour * 60) / (bandHours * 60)) * 100
      : null,
  );
  // Horizontal position (%) of "now" on the timeline axis, or null if off-axis.
  // (timelineGeom rejects zero-width spans, so position it directly.)
  const nowTlPct = $derived.by(() => {
    if (!nowIndicator || !isTimeline) return null;
    if (axisPro && proAxisData) {
      const ax = proAxisData.axis;
      if (now.getTime() < ax.start.getTime() || now.getTime() > ax.end.getTime()) return null;
      return (timeToX(now, ax) / (ax.totalPx || 1)) * 100;
    }
    const frac = (now.getTime() - tlAxis.start.getTime()) / tlAxis.totalMs;
    return frac >= 0 && frac <= 1 ? frac * 100 : null;
  });

  // --- labels / formatting ---
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const wd = (i: number): string => WEEKDAYS[i] ?? "";
  const mon = (i: number): string => MONTHS[i] ?? "";
  const headerOrder = $derived(weekdayOrder(weekStartsOn));
  function fmtTime(d: Date): string {
    const h = d.getHours();
    const m = d.getMinutes();
    const ap = h < 12 ? "am" : "pm";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
  }
  function hourLabel(h: number): string {
    const ap = h < 12 ? "am" : "pm";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${ap}`;
  }
  const titleLabel = $derived.by(() => {
    if (view === "month" || view === "timelineMonth") return `${mon(anchor.getMonth())} ${anchor.getFullYear()}`;
    if (view === "timelineYear") return `${anchor.getFullYear()}`;
    if (view === "day" || view === "timelineDay") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    // week / timelineWeek / agenda: a range
    const days = view === "week" ? daysForView("week", anchor, weekStartsOn) : [range.start, addDays(range.end, -1)];
    const a = days[0] ?? anchor;
    const b = days[days.length - 1] ?? anchor;
    const sameMonth = a.getMonth() === b.getMonth();
    return `${mon(a.getMonth()).slice(0, 3)} ${a.getDate()} - ${sameMonth ? "" : mon(b.getMonth()).slice(0, 3) + " "}${b.getDate()}, ${b.getFullYear()}`;
  });

  function today() {
    clearRangeSelect();
    anchor = startOfDay(toZonedLocal(new Date(), tz));
    scheduler.onNavigate?.(anchor);
  }
  function go(dir: number) {
    clearRangeSelect();
    const next = navigateAnchor(view, anchor, dir);
    // Respect min/max navigation bounds.
    if (minDate && next.getTime() < minDate.getTime()) return;
    if (maxDate && next.getTime() > maxDate.getTime()) return;
    anchor = next;
    scheduler.onNavigate?.(anchor);
  }
  // Disable prev/next when the next step would cross a bound.
  const canGoPrev = $derived(!minDate || navigateAnchor(view, anchor, -1).getTime() >= minDate.getTime());
  const canGoNext = $derived(!maxDate || navigateAnchor(view, anchor, 1).getTime() <= maxDate.getTime());
  function setView(v: SchedulerView) {
    clearRangeSelect();
    view = v;
  }
  // Controlled date: when `scheduler.date` changes externally, navigate to it.
  // `anchor` is read untracked so internal nav (prev/next) is not fought.
  $effect(() => {
    const d = scheduler.date;
    if (d == null) return;
    const target = startOfDay(toZonedLocal(toDate(d) ?? new Date(), normalizeTimeZone(scheduler.timeZone)));
    untrack(() => {
      if (target.getTime() !== anchor.getTime()) anchor = target;
    });
  });

  // --- drag to move / resize in the time-grid, non-recurring timed events only.
  //   move        - drag the body: shifts start (+ end) and can cross columns
  //   resize-start - drag the TOP grip: moves start, end stays put
  //   resize-end   - drag the BOTTOM grip: moves end, start stays put
  // A small threshold distinguishes a drag from a click, and `suppressClick`
  // stops the click that follows a real drag from also opening the event. ---
  type DragMode = "move" | "resize-start" | "resize-end";
  type Drag = {
    ev: ResolvedEvent<TData>;
    mode: DragMode;
    startX: number;
    startY: number;
    grabOffsetMin: number; // where inside the event the pointer grabbed (move)
    durationMin: number;
    origStart: Date;
    origEnd: Date;
    startCol: GridCol;
    moved: boolean;
    previewStart: Date;
    previewEnd: Date;
    previewCol: GridCol;
    x: number; // live cursor position, for the drag ghost that follows the pointer
    y: number;
    overAllDay: GridCol | null; // set when a move drag hovers the all-day row
  };
  let drag = $state<Drag | null>(null);
  let bodyEl = $state<HTMLElement | null>(null);
  let allDayRowEl = $state<HTMLElement | null>(null);
  let backlogEl = $state<HTMLElement | null>(null);
  // True while an event drag hovers the backlog panel (drop = unschedule).
  let dragOverBacklog = $state(false);
  let tlLanesEl = $state<HTMLElement | null>(null); // timeline: the axis-width lane track
  let tlScrollEl = $state<HTMLElement | null>(null); // timeline: the horizontal scroll viewport
  // The single scroller (.sv-sched-xscroll) owns both scroll axes; the header and
  // gutter stay in place via position:sticky, so no scrollbar-width reservation is
  // needed to keep columns aligned.
  let gridScrollEl = $state<HTMLElement | null>(null);
  let suppressClick = false;
  const DRAG_THRESHOLD = 4; // px before a press becomes a drag

  function minuteAt(clientY: number): number {
    if (!bodyEl) return dayStartHour * 60;
    const r = bodyEl.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    return dayStartHour * 60 + frac * bandHours * 60;
  }
  function colAt(clientX: number): GridCol | null {
    if (!bodyEl) return null;
    const cells = bodyEl.querySelectorAll<HTMLElement>("[data-col-key]");
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) {
        return gridCols.find((c) => c.key === cell.dataset.colKey) ?? null;
      }
    }
    return null;
  }
  // Absolute Date for a minute-of-day on `day` (handles 1440 = next midnight).
  const dateAtMinute = (day: Date, min: number): Date =>
    new Date(startOfDay(day).getTime() + min * 60000);
  const minuteOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();
  // % offsets within the visible band, for positioning an event (or its preview).
  const pctTop = (d: Date): number =>
    ((minuteOfDay(d) - dayStartHour * 60) / (bandHours * 60)) * 100;
  const pctHeight = (s: Date, e: Date): number =>
    (((e.getTime() - s.getTime()) / 60000) / (bandHours * 60)) * 100;

  function startTimeDrag(
    e: PointerEvent,
    ev: ResolvedEvent<TData>,
    col: GridCol,
    mode: DragMode,
  ) {
    if (e.button !== 0) return; // ignore right/middle button (let the context menu open)
    // Clear any stale suppress from a prior drag whose trailing click never
    // reached openEvent (e.g. a grip resize), so this press decides afresh.
    suppressClick = false;
    rangeSel = null; // dragging an event dismisses any pending cell selection
    // Recurring events ARE editable, but only when a recurrence editor is wired
    // (drag/resize edits the whole series' time-of-day + duration).
    if (!editable || ev.allDay || (ev.recurring && !recurEditable)) return;
    e.preventDefault();
    e.stopPropagation();
    drag = {
      ev,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      grabOffsetMin: Math.max(0, minuteAt(e.clientY) - minuteOfDay(ev.start)),
      durationMin: (ev.end.getTime() - ev.start.getTime()) / 60000,
      origStart: ev.start,
      origEnd: ev.end,
      startCol: col,
      moved: false,
      previewStart: ev.start,
      previewEnd: ev.end,
      previewCol: col,
      x: e.clientX,
      y: e.clientY,
      overAllDay: null,
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }
  function onDragMove(e: PointerEvent) {
    if (!drag) return;
    if (!drag.moved) {
      if (
        Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD &&
        Math.abs(e.clientY - drag.startY) < DRAG_THRESHOLD
      )
        return;
      drag.moved = true;
    }
    dragOverBacklog = drag.mode === "move" && !!scheduler.onUnschedule && !!backlogEl && pointInEl(e.clientX, e.clientY, backlogEl);
    drag.x = e.clientX;
    drag.y = e.clientY;
    const rawMin = minuteAt(e.clientY);
    const bandStart = dayStartHour * 60;
    const bandEnd = dayEndHour * 60;
    if (drag.mode === "move") {
      // Hovering the all-day row converts the move to an all-day drop: highlight
      // that day's all-day cell instead of previewing a timed block (same feedback
      // shape as dragging an all-day bar the other way).
      drag.overAllDay =
        !drag.ev.recurring && pointInEl(e.clientX, e.clientY, allDayRowEl)
          ? colAt(e.clientX) ?? drag.previewCol
          : null;
      // Recurring instances stay in their own column (a series edit changes the
      // time-of-day, not the day/resource), so lock the column for them.
      const col = drag.ev.recurring ? drag.startCol : colAt(e.clientX) ?? drag.startCol;
      const startMin = snapMinute(
        Math.min(bandEnd - drag.durationMin, Math.max(bandStart, rawMin - drag.grabOffsetMin)),
        slotMinutes,
      );
      const s = dateAtMinute(col.date, startMin);
      drag.previewStart = s;
      drag.previewEnd = new Date(s.getTime() + drag.durationMin * 60000);
      drag.previewCol = col;
    } else if (drag.mode === "resize-end") {
      const startMin = minuteOfDay(drag.origStart);
      const endMin = Math.min(
        bandEnd,
        Math.max(startMin + slotMinutes, snapMinute(rawMin, slotMinutes)),
      );
      drag.previewStart = drag.origStart;
      drag.previewEnd = dateAtMinute(drag.startCol.date, endMin);
    } else {
      // resize-start: drag the top edge, end stays put
      const endMin = minuteOfDay(drag.origEnd);
      const startMin = Math.max(
        bandStart,
        Math.min(endMin - slotMinutes, snapMinute(rawMin, slotMinutes)),
      );
      drag.previewStart = dateAtMinute(drag.startCol.date, startMin);
      drag.previewEnd = drag.origEnd;
    }
  }
  const pointInEl = (x: number, y: number, el: HTMLElement | null) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  function onDragEnd(e: PointerEvent) {
    window.removeEventListener("pointermove", onDragMove);
    const d = drag;
    drag = null;
    if (!d || !d.moved) return;
    suppressClick = true; // this drag's trailing click must not open the event
    dragOverBacklog = false;
    const { ev, previewStart, previewEnd, previewCol, mode } = d;
    const k = ev.rowKey;
    // Dropped onto the backlog panel -> unschedule the event.
    if (mode === "move" && scheduler.onUnschedule && backlogEl && pointInEl(e.clientX, e.clientY, backlogEl)) {
      scheduler.onUnschedule(ev.row);
      return;
    }
    // Dropped in the all-day row -> convert a timed event to an all-day event.
    if (mode === "move" && !ev.recurring && pointInEl(e.clientX, e.clientY, allDayRowEl)) {
      const col = colAt(e.clientX) ?? previewCol;
      allDayOf[k] = true;
      const s = startOfDay(col.date);
      const en = addDays(s, 1);
      startOfE[k] = s;
      endOfE[k] = en;
      const toResource = col.resourceId;
      if (toResource != null) resourceOfE[k] = toResource;
      emitMove({ row: ev.row, start: s, end: en, allDay: true, fromResource: ev.resourceId, toResource });
      return;
    }
    if (ev.recurring) {
      // Edit the SERIES: apply the new time-of-day (+ duration) to the base row,
      // keeping the base date, so every occurrence shifts and the pattern holds.
      const applySeries = () => {
        const baseStart = toDate(fieldValue(ev.row, scheduler.startField) as never) ?? ev.start;
        const ns = dayWithTimeOf(baseStart, previewStart);
        const ne = new Date(ns.getTime() + (previewEnd.getTime() - previewStart.getTime()));
        startOfE[k] = ns;
        endOfE[k] = ne;
        if (mode === "move") emitMove({ row: ev.row, start: ns, end: ne, allDay: false });
        else emitResize({ row: ev.row, start: ns, end: ne });
      };
      // "This event": store an override for just this occurrence.
      askRecurScope(e.clientX, e.clientY, ev, "edit", () => emitOccurrence(ev, { start: previewStart, end: previewEnd }), applySeries, () => emitOccurrence(ev, { start: previewStart, end: previewEnd }, "following"));
      return;
    }
    // Reject a double-booking (same resource) - snap back, don't apply/emit.
    const checkRes = mode === "move" ? previewCol.resourceId : ev.resourceId;
    if (bookingBlocked(previewStart, previewEnd, checkRes, k, ev.row)) return;
    startOfE[k] = previewStart;
    endOfE[k] = previewEnd;
    if (mode === "move") {
      const toResource = previewCol.resourceId;
      if (toResource != null) resourceOfE[k] = toResource;
      emitMove({
        row: ev.row,
        start: previewStart,
        end: previewEnd,
        allDay: false,
        fromResource: ev.resourceId,
        toResource,
      } satisfies SchedulerEventMoveEvent<TData>);
      applyBulkMove(k, previewStart.getTime() - d.origStart.getTime());
    } else {
      emitResize({
        row: ev.row,
        start: previewStart,
        end: previewEnd,
      } satisfies SchedulerEventResizeEvent<TData>);
    }
    pushHistory({
      key: k,
      row: ev.row,
      kind: mode === "move" ? "move" : "resize",
      before: { start: d.origStart, end: d.origEnd, resource: ev.resourceId, allDay: false },
      after: { start: previewStart, end: previewEnd, resource: mode === "move" ? previewCol.resourceId : ev.resourceId, allDay: false },
    });
  }

  // --- month drag: shift an event by whole days. `overDay` (the timestamp of
  // the day cell under the cursor) + a moved flag drive the visual feedback. ---
  let monthDrag = $state<{ ev: ResolvedEvent<TData>; startX: number; startY: number; moved: boolean } | null>(null);
  let monthOverDay = $state<number | null>(null);
  let monthDragPos = $state({ x: 0, y: 0 });
  function startMonthDrag(e: PointerEvent, ev: ResolvedEvent<TData>) {
    if (e.button !== 0) return; // ignore right/middle button (let the context menu open)
    suppressClick = false;
    if (!editable || ev.recurring) return;
    e.preventDefault();
    monthDrag = { ev, startX: e.clientX, startY: e.clientY, moved: false };
    monthOverDay = null;
    monthDragPos = { x: e.clientX, y: e.clientY };
    window.addEventListener("pointermove", onMonthMove);
    window.addEventListener("pointerup", onMonthDrop, { once: true });
  }
  function onMonthMove(e: PointerEvent) {
    if (!monthDrag) return;
    if (
      !monthDrag.moved &&
      Math.abs(e.clientX - monthDrag.startX) < DRAG_THRESHOLD &&
      Math.abs(e.clientY - monthDrag.startY) < DRAG_THRESHOLD
    )
      return;
    monthDrag.moved = true;
    monthDragPos = { x: e.clientX, y: e.clientY };
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-day]");
    monthOverDay = el?.dataset.day ? Number(el.dataset.day) : null;
  }
  function onMonthDrop(e: PointerEvent) {
    window.removeEventListener("pointermove", onMonthMove);
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-day]");
    if (monthDrag?.moved && el?.dataset.day) {
      const target = new Date(Number(el.dataset.day));
      const ev = monthDrag.ev;
      const dayDelta = Math.round((startOfDay(target).getTime() - startOfDay(ev.start).getTime()) / 86400000);
      if (dayDelta !== 0) {
        suppressClick = true; // the drop's trailing click must not open the event
        const s = addDays(ev.start, dayDelta);
        const en = addDays(ev.end, dayDelta);
        startOfE[ev.rowKey] = s;
        endOfE[ev.rowKey] = en;
        emitMove({ row: ev.row, start: s, end: en, allDay: ev.allDay });
      }
    }
    monthDrag = null;
    monthOverDay = null;
  }

  // --- month resize: drag a chip's left/right edge across days to change the
  // event's start / end date (keeping its time-of-day). ---
  let monthResize = $state<{ ev: ResolvedEvent<TData>; edge: "start" | "end"; startX: number; startY: number; moved: boolean } | null>(null);
  function startMonthResize(e: PointerEvent, ev: ResolvedEvent<TData>, edge: "start" | "end") {
    if (e.button !== 0) return; // ignore right/middle button (let the context menu open)
    suppressClick = false;
    if (!editable || ev.recurring) return;
    e.preventDefault();
    e.stopPropagation();
    monthResize = { ev, edge, startX: e.clientX, startY: e.clientY, moved: false };
    monthOverDay = null;
    window.addEventListener("pointermove", onMonthResizeMove);
    window.addEventListener("pointerup", onMonthResizeEnd, { once: true });
  }
  // Combine a target day (midnight) with an existing datetime's time-of-day.
  function dayWithTimeOf(day: Date, timeOf: Date): Date {
    const d = new Date(day);
    d.setHours(timeOf.getHours(), timeOf.getMinutes(), timeOf.getSeconds(), 0);
    return d;
  }
  // Compute + apply a day-edge resize to the overlay (LIVE, so the bar grows as
  // you drag). Shared by the month bars and the week/day all-day bars. A TIMED
  // multi-day event keeps its time-of-day; an ALL-DAY event snaps to whole days,
  // treating the hovered column as the inclusive edge day (its end is the
  // exclusive next-midnight, matching how the spanning segments are laid out).
  function applyDayEdgeResize(ev: ResolvedEvent<TData>, edge: "start" | "end", targetDayMs: number) {
    const targetDay = startOfDay(new Date(targetDayMs));
    const k = ev.rowKey;
    if (edge === "end") {
      if (ev.allDay) {
        const startDay = startOfDay(ev.start);
        const lastDay = targetDay.getTime() < startDay.getTime() ? startDay : targetDay;
        endOfE[k] = addDays(lastDay, 1); // exclusive midnight after the last day
      } else {
        const day = targetDay.getTime() < startOfDay(ev.start).getTime() ? startOfDay(ev.start) : targetDay;
        let ne = dayWithTimeOf(day, ev.end);
        if (ne.getTime() <= ev.start.getTime()) ne = new Date(ev.start.getTime() + 30 * 60000);
        endOfE[k] = ne;
      }
    } else {
      if (ev.allDay) {
        // last visible day = startOfDay(end - 1ms); don't let start pass it.
        const lastDay = startOfDay(new Date(ev.end.getTime() - 1));
        startOfE[k] = targetDay.getTime() > lastDay.getTime() ? lastDay : targetDay;
      } else {
        const day = targetDay.getTime() > startOfDay(ev.end).getTime() ? startOfDay(ev.end) : targetDay;
        let ns = dayWithTimeOf(day, ev.start);
        if (ns.getTime() >= ev.end.getTime()) ns = new Date(ev.end.getTime() - 30 * 60000);
        startOfE[k] = ns;
      }
    }
  }
  function onMonthResizeMove(e: PointerEvent) {
    if (!monthResize) return;
    if (
      !monthResize.moved &&
      Math.abs(e.clientX - monthResize.startX) < DRAG_THRESHOLD &&
      Math.abs(e.clientY - monthResize.startY) < DRAG_THRESHOLD
    )
      return;
    monthResize.moved = true;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-day]");
    monthOverDay = el?.dataset.day ? Number(el.dataset.day) : null;
    if (monthOverDay != null) applyDayEdgeResize(monthResize.ev, monthResize.edge, monthOverDay);
  }
  function onMonthResizeEnd() {
    window.removeEventListener("pointermove", onMonthResizeMove);
    const r = monthResize;
    monthResize = null;
    monthOverDay = null;
    if (!r || !r.moved) return;
    suppressClick = true;
    const ev = r.ev;
    const k = ev.rowKey;
    emitResize({ row: ev.row, start: startOfE[k] ?? ev.start, end: endOfE[k] ?? ev.end });
  }

  // Double-clicking an empty month day adds an event on that day.
  function onMonthSlotAdd(day: Date) {
    monthRangeSel = null; // a double-click creates directly - drop the click's marker
    if (!scheduler.onEventAdd) return;
    const s = new Date(day);
    s.setHours(9, 0, 0, 0);
    emitAdd(s, new Date(s.getTime() + (scheduler.defaultDurationMin ?? 60) * 60000));
  }

  // --- month day-cell range selection: click / drag whole days to mark an
  // all-day date range, then Enter / "Add Event" to create (arrows navigate). ---
  let monthRangeSel = $state<{ anchor: number; cur: number; moved: boolean; pending?: boolean } | null>(null);
  let monthRangeDown: { day: number; startX: number; startY: number; dragging: boolean } | null = null;
  function dayAtPoint(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-day]");
    return el?.dataset.day ? Number(el.dataset.day) : null;
  }
  function startMonthRangeSelect(day: Date, e: PointerEvent) {
    if (!rangeSelectable || e.button !== 0) return;
    e.preventDefault(); // don't let the drag start a native text selection
    suppressClick = false;
    monthRangeDown = { day: startOfDay(day).getTime(), startX: e.clientX, startY: e.clientY, dragging: false };
    window.addEventListener("pointermove", onMonthRangeSelectMove);
    window.addEventListener("pointerup", onMonthRangeSelectEnd, { once: true });
  }
  function onMonthRangeSelectMove(e: PointerEvent) {
    if (!monthRangeDown) return;
    if (!monthRangeDown.dragging) {
      if (Math.abs(e.clientX - monthRangeDown.startX) < DRAG_THRESHOLD && Math.abs(e.clientY - monthRangeDown.startY) < DRAG_THRESHOLD) return;
      monthRangeDown.dragging = true;
    }
    const t = dayAtPoint(e.clientX, e.clientY);
    monthRangeSel = { anchor: monthRangeDown.day, cur: t ?? monthRangeDown.day, moved: true, pending: true };
  }
  function onMonthRangeSelectEnd() {
    window.removeEventListener("pointermove", onMonthRangeSelectMove);
    const down = monthRangeDown;
    monthRangeDown = null;
    if (!down) return;
    if (down.dragging) { suppressClick = true; return; } // a drag already marked the range
    // A plain click marks a single day (keyboard nav starting point).
    monthRangeSel = { anchor: down.day, cur: down.day, moved: true, pending: true };
  }
  const monthRangeDays = $derived.by(() => {
    if (!monthRangeSel || !monthRangeSel.moved) return null;
    return { lo: Math.min(monthRangeSel.anchor, monthRangeSel.cur), hi: Math.max(monthRangeSel.anchor, monthRangeSel.cur) };
  });
  const isMonthCellSelected = (date: Date) => {
    if (!monthRangeDays) return false;
    const t = startOfDay(date).getTime();
    return t >= monthRangeDays.lo && t <= monthRangeDays.hi;
  };
  function commitMonthRangeSelect() {
    const sel = monthRangeSel;
    if (!sel || !sel.moved) return;
    const lo = Math.min(sel.anchor, sel.cur);
    const hi = Math.max(sel.anchor, sel.cur);
    const start = new Date(lo);
    const end = addDays(new Date(hi), 1); // inclusive last day -> next midnight
    const days: Date[] = [];
    for (let d = new Date(lo); d.getTime() <= hi; d = addDays(d, 1)) days.push(new Date(d));
    monthRangeSel = null;
    if (scheduler.onRangeSelect) emitRange({ start, end, allDay: true, days, resourceIds: [] });
    else emitAdd(start, end, undefined, true);
  }
  function moveMonthRangeSelect(dDays: number, extend: boolean) {
    const sel = monthRangeSel;
    if (!sel) return;
    const first = monthWeeks[0]![0]!.date.getTime();
    const last = monthWeeks[monthWeeks.length - 1]![6]!.date.getTime();
    const nextCur = Math.min(last, Math.max(first, addDays(new Date(sel.cur), dDays).getTime()));
    monthRangeSel = extend
      ? { anchor: sel.anchor, cur: nextCur, moved: true, pending: true }
      : { anchor: nextCur, cur: nextCur, moved: true, pending: true };
  }

  // --- all-day BAR drag (week time-grid): move across days within the all-day
  // row, or drop into the hourly grid to convert the event to a timed one. ---
  let allDayDrag = $state<{ ev: ResolvedEvent<TData>; startX: number; startY: number; moved: boolean; x: number; y: number } | null>(null);
  // Live drop preview: a timed block in the hourly grid, or the target day in
  // the all-day row - drives the visual feedback while dragging an all-day bar.
  let allDayPreview = $state<
    | { kind: "timed"; colKey: string; topPct: number; heightPct: number; label: string }
    | { kind: "allday"; colKey: string }
    | null
  >(null);
  function startAllDayDrag(e: PointerEvent, ev: ResolvedEvent<TData>) {
    if (e.button !== 0) return; // ignore right/middle button (let the context menu open)
    suppressClick = false;
    if (!editable || ev.recurring) return;
    e.preventDefault();
    e.stopPropagation();
    allDayDrag = { ev, startX: e.clientX, startY: e.clientY, moved: false, x: e.clientX, y: e.clientY };
    allDayPreview = null;
    window.addEventListener("pointermove", onAllDayDragMove);
    window.addEventListener("pointerup", onAllDayDragEnd, { once: true });
  }
  function onAllDayDragMove(e: PointerEvent) {
    if (!allDayDrag) return;
    if (
      !allDayDrag.moved &&
      Math.abs(e.clientX - allDayDrag.startX) < DRAG_THRESHOLD &&
      Math.abs(e.clientY - allDayDrag.startY) < DRAG_THRESHOLD
    )
      return;
    allDayDrag.moved = true;
    allDayDrag.x = e.clientX;
    allDayDrag.y = e.clientY;
    const col = colAt(e.clientX);
    if (col && bodyEl && pointInEl(e.clientX, e.clientY, bodyEl)) {
      const min = snapMinute(minuteAt(e.clientY), slotMinutes);
      const durMin = Math.max(slotMinutes, Math.min((allDayDrag.ev.end.getTime() - allDayDrag.ev.start.getTime()) / 60000, 240));
      allDayPreview = {
        kind: "timed",
        colKey: col.key,
        topPct: ((min - dayStartHour * 60) / (bandHours * 60)) * 100,
        heightPct: (durMin / (bandHours * 60)) * 100,
        label: fmtTime(dateAtMinute(col.date, min)),
      };
    } else if (col && allDayRowEl && pointInEl(e.clientX, e.clientY, allDayRowEl)) {
      allDayPreview = { kind: "allday", colKey: col.key };
    } else {
      allDayPreview = null;
    }
  }
  function onAllDayDragEnd(e: PointerEvent) {
    window.removeEventListener("pointermove", onAllDayDragMove);
    const d = allDayDrag;
    allDayDrag = null;
    allDayPreview = null;
    if (!d || !d.moved) return;
    suppressClick = true;
    const ev = d.ev;
    const k = ev.rowKey;
    const durationMs = ev.end.getTime() - ev.start.getTime();
    const col = colAt(e.clientX);
    if (bodyEl && pointInEl(e.clientX, e.clientY, bodyEl) && col) {
      // Dropped in the hourly grid -> convert to a TIMED event at the drop time.
      const min = snapMinute(minuteAt(e.clientY), slotMinutes);
      const s = dateAtMinute(col.date, min);
      const en = new Date(s.getTime() + Math.max(slotMinutes * 60000, Math.min(durationMs, 4 * 3600000)));
      allDayOf[k] = false;
      startOfE[k] = s;
      endOfE[k] = en;
      if (col.resourceId != null) resourceOfE[k] = col.resourceId;
      emitMove({ row: ev.row, start: s, end: en, allDay: false, fromResource: ev.resourceId, toResource: col.resourceId });
      return;
    }
    // Otherwise move by whole days within the all-day row (colAt resolves the
    // column from the x position, so it works over the all-day row too).
    if (col) {
      const dayDelta = Math.round((startOfDay(col.date).getTime() - startOfDay(ev.start).getTime()) / 86400000);
      if (dayDelta !== 0) {
        const s = addDays(ev.start, dayDelta);
        const en = addDays(ev.end, dayDelta);
        startOfE[k] = s;
        endOfE[k] = en;
        emitMove({ row: ev.row, start: s, end: en, allDay: true });
      }
    }
  }

  // --- all-day BAR resize (week/day all-day row): drag a bar's left/right edge
  // across day columns to change the event's start / end DATE (keeping its
  // time-of-day), the same day-based edge resize the month bars use. ---
  let allDayResize = $state<{ ev: ResolvedEvent<TData>; edge: "start" | "end"; startX: number; startY: number; moved: boolean } | null>(null);
  function startAllDayResize(e: PointerEvent, ev: ResolvedEvent<TData>, edge: "start" | "end") {
    if (e.button !== 0) return; // ignore right/middle button (let the context menu open)
    suppressClick = false;
    if (!editable || ev.recurring) return;
    e.preventDefault();
    e.stopPropagation();
    allDayResize = { ev, edge, startX: e.clientX, startY: e.clientY, moved: false };
    window.addEventListener("pointermove", onAllDayResizeMove);
    window.addEventListener("pointerup", onAllDayResizeEnd, { once: true });
  }
  function onAllDayResizeMove(e: PointerEvent) {
    if (!allDayResize) return;
    if (
      !allDayResize.moved &&
      Math.abs(e.clientX - allDayResize.startX) < DRAG_THRESHOLD &&
      Math.abs(e.clientY - allDayResize.startY) < DRAG_THRESHOLD
    )
      return;
    allDayResize.moved = true;
    // Resolve the day column under the pointer and apply live (the bar re-lays
    // out as allDaySegs recomputes, so it grows / shrinks as you drag).
    const col = colAt(e.clientX);
    if (col) applyDayEdgeResize(allDayResize.ev, allDayResize.edge, startOfDay(col.date).getTime());
  }
  function onAllDayResizeEnd() {
    window.removeEventListener("pointermove", onAllDayResizeMove);
    const r = allDayResize;
    allDayResize = null;
    if (!r || !r.moved) return;
    suppressClick = true;
    const ev = r.ev;
    const k = ev.rowKey;
    emitResize({ row: ev.row, start: startOfE[k] ?? ev.start, end: endOfE[k] ?? ev.end });
  }

  // --- keyboard move (a11y): arrows nudge the focused event ---
  function onEventKey(e: KeyboardEvent, ev: ResolvedEvent<TData>) {
    if (!editable || ev.recurring) return;
    let dDay = 0;
    let dMin = 0;
    if (e.key === "ArrowLeft") dDay = -1;
    else if (e.key === "ArrowRight") dDay = 1;
    else if (e.key === "ArrowUp") dMin = -slotMinutes;
    else if (e.key === "ArrowDown") dMin = slotMinutes;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openEvent(ev);
      return;
    } else return;
    e.preventDefault();
    const s = new Date(ev.start.getTime() + dDay * 86400000 + dMin * 60000);
    const en = new Date(ev.end.getTime() + dDay * 86400000 + dMin * 60000);
    startOfE[ev.rowKey] = s;
    endOfE[ev.rowKey] = en;
    emitMove({ row: ev.row, start: s, end: en, allDay: ev.allDay, toResource: ev.resourceId });
  }

  // --- context menu (mirrors SvGridBoard's dismissable-layer pattern) ---
  let menuOpen = $state(false);
  let menuItems = $state<MenuItem[]>([]);
  let menuPos = $state({ x: 0, y: 0 });
  let menuPanel = $state<HTMLElement | null>(null);
  // Clipboard: duplicate an event right after itself (same resource + duration).
  function duplicateEvent(ev: ResolvedEvent<TData>) {
    const dur = ev.end.getTime() - ev.start.getTime();
    emitAdd(new Date(ev.end.getTime()), new Date(ev.end.getTime() + dur), ev.resourceId, ev.allDay);
  }
  function openMenu(e: MouseEvent, ev: ResolvedEvent<TData>) {
    // Default actions (Edit / Duplicate / Delete) + any custom `eventMenu` items.
    const items: MenuItem[] = [];
    if (scheduler.drawer) items.push({ label: "Edit", onSelect: () => doOpenEvent(ev) });
    if (scheduler.onEventAdd) items.push({ label: "Duplicate", onSelect: () => duplicateEvent(ev) });
    if (scheduler.onEventDelete)
      items.push({
        label: "Delete",
        onSelect: () =>
          askRecurScope(e.clientX, e.clientY, ev, "delete", () => emitOccurrence(ev, { deleted: true }), () => scheduler.onEventDelete!(ev.row), () => emitOccurrence(ev, { deleted: true }, "following")),
      });
    const custom = scheduler.eventMenu?.(ev.row);
    if (custom?.length) {
      if (items.length) items.push({ separator: true });
      items.push(...custom);
    }
    if (!items.length) return;
    e.preventDefault();
    e.stopPropagation();
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
    const offScroll = onScrollOutside(
      () => menuPanel,
      () => (menuOpen = false),
    );
    return () => {
      layer.release();
      offScroll();
    };
  });

  // Scope-choice popover for recurring-occurrence edits (dismiss = cancel).
  let scopePanel = $state<HTMLElement | null>(null);
  $effect(() => {
    if (!recurScope) return;
    const layer = createDismissableLayer({
      element: () => scopePanel,
      onDismiss: () => (recurScope = null),
    });
    layer.activate();
    return () => layer.release();
  });

  // --- "+N more" popover: a list of the events a cap-overflow tile (or a month
  // day cell) couldn't show. Clicking one opens it. Same dismissable pattern. ---
  let listOpen = $state(false);
  let listEvents = $state<ResolvedEvent<TData>[]>([]);
  let listTitle = $state("");
  let listPos = $state({ x: 0, y: 0 });
  let listPanel = $state<HTMLElement | null>(null);
  function openList(e: MouseEvent, evs: ResolvedEvent<TData>[], title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    listEvents = [...evs].sort((a, b) => a.start.getTime() - b.start.getTime());
    listTitle = title;
    listPos = { x: e.clientX, y: e.clientY };
    listOpen = true;
  }
  function pickFromList(ev: ResolvedEvent<TData>) {
    listOpen = false;
    openEvent(ev);
  }
  $effect(() => {
    if (!listOpen) return;
    const layer = createDismissableLayer({
      element: () => listPanel,
      onDismiss: () => (listOpen = false),
    });
    layer.activate();
    const offScroll = onScrollOutside(
      () => listPanel,
      () => (listOpen = false),
    );
    return () => {
      layer.release();
      offScroll();
    };
  });

  // --- detail drawer / editor (mirrors SvGridBoard) ---
  let drawerRow = $state.raw<TData | null>(null);
  // The resolved event the drawer was opened on (carries recurring/occurrenceStart
  // so a recurring-occurrence edit can ask This / Following / All on save).
  let drawerEv = $state.raw<ResolvedEvent<TData> | null>(null);
  // `drawerOpen` drives the SvDrawer open/close animation independently of
  // `drawerRow`: on close we flip it false so the panel slides out, and clear
  // `drawerRow` only once the exit finishes (SvDrawer.onClosed) so the content
  // stays rendered while it animates away.
  let drawerOpen = $state(false);
  // For a recurring occurrence, the drawer shows a "Apply changes to" selector
  // (This event / This and following / All events) so the scope is chosen inline.
  let drawerScope = $state<"occurrence" | "following" | "series">("occurrence");
  const showScope = $derived(hasExceptions && !!drawerEv?.recurring && !!drawerEv?.occurrenceStart);
  const drawerCfg = $derived(
    scheduler.drawer && typeof scheduler.drawer === "object" ? scheduler.drawer : null,
  );
  type DrawerCol = ColumnDef<TFeatures, TData>;
  // The start / end / all-day fields get the dedicated "When" editor, so keep
  // them out of the auto-generated SvForm to avoid duplicate + date-only inputs.
  const whenFields = $derived(
    new Set([scheduler.startField, scheduler.endField, scheduler.allDayField].filter(Boolean) as string[]),
  );
  const drawerFieldCols = $derived.by<DrawerCol[]>(() => {
    const wanted = drawerCfg?.fields;
    const base = wanted?.length
      ? wanted.map((f) => fieldColumns.find((c) => c.field === f)).filter((c): c is DrawerCol => !!c)
      : fieldColumns;
    return base.filter((c) => !whenFields.has(c.field as string));
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
      case "password": return "password";
      case "color": return "color";
      case "list":
      case "select":
      case "rich-select": return "select";
      case "chips":
      case "multiselect":
      case "multiSelect":
      case "tags": return "multiselect";
      default: return "text";
    }
  }
  function drawerOptions(col: DrawerCol, row: TData) {
    const raw = typeof col.editorOptions === "function" ? col.editorOptions(row) : col.editorOptions;
    if (!raw) return undefined;
    return raw.map((o) =>
      typeof o === "object" && o != null && "value" in o
        ? {
            value: (o as { value: unknown }).value as string | number,
            label: String((o as { label?: unknown }).label ?? (o as { value: unknown }).value),
            // Carry a color swatch through so the drawer's select shows it.
            color: (o as { color?: unknown }).color as string | undefined,
          }
        : { value: o as string | number, label: String(o) },
    );
  }
  let drawerInitial = $state<Record<string, unknown>>({});
  // Live mirror of the form's field values (via SvForm onChange), so dismissing
  // the drawer by clicking outside can commit the current edits.
  let drawerValues = $state<Record<string, unknown>>({});

  // --- "When" editor: all-day toggle + start/end datetime pickers (show + edit
  // the time). Held as Date objects for the SvDateTimePicker, written back as
  // local ISO strings so consumers keep a string. ---
  const whenHasAllDay = $derived(!!scheduler.allDayField);
  let whenAllDay = $state(false);
  let whenStart = $state<Date | null>(null);
  let whenEnd = $state<Date | null>(null);
  // Serialize a Date to a local ISO string: 'YYYY-MM-DDTHH:mm' (timed) or
  // 'YYYY-MM-DD' (all-day) - the same shape the demos store on their rows.
  const isoLocal = (d: Date | null | undefined, allDay: boolean) => {
    if (!d) return "";
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return allDay ? s : `${s}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  // The drawer holds pseudo-local dates (zone wall-clock); serialize back to the
  // consumer as a real instant in a `timeZone`, else the local ISO shape.
  const serializeWhen = (d: Date | null | undefined, allDay: boolean) => {
    if (!d) return "";
    if (!tz) return isoLocal(d, allDay);
    return allDay ? isoLocal(d, true) : fromZ(d).toISOString();
  };
  function loadWhen(row: TData) {
    whenAllDay = scheduler.allDayField ? !!fieldValue(row, scheduler.allDayField) : false;
    whenStart = (toZ(fieldValue(row, scheduler.startField)) ?? null) as Date | null;
    whenEnd = scheduler.endField ? ((toZ(fieldValue(row, scheduler.endField)) ?? null) as Date | null) : whenStart;
  }
  // Toggling all-day normalizes the two dates (midnight for all-day, else 9/10h).
  function setWhenAllDay(v: boolean) {
    whenAllDay = v;
    if (whenStart)
      whenStart = v ? startOfDay(whenStart) : new Date(whenStart.getFullYear(), whenStart.getMonth(), whenStart.getDate(), 9, 0);
    if (whenEnd)
      whenEnd = v ? startOfDay(whenEnd) : new Date(whenEnd.getFullYear(), whenEnd.getMonth(), whenEnd.getDate(), 10, 0);
  }

  // --- recurrence pattern editor (in the drawer, when recurrenceField is set).
  // An enterprise-grade single-rule editor: None / Daily / Weekly / Monthly /
  // Yearly + interval, weekday chips, monthly by day-of-month / positional
  // weekday / last day, yearly by month + date or positional weekday, and an
  // end condition (never / on a date / after N occurrences). ---
  type RecFreq = "" | "daily" | "weekly" | "monthly" | "yearly";
  type MonthMode = "day" | "weekday" | "lastday";
  type YearMode = "day" | "weekday";
  type RecEnd = "never" | "until" | "count";
  const REPEAT_OPTIONS = [
    { value: "", label: "Does not repeat" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ] as const;
  const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const WEEKDAY_OPTIONS = $derived(headerOrder.map((d) => ({ value: d, label: WEEKDAYS_FULL[d] ?? "" })));
  const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i, label: m }));
  const WEEK_OF_MONTH_OPTIONS = [
    { value: 1, label: "first" },
    { value: 2, label: "second" },
    { value: 3, label: "third" },
    { value: 4, label: "fourth" },
    { value: -1, label: "last" },
  ] as const;
  const MONTH_MODE_OPTIONS = [
    { value: "day", label: "On a day of the month" },
    { value: "weekday", label: "On a weekday of the month" },
    { value: "lastday", label: "On the last day" },
  ] as const;
  const YEAR_MODE_OPTIONS = [
    { value: "day", label: "On a specific date" },
    { value: "weekday", label: "On a weekday" },
  ] as const;
  const END_OPTIONS = [
    { value: "never", label: "Never" },
    { value: "until", label: "On a date" },
    { value: "count", label: "After a number of times" },
  ] as const;
  // The recurrence editor is offered whenever the drawer is on, so any event can
  // be made recurring (or have its pattern removed) - it never needs an explicit
  // `recurrenceField` to appear.
  const recurEditable = $derived(!!scheduler.drawer);
  let recFreq = $state<RecFreq>("");
  let recInterval = $state(1);
  let recWeekdays = $state<Set<number>>(new Set());
  let recDay = $state(1);
  let recMonthMode = $state<MonthMode>("day");
  let recYearMode = $state<YearMode>("day");
  let recMonth = $state(0);
  let recWeekOfMonth = $state(1);
  let recPosWeekday = $state(1);
  let recEnd = $state<RecEnd>("never");
  let recUntil = $state<Date | null>(null);
  let recCount = $state(10);
  let recFrom = $state<string>("");
  const isoDate = (d: Date | null | undefined) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  function loadRule(row: TData) {
    const anchor = toDate(fieldValue(row, scheduler.startField) as never) ?? new Date();
    const raw = fieldValue(row, recurField);
    const rule = (Array.isArray(raw) ? raw[0] : raw) as RecurrenceRule | null | undefined;
    // Sensible defaults seeded from the event's own start date, so turning a
    // one-off into a recurring event pre-fills "this weekday / this date".
    recInterval = 1;
    recWeekdays = new Set([anchor.getDay()]);
    recDay = anchor.getDate();
    recMonth = anchor.getMonth();
    recMonthMode = "day";
    recYearMode = "day";
    // Seed the positional week so its occurrence lands on the anchor's own date:
    // use "last" when the anchor is the final same-weekday of its month (incl. a
    // 5th week), else the 1..4 ordinal - so a positional pattern reproduces the
    // event's start date rather than an earlier (clamped) one.
    const dim = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    recWeekOfMonth = anchor.getDate() + 7 > dim ? -1 : Math.floor((anchor.getDate() - 1) / 7) + 1;
    recPosWeekday = anchor.getDay();
    recEnd = "never";
    recUntil = null;
    recCount = 10;
    recFrom = "";
    if (rule && typeof rule === "object" && rule.freq) {
      recFreq = rule.freq;
      recInterval = Math.max(1, Math.floor(rule.interval ?? 1));
      if (rule.weekdays?.length) recWeekdays = new Set(rule.weekdays);
      recFrom = rule.from ? isoDate(toDate(rule.from)) : "";
      if (rule.month != null) recMonth = rule.month;
      // Monthly / yearly "where in the month": positional weekday, last day, or day.
      if (rule.weekOfMonth != null && rule.weekdays?.length) {
        recMonthMode = "weekday";
        recYearMode = "weekday";
        recWeekOfMonth = rule.weekOfMonth;
        recPosWeekday = rule.weekdays[0]!;
      } else if (rule.day === -1) {
        recMonthMode = "lastday";
      } else if (rule.day != null) {
        recMonthMode = "day";
        recYearMode = "day";
        recDay = rule.day;
      }
      // End condition.
      if (rule.count != null) {
        recEnd = "count";
        recCount = Math.max(1, Math.floor(rule.count));
      } else if (rule.until) {
        recEnd = "until";
        recUntil = toDate(rule.until) ?? null;
      }
    } else {
      recFreq = "";
    }
  }
  function toggleWeekday(d: number) {
    const next = new Set(recWeekdays);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    recWeekdays = next;
  }
  function buildRule(row: TData): RecurrenceRule | undefined {
    if (!recFreq) return undefined;
    const rule: RecurrenceRule = { freq: recFreq };
    if (recInterval > 1) rule.interval = recInterval;
    if (recFreq === "weekly" && recWeekdays.size) rule.weekdays = [...recWeekdays].sort((a, b) => a - b);
    if (recFreq === "monthly") {
      if (recMonthMode === "weekday") {
        rule.weekOfMonth = recWeekOfMonth;
        rule.weekdays = [recPosWeekday];
      } else if (recMonthMode === "lastday") {
        rule.day = -1;
      } else if (recDay) {
        rule.day = recDay;
      }
    }
    if (recFreq === "yearly") {
      rule.month = recMonth;
      if (recYearMode === "weekday") {
        rule.weekOfMonth = recWeekOfMonth;
        rule.weekdays = [recPosWeekday];
      } else if (recDay) {
        rule.day = recDay;
      }
    }
    // End condition: an explicit occurrence count, or an until date.
    if (recEnd === "count") rule.count = Math.max(1, Math.floor(recCount));
    else if (recEnd === "until" && recUntil) rule.until = isoDate(recUntil);
    // Anchor `from` when the phase matters (interval > 1, count, or a positional
    // pattern), or preserve an existing anchor.
    const needsAnchor = recInterval > 1 || recEnd === "count";
    if (needsAnchor) rule.from = recFrom || isoDate(toDate(fieldValue(row, scheduler.startField) as never));
    else if (recFrom) rule.from = recFrom;
    return rule;
  }

  const drawerFields = $derived.by<FormField[]>(() => {
    const row = drawerRow;
    if (!row) return [];
    return drawerFieldCols.map((col) => {
      const f = col.field as string;
      return {
        name: f,
        label: typeof col.header === "string" ? col.header : f,
        type: formType(col.editorType),
        options: drawerOptions(col, row),
      } satisfies FormField;
    });
  });
  function openEvent(ev: ResolvedEvent<TData>) {
    // A click that ended a drag/resize must not also open the event.
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    doOpenEvent(ev);
  }
  function doOpenEvent(ev: ResolvedEvent<TData>) {
    rangeSel = null; // opening an event dismisses any pending cell selection
    tlRangeSel = null;
    monthRangeSel = null;
    if (scheduler.drawer) {
      const row = ev.row;
      const next: Record<string, unknown> = {};
      for (const col of drawerFieldCols) {
        const f = col.field as string;
        next[f] = fieldValue(row, f);
      }
      drawerInitial = next;
      drawerValues = { ...next };
      if (recurEditable) loadRule(row);
      loadWhen(row);
      // For a recurring OCCURRENCE the "When" fields must show THIS occurrence's
      // time, not the series' base start (else editing it looks like a start
      // change and mis-anchors a "following" split). ev.start/end are already in
      // the display zone (resolved), matching loadWhen.
      if (ev.recurring && ev.occurrenceStart) {
        whenStart = ev.start;
        whenEnd = ev.end ?? whenEnd;
        whenAllDay = ev.allDay;
      }
      drawerScope = "occurrence"; // default a recurring edit to "This event"
      drawerRow = row;
      drawerEv = ev;
      drawerOpen = true;
    }
  }

  // --- multi-select existing events (Ctrl/Cmd-click, Shift range, Delete) ---
  // On by default; opt out with `eventSelectable: false`.
  const eventSelectable = $derived(scheduler.eventSelectable !== false);
  let selectedKeys = $state<Set<string>>(new Set());
  const isSelected = (ev: ResolvedEvent<TData>) => selectedKeys.has(ev.rowKey);
  function emitSelection() {
    const seen = new Set<string>();
    const rows: TData[] = [];
    for (const e of events) if (selectedKeys.has(e.rowKey) && !seen.has(e.rowKey)) { seen.add(e.rowKey); rows.push(e.row); }
    scheduler.onEventSelectionChange?.(rows);
  }
  function onEventClick(e: MouseEvent, ev: ResolvedEvent<TData>) {
    if (suppressClick) { suppressClick = false; return; }
    if (eventSelectable && (e.ctrlKey || e.metaKey)) {
      const next = new Set(selectedKeys);
      if (next.has(ev.rowKey)) next.delete(ev.rowKey);
      else next.add(ev.rowKey);
      selectedKeys = next;
      emitSelection();
      return;
    }
    if (eventSelectable && e.shiftKey && selectedKeys.size) {
      // Range-select by start order across the resolved events.
      const ordered = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
      const idxs = ordered.map((o, i) => ({ o, i })).filter(({ o }) => selectedKeys.has(o.rowKey) || o.rowKey === ev.rowKey).map(({ i }) => i);
      const lo = Math.min(...idxs), hi = Math.max(...idxs);
      const next = new Set(selectedKeys);
      for (let i = lo; i <= hi; i++) next.add(ordered[i]!.rowKey);
      selectedKeys = next;
      emitSelection();
      return;
    }
    if (eventSelectable && selectedKeys.size) { selectedKeys = new Set(); emitSelection(); }
    doOpenEvent(ev);
  }
  // Apply the same time (+resource) delta the dragged event took to every OTHER
  // selected event, so a multi-selection moves together.
  function applyBulkMove(draggedKey: string, deltaMs: number) {
    if (!eventSelectable || selectedKeys.size < 2 || !selectedKeys.has(draggedKey)) return;
    const seen = new Set<string>([draggedKey]);
    for (const e of events) {
      if (!selectedKeys.has(e.rowKey) || seen.has(e.rowKey) || e.recurring) continue;
      seen.add(e.rowKey);
      const ns = new Date(e.start.getTime() + deltaMs);
      const ne = new Date(e.end.getTime() + deltaMs);
      startOfE[e.rowKey] = ns;
      endOfE[e.rowKey] = ne;
      emitMove({ row: e.row, start: ns, end: ne, allDay: e.allDay, fromResource: e.resourceId, toResource: e.resourceId });
    }
  }
  $effect(() => {
    if (!eventSelectable) return;
    const onKey = (e: KeyboardEvent) => {
      if (!selectedKeys.size) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!scheduler.onEventDelete) return;
        e.preventDefault();
        const seen = new Set<string>();
        for (const ev of events) if (selectedKeys.has(ev.rowKey) && !seen.has(ev.rowKey)) { seen.add(ev.rowKey); scheduler.onEventDelete(ev.row); }
        selectedKeys = new Set();
        emitSelection();
      } else if (e.key === "Escape") {
        selectedKeys = new Set();
        emitSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- range selection: drag empty cells to mark a time range / rectangle ---
  // A drag only *marks* the range (`pending`); the event is created on an
  // explicit confirm - Enter, or the "Add Event" context menu - never on release.
  // On by default; opt out with `rangeSelectable: false`.
  const rangeSelectable = $derived(scheduler.rangeSelectable !== false);
  type RangeSel = { anchorCol: GridCol; anchorMin: number; curCol: GridCol; curMin: number; moved: boolean; pending?: boolean; allDay?: boolean };
  let rangeSel = $state<RangeSel | null>(null);
  // The active press. Kept separate so a pointerdown never blanks the current
  // mirror (which caused a flash on the 2nd click of a double-click); the visible
  // selection only updates once we know it's a drag (move) or a click (up).
  let rangeDown: { col: GridCol; min: number; allDay: boolean; startX: number; startY: number; dragging: boolean } | null = null;
  function startRangeSelect(col: GridCol, e: PointerEvent) {
    if (!rangeSelectable || e.button !== 0) return;
    suppressClick = false;
    e.preventDefault();
    rangeDown = { col, min: snapMinute(minuteAt(e.clientY), slotMinutes), allDay: false, startX: e.clientX, startY: e.clientY, dragging: false };
    window.addEventListener("pointermove", onRangeSelectMove);
    window.addEventListener("pointerup", onRangeSelectEnd, { once: true });
  }
  function onRangeSelectMove(e: PointerEvent) {
    if (!rangeDown) return;
    if (!rangeDown.dragging) {
      if (Math.abs(e.clientX - rangeDown.startX) < DRAG_THRESHOLD && Math.abs(e.clientY - rangeDown.startY) < DRAG_THRESHOLD) return;
      rangeDown.dragging = true;
    }
    const col = colAt(e.clientX) ?? rangeDown.col;
    const min = snapMinute(minuteAt(e.clientY), slotMinutes);
    rangeSel = { anchorCol: rangeDown.col, anchorMin: rangeDown.min, curCol: col, curMin: min, moved: true, pending: true };
  }
  // Drag-select across the ALL-DAY row -> a whole-day range (creates all-day events).
  function startAllDayRangeSelect(col: GridCol, e: PointerEvent) {
    if (!rangeSelectable || e.button !== 0) return;
    suppressClick = false;
    e.preventDefault();
    rangeDown = { col, min: 0, allDay: true, startX: e.clientX, startY: e.clientY, dragging: false };
    window.addEventListener("pointermove", onAllDayRangeMove);
    window.addEventListener("pointerup", onRangeSelectEnd, { once: true });
  }
  function onAllDayRangeMove(e: PointerEvent) {
    if (!rangeDown) return;
    if (!rangeDown.dragging) {
      if (Math.abs(e.clientX - rangeDown.startX) < DRAG_THRESHOLD) return;
      rangeDown.dragging = true;
    }
    rangeSel = { anchorCol: rangeDown.col, anchorMin: 0, curCol: colAt(e.clientX) ?? rangeDown.col, curMin: 0, moved: true, pending: true, allDay: true };
  }
  function onRangeSelectEnd() {
    window.removeEventListener("pointermove", onRangeSelectMove);
    window.removeEventListener("pointermove", onAllDayRangeMove);
    const down = rangeDown;
    rangeDown = null;
    if (!down) return;
    if (down.dragging) {
      suppressClick = true; // a drag happened; keep the marked range (already set)
      return;
    }
    // A plain click selects the single cell at the press position (for keyboard
    // nav / Enter); a double-click on it creates directly (see onSlotDblClick).
    rangeSel = { anchorCol: down.col, anchorMin: down.min, curCol: down.col, curMin: down.min, moved: true, pending: true, allDay: down.allDay };
  }
  // Move the pending selection by whole days (dDay) / slots (dMin). Without
  // `extend`, the whole (collapsed) selection moves; with it, only the moving end
  // moves, growing/shrinking the range (Shift+arrows). Clamped to the day band.
  function moveRangeSelect(dDay: number, dMin: number, extend: boolean) {
    const sel = rangeSel;
    if (!sel) return;
    const curIdx = gridCols.findIndex((c) => c.key === sel.curCol.key);
    const nextIdx = Math.min(gridCols.length - 1, Math.max(0, curIdx + dDay));
    const nextCol = gridCols[nextIdx] ?? sel.curCol;
    const clampMin = (m: number) => Math.min(dayEndHour * 60 - slotMinutes, Math.max(dayStartHour * 60, m));

    // Vertical crossing between the all-day row and the timed band (navigation
    // only - Shift-extend keeps the range within its current zone).
    let nextAllDay = sel.allDay ?? false;
    let nextMin: number;
    if (!extend && hasAllDayRow && sel.allDay && dMin > 0) {
      nextAllDay = false; // Down from the all-day row -> the first timed cell
      nextMin = dayStartHour * 60;
    } else if (!extend && hasAllDayRow && !sel.allDay && dMin < 0 && sel.curMin <= dayStartHour * 60) {
      nextAllDay = true; // Up from the top timed cell -> the all-day row
      nextMin = 0;
    } else {
      nextMin = sel.allDay ? 0 : clampMin(sel.curMin + dMin);
    }

    if (extend) {
      sel.curCol = nextCol;
      sel.curMin = nextMin;
    } else {
      sel.allDay = nextAllDay;
      sel.anchorCol = nextCol;
      sel.anchorMin = nextMin;
      sel.curCol = nextCol;
      sel.curMin = nextMin;
    }
    sel.moved = true;
    sel.pending = true;
    rangeSel = { ...sel };
    scrollActiveCellIntoView();
  }
  // Distance from the scroller's top to the hourly body's top - i.e. the height
  // of the sticky header block, which now lives inside the single (both-axis)
  // scroller. Vertical-scroll targets are body-relative, so they add this base.
  function gridBodyTopInScroller(): number {
    if (!bodyEl || !gridScrollEl) return 0;
    return bodyEl.getBoundingClientRect().top - gridScrollEl.getBoundingClientRect().top + gridScrollEl.scrollTop;
  }
  // Keep the moving end of the selection visible in the vertical scroller.
  function scrollActiveCellIntoView() {
    if (!rangeSel || rangeSel.allDay || !gridScrollEl || !bodyEl) return;
    const top = ((rangeSel.curMin - dayStartHour * 60) / (bandHours * 60)) * bodyEl.offsetHeight;
    const view = gridScrollEl;
    // The sticky header overlays the top of the scroller, so the usable body
    // viewport is clientHeight minus the header height.
    const usable = view.clientHeight - gridBodyTopInScroller();
    const pad = 24;
    if (top < view.scrollTop + pad) view.scrollTop = Math.max(0, top - pad);
    else if (top > view.scrollTop + usable - pad) view.scrollTop = top - usable + pad;
  }
  // On a full-day ruler the grid would open at midnight (empty). When the
  // week/day grid mounts (or you switch back to it), scroll past the empty
  // early hours to a business-hours start. Only affects bands that begin before
  // then - a grid already starting at/after this hour is left untouched.
  const SCROLL_TO_HOUR = 7;
  let scrolledForView = "";
  $effect(() => {
    const v = view;
    const el = gridScrollEl;
    if (!el || (v !== "week" && v !== "day")) {
      scrolledForView = "";
      return;
    }
    if (scrolledForView === v) return;
    scrolledForView = v;
    requestAnimationFrame(() => {
      // scrollTop maps directly to body-local position (a sticky header does not
      // consume scroll offset), so no header term is needed here.
      if (gridScrollEl) gridScrollEl.scrollTop = Math.max(0, (SCROLL_TO_HOUR - dayStartHour) * hourPx);
    });
  });
  // Turn the pending grid range into event(s) and clear the marker. Fires
  // `onRangeSelect` (or falls back to `onEventAdd` for the first cell).
  function commitRangeSelect() {
    const sel = rangeSel;
    if (!sel || !sel.moved) return;
    const ai = gridCols.findIndex((c) => c.key === sel.anchorCol.key);
    const bi = gridCols.findIndex((c) => c.key === sel.curCol.key);
    const cols = gridCols.slice(Math.min(ai, bi), Math.max(ai, bi) + 1);
    const firstCol = cols[0] ?? sel.anchorCol;
    const days = [...new Set(cols.map((c) => startOfDay(c.date).getTime()))].map((t) => new Date(t));
    const resourceIds = resourceField ? [...new Set(cols.map((c) => c.resourceId).filter((r): r is string => r != null))] : [];
    rangeSel = null;
    if (sel.allDay) {
      // Whole-day range -> an all-day event spanning the covered days.
      const lastCol = cols[cols.length - 1] ?? firstCol;
      const start = startOfDay(firstCol.date);
      const end = addDays(startOfDay(lastCol.date), 1);
      if (scheduler.onRangeSelect) emitRange({ start, end, allDay: true, days, resourceIds });
      else emitAdd(start, end, firstCol.resourceId, true);
      return;
    }
    // A CONTINUOUS date/time range: from the earlier (day, time) to the later
    // one - not a per-day rectangle. Spanning days just makes it a longer range.
    const aDT = dateAtMinute(sel.anchorCol.date, sel.anchorMin).getTime();
    const cDT = dateAtMinute(sel.curCol.date, sel.curMin).getTime();
    const start = new Date(Math.min(aDT, cDT));
    const end = new Date(Math.max(aDT, cDT) + slotMinutes * 60000);
    if (bookingBlocked(start, end, firstCol.resourceId, "")) return;
    if (scheduler.onRangeSelect) emitRange({ start, end, days, resourceIds });
    else emitAdd(start, end, firstCol.resourceId, false);
  }
  // The continuous datetime range being marked (min..max of the two drag points).
  const rangeSelSpan = $derived.by(() => {
    if (!rangeSel || !rangeSel.moved || rangeSel.allDay) return null;
    const aDT = dateAtMinute(rangeSel.anchorCol.date, rangeSel.anchorMin).getTime();
    const cDT = dateAtMinute(rangeSel.curCol.date, rangeSel.curMin).getTime();
    return { start: Math.min(aDT, cDT), end: Math.max(aDT, cDT) + slotMinutes * 60000 };
  });
  // Per-column mirror segments: the slice of the continuous range that falls in
  // each day's visible band (start day: from the start time down; middle days:
  // full; end day: down to the end time). Keyed by column.
  const rangeSelSegs = $derived.by(() => {
    if (!rangeSelSpan || !rangeSel) return null;
    // When grouped by resource, columns of different resources share a date - the
    // range belongs to the clicked resource only, so don't bleed into the others.
    const anchorRes = resourceField ? rangeSel.anchorCol.resourceId : undefined;
    const bandStartMin = dayStartHour * 60;
    const bandTotalMin = bandHours * 60;
    const segs = new Map<string, { top: number; height: number }>();
    for (const col of gridCols) {
      if (resourceField && col.resourceId !== anchorRes) continue;
      const dayLo = dateAtMinute(col.date, bandStartMin).getTime();
      const dayHi = dateAtMinute(col.date, dayEndHour * 60).getTime();
      const s = Math.max(rangeSelSpan.start, dayLo);
      const e = Math.min(rangeSelSpan.end, dayHi);
      if (e <= s) continue;
      const topMin = (s - dayLo) / 60000;
      const hMin = (e - s) / 60000;
      segs.set(col.key, { top: (topMin / bandTotalMin) * 100, height: (hMin / bandTotalMin) * 100 });
    }
    return segs;
  });
  // All-day range: just the covered day cells (whole-day, no time band).
  const rangeSelAllDayKeys = $derived.by(() => {
    if (!rangeSel || !rangeSel.moved || !rangeSel.allDay) return null;
    const anchorRes = resourceField ? rangeSel.anchorCol.resourceId : undefined;
    const ai = gridCols.findIndex((c) => c.key === rangeSel!.anchorCol.key);
    const bi = gridCols.findIndex((c) => c.key === rangeSel!.curCol.key);
    return new Set(
      gridCols
        .slice(Math.min(ai, bi), Math.max(ai, bi) + 1)
        .filter((c) => !resourceField || c.resourceId === anchorRes)
        .map((c) => c.key),
    );
  });

  // Range selection in the TIMELINE (horizontal: time span × resource rows).
  type TlRangeSel = { anchorIdx: number; anchorT: number; curIdx: number; curT: number; moved: boolean; pending?: boolean };
  let tlRangeSel = $state<TlRangeSel | null>(null);
  // Manual double-click detection: the pointerdown `preventDefault()` below
  // suppresses the browser's native `dblclick`, so a quick second press at the
  // same spot is treated as a double-click (create) here instead.
  let lastTlDown = { t: 0, x: 0, y: 0 };
  function startTlRangeSelect(rowIdx: number, e: PointerEvent) {
    if (!rangeSelectable || e.button !== 0) return;
    if (scheduler.onEventAdd && e.timeStamp - lastTlDown.t < 400 && Math.abs(e.clientX - lastTlDown.x) < 6 && Math.abs(e.clientY - lastTlDown.y) < 6) {
      lastTlDown = { t: 0, x: 0, y: 0 };
      onTlSlotDblClick(tlRows[rowIdx]?.resource?.id, e);
      return;
    }
    lastTlDown = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    suppressClick = false;
    e.preventDefault();
    const t = tlTimeAtX(e.clientX).getTime();
    tlRangeSel = { anchorIdx: rowIdx, anchorT: t, curIdx: rowIdx, curT: t, moved: false };
    window.addEventListener("pointermove", onTlRangeSelectMove);
    window.addEventListener("pointerup", onTlRangeSelectEnd, { once: true });
  }
  function onTlRangeSelectMove(e: PointerEvent) {
    if (!tlRangeSel) return;
    const t = tlTimeAtX(e.clientX).getTime();
    const resId = tlResAt(e.clientX, e.clientY);
    const idx = resId != null ? tlRows.findIndex((r) => (r.resource?.id ?? "") === resId) : tlRangeSel.curIdx;
    if (!tlRangeSel.moved && idx === tlRangeSel.anchorIdx && Math.abs(t - tlRangeSel.anchorT) < tlSlot * TL_MS_MIN) return;
    tlRangeSel.moved = true;
    tlRangeSel.curT = t;
    if (idx >= 0) tlRangeSel.curIdx = idx;
  }
  function onTlRangeSelectEnd() {
    window.removeEventListener("pointermove", onTlRangeSelectMove);
    const sel = tlRangeSel;
    if (!sel) return;
    if (sel.moved) suppressClick = true; // a drag happened; keep the marked span
    // A drag marks the span; a plain click marks a single cell. Either way the
    // range is only *pending* - the event is created on Enter / "Add Event", and
    // arrow keys can now move/extend it (see moveTlRangeSelect).
    tlRangeSel = { ...sel, moved: true, pending: true };
  }
  // Turn the pending timeline span into event(s) and clear the marker.
  function commitTlRangeSelect() {
    const sel = tlRangeSel;
    if (!sel || !sel.moved) return;
    const start = new Date(tlStepStart(Math.min(sel.anchorT, sel.curT)));
    const end = new Date(tlStepEnd(Math.max(sel.anchorT, sel.curT)));
    const rows = tlRows.slice(Math.min(sel.anchorIdx, sel.curIdx), Math.max(sel.anchorIdx, sel.curIdx) + 1);
    const resourceIds = resourceField ? rows.map((r) => r.resource?.id).filter((r): r is string => r != null) : [];
    // Days the span touches.
    const days: Date[] = [];
    for (let d = startOfDay(start); d.getTime() < end.getTime(); d = addDays(d, 1)) days.push(new Date(d));
    if (!days.length) days.push(startOfDay(start));
    tlRangeSel = null;
    // Only the Day zoom is timed; Week/Month/Year select whole days -> all-day.
    const allDay = view !== "timelineDay";
    if (scheduler.onRangeSelect) emitRange({ start, end, allDay, days, resourceIds });
    else emitAdd(start, end, resourceIds[0], allDay);
  }
  // Timeline mirror band: covered rows + horizontal extent. Snapped to whole
  // cells so a single click still shows a one-cell marker (a slot in Day, a day
  // in Week/Month, a month in Year).
  const tlRangeBand = $derived.by(() => {
    if (!tlRangeSel || !tlRangeSel.moved) return null;
    const s = tlStepStart(Math.min(tlRangeSel.anchorT, tlRangeSel.curT));
    const e = tlStepEnd(Math.max(tlRangeSel.anchorT, tlRangeSel.curT));
    const g = tlGeom(new Date(s), new Date(e));
    if (!g) return null;
    return { lo: Math.min(tlRangeSel.anchorIdx, tlRangeSel.curIdx), hi: Math.max(tlRangeSel.anchorIdx, tlRangeSel.curIdx), leftPct: g.leftPct, widthPct: g.widthPct };
  });

  // --- confirm / cancel a PENDING range selection ---------------------------
  // A drag now only marks the range (grid or timeline); this is where it turns
  // into event(s): Enter confirms, Escape cancels, and a right-click offers the
  // same "Add Event" action through the context menu.
  const hasPendingRange = $derived(!!rangeSel?.pending || !!tlRangeSel?.pending || !!monthRangeSel?.pending);
  function commitPendingRange() {
    if (rangeSel?.pending) commitRangeSelect();
    else if (tlRangeSel?.pending) commitTlRangeSelect();
    else if (monthRangeSel?.pending) commitMonthRangeSelect();
  }
  function clearRangeSelect() {
    rangeSel = null;
    tlRangeSel = null;
    monthRangeSel = null;
  }
  $effect(() => {
    if (!rangeSelectable) return;
    const onKey = (e: KeyboardEvent) => {
      if (!rangeSel?.pending && !tlRangeSel?.pending && !monthRangeSel?.pending) return;
      // Don't hijack typing (search box, drawer inputs, etc.).
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commitPendingRange();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearRangeSelect();
      } else if (rangeSel?.pending) {
        // Arrow keys navigate the selected cell; Shift extends the range.
        const shift = e.shiftKey;
        if (e.key === "ArrowUp") { e.preventDefault(); moveRangeSelect(0, -slotMinutes, shift); }
        else if (e.key === "ArrowDown") { e.preventDefault(); moveRangeSelect(0, slotMinutes, shift); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); moveRangeSelect(-1, 0, shift); }
        else if (e.key === "ArrowRight") { e.preventDefault(); moveRangeSelect(1, 0, shift); }
      } else if (tlRangeSel?.pending) {
        // Timeline: Left/Right step along the time axis, Up/Down across resource
        // rows; Shift extends the range from the anchor cell.
        const shift = e.shiftKey;
        if (e.key === "ArrowLeft") { e.preventDefault(); moveTlRangeSelect(-1, 0, shift); }
        else if (e.key === "ArrowRight") { e.preventDefault(); moveTlRangeSelect(1, 0, shift); }
        else if (e.key === "ArrowUp") { e.preventDefault(); moveTlRangeSelect(0, -1, shift); }
        else if (e.key === "ArrowDown") { e.preventDefault(); moveTlRangeSelect(0, 1, shift); }
      } else if (monthRangeSel?.pending) {
        // Month: Left/Right move one day, Up/Down one week; Shift extends.
        const shift = e.shiftKey;
        if (e.key === "ArrowLeft") { e.preventDefault(); moveMonthRangeSelect(-1, shift); }
        else if (e.key === "ArrowRight") { e.preventDefault(); moveMonthRangeSelect(1, shift); }
        else if (e.key === "ArrowUp") { e.preventDefault(); moveMonthRangeSelect(-7, shift); }
        else if (e.key === "ArrowDown") { e.preventDefault(); moveMonthRangeSelect(7, shift); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // Right-clicking a pending range opens an "Add Event" menu (reuses the event
  // context-menu chrome). Skipped when an event already handled the right-click.
  function openRangeMenu(e: MouseEvent) {
    if (e.defaultPrevented) return;
    if (!rangeSel?.pending && !tlRangeSel?.pending && !monthRangeSel?.pending) return;
    // Only offer "Add Event" when there is actually a way to create one.
    if (!scheduler.onEventAdd && !scheduler.onRangeSelect) return;
    e.preventDefault();
    e.stopPropagation();
    menuItems = [{ label: "Add Event", shortcut: "Enter", onSelect: commitPendingRange }];
    menuPos = { x: e.clientX, y: e.clientY };
    menuOpen = true;
  }

  function saveDrawer(values: Record<string, unknown>) {
    const row = drawerRow;
    if (!row) return;
    const k = key(row);
    // Editing a recurring OCCURRENCE via the drawer: ask This / Following / All.
    const ev = drawerEv;
    if (hasExceptions && ev?.recurring && ev.occurrenceStart) {
      const newTitle = scheduler.titleField ? (values[scheduler.titleField] as string | undefined) : undefined;
      const startChanged = !!whenStart && whenStart.getTime() !== ev.start.getTime();
      const endChanged = !!whenEnd && !!ev.end && whenEnd.getTime() !== ev.end.getTime();
      const titleChanged = newTitle != null && newTitle !== ev.title;
      // Any OTHER drawer field that changed (attendees, calendar, ...) - carried
      // into the per-occurrence exception's `fields` so "This event" can hold them.
      const valueChanged = (f: string): boolean => {
        const a = values[f];
        const b = fieldValue(row, f);
        if (Array.isArray(a) && Array.isArray(b)) return a.length !== b.length || a.some((x, i) => x !== b[i]);
        return a !== b;
      };
      const changedFields: Record<string, unknown> = {};
      for (const col of drawerFieldCols) {
        const f = col.field as string;
        if (f === scheduler.titleField) continue; // title handled explicitly
        if (valueChanged(f)) changedFields[f] = values[f];
      }
      const otherChanged = Object.keys(changedFields).length > 0;
      if (!startChanged && !endChanged && !titleChanged && !otherChanged) { drawerOpen = false; return; }
      const occOpts = { start: whenStart ?? undefined, end: whenEnd ?? undefined, allDay: whenAllDay, title: titleChanged ? newTitle : undefined, fields: otherChanged ? changedFields : undefined };
      drawerOpen = false;
      // Apply with the scope chosen inline in the drawer.
      if (drawerScope === "series") applyDrawerToSeries(row, k, { ...values });
      else emitOccurrence(ev, occOpts, drawerScope);
      return;
    }
    applyDrawerToSeries(row, k, values);
  }
  function applyDrawerToSeries(row: TData, k: string, values: Record<string, unknown>) {
    // Fold the recurrence rule + the "When" fields into the saved values.
    if (recurEditable) {
      values = { ...values, [recurField]: buildRule(row) };
    }
    values = { ...values, [scheduler.startField]: serializeWhen(whenStart, whenAllDay) };
    if (scheduler.endField) values = { ...values, [scheduler.endField]: serializeWhen(whenEnd, whenAllDay) };
    if (scheduler.allDayField) values = { ...values, [scheduler.allDayField]: whenAllDay };

    const changes: Record<string, unknown> = {};
    for (const col of drawerFieldCols) {
      const f = col.field as string;
      if (values[f] !== fieldValue(row, f)) changes[f] = values[f];
    }
    if (recurEditable) changes[recurField] = values[recurField];
    changes[scheduler.startField] = values[scheduler.startField];
    if (scheduler.endField) changes[scheduler.endField] = values[scheduler.endField];
    if (scheduler.allDayField) changes[scheduler.allDayField] = values[scheduler.allDayField];
    edits[k] = { ...(edits[k] ?? {}), ...values };
    // keep the render overlay in sync with the edited start / end / all-day.
    if (whenStart) startOfE[k] = whenStart;
    if (whenEnd) endOfE[k] = whenEnd;
    if (scheduler.allDayField) allDayOf[k] = whenAllDay;
    scheduler.onEventCommit?.({ row, changes, values: { ...values } });
    drawerOpen = false;
  }
  function deleteDrawer() {
    const row = drawerRow;
    if (!row) return;
    drawerOpen = false;
    scheduler.onEventDelete?.(row);
  }
  // Explicit discard: close without committing (bypasses the save-on-dismiss).
  function cancelDrawer() {
    drawerOpen = false;
  }
  // Dismissing the drawer (click-outside / Escape) commits the current edits.
  function commitDrawer() {
    if (drawerRow) saveDrawer({ ...drawerValues });
  }
  const drawerTitle = $derived.by(() => {
    const row = drawerRow;
    if (!row) return "";
    const t = drawerCfg?.title;
    if (typeof t === "function") return t(row);
    if (typeof t === "string") return t;
    return titleField ? String(fieldValue(row, titleField) ?? "Event") : "Event";
  });

  // Add on empty-slot double-click.
  function onSlotDblClick(col: GridCol, e: MouseEvent) {
    rangeSel = null; // a double-click creates directly - drop the click's marker
    if (!scheduler.onEventAdd) return;
    const min = snapMinute(minuteAt(e.clientY), slotMinutes);
    const s = dateAtMinute(col.date, min);
    const en = new Date(s.getTime() + (scheduler.defaultDurationMin ?? 60) * 60000);
    if (bookingBlocked(s, en, col.resourceId, "")) return;
    emitAdd(s, en, col.resourceId, false);
  }

  // --- timeline geometry + drag/resize (horizontal) ---
  const TL_MS_MIN = 60_000;
  function tlTimeAtX(clientX: number): Date {
    if (!tlLanesEl) return tlAxis.start;
    const r = tlLanesEl.getBoundingClientRect();
    // Piecewise inverse when the Pro axis (collapse / zoom) is active.
    if (axisPro && proAxisData) {
      const x = Math.min(r.width, Math.max(0, clientX - r.left));
      return xToTime((x / r.width) * proAxisData.axis.totalPx, proAxisData.axis);
    }
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return new Date(tlAxis.start.getTime() + frac * tlAxis.totalMs);
  }
  const snapTlStart = (d: Date): Date =>
    view === "timelineDay"
      ? new Date(Math.round(d.getTime() / (tlSlot * TL_MS_MIN)) * (tlSlot * TL_MS_MIN))
      : startOfDay(d);
  const snapTlEnd = (d: Date): Date =>
    view === "timelineDay"
      ? new Date(Math.round(d.getTime() / (tlSlot * TL_MS_MIN)) * (tlSlot * TL_MS_MIN))
      : addDays(startOfDay(d), 1); // inclusive day → next midnight
  function tlResAt(clientX: number, clientY: number): string | undefined {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-tlres]");
    return el?.dataset.tlres || undefined;
  }
  // One navigable "cell" along the axis: a slot in Day, a whole day in
  // Week/Month, a whole month in Year. Used for the click marker + keyboard nav.
  function tlStepStart(t: number): number {
    if (view === "timelineDay") return Math.floor(t / (tlSlot * TL_MS_MIN)) * (tlSlot * TL_MS_MIN);
    const b = startOfDay(new Date(t));
    if (view === "timelineYear") return new Date(b.getFullYear(), b.getMonth(), 1).getTime();
    return b.getTime();
  }
  function tlStepEnd(t: number): number {
    if (view === "timelineDay") return tlStepStart(t) + tlSlot * TL_MS_MIN;
    const b = new Date(tlStepStart(t));
    if (view === "timelineYear") return new Date(b.getFullYear(), b.getMonth() + 1, 1).getTime();
    return addDays(b, 1).getTime();
  }
  function tlStepShift(t: number, d: number): number {
    if (view === "timelineDay") return tlStepStart(t) + d * tlSlot * TL_MS_MIN;
    const b = new Date(tlStepStart(t));
    if (view === "timelineYear") return new Date(b.getFullYear(), b.getMonth() + d, 1).getTime();
    return addDays(b, d).getTime();
  }
  // Keyboard navigation for the timeline cell selection. dCol steps along the
  // time axis, dRow moves between resource rows; `extend` (Shift) grows the range
  // from the anchor, otherwise the whole selection moves as a single cell.
  function moveTlRangeSelect(dCol: number, dRow: number, extend: boolean) {
    const sel = tlRangeSel;
    if (!sel) return;
    const nextT = tlStepShift(sel.curT, dCol);
    const nextIdx = Math.min(tlRows.length - 1, Math.max(0, sel.curIdx + dRow));
    tlRangeSel = extend
      ? { ...sel, curT: nextT, curIdx: nextIdx, moved: true, pending: true }
      : { anchorT: nextT, curT: nextT, anchorIdx: nextIdx, curIdx: nextIdx, moved: true, pending: true };
    tlScrollActiveIntoView(nextT);
  }
  function tlScrollActiveIntoView(t: number) {
    if (!tlScrollEl) return;
    const g = tlGeom(new Date(tlStepStart(t)), new Date(tlStepEnd(t)));
    if (!g) return;
    const cellLeft = tlResW + (g.leftPct / 100) * tlAxisWidth;
    const cellRight = tlResW + ((g.leftPct + g.widthPct) / 100) * tlAxisWidth;
    const viewLeft = tlScrollEl.scrollLeft;
    const viewRight = viewLeft + tlScrollEl.clientWidth;
    // The resource gutter sticks to the left, so a cell is hidden until it clears it.
    if (cellLeft < viewLeft + tlResW) tlScrollEl.scrollLeft = Math.max(0, cellLeft - tlResW - 20);
    else if (cellRight > viewRight) tlScrollEl.scrollLeft = cellRight - tlScrollEl.clientWidth + 20;
  }

  type TlMode = "move" | "resize-start" | "resize-end";
  type TlDrag = {
    ev: ResolvedEvent<TData>;
    mode: TlMode;
    startX: number;
    startY: number;
    grabOffsetMs: number;
    durationMs: number;
    origStart: Date;
    origEnd: Date;
    moved: boolean;
    previewStart: Date;
    previewEnd: Date;
    previewRes: string | undefined;
    x: number;
    y: number;
  };
  let tlDrag = $state<TlDrag | null>(null);
  function startTlDrag(e: PointerEvent, ev: ResolvedEvent<TData>, mode: TlMode) {
    if (e.button !== 0) return; // ignore right/middle button (let the context menu open)
    suppressClick = false;
    if (!editable || (ev.recurring && !recurEditable)) return;
    e.preventDefault();
    e.stopPropagation();
    tlDrag = {
      ev,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      grabOffsetMs: Math.max(0, tlTimeAtX(e.clientX).getTime() - ev.start.getTime()),
      durationMs: ev.end.getTime() - ev.start.getTime(),
      origStart: ev.start,
      origEnd: ev.end,
      moved: false,
      previewStart: ev.start,
      previewEnd: ev.end,
      previewRes: ev.resourceId,
      x: e.clientX,
      y: e.clientY,
    };
    window.addEventListener("pointermove", onTlDragMove);
    window.addEventListener("pointerup", onTlDragEnd, { once: true });
  }
  function onTlDragMove(e: PointerEvent) {
    if (!tlDrag) return;
    if (!tlDrag.moved) {
      if (Math.abs(e.clientX - tlDrag.startX) < DRAG_THRESHOLD && Math.abs(e.clientY - tlDrag.startY) < DRAG_THRESHOLD) return;
      tlDrag.moved = true;
    }
    tlDrag.x = e.clientX;
    tlDrag.y = e.clientY;
    dragOverBacklog = tlDrag.mode === "move" && !!scheduler.onUnschedule && !!backlogEl && pointInEl(e.clientX, e.clientY, backlogEl);
    const t = tlTimeAtX(e.clientX);
    const slotMs = tlSlot * TL_MS_MIN;
    // Move AND resize share one granularity per view: the slot (hour-scale) in
    // Day / Week where hours are visible, the day in Month / Year where they are
    // not. So dragging and resizing always snap the same way.
    const fine = view === "timelineDay" || view === "timelineWeek";
    const snapStart = (d: Date) => (fine ? new Date(Math.round(d.getTime() / slotMs) * slotMs) : startOfDay(d));
    const snapEnd = (d: Date) => (fine ? new Date(Math.round(d.getTime() / slotMs) * slotMs) : addDays(startOfDay(d), 1));
    const minStep = fine ? slotMs : 24 * 60 * TL_MS_MIN;
    if (tlDrag.mode === "move") {
      const ns = snapStart(new Date(t.getTime() - tlDrag.grabOffsetMs));
      tlDrag.previewStart = ns;
      tlDrag.previewEnd = new Date(ns.getTime() + tlDrag.durationMs);
      // Recurring instances keep their row; others can change resource.
      tlDrag.previewRes = tlDrag.ev.recurring ? tlDrag.ev.resourceId : tlResAt(e.clientX, e.clientY) ?? tlDrag.previewRes;
    } else if (tlDrag.mode === "resize-end") {
      const ne = snapEnd(t);
      tlDrag.previewEnd = new Date(Math.max(ne.getTime(), tlDrag.origStart.getTime() + minStep));
      tlDrag.previewStart = tlDrag.origStart;
    } else {
      const ns = snapStart(t);
      tlDrag.previewStart = new Date(Math.min(ns.getTime(), tlDrag.origEnd.getTime() - minStep));
      tlDrag.previewEnd = tlDrag.origEnd;
    }
  }
  function onTlDragEnd() {
    window.removeEventListener("pointermove", onTlDragMove);
    const d = tlDrag;
    tlDrag = null;
    if (!d || !d.moved) return;
    suppressClick = true;
    dragOverBacklog = false;
    const { ev, previewStart, previewEnd, previewRes, mode } = d;
    const k = ev.rowKey;
    // Dropped onto the backlog panel -> unschedule.
    if (mode === "move" && scheduler.onUnschedule && backlogEl && pointInEl(d.x, d.y, backlogEl)) {
      scheduler.onUnschedule(ev.row);
      return;
    }
    if (ev.recurring) {
      // Series edit: apply the new time-of-day (+ duration) to the base row.
      const applySeries = () => {
        const baseStart = toDate(fieldValue(ev.row, scheduler.startField) as never) ?? ev.start;
        const ns = dayWithTimeOf(baseStart, previewStart);
        const ne = new Date(ns.getTime() + (previewEnd.getTime() - previewStart.getTime()));
        startOfE[k] = ns;
        endOfE[k] = ne;
        if (mode === "move") emitMove({ row: ev.row, start: ns, end: ne, allDay: ev.allDay });
        else emitResize({ row: ev.row, start: ns, end: ne });
      };
      askRecurScope(d.x, d.y, ev, "edit", () => emitOccurrence(ev, { start: previewStart, end: previewEnd }), applySeries, () => emitOccurrence(ev, { start: previewStart, end: previewEnd }, "following"));
      return;
    }
    const checkRes = mode === "move" ? previewRes : ev.resourceId;
    if (bookingBlocked(previewStart, previewEnd, checkRes, k, ev.row)) return;
    startOfE[k] = previewStart;
    endOfE[k] = previewEnd;
    if (mode === "move") {
      // With multi-assignment, a cross-row drag REASSIGNS (the event belongs to
      // several resources) rather than moving the single `resourceField`.
      if (hasAssignments && previewRes != null && previewRes !== ev.resourceId) {
        pcfg.onAssignmentChange?.({ eventId: ev.rowKey, from: ev.resourceId, to: previewRes });
      } else if (previewRes != null) {
        resourceOfE[k] = previewRes;
      }
      emitMove({ row: ev.row, start: previewStart, end: previewEnd, allDay: ev.allDay, fromResource: ev.resourceId, toResource: previewRes });
      applyBulkMove(k, previewStart.getTime() - d.origStart.getTime());
    } else {
      emitResize({ row: ev.row, start: previewStart, end: previewEnd });
    }
    // Auto-reschedule dependent successors (Scheduler Pro).
    cascadeDeps(k, previewStart, previewEnd);
    pushHistory({
      key: k,
      row: ev.row,
      kind: mode === "move" ? "move" : "resize",
      before: { start: d.origStart, end: d.origEnd, resource: ev.resourceId, allDay: ev.allDay },
      after: { start: previewStart, end: previewEnd, resource: mode === "move" ? previewRes : ev.resourceId, allDay: ev.allDay },
    });
  }
  // Double-click an empty spot in a resource row → add there.
  function onTlSlotDblClick(resourceId: string | undefined, e: MouseEvent) {
    tlRangeSel = null; // a double-click creates directly - drop the click's marker
    if (!scheduler.onEventAdd) return;
    // Day / Week create a TIMED event at the clicked slot (hours are visible);
    // Month / Year create an all-day one.
    const fine = view === "timelineDay" || view === "timelineWeek";
    const slotMs = tlSlot * TL_MS_MIN;
    const raw = tlTimeAtX(e.clientX);
    const s = fine ? new Date(Math.round(raw.getTime() / slotMs) * slotMs) : startOfDay(raw);
    const durMs = (fine ? scheduler.defaultDurationMin ?? 60 : 24 * 60) * TL_MS_MIN;
    emitAdd(s, new Date(s.getTime() + durMs), resourceId, !fine);
  }
  // Geometry for one timeline bar. A RESIZE morphs the bar in place (live); a
  // MOVE leaves the source bar where it is (dimmed) - a separate preview bar in
  // the destination row shows where it lands (so cross-row drags read clearly).
  function tlBarGeom(ev: ResolvedEvent<TData>) {
    const d = tlDrag;
    const isDrag = d?.ev.key === ev.key && d.moved;
    if (isDrag && d!.mode !== "move") return tlGeom(d!.previewStart, d!.previewEnd);
    return tlGeom(ev.start, ev.end);
  }
  // The move-preview geometry (for the destination-row ghost bar).
  const tlMovePreview = $derived.by(() => {
    if (!tlDrag || !tlDrag.moved || tlDrag.mode !== "move") return null;
    const g = tlGeom(tlDrag.previewStart, tlDrag.previewEnd);
    return g ? { g, resId: tlDrag.previewRes ?? "", ev: tlDrag.ev } : null;
  });

  function eventStyle(ev: ResolvedEvent<TData>): string {
    let s = ev.color ? `--sv-sched-accent:${ev.color};` : "";
    // A secondary color paints the left strip (see the `.sv-sched-event`/`-bar`
    // border-left, which falls back to the main accent when unset).
    if (ev.color2) s += `--sv-sched-accent2:${ev.color2};`;
    return s;
  }
  // Normalize a free/busy status to a modifier ('free'|'tentative'|'oof') or
  // undefined (busy/default). Applied as `data-status` on event elements.
  function evStatus(ev: ResolvedEvent<TData>): string | undefined {
    const s = (ev.status ?? "").toString().toLowerCase().replace(/[\s_-]/g, "");
    if (s === "free") return "free";
    if (s === "tentative") return "tentative";
    if (s === "oof" || s === "outofoffice") return "oof";
    return undefined;
  }
</script>

<div class="sv-sched" role="group" aria-roledescription="calendar">
  <!-- toolbar -->
  <div class="sv-sched-toolbar">
    <div class="sv-sched-nav">
      <button type="button" class="sv-sched-btn" onclick={() => go(-1)} disabled={!canGoPrev} aria-label="Previous">‹</button>
      <button type="button" class="sv-sched-btn" onclick={today}>Today</button>
      <button type="button" class="sv-sched-btn" onclick={() => go(1)} disabled={!canGoNext} aria-label="Next">›</button>
    </div>
    <div class="sv-sched-title" aria-live="polite">{titleLabel}</div>
    <div class="sv-sched-views">
      {#if slotSizes.length && (view === "week" || view === "day")}
        <div class="sv-sched-slots" role="group" aria-label="Slot size">
          {#each slotSizes as ms (ms)}
            <button
              type="button"
              class="sv-sched-btn sv-sched-btn-slot"
              class:sv-sched-btn-active={slotMinutes === ms}
              aria-pressed={slotMinutes === ms}
              onclick={() => (slotOverride = ms)}
            >{slotSizeLabel(ms)}</button>
          {/each}
        </div>
      {/if}
      {#if zoomOn && proAxisData}
        <div class="sv-sched-slots sv-sched-zoom" role="group" aria-label="Zoom">
          <button type="button" class="sv-sched-btn sv-sched-btn-slot" onclick={() => stepZoom(-1)} aria-label="Zoom in">-</button>
          <span class="sv-sched-zoom-label">{proAxisData.level?.label ?? "Zoom"}</span>
          <button type="button" class="sv-sched-btn sv-sched-btn-slot" onclick={() => stepZoom(1)} aria-label="Zoom out">+</button>
        </div>
      {/if}
      {#each views as v (v)}
        <button
          type="button"
          class="sv-sched-btn"
          class:sv-sched-btn-active={view === v}
          onclick={() => setView(v)}
        >{viewLabel(v)}</button>
      {/each}
    </div>
  </div>

  {#if resourceField && resources.length}
    <!-- Resource legend + filter: colour key that toggles a resource in EVERY
         view (Week/Day group into columns; Month/Agenda filter by it). -->
    <div class="sv-sched-reslegend">
      {#each resources as r (r.id)}
        <button
          type="button"
          class="sv-sched-reschip"
          class:sv-sched-reschip-off={hiddenResources.has(r.id)}
          style={r.color ? `--sv-sched-accent:${r.color};` : ""}
          aria-pressed={!hiddenResources.has(r.id)}
          onclick={() => toggleResource(r.id)}
        >
          <span class="sv-sched-dot"></span>
          <span>{r.title ?? r.id}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if calendars.length}
    <!-- Calendar legend + filter: toggle a whole calendar's events on/off. -->
    <div class="sv-sched-reslegend sv-sched-callegend">
      {#each calendars as c (c.id)}
        <button
          type="button"
          class="sv-sched-reschip"
          class:sv-sched-reschip-off={hiddenCalendars.has(c.id)}
          style={c.color ? `--sv-sched-accent:${c.color};` : ""}
          aria-pressed={!hiddenCalendars.has(c.id)}
          onclick={() => toggleCalendar(c.id)}
        >
          <span class="sv-sched-cal-check">{hiddenCalendars.has(c.id) ? "" : "✓"}</span>
          <span>{c.title}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="sv-sched-workarea">
   {#if hasBacklog}
    <aside class="sv-sched-backlog" class:sv-sched-backlog-drop={dragOverBacklog} bind:this={backlogEl}>
      <div class="sv-sched-backlog-head">{scheduler.backlogTitle ?? "Unscheduled"}</div>
      {#each backlogItems as item (item.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sv-sched-backlog-item" style={item.color ? `--sv-sched-accent:${item.color};` : ""} onpointerdown={(e) => startBacklogDrag(item, e)}>
          <span class="sv-sched-dot"></span><span class="sv-sched-backlog-title">{item.title}</span>
        </div>
      {/each}
    </aside>
   {/if}
   <div class="sv-sched-viewwrap">
  {#if view === "month"}
    <div class="sv-sched-month">
      <div class="sv-sched-monthhead">
        {#each headerOrder as dowIdx (dowIdx)}
          <div class="sv-sched-dow">{wd(dowIdx)}</div>
        {/each}
      </div>
      <div class="sv-sched-monthbody" bind:clientHeight={monthBodyH}>
        {#each monthWeeks as week, wi (wi)}
          {@const weekStart = week[0]!.date}
          {@const seg = monthWeekSegments(viewEvents, weekStart)}
          <div class="sv-sched-week">
            {#each week as cell, ci (cell.date.getTime())}
              {@const moreN = monthMoreCount(seg.segments, ci)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="sv-sched-daycell"
                class:sv-sched-daycell-out={!cell.inMonth}
                class:sv-sched-daycell-nonworking={isNonWorkingDay(cell.date)}
                class:sv-sched-today={isSameDay(cell.date, startOfDay(toZonedLocal(new Date(), tz)))}
                class:sv-sched-daycell-drop={monthOverDay === cell.date.getTime() &&
                  (monthDrag?.moved === true || monthResize?.moved === true)}
                class:sv-sched-select-cell={isMonthCellSelected(cell.date)}
                data-day={cell.date.getTime()}
                onpointerdown={(e) => startMonthRangeSelect(cell.date, e)}
                oncontextmenu={openRangeMenu}
                ondblclick={() => onMonthSlotAdd(cell.date)}
              >
                <div class="sv-sched-daynum">{cell.date.getDate()}</div>
                {#if moreN > 0}
                  <button
                    type="button"
                    class="sv-sched-more"
                    style={`top:${MONTH_DAYNUM_H + visibleMonthLanes * MONTH_LANE_H}px`}
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={(e) => openList(e, eventsOnDay(viewEvents, cell.date), `${mon(cell.date.getMonth())} ${cell.date.getDate()}`)}
                  >+{moreN} more</button>
                {/if}
              </div>
            {/each}
            <!-- Continuous spanning event bars, layered over the day cells. -->
            <div
              class="sv-sched-weekbars"
              class:sv-sched-weekbars-dragging={monthDrag?.moved === true || monthResize?.moved === true || monthRangeSel?.moved === true}
            >
              {#each seg.segments as s (s.event.key)}
                {#if s.lane < visibleMonthLanes}
                  {@const canEditBar = editable && !s.event.recurring}
                  <button
                    type="button"
                    class="sv-sched-bar"
                    data-status={evStatus(s.event)}
                    class:sv-sched-bar-recurring={s.event.recurring}
                    class:sv-sched-bar-draggable={canEditBar}
                    class:sv-sched-bar-source={monthDrag?.moved && monthDrag.ev.key === s.event.key}
                    class:sv-sched-bar-selected={isSelected(s.event)}
                    class:sv-sched-bar-cont-left={s.continuesLeft}
                    class:sv-sched-bar-cont-right={s.continuesRight}
                    style={`left:calc(${(s.startCol / 7) * 100}% + 3px); width:calc(${((s.endCol - s.startCol + 1) / 7) * 100}% - 6px); top:${MONTH_DAYNUM_H + s.lane * MONTH_LANE_H}px; height:${MONTH_LANE_H - 3}px; ${eventStyle(s.event)}`}
                    onclick={(e) => onEventClick(e, s.event)}
                    oncontextmenu={(e) => openMenu(e, s.event)}
                    onpointerdown={(e) => startMonthDrag(e, s.event)}
                    onkeydown={(e) => onEventKey(e, s.event)}
                    onmouseenter={(e) => onEventEnter(e, s.event)}
                    onmouseleave={onEventLeave}
                    title={s.event.title}
                  >
                    {#if canEditBar && !s.continuesLeft}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <span
                        class="sv-sched-chip-resize sv-sched-chip-resize-start"
                        aria-hidden="true"
                        onpointerdown={(e) => startMonthResize(e, s.event, "start")}
                      ></span>
                    {/if}
                    {#if scheduler.event}{@render scheduler.event(s.event.row)}{:else}{#if !s.event.allDay && !s.continuesLeft}<span class="sv-sched-dot"></span><span class="sv-sched-bar-time">{fmtTime(s.event.start)}</span>{/if}<span class="sv-sched-bar-title">{s.event.title}</span>{/if}
                    {#if canEditBar && !s.continuesRight}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <span
                        class="sv-sched-chip-resize sv-sched-chip-resize-end"
                        aria-hidden="true"
                        onpointerdown={(e) => startMonthResize(e, s.event, "end")}
                      ></span>
                    {/if}
                  </button>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if view === "agenda"}
    <div class="sv-sched-agenda">
      {#if agenda.length === 0}
        <div class="sv-sched-empty">No events in this range.</div>
      {/if}
      {#each agenda as group (group.day.getTime())}
        <div class="sv-sched-agenda-day">
          <div class="sv-sched-agenda-date">
            <span class="sv-sched-agenda-dow">{wd(group.day.getDay())}</span>
            <span class="sv-sched-agenda-num">{group.day.getDate()}</span>
            <span class="sv-sched-agenda-mon">{mon(group.day.getMonth()).slice(0, 3)}</span>
          </div>
          <div class="sv-sched-agenda-events">
            {#each group.events as ev (ev.key)}
              <button
                type="button"
                class="sv-sched-agenda-row"
                data-status={evStatus(ev)}
                class:sv-sched-event-selected={isSelected(ev)}
                style={eventStyle(ev)}
                onclick={(e) => onEventClick(e, ev)}
                oncontextmenu={(e) => openMenu(e, ev)}
                onmouseenter={(e) => onEventEnter(e, ev)}
                onmouseleave={onEventLeave}
              >
                {#if scheduler.event}{@render scheduler.event(ev.row)}{:else}
                  <span class="sv-sched-dot"></span>
                  <span class="sv-sched-agenda-time">
                    {ev.allDay ? "all day" : `${fmtTime(ev.start)} - ${fmtTime(ev.end)}`}
                  </span>
                  <span class="sv-sched-agenda-title">{ev.title}</span>
                  {#if ev.resourceId}<span class="sv-sched-tag">{ev.resourceId}</span>{/if}
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else if isTimeline}
    <!-- timeline: horizontal time axis, resources as rows -->
    <div class="sv-sched-tl" bind:this={tlScrollEl} bind:clientWidth={tlOuterW} style={`--tl-res-w:${tlResW}px; --tl-axis-w:${tlAxisWidth}px; --tl-lane-h:${tlLaneH}px`}>
      <!-- header: corner + 2-row axis (majors over ticks) -->
      <div class="sv-sched-tl-head">
        <div class="sv-sched-tl-corner"></div>
        <div class="sv-sched-tl-axis">
          <div class="sv-sched-tl-majors">
            {#each tlAxis.majors as m (m.leftPct)}
              <div class="sv-sched-tl-major" style={`left:${m.leftPct}%; width:${m.widthPct}%`}>{m.label}</div>
            {/each}
          </div>
          <div class="sv-sched-tl-ticks" bind:this={tlLanesEl}>
            {#each tlAxis.ticks as t (t.start.getTime())}
              <div class="sv-sched-tl-tick" class:sv-sched-today={t.today} style={`left:${t.leftPct}%; width:${t.widthPct}%`}>
                <span>{t.label}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
      <!-- body: resource gutter + lane track, scrolls together -->
      <div class="sv-sched-tl-body">
        {#if tlDepArrows.length}
          <!-- Dependency arrows: an overlay over the lanes area (offset past the
               resource gutter), spanning all rows. Pointer-transparent. -->
          <svg
            class="sv-sched-dep-layer"
            style={`left:var(--tl-res-w); width:${tlAxisWidth}px; height:${tlBarRects.height}px`}
            width={tlAxisWidth}
            height={tlBarRects.height}
            aria-hidden="true"
          >
            {#each tlDepArrows as arr (arr.id)}
              <path class="sv-sched-dep-line" class:sv-sched-dep-bad={arr.bad} d={arr.d} />
              <path
                class="sv-sched-dep-arrow"
                class:sv-sched-dep-bad={arr.bad}
                d={`M${arr.hx},${arr.hy} l-6,-3.5 l0,7 z`}
              />
            {/each}
          </svg>
        {/if}
        {#snippet tlResourceRow(row: TlPacked, ri: number, depth: number)}
          {@const rowH = Math.max(1, row.laneCount) * tlLaneH + 6 + histH}
          {@const isDropRow = !!tlMovePreview && tlMovePreview.resId === (row.resource?.id ?? "")}
          {@const isBlocked = !!tlDrag?.moved && tlDrag.mode === "move" && hasEligibility && !eligibleFor(tlDrag.ev.row, row.resource?.id)}
          <div class="sv-sched-tl-row" class:sv-sched-tl-row-drop={isDropRow} class:sv-sched-tl-row-blocked={isBlocked} style={`height:${rowH}px`}>
            <div class="sv-sched-tl-resgutter" style={depth > 0 ? `padding-left:${8 + depth * 14}px` : undefined}>
              {#if row.resource?.color}<span class="sv-sched-dot" style={`--sv-sched-accent:${row.resource.color}`}></span>{/if}
              <span class="sv-sched-tl-resname">{row.resource?.title ?? row.resource?.id ?? "All"}</span>
            </div>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="sv-sched-tl-lanes"
              data-tlres={row.resource?.id ?? ""}
              onpointerdown={(e) => startTlRangeSelect(ri, e)}
              oncontextmenu={openRangeMenu}
            >
              <!-- vertical tick gridlines -->
              {#each tlAxis.ticks as t (t.start.getTime())}
                <div class="sv-sched-tl-gridline" class:sv-sched-today={t.today} style={`left:${t.leftPct}%; width:${t.widthPct}%`}></div>
              {/each}
              {#if heatOn}
                <!-- utilization heatmap: a background tint per tick by load. -->
                {#each heatCellsFor(row.resource) as hc, hi (hi)}
                  {#if hc.intensity > 0}
                    <div class="sv-sched-heat-cell" class:sv-sched-heat-over={hc.over} style={`left:${hc.leftPct}%; width:${hc.widthPct}%; --sv-heat-i:${hc.intensity}`}></div>
                  {/if}
                {/each}
              {/if}
              {#if freeBusyOn}
                <!-- free/busy overlay: external busy time shaded on the row. -->
                {#each freeBusyBandsFor(row.resource) as fb, fi (fi)}
                  <div class="sv-sched-freebusy" style={`left:${fb.leftPct}%; width:${fb.widthPct}%`} aria-hidden="true"></div>
                {/each}
              {/if}
              {#if bookableOn}
                <!-- bookable slots: clickable ghost cells over the free time. -->
                {#each bookableSlotsFor(row.resource) as slot, si (si)}
                  {@const sg = tlGeom(slot.start, slot.end)}
                  {#if sg}
                    <button
                      type="button"
                      class="sv-sched-bookslot"
                      style={`left:${sg.leftPct}%; width:${sg.widthPct}%; top:3px; height:${tlLaneH - 4}px`}
                      onclick={() => pickSlot(row.resource, slot)}
                      title={`Book ${fmtTime(slot.start)} - ${fmtTime(slot.end)}`}
                    ><span class="sv-sched-bookslot-label">{fmtTime(slot.start)}</span></button>
                  {/if}
                {/each}
              {/if}
              {#if histOn}
                <!-- resource utilization histogram: a bar per tick, pinned to the bottom -->
                <div class="sv-sched-hist" style={`height:${histH}px`} aria-hidden="true">
                  {#each histBars(row.resource) as b, bi (bi)}
                    <div class="sv-sched-hist-bar" class:sv-sched-hist-over={b.over} style={`left:calc(${b.leftPct}% + 3px); width:calc(${b.widthPct}% - 6px); height:${b.hPct}%`}></div>
                  {/each}
                </div>
              {/if}
              {#if nowTlPct != null}
                <div class="sv-sched-tl-nowline" style={`left:${nowTlPct}%`}></div>
              {/if}
              {#if tlRangeBand && ri >= tlRangeBand.lo && ri <= tlRangeBand.hi}
                <div class="sv-sched-select-mirror" style={`left:${tlRangeBand.leftPct}%; width:${tlRangeBand.widthPct}%; top:2px; bottom:2px`}></div>
              {/if}
              {#if isDropRow && tlMovePreview}
                <!-- Move preview: where the dragged bar lands in this row. -->
                <div
                  class="sv-sched-drag-preview sv-sched-tl-bar"
                  style={`left:${tlMovePreview.g.leftPct}%; width:${tlMovePreview.g.widthPct}%; top:3px; height:${tlLaneH - 4}px; ${eventStyle(tlMovePreview.ev)}`}
                >
                  <span class="sv-sched-bar-title">{tlMovePreview.ev.title}</span>
                </div>
              {/if}
              {#each row.items as it (it.event.key)}
                {@const g = tlBarGeom(it.event)}
                {#if g}
                  {@const canEdit = editable && (!it.event.recurring || recurEditable)}
                  {@const wpx = (g.widthPct / 100) * tlAxisWidth}
                  <button
                    type="button"
                    class="sv-sched-bar sv-sched-tl-bar"
                    data-status={evStatus(it.event)}
                    class:sv-sched-tl-bar-tiny={wpx < 22}
                    class:sv-sched-bar-recurring={it.event.recurring}
                    class:sv-sched-bar-draggable={canEdit}
                    class:sv-sched-bar-source={tlDrag?.moved && tlDrag.mode === "move" && tlDrag.ev.key === it.event.key}
                    class:sv-sched-bar-resizing={tlDrag?.moved && tlDrag.mode !== "move" && tlDrag.ev.key === it.event.key}
                    class:sv-sched-bar-selected={isSelected(it.event)}
                    class:sv-sched-bar-cont-left={g.continuesLeft}
                    class:sv-sched-bar-cont-right={g.continuesRight}
                    style={`left:${g.leftPct}%; width:${g.widthPct}%; top:${it.lane * tlLaneH + 3}px; height:${tlLaneH - 4}px; ${eventStyle(it.event)}`}
                    onpointerdown={(e) => startTlDrag(e, it.event, "move")}
                    onclick={(e) => onEventClick(e, it.event)}
                    oncontextmenu={(e) => openMenu(e, it.event)}
                    onkeydown={(e) => onEventKey(e, it.event)}
                    onmouseenter={(e) => onEventEnter(e, it.event)}
                    onmouseleave={onEventLeave}
                    title={it.event.title}
                  >
                    {#if canEdit && !g.continuesLeft}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <span class="sv-sched-chip-resize sv-sched-chip-resize-start" aria-hidden="true" onpointerdown={(e) => startTlDrag(e, it.event, "resize-start")}></span>
                    {/if}
                    {#if wpx >= 22}
                      {#if scheduler.event}{@render scheduler.event(it.event.row)}{:else}{#if view === "timelineDay" && !it.event.allDay && !g.continuesLeft}<span class="sv-sched-bar-time">{fmtTime(it.event.start)}</span>{/if}<span class="sv-sched-bar-title">{it.event.title}</span>{/if}
                    {/if}
                    {#if canEdit && !g.continuesRight}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <span class="sv-sched-chip-resize sv-sched-chip-resize-end" aria-hidden="true" onpointerdown={(e) => startTlDrag(e, it.event, "resize-end")}></span>
                    {/if}
                  </button>
                {/if}
              {/each}
            </div>
          </div>
        {/snippet}
        {#each tlRenderRows as dr (dr.kind === "group" ? "g:" + dr.group.id : "r:" + (dr.row.resource?.id ?? "__all"))}
          {#if dr.kind === "group"}
            {@const g = dr.group}
            <div class="sv-sched-tl-row sv-sched-tl-grouprow" style={`height:${GROUP_ROW_H}px`}>
              <div class="sv-sched-tl-resgutter sv-sched-tl-grouphdr" style={`padding-left:${8 + g.depth * 14}px`}>
                <button type="button" class="sv-sched-group-toggle" aria-expanded={!g.collapsed} onclick={() => toggleGroup(g.id)}>
                  <span class="sv-sched-group-chevron" class:sv-collapsed={g.collapsed} aria-hidden="true">▾</span>
                  {#if g.color}<span class="sv-sched-dot" style={`--sv-sched-accent:${g.color}`}></span>{/if}
                  <span class="sv-sched-tl-resname">{g.title}</span>
                  <span class="sv-sched-group-count">{g.childResourceIds?.length ?? 0}</span>
                </button>
              </div>
              <div class="sv-sched-tl-lanes sv-sched-tl-grouplanes">
                {#each tlAxis.ticks as t (t.start.getTime())}
                  <div class="sv-sched-tl-gridline" class:sv-sched-today={t.today} style={`left:${t.leftPct}%; width:${t.widthPct}%`}></div>
                {/each}
              </div>
            </div>
          {:else}
            {@render tlResourceRow(dr.row, dr.ri, dr.depth)}
          {/if}
        {/each}
        <!-- filler row so the axis gridlines fill the remaining height -->
        <div class="sv-sched-tl-row sv-sched-tl-filler">
          <div class="sv-sched-tl-resgutter"></div>
          <div class="sv-sched-tl-lanes">
            {#each tlAxis.ticks as t (t.start.getTime())}
              <div class="sv-sched-tl-gridline" class:sv-sched-today={t.today} style={`left:${t.leftPct}%; width:${t.widthPct}%`}></div>
            {/each}
            {#if nowTlPct != null}
              <div class="sv-sched-tl-nowline" style={`left:${nowTlPct}%`}></div>
            {/if}
          </div>
        </div>
      </div>
      {#if tlSummary}
        <!-- per-time-column summary strip, sticky to the bottom of the scroller -->
        <div class="sv-sched-tl-summary">
          <div class="sv-sched-tl-resgutter sv-sched-tl-summary-label">{summaryCfg?.label ?? "Total"}</div>
          <div class="sv-sched-tl-lanes">
            {#each tlAxis.ticks as t, ti (t.start.getTime())}
              <div class="sv-sched-tl-summary-cell" style={`left:${t.leftPct}%; width:${t.widthPct}%`}>{tlSummary[ti] ?? ""}</div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- week / day time-grid -->
    <div class="sv-sched-grid">
     <div class="sv-sched-xscroll" bind:this={gridScrollEl}>
      <div
        class="sv-sched-xinner"
        style={`--cols:${gridCols.length};--gutn:${gutterCount};--gutw:${gutterCount * 56}px;${gridMinWidth ? ` min-width:${gridMinWidth}px;` : ""}`}
      >
       <!-- Sticky header block: stays pinned to the top of the single (both-axis)
            scroller while the body scrolls vertically, and scrolls horizontally
            with the columns. -->
       <div class="sv-sched-headwrap">
       {#if groupHeaders.length}
        <div class="sv-sched-grouphead">
          <div class="sv-sched-gutter-head"></div>
          {#each groupHeaders as g (g.key)}
            <div class="sv-sched-groupcell" style={`grid-column: span ${g.span};${g.color ? ` --sv-sched-accent:${g.color};` : ""}`}>
              {#if g.color}<span class="sv-sched-dot"></span>{/if}
              <span class="sv-sched-group-label">{g.label}</span>
            </div>
          {/each}
        </div>
       {/if}
       <div class="sv-sched-gridhead">
        <div class="sv-sched-gutter-head sv-sched-zonehead">
          {#each secondaryRulers as sr (sr.label)}<span class="sv-sched-zonelabel">{sr.label}</span>{/each}
          {#if primaryZoneLabel}<span class="sv-sched-zonelabel sv-sched-zonelabel-primary">{primaryZoneLabel}</span>{/if}
        </div>
        {#each gridCols as col (col.key)}
          {@const special = specialByDay.get(dayKey(col.date))}
          <div class="sv-sched-colhead" class:sv-sched-today={col.today} class:sv-sched-colhead-special={!!special}>
            {#if col.color && groupByDate}<span class="sv-sched-dot" style={`--sv-sched-accent:${col.color};`}></span>{/if}
            <span class="sv-sched-colhead-label">{col.label}</span>
            {#if col.sub}<span class="sv-sched-colhead-sub">{col.sub}</span>{/if}
            {#if special}<span class="sv-sched-special-tag" style={special.color ? `--sv-sched-special:${special.color};` : ""} title={special.label ?? "Special date"}>{special.label ?? "•"}</span>{/if}
          </div>
        {/each}
       </div>

      {#if hasAllDayRow}
        <div class="sv-sched-allday" bind:this={allDayRowEl} style={allDayBars ? `height:${Math.max(1, allDaySegs.laneCount) * 22 + 8}px` : ""}>
          <div class="sv-sched-gutter-head sv-sched-allday-label">all-day</div>
          {#if allDayBars}
            <!-- Per-day background cells keep the column separator lines continuous
                 with the header + hourly grid; the bars overlay spans them. -->
            {#each gridCols as col (col.key)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="sv-sched-allday-colbg"
                class:sv-sched-daycell-drop={(allDayPreview?.kind === "allday" && allDayPreview.colKey === col.key) ||
                  drag?.overAllDay?.key === col.key}
                class:sv-sched-select-cell={rangeSelAllDayKeys?.has(col.key)}
                onpointerdown={(e) => startAllDayRangeSelect(col, e)}
                oncontextmenu={openRangeMenu}
              ></div>
            {/each}
            <!-- Multi-day / all-day events as continuous spanning bars, lane-stacked. -->
            <div class="sv-sched-allday-bars">
              {#each allDaySegs.segments as s (s.event.key)}
                {@const canEditBar = editable && !s.event.recurring}
                <button
                  type="button"
                  class="sv-sched-bar"
                  class:sv-sched-bar-recurring={s.event.recurring}
                  class:sv-sched-bar-draggable={canEditBar}
                  class:sv-sched-bar-source={allDayDrag?.moved && allDayDrag.ev.key === s.event.key}
                  class:sv-sched-bar-cont-left={s.continuesLeft}
                  class:sv-sched-bar-cont-right={s.continuesRight}
                  style={`left:calc(${(s.startCol / gridCols.length) * 100}% + 3px); width:calc(${((s.endCol - s.startCol + 1) / gridCols.length) * 100}% - 6px); top:${s.lane * 22 + 2}px; height:19px; ${eventStyle(s.event)}`}
                  onpointerdown={(e) => startAllDayDrag(e, s.event)}
                  onclick={() => openEvent(s.event)}
                  oncontextmenu={(e) => openMenu(e, s.event)}
                  onmouseenter={(e) => onEventEnter(e, s.event)}
                  onmouseleave={onEventLeave}
                  title={s.event.title}
                >
                  {#if canEditBar && !s.continuesLeft}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-sched-chip-resize sv-sched-chip-resize-start"
                      aria-hidden="true"
                      onpointerdown={(e) => startAllDayResize(e, s.event, "start")}
                    ></span>
                  {/if}
                  {#if scheduler.event}{@render scheduler.event(s.event.row)}{:else}<span class="sv-sched-bar-title">{s.event.title}</span>{/if}
                  {#if canEditBar && !s.continuesRight}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-sched-chip-resize sv-sched-chip-resize-end"
                      aria-hidden="true"
                      onpointerdown={(e) => startAllDayResize(e, s.event, "end")}
                    ></span>
                  {/if}
                </button>
              {/each}
            </div>
          {:else}
            {#each gridCols as col (col.key)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="sv-sched-allday-cell"
                class:sv-sched-select-cell={rangeSelAllDayKeys?.has(col.key)}
                onpointerdown={(e) => startAllDayRangeSelect(col, e)}
                oncontextmenu={openRangeMenu}
              >
                {#each colAllDay(col) as ev (ev.key)}
                  <button type="button" class="sv-sched-chip" style={eventStyle(ev)} onclick={() => openEvent(ev)} oncontextmenu={(e) => openMenu(e, ev)}>
                    <span class="sv-sched-chip-title">{ev.title}</span>
                  </button>
                {/each}
              </div>
            {/each}
          {/if}
        </div>
      {/if}
       </div>

      <div class="sv-sched-gridscroll">
        <div class="sv-sched-gridbody" style={`height:${bandHours * hourPx}px`} bind:this={bodyEl}>
          {#each secondaryRulers as sr, srIdx (sr.label)}
            <div class="sv-sched-gutter sv-sched-gutter-secondary" style={`left:${srIdx * 56}px`}>
              {#each sr.rows as lbl, i (i)}
                <div class="sv-sched-hour" style={`height:${hourPx}px`}><span>{lbl}</span></div>
              {/each}
            </div>
          {/each}
          <div class="sv-sched-gutter" style={`left:${secondaryRulers.length * 56}px`}>
            {#each gridSlots as s (s.min)}
              <div class="sv-sched-hour" class:sv-sched-hour-minor={!s.startsOnHour} style={`height:${slotPx}px`}><span>{slotRulerLabel(s)}</span></div>
            {/each}
            {#if nowBandPct != null}
              <div class="sv-sched-now-label" style={`top:${nowBandPct}%`}>{fmtTime(now)}</div>
            {/if}
          </div>
          {#each gridCols as col (col.key)}
            {@const layout = colLayout(col)}
            {@const isDropCol = drag?.moved === true && drag?.mode === "move" && drag?.previewCol?.key === col.key}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="sv-sched-col"
              class:sv-sched-col-drop={isDropCol}
              data-col-key={col.key}
              onpointerdown={(e) => startRangeSelect(col, e)}
              ondblclick={(e) => onSlotDblClick(col, e)}
              oncontextmenu={openRangeMenu}
            >
              {#each gridSlots as s (s.min)}
                <div class="sv-sched-slot" class:sv-sched-slot-hour={s.endsOnHour} style={`height:${slotPx}px`}></div>
              {/each}
              {#if hasBookingShade}
                {#each columnShadeBands(col) as sb (sb.top)}
                  <div class="sv-sched-shade" style={`top:${sb.top}%;height:${sb.height}%`}></div>
                {/each}
                {#each columnRestrictedBands(col) as rb (rb.top)}
                  <div class="sv-sched-shade sv-sched-shade-restricted" style={`top:${rb.top}%;height:${rb.height}%`}></div>
                {/each}
                {#if shadeUntilNow && col.today && nowBandPct != null}
                  <div class="sv-sched-shade" style={`top:0;height:${nowBandPct}%`}></div>
                {/if}
              {/if}
              {#if nowBandPct != null && col.today}
                <div class="sv-sched-nowline" style={`top:${nowBandPct}%`}><span class="sv-sched-now-dot"></span></div>
              {/if}
              {#if rangeSelSegs?.has(col.key)}
                {@const seg = rangeSelSegs.get(col.key)!}
                <div class="sv-sched-select-mirror" style={`top:${seg.top}%; height:${seg.height}%; left:2px; right:2px`}></div>
              {/if}
              {#each layout.events as p (p.event.key)}
                {@const isDrag = drag?.ev.key === p.event.key && drag?.moved === true}
                {@const isResize = isDrag && drag!.mode !== "move"}
                {@const isSource = isDrag && drag!.mode === "move"}
                {@const top = isResize ? pctTop(drag!.previewStart) : p.topPct}
                {@const height = isResize ? pctHeight(drag!.previewStart, drag!.previewEnd) : p.heightPct}
                {@const canEdit = editable && (!p.event.recurring || recurEditable)}
                <button
                  type="button"
                  class="sv-sched-event"
                  data-status={evStatus(p.event)}
                  class:sv-sched-event-recurring={p.event.recurring}
                  class:sv-sched-event-draggable={canEdit}
                  class:sv-sched-event-dragging={isResize}
                  class:sv-sched-event-source={isSource}
                  class:sv-sched-event-stacked={collisionMode === "stack" && p.zIndex > 1}
                  class:sv-sched-event-selected={isSelected(p.event)}
                  style={`top:${top}%; height:${height}%; left:calc(${p.leftPct}% + 2px); width:calc(${p.widthPct}% - 4px); --z:${p.zIndex}; ${eventStyle(p.event)}`}
                  onpointerdown={(e) => startTimeDrag(e, p.event, col, "move")}
                  onclick={(e) => onEventClick(e, p.event)}
                  oncontextmenu={(e) => openMenu(e, p.event)}
                  onkeydown={(e) => onEventKey(e, p.event)}
                  onmouseenter={(e) => onEventEnter(e, p.event)}
                  onmouseleave={onEventLeave}
                >
                  {#if canEdit}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-sched-resize sv-sched-resize-top"
                      aria-hidden="true"
                      onpointerdown={(e) => startTimeDrag(e, p.event, col, "resize-start")}
                    ></span>
                  {/if}
                  {#if scheduler.event}{@render scheduler.event(p.event.row)}{:else}<span class="sv-sched-event-time">{fmtTime(isResize ? drag!.previewStart : p.event.start)}{isResize ? ` - ${fmtTime(drag!.previewEnd)}` : ""}</span><span class="sv-sched-event-title">{p.event.title}</span>{/if}
                  {#if canEdit}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-sched-resize sv-sched-resize-bottom"
                      aria-hidden="true"
                      onpointerdown={(e) => startTimeDrag(e, p.event, col, "resize-end")}
                    ></span>
                  {/if}
                </button>
              {/each}
              {#if isDropCol && drag && !drag.overAllDay}
                <!-- Drag preview: the event shown in its DESTINATION column at the
                     drop time, so a cross-column move reads clearly. Hidden while
                     hovering the all-day row (the drop becomes an all-day event). -->
                <div
                  class="sv-sched-drag-preview"
                  style={`top:${pctTop(drag.previewStart)}%; height:${pctHeight(drag.previewStart, drag.previewEnd)}%; ${eventStyle(drag.ev)}`}
                >
                  <span class="sv-sched-event-time">{fmtTime(drag.previewStart)} - {fmtTime(drag.previewEnd)}</span>
                  <span class="sv-sched-event-title">{drag.ev.title}</span>
                </div>
              {/if}
              {#if allDayPreview?.kind === "timed" && allDayPreview.colKey === col.key && allDayDrag}
                <!-- Preview of an all-day bar being dropped into the hourly grid. -->
                <div
                  class="sv-sched-drag-preview"
                  style={`top:${allDayPreview.topPct}%; height:${allDayPreview.heightPct}%; ${eventStyle(allDayDrag.ev)}`}
                >
                  <span class="sv-sched-event-time">{allDayPreview.label}</span>
                  <span class="sv-sched-event-title">{allDayDrag.ev.title}</span>
                </div>
              {/if}
              {#each layout.overflows as o, i (col.key + ":ovf:" + i)}
                <button
                  type="button"
                  class="sv-sched-overflow"
                  style={`top:${o.topPct}%; height:${o.heightPct}%; left:calc(${o.leftPct}% + 2px); width:calc(${o.widthPct}% - 4px);`}
                  onclick={(e) => openList(e, o.events, `${o.count} more events`)}
                  title={`${o.count} more events`}
                >+{o.count} more</button>
              {/each}
            </div>
          {/each}
        </div>
      </div>
      </div>
     </div>
    </div>
  {/if}
   </div>
  </div>
</div>

{#if backlogDrag}
  <div class="sv-sched-backlog-ghost" use:portalToBody style:position="fixed" style:left={`${backlogDrag.x + 12}px`} style:top={`${backlogDrag.y + 12}px`} class:sv-sched-backlog-ghost-over={backlogDrag.over}>
    {backlogDrag.item.title}
  </div>
{/if}

{#if menuOpen}
  <div
    bind:this={menuPanel}
    class="sv-sched-menu"
    use:portalToBody
    use:popIn={{}}
    style:position="fixed"
    style:top={`${menuPos.y}px`}
    style:left={`${menuPos.x}px`}
    aria-label="Event actions"
  >
    <SvMenuList items={menuItems} onclose={() => (menuOpen = false)} onselect={() => (menuOpen = false)} />
  </div>
{/if}

{#if conflictMsg}
  <div class="sv-sched-conflict" use:portalToBody role="status">{conflictMsg}</div>
{/if}
{#if reminders.length}
  <div class="sv-sched-reminders" use:portalToBody role="status" aria-live="polite">
    {#each reminders as r (r.id)}
      <div class="sv-sched-reminder"><span class="sv-sched-reminder-bell" aria-hidden="true">🔔</span>{r.text}</div>
    {/each}
  </div>
{/if}

{#if tipEv}
  <div
    class="sv-sched-tooltip"
    use:portalToBody
    role="tooltip"
    style:position="fixed"
    style:left={`${tipPos.x}px`}
    style:top={`${tipPos.y}px`}
  >
    {#if tooltipSnippet}
      {@render tooltipSnippet(tipEv.row)}
    {:else}
      <div class="sv-sched-tooltip-title">{tipEv.title}</div>
      <div class="sv-sched-tooltip-meta">{tipEv.allDay ? "All day" : `${fmtTime(tipEv.start)} - ${fmtTime(tipEv.end)}`}</div>
      {#if tipEv.resourceId}<div class="sv-sched-tooltip-meta">{resourceTitle(tipEv.resourceId)}</div>{/if}
    {/if}
  </div>
{/if}

{#if recurScope}
  <div
    bind:this={scopePanel}
    class="sv-sched-scope"
    use:portalToBody
    use:popIn={{}}
    style:position="fixed"
    style:top={`${recurScope.y}px`}
    style:left={`${recurScope.x}px`}
    role="dialog"
    aria-label={recurScope.kind === "delete" ? "Delete recurring event" : "Edit recurring event"}
  >
    <div class="sv-sched-scope-title">{recurScope.kind === "delete" ? "Delete recurring event" : "Edit recurring event"}</div>
    <button type="button" class="sv-sched-scope-btn" onclick={() => { recurScope?.occurrence(); recurScope = null; }}>This event</button>
    {#if recurScope.following}
      <button type="button" class="sv-sched-scope-btn" onclick={() => { recurScope?.following?.(); recurScope = null; }}>This and following</button>
    {/if}
    <button type="button" class="sv-sched-scope-btn" onclick={() => { recurScope?.series(); recurScope = null; }}>All events</button>
  </div>
{/if}

{#if listOpen}
  <div
    bind:this={listPanel}
    class="sv-sched-listpop"
    use:portalToBody
    use:popIn={{}}
    style:position="fixed"
    style:top={`${listPos.y}px`}
    style:left={`${listPos.x}px`}
    role="dialog"
    aria-label={listTitle}
  >
    <div class="sv-sched-listpop-head">{listTitle}</div>
    <div class="sv-sched-listpop-body">
      {#each listEvents as ev (ev.key)}
        <button
          type="button"
          class="sv-sched-listpop-item"
          style={eventStyle(ev)}
          onclick={() => pickFromList(ev)}
        >
          <span class="sv-sched-dot"></span>
          <span class="sv-sched-listpop-time">
            {ev.allDay ? "all day" : `${fmtTime(ev.start)} - ${fmtTime(ev.end)}`}
          </span>
          <span class="sv-sched-listpop-title">{ev.title}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if monthDrag?.moved}
  <!-- Cursor-following ghost so a month drag reads clearly. -->
  <div
    class="sv-sched-month-ghost"
    use:portalToBody
    style={`position:fixed; left:${monthDragPos.x + 12}px; top:${monthDragPos.y + 12}px; ${eventStyle(monthDrag.ev)}`}
  >
    <span class="sv-sched-dot"></span>
    <span class="sv-sched-month-ghost-title">{monthDrag.ev.title}</span>
  </div>
{/if}

{#if allDayDrag?.moved}
  <!-- Cursor-following ghost + a hint of the destination while dragging an
       all-day bar (to a time slot, or another day). -->
  <div
    class="sv-sched-month-ghost"
    use:portalToBody
    style={`position:fixed; left:${allDayDrag.x + 12}px; top:${allDayDrag.y + 12}px; ${eventStyle(allDayDrag.ev)}`}
  >
    <span class="sv-sched-dot"></span>
    <span class="sv-sched-month-ghost-title">
      {allDayDrag.ev.title}{allDayPreview?.kind === "timed" ? ` -> ${allDayPreview.label}` : ""}
    </span>
  </div>
{/if}

{#if drag?.moved && drag.mode === "move"}
  <!-- Cursor-following ghost for a time-grid MOVE, so the feedback matches the
       all-day drag: dimmed source + destination preview + this pointer pill. -->
  <div
    class="sv-sched-month-ghost"
    use:portalToBody
    style={`position:fixed; left:${drag.x + 12}px; top:${drag.y + 12}px; ${eventStyle(drag.ev)}`}
  >
    <span class="sv-sched-dot"></span>
    <span class="sv-sched-month-ghost-title">
      {drag.ev.title}{drag.overAllDay ? " -> all-day" : ` -> ${fmtTime(drag.previewStart)}`}
    </span>
  </div>
{/if}

<SvDrawer
    bind:open={drawerOpen}
    title={drawerTitle}
    side={drawerCfg?.side ?? "right"}
    size={drawerCfg?.size ?? "380px"}
    hideClose
    onClose={commitDrawer}
    onClosed={() => (drawerRow = null)}
  >
    <div class="sv-sched-when">
      {#if whenHasAllDay}
        <div class="sv-sched-when-check">
          <SvCheckBox checked={whenAllDay} onChange={setWhenAllDay}>All day</SvCheckBox>
        </div>
      {/if}
      <div class="sv-sched-when-row">
        <span class="sv-sched-when-label">Start</span>
        <div class="sv-sched-when-input">
          <SvDateTimePicker
            value={whenStart}
            onChange={(d) => (whenStart = d)}
            dropDownDisplayMode={whenAllDay ? "calendar" : "both"}
            formatString={whenAllDay ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm"}
          />
        </div>
      </div>
      <div class="sv-sched-when-row">
        <span class="sv-sched-when-label">End</span>
        <div class="sv-sched-when-input">
          <SvDateTimePicker
            value={whenEnd}
            onChange={(d) => (whenEnd = d)}
            dropDownDisplayMode={whenAllDay ? "calendar" : "both"}
            formatString={whenAllDay ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm"}
          />
        </div>
      </div>
    </div>
    {#if recurEditable}
      <div class="sv-sched-recur">
        <div class="sv-sched-recur-row">
          <span class="sv-sched-recur-label">Repeat</span>
          <div class="sv-sched-recur-select sv-sched-recur-repeat">
            <SvDropDownList
              options={REPEAT_OPTIONS}
              value={recFreq}
              onChange={(v) => (recFreq = v as RecFreq)}
            />
          </div>
        </div>
        {#if recFreq}
          <div class="sv-sched-recur-row">
            <span class="sv-sched-recur-label">Every</span>
            <div class="sv-sched-recur-num">
              <SvNumberInput bind:value={recInterval} min={1} step={1} />
            </div>
            <span class="sv-sched-recur-unit">
              {recFreq === "daily" ? "day(s)" : recFreq === "weekly" ? "week(s)" : recFreq === "monthly" ? "month(s)" : "year(s)"}
            </span>
          </div>
          {#if recFreq === "weekly"}
            <div class="sv-sched-recur-row">
              <span class="sv-sched-recur-label">On</span>
              <div class="sv-sched-recur-days">
                {#each headerOrder as d (d)}
                  <button type="button" class="sv-sched-recur-day" class:sv-sched-recur-day-on={recWeekdays.has(d)} onclick={() => toggleWeekday(d)}>
                    {wd(d).charAt(0)}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          {#if recFreq === "monthly"}
            <div class="sv-sched-recur-row">
              <span class="sv-sched-recur-label">On</span>
              <div class="sv-sched-recur-select sv-sched-recur-monthmode">
                <SvDropDownList options={MONTH_MODE_OPTIONS} value={recMonthMode} onChange={(v) => (recMonthMode = v as MonthMode)} />
              </div>
            </div>
            {#if recMonthMode === "day"}
              <div class="sv-sched-recur-row">
                <span class="sv-sched-recur-label">Day</span>
                <div class="sv-sched-recur-num">
                  <SvNumberInput bind:value={recDay} min={1} max={31} step={1} />
                </div>
              </div>
            {:else if recMonthMode === "weekday"}
              <div class="sv-sched-recur-row">
                <span class="sv-sched-recur-label">The</span>
                <div class="sv-sched-recur-select">
                  <SvDropDownList options={WEEK_OF_MONTH_OPTIONS} value={recWeekOfMonth} onChange={(v) => (recWeekOfMonth = v as number)} />
                </div>
                <div class="sv-sched-recur-select">
                  <SvDropDownList options={WEEKDAY_OPTIONS} value={recPosWeekday} onChange={(v) => (recPosWeekday = v as number)} />
                </div>
              </div>
            {/if}
          {/if}
          {#if recFreq === "yearly"}
            <div class="sv-sched-recur-row">
              <span class="sv-sched-recur-label">In</span>
              <div class="sv-sched-recur-select">
                <SvDropDownList options={MONTH_OPTIONS} value={recMonth} onChange={(v) => (recMonth = v as number)} />
              </div>
              <div class="sv-sched-recur-select">
                <SvDropDownList options={YEAR_MODE_OPTIONS} value={recYearMode} onChange={(v) => (recYearMode = v as YearMode)} />
              </div>
            </div>
            {#if recYearMode === "day"}
              <div class="sv-sched-recur-row">
                <span class="sv-sched-recur-label">Day</span>
                <div class="sv-sched-recur-num">
                  <SvNumberInput bind:value={recDay} min={1} max={31} step={1} />
                </div>
              </div>
            {:else}
              <div class="sv-sched-recur-row">
                <span class="sv-sched-recur-label">The</span>
                <div class="sv-sched-recur-select">
                  <SvDropDownList options={WEEK_OF_MONTH_OPTIONS} value={recWeekOfMonth} onChange={(v) => (recWeekOfMonth = v as number)} />
                </div>
                <div class="sv-sched-recur-select">
                  <SvDropDownList options={WEEKDAY_OPTIONS} value={recPosWeekday} onChange={(v) => (recPosWeekday = v as number)} />
                </div>
              </div>
            {/if}
          {/if}
          <div class="sv-sched-recur-row">
            <span class="sv-sched-recur-label">Ends</span>
            <div class="sv-sched-recur-select sv-sched-recur-end">
              <SvDropDownList options={END_OPTIONS} value={recEnd} onChange={(v) => (recEnd = v as RecEnd)} />
            </div>
          </div>
          {#if recEnd === "until"}
            <div class="sv-sched-recur-row">
              <span class="sv-sched-recur-label">On</span>
              <div class="sv-sched-recur-date">
                <SvDateTimePicker
                  value={recUntil}
                  onChange={(d) => (recUntil = d)}
                  dropDownDisplayMode="calendar"
                  formatString="yyyy-MM-dd"
                  nullable
                />
              </div>
            </div>
          {:else if recEnd === "count"}
            <div class="sv-sched-recur-row">
              <span class="sv-sched-recur-label">After</span>
              <div class="sv-sched-recur-num sv-sched-recur-count">
                <SvNumberInput bind:value={recCount} min={1} step={1} />
              </div>
              <span class="sv-sched-recur-unit">occurrence(s)</span>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
    {#if showScope}
      <div class="sv-sched-scope-inline" role="radiogroup" aria-label="Apply changes to">
        <span class="sv-sched-scope-inline-label">Apply changes to</span>
        <div class="sv-sched-scope-seg">
          <button type="button" role="radio" aria-checked={drawerScope === "occurrence"} class:sv-on={drawerScope === "occurrence"} onclick={() => (drawerScope = "occurrence")}>This event</button>
          <button type="button" role="radio" aria-checked={drawerScope === "following"} class:sv-on={drawerScope === "following"} onclick={() => (drawerScope = "following")}>This &amp; following</button>
          <button type="button" role="radio" aria-checked={drawerScope === "series"} class:sv-on={drawerScope === "series"} onclick={() => (drawerScope = "series")}>All events</button>
        </div>
      </div>
    {/if}
    <SvForm
      fields={drawerFields}
      initial={drawerInitial}
      columns={drawerCfg?.columns ?? 1}
      submitLabel={drawerCfg?.submitLabel ?? "Save"}
      cancelLabel="Cancel"
      onSubmit={saveDrawer}
      onCancel={cancelDrawer}
      onChange={(v) => (drawerValues = v)}
    />
    {#if scheduler.onEventDelete}
      <button type="button" class="sv-sched-delete" onclick={deleteDrawer}>
        Delete event
      </button>
    {/if}
  </SvDrawer>

<style>
  .sv-sched {
    --sv-sched-accent: var(--sg-accent, #4f46e5);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font: inherit;
    color: var(--sg-fg, #1f2937);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: var(--sg-radius, 8px);
    overflow: hidden;
    /* Dragging to select cells must not sweep-select the calendar's text
       (day numbers, event titles). Editors/menus are portalled out, so this
       does not affect the drawer inputs. */
    -webkit-user-select: none;
    user-select: none;
  }

  /* toolbar */
  .sv-sched-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    flex: 0 0 auto;
  }
  .sv-sched-nav { display: flex; gap: 4px; }
  .sv-sched-title { flex: 1 1 auto; font-weight: 600; font-size: 0.95rem; }
  .sv-sched-views { display: flex; gap: 4px; align-items: center; }
  .sv-sched-zoom { align-items: center; }
  .sv-sched-zoom-label { font-size: 0.76rem; color: var(--sg-muted, #6b7280); min-width: 54px; text-align: center; }
  .sv-sched-slots { display: inline-flex; gap: 2px; margin-right: 8px; padding-right: 8px; border-right: 1px solid var(--sg-border, #e5e7eb); }
  .sv-sched-btn-slot { min-width: 34px; padding-left: 7px; padding-right: 7px; }
  /* Resource legend / filter (shown in every view when resourceField is set). */
  .sv-sched-reslegend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    flex: 0 0 auto;
  }
  .sv-sched-reschip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--sg-border, #e5e7eb);
    background: var(--sg-bg, #fff);
    color: inherit;
    border-radius: 999px;
    padding: 2px 10px 2px 8px;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    line-height: 1.5;
  }
  .sv-sched-reschip:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .sv-sched-reschip-off { opacity: 0.45; text-decoration: line-through; }
  .sv-sched-btn {
    appearance: none;
    border: 1px solid var(--sg-border, #e5e7eb);
    background: var(--sg-bg, #fff);
    color: inherit;
    border-radius: 6px;
    padding: 4px 10px;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    line-height: 1.4;
  }
  .sv-sched-btn:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 8%, transparent); }
  .sv-sched-btn-active {
    background: var(--sv-sched-accent);
    border-color: var(--sv-sched-accent);
    color: #fff;
  }

  /* month */
  .sv-sched-month { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
  .sv-sched-monthhead { display: grid; grid-template-columns: repeat(7, 1fr); flex: 0 0 auto; }
  .sv-sched-dow {
    padding: 6px 8px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #6b7280);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    text-align: right;
  }
  .sv-sched-monthbody { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
  .sv-sched-week { position: relative; display: grid; grid-template-columns: repeat(7, 1fr); flex: 1 1 0; min-height: 84px; }
  .sv-sched-daycell {
    position: relative;
    border-right: 1px solid var(--sg-border, #e5e7eb);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    padding: 2px 3px 4px;
    overflow: hidden;
    min-width: 0;
  }
  .sv-sched-daycell-out { background: color-mix(in srgb, var(--sg-fg, #1f2937) 5%, transparent); color: var(--sg-muted, #9ca3af); }
  .sv-sched-daynum { font-size: 0.78rem; text-align: right; padding: 1px 3px; }
  .sv-sched-today .sv-sched-daynum {
    float: right;
    background: var(--sv-sched-accent);
    color: #fff;
    border-radius: 999px;
    min-width: 1.4em;
    text-align: center;
  }
  .sv-sched-colhead.sv-sched-today .sv-sched-colhead-sub {
    display: inline-block;
    background: var(--sv-sched-accent);
    color: #fff;
    border-radius: 999px;
    min-width: 1.4em;
    text-align: center;
  }
  .sv-sched-more {
    position: absolute;
    left: 4px;
    border: none;
    background: none;
    color: var(--sg-muted, #6b7280);
    font: inherit;
    font-size: 0.72rem;
    padding: 0 3px;
    cursor: pointer;
    border-radius: 4px;
    z-index: 3;
  }
  .sv-sched-more:hover {
    color: var(--sv-sched-accent);
    background: color-mix(in srgb, var(--sv-sched-accent) 12%, transparent);
  }

  /* Month spanning bars: one continuous element per event per week, laid over
     the day-cell grid and stacked into lanes. */
  .sv-sched-weekbars { position: absolute; inset: 0; pointer-events: none; }
  .sv-sched-weekbars-dragging .sv-sched-bar { pointer-events: none; }
  .sv-sched-bar {
    position: absolute;
    box-sizing: border-box;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    text-align: left;
    border: 1px solid color-mix(in srgb, var(--sv-sched-accent) 45%, transparent);
    border-left: 4px solid var(--sv-sched-accent2, var(--sv-sched-accent));
    background: color-mix(in srgb, var(--sv-sched-accent) 18%, var(--sg-bg, #fff));
    color: inherit;
    border-radius: 4px;
    padding: 0 5px;
    font: inherit;
    font-size: 0.72rem;
    line-height: 1.2;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
  }
  .sv-sched-bar:hover { background: color-mix(in srgb, var(--sv-sched-accent) 30%, var(--sg-bg, #fff)); z-index: 4; }
  .sv-sched-bar-draggable { cursor: grab; }
  .sv-sched-bar-draggable:active { cursor: grabbing; }
  .sv-sched-bar-source { opacity: 0.32; }
  .sv-sched-bar-recurring { border-left-style: double; border-left-width: 4px; }
  /* Continuation edges (event spills into the previous / next week) go flat. */
  .sv-sched-bar-cont-left { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left-width: 0; padding-left: 6px; }
  .sv-sched-bar-cont-right { border-top-right-radius: 0; border-bottom-right-radius: 0; }
  .sv-sched-bar-time { color: color-mix(in srgb, var(--sg-fg, #1f2937) 60%, transparent); font-variant-numeric: tabular-nums; font-size: 0.68rem; }
  .sv-sched-bar-title { overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
  /* Timeline bars: let a title wrap to two lines (taller lanes then show narrow,
     sub-day events legibly instead of clipping them to an ellipsis). */
  .sv-sched-tl-bar { align-items: flex-start; white-space: normal; padding-top: 2px; }
  .sv-sched-tl-bar .sv-sched-bar-title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
    overflow: hidden;
    line-height: 1.12;
    word-break: break-word;
  }
  .sv-sched-tl-bar-tiny { align-items: center; }
  /* Month resize grips: drag a bar's left/right edge across days to change the
     event's start / end date. Revealed on hover, like the time-grid grips. */
  .sv-sched-chip-resize {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 7px;
    cursor: ew-resize;
    opacity: 0;
    z-index: 2;
  }
  .sv-sched-chip-resize-start { left: 0; }
  .sv-sched-chip-resize-end { right: 0; }
  .sv-sched-chip-resize::after {
    content: "";
    position: absolute;
    top: 2px;
    bottom: 2px;
    width: 2px;
    border-radius: 2px;
    background: var(--sv-sched-accent);
  }
  .sv-sched-chip-resize-start::after { left: 1px; }
  .sv-sched-chip-resize-end::after { right: 1px; }
  .sv-sched-bar:hover .sv-sched-chip-resize { opacity: 0.9; }
  /* Month drag feedback: target day highlights, ghost follows the cursor. */
  .sv-sched-daycell-drop {
    background: color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent) !important;
    box-shadow: inset 0 0 0 2px var(--sg-accent, #4f46e5);
  }
  .sv-sched-month-ghost {
    z-index: 70;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 220px;
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid var(--sv-sched-accent);
    background: color-mix(in srgb, var(--sv-sched-accent) 26%, var(--sg-bg, #fff));
    color: var(--sg-fg, #1f2937);
    font-size: 0.75rem;
    font-weight: 500;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
    white-space: nowrap;
  }
  .sv-sched-month-ghost-title { overflow: hidden; text-overflow: ellipsis; }
  .sv-sched-dot {
    flex: 0 0 auto;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--sv-sched-accent);
  }
  /* all-day row chip (time-grid week/day). */
  .sv-sched-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    text-align: left;
    border: none;
    background: color-mix(in srgb, var(--sv-sched-accent) 16%, transparent);
    color: inherit;
    border-radius: 4px;
    padding: 1px 6px;
    font: inherit;
    font-size: 0.72rem;
    line-height: 1.3;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
  }
  .sv-sched-chip:hover { background: color-mix(in srgb, var(--sv-sched-accent) 26%, transparent); }
  .sv-sched-chip-title { overflow: hidden; text-overflow: ellipsis; }

  /* time-grid */
  .sv-sched-grid { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
  /* Single scroll viewport for BOTH axes. Being viewport-width, its vertical
     scrollbar sits at the viewport's right edge (always reachable) and the
     horizontal one at the bottom - instead of the vertical bar being stranded at
     the far-right edge of the wide, horizontally-scrolled column area. The header
     stays put via position:sticky (top) and the time gutter via sticky (left). */
  .sv-sched-xscroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
  .sv-sched-xinner { display: flex; flex-direction: column; width: 100%; }
  /* Header block pinned to the top of the scroller; scrolls horizontally with the
     columns, stays put vertically. */
  .sv-sched-headwrap { position: sticky; top: 0; z-index: 56; background: var(--sg-bg, #fff); }
  .sv-sched-grouphead, .sv-sched-gridhead, .sv-sched-allday {
    display: grid;
    grid-template-columns: var(--gutw, 56px) repeat(var(--cols, 7), 1fr);
    flex: 0 0 auto;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    box-sizing: border-box;
  }
  /* Corner cell(s): pinned both ways (inside the sticky header, sticky to the left). */
  .sv-sched-gutter-head { position: sticky; left: 0; z-index: 1; background: var(--sg-bg, #fff); }
  /* Resource / date group header row (spanning cells above the columns). */
  .sv-sched-groupcell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 4px 8px;
    font-size: 0.78rem;
    font-weight: 600;
    border-left: 1px solid var(--sg-border, #e5e7eb);
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 4%, transparent);
    overflow: hidden;
    white-space: nowrap;
  }
  .sv-sched-group-label { overflow: hidden; text-overflow: ellipsis; }
  .sv-sched-colhead {
    padding: 6px 8px;
    text-align: center;
    font-size: 0.8rem;
    border-left: 1px solid var(--sg-border, #e5e7eb);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .sv-sched-colhead-label { color: var(--sg-muted, #6b7280); font-size: 0.7rem; text-transform: uppercase; }
  .sv-sched-colhead-sub { font-weight: 600; font-size: 0.95rem; padding: 0 6px; }
  .sv-sched-gutter-head { font-size: 0.68rem; color: var(--sg-muted, #9ca3af); }
  .sv-sched-allday-label { display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; }
  .sv-sched-allday-cell { border-left: 1px solid var(--sg-border, #e5e7eb); padding: 2px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sv-sched-allday { position: relative; min-height: 28px; }
  /* Background cells that carry the day column separator lines under the bars. */
  .sv-sched-allday-colbg { border-left: 1px solid var(--sg-border, #e5e7eb); min-width: 0; }
  /* Bars overlay: sits over the day columns (after the 56px gutter). Its right
     edge matches the padded track area so bars align with the scrolled body. */
  /* pointer-events:none lets a drag on empty all-day area reach the colbg cells
     underneath (for range-select); the bars themselves stay interactive. */
  .sv-sched-allday-bars { position: absolute; left: var(--gutw, 56px); top: 0; right: 0; bottom: 0; pointer-events: none; }
  .sv-sched-allday-colbg, .sv-sched-allday-cell { cursor: default; }
  .sv-sched-select-cell { background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 22%, transparent) !important; }

  /* No longer a scroll container - both axes scroll on .sv-sched-xscroll; this is
     just the body wrapper (the gridbody carries its own explicit height). */
  .sv-sched-gridscroll { min-height: 0; }
  .sv-sched-gridbody {
    display: grid;
    grid-template-columns: repeat(var(--gutn, 1), 56px) repeat(var(--cols, 7), 1fr);
    position: relative;
  }
  /* Time gutter pinned to the left of the scroller (its `left` offset is set
     inline so stacked secondary rulers step across). z-index above the events so
     day columns scroll cleanly underneath; sticky still forms a containing block
     for the absolute now-label. */
  .sv-sched-gutter { display: flex; flex-direction: column; position: sticky; z-index: 55; background: var(--sg-bg, #fff); }
  .sv-sched-gutter-secondary { opacity: 0.72; }
  .sv-sched-gutter-secondary .sv-sched-hour span { color: var(--sg-muted, #9ca3af); }
  /* Zone-abbreviation labels in the head corner, aligned over each gutter column. */
  .sv-sched-zonehead { display: flex; align-items: flex-end; padding-bottom: 3px; }
  .sv-sched-zonelabel {
    width: 56px;
    flex: 0 0 56px;
    text-align: right;
    padding-right: 6px;
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--sg-muted, #9ca3af);
    box-sizing: border-box;
  }
  .sv-sched-zonelabel-primary { color: var(--sg-fg, #1f2937); }

  /* ---- current-time ("now") indicator ---- */
  .sv-sched-nowline {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px solid var(--sv-sched-now, #ef4444);
    z-index: 6;
    pointer-events: none;
  }
  .sv-sched-now-dot {
    position: absolute;
    left: -3px;
    top: -4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sv-sched-now, #ef4444);
  }
  .sv-sched-now-label {
    position: absolute;
    right: 3px;
    transform: translateY(-50%);
    padding: 0 4px;
    border-radius: 3px;
    font-size: 0.62rem;
    font-weight: 600;
    line-height: 1.35;
    color: #fff;
    background: var(--sv-sched-now, #ef4444);
    white-space: nowrap;
    z-index: 7;
    pointer-events: none;
  }
  .sv-sched-tl-nowline {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 2px solid var(--sv-sched-now, #ef4444);
    z-index: 6;
    pointer-events: none;
  }

  /* ---- booking rules: non-working / out-of-hours shading + conflict flash ---- */
  .sv-sched-shade {
    position: absolute;
    left: 0;
    right: 0;
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent),
      color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent) 6px,
      transparent 6px,
      transparent 12px
    );
    pointer-events: none;
    z-index: 0;
  }
  /* Hard-restricted bands read stronger (red-tinted hatch) than plain off-hours. */
  .sv-sched-shade-restricted {
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--sv-sched-now, #ef4444) 16%, transparent),
      color-mix(in srgb, var(--sv-sched-now, #ef4444) 16%, transparent) 6px,
      transparent 6px,
      transparent 12px
    );
  }
  .sv-sched-colhead-special { box-shadow: inset 0 -2px 0 0 var(--sv-sched-special, var(--sg-accent, #4f46e5)); }
  .sv-sched-special-tag {
    display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 0.62rem; font-weight: 600; line-height: 1.3; padding: 0 5px; border-radius: 999px;
    color: var(--sv-sched-special, var(--sg-accent, #4f46e5));
    background: color-mix(in srgb, var(--sv-sched-special, var(--sg-accent, #4f46e5)) 16%, transparent);
  }
  .sv-sched-btn:disabled { opacity: 0.4; cursor: default; }
  /* Free/busy status treatments (Outlook-style). [data-status] beats the base. */
  .sv-sched-event[data-status="free"], .sv-sched-bar[data-status="free"], .sv-sched-agenda-row[data-status="free"] {
    background: transparent; color: var(--sv-sched-accent); border-style: dashed;
  }
  .sv-sched-event[data-status="tentative"], .sv-sched-bar[data-status="tentative"], .sv-sched-agenda-row[data-status="tentative"] {
    background-image: repeating-linear-gradient(-45deg,
      color-mix(in srgb, var(--sv-sched-accent) 42%, transparent),
      color-mix(in srgb, var(--sv-sched-accent) 42%, transparent) 3px,
      transparent 3px, transparent 7px);
  }
  .sv-sched-event[data-status="oof"], .sv-sched-bar[data-status="oof"], .sv-sched-agenda-row[data-status="oof"] {
    border-left-width: 5px; border-left-color: #7c3aed;
    background: color-mix(in srgb, #7c3aed 16%, var(--sg-bg, #fff));
  }
  .sv-sched-daycell-nonworking { background: color-mix(in srgb, var(--sg-fg, #1f2937) 5%, transparent); }
  .sv-sched-conflict {
    position: fixed;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    z-index: 2147483002;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #fff;
    background: #ef4444;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    pointer-events: none;
  }
  .sv-sched-reminders {
    position: fixed; right: 20px; top: 20px; z-index: 2147483002;
    display: flex; flex-direction: column; gap: 8px; pointer-events: none;
  }
  .sv-sched-reminder {
    display: flex; align-items: center; gap: 8px; padding: 9px 13px; border-radius: 9px;
    font-size: 0.82rem; font-weight: 600; color: var(--sg-fg, #1f2937);
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e5e7eb);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); border-left: 4px solid var(--sg-accent, #4f46e5);
  }
  .sv-sched-reminder-bell { font-size: 0.9rem; }
  .sv-sched-tooltip {
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
  .sv-sched-tooltip-title { font-weight: 600; }
  .sv-sched-tooltip-meta { opacity: 0.85; font-variant-numeric: tabular-nums; }

  /* ---- unscheduled backlog panel ---- */
  .sv-sched-workarea { display: flex; flex: 1 1 auto; min-height: 0; }
  .sv-sched-viewwrap { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; min-width: 0; }
  .sv-sched-backlog {
    flex: 0 0 auto;
    width: 186px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px;
    border-right: 1px solid var(--sg-border, #e5e7eb);
    overflow-y: auto;
  }
  .sv-sched-backlog-head { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; color: var(--sg-muted, #9ca3af); padding: 2px 4px 4px; }
  .sv-sched-backlog-drop { outline: 2px dashed var(--sg-accent, #4f46e5); outline-offset: -3px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 10%, transparent); }
  .sv-sched-backlog-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
    border-radius: 6px;
    cursor: grab;
    border: 1px solid var(--sg-border, #e5e7eb);
    background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 10%, transparent);
    font-size: 0.82rem;
    touch-action: none;
  }
  .sv-sched-backlog-item:hover { background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 18%, transparent); }
  .sv-sched-backlog-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-sched-backlog-ghost {
    z-index: 2147483003;
    pointer-events: none;
    padding: 5px 9px;
    border-radius: 6px;
    background: var(--sv-sched-accent, #4f46e5);
    color: #fff;
    font-size: 0.8rem;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    opacity: 0.9;
  }
  .sv-sched-backlog-ghost-over { outline: 2px solid #fff; outline-offset: 1px; }
  .sv-sched-hour {
    position: relative;
    border-bottom: 1px solid transparent;
  }
  .sv-sched-hour span {
    position: absolute;
    top: -0.6em;
    right: 6px;
    font-size: 0.68rem;
    color: var(--sg-muted, #9ca3af);
    background: var(--sg-bg, #fff);
    padding: 0 2px;
  }
  /* The first hour label has no gridline above it (only the scroll-container
     edge), so straddling would clip it under the all-day row - top-align it. */
  .sv-sched-hour:first-child span { top: 0; }
  /* Sub-hour ruler labels (e.g. :30, :15) - lighter and smaller than the hour. */
  .sv-sched-hour-minor span { font-size: 0.6rem; opacity: 0.62; }
  .sv-sched-col { position: relative; border-left: 1px solid var(--sg-border, #e5e7eb); }
  /* Sub-hour slot lines are faint; the on-the-hour line is the normal border. */
  .sv-sched-slot { border-bottom: 1px solid color-mix(in srgb, var(--sg-border, #e5e7eb) 45%, transparent); }
  .sv-sched-slot-hour { border-bottom-color: var(--sg-border, #eef0f2); }
  .sv-sched-event {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--sv-sched-accent) 55%, transparent);
    /* Left strip = the secondary accent when set, else the main accent. */
    border-left: 4px solid var(--sv-sched-accent2, var(--sv-sched-accent));
    background: color-mix(in srgb, var(--sv-sched-accent) 16%, var(--sg-bg, #fff));
    color: inherit;
    border-radius: 4px;
    padding: 1px 5px;
    font: inherit;
    font-size: 0.74rem;
    line-height: 1.2;
    text-align: left;
    /* Block flow (not a column) so time + title share a line and wrap - short
       events (e.g. a 15-min standup) still show their title clipped, not blank. */
    display: block;
    min-height: 15px;
    overflow: hidden;
    cursor: pointer;
    touch-action: none;
    z-index: var(--z, 1);
  }
  .sv-sched-event:hover,
  .sv-sched-event:focus-visible { z-index: 30; }
  .sv-sched-event:hover { background: color-mix(in srgb, var(--sv-sched-accent) 26%, var(--sg-bg, #fff)); }
  /* Stacked (offset) events get a subtle ring so overlaps read as separate cards. */
  .sv-sched-event-stacked { box-shadow: -1px 0 0 0 color-mix(in srgb, var(--sg-bg, #fff) 70%, transparent); }
  .sv-sched-event-draggable { cursor: grab; }
  .sv-sched-event-dragging {
    opacity: 0.92;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
    z-index: 40;
    cursor: grabbing;
  }
  /* While moving, the origin fades in place and a ghost shows the destination. */
  .sv-sched-event-source {
    opacity: 0.32;
    cursor: grabbing;
  }
  .sv-sched-col-drop {
    background: color-mix(in srgb, var(--sg-accent, #4f46e5) 8%, transparent);
  }
  .sv-sched-drag-preview {
    position: absolute;
    left: 2px;
    right: 2px;
    box-sizing: border-box;
    pointer-events: none;
    z-index: 50;
    border: 1.5px solid var(--sv-sched-accent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--sv-sched-accent) 26%, var(--sg-bg, #fff));
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
    padding: 2px 6px;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
  }
  /* "+N more" overflow tile for collisionMode 'cap'. */
  .sv-sched-overflow {
    position: absolute;
    box-sizing: border-box;
    border: 1px dashed var(--sg-border, #cbd5e1);
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent);
    color: var(--sg-muted, #64748b);
    border-radius: 4px;
    padding: 2px 4px;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    overflow: hidden;
    z-index: 3;
  }
  .sv-sched-overflow:hover {
    background: color-mix(in srgb, var(--sv-sched-accent) 14%, var(--sg-bg, #fff));
    color: var(--sv-sched-accent);
    border-color: var(--sv-sched-accent);
  }
  .sv-sched-event-recurring { border-left-style: double; border-left-width: 4px; }
  .sv-sched-event-time { color: var(--sg-muted, #6b7280); font-variant-numeric: tabular-nums; font-size: 0.66rem; margin-right: 4px; white-space: nowrap; }
  .sv-sched-event-title { font-weight: 500; }
  /* Resize grips (indicators) at the top + bottom edges. Hidden until the event
     is hovered / focused / being dragged, then a short centred bar appears. */
  .sv-sched-resize {
    position: absolute;
    left: 0;
    right: 0;
    height: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: ns-resize;
    opacity: 0;
    transition: opacity 0.12s ease;
    touch-action: none;
    z-index: 2;
  }
  .sv-sched-resize-top { top: 0; }
  .sv-sched-resize-bottom { bottom: 0; }
  .sv-sched-resize::after {
    content: "";
    width: 26px;
    height: 3px;
    border-radius: 3px;
    background: var(--sv-sched-accent);
    box-shadow: 0 0 0 1.5px var(--sg-bg, #fff);
  }
  .sv-sched-event-draggable:hover .sv-sched-resize,
  .sv-sched-event-draggable:focus-visible .sv-sched-resize,
  .sv-sched-event-dragging .sv-sched-resize {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-sched-resize { transition: none; }
  }

  /* agenda */
  .sv-sched-agenda { flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 4px 0; }
  .sv-sched-empty { padding: 24px; text-align: center; color: var(--sg-muted, #6b7280); }
  .sv-sched-agenda-day { display: flex; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #eef0f2); }
  .sv-sched-agenda-date { flex: 0 0 56px; text-align: center; line-height: 1.1; }
  .sv-sched-agenda-dow { display: block; font-size: 0.68rem; text-transform: uppercase; color: var(--sg-muted, #9ca3af); }
  .sv-sched-agenda-num { display: block; font-size: 1.35rem; font-weight: 600; }
  .sv-sched-agenda-mon { display: block; font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .sv-sched-agenda-events { flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .sv-sched-agenda-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    border: 1px solid var(--sg-border, #eef0f2);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    padding: 6px 10px;
    font: inherit;
    cursor: pointer;
  }
  .sv-sched-agenda-row:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 8%, transparent); }
  .sv-sched-agenda-time { flex: 0 0 auto; color: var(--sg-muted, #6b7280); font-variant-numeric: tabular-nums; font-size: 0.82rem; min-width: 96px; }
  .sv-sched-agenda-title { flex: 1 1 auto; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-sched-tag {
    flex: 0 0 auto;
    font-size: 0.72rem;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sv-sched-accent) 16%, transparent);
    color: var(--sv-sched-accent);
  }

  .sv-sched-menu {
    z-index: 2147483000; /* above the calendar content (portalled to body) */
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
    overflow: hidden;
  }

  /* Recurring-edit scope chooser (This event / All events). */
  .sv-sched-scope {
    z-index: 2147483001;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    min-width: 168px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
  }
  .sv-sched-scope-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--sg-muted, #6b7280);
    padding: 2px 8px 4px;
  }
  .sv-sched-scope-btn {
    text-align: left;
    padding: 7px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .sv-sched-scope-btn:hover { background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 14%, transparent); }
  /* Inline "Apply changes to" scope selector inside the drawer (recurring events). */
  .sv-sched-scope-inline {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 12px;
  }
  .sv-sched-scope-inline-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--sg-muted, #6b7280);
  }
  .sv-sched-scope-seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    overflow: hidden;
  }
  .sv-sched-scope-seg button {
    flex: 1 1 0;
    padding: 6px 8px;
    border: none;
    border-right: 1px solid var(--sg-border, #e5e7eb);
    background: transparent;
    color: var(--sg-muted, #6b7280);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .sv-sched-scope-seg button:last-child { border-right: none; }
  .sv-sched-scope-seg button.sv-on {
    background: var(--sv-sched-accent, #4f46e5);
    color: var(--sg-on-accent, #fff);
  }

  /* "+N more" event-list popover (cap overflow + month day cell). */
  .sv-sched-listpop {
    min-width: 220px;
    max-width: 320px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
    overflow: hidden;
    z-index: 60;
  }
  .sv-sched-listpop-head {
    padding: 8px 12px;
    font-weight: 600;
    font-size: 0.82rem;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .sv-sched-listpop-body { overflow-y: auto; padding: 4px; display: flex; flex-direction: column; gap: 2px; }
  .sv-sched-listpop-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    color: inherit;
    border-radius: 6px;
    padding: 5px 8px;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .sv-sched-listpop-item:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 8%, transparent); }
  .sv-sched-listpop-time { flex: 0 0 auto; color: var(--sg-muted, #6b7280); font-variant-numeric: tabular-nums; font-size: 0.74rem; }
  .sv-sched-listpop-title { flex: 1 1 auto; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Delete button in the detail drawer (shown when onEventDelete is set). */
  .sv-sched-delete {
    margin-top: 12px;
    width: 100%;
    border: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 45%, transparent);
    background: color-mix(in srgb, var(--sg-danger, #dc2626) 10%, transparent);
    color: var(--sg-danger, #dc2626);
    border-radius: 6px;
    padding: 8px 12px;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }
  .sv-sched-delete:hover { background: color-mix(in srgb, var(--sg-danger, #dc2626) 18%, transparent); }

  /* Recurrence pattern editor (in the drawer, when recurrenceField is set). */
  /* "When" editor (all-day toggle + start/end datetime) at the top of the drawer. */
  .sv-sched-when {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }
  .sv-sched-when-check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; }
  .sv-sched-when-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
  .sv-sched-when-label { flex: 0 0 44px; color: var(--sg-muted, #6b7280); }
  .sv-sched-when-input { flex: 1 1 auto; min-width: 0; }
  /* Let the wrapped Sv date pickers fill the drawer width (their default is fixed). */
  .sv-sched-when-input :global(.sv-dtp) { width: 100%; }
  .sv-sched-recur {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent);
  }
  .sv-sched-recur-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
  .sv-sched-recur-label { flex: 0 0 92px; color: var(--sg-muted, #6b7280); }
  .sv-sched-recur-unit { color: var(--sg-muted, #6b7280); }
  .sv-sched-recur-select { flex: 1 1 auto; min-width: 0; }
  .sv-sched-recur-num { flex: 0 0 auto; }
  .sv-sched-recur-date { flex: 1 1 auto; min-width: 0; }
  /* Wrapped Sv controls fill their cell (the number input stays compact so the
     unit label beside it fits). */
  .sv-sched-recur-select :global(.sv-ddl),
  .sv-sched-recur-date :global(.sv-dtp) { width: 100%; }
  .sv-sched-recur-num :global(.sv-num) { width: 88px; min-width: 88px; }
  .sv-sched-recur-days { display: flex; gap: 4px; flex-wrap: wrap; }
  .sv-sched-recur-day {
    width: 26px;
    height: 26px;
    border: 1px solid var(--sg-border, #e5e7eb);
    background: var(--sg-bg, #fff);
    color: inherit;
    border-radius: 50%;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    text-transform: uppercase;
  }
  .sv-sched-recur-day-on {
    background: var(--sv-sched-accent);
    border-color: var(--sv-sched-accent);
    color: #fff;
  }

  /* ---- timeline views (horizontal: time left→right, resources = rows) ---- */
  .sv-sched-tl {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    /* Single scroll container: horizontal (header + body share one width) AND
       vertical - so the vertical scrollbar sits at the VIEWPORT's right edge, not
       at the far-right of the wide content. The sticky head handles the vertical. */
    overflow: auto;
  }
  .sv-sched-tl-head {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 3;
    background: var(--sg-bg, #fff);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    width: calc(var(--tl-res-w) + var(--tl-axis-w));
  }
  .sv-sched-tl-corner {
    flex: 0 0 var(--tl-res-w);
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--sg-bg, #fff);
    border-right: 1px solid var(--sg-border, #e5e7eb);
  }
  .sv-sched-tl-axis { flex: 0 0 var(--tl-axis-w); position: relative; }
  .sv-sched-tl-majors { position: relative; height: 22px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .sv-sched-tl-major {
    position: absolute; top: 0; height: 22px; display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; font-weight: 600; box-sizing: border-box; border-left: 1px solid var(--sg-border, #e5e7eb);
    overflow: hidden; white-space: nowrap;
  }
  .sv-sched-tl-ticks { position: relative; height: 26px; }
  .sv-sched-tl-tick {
    position: absolute; top: 0; height: 26px; display: flex; align-items: center; justify-content: center;
    font-size: 0.68rem; color: var(--sg-muted, #6b7280); box-sizing: border-box;
    border-left: 1px solid var(--sg-border, #e5e7eb); overflow: hidden; white-space: nowrap;
  }
  .sv-sched-tl-tick.sv-sched-today { color: var(--sv-sched-accent); font-weight: 700; }
  .sv-sched-tl-tick span { padding: 0 4px; }

  /* Body fills the remaining height; a trailing filler row extends the axis
     gridlines to the bottom so the timeline uses the full component space. */
  .sv-sched-tl-body {
    width: calc(var(--tl-res-w) + var(--tl-axis-w));
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    /* No own scroll: vertical scrolling belongs to the outer .sv-sched-tl (so its
       scrollbar pins to the viewport, not the content's far right). flex:1 keeps
       the filler row filling the height when there are few resource rows. */
    overflow: visible;
    /* Positioning context for the dependency-arrow overlay. */
    position: relative;
  }
  /* Dependency arrows (Scheduler Pro): drawn over the lanes, past the gutter. */
  .sv-sched-dep-layer {
    position: absolute;
    top: 0;
    pointer-events: none;
    z-index: 3;
    overflow: visible;
  }
  .sv-sched-dep-line {
    fill: none;
    stroke: var(--sv-sched-dep, color-mix(in srgb, var(--sg-fg, #1f2937) 45%, transparent));
    stroke-width: 1.5;
  }
  .sv-sched-dep-arrow {
    fill: var(--sv-sched-dep, color-mix(in srgb, var(--sg-fg, #1f2937) 45%, transparent));
  }
  .sv-sched-dep-line.sv-sched-dep-bad,
  .sv-sched-dep-arrow.sv-sched-dep-bad {
    stroke: var(--sv-sched-dep-bad, #dc2626);
    fill: var(--sv-sched-dep-bad, #dc2626);
  }
  .sv-sched-dep-line.sv-sched-dep-bad {
    stroke-dasharray: 4 3;
  }
  /* Resource utilization histogram (Scheduler Pro) - a subtle meter strip at the
     bottom of each resource row, clearly separated from the event lanes above. */
  .sv-sched-hist {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 4%, transparent);
    border-top: 1px solid color-mix(in srgb, var(--sg-fg, #1f2937) 10%, transparent);
  }
  .sv-sched-hist-bar {
    position: absolute;
    bottom: 0;
    min-height: 2px;
    background: var(--sv-sched-hist, color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 38%, transparent));
    border-radius: 2px 2px 0 0;
  }
  .sv-sched-hist-bar.sv-sched-hist-over {
    background: var(--sv-sched-hist-over, color-mix(in srgb, #dc2626 78%, transparent));
  }
  /* Per-time-column summary strip (Scheduler Pro). */
  .sv-sched-tl-summary {
    display: flex;
    position: sticky;
    bottom: 0;
    z-index: 4;
    min-height: 26px;
    /* Theme-aware footer tint (a hint of fg over the grid bg) so the numbers stay
       legible in both light and dark themes. */
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 5%, var(--sg-bg, #fff));
    border-top: 1px solid var(--sg-border, #e5e7eb);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--sg-fg, #1f2937);
  }
  .sv-sched-tl-summary .sv-sched-tl-resgutter {
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 5%, var(--sg-bg, #fff));
  }
  .sv-sched-tl-summary-label {
    color: var(--sg-muted, #6b7280);
    font-weight: 600;
  }
  .sv-sched-tl-summary .sv-sched-tl-lanes { display: block; }
  .sv-sched-tl-summary-cell {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 1px solid color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent);
    color: var(--sg-fg, #1f2937);
  }
  .sv-sched-tl-row { display: flex; border-bottom: 1px solid var(--sg-border, #e5e7eb); flex: 0 0 auto; }
  .sv-sched-tl-row.sv-sched-tl-filler { flex: 1 1 auto; min-height: 0; border-bottom: none; }
  /* Grouped / tree resource header rows. */
  .sv-sched-tl-grouprow { background: color-mix(in srgb, var(--sg-fg, #1f2937) 4%, var(--sg-bg, #fff)); }
  .sv-sched-tl-grouphdr { align-items: center; }
  .sv-sched-group-toggle {
    display: flex; align-items: center; gap: 7px;
    border: 0; background: transparent; color: inherit; font: inherit;
    font-size: 0.82rem; font-weight: 600; cursor: pointer; padding: 0; width: 100%; text-align: left;
    overflow: hidden;
  }
  .sv-sched-group-chevron { font-size: 0.7rem; transition: transform 0.12s ease; flex: none; }
  .sv-sched-group-chevron.sv-collapsed { transform: rotate(-90deg); }
  .sv-sched-group-count {
    margin-left: auto; font-size: 0.68rem; font-weight: 600; color: var(--sg-muted, #6b7280);
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 8%, transparent);
    padding: 1px 6px; border-radius: 999px; flex: none;
  }
  .sv-sched-tl-grouplanes { background: color-mix(in srgb, var(--sg-fg, #1f2937) 4%, transparent); }
  /* Free/busy overlay: external busy time shaded on a resource row. */
  .sv-sched-freebusy {
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
    background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, color-mix(in srgb, var(--sg-fg, #1f2937) 10%, transparent) 4px, color-mix(in srgb, var(--sg-fg, #1f2937) 10%, transparent) 8px);
  }
  /* Multi-calendar legend: a colour-swatch checkbox per calendar. */
  .sv-sched-cal-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    height: 13px;
    border-radius: 3px;
    font-size: 0.62rem;
    line-height: 1;
    color: var(--sg-on-accent, #fff);
    background: var(--sv-sched-accent, #4f46e5);
    border: 1px solid var(--sv-sched-accent, #4f46e5);
  }
  .sv-sched-reschip-off .sv-sched-cal-check { background: transparent; color: transparent; }
  /* Bookable slots (find-a-time): dashed clickable ghost cells over free time.
     NB: a distinct class from the time-grid hour rows (`.sv-sched-slot`). */
  .sv-sched-bookslot {
    position: absolute;
    z-index: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    box-sizing: border-box;
    /* Neutral "empty slot" look so it never blends with coloured events; it only
       lights up in the accent colour on hover to invite a booking. */
    border: 1px dashed color-mix(in srgb, var(--sg-fg, #1f2937) 26%, transparent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent);
    color: var(--sg-muted, #6b7280);
    font: inherit;
    font-size: 0.66rem;
    font-weight: 500;
    cursor: pointer;
    overflow: hidden;
    min-width: 6px;
  }
  .sv-sched-bookslot::before { content: "+"; font-weight: 700; opacity: 0.7; }
  .sv-sched-bookslot:hover {
    z-index: 2;
    border-style: solid;
    border-color: var(--sv-sched-accent, #4f46e5);
    background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 15%, var(--sg-bg, #fff));
    color: var(--sv-sched-accent, #4f46e5);
  }
  .sv-sched-bookslot:hover::before { opacity: 1; }
  .sv-sched-bookslot-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Utilization heatmap: a background tint per tick, behind events + gridlines. */
  .sv-sched-heat-cell {
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
    background: color-mix(in srgb, var(--sv-sched-heat, var(--sv-sched-accent, #4f46e5)) calc(var(--sv-heat-i, 0) * 55%), transparent);
  }
  .sv-sched-heat-cell.sv-sched-heat-over {
    background: color-mix(in srgb, var(--sv-sched-heat-over, #dc2626) 42%, transparent);
  }
  /* Ineligible target row while dragging (skill / eligibility mismatch). */
  .sv-sched-tl-row-blocked .sv-sched-tl-lanes {
    background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, color-mix(in srgb, #dc2626 12%, transparent) 5px, color-mix(in srgb, #dc2626 12%, transparent) 10px);
    cursor: not-allowed;
  }
  .sv-sched-tl-filler .sv-sched-tl-resgutter { border-right: 1px solid var(--sg-border, #e5e7eb); }
  .sv-sched-tl-resgutter {
    flex: 0 0 var(--tl-res-w);
    position: sticky;
    left: 0;
    z-index: 2;
    display: flex; align-items: center; gap: 6px; padding: 0 10px;
    background: var(--sg-bg, #fff);
    border-right: 1px solid var(--sg-border, #e5e7eb);
    font-size: 0.82rem; font-weight: 500;
  }
  .sv-sched-tl-resname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-sched-tl-lanes { flex: 0 0 var(--tl-axis-w); position: relative; }
  .sv-sched-tl-gridline {
    position: absolute; top: 0; bottom: 0;
    border-left: 1px solid color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent);
  }
  .sv-sched-tl-gridline.sv-sched-today { background: color-mix(in srgb, var(--sv-sched-accent) 7%, transparent); }
  /* Destination row while dragging a bar to another resource. */
  .sv-sched-tl-row-drop .sv-sched-tl-lanes { background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 9%, transparent); }
  .sv-sched-tl-row-drop .sv-sched-tl-resgutter { background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 12%, var(--sg-bg, #fff)); }
  .sv-sched-tl-bar {
    /* a horizontal event bar; inherits the shared .sv-sched-bar look */
    min-width: 6px; /* keep very short events visible + clickable */
    overflow: hidden;
  }
  .sv-sched-tl-bar .sv-sched-bar-time { flex: none; }
  /* Too narrow to read: a clean colored tick (no clipped text, no grips). */
  .sv-sched-tl-bar-tiny { padding: 0; }
  .sv-sched-tl-bar-tiny .sv-sched-chip-resize { display: none; }
  /* Actively resizing: keep it fully opaque + emphasized so the live grow/shrink
     reads clearly (never dimmed like a move source). */
  .sv-sched-bar-resizing {
    opacity: 1;
    z-index: 7;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 55%, transparent), 0 4px 14px -4px rgba(0, 0, 0, 0.45);
  }

  /* ---- selection: drag-select mirror + multi-selected events ---- */
  .sv-sched-select-mirror {
    position: absolute;
    z-index: 5;
    pointer-events: none;
    border-radius: 4px;
    background: color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 55%, transparent);
  }
  .sv-sched-event-selected,
  .sv-sched-bar-selected {
    outline: 2px solid var(--sv-sched-accent, #4f46e5);
    outline-offset: 1px;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sv-sched-accent, #4f46e5) 30%, transparent);
  }
</style>
