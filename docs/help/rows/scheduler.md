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

Every example below runs against this setup. `enableSchedulerView()` registers
the enterprise renderer; the `scheduler` prop itself is part of the free grid.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type RecurrenceRule } from '@svgrid/grid'
  import { enableSchedulerView } from '@svgrid/enterprise'

  enableSchedulerView()

  // One row type wide enough for every example on this page - resources,
  // recurrence, per-event colour and the booking-rule samples all read from it.
  type Event = {
    id: number
    title: string
    start: string
    end: string
    allDay?: boolean
    color?: string
    staffColor?: string
    roleColor?: string
    room?: string
    machine?: string
    provider?: string
    team?: string
    assignees?: string[]
    repeat?: RecurrenceRule | RecurrenceRule[] | null
    exceptions?: unknown[]
  }

  // Anchored on today, so the calendar always opens with events in view.
  const at = (dayOffset: number, hour: number, mins = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hour, mins, 0, 0)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  let data = $state<Event[]>([
    { id: 1, title: 'Standup',     start: at(0, 9),  end: at(0, 9, 15),  color: '#3b82f6', room: 'Aurora',  team: 'Platform' },
    { id: 2, title: 'Design review', start: at(0, 11), end: at(0, 12),   color: '#8b5cf6', room: 'Borealis', team: 'Design' },
    { id: 3, title: 'Team offsite', start: at(1, 0),  end: at(3, 0),     allDay: true,     color: '#22c55e', team: 'Platform' },
    { id: 4, title: '1:1',         start: at(2, 15), end: at(2, 15, 30), color: '#f59e0b', room: 'Aurora',  team: 'Design' },
  ])

  const rows = data
  const iso = at
  const makeEvent = (start: Date, end: Date): Event => ({
    id: Math.max(0, ...data.map((e) => e.id)) + 1,
    title: "New event",
    start: at(0, start.getHours(), start.getMinutes()),
    end: at(0, end.getHours(), end.getMinutes()),
  })
  const rooms = [
    { id: "Aurora", label: "Aurora" },
    { id: "Borealis", label: "Borealis" },
  ]
  const resources = rooms
  const tasks = data
  let selected = $state<Event | null>(null)
  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const columns: GridColumns<Event> = [
    { field: 'title', header: 'Event', width: 220 },
    { field: 'start', header: 'Start', width: 170 },
    { field: 'end',   header: 'End',   width: 170 },
  ]
</script>
```

## The minimum

Point `scheduler.startField` at the field that holds each event's start. That
is the only required option. With an `endField` too, events get their real
duration; without one they use `defaultDurationMin` (60 by default). The title
defaults to the first column's field.

```svelte {runnable}
<SvGrid {data} {columns} scheduler={{ startField: 'start', endField: 'end' }} />
```

Start and end values may be a `Date`, an epoch number, or a parseable/ISO
string - the same coercion the date pickers use.

## Views

The toolbar offers **Month**, **Week**, **Day**, and **Agenda**. Restrict or
reorder them with `views`, and pick the one shown first with `initialView`.
Open on a specific date with `initialDate` (defaults to today).

```svelte {runnable}
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

- **Month** - a fixed six-week grid. Multi-day events render as **one continuous
  bar** spanning the day columns they cover (split into a fresh segment on each
  week row they continue into), stacked into lanes so they never overlap; a
  per-day **"+N more"** collapses events beyond the visible lanes into a popover.
- **Week / Day** - a time-grid with an hourly band spanning `dayStartHour`..
  `dayEndHour` (default the full `0..24` day; a full-day band opens scrolled to
  business hours rather than midnight). Overlapping events are laid out by the
  chosen [collision mode](#colliding-overlapping-events). **All-day and multi-day
  events** render in a separate **all-day row** at the top (in Week view as
  continuous spanning bars), never filling the hourly columns. Drag an event
  between the all-day row and the grid to flip it between all-day and timed, or
  drag a bar's **left / right edge** to extend or shorten it by whole days. A
  **current-time line** tracks the local time on today's column (`nowIndicator`,
  on by default); the timeline draws it as a vertical line at "now".
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

```svelte {runnable}
<SvGrid {data} {columns}
  scheduler={{ startField: 'start', endField: 'end', collisionMode: 'cap', maxColumns: 3 }} />
```

The **Month** view uses the same idea vertically: a day cell shows its first few
events, then a **`+N more`** button that opens the day's full list in a popover.

## Titles, colors

`titleField` sets the event label; `colorField` gives each event an accent
color (any CSS color), or set one `color` for all of them.

```svelte {runnable}
<SvGrid {data} {columns}
  scheduler={{ startField: 'start', endField: 'end', titleField: 'title', colorField: 'color' }} />
```

Add **`secondaryColorField`** to encode a *second* dimension: it paints a strip
on the **left edge** of each event, distinct from the main fill. A shift roster,
for instance, can fill each event with the **person**'s color (matching the
resource legend) while the left strip shows the **role**:

```svelte {runnable}
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    colorField: 'staffColor',       // fill = person
    secondaryColorField: 'roleColor', // left strip = role
  }} />
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

In the **Month** view an editable event can be **moved** (drag the bar to
another day) and **resized** (hover to reveal left/right grips, then drag an edge
across days to change its start or end date, keeping the time-of-day) - the bar
grows/shrinks live as you drag, and the day under the cursor highlights. The
**all-day spanning bars** in Week / Day view resize the same way: drag a bar's
left or right edge across day columns to change how many days it covers.

A focused event can also be nudged with the keyboard: **arrow left/right** move
it a day, **arrow up/down** a slot, and **Enter** opens its editor.

<div data-docs-demo="382-scheduler-app-clinic" data-height="700"></div>

## Resources (group by person / room)

Point `resourceField` at a field and **every** time-grid view groups by
resource - the **Day** view shows one column per resource, and the **Week** view
groups each resource across all seven days (a spanning group-header row sits
above the columns; the grid scrolls horizontally when there are many). Pass an
explicit `resources` array to fix their order, titles, and colors, or let them
derive from the data. Dragging an event across columns reports both the new time
and the new resource (`e.toResource`).

A **resource legend** appears in *every* view (Month and Agenda included): each
chip is a colour key that toggles that resource's events on or off.

Set **`groupByDate: true`** to flip the grouping to date-major (each day groups
the resources) instead of the default resource-major (each resource groups the
days) - the same choice as Smart's `groupByDate`.

```svelte {runnable}
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    resourceField: 'room',
    resources: [
      { id: 'Aurora', title: 'Aurora (12)', color: '#4f46e5' },
      { id: 'Borealis', title: 'Borealis (6)', color: '#0891b2' },
    ],
    initialView: 'week', editable: true,
    // groupByDate: true,   // day -> resources instead of resource -> days
    onEventMove: (e) => { /* e.toResource is the dropped-on room */ },
  }} />
```

<div data-docs-demo="383-scheduler-app-dispatch" data-height="700"></div>

## Timeline views (resources as rows)

The `timeline*` views flip the layout **horizontal**: time runs left→right on a
scrollable axis and **each resource is a row**, with events as horizontal bars
lane-packed so overlaps stack. Add any of them to `views` (and pick one with
`initialView`):

- **`timelineDay`** - hour ticks across one day (clamped to the
  `dayStartHour..dayEndHour` band).
- **`timelineWeek`** - day ticks across a week.
- **`timelineMonth`** - day ticks across a month.
- **`timelineYear`** - month ticks across a year (grouped into quarters).

```svelte {runnable}
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    resourceField: 'room', resources,
    views: ['timelineDay', 'timelineWeek', 'timelineMonth', 'timelineYear'],
    initialView: 'timelineWeek',
    editable: true,
    onEventMove: (e) => { /* e.toResource = the row it was dropped on */ },
  }} />
```

Without a `resourceField` the timeline shows a single **All** row. When editable,
drag a bar **sideways** to re-time it, drag it to **another row** to reassign the
resource, or drag an **edge** to resize (day-granular on the multi-day zooms,
`timelineSlotMinutes` on the day zoom). Tune the layout with `resourceAreaWidth`
(left gutter), `timelineLaneHeight`, and `timelineSlotMinutes`.

The same [`rangeSelectable` / `eventSelectable`](#selecting-cells--events) modes
work in the timeline: **click or drag empty space** to mark a range (a slot in
Day, whole days in Week/Month, a month in Year), then **arrow keys** move the
selected cell along the axis (Left/Right) and between resource rows (Up/Down),
**Shift+arrows** extend it, and **Enter** creates the event (**Esc** cancels).
**Ctrl/Cmd-click** bars to multi-select, **Delete** to remove.

The `timeline*` views cover any horizon. Short-range planning (Day / Week) and
the long-range **roadmap** (Month / Year) read best with data scaled to the
zoom, so the demos split them:

<div data-docs-demo="371-scheduler-timeline" data-height="560"></div>

<div data-docs-demo="384-scheduler-app-roadmap" data-height="700"></div>

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

The rule shape covers the patterns an enterprise calendar needs:

```ts
{ freq: 'daily',   interval: 2 }                              // every other day
{ freq: 'weekly',  weekdays: [1, 3, 5] }                      // Mon / Wed / Fri
{ freq: 'monthly', day: 1 }                                   // the 1st
{ freq: 'monthly', day: -1 }                                  // the last day
{ freq: 'monthly', weekdays: [2], weekOfMonth: 1 }            // the first Tuesday
{ freq: 'monthly', weekdays: [5], weekOfMonth: -1 }           // the last Friday
{ freq: 'yearly',  month: 10, weekdays: [4], weekOfMonth: 4 } // 4th Thursday of Nov
{ freq: 'weekly',  weekdays: [1], count: 8, from: '2026-01-05' } // 8 times, then stop
```

- `weekOfMonth` (1..4 or `-1` for last) with a single `weekdays` entry gives a
  **positional** monthly / yearly rule ("the 2nd Tuesday", "the last Friday").
- `day` may be **negative** to count from the end (`-1` = the last day).
- End the series with an inclusive `until` **date** or a `count` of occurrences
  (counted from `from`, which the editor sets to the event's start).

### Editing patterns

Whenever the **`drawer`** is on, clicking **any** event opens a **recurrence
editor** in the drawer - so you can turn a one-off into a recurring event (or drop
its pattern) whenever you decide. You don't need a `recurrenceField`: without one
the rule is stored on a default `recurrence` field (set `recurrenceField` to name
your own). It offers a full, calendar-app-grade set of controls:

- **Repeat** - Does not repeat / Daily / Weekly / Monthly / Yearly, with an
  **interval** ("every N …").
- **Weekly** - a weekday chip picker.
- **Monthly** - *on a day of the month*, *on a weekday of the month* (the
  first / second / … / last weekday), or *on the last day*.
- **Yearly** - pick the **month**, then a specific date or a positional weekday.
- **Ends** - *Never*, *on a date*, or *after N occurrences*.

Use it to **add** a pattern to a one-off event, **change** an existing one, or
**remove** it (set Repeat to "Does not repeat"). Saving writes the rule back
through `onEventCommit`.

Recurring events are also **drag- and resize-editable**: moving or resizing an
occurrence edits the whole **series'** time-of-day and duration (the pattern's
days are kept), so all occurrences shift together.

### This event vs. all events (per-occurrence exceptions)

Set a **`recurrenceExceptionsField`** (an array on the row) and an
**`onOccurrenceChange`** handler, and moving / resizing / deleting a single
occurrence asks **This event** or **All events**. "All events" edits the series
as above; **This event** fires `onOccurrenceChange` with an `exception` to store
on the row - a moved / retitled / **deleted** single instance that leaves the
rest of the series untouched (like an iCal `RECURRENCE-ID` / `EXDATE`).

```svelte
scheduler={{
  recurrenceField: 'repeat',
  recurrenceExceptionsField: 'exceptions',
  onOccurrenceChange: (e) => {
    // merge e.exception into the row (keyed by e.occurrenceStart)
    const key = (e.exception.occurrenceStart as Date).getTime()
    e.row.exceptions = [
      ...(e.row.exceptions ?? []).filter((x) => new Date(x.occurrenceStart).getTime() !== key),
      { ...e.exception },
    ]
  },
}}
```

Each exception is `{ occurrenceStart, deleted? , start?, end?, title? }` where
`occurrenceStart` identifies the occurrence (its **original** start). Without a
`recurrenceExceptionsField` the prompt is skipped and edits apply to the series.

### Showing the pattern in a table

The rule stored on a row is a structured object, so in the **Table** view give
the recurrence field a readable column with **`describeRecurrence`** - it turns a
rule (or list) into a short summary like *"Weekly on weekdays"*, *"Every 2 weeks
on Fri"*, or *"Monthly on the last Friday"*:

```svelte
<script>
  import { describeRecurrence } from '@svgrid/grid'
  const tableColumns = [
    ...columns,
    { id: 'repeat', header: 'Repeat', fieldFn: (r) => describeRecurrence(r.repeat) || '-' },
  ]
</script>
```

Pass a `RecurrenceLabels` object as the second argument to localize the weekday /
month / ordinal words (and the empty-rule label).

<div data-docs-demo="381-scheduler-app-calendar" data-height="700"></div>

## Add, edit, delete

The scheduler drives full CRUD back onto your `data` through callbacks - it
never mutates your rows itself:

- **Add** - double-clicking an empty time slot fires
  `onEventAdd(start, end, resourceId?)`; append a new row in the handler (a
  toolbar "New event" button that pushes a row works the same way).
- **Edit** - set **`drawer`** (`true`, or a config object) and clicking an event
  opens a detail drawer. It always includes a **When** editor - **start** and
  **end** as full date-and-time pickers, plus an **All day** toggle when
  `allDayField` is set - followed by an `SvForm` of your other columns. The
  footer has **Save** and **Cancel**: Save (or **clicking outside** the drawer)
  commits and fires `onEventCommit` with the changed values; Cancel discards.
- **Delete** - set **`onEventDelete`** and the drawer shows a **Delete** button;
  remove the row from your data in the handler.
- **Right-click an event** for a context menu with **Edit** (opens the drawer) and
  **Delete** built in (shown when `drawer` / `onEventDelete` are set); any
  `eventMenu` items you return are appended below them.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    drawer: { title: (row) => row.title, size: '420px' },
    onEventAdd: (start, end) => (rows = [...rows, makeEvent(start, end)]),
    onEventCommit: (e) => Object.assign(e.row, e.values),
    onEventDelete: (row) => (rows = rows.filter((r) => r !== row)),
  }} />
```

Because it is a view of the grid, pairing it with a plain `<SvGrid>` table gives
you a **Calendar / Table toggle** over the same rows - every scheduler demo ships
one.

## Booking rules

Enterprise schedulers enforce *when* things can be booked. The scheduler shades
non-bookable time and can reject double-bookings:

- **`businessHours: { start, end }`** - working-hours window (hours). Time outside
  it is shaded in the Week / Day grid.
- **`nonWorkingDays: number[]`** - weekday numbers (0 = Sun … 6 = Sat) shaded as
  non-working (e.g. `[0, 6]` for weekends), in the time-grid and month.
- **`shadeUntilNow`** - shade elapsed time on today's column.
- **`restrictToBusinessHours`** - **enforce** the shading: a drag / resize /
  create that lands outside `businessHours` or on a `nonWorkingDays` day is
  rejected and snaps back (without it the shading is a visual hint only).
- **`disableConflicts`** - **no double-booking**: dragging, resizing or creating
  an event so it overlaps another **on the same resource** is rejected and snaps
  back (a brief "already booked" flash). Different resources may overlap freely.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    resourceField: 'room', resources: rooms,
    businessHours: { start: 9, end: 17 },
    nonWorkingDays: [0, 6],
    shadeUntilNow: true,
    disableConflicts: true,   // enforce no double-booking per room
  }} />
```

Shading is purely visual unless `restrictToBusinessHours` is set; `disableConflicts`
is always enforced. Use the pure [`hasConflict`](https://svgrid.com/api/) helper to check a
placement yourself.

### Per-resource availability

`businessHours` / `nonWorkingDays` are global, but each **resource can declare
its own working windows** via `resource.availability` - and they can vary by
weekday. Perfect for a clinic where every doctor keeps different hours: each
resource's columns shade its own off-hours, and `restrictToBusinessHours` blocks
booking a resource outside *its* window.

```ts
const doctors = [
  { id: 'smith', title: 'Dr. Smith', availability: [
    { days: [1, 3, 5], start: 9, end: 13 },   // Mon/Wed/Fri mornings
    { days: [2, 4], start: 14, end: 18 },      // Tue/Thu afternoons
  ] },
  { id: 'jones', title: 'Dr. Jones', availability: [
    { days: [1, 2, 3, 4, 5], start: 8, end: 12 },
    { days: [1, 2, 3, 4, 5], start: 13, end: 16 },
  ] },
]
```

An `availability` window is `{ start, end }` hours with optional `days` (weekday
0-6; omit for every day). A weekday with no matching window is a full day off. A
resource without `availability` falls back to the global `businessHours` /
`nonWorkingDays`.

## Custom event content & tooltips

Render events however you like with the **`event`** snippet (it receives the
row), and show rich detail on hover with the **`tooltip`** snippet (or
`tooltip: true` for the built-in title + time + resource). `tooltipDelay` sets
the open delay (default 400ms).

```svelte
<SvGrid {data} {columns}
  scheduler={{ startField: 'start', endField: 'end', event: eventBody, tooltip: tip }} />

{#snippet eventBody(row)}
  <span class="badge">{initials(row.owner)}</span> {row.title}
{/snippet}
{#snippet tip(row)}
  <strong>{row.title}</strong><br />{row.owner} · {row.status}
{/snippet}
```

The snippet replaces the whole event body (time + title chrome), so you own the
layout; resize handles and drag still work around it.

## Import / export, undo & clipboard

- **iCal (Outlook / Google)** - the pure `toICS(events)` / `fromICS(text)`
  helpers round-trip timed, all-day and **recurring (RRULE)** events, plus STATUS,
  DESCRIPTION and LOCATION. Map your rows to the small `ICalEvent` shape and
  export to an `.ics` file; parse a pasted `.ics` back with `fromICS`.
- **Data export** - because the scheduler is a *view of the grid*, its **Table**
  toggle exports to CSV / Excel with the grid's own export.
- **Undo / redo** - set **`history: true`** and drag-moves + resizes are undoable
  with `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` (the scheduler re-emits the callbacks
  with the reversed values).
- **Duplicate** - the event context menu gets a **Duplicate** action (when
  `onEventAdd` is set) that copies the event right after itself.

```svelte
import { toICS, fromICS } from '@svgrid/grid'
const ics = toICS(rows.map((r) => ({ title: r.title, start: new Date(r.start), end: new Date(r.end), rrule: r.repeat })))
const events = fromICS(pastedText) // -> { title, start, end, allDay, rrule, ... }[]
```

## Unscheduled backlog

Pass **`unscheduled`** (a list of `{ id, title, durationMin?, color? }`) and a
backlog panel appears beside the Week / Day grid. **Drag a task onto a time
slot** and **`onSchedule(item, start, resourceId)`** fires - create the event and
drop the task from your list.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    unscheduled: tasks,           // [{ id, title, durationMin }]
    onSchedule: (item, start) => {
      rows = [...rows, makeEvent(item, start)]
      tasks = tasks.filter((t) => t.id !== item.id)
    },
  }} />
```

## Time zones

Set `timeZone` (an IANA id like `'America/New_York'`) and the whole calendar -
hour ruler, event positions, day boundaries, all-day grouping and the now-line -
is rendered in that zone instead of the browser's. `secondaryTimeZones` adds
read-only "world clock" rulers to the left of the primary gutter.

```svelte {runnable}
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    timeZone: 'America/New_York',
    secondaryTimeZones: [{ id: 'Europe/London' }, { id: 'Asia/Tokyo' }],
  }} />
```

For this to be correct the row `start` / `end` must be **instant-unambiguous** -
UTC / offset ISO (`'2026-08-01T13:00:00Z'`, `'…+02:00'`) or epoch ms; a bare
local string (`'2026-08-01T09:00'`) is read as the browser instant then shown in
the zone. Edits made in the calendar are written back as real instants, so store
them offset-aware (e.g. `date.toISOString()`); the display zone never mutates the
stored value - toggle Table on the [time-zones demo](https://svgrid.com/demos/) to see the
UTC strings stay put while the calendar shifts. The tz math is DST-aware and uses
`Intl` only (no date library).

<div data-docs-demo="385-scheduler-app-content" data-height="700"></div>

## Selecting cells & events

Two selection modes work in **every view** - time-grid (week / day), month, and
timeline. **Both are on by default** - set `rangeSelectable: false` or
`eventSelectable: false` to turn one off.

**Select a date/time range** (`rangeSelectable`). Click or drag marks a single
**continuous `[start, end]` datetime range** - dragging across days extends it
into a multi-day span (the start day fills from the start time down, whole middle
days, the end day down to the end time), *not* a per-day rectangle. Releasing the
drag only **marks** the range - it never creates an event on its own. Confirm it
explicitly to create: press **Enter**, or **right-click the selection** and choose
**Add Event** (**Esc** cancels the marker). Confirming fires `onRangeSelect` with
the continuous `start` / `end` (plus the covered `days[]` / `resourceIds[]` for
reference). Without a handler it falls back to `onEventAdd(start, end, resourceId,
allDay)` - whose fourth argument is `true` for an all-day selection (the all-day
row, a month day cell, or a multi-day timeline zoom), so the handler can set the
`allDayField` and create a true all-day event.

You can also select by **keyboard**: **click** an empty cell to select it, then
the **arrow keys** move the selected cell and **Shift + arrows** extend the range
(**Enter** creates, **Esc** clears). What the arrows step by follows the view -
in the time-grid a slot vertically and a day horizontally, in **month** a day
horizontally and a week vertically, in the **timeline** one axis cell (slot / day
/ month) horizontally and a resource row vertically. In the time-grid the
selection crosses into the **all-day row**: `ArrowUp` from the top timed cell
moves to the all-day cell, and `ArrowDown` from the all-day row drops back into
the grid.

Dragging the **all-day row** (or, in **month**, any day cells) selects whole days
(`selection.allDay` is `true`); create an all-day event spanning `start`..`end`
the same way.

**Multi-selecting events** (`eventSelectable`) works in every view too, including
the **agenda** list: Ctrl/Cmd-click to toggle, Shift-click for a range, `Delete`
to remove.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end',
    rangeSelectable: true,
    onRangeSelect: (sel) => {
      // one continuous event over the whole marked range
      rows = [...rows, makeEvent(sel.start, sel.end, sel.allDay)]
    },
  }} />
```

**Multi-select existing events** with `eventSelectable`. **Ctrl / Cmd-click**
toggles an event into the selection, **Shift-click** selects a range, and a plain
click clears it. Selected events get an outline; **dragging any one of them moves
the whole set together**, and pressing **Delete** removes them all (through
`onEventDelete`). `onEventSelectionChange` reports the selected rows.

```svelte
<SvGrid {data} {columns}
  scheduler={{
    startField: 'start', endField: 'end', editable: true,
    eventSelectable: true,
    onEventSelectionChange: (rows) => (selected = rows),
    onEventDelete: (row) => (data = data.filter((r) => r !== row)),
  }} />
```

<div data-docs-demo="372-scheduler-selection" data-height="560"></div>

## Search, filter, sort flow through

Because the scheduler renders the grid's processed rows, the built-in search
box (`searchable`, on by default) and any column filters or sort applied
elsewhere all narrow the events shown - the calendar is never a separate data
source.

## Scheduler Pro

The Enterprise renderer adds a set of advanced capabilities on top of the base
scheduler. They are read from the same `scheduler` prop; type your config as
`SchedulerProConfig` (from `@svgrid/enterprise`) to get the extra fields typed.

> **Scheduler, not a Gantt.** SvGrid's Scheduler is a resource / booking / calendar
> view of the grid - for appointments, staff and asset scheduling, and calendar
> apps. It is deliberately *not* a project planner: there is no critical path,
> percent-done, baselines, or work-breakdown structure, and none are planned. The
> **dependencies** below are an optional convenience for *ordered bookings* (a job
> that must move through stations in sequence); they are fully opt-in - with no
> dependency config the timeline draws no arrows and does no cascading.

### Dependencies & auto-reschedule (optional, for ordered bookings)

Link events with predecessor -> successor **dependencies** and the timeline draws
an arrow between them. When a predecessor is dragged or resized, its successors
**auto-reschedule** forward just enough to keep every link legal - preserving each
event's duration. Four link types are supported (`FS` finish-to-start, the default;
`SS`, `FF`, `SF`) plus an optional `lag` in minutes (negative for a lead).

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { enableSchedulerView, type SchedulerProConfig, type SchedulerDependency } from '@svgrid/enterprise'
  enableSchedulerView()

  const dependencies: SchedulerDependency[] = [
    { id: 'd1', from: 't1', to: 't2', type: 'FS' },      // t2 starts when t1 finishes
    { id: 'd2', from: 't1', to: 't3', type: 'FS', lag: 60 }, // + 1h lag
    { id: 'd3', from: 't2', to: 't4' },                  // FS (default)
  ]

  const cfg: SchedulerProConfig<any, Task> = {
    startField: 'start', endField: 'end',
    resourceField: 'team', resources: teams,
    initialView: 'timelineWeek', editable: true,
    businessHours: { start: 9, end: 17 },
    dependencies,
    autoReschedule: true,                 // default true when any dependency is set
    dependencyRespectWorkingTime: true,   // cascade skips outside business hours
    onDependenciesChange: (moves) => {    // persist the cascaded shifts
      for (const m of moves) {
        const row = rows.find((r) => r.id === m.id)
        if (row) { row.start = iso(m.start); row.end = iso(m.end) }
      }
    },
  }
</script>
```

`from` / `to` are **row ids** (your `getRowId`). Provide the links as a flat
`dependencies` array, or per-row via `dependencyField` (an array of
`SchedulerDependency` or successor-id strings on each row). A dependency that is
not currently satisfied (a successor sitting too early) is drawn as a dashed red
arrow; cyclic links are ignored so a cascade can never loop. Cascading only ever
pushes successors **forward** - it never pulls an event earlier.

Arrows render in the timeline views (`timelineDay` / `timelineWeek` /
`timelineMonth` / `timelineYear`), where events are laid out as horizontal bars.

### Multi-assignment, histogram & summaries

By default one event sits on one resource (`resourceField`). With **assignments**
a single event can be assigned to SEVERAL resources - it then renders under each
of them in the timeline. Provide a flat `assignments` list, or a per-row
`assignmentField` holding an array of resource ids.

```svelte
const cfg: SchedulerProConfig<any, Shift> = {
  startField: 'start', endField: 'end',
  resourceField: 'assignees', resources: people,
  initialView: 'timelineWeek', editable: true,
  assignmentField: 'assignees',            // each row: resourceId[]
  resourceHistogram: { height: 22 },       // utilization bars under each row
  columnSummary: { label: 'Shifts', reducer: 'count' },  // sticky per-column totals
  onAssignmentChange: ({ eventId, from, to }) => {       // drag across rows to reassign
    const row = rows.find((r) => r.id === eventId)
    if (row && to) row.assignees = [...row.assignees.filter((a) => a !== from), to]
  },
}
```

- **`resourceHistogram`** draws a small bar per axis tick under each resource row,
  showing that resource's load; bars turn red where the load exceeds capacity
  (`{ capacityField }` on the resource, default 1). Set `true` or
  `{ capacityField?, height? }`.
- **`columnSummary`** renders a sticky bottom strip aligned to the axis, one cell
  per time column. `reducer` is `'count'`, `{ sum: 'field' }`, or a function
  receiving the column-clipped events - e.g. `(items) => items.length`.
- Dragging an assigned event onto a different resource row fires
  **`onAssignmentChange`** (a reassign) instead of a plain move.

### Non-working-time collapse & zoom

Dense timelines waste width on hours nobody works. Turn on **collapse** and the
axis folds non-working time out: nights (outside `businessHours`) and whole
non-working days (`nonWorkingDays`, e.g. weekends) shrink to a thin gap, so the
working hours fill the view. A **zoom** preset scales the tick size + pixel
density from minutes out to months (a superset of `slotSizes`).

```svelte
const cfg: SchedulerProConfig<any, Job> = {
  startField: 'start', endField: 'end',
  resourceField: 'machine', resources: machines,
  initialView: 'timelineWeek',
  businessHours: { start: 8, end: 18 }, nonWorkingDays: [0, 6],
  collapseNonWorking: true,   // fold nights to a gap
  collapseWeekends: true,     // fold weekends to a gap
  collapsedGapPx: 14,         // width of the gap marker (0 = omit entirely)
  zoom: 3,                    // ladder index: 0 = 5-min .. 7 = monthly
  onZoomChange: (level) => console.log(level.id),
}
```

The compressed axis is fully consistent - event bars, drag/resize snapping, the
now-line and dependency arrows all map through it. A `- <label> +` stepper appears
in the toolbar when `zoom` is set; supply your own ladder via `zoomLevels`. These
apply to the timeline views only.

### Grouped / tree resources

Organise the timeline's resource rows into a **collapsible tree** in the gutter -
buildings to departments to providers/rooms. Define the group nodes with
`resourceGroups` (nest via `parentId`) and map each resource to its group with
`resourceGroupOf`. Click a group header to collapse its rows; the state persists
via `groupPersistKey`.

```svelte
const cfg: SchedulerProConfig<any, Appt> = {
  startField: 'start', endField: 'end',
  resourceField: 'provider', resources: providers, // flat resources
  resourceGroups: [
    { id: 'bldg-a', title: 'Main building' },
    { id: 'cardio', title: 'Cardiology', parentId: 'bldg-a' },
    { id: 'derm', title: 'Dermatology', parentId: 'bldg-a' },
  ],
  resourceGroupOf: (r) => r.dept,          // resource -> group id
  collapsibleGroups: true,
  groupPersistKey: 'clinic-groups',
  initialView: 'timelineDay',
}
```

Resources whose group is unknown / unset trail in an ungrouped section. Each group
header shows a count of the leaf resources beneath it. (To group the timeline by
an **event field** instead of a resource - e.g. by status or type - simply set
`resourceField` to that field; the rows then bucket by its values.)

### Skill-based eligibility

Restrict which events may be scheduled onto which resources (provider matching,
room type, technician skills). Supply `eligible(event, resource)` - return `false`
and a drag / resize / create onto that resource is rejected with a "Not eligible"
flash, and ineligible rows hatch while you drag. Or use the declarative
`requiresField` shortcut: an event's required tag(s) must all be in the resource's
skills.

```svelte
// Flexible predicate:
eligible: (job, tech) => tech.skills.includes(job.skill),

// or declarative - a `skills` array on each resource:
requiresField: 'skill',   // event field holding the required tag(s)
// resourceSkillsOf: (r) => r.skills,  // default reads r.skills
```

### Utilization heatmap

Tint each resource row's **background** by how loaded it is per time-bucket - light
when quiet, hot near capacity, red when over. Distinct from the histogram (a bar
strip); the heatmap colours the whole lane so a glance shows the pressure.

```svelte
resourceHistogram: false,
utilizationHeatmap: { capacityField: 'cap' },  // over `cap` = a red cell
```

### Booking rules - buffers, lead time, duration, travel

Beyond conflicts and working hours, gate bookings on real-world rules. A move /
resize / create that breaks one snaps back with the reason.

```svelte
bufferBeforeMin: 15, bufferAfterMin: 15,   // clear gap around every booking
minLeadMin: 60,                             // no bookings within an hour of now
minDurationMin: 30, maxDurationMin: 90,
travelTimeOf: (a, b) => distanceMin(a.location, b.location), // widens the gap
```

### Bookable slots / find-a-time

Turn the Day timeline into a booking surface: set `bookable` and every OPEN slot of
`durationMin` lights up per resource - the free time left after existing bookings,
each resource's own hours (`availability`), buffers and lead time. Clicking a slot
books it.

```svelte
bookable: { durationMin: 60, stepMin: 30 },
onSlotPick: (start, end, resourceId) => book(resourceId, start, end),
```

The slot math is also a pure export - `availableSlots({ working, busy, durationMin,
stepMin, bufferBeforeMin, bufferAfterMin, minStart })` from `@svgrid/enterprise`.

### Multi-calendar overlay

Overlay several calendars, each colour-coded and toggleable from a legend. Hiding a
calendar filters its events out of every view; an event's colour comes from its
calendar unless `colorField` overrides.

```svelte
calendars: [
  { id: 'work', title: 'Work', color: '#4f46e5' },
  { id: 'personal', title: 'Personal', color: '#16a34a' },
  { id: 'holidays', title: 'Holidays', color: '#d97706', hidden: true },
],
calendarField: 'cal',
```

### Free/busy + find-a-time

Shade a resource's external busy time (from another calendar) with `freeBusyOf`, and
find a slot that works for everyone with the pure `commonFree(busyByPerson, dayStart,
dayEnd, durationMin)` export - the windows when all attendees are free.

```svelte
freeBusyOf: (resource) => externalBusy[resource.id] ?? [],
// then, to suggest meeting times:
import { commonFree } from '@svgrid/enterprise'
const windows = commonFree(attendees.map(busyOf), day8, day18, 60)
```

## Config reference

| Option | Purpose |
| --- | --- |
| `startField` *(required)* | Field holding each event's start. |
| `endField` | Field holding the end; else `defaultDurationMin` from the start. |
| `allDayField` | Boolean field marking an all-day event; enables the drawer's All-day toggle. |
| `titleField` | Event label. Defaults to the first column's field. |
| `colorField` / `color` | Per-event accent color (the fill), or one for all. |
| `secondaryColorField` | A second per-event color, painted as a left-edge strip (encode two dimensions - e.g. fill = person, strip = role). |
| `recurrenceField` | Field holding a `RecurrenceRule` (or array). |
| `recurrenceExceptionsField` / `onOccurrenceChange` | Per-occurrence overrides (moved / edited / deleted single instances); the prompt offers **This event**, **This and following**, and **All events**. `onOccurrenceChange` carries a `scope` - handle `'following'` by splitting the series (see below); it also fires from a drag, delete, and a drawer save on a recurring occurrence. |
| `defaultDurationMin` | Event length when a row has no `endField` (default 60). |
| `views` / `initialView` | Which views to offer, and the first shown. Includes the horizontal `timelineDay` / `timelineWeek` / `timelineMonth` / `timelineYear`. |
| `initialDate` | The date the calendar opens on (default today). |
| `weekStartsOn` | First day of the week, 0-6 (default 0). |
| `slotMinutes` | Time-grid slot size and move/resize snap (default 30). Each slot renders 30px tall, so the hour grows with the granularity (1h = 30px rows, 30m = 60px, 15m = 120px). |
| `slotSizes` | Slot sizes (minutes) offered as a runtime ruler picker in Week / Day, e.g. `[60, 30, 15, 5]`. Shows a size selector in the toolbar; omit to hide it (the ruler still uses `slotMinutes`). |
| `dayStartHour` / `dayEndHour` | Visible time-grid band (default 0..24). |
| `nowIndicator` | Show the current-time line on today (Week / Day + Day timeline). On by default; `false` to hide. |
| `businessHours` / `nonWorkingDays` / `shadeUntilNow` | Shade out-of-hours, non-working weekdays and elapsed time. |
| `restrictToBusinessHours` | Enforce the shading - reject a drop / create outside working hours or on a non-working day. |
| `disableConflicts` | Reject a drag / resize / create that double-books the same resource. |
| `restrictedHours` | Hard-blocked hour bands (e.g. a lunch window `[{ start: 12, end: 13 }]`) - always non-bookable, rendered as a distinct red hatch. |
| `restrictedDates` | Specific dates that are fully closed (no bookings). |
| `specialDates` | Highlighted dates (holidays / launches) - a coloured strip + label on the column; decorative, does not block. |
| `minDate` / `maxDate` | Earliest / latest navigable + bookable date (prev / next nav stop at the bounds). |
| `maxEventsPerSlot` | Cap concurrent events per resource - reject a move / create that exceeds N overlapping events. |
| `SchedulerResource.dateOverrides` | Per-date exceptions to a resource's weekly `availability` - a day off (`off: true`) or custom `windows` for one date. |
| `statusField` | Free/busy status (`busy` / `free` / `tentative` / `oof`) driving an Outlook-style visual (solid / outline / hatched / tinted). Ties to iCal `STATUS`. |
| `reminderField` / `onReminder` | Minutes-before-start for a reminder; fires `onReminder` (and a built-in toast) once as the lead time is crossed. Ties to iCal `VALARM`. |
| `onUnschedule` | Drag an event onto the backlog panel to remove it from the schedule (typically push it back to `unscheduled`). |
| `event` / `tooltip` / `tooltipDelay` | Custom event-body snippet and a hover-tooltip snippet (or `tooltip: true` for the built-in). |
| `history` | Enable undo / redo of drag-move + resize (`Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`). |
| `unscheduled` / `onSchedule` / `backlogTitle` | A drag-to-schedule backlog panel beside the Week / Day grid. |
| `timeZone` | IANA zone the calendar is shown in (ruler, positions, day boundaries, now-line). Default: browser local. |
| `secondaryTimeZones` | Extra read-only hour rulers (`{ id, label? }[]`) shown left of the primary gutter - a world clock. |
| `collisionMode` | Overlap layout: `split` (default) / `cap` / `stack`. |
| `maxColumns` | `cap` mode: columns before a `+N more` tile (min 2, default 3). |
| `agendaDays` | How many days the agenda spans (default 30). |
| `resourceField` / `resources` | Group time-grid columns by resource + a legend/filter in every view; resources become the rows in timeline views. |
| `groupByDate` | Group day->resources instead of resource->days (default false). |
| `resourceAreaWidth` | Timeline: width (px) of the left resource-label gutter (default 160). |
| `timelineSlotMinutes` | Timeline day zoom: tick size + move/resize snap (default `slotMinutes`). |
| `timelineLaneHeight` | Timeline: height (px) of one event lane in a resource row (default 26). |
| `editable` | Enable drag-to-move and edge-resize. |
| `rangeSelectable` / `onRangeSelect` | Click / drag empty slots to mark a continuous date/time range (spans days; arrows move, Shift+arrows extend); confirm with Enter or right-click -> Add Event to create one event. **On by default** (`false` to disable). |
| `eventSelectable` / `onEventSelectionChange` | Ctrl/Shift-click to multi-select events; drag to move together, Delete to remove. **On by default** (`false` to disable). |
| `onEventMove` / `onEventResize` | Fired with the new start/end (and resource). |
| `onEventAdd` | Fired when an empty slot is double-clicked. |
| `onEventDelete` | Shows a Delete button in the drawer; remove the row here. |
| `event` | A snippet for a custom event body. |
| `drawer` / `onEventCommit` | Built-in detail drawer + save callback. |
| `eventMenu` | Right-click menu items for an event. |
| `searchable` / `searchPlaceholder` | The toolbar search box. |

### Scheduler Pro options (`SchedulerProConfig`)

| Option | Purpose |
| --- | --- |
| `dependencies` / `dependencyField` | Predecessor -> successor links (`{ id, from, to, type?, lag? }`), as a flat list or per-row. Drawn as timeline arrows. |
| `autoReschedule` | Cascade successors forward on move / resize to keep links legal (default `true` when dependencies are set). |
| `dependencyRespectWorkingTime` | Cascade skips outside `businessHours` (a shifted successor lands at the next opening). |
| `onDependenciesChange` | Fired with the cascaded `{ id, start, end }` shifts - persist them here. |
| `onDependencyAdd` / `onDependencyRemove` | User draws / removes a link. |
| `assignments` / `assignmentField` | Many-to-many event <-> resource assignments; an event renders under every assigned resource. |
| `resourceHistogram` | Per-resource utilization bars under each timeline row (`true` or `{ capacityField?, height? }`); over-capacity bars turn red. |
| `columnSummary` | Sticky per-time-column summary strip: `{ reducer: 'count' \| { sum } \| fn, label?, position? }`. |
| `onAssignmentChange` | Fired when an event is dragged from one resource row to another (reassign). |
| `collapseNonWorking` / `collapseWeekends` | Fold nights / non-working days out of the timeline axis. |
| `collapsedGapPx` | Width (px) of a collapsed-gap marker (default 12; `0` omits it). |
| `zoom` / `zoomLevels` / `onZoomChange` | Continuous zoom preset (minutes -> months) with a toolbar stepper; supersedes `slotSizes`. |
| `resourceGroups` / `resourceGroupOf` | Group timeline resource rows into a collapsible tree (`{ id, title, parentId? }[]` + a resource -> group-id map). |
| `collapsibleGroups` / `groupPersistKey` | Allow collapsing groups (default on) and persist the collapsed set to localStorage. |
| `eligible` / `requiresField` / `resourceSkillsOf` | Skill / eligibility rule - which events may drop on which resources; rejected drops flash "Not eligible". |
| `utilizationHeatmap` | Tint each resource row's background by load per bucket (`true` or `{ capacityField }`); over capacity = red. |
| `bufferBeforeMin` / `bufferAfterMin` | Required clear minutes around each booking (number or `(event) => number`). |
| `minLeadMin` / `minDurationMin` / `maxDurationMin` | Minimum notice, and min / max booking duration in minutes. |
| `travelTimeOf` | Travel minutes required between two consecutive bookings on a resource (widens the buffer). |
| `bookable` / `onSlotPick` | Show open bookable slots of a duration on the Day timeline (`{ durationMin, stepMin? }`); click to book. |
| `calendars` / `calendarField` | Overlay several colour-coded calendars with a toggleable legend; map events via `calendarField`. |
| `freeBusyOf` | External busy intervals to shade on a resource row (for find-a-time). Pair with the `commonFree` export. |

## More examples

### Scheduling rules & policies

Every booking policy the scheduler can enforce: business hours + a hard-blocked lunch band, a closed date, a highlighted holiday, min/max navigable dates, room capacity, a per-doctor day off, free/busy statuses, per-event reminders, drag-to-unschedule, and This / This-and-following / All recurrence edits.

<div data-docs-demo="386-scheduler-rules" data-height="560"></div>

### Sequenced bookings

A service centre where a job flows through stations in order - a booking can only start once the one it depends on finishes. Drag or resize a booking and the steps that follow slide forward (opening-hours aware). Dependencies are an optional convenience for ordered bookings. Toggle to the Table - same grid rows, just a view.

<div data-docs-demo="389-scheduler-dependencies" data-height="560"></div>

### Staffing board - assignments & utilization

A weekly staffing timeline where one shift can cover several people (it appears under each). A per-person utilization histogram sits under each row (red where over-booked) and a sticky summary strip totals shifts per day. Drag a shift onto another person to reassign.

<div data-docs-demo="390-scheduler-capacity" data-height="560"></div>

### Operations timeline - collapse & zoom

A shop-floor timeline that collapses non-working time: nights fold to a thin gap and weekends to a marker, so working hours fill the width. A zoom stepper scales the axis from hourly detail out to weekly; bars, drag and the now-line all map through the compressed axis.

<div data-docs-demo="391-scheduler-zoom" data-height="560"></div>

### Grouped resources

A clinic day where providers are organised into a collapsible tree in the gutter - buildings to departments to providers/rooms. Click a group to collapse it (persisted); appointments schedule onto the leaf providers. Toggle to the Table - the groups just read the same grid rows.

<div data-docs-demo="392-scheduler-resource-tree" data-height="560"></div>

### Utilization heatmap

A support centre where each queue has a capacity and calls overlap through the day. The row background is tinted by how loaded the queue is each hour - light when quiet, hot near capacity, red when over. A glance shows where the pressure is.

<div data-docs-demo="394-scheduler-heatmap" data-height="560"></div>

### Multi-calendar overlay

Several calendars overlaid on one week - Work, Personal, Family, Holidays - each colour-coded from a legend you can toggle. Turning a calendar off hides its events across every view; an event takes its calendar colour.

<div data-docs-demo="397-scheduler-multi-calendar" data-height="560"></div>
