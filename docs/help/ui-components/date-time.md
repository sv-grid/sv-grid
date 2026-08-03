# Date & time

Four date/time controls built on a shared, framework-free date engine
(`date-core`, `date-format`, `date-selection`, `date-restrict`). They are the
rich-by-default editors for `date`, `datetime` and `time` grid columns, and work
standalone.

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add date-time"></div>

Prefer to see them first? `npx @svgrid/ui try date-time` opens the whole family in a sandbox - no project needed.

The controls all ship free in the `@svgrid/grid` package - they are the **same
components SvGrid mounts to edit `date`, `datetime` and `time` cells**, so you can
also just install the grid and import them directly:

<div data-docs-install="@svgrid/grid"></div>

## The family at a glance

Each component has its own tutorial with a live Preview / Code example, the full
props table and accessibility notes:

- [SvCalendar](./sv-calendar.md) - a month/year/decade calendar with every selection mode (single, range, week, multi, event cells + recurrence).
- [SvTimePicker](./sv-time-picker.md) - an analog clock-dial time picker (12/24-hour, minute snapping).
- [SvDateTimePicker](./sv-date-time-picker.md) - a masked text field with DATE / TIME dropdown tabs.
- [SvDateRangeInput](./sv-date-range-input.md) - a compact start-to-end range field with preset shortcuts.

## SvCalendar

A month / year / decade calendar with every selection mode.

```svelte
<script>
  import { SvCalendar } from '@svgrid/grid'
  let value = $state([new Date()])
</script>

<SvCalendar
  {value}
  selectionMode="range"
  firstDayOfWeek={1}
  weekNumbers
  footer
  onChange={(dates) => (value = dates)}
/>
```

Key props: `value` (Date | Date[] | string), `selectionMode`
(`one` `zeroOrOne` `many` `zeroOrMany` `oneOrMany` `oneExtended` `week` `range`),
`min` / `max`, `restrictedDates` (list or predicate), `importantDates`,
`firstDayOfWeek` (0-6), `weeks`, `weekNumbers`, `months` (multi-panel),
`displayMode` (`month` `year` `decade`), `hideDayNames`, `hideOtherMonthDays`,
`dayNameFormat` / `monthNameFormat`, `footer`, `locale`, `disabled`, `readonly`.
Emits `onChange(dates)` and `onNavigate(viewDate, displayMode)`.

Keyboard: arrows move by day, PageUp/Down by month (Shift = year), Home/End to
week ends, Enter/Space selects, the title button drills up the view.

### Rich cells + recurrence (event calendars)

Two props turn the picker into a full event scheduler:

- **`day`** - a snippet rendered inside each day cell, receiving `(date, state)`.
  Providing it switches the month grid to a taller, top-aligned layout with room
  for event chips / badges.
- **`recurrence`** - a repeat rule (or array). Matching days get `state.recurring`
  and a "repeats" indicator. Rules: `{ freq: 'daily'|'weekly'|'monthly'|'yearly',
  interval?, weekdays?, day?, month?, from?, until? }`.

```svelte
<script>
  import { SvCalendar, matchesRecurrence } from '@svgrid/grid'
  const standup = { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } // every weekday
</script>

<SvCalendar recurrence={standup} bind:value={selected} onChange={(d) => (selected = d[0])}>
  {#snippet day(date, state)}
    {#each eventsOn(date) as e}
      <span class="chip">{e.time} {e.title}</span>
    {/each}
  {/snippet}
</SvCalendar>
```

The pure helpers `matchesRecurrence(date, rules)` and `expandRecurrence(rules,
start, end)` are exported for generating recurring events / agendas without a
calendar. See the **Event calendar** demo.

## SvTimePicker

An analog clock-dial picker (12- or 24-hour).

```svelte
<SvTimePicker value={new Date()} format="12-hour" minuteInterval={5} footer
  onChange={(d) => (time = d)} />
```

Key props: `value` (Date | "HH:MM"), `format` (`12-hour` | `24-hour`),
`minuteInterval`, `autoSwitchToMinutes`, `footer` (Now), `selection`
(`hour` | `minute`), `disabled`, `readonly`. Drag the hand or click a number;
arrow keys nudge the active field. Emits `onChange(date)`.

## SvDateTimePicker

A formatted text input plus a portalled dropdown with DATE / TIME tabs
(composes `SvCalendar` + `SvTimePicker`).

```svelte
<SvDateTimePicker
  value={new Date()}
  formatString="yyyy-MM-dd HH:mm"
  dropDownDisplayMode="both"
  min={new Date(2020, 0, 1)}
  nullable
  spinButtons
  onChange={(d) => (value = d)}
/>
```

Key props: `value`, `formatString` (token engine: `d dd M MM MMM MMMM yy yyyy H HH
h hh mm ss fff tt`), `dropDownDisplayMode` (`both` | `calendar` | `time`),
`min` / `max`, `nullable`, `hourFormat`, `minuteInterval`, `spinButtons`,
`stepMinutes`, `firstDayOfWeek`, `weekNumbers`, `locale`, `disabled`, `readonly`.
Typed text is parsed on blur/Enter and reverts if it doesn't fit the mask; the
value is clamped to `min` / `max`. Emits `onChange`, plus `onCommit` / `onCancel`
for grid editing.

See the [component guides above](#the-family-at-a-glance) for each control's full
tutorial, live example and props.
