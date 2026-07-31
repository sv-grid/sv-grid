# Range & feedback

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add range"></div>

They all ship free in the `@svgrid/grid` package, so you can also install it and
import them directly:

<div data-docs-install="@svgrid/grid"></div>

## SvSlider

A single or dual-thumb range slider (ARIA slider) with steps, tick marks,
keyboard and pointer drag; horizontal or vertical.

```svelte
<!-- single -->
<SvSlider value={volume} onChange={(v) => (volume = v)} showValue ticks={5} />

<!-- range -->
<SvSlider value={[200, 750]} range min={0} max={1000} step={50}
  onChange={(v) => (priceRange = v)} showValue />
```

Props: `value` (number | [number, number]), `range`, `onChange`, `min`, `max`,
`step`, `ticks` (count or values[]), `showValue`, `orientation`
(`horizontal` | `vertical`), `formatValue`, `disabled`. Keyboard: arrows step,
PageUp/Down step ×10, Home/End jump to bounds.

## SvGauge

A radial arc gauge (SVG) rendering a value within `[min, max]`, with optional
colored threshold bands, a needle and a center label. A display control.

```svelte
<SvGauge value={72} unit="°" />

<SvGauge value={72} bands={[
  { from: 0, to: 40, color: '#3b82f6' },
  { from: 40, to: 75, color: '#16a34a' },
  { from: 75, to: 100, color: '#dc2626' },
]} />
```

Props: `value`, `min`, `max`, `sweep` (degrees, default 270), `bands`, `needle`,
`label`, `unit`, `size`, `thickness`, `formatValue`. Exposes ARIA `meter` with a
clamped `aria-valuenow`.

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvSlider](./sv-slider.md) - a single or dual-thumb range slider.
- [SvGauge](./sv-gauge.md) - a radial arc gauge for a value.
- [SvProgress](./sv-progress.md) - a linear progress bar, determinate or indeterminate.
- [SvCircularProgress](./sv-circular-progress.md) - a circular ring progress indicator.
- [SvSparkline](./sv-sparkline.md) - a tiny inline line/area/bar chart.
- [SvStat](./sv-stat.md) - a KPI card with an auto-coloured delta.
