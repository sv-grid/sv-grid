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
  } from "@svgrid/grid";

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
  const slotMinutes = $derived(Math.max(5, scheduler.slotMinutes ?? 30));
  const dayStartHour = $derived(scheduler.dayStartHour ?? 0);
  const dayEndHour = $derived(scheduler.dayEndHour ?? 24);
  const agendaDays = $derived(scheduler.agendaDays ?? 30);
  const editable = $derived(scheduler.editable === true);
  const resourceField = $derived(scheduler.resourceField);
  const collisionMode = $derived(scheduler.collisionMode ?? "split");
  const maxColumns = $derived(scheduler.maxColumns ?? 3);
  const HOUR_PX = 48;

  // svelte-ignore state_referenced_locally
  let view = $state<SchedulerView>(scheduler.initialView ?? "month");
  // Component context: the arg-less `new Date()` is fine here (runtime), unlike
  // the pure model. Default the anchor to today, at local midnight.
  // svelte-ignore state_referenced_locally
  let anchor = $state<Date>(startOfDay(toDate(scheduler.initialDate) ?? new Date()));

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
  const spec = $derived.by<EventSpec<TData>>(() => ({
    getKey: (r) => key(r),
    getStart: (r) => startOfE[key(r)] ?? (fieldValue(r, scheduler.startField) as never),
    getEnd: (r) =>
      endOfE[key(r)] ??
      (scheduler.endField ? (fieldValue(r, scheduler.endField) as never) : undefined),
    getAllDay: (r) =>
      allDayOf[key(r)] ?? (scheduler.allDayField ? !!fieldValue(r, scheduler.allDayField) : false),
    getTitle: (r) => (titleField ? String(fieldValue(r, titleField) ?? "") : ""),
    getColor: (r) =>
      scheduler.colorField
        ? (fieldValue(r, scheduler.colorField) as string | undefined)
        : scheduler.color,
    getSecondaryColor: (r) =>
      scheduler.secondaryColorField
        ? (fieldValue(r, scheduler.secondaryColorField) as string | undefined)
        : undefined,
    getResource: (r) =>
      resourceOfE[key(r)] ??
      (resourceField ? (fieldValue(r, resourceField) as string | undefined) : undefined),
    getRecurrence: (r) =>
      scheduler.recurrenceField ? (fieldValue(r, scheduler.recurrenceField) as never) : undefined,
    defaultDurationMin: scheduler.defaultDurationMin ?? 60,
  }));

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
  // The events actually rendered: `events` minus any filtered-out resources.
  // Used by EVERY view so the resource filter works everywhere.
  const viewEvents = $derived(
    resourceField && hiddenResources.size
      ? events.filter((e) => !hiddenResources.has(e.resourceId ?? ""))
      : events,
  );
  function toggleResource(id: string) {
    const next = new Set(hiddenResources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    hiddenResources = next;
  }

  // Resource grouping applies to the time-grid (Week / Day) views.
  const resourcesEnabled = $derived(!!resourceField && (view === "day" || view === "week"));
  const groupByDate = $derived(scheduler.groupByDate === true);

  // --- time-grid columns: resource x day when grouped, else one per day. ---
  type GridCol = { key: string; label: string; sub: string; date: Date; resourceId?: string; color?: string; today: boolean };
  type GroupHeader = { key: string; label: string; color?: string; span: number };
  const gridDays = $derived(daysForView(view, anchor, weekStartsOn));
  const gridCols = $derived.by<GridCol[]>(() => {
    const isToday = (d: Date) => isSameDay(d, startOfDay(new Date()));
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
    if (view === "month") return `${mon(anchor.getMonth())} ${anchor.getFullYear()}`;
    if (view === "day") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    // week / agenda: a range
    const days = view === "week" ? daysForView("week", anchor, weekStartsOn) : [range.start, addDays(range.end, -1)];
    const a = days[0] ?? anchor;
    const b = days[days.length - 1] ?? anchor;
    const sameMonth = a.getMonth() === b.getMonth();
    return `${mon(a.getMonth()).slice(0, 3)} ${a.getDate()} - ${sameMonth ? "" : mon(b.getMonth()).slice(0, 3) + " "}${b.getDate()}, ${b.getFullYear()}`;
  });

  function today() {
    anchor = startOfDay(new Date());
  }
  function go(dir: number) {
    anchor = navigateAnchor(view, anchor, dir);
  }
  function setView(v: SchedulerView) {
    view = v;
  }

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
    // Clear any stale suppress from a prior drag whose trailing click never
    // reached openEvent (e.g. a grip resize), so this press decides afresh.
    suppressClick = false;
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
    const { ev, previewStart, previewEnd, previewCol, mode } = d;
    const k = ev.rowKey;
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
      scheduler.onEventMove?.({ row: ev.row, start: s, end: en, allDay: true, fromResource: ev.resourceId, toResource });
      return;
    }
    if (ev.recurring) {
      // Edit the SERIES: apply the new time-of-day (+ duration) to the base row,
      // keeping the base date, so every occurrence shifts and the pattern holds.
      const baseStart = toDate(fieldValue(ev.row, scheduler.startField) as never) ?? ev.start;
      const ns = dayWithTimeOf(baseStart, previewStart);
      const ne = new Date(ns.getTime() + (previewEnd.getTime() - previewStart.getTime()));
      startOfE[k] = ns;
      endOfE[k] = ne;
      if (mode === "move") scheduler.onEventMove?.({ row: ev.row, start: ns, end: ne, allDay: false });
      else scheduler.onEventResize?.({ row: ev.row, start: ns, end: ne });
      return;
    }
    startOfE[k] = previewStart;
    endOfE[k] = previewEnd;
    if (mode === "move") {
      const toResource = previewCol.resourceId;
      if (toResource != null) resourceOfE[k] = toResource;
      scheduler.onEventMove?.({
        row: ev.row,
        start: previewStart,
        end: previewEnd,
        allDay: false,
        fromResource: ev.resourceId,
        toResource,
      } satisfies SchedulerEventMoveEvent<TData>);
    } else {
      scheduler.onEventResize?.({
        row: ev.row,
        start: previewStart,
        end: previewEnd,
      } satisfies SchedulerEventResizeEvent<TData>);
    }
  }

  // --- month drag: shift an event by whole days. `overDay` (the timestamp of
  // the day cell under the cursor) + a moved flag drive the visual feedback. ---
  let monthDrag = $state<{ ev: ResolvedEvent<TData>; startX: number; startY: number; moved: boolean } | null>(null);
  let monthOverDay = $state<number | null>(null);
  let monthDragPos = $state({ x: 0, y: 0 });
  function startMonthDrag(e: PointerEvent, ev: ResolvedEvent<TData>) {
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
        scheduler.onEventMove?.({ row: ev.row, start: s, end: en, allDay: ev.allDay });
      }
    }
    monthDrag = null;
    monthOverDay = null;
  }

  // --- month resize: drag a chip's left/right edge across days to change the
  // event's start / end date (keeping its time-of-day). ---
  let monthResize = $state<{ ev: ResolvedEvent<TData>; edge: "start" | "end"; startX: number; startY: number; moved: boolean } | null>(null);
  function startMonthResize(e: PointerEvent, ev: ResolvedEvent<TData>, edge: "start" | "end") {
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
    scheduler.onEventResize?.({ row: ev.row, start: startOfE[k] ?? ev.start, end: endOfE[k] ?? ev.end });
  }

  // Double-clicking an empty month day adds an event on that day.
  function onMonthSlotAdd(day: Date) {
    if (!scheduler.onEventAdd) return;
    const s = new Date(day);
    s.setHours(9, 0, 0, 0);
    scheduler.onEventAdd(s, new Date(s.getTime() + (scheduler.defaultDurationMin ?? 60) * 60000));
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
      scheduler.onEventMove?.({ row: ev.row, start: s, end: en, allDay: false, fromResource: ev.resourceId, toResource: col.resourceId });
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
        scheduler.onEventMove?.({ row: ev.row, start: s, end: en, allDay: true });
      }
    }
  }

  // --- all-day BAR resize (week/day all-day row): drag a bar's left/right edge
  // across day columns to change the event's start / end DATE (keeping its
  // time-of-day), the same day-based edge resize the month bars use. ---
  let allDayResize = $state<{ ev: ResolvedEvent<TData>; edge: "start" | "end"; startX: number; startY: number; moved: boolean } | null>(null);
  function startAllDayResize(e: PointerEvent, ev: ResolvedEvent<TData>, edge: "start" | "end") {
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
    scheduler.onEventResize?.({ row: ev.row, start: startOfE[k] ?? ev.start, end: endOfE[k] ?? ev.end });
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
    scheduler.onEventMove?.({ row: ev.row, start: s, end: en, allDay: ev.allDay, toResource: ev.resourceId });
  }

  // --- context menu (mirrors SvGridBoard's dismissable-layer pattern) ---
  let menuOpen = $state(false);
  let menuItems = $state<MenuItem[]>([]);
  let menuPos = $state({ x: 0, y: 0 });
  let menuPanel = $state<HTMLElement | null>(null);
  function openMenu(e: MouseEvent, ev: ResolvedEvent<TData>) {
    const items = scheduler.eventMenu?.(ev.row);
    if (!items?.length) return;
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
    const onScroll = () => (menuOpen = false);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      layer.release();
      window.removeEventListener("scroll", onScroll, true);
    };
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
    const onScroll = () => (listOpen = false);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      layer.release();
      window.removeEventListener("scroll", onScroll, true);
    };
  });

  // --- detail drawer / editor (mirrors SvGridBoard) ---
  let drawerRow = $state.raw<TData | null>(null);
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
  function loadWhen(row: TData) {
    whenAllDay = scheduler.allDayField ? !!fieldValue(row, scheduler.allDayField) : false;
    whenStart = toDate(fieldValue(row, scheduler.startField) as never) ?? null;
    whenEnd = scheduler.endField ? (toDate(fieldValue(row, scheduler.endField) as never) ?? null) : whenStart;
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
  const WEEKDAY_OPTIONS = $derived(headerOrder.map((d) => ({ value: d, label: WEEKDAYS_FULL[d] })));
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
  const recurEditable = $derived(!!scheduler.recurrenceField && !!scheduler.drawer);
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
    const raw = scheduler.recurrenceField ? fieldValue(row, scheduler.recurrenceField) : null;
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
        recPosWeekday = rule.weekdays[0];
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
      drawerRow = row;
    }
  }
  function saveDrawer(values: Record<string, unknown>) {
    const row = drawerRow;
    if (!row) return;
    const k = key(row);
    // Fold the recurrence rule + the "When" fields into the saved values.
    if (recurEditable && scheduler.recurrenceField) {
      values = { ...values, [scheduler.recurrenceField]: buildRule(row) };
    }
    values = { ...values, [scheduler.startField]: isoLocal(whenStart, whenAllDay) };
    if (scheduler.endField) values = { ...values, [scheduler.endField]: isoLocal(whenEnd, whenAllDay) };
    if (scheduler.allDayField) values = { ...values, [scheduler.allDayField]: whenAllDay };

    const changes: Record<string, unknown> = {};
    for (const col of drawerFieldCols) {
      const f = col.field as string;
      if (values[f] !== fieldValue(row, f)) changes[f] = values[f];
    }
    if (recurEditable && scheduler.recurrenceField) changes[scheduler.recurrenceField] = values[scheduler.recurrenceField];
    changes[scheduler.startField] = values[scheduler.startField];
    if (scheduler.endField) changes[scheduler.endField] = values[scheduler.endField];
    if (scheduler.allDayField) changes[scheduler.allDayField] = values[scheduler.allDayField];
    edits[k] = { ...(edits[k] ?? {}), ...values };
    // keep the render overlay in sync with the edited start / end / all-day.
    if (whenStart) startOfE[k] = whenStart;
    if (whenEnd) endOfE[k] = whenEnd;
    if (scheduler.allDayField) allDayOf[k] = whenAllDay;
    scheduler.onEventCommit?.({ row, changes, values: { ...values } });
    drawerRow = null;
  }
  function deleteDrawer() {
    const row = drawerRow;
    if (!row) return;
    drawerRow = null;
    scheduler.onEventDelete?.(row);
  }
  // Explicit discard: close without committing (bypasses the save-on-dismiss).
  function cancelDrawer() {
    drawerRow = null;
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
    if (!scheduler.onEventAdd) return;
    const min = snapMinute(minuteAt(e.clientY), slotMinutes);
    const s = dateAtMinute(col.date, min);
    const en = new Date(s.getTime() + (scheduler.defaultDurationMin ?? 60) * 60000);
    scheduler.onEventAdd(s, en, col.resourceId);
  }

  function eventStyle(ev: ResolvedEvent<TData>): string {
    let s = ev.color ? `--sv-sched-accent:${ev.color};` : "";
    // A secondary color paints the left strip (see the `.sv-sched-event`/`-bar`
    // border-left, which falls back to the main accent when unset).
    if (ev.color2) s += `--sv-sched-accent2:${ev.color2};`;
    return s;
  }
</script>

<div class="sv-sched" role="group" aria-roledescription="calendar">
  <!-- toolbar -->
  <div class="sv-sched-toolbar">
    <div class="sv-sched-nav">
      <button type="button" class="sv-sched-btn" onclick={() => go(-1)} aria-label="Previous">‹</button>
      <button type="button" class="sv-sched-btn" onclick={today}>Today</button>
      <button type="button" class="sv-sched-btn" onclick={() => go(1)} aria-label="Next">›</button>
    </div>
    <div class="sv-sched-title" aria-live="polite">{titleLabel}</div>
    <div class="sv-sched-views">
      {#each views as v (v)}
        <button
          type="button"
          class="sv-sched-btn"
          class:sv-sched-btn-active={view === v}
          onclick={() => setView(v)}
        >{v.charAt(0).toUpperCase() + v.slice(1)}</button>
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
                class:sv-sched-today={isSameDay(cell.date, startOfDay(new Date()))}
                class:sv-sched-daycell-drop={monthOverDay === cell.date.getTime() &&
                  (monthDrag?.moved === true || monthResize?.moved === true)}
                data-day={cell.date.getTime()}
                ondblclick={() => onMonthSlotAdd(cell.date)}
              >
                <div class="sv-sched-daynum">{cell.date.getDate()}</div>
                {#if moreN > 0}
                  <button
                    type="button"
                    class="sv-sched-more"
                    style={`top:${MONTH_DAYNUM_H + visibleMonthLanes * MONTH_LANE_H}px`}
                    onclick={(e) => openList(e, eventsOnDay(viewEvents, cell.date), `${mon(cell.date.getMonth())} ${cell.date.getDate()}`)}
                  >+{moreN} more</button>
                {/if}
              </div>
            {/each}
            <!-- Continuous spanning event bars, layered over the day cells. -->
            <div
              class="sv-sched-weekbars"
              class:sv-sched-weekbars-dragging={monthDrag?.moved === true || monthResize?.moved === true}
            >
              {#each seg.segments as s (s.event.key)}
                {#if s.lane < visibleMonthLanes}
                  {@const canEditBar = editable && !s.event.recurring}
                  <button
                    type="button"
                    class="sv-sched-bar"
                    class:sv-sched-bar-recurring={s.event.recurring}
                    class:sv-sched-bar-draggable={canEditBar}
                    class:sv-sched-bar-source={monthDrag?.moved && monthDrag.ev.key === s.event.key}
                    class:sv-sched-bar-cont-left={s.continuesLeft}
                    class:sv-sched-bar-cont-right={s.continuesRight}
                    style={`left:calc(${(s.startCol / 7) * 100}% + 3px); width:calc(${((s.endCol - s.startCol + 1) / 7) * 100}% - 6px); top:${MONTH_DAYNUM_H + s.lane * MONTH_LANE_H}px; height:${MONTH_LANE_H - 3}px; ${eventStyle(s.event)}`}
                    onclick={() => openEvent(s.event)}
                    oncontextmenu={(e) => openMenu(e, s.event)}
                    onpointerdown={(e) => startMonthDrag(e, s.event)}
                    onkeydown={(e) => onEventKey(e, s.event)}
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
                    {#if !s.event.allDay && !s.continuesLeft}
                      <span class="sv-sched-dot"></span>
                      <span class="sv-sched-bar-time">{fmtTime(s.event.start)}</span>
                    {/if}
                    <span class="sv-sched-bar-title">{s.event.title}</span>
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
                style={eventStyle(ev)}
                onclick={() => openEvent(ev)}
                oncontextmenu={(e) => openMenu(e, ev)}
              >
                <span class="sv-sched-dot"></span>
                <span class="sv-sched-agenda-time">
                  {ev.allDay ? "all day" : `${fmtTime(ev.start)} - ${fmtTime(ev.end)}`}
                </span>
                <span class="sv-sched-agenda-title">{ev.title}</span>
                {#if ev.resourceId}<span class="sv-sched-tag">{ev.resourceId}</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- week / day time-grid -->
    <div class="sv-sched-grid">
     <div class="sv-sched-xscroll">
      <div
        class="sv-sched-xinner"
        style={`--cols:${gridCols.length};${gridMinWidth ? ` min-width:${gridMinWidth}px;` : ""}`}
      >
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
        <div class="sv-sched-gutter-head"></div>
        {#each gridCols as col (col.key)}
          <div class="sv-sched-colhead" class:sv-sched-today={col.today}>
            {#if col.color && groupByDate}<span class="sv-sched-dot" style={`--sv-sched-accent:${col.color};`}></span>{/if}
            <span class="sv-sched-colhead-label">{col.label}</span>
            {#if col.sub}<span class="sv-sched-colhead-sub">{col.sub}</span>{/if}
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
              <div
                class="sv-sched-allday-colbg"
                class:sv-sched-daycell-drop={(allDayPreview?.kind === "allday" && allDayPreview.colKey === col.key) ||
                  drag?.overAllDay?.key === col.key}
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
                  <span class="sv-sched-bar-title">{s.event.title}</span>
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
              <div class="sv-sched-allday-cell">
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

      <div class="sv-sched-gridscroll">
        <div class="sv-sched-gridbody" style={`height:${bandHours * HOUR_PX}px`} bind:this={bodyEl}>
          <div class="sv-sched-gutter">
            {#each hourList as h (h)}
              <div class="sv-sched-hour" style={`height:${HOUR_PX}px`}><span>{hourLabel(h)}</span></div>
            {/each}
          </div>
          {#each gridCols as col (col.key)}
            {@const layout = colLayout(col)}
            {@const isDropCol = drag?.moved === true && drag?.mode === "move" && drag?.previewCol?.key === col.key}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="sv-sched-col"
              class:sv-sched-col-drop={isDropCol}
              data-col-key={col.key}
              ondblclick={(e) => onSlotDblClick(col, e)}
            >
              {#each hourList as h (h)}
                <div class="sv-sched-slot" style={`height:${HOUR_PX}px`}></div>
              {/each}
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
                  class:sv-sched-event-recurring={p.event.recurring}
                  class:sv-sched-event-draggable={canEdit}
                  class:sv-sched-event-dragging={isResize}
                  class:sv-sched-event-source={isSource}
                  class:sv-sched-event-stacked={collisionMode === "stack" && p.zIndex > 1}
                  style={`top:${top}%; height:${height}%; left:calc(${p.leftPct}% + 2px); width:calc(${p.widthPct}% - 4px); --z:${p.zIndex}; ${eventStyle(p.event)}`}
                  onpointerdown={(e) => startTimeDrag(e, p.event, col, "move")}
                  onclick={() => openEvent(p.event)}
                  oncontextmenu={(e) => openMenu(e, p.event)}
                  onkeydown={(e) => onEventKey(e, p.event)}
                >
                  {#if canEdit}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                      class="sv-sched-resize sv-sched-resize-top"
                      aria-hidden="true"
                      onpointerdown={(e) => startTimeDrag(e, p.event, col, "resize-start")}
                    ></span>
                  {/if}
                  <span class="sv-sched-event-time">{fmtTime(isResize ? drag!.previewStart : p.event.start)}{isResize ? ` - ${fmtTime(drag!.previewEnd)}` : ""}</span><span class="sv-sched-event-title">{p.event.title}</span>
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

{#if drawerRow}
  <SvDrawer
    open
    title={drawerTitle}
    side={drawerCfg?.side ?? "right"}
    size={drawerCfg?.size ?? "380px"}
    hideClose
    onClose={commitDrawer}
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
{/if}

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
  .sv-sched-views { display: flex; gap: 4px; }
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
  /* Horizontal scroll wrapper: when resources add many columns, head + body
     scroll together; the vertical scroll stays inside .sv-sched-gridscroll. */
  .sv-sched-xscroll { flex: 1 1 auto; min-height: 0; overflow-x: auto; overflow-y: hidden; }
  .sv-sched-xinner { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; }
  .sv-sched-grouphead, .sv-sched-gridhead, .sv-sched-allday {
    display: grid;
    grid-template-columns: 56px repeat(var(--cols, 7), 1fr);
    flex: 0 0 auto;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
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
  /* Bars overlay: sits over the day columns (after the 56px gutter). */
  .sv-sched-allday-bars { position: absolute; left: 56px; top: 0; right: 0; bottom: 0; }

  .sv-sched-gridscroll { flex: 1 1 auto; overflow-y: auto; min-height: 0; }
  .sv-sched-gridbody {
    display: grid;
    grid-template-columns: 56px repeat(var(--cols, 7), 1fr);
    position: relative;
  }
  .sv-sched-gutter { display: flex; flex-direction: column; }
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
  .sv-sched-col { position: relative; border-left: 1px solid var(--sg-border, #e5e7eb); }
  .sv-sched-slot { border-bottom: 1px solid var(--sg-border, #eef0f2); }
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
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
    overflow: hidden;
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
</style>
