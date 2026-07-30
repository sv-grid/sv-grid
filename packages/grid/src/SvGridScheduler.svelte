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
  import type { ColumnDef, RowData, TableFeatures } from "./index";
  import type {
    SchedulerConfig,
    SchedulerEventMoveEvent,
    SchedulerEventResizeEvent,
  } from "./SvGrid.types";
  import {
    resolveEvents,
    eventsOnDay,
    layoutDayEvents,
    agendaGroups,
    rangeForView,
    daysForView,
    navigateAnchor,
    type EventSpec,
    type ResolvedEvent,
    type SchedulerView,
    type SchedulerResource,
  } from "./scheduler-model";
  import {
    startOfDay,
    startOfMonth,
    addDays,
    monthMatrix,
    weekdayOrder,
    isSameDay,
    withTime,
    snapMinute,
    toDate,
  } from "./datetime/date-core";
  import SvMenuList, { type MenuItem } from "./SvMenuList.svelte";
  import SvForm, { type FormField, type FormFieldType } from "./SvForm.svelte";
  import SvDrawer from "./SvDrawer.svelte";
  import { portalToBody, popIn } from "./popover";
  import { createDismissableLayer } from "./a11y/dismissable";

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
  const HOUR_PX = 48;

  let view = $state<SchedulerView>(scheduler.initialView ?? "month");
  // Component context: the arg-less `new Date()` is fine here (runtime), unlike
  // the pure model. Default the anchor to today, at local midnight.
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
      scheduler.allDayField ? !!fieldValue(r, scheduler.allDayField) : false,
    getTitle: (r) => (titleField ? String(fieldValue(r, titleField) ?? "") : ""),
    getColor: (r) =>
      scheduler.colorField
        ? (fieldValue(r, scheduler.colorField) as string | undefined)
        : scheduler.color,
    getResource: (r) =>
      resourceOfE[key(r)] ??
      (resourceField ? (fieldValue(r, resourceField) as string | undefined) : undefined),
    getRecurrence: (r) =>
      scheduler.recurrenceField ? (fieldValue(r, scheduler.recurrenceField) as never) : undefined,
    defaultDurationMin: scheduler.defaultDurationMin ?? 60,
  }));

  const range = $derived(rangeForView(view, anchor, weekStartsOn, agendaDays));
  const events = $derived(resolveEvents(data, spec, range.start, range.end));

  // --- resources (only used by the Day view when resourceField is set) ---
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
  const resourceMode = $derived(!!resourceField && view === "day");

  // --- time-grid columns: per-resource (Day + resourceField) else per-day ---
  type GridCol = { key: string; label: string; sub: string; date: Date; resourceId?: string; color?: string };
  const gridCols = $derived.by<GridCol[]>(() => {
    if (resourceMode) {
      const d = startOfDay(anchor);
      return resources.map((r) => ({
        key: `res:${r.id}`,
        label: r.title ?? r.id,
        sub: "",
        date: d,
        resourceId: r.id,
        color: r.color,
      }));
    }
    return daysForView(view, anchor, weekStartsOn).map((d) => ({
      key: `day:${d.getTime()}`,
      label: wd(d.getDay()),
      sub: `${d.getDate()}`,
      date: d,
    }));
  });
  function colEvents(col: GridCol): ResolvedEvent<TData>[] {
    return eventsOnDay(events, col.date).filter((e) =>
      col.resourceId != null ? (e.resourceId ?? "") === col.resourceId : true,
    );
  }
  function colTimed(col: GridCol) {
    return layoutDayEvents(colEvents(col).filter((e) => !e.allDay), col.date, dayStartHour, dayEndHour);
  }
  function colAllDay(col: GridCol) {
    return colEvents(col).filter((e) => e.allDay);
  }

  const monthWeeks = $derived(monthMatrix(anchor, weekStartsOn, 6));
  const agenda = $derived(agendaGroups(events));
  const hasAllDayRow = $derived(
    (view === "week" || view === "day") && gridCols.some((c) => colAllDay(c).length > 0),
  );
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

  // --- drag to move / resize (time-grid + month), non-recurring events only ---
  type Drag = {
    ev: ResolvedEvent<TData>;
    mode: "move" | "resize";
    grabOffsetMin: number; // where inside the event the pointer grabbed (move)
    durationMin: number;
    startCol: GridCol | null;
    // live preview
    previewStart: Date | null;
    previewEnd: Date | null;
    previewCol: GridCol | null;
  };
  let drag = $state<Drag | null>(null);
  let bodyEl = $state<HTMLElement | null>(null);

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

  function startTimeDrag(e: PointerEvent, ev: ResolvedEvent<TData>, col: GridCol, mode: "move" | "resize") {
    if (!editable || ev.recurring || ev.allDay) return;
    e.preventDefault();
    e.stopPropagation();
    const durationMin = (ev.end.getTime() - ev.start.getTime()) / 60000;
    const grab = minuteAt(e.clientY) - (ev.start.getHours() * 60 + ev.start.getMinutes());
    drag = {
      ev,
      mode,
      grabOffsetMin: Math.max(0, grab),
      durationMin,
      startCol: col,
      previewStart: ev.start,
      previewEnd: ev.end,
      previewCol: col,
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }
  function onDragMove(e: PointerEvent) {
    if (!drag) return;
    const col = (drag.mode === "move" ? colAt(e.clientX) : drag.startCol) ?? drag.startCol;
    const rawMin = minuteAt(e.clientY);
    if (drag.mode === "move") {
      const startMin = snapMinute(Math.max(0, rawMin - drag.grabOffsetMin), slotMinutes);
      const s = withTime(col!.date, dayFromMinutes(startMin));
      drag.previewStart = s;
      drag.previewEnd = new Date(s.getTime() + drag.durationMin * 60000);
      drag.previewCol = col;
    } else {
      const endMin = snapMinute(rawMin, slotMinutes);
      const startMin = drag.ev.start.getHours() * 60 + drag.ev.start.getMinutes();
      const clamped = Math.max(startMin + slotMinutes, endMin);
      drag.previewEnd = withTime(drag.startCol!.date, dayFromMinutes(clamped));
      drag.previewStart = drag.ev.start;
    }
  }
  function onDragEnd() {
    window.removeEventListener("pointermove", onDragMove);
    if (!drag || !drag.previewStart || !drag.previewEnd) {
      drag = null;
      return;
    }
    const { ev, previewStart, previewEnd, previewCol, mode } = drag;
    const k = ev.rowKey;
    startOfE[k] = previewStart;
    endOfE[k] = previewEnd;
    const toResource = previewCol?.resourceId;
    if (toResource != null) resourceOfE[k] = toResource;
    if (mode === "move") {
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
    drag = null;
  }
  // Build a Date carrying only a minute-of-day (used with withTime's day part).
  function dayFromMinutes(min: number): Date {
    const d = new Date(2000, 0, 1);
    d.setHours(Math.floor(min / 60), Math.round(min % 60), 0, 0);
    return d;
  }

  // --- month drag: shift an event by whole days ---
  let monthDrag = $state<{ ev: ResolvedEvent<TData> } | null>(null);
  function startMonthDrag(e: PointerEvent, ev: ResolvedEvent<TData>) {
    if (!editable || ev.recurring) return;
    e.preventDefault();
    monthDrag = { ev };
    window.addEventListener("pointerup", onMonthDrop, { once: true });
  }
  function onMonthDrop(e: PointerEvent) {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-day]");
    if (monthDrag && el?.dataset.day) {
      const target = new Date(Number(el.dataset.day));
      const ev = monthDrag.ev;
      const dayDelta = Math.round((startOfDay(target).getTime() - startOfDay(ev.start).getTime()) / 86400000);
      if (dayDelta !== 0) {
        const s = addDays(ev.start, dayDelta);
        const en = addDays(ev.end, dayDelta);
        startOfE[ev.rowKey] = s;
        endOfE[ev.rowKey] = en;
        scheduler.onEventMove?.({ row: ev.row, start: s, end: en, allDay: ev.allDay });
      }
    }
    monthDrag = null;
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

  // --- detail drawer / editor (mirrors SvGridBoard) ---
  let drawerRow = $state.raw<TData | null>(null);
  const drawerCfg = $derived(
    scheduler.drawer && typeof scheduler.drawer === "object" ? scheduler.drawer : null,
  );
  type DrawerCol = ColumnDef<TFeatures, TData>;
  const drawerFieldCols = $derived.by<DrawerCol[]>(() => {
    const wanted = drawerCfg?.fields;
    if (wanted?.length) {
      return wanted
        .map((f) => fieldColumns.find((c) => c.field === f))
        .filter((c): c is DrawerCol => !!c);
    }
    return fieldColumns;
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
          }
        : { value: o as string | number, label: String(o) },
    );
  }
  let drawerInitial = $state<Record<string, unknown>>({});
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
    if (scheduler.drawer) {
      const row = ev.row;
      const next: Record<string, unknown> = {};
      for (const col of drawerFieldCols) {
        const f = col.field as string;
        next[f] = fieldValue(row, f);
      }
      drawerInitial = next;
      drawerRow = row;
    }
  }
  function saveDrawer(values: Record<string, unknown>) {
    const row = drawerRow;
    if (!row) return;
    const k = key(row);
    const changes: Record<string, unknown> = {};
    for (const col of drawerFieldCols) {
      const f = col.field as string;
      if (values[f] !== fieldValue(row, f)) changes[f] = values[f];
    }
    edits[k] = { ...(edits[k] ?? {}), ...values };
    // keep the move overlay in sync when the drawer edits start / end
    if (scheduler.startField in changes) {
      const s = toDate(values[scheduler.startField] as never);
      if (s) startOfE[k] = s;
    }
    if (scheduler.endField && scheduler.endField in changes) {
      const en = toDate(values[scheduler.endField] as never);
      if (en) endOfE[k] = en;
    }
    scheduler.onEventCommit?.({ row, changes, values: { ...values } });
    drawerRow = null;
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
    const s = withTime(col.date, dayFromMinutes(min));
    const en = new Date(s.getTime() + (scheduler.defaultDurationMin ?? 60) * 60000);
    scheduler.onEventAdd(s, en, col.resourceId);
  }

  function eventStyle(ev: ResolvedEvent<TData>): string {
    const c = ev.color;
    return c ? `--sv-sched-accent:${c};` : "";
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

  {#if view === "month"}
    <div class="sv-sched-month">
      <div class="sv-sched-monthhead">
        {#each headerOrder as dowIdx (dowIdx)}
          <div class="sv-sched-dow">{wd(dowIdx)}</div>
        {/each}
      </div>
      <div class="sv-sched-monthbody">
        {#each monthWeeks as week}
          <div class="sv-sched-week">
            {#each week as cell (cell.date.getTime())}
              {@const dayEvents = eventsOnDay(events, cell.date)}
              <div
                class="sv-sched-daycell"
                class:sv-sched-daycell-out={!cell.inMonth}
                class:sv-sched-today={isSameDay(cell.date, startOfDay(new Date()))}
                data-day={cell.date.getTime()}
              >
                <div class="sv-sched-daynum">{cell.date.getDate()}</div>
                <div class="sv-sched-daylist">
                  {#each dayEvents.slice(0, 3) as ev (ev.key)}
                    <button
                      type="button"
                      class="sv-sched-chip"
                      class:sv-sched-chip-recurring={ev.recurring}
                      style={eventStyle(ev)}
                      onclick={() => openEvent(ev)}
                      oncontextmenu={(e) => openMenu(e, ev)}
                      onpointerdown={(e) => startMonthDrag(e, ev)}
                      onkeydown={(e) => onEventKey(e, ev)}
                      title={ev.title}
                    >
                      {#if !ev.allDay}<span class="sv-sched-dot"></span>{/if}
                      <span class="sv-sched-chip-time">{ev.allDay ? "" : fmtTime(ev.start)}</span>
                      <span class="sv-sched-chip-title">{ev.title}</span>
                    </button>
                  {/each}
                  {#if dayEvents.length > 3}
                    <div class="sv-sched-more">+{dayEvents.length - 3} more</div>
                  {/if}
                </div>
              </div>
            {/each}
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
    <div class="sv-sched-grid" style={`--cols:${gridCols.length}`}>
      <div class="sv-sched-gridhead">
        <div class="sv-sched-gutter-head"></div>
        {#each gridCols as col (col.key)}
          <div class="sv-sched-colhead" class:sv-sched-today={!col.resourceId && isSameDay(col.date, startOfDay(new Date()))}>
            {#if col.color}<span class="sv-sched-dot" style={`--sv-sched-accent:${col.color};`}></span>{/if}
            <span class="sv-sched-colhead-label">{col.label}</span>
            {#if col.sub}<span class="sv-sched-colhead-sub">{col.sub}</span>{/if}
          </div>
        {/each}
      </div>

      {#if hasAllDayRow}
        <div class="sv-sched-allday">
          <div class="sv-sched-gutter-head sv-sched-allday-label">all-day</div>
          {#each gridCols as col (col.key)}
            <div class="sv-sched-allday-cell">
              {#each colAllDay(col) as ev (ev.key)}
                <button type="button" class="sv-sched-chip" style={eventStyle(ev)} onclick={() => openEvent(ev)} oncontextmenu={(e) => openMenu(e, ev)}>
                  <span class="sv-sched-chip-title">{ev.title}</span>
                </button>
              {/each}
            </div>
          {/each}
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
            <div
              class="sv-sched-col"
              data-col-key={col.key}
              ondblclick={(e) => onSlotDblClick(col, e)}
            >
              {#each hourList as h (h)}
                <div class="sv-sched-slot" style={`height:${HOUR_PX}px`}></div>
              {/each}
              {#each colTimed(col) as p (p.event.key)}
                {@const isDrag = drag?.ev.key === p.event.key}
                {@const top = isDrag && drag?.previewStart ? ((drag.previewStart.getHours() * 60 + drag.previewStart.getMinutes() - dayStartHour * 60) / (bandHours * 60)) * 100 : p.topPct}
                <button
                  type="button"
                  class="sv-sched-event"
                  class:sv-sched-event-recurring={p.event.recurring}
                  class:sv-sched-event-dragging={isDrag}
                  style={`top:${top}%; height:${p.heightPct}%; left:calc(${(p.col / p.colCount) * 100}% + 2px); width:calc(${100 / p.colCount}% - 4px); ${eventStyle(p.event)}`}
                  onpointerdown={(e) => startTimeDrag(e, p.event, col, "move")}
                  onclick={() => openEvent(p.event)}
                  oncontextmenu={(e) => openMenu(e, p.event)}
                  onkeydown={(e) => onEventKey(e, p.event)}
                >
                  <span class="sv-sched-event-time">{fmtTime(p.event.start)}</span>
                  <span class="sv-sched-event-title">{p.event.title}</span>
                  {#if editable && !p.event.recurring}
                    <span
                      class="sv-sched-resize"
                      role="separator"
                      aria-label="Resize event"
                      onpointerdown={(e) => startTimeDrag(e, p.event, col, "resize")}
                    ></span>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
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

{#if drawerRow}
  <SvDrawer
    open
    title={drawerTitle}
    side={drawerCfg?.side ?? "right"}
    size={drawerCfg?.size ?? "380px"}
    onClose={() => (drawerRow = null)}
  >
    <SvForm
      fields={drawerFields}
      initial={drawerInitial}
      columns={drawerCfg?.columns ?? 1}
      submitLabel={drawerCfg?.submitLabel ?? "Save"}
      onSubmit={saveDrawer}
    />
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
  .sv-sched-btn:hover { background: var(--sg-hover, #f3f4f6); }
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
  .sv-sched-week { display: grid; grid-template-columns: repeat(7, 1fr); flex: 1 1 0; min-height: 84px; }
  .sv-sched-daycell {
    border-right: 1px solid var(--sg-border, #e5e7eb);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    padding: 2px 3px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    min-width: 0;
  }
  .sv-sched-daycell-out { background: var(--sg-subtle, #fafafa); color: var(--sg-muted, #9ca3af); }
  .sv-sched-daynum { font-size: 0.78rem; text-align: right; padding: 1px 3px; }
  .sv-sched-today .sv-sched-daynum,
  .sv-sched-colhead.sv-sched-today .sv-sched-colhead-sub {
    display: inline-block;
    align-self: flex-end;
    background: var(--sv-sched-accent);
    color: #fff;
    border-radius: 999px;
    min-width: 1.4em;
    text-align: center;
  }
  .sv-sched-daylist { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
  .sv-sched-more { font-size: 0.72rem; color: var(--sg-muted, #6b7280); padding-left: 3px; }

  /* chips (month + all-day) */
  .sv-sched-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    text-align: left;
    border: none;
    background: color-mix(in srgb, var(--sv-sched-accent) 14%, transparent);
    color: inherit;
    border-radius: 4px;
    padding: 1px 5px;
    font: inherit;
    font-size: 0.75rem;
    line-height: 1.35;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
  }
  .sv-sched-chip:hover { background: color-mix(in srgb, var(--sv-sched-accent) 24%, transparent); }
  .sv-sched-chip-recurring { border-left: 2px solid var(--sv-sched-accent); }
  .sv-sched-chip-time { color: var(--sg-muted, #6b7280); font-variant-numeric: tabular-nums; }
  .sv-sched-chip-title { overflow: hidden; text-overflow: ellipsis; }
  .sv-sched-dot {
    flex: 0 0 auto;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--sv-sched-accent);
  }

  /* time-grid */
  .sv-sched-grid { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
  .sv-sched-gridhead, .sv-sched-allday {
    display: grid;
    grid-template-columns: 56px repeat(var(--cols, 7), 1fr);
    flex: 0 0 auto;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .sv-sched-gridhead { position: sticky; top: 0; }
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
  .sv-sched-col { position: relative; border-left: 1px solid var(--sg-border, #e5e7eb); }
  .sv-sched-slot { border-bottom: 1px solid var(--sg-border, #eef0f2); }
  .sv-sched-event {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--sv-sched-accent) 55%, transparent);
    border-left: 3px solid var(--sv-sched-accent);
    background: color-mix(in srgb, var(--sv-sched-accent) 16%, var(--sg-bg, #fff));
    color: inherit;
    border-radius: 4px;
    padding: 2px 5px;
    font: inherit;
    font-size: 0.75rem;
    text-align: left;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1px;
    touch-action: none;
  }
  .sv-sched-event:hover { background: color-mix(in srgb, var(--sv-sched-accent) 26%, var(--sg-bg, #fff)); }
  .sv-sched-event-dragging { opacity: 0.75; box-shadow: 0 4px 12px rgba(0,0,0,0.18); z-index: 5; }
  .sv-sched-event-recurring { border-left-style: double; border-left-width: 4px; }
  .sv-sched-event-time { color: var(--sg-muted, #6b7280); font-variant-numeric: tabular-nums; font-size: 0.7rem; }
  .sv-sched-event-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-sched-resize {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 6px;
    cursor: ns-resize;
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
  .sv-sched-agenda-row:hover { background: var(--sg-hover, #f3f4f6); }
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
</style>
