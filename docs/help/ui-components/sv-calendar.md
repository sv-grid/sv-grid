# SvCalendar

A themeable, accessible month / year / decade calendar with every selection
mode - the date surface the whole date/time family is built on.

Related: [Date & time overview](date-time.md) ·
[SvDateTimePicker](sv-date-time-picker.md) ·
[SvDateRangeInput](sv-date-range-input.md) ·
[SvTimePicker](sv-time-picker.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvCalendar` starter into your app:

<div data-docs-add="add calendar"></div>

Prefer to see it first? `npx @svgrid/ui try calendar` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvCalendar` ships free in
`@svgrid/grid` (no extra date library) and is the **same component SvGrid mounts to
edit a `date` cell** - so it is both a standalone control and the grid's built-in
date editor:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvCalendar } from '@svgrid/grid'
```

## Example

`SvCalendar` is a thin styled renderer over the headless `createCalendar` core,
the same split as [SvGrid](../../getting-started.md): the core owns reactive state,
selection, navigation, keyboard and ARIA, while the component keeps render-only
concerns. Every color comes from the grid's `--sg-*` tokens, so it matches your
grid and edit forms in light and dark. It is the editor SvGrid mounts for a
`date` cell, and it works standalone anywhere.

<div data-docs-demo="250-calendar" data-height="460" data-code></div>

```svelte {runnable}
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

## Anatomy

The component is render-only; the reactive model lives in the headless
`createCalendar` core. You almost never touch the core directly - `SvCalendar`
wires it for you - but you can build a fully custom calendar on the same engine
(see [Headless editors](headless-editors.md)):

```svelte {runnable}
<script lang="ts">
  import { SvCalendar } from '@svgrid/grid'
  let value = $state<Date[]>([])
</script>

<SvCalendar {value} onChange={(dates) => (value = dates)} />
```

## Examples

### Range selection with presets

Set `selectionMode="range"` and pass `presets` for one-click shortcuts. Function
values resolve relative to today at click time.

<div data-docs-demo="258-calendar-range" data-height="440" data-code></div>

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

### Date of birth

Single selection with `max` clamped to today so future dates are blocked, opening
on the decade (year) grid for fewer clicks to a birth year.

<div data-docs-demo="260-calendar-birthday" data-height="420" data-code></div>

```svelte
<SvCalendar
  {value}
  selectionMode="one"
  max={new Date()}
  displayMode="decade"
  footer
  onChange={(dates) => (value = dates)}
/>
```

### Rich cells and recurrence (event calendars)

A `day` snippet fills each cell with event chips and switches to a taller grid;
`recurrence` rules mark repeating days. The pure `matchesRecurrence` /
`expandRecurrence` helpers generate the events.

A `RecurrenceRule` supports the patterns a real calendar needs - `freq`
(`daily` / `weekly` / `monthly` / `yearly`), an `interval`, `weekdays`, a
`day` of the month (negative counts from the end, `-1` = last day), a positional
`weekOfMonth` (`1`..`4` or `-1`) paired with a single weekday ("the 2nd Tuesday",
"the last Friday"), a yearly `month`, an anchor `from`, and an end condition -
an inclusive `until` date or a `count` of occurrences:

```ts
{ freq: 'monthly', weekdays: [2], weekOfMonth: 1 }              // the first Tuesday
{ freq: 'monthly', day: -1 }                                   // the last day
{ freq: 'weekly',  weekdays: [1], count: 8, from: '2026-01-05' } // 8 times, then stop
```

<div data-docs-demo="338-event-calendar" data-height="520" data-code></div>

```svelte
<SvCalendar recurrence={rules}>
  {#snippet day(date, state)}
    <span class="num">{date.getDate()}</span>
    {#each eventsOn(date) as ev}
      <span class="chip">{ev.title}</span>
    {/each}
  {/snippet}
</SvCalendar>
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

### Multi-day availability (many mode)

`selectionMode="many"` toggles any number of individual days - useful for picking
shift days or blackout dates. Bind your own `$state` and assign the list back in
`onChange`; `min` blocks past days:

```svelte {runnable}
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

## Props

Pass any of `label` / `hint` / `error` (plus `required` / `invalid` / `id`) to
wrap the calendar in [SvField](sv-field.md) chrome (a label + hint/error line)
when using it as a standalone form control; omit them and it renders bare, as it
does inside [SvDateTimePicker](sv-date-time-picker.md)'s popover.

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

## Accessibility

- Renders a `role="group"` with labelled `role="row"` / `columnheader` /
  `gridcell` structure; the core owns the ARIA.
- Full keyboard: arrows move by day, PageUp/Down by month (Shift = year),
  Home/End to week ends, Enter/Space selects, the title button drills up.
- `disabled` sets `aria-disabled` and blocks interaction; `restrictedDates`
  render as disabled day buttons.
- `dir="rtl"` mirrors the layout and flips the navigation chevrons.

## More examples

### Calendar - headless

Styled SvCalendar and a compact custom day-grid built from panels / dayState / dayProps, sharing one value.

<div data-docs-demo="276-headless-calendar" data-height="420"></div>

## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte
<script lang="ts">
  import { SvCalendar } from '@svgrid/grid'

  let calendar = $state<Date | null>(null)
</script>

<SvCalendar
  bind:value={calendar}
  label="Label"
  hint="A short hint"
  required
/>

<SvCalendar
  bind:value={calendar}
  label="Label"
  error="Something is wrong"
  invalid
/>
```


## Disabled and read-only

Disabled takes the control out of the tab order; read-only keeps it focusable and copyable. Reach for read-only when the value still matters to the reader.

```svelte
<script lang="ts">
  import { SvCalendar } from '@svgrid/grid'

  let calendar = $state<Date | null>(null)
</script>

<SvCalendar bind:value={calendar} disabled />

<SvCalendar bind:value={calendar} readonly />
```

## See also

- [Date & time overview](date-time.md) - the whole family at a glance.
- [SvDateTimePicker](sv-date-time-picker.md) - a field that pops this calendar in a dropdown.
- [SvDateRangeInput](sv-date-range-input.md) - a compact field over `selectionMode="range"`.
