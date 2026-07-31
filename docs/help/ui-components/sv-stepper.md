# SvStepper

A progress stepper for wizards and multi-step forms. It lays out completed,
active, and upcoming steps so the user always knows where they are.

`SvStepper` is controlled by a 0-based `current` index; each step past it is
"complete" (marked with a check), the one at it is "active", and the rest are
"upcoming". In `linear` mode only already-reached steps are clickable, which is
the right default for a form you must not skip ahead in. It lays out horizontally
or vertically and draws all color from the `--sg-*` tokens.

Related: [SvBreadcrumb](sv-breadcrumb.md) · [SvPagination](sv-pagination.md) · [Navigation & rich overview](navigation.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvStepper` starter into your app:

<div data-docs-add="add stepper"></div>

Or install the package and import it directly. `SvStepper` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvStepper } from '@svgrid/grid'
```

## Example

<div data-docs-demo="332-app-navigation" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvStepper } from '@svgrid/grid'
  let current = $state(0)
</script>

<SvStepper current={current} onChange={(n) => (current = n)} steps={[
  { label: 'Cart' },
  { label: 'Shipping', description: 'Where to send it' },
  { label: 'Payment', optional: true },
]} />
```

## Props

| Prop          | Type                            | Default        | Description                                                    |
| ------------- | ------------------------------- | -------------- | -------------------------------------------------------------- |
| `steps`       | `ReadonlyArray<StepItem>`       | -              | The ordered steps.                                             |
| `current`     | `number`                        | -              | 0-based index of the active step. Controlled.                 |
| `onChange`    | `(index: number) => void`       | -              | Fires when a clickable step is chosen.                        |
| `linear`      | `boolean`                       | `true`         | When true, only steps at or before `current` are clickable.   |
| `orientation` | `horizontal` \| `vertical`      | `horizontal`   | Layout direction of the step list.                            |

`StepItem` (exported): `{ label: string; description?: string; optional?: boolean }`.
`description` shows as a secondary line under the label; `optional` appends an
"(optional)" tag.

## Examples

### Wizard navigation

Drive `current` from your Back / Next buttons and let the stepper reflect it:

```svelte
<SvStepper {steps} {current} onChange={(n) => (current = n)} />
<SvButton disabled={current === 0} onclick={() => current--}>Back</SvButton>
<SvButton variant="primary" onclick={() => current++}>Next</SvButton>
```

### Free navigation

Set `linear={false}` to let the user jump to any step, useful for a settings
wizard where every section is always valid:

```svelte
<SvStepper {steps} {current} linear={false} onChange={(n) => (current = n)} />
```

### Vertical layout

`orientation="vertical"` stacks the steps for a sidebar wizard, with descriptions
reading naturally under each label:

```svelte
<SvStepper {steps} {current} orientation="vertical" onChange={(n) => (current = n)} />
```

### A wizard with validation gating

Keep `linear` on (the default) and gate the Next button on the active step being
valid. The stepper still lets the user click back to any finished step, but they
cannot jump ahead until the current one passes:

```svelte
<script lang="ts">
  import { SvStepper, SvButton, type StepItem } from '@svgrid/grid'

  const steps: StepItem[] = [
    { label: 'Account' },
    { label: 'Profile', description: 'Tell us about you' },
    { label: 'Review' },
  ]
  let current = $state(0)
  let email = $state('')
  let name = $state('')

  // One validity flag per step, in order.
  const stepValid = $derived([email.includes('@'), name.trim().length > 0, true])
  const canNext = $derived(stepValid[current] && current < steps.length - 1)
</script>

<SvStepper {steps} {current} onChange={(n) => (current = n)} />

<!-- the step body switches on `current` (email input, name input, summary) -->

<SvButton disabled={current === 0} onclick={() => current--}>Back</SvButton>
<SvButton variant="primary" disabled={!canNext} onclick={() => current++}>Next</SvButton>
```

Tip: in `linear` mode a step is clickable only when its index is at or before
`current`, so backward navigation to a completed step is free while skipping
ahead is blocked automatically - you do not disable future steps yourself.

## Accessibility

- Renders an ordered list; each step is a real `<button>`.
- The active step carries `aria-current="step"`.
- Steps that are not reachable (in `linear` mode) are `disabled`, so keyboard and
  screen-reader users cannot activate them.

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [SvBreadcrumb](sv-breadcrumb.md) - show the path to the current page.
- [SvPagination](sv-pagination.md) - move through pages of a list.
