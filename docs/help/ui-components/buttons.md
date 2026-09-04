# Buttons & toggles

Press and toggle primitives. All take a `size` (`sm` | `md` | `lg`) and theme
from `--sg-*`.

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add buttons"></div>

Prefer to see them first? `npx @svgrid/ui try buttons` opens the whole family in a sandbox - no project needed.

They all ship free in the `@svgrid/grid` package, so you can also install it and
import them directly:

<div data-docs-install="@svgrid/grid"></div>

## SvButton

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvButton, SvCheckBox, SvRadioGroup, SvRating, SvRepeatButton, SvSwitchButton, SvToggleButton } from '@svgrid/grid'

  // The bound value behind each example below.
  let on = $state(false)
  let bold = $state(false)
  let agree = $state(false)
  let count = $state(0)
  let stars = $state(3)
  let plan = $state('pro')

  const save = async () => {
    await new Promise((r) => setTimeout(r, 600))
  }
</script>
```

```svelte {runnable}
<SvButton variant="primary" onclick={save}>Save</SvButton>
<SvButton variant="outline" loading>Saving…</SvButton>
```

Props: `variant` (`primary` `secondary` `outline` `ghost` `danger`), `size`,
`loading`, `disabled`, `block`, `href` (renders an anchor), `icon` snippet,
`onclick`.

## SvRepeatButton

Fires `onclick` repeatedly while held (after `delay`, then every `interval` ms).
Used for steppers and spinners.

```svelte {runnable}
<SvRepeatButton onclick={() => count++}>+</SvRepeatButton>
```

Props: `onclick`, `delay` (default 300), `interval` (default 60), `variant`,
`size`, `disabled`.

## SvToggleButton

A button with a pressed on/off state (`aria-pressed`).

```svelte {runnable}
<SvToggleButton pressed={bold} onChange={(v) => (bold = v)}><strong>B</strong></SvToggleButton>
```

Props: `pressed`, `onChange(pressed)`, `size`, `disabled`.

## SvSwitchButton

An on/off sliding switch (ARIA `switch`), keyboard togglable.

```svelte {runnable}
<SvSwitchButton checked={on} onChange={(v) => (on = v)} />
```

Props: `checked`, `onChange(checked)`, `size`, `onLabel` / `offLabel`, `disabled`.

## SvCheckBox

Checkbox with an indeterminate state and optional label child.

```svelte {runnable}
<SvCheckBox checked={agree} onChange={(v) => (agree = v)}>I agree</SvCheckBox>
<SvCheckBox indeterminate />
```

Props: `checked`, `indeterminate`, `onChange(checked)`, `size`, `disabled`.

## SvRadioGroup

An accessible radio group with roving tabindex + arrow-key navigation.

```svelte
<SvRadioGroup options={[{value:'a',label:'A'},{value:'b',label:'B'}]}
  value={plan} onChange={(v) => (plan = v)} orientation="horizontal" />
```

Props: `options` ({ value, label, disabled? }), `value`, `onChange(value)`,
`orientation` (`vertical` | `horizontal`), `size`, `disabled`.

## SvRating

A star rating (ARIA slider) with hover preview, half steps and keyboard.

```svelte {runnable}
<SvRating value={stars} onChange={(v) => (stars = v)} allowHalf />
```

Props: `value`, `onChange(value)`, `max` (default 5), `allowHalf`, `readOnly`,
`size`, `disabled`. Uses the grid's `--sg-rating-*` tokens.

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvButton](./sv-button.md) - the press primitive with variants, loading and icons.
- [SvButtonGroup](./sv-button-group.md) - a segmented button bar or view switcher.
- [SvRepeatButton](./sv-repeat-button.md) - fires repeatedly while held, for steppers.
- [SvToggleButton](./sv-toggle-button.md) - a button with a pressed on/off state.
- [SvSwitchButton](./sv-switch-button.md) - an on/off sliding switch control.
- [SvCheckBox](./sv-check-box.md) - a checkbox with an indeterminate state.
- [SvRadioGroup](./sv-radio-group.md) - an accessible single-choice radio group.
- [SvRating](./sv-rating.md) - a star rating with half steps.

## More examples

### Buttons & toggles

The UI kit press/toggle primitives: SvButton (variants/sizes/loading), SvRepeatButton (hold-to-repeat), SvToggleButton, SvSwitchButton, SvCheckBox (+ indeterminate), SvRadioGroup (arrow-key nav) and SvRating (half stars). Theme-driven, standalone or as grid cell controls.

<div data-docs-demo="253-buttons-toggles" data-height="420"></div>
