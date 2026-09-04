# SvNumberInput

A numeric input with min/max/step, spinner buttons, thousands grouping,
precision, and prefix/suffix.

`SvNumberInput` is the number editor for forms and grid cells. It emits
`number | null`, clamps to `min` / `max`, rounds to `precision`, and can group
thousands or wrap the value in a `prefix` / `suffix` (currency, units). It is the
styled renderer over the headless `createNumberInput` core, so parse, format,
clamp, spinner, and keyboard all come from one place. Its label / hint / error
chrome comes from [SvField](sv-field.md).

Related: [SvDurationInput](sv-duration-input.md) · [SvMaskedInput](sv-masked-input.md) · [Inputs overview](inputs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvNumberInput` starter into your app:

<div data-docs-add="add number-input"></div>

Prefer to see it first? `npx @svgrid/ui try number-input` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvNumberInput` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvNumberInput } from '@svgrid/grid'

  // The bound value behind each example below.
  let weight = $state(0)
  let qty = $state(0)
</script>
```

```ts
import { SvNumberInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="300-number-input" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvNumberInput } from '@svgrid/grid'
  let price = $state<number | null>(1299.5)
</script>

<SvNumberInput
  label="Price"
  bind:value={price}
  min={0}
  step={0.5}
  precision={2}
  grouping
  prefix="$"
/>
```

## Props

`SvNumberInput` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop          | Type                                | Default     | Description                                        |
| ------------- | ----------------------------------- | ----------- | -------------------------------------------------- |
| `value`       | `number \| null`                    | `null`      | The numeric value (`null` when empty).             |
| `onChange`    | `(value: number \| null) => void`   | -           | Fires with the parsed, clamped value.              |
| `min`         | `number`                            | `-Infinity` | Lower clamp bound.                                  |
| `max`         | `number`                            | `Infinity`  | Upper clamp bound.                                  |
| `step`        | `number`                            | `1`         | Spinner and arrow-key increment.                   |
| `precision`   | `number`                            | -           | Decimal places to round to.                        |
| `grouping`    | `boolean`                           | `false`     | Group thousands (1,234) on display.                |
| `prefix`      | `string`                            | `''`        | Text formatted before the number (e.g. `$`); it travels with the right-aligned value. |
| `suffix`      | `string`                            | `''`        | Text formatted after the number (e.g. `kg`); it travels with the value. |
| `placeholder` | `string`                            | -           | Empty-state hint text.                             |
| `spinButtons` | `boolean`                           | `true`      | Show the up/down stepper.                          |
| `clearable`   | `boolean`                           | `false`     | Show a clear (x) button when there is a value.     |
| `selectOnFocus` | `boolean`                         | `false`     | Select the whole value when the field is focused.  |
| `wheelStep`   | `boolean`                           | `false`     | Step the value with the mouse wheel while focused.  |
| `leading`     | `Snippet`                           | -           | Leading adornment (icon) inside the field.         |
| `block`       | `boolean`                           | `false`     | Stretch to the container width.                    |
| `width`       | `number`                            | `150`       | Control width in px (ignored when `block`).        |

The box, size, invalid state and focus ring are owned by [SvField](sv-field.md)'s
shared `frame` chrome. Unlike [SvTextInput](sv-text-input.md), the `prefix`/`suffix`
here are formatted into the value (so the symbol stays next to the right-aligned
number) rather than rendered as separate affixes.

The field shows a formatted value when blurred (e.g. `$1,234.50` with `prefix`,
`grouping` and `precision`) and the bare number while focused for easy editing -
the display/edit duality is built in.

## Examples

### Currency and units

Combine `prefix` / `suffix` with `precision` and `grouping` for money or
measurements without a separate formatter:

```svelte {runnable}
<SvNumberInput bind:value={weight} suffix=" kg" precision={1} step={0.1} />
```

### Bounded stepper

`min`, `max`, and `step` drive both the spinner buttons and the arrow keys, and
the value is clamped on commit so it never leaves the range:

```svelte {runnable}
<SvNumberInput label="Quantity" bind:value={qty} min={1} max={99} />
```

### Order line with a computed total

Because the value is a real `number | null`, a `$derived` total falls out of the
two fields with no formatter of its own. Guard the `null` empty state with `??`:

```svelte {runnable}
<script lang="ts">
  import { SvNumberInput } from '@svgrid/grid'
  let qty = $state<number | null>(1)
  let unit = $state<number | null>(19.99)
  const total = $derived((qty ?? 0) * (unit ?? 0))
</script>

<SvNumberInput label="Quantity" bind:value={qty} min={1} max={99} step={1} />
<SvNumberInput label="Unit price" bind:value={unit} min={0} precision={2} grouping prefix="$" />
<p>Line total: ${total.toFixed(2)}</p>
```

Tip: the field emits `null` (never `NaN`) when cleared, so `value == null` is the
reliable empty check and `value ?? 0` is the safe way to fold it into arithmetic.

## Accessibility

- The stepper uses [SvRepeatButton](sv-repeat-button.md), so holding a spinner
  auto-repeats; each button has an `aria-label` ("Increment" / "Decrement").
- `label`, `hint`, and `error` are wired via [SvField](sv-field.md); `required`
  and `invalid` add `aria-required` / `aria-invalid`.
- Arrow keys step the value by `step`, matching a native number spinner.

## More examples

### Number input - headless

createNumberInput drives SvNumberInput and a custom stepper; parse, clamp, spinner and keyboard all from the core.

<div data-docs-demo="266-headless-numberinput" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<script lang="ts">
  import { SvNumberInput } from '@svgrid/grid'

  let price = $state(1)
</script>

<SvNumberInput bind:value={price} size="sm" />
<SvNumberInput bind:value={price} size="md" />
<SvNumberInput bind:value={price} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<script lang="ts">
  import { SvNumberInput } from '@svgrid/grid'

  let price = $state(1)
</script>

<SvNumberInput
  bind:value={price}
  label="Label"
  hint="A short hint"
  required
/>

<SvNumberInput
  bind:value={price}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvDurationInput](sv-duration-input.md) - minutes with human-typed input.
- [SvMaskedInput](sv-masked-input.md) - fixed-pattern text entry.
