# SvGauge

A radial arc gauge that renders a value within a range, with optional colored
threshold bands, a needle, and a center label.

`SvGauge` is a read-only display control - a classic dashboard dial for a single
KPI. Its arc and needle geometry plus `role="meter"` ARIA live in the headless
`createGauge` core; this component is one styled SVG renderer over it. Pass
`bands` to paint red/amber/green zones along the arc, or leave them off for a
plain accent fill up to the value. Colors come from the grid's `--sg-*` tokens.

Related: [SvSlider](sv-slider.md) · [SvCircularProgress](sv-circular-progress.md) · [Range & meters overview](range.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvGauge` starter into your app:

<div data-docs-add="add gauge"></div>

Prefer to see it first? `npx @svgrid/ui try gauge` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvGauge` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGauge } from '@svgrid/grid'

  // The bound value behind each example below.
  let cpu = $state(0)
  let used = $state(0)
  let score = $state(0)
</script>
```

```ts
import { SvGauge } from '@svgrid/grid'
```

## Example

<div data-docs-demo="319-gauge" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvGauge } from '@svgrid/grid'
</script>

<SvGauge value={72} unit="%" />

<SvGauge
  value={118}
  min={0}
  max={200}
  unit=" km/h"
  bands={[
    { from: 0, to: 90, color: '#16a34a' },
    { from: 90, to: 150, color: '#f59e0b' },
    { from: 150, to: 200, color: '#dc2626' },
  ]}
/>
```

## Props

| Prop          | Type                              | Default | Description                                                       |
| ------------- | --------------------------------- | ------- | ----------------------------------------------------------------- |
| `value`       | `number`                          | `0`     | The value to display; clamped to `[min, max]`.                    |
| `min`         | `number`                          | `0`     | Lower bound of the arc.                                           |
| `max`         | `number`                          | `100`   | Upper bound of the arc.                                           |
| `sweep`       | `number`                          | `270`   | Arc sweep in degrees (e.g. `180` for a half gauge).              |
| `bands`       | `{ from; to; color }[]`           | `[]`    | Colored threshold zones along the arc.                           |
| `needle`      | `boolean`                         | `true`  | Draw the needle and center hub.                                  |
| `label`       | `string`                          | -       | Center label; defaults to the formatted value.                  |
| `unit`        | `string`                          | `''`    | Suffix appended to the value in the default label.              |
| `size`        | `number`                          | `180`   | Overall diameter in px.                                          |
| `thickness`   | `number`                          | `14`    | Arc stroke width in px.                                          |
| `formatValue` | `(v: number) => string`           | -       | Formats the center value (overridden by `label`).               |
| `ariaLabel`   | `string`                          | -       | Accessible name for the meter.                                  |
| `dir`         | `ltr` \| `rtl` \| `auto`          | `auto`  | Text direction for the center label / unit.                     |

## Examples

### Threshold bands

Pass `bands` covering the full range to color the arc by zone. Bands replace the
plain accent fill, so the dial reads good/warning/critical at a glance:

```svelte {runnable}
<SvGauge
  value={cpu} unit="%"
  bands={[
    { from: 0, to: 60, color: '#16a34a' },
    { from: 60, to: 85, color: '#f59e0b' },
    { from: 85, to: 100, color: '#dc2626' },
  ]}
/>
```

### Half gauge, no needle

Drop `sweep` to `180` for a semicircle and turn the `needle` off for a compact
progress-style tile with just the value arc:

```svelte {runnable}
<SvGauge value={used} max={512} sweep={180} needle={false} unit=" GB" />
```

### Custom center label

Override the auto label to show something other than the raw number - a rating,
a status word, or a formatted metric:

```svelte {runnable}
<SvGauge value={score} max={10} label={`${score}/10`} />
```

### Live KPI dial

Bind `value` to reactive state and the arc tracks the number as it changes; add
`formatValue` to render the reading in its own units and `ariaLabel` to name it:

```svelte {runnable}
<script lang="ts">
  import { SvGauge } from '@svgrid/grid'
  let rpm = $state(3200)
</script>

<SvGauge
  value={rpm}
  min={0} max={8000}
  sweep={240}
  unit=" rpm"
  ariaLabel="Engine RPM"
  formatValue={(v) => v.toLocaleString()}
  bands={[
    { from: 0, to: 5500, color: '#16a34a' },
    { from: 5500, to: 7000, color: '#f59e0b' },
    { from: 7000, to: 8000, color: '#dc2626' },
  ]}
/>
```

Tip: `value` is clamped to `[min, max]`, so a spike past `max` pins the needle at
full scale rather than sweeping past the end of the arc.

## Accessibility

- The root carries `role="meter"` with value/min/max supplied by the
  `createGauge` core, so assistive tech reads it as a live measurement.
- Set `ariaLabel` to name what the gauge measures - the visual label alone is
  not announced as the meter's name.
- Purely presentational: it is a display, not a control, and takes no focus.

## More examples

### Gauge - headless

createGauge drives styled SvGauge plus a custom SVG meter sharing the same arc / needle geometry.

<div data-docs-demo="282-headless-gauge" data-height="420"></div>

### Gauge dial (KPI dashboard)

type: gauge renders a semicircle with track + value arcs, optional red/amber/green range bands, and a target tick. Click any row in the KPI grid to drive the dial; bands auto-flip direction based on whether higher or lower is better.

<div data-docs-demo="163-chart-gauge" data-height="560"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte
<script lang="ts">
  import { SvGauge } from '@svgrid/grid'

  let cpu = $state(1)
</script>

<SvGauge value={cpu} size="sm" />
<SvGauge value={cpu} size="md" />
<SvGauge value={cpu} size="lg" />
```

## See also

- [Range overview](range.md) - the range-control family at a glance.
- [SvSlider](sv-slider.md) - the interactive sibling for choosing a value.
- [SvCircularProgress](sv-circular-progress.md) - a ring for task completion.
