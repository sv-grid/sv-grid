# SvDateRangeInput

A compact start/end field that opens a two-month range calendar with one-click
presets (Today, Last 7 days, This month, ...). Emits an inclusive `[start, end]`
tuple or `null`.

Related: [Date & time overview](date-time.md) · [SvCalendar](sv-calendar.md) ·
[SvDateTimePicker](sv-date-time-picker.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvDateRangeInput` starter into your app:

<div data-docs-add="add date-range-input"></div>

Prefer to see it first? `npx @svgrid/ui try date-range-input` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvDateRangeInput` ships free in
`@svgrid/grid` (no extra date library) and is **part of the grid's editor kit** -
it carries the same editor contract (label, hint, validation, RTL) SvGrid uses for
its cell editors, so it drops into a grid edit form as readily as into a page:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvDateRangeInput } from '@svgrid/grid'
```

## Example

`SvDateRangeInput` composes the existing headless range engine: the popover is
just a `<SvCalendar selectionMode="range">`, so hover-preview, min/max,
restricted / important dates and keyboard all come for free. It carries the
shared editor contract (label, hint, error validation, size, RTL, localizable
`messages`) via `SvField`, exactly like the other field editors, and the popover
portals to `<body>` so it is never clipped by a scrolling grid.

<div data-docs-demo="283-daterange-input" data-height="460" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvDateRangeInput } from '@svgrid/grid'
  let range = $state<[Date, Date] | null>(null)
</script>

<SvDateRangeInput
  value={range}
  formatString="yyyy-MM-dd"
  months={2}
  onChange={(v) => (range = v)}
/>
```

## Props

`SvDateRangeInput` extends `SvEditorProps` (`disabled`, `readonly`, `required`,
`invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`, `ariaLabel`).
Its own props:

| Prop             | Type                                    | Default             | Description                                                  |
| ---------------- | --------------------------------------- | ------------------- | ------------------------------------------------------------ |
| `value`          | `DateRangeValue`                        | `null`              | Inclusive `[start, end]` range, or `null`.                   |
| `onChange`       | `(value: DateRangeValue) => void`       | -                   | Fires with the new range (or `null` when cleared).           |
| `formatString`   | `string`                                | `yyyy-MM-dd`        | Display format for each end (token engine).                  |
| `min` / `max`    | `DateLike \| null`                      | `null`              | Selectable bounds.                                           |
| `months`         | `number`                                | `2`                 | Number of month panels shown side by side.                   |
| `firstDayOfWeek` | `number`                                | `0`                 | `0` = Sunday .. `6` = Saturday.                              |
| `weekNumbers`    | `boolean`                               | `false`             | Show the calendar's week-number column.                      |
| `locale`         | `string`                                | navigator           | BCP-47 locale for names and formatting.                     |
| `placeholder`    | `string`                                | `Select date range` | Empty-field placeholder.                                     |
| `presets`        | `ReadonlyArray<CalendarPreset>`         | -                   | Quick shortcuts shown in the calendar's side rail.           |
| `animate`        | `boolean` \| `slide` \| `fade`          | `false`             | Animate the calendar's month navigation.                     |
| `autoOpen`       | `boolean`                               | `false`             | Open the popover as soon as the field is focused.            |

### Helper types

- `DateRangeValue = [Date, Date] | null` - an inclusive start/end tuple.
- `CalendarPreset = { label: string; value: Date | number | string | readonly [start, end] | (() => ...) }` - pass a function for "today"-relative shortcuts that resolve at click time.

## Examples

### Preset shortcuts

Presets appear in a side rail on the calendar; function values resolve relative
to today at click time, so "Last 7 days" is always correct:

```svelte
<SvDateRangeInput
  presets={[
    { label: 'Last 7 days', value: () => [addDays(new Date(), -6), new Date()] },
    { label: 'This month', value: () => [startOfMonth(new Date()), new Date()] },
  ]}
  onChange={(v) => (range = v)}
/>
```

### Bounded ranges

Pass `min` / `max` to keep the selection inside an allowed window - out-of-range
days render disabled in the popover calendar:

```svelte
<SvDateRangeInput min={new Date(2024, 0, 1)} max={new Date()} onChange={(v) => (range = v)} />
```

### Labelled form field

Because it carries the editor contract, `label`, `hint`, and validation wire up
like any other field editor:

```svelte
<SvDateRangeInput
  label="Reporting period"
  hint="Both ends inclusive"
  required
  size="lg"
  onChange={(v) => (range = v)}
/>
```

### Two-way bound booking range

Keep the tuple in your own `$state` and derive from it - here a night count for a
booking. `min={new Date()}` blocks past check-in dates:

```svelte {runnable}
<script lang="ts">
  import { SvDateRangeInput, type DateRangeValue } from '@svgrid/grid'
  let stay = $state<DateRangeValue>(null)
  const nights = $derived(stay ? Math.round((+stay[1] - +stay[0]) / 86400000) : 0)
</script>

<SvDateRangeInput
  label="Check-in / check-out"
  value={stay}
  min={new Date()}
  months={2}
  onChange={(v) => (stay = v)}
/>
<p>{nights} night(s)</p>
```

Tip: the range is inclusive and both ends are normalized to start-of-day, so
subtracting the two timestamps gives whole nights without time-of-day drift.

## Accessibility

- Built on `SvField`, so `label`, `hint`, and `error` are wired via
  `for` / `aria-describedby`; `invalid` sets `aria-invalid`.
- The read-only field exposes `aria-haspopup="dialog"` and `aria-expanded`;
  `ArrowDown` (or Alt+ArrowDown) opens the popover, `Escape` closes it.
- The popover is a `role="dialog"` containing the full [SvCalendar](sv-calendar.md)
  keyboard model for range selection.
- `disabled` / `readonly` block interaction; `dir="rtl"` mirrors the layout.

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte
<script lang="ts">
  import { SvDateRangeInput } from '@svgrid/grid'

  let range = $state<Date | null>(null)
</script>

<SvDateRangeInput value={range} size="sm" />
<SvDateRangeInput value={range} size="md" />
<SvDateRangeInput value={range} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte
<script lang="ts">
  import { SvDateRangeInput } from '@svgrid/grid'

  let range = $state<Date | null>(null)
</script>

<SvDateRangeInput
  value={range}
  label="Label"
  hint="A short hint"
  required
/>

<SvDateRangeInput
  value={range}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Date & time overview](date-time.md) - the whole family at a glance.
- [SvCalendar](sv-calendar.md) - the range calendar it wraps.
- [SvDateTimePicker](sv-date-time-picker.md) - the single date + time sibling.
