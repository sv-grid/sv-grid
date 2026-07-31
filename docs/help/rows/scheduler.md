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

- **Month** - a fixed six-week grid. Multi-day events render as **one continuous
  bar** spanning the day columns they cover (split into a fresh segment on each
  week row they continue into), stacked into lanes so they never overlap; a
  per-day **"+N more"** collapses events beyond the visible lanes into a popover.
- **Week / Day** - a time-grid with an hourly band. Overlapping events are laid
  out by the chosen [collision mode](#colliding-overlapping-events). **All-day
  and multi-day events** render in a separate **all-day row** at the top (in Week
  view as continuous spanning bars), never filling the hourly columns. Drag an
  event between the all-day row and the grid to flip it between all-day and timed,
  or drag a bar's **left / right edge** to extend or shorten it by whole days.
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

Add **`secondaryColorField`** to encode a *second* dimension: it paints a strip
on the **left edge** of each event, distinct from the main fill. A shift roster,
for instance, can fill each event with the **person**'s color (matching the
resource legend) while the left strip shows the **role**:

```svelte
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

<div data-docs-demo="364-scheduler-timegrid" data-height="620"></div>

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

```svelte
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

When `recurrenceField` and `drawer` are both set, clicking **any** event opens a
**recurrence editor** in the drawer - so you can turn a one-off into a recurring
event whenever you decide. It offers a full, calendar-app-grade set of controls:

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

<div data-docs-demo="366-scheduler-recurring" data-height="620"></div>

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
| `allDayField` | Boolean field marking an all-day event; enables the drawer's All-day toggle. |
| `titleField` | Event label. Defaults to the first column's field. |
| `colorField` / `color` | Per-event accent color (the fill), or one for all. |
| `secondaryColorField` | A second per-event color, painted as a left-edge strip (encode two dimensions - e.g. fill = person, strip = role). |
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
| `resourceField` / `resources` | Group time-grid columns by resource + a legend/filter in every view. |
| `groupByDate` | Group day->resources instead of resource->days (default false). |
| `editable` | Enable drag-to-move and edge-resize. |
| `onEventMove` / `onEventResize` | Fired with the new start/end (and resource). |
| `onEventAdd` | Fired when an empty slot is double-clicked. |
| `onEventDelete` | Shows a Delete button in the drawer; remove the row here. |
| `event` | A snippet for a custom event body. |
| `drawer` / `onEventCommit` | Built-in detail drawer + save callback. |
| `eventMenu` | Right-click menu items for an event. |
| `searchable` / `searchPlaceholder` | The toolbar search box. |
