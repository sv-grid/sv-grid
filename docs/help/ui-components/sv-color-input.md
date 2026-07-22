# SvColorInput

A color swatch that opens a portalled popover with a hex field, the native
picker, and a preset palette.

`SvColorInput` shows the current color as a swatch with its hex value; clicking it
opens an animated popover carrying a hex text field, the browser's native color
picker, and a grid of preset swatches. The popover is portalled to `<body>` and
anchored to the trigger, so it escapes the grid's scroll container and never
clips. It emits a normalized hex string and is the styled renderer over the
headless `createColorInput` core. Its label / hint / error chrome comes from
[SvField](sv-field.md).

<div data-docs-demo="304-color-input" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvColorInput } from '@svgrid/grid'
  let color = $state('#3b82f6')
</script>

<SvColorInput label="Brand color" bind:value={color} />
```

## Props

`SvColorInput` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop        | Type                       | Default     | Description                                       |
| ----------- | -------------------------- | ----------- | ------------------------------------------------- |
| `value`     | `string`                   | `#3b82f6`   | The hex color. Bindable with `bind:value`.        |
| `onChange`  | `(hex: string) => void`    | -           | Fires with the normalized hex on change.          |
| `palette`   | `string[]`                 | -           | Preset swatches shown in the popover.             |
| `autoOpen`  | `boolean`                  | `false`     | Focus the trigger and open on mount.              |
| `messages`  | `Partial<ColorMessages>`   | -           | Override the built-in popover strings.            |

`ColorMessages` is `{ dialog; picker; hex }`.

## Patterns

### Custom preset palette

Pass your brand's swatches as `palette` so the popover offers on-brand choices
first:

```svelte
<SvColorInput
  bind:value={accent}
  palette={['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444']}
/>
```

### Open immediately as a cell editor

Set `autoOpen` when mounting inside a grid cell so the popover appears the moment
editing starts:

```svelte
<SvColorInput bind:value={row.color} autoOpen />
```

### Live-retheme the grid from a swatch

The component emits a normalized hex, so wire `onChange` straight into the grid's
`--sg-accent` token for an instant theme preview:

```svelte
<script lang="ts">
  import { SvColorInput } from '@svgrid/grid'
  let accent = $state('#2563eb')
  function apply(hex: string) {
    document.documentElement.style.setProperty('--sg-accent', hex)
  }
</script>

<SvColorInput
  label="Grid accent"
  bind:value={accent}
  onChange={apply}
  palette={['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a']}
/>
```

Tip: `onChange` always hands you the normalized hex (whether the user typed it,
used the native picker, or clicked a preset), so you never have to sanitize the
value before storing it.

## Accessibility

- The trigger is a real `<button>` with a focus ring; the popover is
  `role="dialog"` with a `dialog` `aria-label` from `messages`.
- The hex field, native picker, and each palette chip carry their own
  `aria-label`s; the active swatch is outlined.
- The popover closes on outside pointer-down and repositions on scroll and
  resize, so it stays anchored to the swatch.

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvTextInput](sv-text-input.md) - the base single-line field.
- [SvTagsInput](sv-tags-input.md) - a chips-style value editor.
