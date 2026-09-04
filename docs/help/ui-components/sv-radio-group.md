# SvRadioGroup

An accessible single-select radio group following the WAI-ARIA radiogroup
pattern, with roving tabindex and arrow-key navigation.

`SvRadioGroup` renders a set of options where exactly one is chosen - a plan
picker, a shipping method, a survey answer. Pass an `options` array and it wires
up the roving focus, arrow keys, and selection for you. It is controlled: drive
`value` from your state and update it in `onChange`. It carries the shared editor
contract (label, hint, validation, `dir`/RTL) through [SvField](inputs.md).

Related: [SvButtonGroup](sv-button-group.md) · [SvCheckBox](sv-check-box.md) · [Buttons & toggles overview](buttons.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvRadioGroup` starter into your app:

<div data-docs-add="add radio-group"></div>

Prefer to see it first? `npx @svgrid/ui try radio-group` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvRadioGroup` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvRadioGroup } from '@svgrid/grid'
  import type { ListOption } from '@svgrid/grid'

  // The bound value behind each example below.
  const sizes: ListOption[] = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]
  let size = $state('')
  const plans: ListOption[] = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]
  let plan = $state('')
</script>
```

```ts
import { SvRadioGroup } from '@svgrid/grid'
```

## Example

<div data-docs-demo="310-radio-group" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvRadioGroup, type RadioOption } from '@svgrid/grid'

  const plans: RadioOption[] = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'team', label: 'Team' },
  ]
  let plan = $state<string | number | null>('pro')
</script>

<SvRadioGroup
  label="Plan"
  options={plans}
  value={plan}
  onChange={(v) => (plan = v)}
/>
```

## Props

| Prop          | Type                                    | Default    | Description                                                       |
| ------------- | --------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `options`     | `ReadonlyArray<RadioOption>`            | -          | The choices. Each is `{ value, label, disabled? }`.             |
| `value`       | `string \| number \| null`              | `null`     | Selected value (controlled).                                    |
| `onChange`    | `(value: string \| number) => void`     | -          | Fires with the newly selected value.                            |
| `orientation` | `vertical` \| `horizontal`              | `vertical` | Stack the radios or lay them in a row.                          |
| `size`        | `sm` \| `md` \| `lg`                    | `md`       | Label size.                                                    |
| `disabled`    | `boolean`                               | `false`    | Disables the whole group.                                      |
| `name`        | `string`                                | -          | Emits a hidden input carrying the selected value.              |
| `label`       | `string`                                | -          | Visible field label; also names the group for assistive tech.  |
| `hint`        | `string`                                | -          | Helper text under the group.                                   |
| `error`       | `string`                                | -          | Error message announced via `aria-describedby`.                |
| `required`    | `boolean`                               | `false`    | Adds `aria-required`.                                          |
| `invalid`     | `boolean`                               | `false`    | Marks the group invalid (danger dots).                        |
| `dir`         | `ltr` \| `rtl` \| `auto`                | `auto`     | Text direction.                                                |
| `ariaLabel`   | `string`                                | -          | Accessible name when there is no visible `label`.             |
| `id`          | `string`                                | auto       | Root id; label/hint/error ids derive from it.                  |

Helper type: `RadioOption = { value: string | number; label: string; disabled?: boolean }`.

## Examples

### Horizontal layout

Set `orientation="horizontal"` for a compact row, such as a size or quantity
picker:

```svelte
<SvRadioGroup orientation="horizontal" options={sizes} value={size}
  onChange={(v) => (size = v)} />
```

### Disabled options

Mark an option `disabled` and keyboard navigation skips it while it stays
visible:

```svelte
<script lang="ts">
  const shipping = [
    { value: 'standard', label: 'Standard' },
    { value: 'overnight', label: 'Overnight (unavailable)', disabled: true },
  ]
</script>
```

### Required with validation

Mark the group `required` and set `invalid` + `error` until a choice is made:

```svelte
<SvRadioGroup required label="Plan" options={plans} value={plan}
  invalid={plan === null} error={plan === null ? 'Pick a plan' : undefined}
  onChange={(v) => (plan = v)} />
```

### Driving a computed value

The selected `value` is just state, so a `$derived` can react to it - a plan
picker that updates the price beneath it as you choose:

```svelte {runnable}
<script lang="ts">
  import { SvRadioGroup, type RadioOption } from '@svgrid/grid'
  const plans: RadioOption[] = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'team', label: 'Team' },
  ]
  const price = { free: 0, pro: 12, team: 40 }
  let plan = $state<string | number | null>('pro')
</script>

<SvRadioGroup label="Plan" options={plans} value={plan} onChange={(v) => (plan = v)} />
<p>{plan ? `$${price[plan as keyof typeof price]}/mo` : 'Select a plan'}</p>
```

## Accessibility

- The container is a `radiogroup`; each option is a `role="radio"` with
  `aria-checked`, named by a visible `label` or `ariaLabel`.
- Roving tabindex: only the selected radio (or the first enabled one) is
  tabbable. Arrow keys move and select in one step, wrapping around and skipping
  disabled options; `Space` selects the focused radio.
- Under `dir="rtl"` the horizontal arrow direction follows reading order.

## More examples

### Radio group - headless

Styled SvRadioGroup plus a custom segmented control (with a disabled option), one bound value.

<div data-docs-demo="274-headless-radiogroup" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<SvRadioGroup options={plans} size="sm" />
<SvRadioGroup options={plans} size="md" />
<SvRadioGroup options={plans} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<SvRadioGroup
  options={plans}
  label="Label"
  hint="A short hint"
  required
/>

<SvRadioGroup
  options={plans}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [SvButtonGroup](sv-button-group.md) - the same select-one choice as a segmented bar.
- [SvCheckBox](sv-check-box.md) - for choosing several options instead of one.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
