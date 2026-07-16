# Buttons & toggles

Press and toggle primitives. All take a `size` (`sm` | `md` | `lg`) and theme
from `--sg-*`.

## SvButton

```svelte
<SvButton variant="primary" onclick={save}>Save</SvButton>
<SvButton variant="outline" loading>Saving…</SvButton>
```

Props: `variant` (`primary` `secondary` `outline` `ghost` `danger`), `size`,
`loading`, `disabled`, `block`, `href` (renders an anchor), `icon` snippet,
`onclick`.

## SvRepeatButton

Fires `onclick` repeatedly while held (after `delay`, then every `interval` ms).
Used for steppers and spinners.

```svelte
<SvRepeatButton onclick={() => count++}>+</SvRepeatButton>
```

Props: `onclick`, `delay` (default 300), `interval` (default 60), `variant`,
`size`, `disabled`.

## SvToggleButton

A button with a pressed on/off state (`aria-pressed`).

```svelte
<SvToggleButton pressed={bold} onChange={(v) => (bold = v)}><strong>B</strong></SvToggleButton>
```

Props: `pressed`, `onChange(pressed)`, `size`, `disabled`.

## SvSwitchButton

An on/off sliding switch (ARIA `switch`), keyboard togglable.

```svelte
<SvSwitchButton checked={on} onChange={(v) => (on = v)} />
```

Props: `checked`, `onChange(checked)`, `size`, `onLabel` / `offLabel`, `disabled`.

## SvCheckBox

Checkbox with an indeterminate state and optional label child.

```svelte
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

```svelte
<SvRating value={stars} onChange={(v) => (stars = v)} allowHalf />
```

Props: `value`, `onChange(value)`, `max` (default 5), `allowHalf`, `readOnly`,
`size`, `disabled`. Uses the grid's `--sg-rating-*` tokens.
