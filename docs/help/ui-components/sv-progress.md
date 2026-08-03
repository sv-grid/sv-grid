# SvProgress

A linear progress bar - determinate or indeterminate - with color intents,
sizes, an optional percentage label, a striped fill, and a secondary buffer
track.

`SvProgress` renders a WAI-ARIA `progressbar` for any 0-to-`max` measure: file
uploads, form completion, quota usage. Leave `value` off and set
`indeterminate` for an unknown-duration animated bar. Colors come from the
grid's `--sg-*` tokens, and every animation respects
`prefers-reduced-motion`.

Related: [SvCircularProgress](sv-circular-progress.md) · [SvSkeleton](sv-skeleton.md) · [Range & meters overview](range.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvProgress` starter into your app:

<div data-docs-add="add progress"></div>

Prefer to see it first? `npx @svgrid/ui try progress` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvProgress` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvProgress } from '@svgrid/grid'
```

## Example

<div data-docs-demo="330-progress" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvProgress } from '@svgrid/grid'
</script>

<SvProgress value={64} showLabel />
<SvProgress value={30} color="warning" striped />
<SvProgress indeterminate color="accent" />
```

## Props

| Prop          | Type                                          | Default  | Description                                                     |
| ------------- | --------------------------------------------- | -------- | -------------------------------------------------------------- |
| `value`       | `number`                                      | `0`      | Current value, `0..max`. Ignored when `indeterminate`.        |
| `max`         | `number`                                      | `100`    | Value that represents 100%.                                    |
| `indeterminate` | `boolean`                                   | `false`  | Unknown-duration animated bar; drops the value ARIA.          |
| `buffer`      | `number`                                      | -        | Buffered/secondary value (e.g. streamed-ahead), `0..max`.     |
| `color`       | `accent` \| `success` \| `warning` \| `danger` | `accent` | Fill intent, mapped to `--sg-*` tokens.                       |
| `size`        | `sm` \| `md` \| `lg`                          | `md`     | Track height.                                                 |
| `showLabel`   | `boolean`                                     | `false`  | Percentage label after the bar (determinate only).           |
| `formatLabel` | `(value, max) => string`                      | -        | Custom label text; defaults to rounded percent.              |
| `striped`     | `boolean`                                     | `false`  | Animated diagonal candy-stripe overlay on the fill.          |
| `ariaLabel`   | `string`                                      | -        | Accessible name for the progressbar.                         |

## Examples

### Upload with a buffer track

Pass `buffer` alongside `value` to show streamed-ahead progress behind the main
fill - the classic "downloaded vs buffered" pattern:

```svelte
<SvProgress value={played} buffer={loaded} max={duration} />
```

### Indeterminate work

When you cannot measure progress, set `indeterminate`. The bar animates
continuously and drops the value ARIA so screen readers announce it as busy, not
a specific percentage:

```svelte
<SvProgress indeterminate ariaLabel="Loading results" />
```

### Custom label

Show absolute units instead of a percent with `formatLabel`:

```svelte
<SvProgress
  value={done} max={total} showLabel
  formatLabel={(v, m) => `${v} / ${m}`}
/>
```

### Color by threshold

Drive `color` from the value so the bar shifts intent as it fills - accent while
low, warning then danger as it nears the cap (a quota or storage meter):

```svelte
<script lang="ts">
  import { SvProgress } from '@svgrid/grid'
  let used = $state(72)
  const intent = $derived(used < 70 ? 'accent' : used < 90 ? 'warning' : 'danger')
</script>

<SvProgress value={used} color={intent} showLabel ariaLabel="Storage used" />
```

Tip: `showLabel` and the value ARIA are both dropped in `indeterminate` mode, so
reserve the label for bars that actually have a `value` to report.

## Accessibility

- Renders `role="progressbar"` with `aria-valuemin` / `aria-valuemax` /
  `aria-valuenow` and an `aria-valuetext` label when determinate.
- Indeterminate mode omits the value attributes so it announces as busy rather
  than a false percentage.
- Set `ariaLabel` to name what is progressing when there is no nearby text.

## See also

- [Feedback overview](feedback.md) - the status and feedback family at a glance.
- [SvCircularProgress](sv-circular-progress.md) - the ring form of the same idea.
- [SvSkeleton](sv-skeleton.md) - placeholder shimmer while content loads.
