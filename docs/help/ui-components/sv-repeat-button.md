# SvRepeatButton

A button that keeps firing while you hold it down - after an initial delay, then
at a steady interval.

`SvRepeatButton` is the press-and-hold primitive behind steppers, spinners, and
volume or seek controls. A single click fires `onclick` once; holding it fires
once immediately, waits `delay` ms, then repeats every `interval` ms until you
release, leave the button, or lift the pointer anywhere on the page. It shares
[SvButton](sv-button.md)'s visual language (variants and sizes) so it drops into
a toolbar unchanged.

Related: [SvButton](sv-button.md) · [SvButtonGroup](sv-button-group.md) · [Buttons & toggles overview](buttons.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvRepeatButton` starter into your app:

<div data-docs-add="add repeat-button"></div>

Or install the package and import it directly. `SvRepeatButton` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvRepeatButton } from '@svgrid/grid'
```

## Example

<div data-docs-demo="306-repeat-button" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvRepeatButton } from '@svgrid/grid'
  let qty = $state(1)
</script>

<SvRepeatButton ariaLabel="Decrease" onclick={() => (qty = Math.max(0, qty - 1))}>-</SvRepeatButton>
<span>{qty}</span>
<SvRepeatButton ariaLabel="Increase" onclick={() => (qty += 1)}>+</SvRepeatButton>
```

## Props

| Prop        | Type                                              | Default       | Description                                                        |
| ----------- | ------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| `onclick`   | `() => void`                                      | -             | Fires once per click, then repeatedly while held.                |
| `delay`     | `number`                                          | `300`         | Milliseconds to wait before repeats begin.                       |
| `interval`  | `number`                                          | `60`          | Milliseconds between repeats (floored at 16ms).                  |
| `disabled`  | `boolean`                                         | `false`       | Blocks clicks and repeats, and dims the control.                 |
| `size`      | `sm` \| `md` \| `lg`                              | `md`          | Padding and font size, shared with the rest of the kit.          |
| `variant`   | `primary` \| `secondary` \| `outline` \| `ghost`  | `secondary`   | Visual weight, matching [SvButton](sv-button.md).                |
| `ariaLabel` | `string`                                          | -             | Accessible name for icon-only or glyph buttons.                  |
| `children`  | `Snippet`                                         | -             | The button label.                                                |

## Examples

### Number stepper

Pair two repeat buttons around a value so a long press ramps it quickly:

```svelte
<SvRepeatButton onclick={() => (qty -= 1)} ariaLabel="Decrease">-</SvRepeatButton>
<SvRepeatButton onclick={() => (qty += 1)} ariaLabel="Increase">+</SvRepeatButton>
```

### Faster acceleration

Lower `delay` and `interval` for a control that ramps sooner and moves faster,
such as a seek or volume button:

```svelte
<SvRepeatButton delay={200} interval={30} onclick={() => (volume += 1)}>Vol +</SvRepeatButton>
```

### Icon-only

Omit the label and pass `ariaLabel` so the button still announces:

```svelte
<SvRepeatButton ariaLabel="Scroll down" variant="ghost" onclick={scrollDown}>▼</SvRepeatButton>
```

### Zoom control with clamping

Because `onclick` runs on every repeat, clamp the value inside the handler so a
long hold stops cleanly at the limits instead of running past them:

```svelte
<script lang="ts">
  import { SvRepeatButton } from '@svgrid/grid'
  let zoom = $state(100)
  const clamp = (n: number) => Math.min(400, Math.max(25, n))
</script>

<SvRepeatButton variant="outline" ariaLabel="Zoom out" onclick={() => (zoom = clamp(zoom - 5))}>-</SvRepeatButton>
<span>{zoom}%</span>
<SvRepeatButton variant="outline" ariaLabel="Zoom in" onclick={() => (zoom = clamp(zoom + 5))}>+</SvRepeatButton>
```

## Accessibility

- Renders a native `<button type="button">`, so focus and `Tab` order are the
  browser's own.
- `Enter` and `Space` fire `onclick` once (key auto-repeat is ignored); the
  press-and-hold acceleration is a pointer gesture.
- Releasing the pointer anywhere, leaving the button, or a pointer cancel all
  stop the repeat, so it can never run away.
- Icon-only buttons must set `ariaLabel`.

## See also

- [SvButton](sv-button.md) - the base button this shares its look with.
- [SvButtonGroup](sv-button-group.md) - a segmented set of buttons.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
