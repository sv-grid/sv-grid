# SvDurationInput

A duration editor whose value is a number of minutes but which accepts the human
forms people actually type.

`SvDurationInput` stores a plain minute count yet lets users enter `1h 30m`,
`1:30`, or `90` - it parses on blur or `Enter` and shows a tidy formatted value
when unfocused. That keeps your model numeric (easy to sum, compare, and store)
while the UI stays human. Its label / hint / error chrome comes from
[SvField](sv-field.md). As a grid cell editor: `Enter` commits, `Escape` cancels.

<div data-docs-demo="334-input-editors" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvDurationInput } from '@svgrid/grid'
  let minutes = $state<number | null>(90)
</script>

<SvDurationInput label="Task estimate" bind:value={minutes} style="units" />
<p>Stored as {minutes} minutes</p>
```

## Props

`SvDurationInput` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop          | Type                                | Default       | Description                                            |
| ------------- | ----------------------------------- | ------------- | ------------------------------------------------------ |
| `value`       | `number \| null`                    | `null`        | Value in minutes. Bindable with `bind:value`.          |
| `onChange`    | `(minutes: number \| null) => void` | -             | Fires with the parsed minutes on commit.               |
| `onCommit`    | `(minutes: number \| null) => void` | -             | Fires on `Enter`.                                      |
| `onCancel`    | `() => void`                        | -             | Fires on `Escape`.                                     |
| `style`       | `colon` \| `units`                  | `colon`       | Display when unfocused: `1:30` vs `1h 30m`.            |
| `placeholder` | `string`                            | `e.g. 1h 30m` | Empty-state hint text.                                 |
| `autofocus`   | `boolean`                           | `false`       | Focus + select on mount (used as a cell editor).       |

## Patterns

### Colon vs units display

Pick the resting format that fits your domain - `colon` reads like a clock,
`units` reads like an estimate:

```svelte
<SvDurationInput style="colon" bind:value={runtime} />
<SvDurationInput style="units" bind:value={estimate} />
```

### Flexible typing

The field accepts several shapes and normalizes them on blur, so `90`, `1:30`,
and `1h 30m` all resolve to the same 90 minutes. Empty input yields `null`.

### Timesheet total from a numeric model

Because each field stores plain minutes, a running total is just arithmetic -
no parsing of `1h 30m` strings on your side:

```svelte
<script lang="ts">
  import { SvDurationInput } from '@svgrid/grid'
  let mon = $state<number | null>(480)
  let tue = $state<number | null>(510)
  const week = $derived((mon ?? 0) + (tue ?? 0))
  const hrs = $derived(Math.floor(week / 60))
  const mins = $derived(week % 60)
</script>

<SvDurationInput label="Monday" style="units" bind:value={mon} />
<SvDurationInput label="Tuesday" style="units" bind:value={tue} />
<p>Week total: {hrs}h {mins}m ({week} min)</p>
```

Tip: parsing runs on blur and `Enter`, so bind to `value` (the committed minutes)
for calculations rather than trying to read the mid-edit text.

## Accessibility

- Renders a native `<input>` with `inputmode="numeric"` for a numeric keypad.
- `label`, `hint`, and `error` are wired via `for`/`id` and `aria-describedby` by
  [SvField](sv-field.md); `required` and `invalid` add the matching ARIA.
- Parsing happens on blur and `Enter`, so assistive tech reads the committed,
  formatted value rather than mid-edit text.

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvNumberInput](sv-number-input.md) - plain numeric entry with spinners.
- [SvMaskedInput](sv-masked-input.md) - fixed-pattern text entry.
