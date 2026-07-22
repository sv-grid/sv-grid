# SvNumberInput

A numeric input with min/max/step, spinner buttons, thousands grouping,
precision, and prefix/suffix.

`SvNumberInput` is the number editor for forms and grid cells. It emits
`number | null`, clamps to `min` / `max`, rounds to `precision`, and can group
thousands or wrap the value in a `prefix` / `suffix` (currency, units). It is the
styled renderer over the headless `createNumberInput` core, so parse, format,
clamp, spinner, and keyboard all come from one place. Its label / hint / error
chrome comes from [SvField](sv-field.md).

<div data-docs-demo="300-number-input" data-height="420"></div>

## Basic usage

```svelte
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
| `prefix`      | `string`                            | `''`        | Leading text (for example `$`).                    |
| `suffix`      | `string`                            | `''`        | Trailing text (for example `kg`).                  |
| `placeholder` | `string`                            | -           | Empty-state hint text.                             |
| `spinButtons` | `boolean`                           | `true`      | Show the up/down stepper.                          |
| `clearable`   | `boolean`                           | `false`     | Show a clear (x) button when there is a value.     |

## Patterns

### Currency and units

Combine `prefix` / `suffix` with `precision` and `grouping` for money or
measurements without a separate formatter:

```svelte
<SvNumberInput bind:value={weight} suffix=" kg" precision={1} step={0.1} />
```

### Bounded stepper

`min`, `max`, and `step` drive both the spinner buttons and the arrow keys, and
the value is clamped on commit so it never leaves the range:

```svelte
<SvNumberInput label="Quantity" bind:value={qty} min={1} max={99} />
```

### Order line with a computed total

Because the value is a real `number | null`, a `$derived` total falls out of the
two fields with no formatter of its own. Guard the `null` empty state with `??`:

```svelte
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

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvDurationInput](sv-duration-input.md) - minutes with human-typed input.
- [SvMaskedInput](sv-masked-input.md) - fixed-pattern text entry.
