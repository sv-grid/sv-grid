# SvCircularProgress

A circular ring progress indicator - determinate or spinning - with color
intents, sizing and thickness, and an optional center label or custom center
content.

`SvCircularProgress` is the ring form of [SvProgress](sv-progress.md): a
WAI-ARIA `progressbar` drawn as an SVG arc. Use it for compact completion
readouts in cards, buttons, and dashboards. Leave `value` off and set
`indeterminate` for a continuous spinner. Colors come from the grid's `--sg-*`
tokens, and the spin animation respects `prefers-reduced-motion`.

Related: [SvProgress](sv-progress.md) · [SvGauge](sv-gauge.md) · [Range & meters overview](range.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvCircularProgress` starter into your app:

<div data-docs-add="add circular-progress"></div>

Prefer to see it first? `npx @svgrid/ui try circular-progress` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvCircularProgress` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvCircularProgress } from '@svgrid/grid'
```

## Example

<div data-docs-demo="330-progress" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvCircularProgress } from '@svgrid/grid'
</script>

<SvCircularProgress value={72} showLabel />
<SvCircularProgress indeterminate size={28} color="accent" />
```

## Props

| Prop            | Type                                          | Default  | Description                                                    |
| --------------- | --------------------------------------------- | -------- | ------------------------------------------------------------- |
| `value`         | `number`                                      | `0`      | Current value, `0..max`. Ignored when `indeterminate`.       |
| `max`           | `number`                                      | `100`    | Value that represents a full ring.                           |
| `indeterminate` | `boolean`                                     | `false`  | Continuous spinning arc; drops the value ARIA.              |
| `size`          | `number`                                      | `48`     | Diameter in px.                                             |
| `thickness`     | `number`                                      | `5`      | Ring stroke width in px.                                    |
| `color`         | `accent` \| `success` \| `warning` \| `danger` | `accent` | Arc intent, mapped to `--sg-*` tokens.                     |
| `showLabel`     | `boolean`                                     | `false`  | Percentage label in the center (determinate only).         |
| `formatLabel`   | `(value, max) => string`                      | -        | Custom label text; defaults to rounded percent.            |
| `ariaLabel`     | `string`                                      | -        | Accessible name for the progressbar.                       |
| `children`      | `Snippet`                                     | -        | Custom center content; overrides `showLabel`.              |

## Examples

### Percentage ring

The default center label shows a rounded percent. Size and thickness scale it to
fit a card or a KPI tile:

```svelte
<SvCircularProgress value={done} max={total} size={72} thickness={7} showLabel />
```

### Custom center content

Pass a `children` snippet to put anything in the middle - an icon, a fraction,
or a stacked label - instead of the percent:

```svelte
<SvCircularProgress value={4} max={5} size={64}>
  <strong>4/5</strong>
</SvCircularProgress>
```

### Inline spinner

Set `indeterminate` at a small size for a button or toolbar busy indicator:

```svelte
<SvCircularProgress indeterminate size={20} thickness={3} ariaLabel="Saving" />
```

### Countdown ring

Bind `value` to a ticking count and the arc shrinks as time runs out; a
`children` snippet shows the seconds left, and `color` turns danger near zero:

```svelte
<script lang="ts">
  import { SvCircularProgress } from '@svgrid/grid'
  let left = $state(30)
  const total = 30
</script>

<SvCircularProgress
  value={left} max={total} size={72}
  color={left <= 5 ? 'danger' : 'accent'}
>
  <strong>{left}s</strong>
</SvCircularProgress>
```

Tip: a `children` snippet overrides `showLabel`, so put the fraction or countdown
in the snippet and leave `showLabel` off.

## Accessibility

- Renders `role="progressbar"` with `aria-valuemin` / `aria-valuemax` /
  `aria-valuenow` and an `aria-valuetext` label when determinate.
- Indeterminate mode omits the value attributes so it announces as busy.
- Set `ariaLabel` to name the task; custom `children` are visual only.

## See also

- [Feedback overview](feedback.md) - the status and feedback family at a glance.
- [SvProgress](sv-progress.md) - the linear bar form of the same control.
- [SvGauge](sv-gauge.md) - a radial dial for a measured value.
