# SvSparkline

A tiny inline chart - line, area, bar, or win/loss - drawn from a plain number
array, with no chart library.

`SvSparkline` is a thin SVG renderer over the pure `buildSparkline` geometry
(the same code behind the grid's sparkline cell), so a trend fits inline next to
a number, inside a table cell, or in a [SvStat](sv-stat.md) card. It defaults to
the grid's `--sg-accent` color and sizes to a compact 88x22 by default. Pass
`negativeColor` for bar and win/loss charts that split positive from negative.

Related: [SvStat](sv-stat.md) · [SvGauge](sv-gauge.md) · [Range & meters overview](range.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvSparkline` starter into your app:

<div data-docs-add="add sparkline"></div>

Prefer to see it first? `npx @svgrid/ui try sparkline` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvSparkline` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvSparkline } from '@svgrid/grid'
```

## Example

```svelte
<script lang="ts">
  import { SvSparkline } from '@svgrid/grid'
</script>

<SvSparkline data={[3, 7, 4, 9, 6, 11, 8]} type="area" />
<SvSparkline data={[5, -2, 4, -1, 3, 6, -3]} type="winloss" />
```

## Props

| Prop            | Type                                        | Default  | Description                                                      |
| --------------- | ------------------------------------------- | -------- | --------------------------------------------------------------- |
| `data`          | `ReadonlyArray<number>`                     | required | The series to plot.                                            |
| `type`          | `line` \| `area` \| `bar` \| `winloss`      | `line`   | Chart form.                                                    |
| `width`         | `number`                                    | `88`     | SVG width in px.                                               |
| `height`        | `number`                                    | `22`     | SVG height in px.                                              |
| `color`         | `string`                                    | -        | Stroke/fill color; defaults to `--sg-accent`.                 |
| `negativeColor` | `string`                                    | -        | Color for negative bars (bar / win-loss).                     |
| `lineWidth`     | `number`                                    | -        | Stroke width for line and area.                               |
| `min`           | `number`                                    | -        | Fix the low end of the scale instead of deriving it.          |
| `max`           | `number`                                    | -        | Fix the high end of the scale instead of deriving it.         |
| `lastPoint`     | `boolean`                                   | `true`   | End-cap dot on the last point (line / area).                  |
| `ariaLabel`     | `string`                                    | -        | Accessible name; defaults to `"sparkline"`.                   |

## Examples

### Chart types

Switch `type` to match the data. `line` and `area` suit continuous trends; `bar`
compares discrete values; `winloss` flattens to up/down bars for streaks:

```svelte
<SvSparkline data={weekly} type="line" />
<SvSparkline data={weekly} type="area" />
<SvSparkline data={deltas} type="bar" negativeColor="#dc2626" />
```

### Shared scale across a column

Fix `min` and `max` so several sparklines in a table share one scale and stay
visually comparable row to row:

```svelte
{#each rows as r}
  <SvSparkline data={r.trend} min={0} max={peak} />
{/each}
```

### Inside a stat card

Sparklines slot straight into [SvStat](sv-stat.md)'s `chart` snippet for a KPI
with a trend:

```svelte
<SvStat label="Signups" value="1,284" delta={8.2}>
  {#snippet chart()}<SvSparkline data={trend} type="area" />{/snippet}
</SvStat>
```

### Live-updating trend

Keep a fixed-length window of recent readings in `$state` and the chart redraws
as you push new points - a lightweight live monitor:

```svelte
<script lang="ts">
  import { SvSparkline } from '@svgrid/grid'
  let series = $state<number[]>([])
  function push(v: number) {
    series = [...series, v].slice(-40) // keep the last 40 readings
  }
</script>

<SvSparkline data={series} type="line" width={160} min={0} max={100} ariaLabel="CPU load" />
```

Tip: fix `min` and `max` for a live series so the baseline stays put instead of
rescaling every time a new high or low arrives.

## Accessibility

- Renders `role="img"` with an `aria-label` so the chart announces as a single
  image rather than a run of shapes.
- Set a descriptive `ariaLabel` (e.g. the metric and direction); the default is
  just `"sparkline"`.
- Purely decorative in most layouts - pair it with the numeric value it trends.

## See also

- [Feedback overview](feedback.md) - the status and display family at a glance.
- [SvStat](sv-stat.md) - the KPI card that hosts a sparkline.
- [SvGauge](sv-gauge.md) - a radial display for a single value.
