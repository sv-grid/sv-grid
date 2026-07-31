# SvDateTimePicker

A formatted text input plus a portalled dropdown with DATE / TIME tabs - type a
masked value or pick it from a calendar and clock.

Related: [Date & time overview](date-time.md) · [SvCalendar](sv-calendar.md) ·
[SvTimePicker](sv-time-picker.md) · [SvDateRangeInput](sv-date-range-input.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvDateTimePicker` starter into your app:

<div data-docs-add="add date-time-picker"></div>

Or install the package and import it directly. `SvDateTimePicker` ships free in
`@svgrid/grid` (no extra date library) and is the **same component SvGrid mounts to
edit a `datetime` cell** - so it is both a standalone control and the grid's
built-in date-time editor:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvDateTimePicker } from '@svgrid/grid'
```

## Example

`SvDateTimePicker` composes [SvCalendar](sv-calendar.md) and
[SvTimePicker](sv-time-picker.md) behind tabs, over the headless
`createDateTimePicker` core (value math, parse/format, clamping, dropdown and tab
state). The component keeps the render-only concerns - the portalled popover
positioning, DOM refs, and outside-click / reposition listeners - so the dropdown
is never clipped by the grid's scroll container. It carries the shared editor
contract (label, hint, error validation, RTL) via `SvField`, and is the editor
SvGrid mounts for a `datetime` cell.

<div data-docs-demo="252-datetimepicker" data-height="460" data-code></div>

```svelte
<script lang="ts">
  import { SvDateTimePicker } from '@svgrid/grid'
  let value = $state<Date | null>(new Date())
</script>

<SvDateTimePicker
  {value}
  formatString="yyyy-MM-dd HH:mm"
  dropDownDisplayMode="both"
  min={new Date(2020, 0, 1)}
  nullable
  spinButtons
  onChange={(d) => (value = d)}
/>
```

## Props

`SvDateTimePicker` extends `SvEditorProps` (`disabled`, `readonly`, `required`,
`invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`, `ariaLabel`).
Its own props:

| Prop                  | Type                                     | Default              | Description                                                        |
| --------------------- | ---------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `value`               | `DateTimeValue`                          | `null`               | A `Date`, parseable string, or epoch ms.                          |
| `onChange`            | `(value: Date \| null) => void`          | -                    | Fires on every value change.                                      |
| `onCommit`            | `(value: Date \| null) => void`          | -                    | Value finalized (Enter, blur, single-date pick). Grid saves here. |
| `onCancel`            | `() => void`                             | -                    | Escape / dismiss without committing (grid cancels the edit).      |
| `formatString`        | `string`                                 | `yyyy-MM-dd HH:mm`   | Display / parse mask (token engine).                              |
| `min` / `max`         | `DateLike \| null`                       | `null`               | Bounds; the value is clamped into range.                          |
| `nullable`            | `boolean`                                | `true`               | Allow clearing to `null` (shows a clear button).                  |
| `placeholder`         | `string`                                 | `Select date & time` | Empty-field placeholder.                                          |
| `locale`              | `string`                                 | navigator            | BCP-47 locale for names and formatting.                          |
| `firstDayOfWeek`      | `number`                                 | `0`                  | `0` = Sunday .. `6` = Saturday (passed to the calendar).         |
| `weekNumbers`         | `boolean`                                | `false`              | Show the calendar's week-number column.                          |
| `hourFormat`          | `12-hour` \| `24-hour`                   | `24-hour`            | Clock format for the TIME tab.                                   |
| `minuteInterval`      | `number`                                 | `1`                  | Minute snap step for the TIME tab.                               |
| `dropDownDisplayMode` | `both` \| `calendar` \| `time`           | `both`               | Which tabs the dropdown shows.                                  |
| `spinButtons`         | `boolean`                                | `false`              | Up/down buttons that bump the value by `stepMinutes`.           |
| `stepMinutes`         | `number`                                 | `1`                  | Increment for the spin buttons.                                 |
| `autoOpen`            | `boolean`                                | `false`              | Open the dropdown as soon as the field is focused.             |
| `animate`             | `boolean` \| `slide` \| `fade`           | `false`              | Animate the calendar's month / drill navigation.               |
| `messages`            | `Partial<DateTimeMessages>`              | -                    | Override the tab / dialog / aria strings.                       |

### Helper types

- `DateTimeValue = Date | string | number | null`
- `DropDownDisplayMode = 'both' | 'calendar' | 'time'`

## Examples

### Date-only or time-only fields

Drop a tab with `dropDownDisplayMode` and match the mask, so one component covers
`date`, `time`, and `datetime` columns. This demo shows five field shapes on one
form:

<div data-docs-demo="259-datetimepicker-forms" data-height="520" data-code></div>

```svelte
<SvDateTimePicker dropDownDisplayMode="calendar" formatString="yyyy-MM-dd" />
<SvDateTimePicker dropDownDisplayMode="time" formatString="HH:mm" hourFormat="12-hour" />
```

### Typed input with validation

Text is parsed on blur / Enter; input that doesn't fit the mask reverts, and the
value is clamped to `min` / `max`. Wire `invalid` / `error` through the editor
contract for a described error:

```svelte
<SvDateTimePicker
  label="Starts"
  min={new Date()}
  invalid={!!err}
  error={err}
  onChange={(d) => (start = d)}
/>
```

### Spin buttons for fine nudges

Turn on `spinButtons` and set `stepMinutes` for keyboard-free increments -
useful for timers and scheduling grids:

```svelte
<SvDateTimePicker spinButtons stepMinutes={15} onChange={(d) => (value = d)} />
```

### In-grid cell editor

This is the editor SvGrid mounts for a `datetime` cell. Turn on `autoOpen` so the
dropdown appears the moment the field is focused, and map `onCommit` / `onCancel`
to save or cancel the edit:

```svelte
<SvDateTimePicker
  value={cell}
  autoOpen
  dropDownDisplayMode="both"
  onCommit={(d) => save(d)}
  onCancel={() => cancel()}
/>
```

Tip: `onChange` fires on every edit, but `onCommit` fires only when the value is
finalized (Enter, blur, or a single-date pick) - persist on `onCommit`, preview
on `onChange`.

## Accessibility

- Built on `SvField`, so `label`, `hint`, and `error` are wired via
  `for` / `aria-describedby`; `invalid` sets `aria-invalid`.
- The dropdown is a `role="dialog"`; the toggle carries an accessible open label
  and the tabs are a `role="tablist"`.
- The popover portals to `<body>` and repositions on scroll / resize, so it is
  never clipped inside a scrolling grid.
- `onCommit` / `onCancel` map Enter and Escape for in-grid cell editing.

## See also

- [Date & time overview](date-time.md) - the whole family at a glance.
- [SvCalendar](sv-calendar.md) / [SvTimePicker](sv-time-picker.md) - the two pickers it composes.
- [SvDateRangeInput](sv-date-range-input.md) - the range sibling.
