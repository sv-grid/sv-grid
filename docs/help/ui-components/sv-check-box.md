# SvCheckBox

A themed checkbox with a true indeterminate state and an optional inline label.

`SvCheckBox` covers the everyday opt-in as well as the tri-state "select all"
parent that goes half-checked when only some children are ticked. It is
controlled - drive `checked` (and optionally `indeterminate`) from your state and
update it in `onChange`. Its label is whatever you pass as children, and it emits
a hidden input for form submission when you give it a `name`.

<div data-docs-demo="309-checkbox" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvCheckBox } from '@svgrid/grid'
  let agree = $state(false)
</script>

<SvCheckBox checked={agree} onChange={(v) => (agree = v)}>
  I accept the terms
</SvCheckBox>
```

## Props

| Prop            | Type                         | Default | Description                                                        |
| --------------- | ---------------------------- | ------- | ----------------------------------------------------------------- |
| `checked`       | `boolean`                    | `false` | Current checked state (controlled).                              |
| `indeterminate` | `boolean`                    | `false` | Shows the dash (mixed) state; overrides the check visually.      |
| `onChange`      | `(checked: boolean) => void` | -       | Fires with the next checked state on toggle.                     |
| `value`         | `string`                     | -       | Value emitted by the hidden input when checked (else empty).     |
| `name`          | `string`                     | -       | Emits a hidden input carrying `value` (or `true`) when checked.  |
| `disabled`      | `boolean`                    | `false` | Blocks toggling and dims the control.                            |
| `size`          | `sm` \| `md` \| `lg`         | `md`    | Box and label size.                                             |
| `hint`          | `string`                     | -       | Helper text under the checkbox.                                 |
| `error`         | `string`                     | -       | Error message announced via `aria-describedby`.                 |
| `required`      | `boolean`                    | `false` | Adds `aria-required`.                                           |
| `invalid`       | `boolean`                    | `false` | Marks the box invalid (danger border).                         |
| `dir`           | `ltr` \| `rtl` \| `auto`     | `auto`  | Text direction.                                                |
| `ariaLabel`     | `string`                     | -       | Accessible name; defaults to `checkbox` when there is no label. |
| `id`            | `string`                     | auto    | Root id; hint/error ids derive from it.                         |
| `children`      | `Snippet`                    | -       | The inline label next to the box.                              |

## Patterns

### Tri-state select-all

Compute the parent's `checked` and `indeterminate` from the children so it goes
half-checked when the selection is partial:

```svelte
<script lang="ts">
  let items = $state([true, false, true])
  const all = $derived(items.every(Boolean))
  const some = $derived(items.some(Boolean) && !all)
  const setAll = (v: boolean) => (items = items.map(() => v))
</script>

<SvCheckBox checked={all} indeterminate={some} onChange={setAll}>Select all</SvCheckBox>
```

### Required consent

Mark it `required` and set `invalid` + `error` until it is ticked:

```svelte
<SvCheckBox required checked={agree} invalid={!agree}
  error={!agree ? 'You must accept to continue' : undefined}
  onChange={(v) => (agree = v)}>I accept the terms</SvCheckBox>
```

### In a form

Give a `name` and `value` and a plain form submit carries the ticked value:

```svelte
<SvCheckBox name="roles" value="admin" checked={isAdmin} onChange={(v) => (isAdmin = v)}>Admin</SvCheckBox>
```

### Multi-select checklist

Render one box per option and keep the ticked values in an array, adding or
removing each in `onChange` - the classic permissions or filter list:

```svelte
<script lang="ts">
  import { SvCheckBox } from '@svgrid/grid'
  const perms = ['read', 'write', 'delete']
  let granted = $state<string[]>(['read'])
  const toggle = (p: string, on: boolean) =>
    (granted = on ? [...granted, p] : granted.filter((x) => x !== p))
</script>

{#each perms as p (p)}
  <SvCheckBox checked={granted.includes(p)} onChange={(v) => toggle(p, v)}>{p}</SvCheckBox>
{/each}
```

## Accessibility

- Renders a `<button role="checkbox">` with `aria-checked` set to `true`,
  `false`, or `mixed` for the indeterminate state.
- `Enter` and `Space` toggle it; the label wraps the box so clicking the text
  also toggles.
- When you provide no label children, set `ariaLabel` (it falls back to
  `checkbox`) so the control still announces a name.

## See also

- [SvRadioGroup](sv-radio-group.md) - choose one option from several.
- [SvSwitchButton](sv-switch-button.md) - an on/off setting that applies immediately.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
