# SvStat

A KPI / metric card: a label, a big value, and an optional delta with an
auto-colored up/down trend, plus slots for an icon and an inline chart.

`SvStat` is the dashboard building block. Give it a `label` and `value`, and
optionally a `delta` - a number auto-signs and infers the trend (green up, red
down), while `invert` flips the coloring for "lower is better" metrics like
error rate or latency. The `icon` and `chart` snippets host a glyph and an
inline [SvSparkline](sv-sparkline.md). Colors come from the grid's `--sg-*`
tokens.

Related: [SvSparkline](sv-sparkline.md) · [SvGauge](sv-gauge.md) · [Range & meters overview](range.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvStat` starter into your app:

<div data-docs-add="add stat"></div>

Prefer to see it first? `npx @svgrid/ui try stat` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvStat` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvSparkline, SvStat } from '@svgrid/grid'
</script>
```

```ts
import { SvStat } from '@svgrid/grid'
```

## Example

<div data-docs-demo="339-status-display" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvStat } from '@svgrid/grid'
</script>

<SvStat label="Revenue" value="$48.2k" delta={12.4} hint="vs last month" />
<SvStat label="Error rate" value="0.8%" delta={-1.2} invert hint="vs last week" />
```

## Props

| Prop     | Type                       | Default  | Description                                                             |
| -------- | -------------------------- | -------- | ---------------------------------------------------------------------- |
| `label`  | `string`                   | required | The metric name, shown above the value.                               |
| `value`  | `string \| number`         | required | The headline value (preformat strings like `"$48.2k"`).               |
| `delta`  | `string \| number`         | -        | A number auto-signs and infers trend, or pass a preformatted string.  |
| `trend`  | `up` \| `down` \| `flat`   | -        | Override the trend inferred from a numeric `delta`.                    |
| `hint`   | `string`                   | -        | Context after the delta (e.g. `"vs last month"`).                     |
| `invert` | `boolean`                  | `false`  | Treat a downward delta as good (green) - error rate, latency.         |
| `icon`   | `Snippet`                  | -        | Glyph slot in the card header.                                        |
| `chart`  | `Snippet`                  | -        | Inline chart slot, aligned to the end of the footer.                 |

## Examples

### Trend coloring

A numeric `delta` auto-signs (`+12.4%`) and colors itself - green for up, red for
down. Use `invert` where a drop is the win, and the colors flip:

```svelte {runnable}
<SvStat label="Signups" value="1,284" delta={8.2} />
<SvStat label="Latency" value="180ms" delta={-6.1} invert />
```

### Preformatted delta

Pass a string `delta` when you want full control of the text, and set `trend`
explicitly to drive the arrow and color:

```svelte {runnable}
<SvStat label="Uptime" value="99.98%" delta="+0.02pt" trend="up" />
```

### Icon and sparkline

Fill the `icon` and `chart` snippets to make a rich tile - a glyph in the header
and a trend line in the footer:

```svelte
<SvStat label="Active users" value="8,420" delta={4.3}>
  {#snippet icon()}<UsersIcon />{/snippet}
  {#snippet chart()}<SvSparkline data={trend} type="area" />{/snippet}
</SvStat>
```

### Dashboard row

`SvStat` cards tile cleanly in a CSS grid for a KPI strip; feed each from your
data and let a numeric `delta` sign and color itself:

```svelte {runnable}
<script lang="ts">
  import { SvStat } from '@svgrid/grid'
  const kpis = [
    { label: 'MRR', value: '$92.4k', delta: 5.1 },
    { label: 'Churn', value: '2.1%', delta: -0.4, invert: true },
    { label: 'Active', value: '12,908', delta: 3.7 },
  ]
</script>

<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px">
  {#each kpis as k}
    <SvStat label={k.label} value={k.value} delta={k.delta} invert={k.invert} />
  {/each}
</div>
```

Tip: pass `trend="flat"` to force the neutral gray arrow when a change is not
meaningfully up or down, regardless of the `delta` sign.

## Accessibility

- The trend arrow is `aria-hidden`; the delta text and `hint` carry the meaning
  for screen readers.
- Prefer a preformatted, readable `value` (e.g. `"$48.2k"`) so it announces the
  way you intend.
- The `icon` slot is decorative and marked `aria-hidden` - keep meaning in the
  `label` and `value`.

## See also

- [Feedback overview](feedback.md) - the status and display family at a glance.
- [SvSparkline](sv-sparkline.md) - the inline trend chart for the `chart` slot.
- [SvGauge](sv-gauge.md) - a radial display for a single measured value.
