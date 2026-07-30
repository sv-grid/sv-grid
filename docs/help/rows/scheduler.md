# Scheduler / calendar mode

Set one `scheduler` prop and the grid renders its rows as **events on a
calendar** instead of a table. It is the same `<SvGrid>`, the same `data` and
`columns` - only the presentation changes. Events are placed by time across
four views (Month, Week, Day, Agenda); dragging an event to a new day or time
tells you to reassign its start/end on your own data.

Like [Kanban board mode](/help/rows/kanban-board), the scheduler is a pure
**view of the grid**: it renders the grid's already filtered, sorted, and
searched rows and writes back only through callbacks - it never mutates your
data.

> **Enterprise feature.** The `scheduler` prop and its config types are part of
> the free grid, but the calendar *renderer* ships in `@svgrid/enterprise`.
> Register it once and the view lights up:
>
> ```ts
> import { setLicenseKey, enableSchedulerView } from '@svgrid/enterprise'
> setLicenseKey('YOUR-KEY')   // omit to run soft-gated with a watermark
> enableSchedulerView()
> ```
>
> `installEnterprise(api)` also calls `enableSchedulerView()` for you. Without
> the renderer registered, a grid with a `scheduler` prop shows an upgrade note.

<div data-docs-demo="363-scheduler-intro" data-height="620"></div>

## The minimum

Point `scheduler.startField` at the field that holds each event's start. That
is the only required option. With an `endField` too, events get their real
duration; without one they use `defaultDurationMin` (60 by default). The title
defaults to the first column's field.

```svelte
<SvGrid {data} {columns} scheduler={{ startField: 'start', endField: 'end' }} />
```

Start and end values may be a `Date`, an epoch number, or a parseable/ISO
string - the same coercion the date pickers use.

## Views

The toolbar offers **Month**, **Week**, **Day**, and **Agenda**. Restrict or
reorder them with `views`, and pick the one shown first with `initialView`.
Open on a specific date with `initialDate` (defaults to today).

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    views: ['week', 'day', 'agenda'],
    initialView: 'week',
    weekStartsOn: 1,        // Monday
    dayStartHour: 7,        // time-grid band 07:00..20:00
    dayEndHour: 20,
    slotMinutes: 30,        // snap granularity
  }} />
```

- **Month** - a fixed six-week grid; each day lists its events with a "+N more"
  overflow, and multi-day events appear on every day they span.
- **Week / Day** - a time-grid with an hourly band. Overlapping events are laid
  out by the chosen [collision mode](#colliding-overlapping-events).
- **Agenda** - a chronological list grouped by day. Its span is `agendaDays`
  (default 30).

## Colliding (overlapping) events

When events overlap in the time-grid, `collisionMode` decides how they're shown:

- **`split`** (default) - every collision divides the column width evenly. Two
  overlaps → halves, three → thirds, N → `1/N`. All stay visible.
- **`cap`** - show up to `maxColumns` columns (default 3); the events that don't
  fit collapse into a clickable **`+N more`** tile. Clicking it opens a popover
  listing those events; clicking one opens it. Best when a slot can pile up deep.
- **`stack`** - overlapping events overlap with a horizontal offset and z-order
  instead of shrinking, so each stays wide and readable; hovering brings one to
  the front.

```svelte
<SvGrid {data} {columns}
  scheduler={{ startField: 'start', endField: 'end', collisionMode: 'cap', maxColumns: 3 }} />
```

The **Month** view uses the same idea vertically: a day cell shows its first few
events, then a **`+N more`** button that opens the day's full list in a popover.

## Titles, colors

`titleField` sets the event label; `colorField` gives each event an accent
color (any CSS color), or set one `color` for all of them.

```svelte
<SvGrid {data} {columns}
  scheduler={{ startField: 'start', endField: 'end', titleField: 'title', colorField: 'color' }} />
```

## Drag to move, resize

Set **`editable`** to turn on drag-and-drop and resizing in the time-grid (and
drag-to-another-day in Month). An editable event shows a grab cursor; hovering
it reveals **resize grips at its top and bottom edges**. Drag the body to move
it, the bottom grip to change the end, or the top grip to change the start. The
scheduler computes the new time itself and applies it as an overlay, then fires
a notification so you can mirror it onto your row or persist it. Moves and
resizes snap to `slotMinutes`, and dragging across columns (days or resources)
also reassigns the day / resource.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end', editable: true,
    onEventMove: (e) => { e.row.start = iso(e.start); e.row.end = iso(e.end) },
    onEventResize: (e) => { e.row.end = iso(e.end) },
  }} />
```

A focused event can also be nudged with the keyboard: **arrow left/right** move
it a day, **arrow up/down** a slot, and **Enter** opens its editor.

<div data-docs-demo="364-scheduler-timegrid" data-height="620"></div>

## Resources (columns per person / room)

Point `resourceField` at a field and the **Day** view splits into one column
per resource - a room- or staff-booking board. Pass an explicit `resources`
array to fix their order, titles, and colors, or let them derive from the data.
Dragging an event across columns reports both the new time and the new resource
(`e.toResource`).

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    resourceField: 'room',
    resources: [
      { id: 'Aurora', title: 'Aurora (12)', color: '#4f46e5' },
      { id: 'Borealis', title: 'Borealis (6)', color: '#0891b2' },
    ],
    initialView: 'day', editable: true,
    onEventMove: (e) => { /* e.toResource is the dropped-on room */ },
  }} />
```

<div data-docs-demo="365-scheduler-resources" data-height="620"></div>

## Recurring events

A row can carry a `recurrenceField` holding a
[`RecurrenceRule`](/help/ui-components/sv-calendar) (or an array of them). The
scheduler renders one event per matching day in the visible window - reusing
the same pure recurrence engine behind `SvCalendar`. Each instance keeps the
base row's time-of-day and duration.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    recurrenceField: 'repeat',
  }} />

<!-- a row -->
{ title: 'Daily standup', start: '2026-07-06T09:30', end: '2026-07-06T09:45',
  repeat: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } }
```

Recurring instances are display-only (they are not individually dragged); edit
the series from the row itself.

<div data-docs-demo="366-scheduler-recurring" data-height="620"></div>

## Editing in a drawer

Set **`drawer`** (`true`, or a config object) and clicking an event opens a
detail drawer with an `SvForm` built from your columns - the field types come
from each column's `editorType`. Saving fires `onEventCommit` with the changed
values, which you mirror onto your row.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    drawer: { title: (row) => row.title, size: '420px' },
    onEventCommit: (e) => Object.assign(e.row, e.values),
  }} />
```

Double-clicking an empty time slot fires `onEventAdd(start, end, resourceId?)`
so you can append a new row.

<div data-docs-demo="367-scheduler-agenda" data-height="620"></div>

## Search, filter, sort flow through

Because the scheduler renders the grid's processed rows, the built-in search
box (`searchable`, on by default) and any column filters or sort applied
elsewhere all narrow the events shown - the calendar is never a separate data
source.

## Config reference

| Option | Purpose |
| --- | --- |
| `startField` *(required)* | Field holding each event's start. |
| `endField` | Field holding the end; else `defaultDurationMin` from the start. |
| `allDayField` | Boolean field marking an all-day event. |
| `titleField` | Event label. Defaults to the first column's field. |
| `colorField` / `color` | Per-event accent color, or one for all. |
| `recurrenceField` | Field holding a `RecurrenceRule` (or array). |
| `defaultDurationMin` | Event length when a row has no `endField` (default 60). |
| `views` / `initialView` | Which views to offer, and the first shown. |
| `initialDate` | The date the calendar opens on (default today). |
| `weekStartsOn` | First day of the week, 0-6 (default 0). |
| `slotMinutes` | Time-grid slot size and move/resize snap (default 30). |
| `dayStartHour` / `dayEndHour` | Visible time-grid band (default 0..24). |
| `collisionMode` | Overlap layout: `split` (default) / `cap` / `stack`. |
| `maxColumns` | `cap` mode: columns before a `+N more` tile (min 2, default 3). |
| `agendaDays` | How many days the agenda spans (default 30). |
| `resourceField` / `resources` | Split the Day view into per-resource columns. |
| `editable` | Enable drag-to-move and edge-resize. |
| `onEventMove` / `onEventResize` | Fired with the new start/end (and resource). |
| `onEventAdd` | Fired when an empty slot is double-clicked. |
| `event` | A snippet for a custom event body. |
| `drawer` / `onEventCommit` | Built-in detail drawer + save callback. |
| `eventMenu` | Right-click menu items for an event. |
| `searchable` / `searchPlaceholder` | The toolbar search box. |
