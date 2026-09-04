# SvSlider

A single or dual-thumb range slider with steps, ticks, scale labels, and full
keyboard plus pointer control.

`SvSlider` is the numeric range control for the kit - drag a thumb, click the
track, or arrow the value with the keyboard. Its behavior (value/position math,
stepping, drag state, and `role="slider"` ARIA) lives in the headless
`createSlider` core, so this styled component is one renderer over it. Pass
`range` for a dual-thumb selection that emits `[lo, hi]`; a single slider emits a
plain number. Every color comes from the grid's `--sg-*` tokens, so it matches
your grid and forms in light and dark.

Related: [SvGauge](sv-gauge.md) · [SvNumberInput](sv-number-input.md) · [Range & meters overview](range.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvSlider` starter into your app:

<div data-docs-add="add slider"></div>

Prefer to see it first? `npx @svgrid/ui try slider` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvSlider` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvSlider } from '@svgrid/grid'

  // The bound value behind each example below.
  let band = $state(0)
  let gain = $state(0)
</script>
```

```ts
import { SvSlider } from '@svgrid/grid'
```

## Example

<div data-docs-demo="318-slider" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvSlider } from '@svgrid/grid'
  let volume = $state(40)
  let price = $state<[number, number]>([20, 80])
</script>

<SvSlider label="Volume" value={volume} onChange={(v) => (volume = v)} showValue />

<SvSlider
  label="Price range"
  range
  value={price}
  min={0}
  max={200}
  step={5}
  ticks={5}
  labels="endpoints"
  onChange={(v) => (price = v)}
  formatValue={(v) => `$${v}`}
/>
```

## Props

| Prop          | Type                                     | Default        | Description                                                              |
| ------------- | ---------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| `value`       | `number \| [number, number]`             | `0`            | Current value. An array when `range` is on.                             |
| `onChange`    | `(value: any) => void`                   | -              | Fires on each change with a number, or `[lo, hi]` in range mode.        |
| `min`         | `number`                                 | `0`            | Lower bound of the scale.                                               |
| `max`         | `number`                                 | `100`          | Upper bound of the scale.                                               |
| `step`        | `number`                                 | `1`            | Snap increment for drag and keyboard.                                   |
| `range`       | `boolean`                                | `false`        | Two thumbs selecting a `[lo, hi]` interval.                             |
| `ticks`       | `number \| number[]`                     | -              | Evenly spaced tick count, or explicit tick values.                      |
| `labels`      | `none` \| `endpoints` \| `all`           | `none`         | Numeric scale labels under a horizontal track.                          |
| `showValue`   | `boolean`                                | `false`        | Value bubble above the thumb while set.                                 |
| `orientation` | `horizontal` \| `vertical`               | `horizontal`   | Layout axis.                                                            |
| `formatValue` | `(v: number) => string`                  | -              | Formats bubble and scale labels (e.g. currency).                        |
| `disabled`    | `boolean`                                | `false`        | Blocks interaction and dims the control.                                |
| `label`       | `string`                                 | -              | Field label wired through [SvField](sv-field.md).                       |
| `hint`        | `string`                                 | -              | Helper text under the control.                                          |
| `error`       | `string`                                 | -              | Error message; announced and shown when set.                            |
| `required`    | `boolean`                                | `false`        | Marks the field required for validation.                                |
| `invalid`     | `boolean`                                | `false`        | Marks the field invalid; sets `aria-invalid` on the control.            |
| `name`        | `string`                                 | -              | Emits a hidden input (`lo,hi` in range mode) for form posts.            |
| `ariaLabel`   | `string`                                 | -              | Accessible name when there is no visible `label`.                       |
| `dir`         | `ltr` \| `rtl` \| `auto`                 | `auto`         | Text direction; `rtl` mirrors the track.                                |
| `id`          | `string`                                 | -              | Control id; auto-generated when omitted.                                |

## Examples

### Range with ticks and formatted readout

Turn on `range` and pass `ticks` plus `formatValue` for a filter-style price
band that reads back in its own units:

```svelte {runnable}
<SvSlider
  range
  min={0} max={500} step={10}
  ticks={6} labels="all" showValue
  value={band} onChange={(v) => (band = v)}
  formatValue={(v) => `$${v}`}
/>
```

### Vertical orientation

Set `orientation="vertical"` for mixer-style controls. Ticks and thumbs mirror
onto the vertical axis; scale labels render on horizontal tracks only:

```svelte {runnable}
<SvSlider orientation="vertical" value={gain} onChange={(v) => (gain = v)} />
```

### Form field

Give a `name` and the slider emits a hidden input so the value posts with a
plain `<form>` - `lo,hi` for a range, or the number for a single thumb.

### Explicit tick positions

Pass `ticks` an array to place marks at specific values instead of evenly spaced
ones - handy for a rating or a milestone scale:

```svelte {runnable}
<script lang="ts">
  import { SvSlider } from '@svgrid/grid'
  let quality = $state(50)
</script>

<SvSlider
  label="Quality"
  min={0} max={100} step={5}
  ticks={[0, 25, 50, 75, 100]}
  labels="all" showValue
  value={quality} onChange={(v) => (quality = v)}
  formatValue={(v) => `${v}%`}
/>
```

Tip: with `labels="all"` the scale labels track your `ticks` array (falling back
to `min` / `max` when there are none), so a custom tick set doubles as the labels.

## Accessibility

- Each thumb carries `role="slider"` with `aria-valuemin` / `aria-valuemax` /
  `aria-valuenow`, supplied by the `createSlider` core.
- Keyboard: arrow keys step by `step`, and the thumb takes a visible focus ring.
- Set `ariaLabel` (or a visible `label`) so the slider announces its purpose.

## More examples

### Slider - headless

createSlider drives styled SvSlider plus a custom draggable bar (rect measured in the component), one number.

<div data-docs-demo="281-headless-slider" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<script lang="ts">
  import { SvSlider } from '@svgrid/grid'

  let volume = $state(1)
</script>

<SvSlider value={volume} size="sm" />
<SvSlider value={volume} size="md" />
<SvSlider value={volume} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<script lang="ts">
  import { SvSlider } from '@svgrid/grid'

  let volume = $state(1)
</script>

<SvSlider
  value={volume}
  label="Label"
  hint="A short hint"
  required
/>

<SvSlider
  value={volume}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Range overview](range.md) - the range-control family at a glance.
- [SvGauge](sv-gauge.md) - a read-only radial display of a single value.
- [SvNumberInput](sv-number-input.md) - a typed numeric entry alternative.
