# SvCalendar

A themeable, accessible month / year / decade calendar with every selection
mode - the date surface the whole date/time family is built on.

`SvCalendar` is a thin styled renderer over the headless `createCalendar` core,
the same split as [SvGrid](../getting-started.md): the core owns reactive state,
selection, navigation, keyboard and ARIA, while the component keeps render-only
concerns (the view-change animation, mouse-wheel navigation, DOM refs). Every
color comes from the grid's `--sg-*` tokens, so it matches your grid and edit
forms in light and dark. It is the editor SvGrid mounts for a `date` cell, and
it works standalone anywhere.

<div data-docs-demo="250-calendar" data-height="460"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvCalendar } from '@svgrid/grid'
  let value = $state<Date[]>([new Date()])
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

## Props

| Prop                 | Type                                                                                                 | Default       | Description                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `value`              | `CalendarValue`                                                                                      | `null`        | Selected value(s): a `Date` for single modes, an array for multi.   |
| `onChange`           | `(dates: Date[]) => void`                                                                            | -             | Fires with the full selected-day list on every change.              |
| `onNavigate`         | `(viewDate: Date, displayMode: DisplayMode) => void`                                                 | -             | Fires when the visible month / year / decade page changes.          |
| `selectionMode`      | `one` \| `zeroOrOne` \| `many` \| `zeroOrMany` \| `oneOrMany` \| `oneExtended` \| `week` \| `range`  | `one`         | How selection behaves.                                              |
| `min` / `max`        | `DateLike \| null`                                                                                   | `null`        | Selectable bounds.                                                  |
| `restrictedDates`    | list or predicate                                                                                    | `null`        | Non-selectable dates.                                               |
| `importantDates`     | `ReadonlyArray<DateLike>` \| `(d) => boolean` \| `null`                                              | `null`        | Highlighted (but still selectable) dates.                          |
| `firstDayOfWeek`     | `number`                                                                                             | `0`           | `0` = Sunday .. `6` = Saturday.                                     |
| `weeks`              | `number`                                                                                             | `6`           | Week rows per panel.                                                |
| `weekNumbers`        | `boolean`                                                                                            | `false`       | Show the ISO week-number column.                                   |
| `months`             | `number`                                                                                             | `1`           | Number of month panels side by side.                              |
| `hideDayNames`       | `boolean`                                                                                            | `false`       | Hide the weekday header row.                                        |
| `hideOtherMonthDays` | `boolean`                                                                                            | `false`       | Hide leading/trailing days (auto when `months > 1`).              |
| `dayNameFormat`      | `narrow` \| `short` \| `long`                                                                       | `short`       | Weekday label length.                                              |
| `monthNameFormat`    | `narrow` \| `short` \| `long`                                                                       | `long`        | Month/title label length.                                          |
| `footer`             | `boolean`                                                                                            | `false`       | Show the Today / Clear footer.                                     |
| `disabled`           | `boolean`                                                                                            | `false`       | Blocks interaction and dims the control.                           |
| `readonly`           | `boolean`                                                                                            | `false`       | Shows the value but blocks changes.                               |
| `locale`             | `string`                                                                                            | navigator     | BCP-47 locale for names and formatting.                           |
| `name`               | `string`                                                                                            | -             | Emits a hidden input carrying the ISO dates.                      |
| `displayMode`        | `DisplayMode`                                                                                       | `month`       | Which drill level to open on.                                     |
| `animate`            | `boolean \| CalendarAnimation`                                                                      | `false`       | Animate navigation / drill. `true` = `slide` (explicit opt-in).   |
| `wheelNavigation`    | `boolean`                                                                                           | `false`       | Change the visible page with the mouse wheel.                     |
| `dateTooltip`        | `(date: Date) => string \| null \| undefined`                                                       | -             | Per-day native `title` text.                                      |
| `presets`            | `ReadonlyArray<CalendarPreset>`                                                                     | -             | One-click shortcuts shown in a side rail.                        |
| `recurrence`         | `RecurrenceRule \| ReadonlyArray<RecurrenceRule> \| null`                                            | `null`        | Repeat pattern(s); matching days get a `recurring` state.        |
| `dir`                | `ltr` \| `rtl` \| `auto`                                                                            | `auto`        | Text direction; `rtl` mirrors layout and flips nav arrows.       |
| `messages`           | `Partial<CalendarMessages>`                                                                         | -             | Override the built-in strings.                                   |
| `day`                | `Snippet<[Date, CalendarDayState]>`                                                                 | -             | Rich per-cell content (events, dots); switches to a taller grid. |

### Helper types

- `CalendarValue = Date | number | string | ReadonlyArray<Date | number | string> | null`
- `DisplayMode = 'month' | 'year' | 'decade'`
- `CalendarAnimation = 'slide' | 'fade' | 'none'`
- `CalendarPreset = { label: string; value: Date | number | string | readonly [start, end] | (() => ...) }` - pass a function for "today"-relative shortcuts that resolve at click time.
- `CalendarDayState = { disabled, selected, important, today, outside, focused, preview, recurring }` - the booleans handed to a `day` snippet.

## Patterns

### Range selection with presets

Set `selectionMode="range"` and pass `presets` for one-click shortcuts. Function
values resolve relative to today at click time:

```svelte
<SvCalendar
  selectionMode="range"
  months={2}
  presets={[
    { label: 'Last 7 days', value: () => [addDays(new Date(), -6), new Date()] },
    { label: 'This month', value: () => [startOfMonth(new Date()), new Date()] },
  ]}
  onChange={(dates) => (range = dates)}
/>
```

### Restricted and important dates

Block dates with `restrictedDates` (a list or predicate) and flag noteworthy ones
with `importantDates` - restricted days are unselectable, important days stay
selectable but carry an indicator:

```svelte
<SvCalendar
  restrictedDates={(d) => d.getDay() === 0}
  importantDates={holidays}
  min={new Date()}
/>
```

### Rich cells and recurrence (event calendars)

A `day` snippet fills each cell with event chips and switches to a taller grid;
`recurrence` rules mark repeating days. The pure `matchesRecurrence` /
`expandRecurrence` helpers generate the events. See the
[Date & time overview](date-time.md).

### Multi-day availability (many mode)

`selectionMode="many"` toggles any number of individual days - useful for picking
shift days or blackout dates. Bind your own `$state` and assign the list back in
`onChange`; `min` blocks past days:

```svelte
<script lang="ts">
  import { SvCalendar, type CalendarValue } from '@svgrid/grid'
  let days = $state<Date[]>([])
</script>

<SvCalendar
  value={days as CalendarValue}
  selectionMode="many"
  min={new Date()}
  footer
  onChange={(picked) => (days = picked)}
/>
<p>{days.length} day(s) selected</p>
```

Tip: `onChange` always receives the complete selected-day array (not just the day
that changed), in every selection mode - so you can assign it straight to state.

## Accessibility

- Renders a `role="group"` with labelled `role="row"` / `columnheader` /
  `gridcell` structure; the core owns the ARIA.
- Full keyboard: arrows move by day, PageUp/Down by month (Shift = year),
  Home/End to week ends, Enter/Space selects, the title button drills up.
- `disabled` sets `aria-disabled` and blocks interaction; `restrictedDates`
  render as disabled day buttons.
- `dir="rtl"` mirrors the layout and flips the navigation chevrons.

## See also

- [Date & time overview](date-time.md) - the whole family at a glance.
- [SvDateTimePicker](sv-date-time-picker.md) - a field that pops this calendar in a dropdown.
- [SvDateRangeInput](sv-date-range-input.md) - a compact field over `selectionMode="range"`.
