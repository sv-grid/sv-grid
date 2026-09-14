---
noindex: true
---

# Sparkline cell renderer

> Live in [demo 11-stock-market](https://svgrid.com/demos/11-stock-market/).

<div data-docs-demo="11-stock-market" data-height="480"></div>


## When

In-cell mini-charts of a value series, rendered via inline SVG.

## How

Key API surface:

- `renderSnippet(SparklineCell, { points: row.trend })`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## The component

`SvSparkline` is the renderer the demo uses, exported from the package: a
line, bar or area of a number series at cell size, with the last point
marked.

```svelte {runnable}
<script lang="ts">
  import { SvSparkline } from '@svgrid/grid'
  const trend = [4, 6, 5, 8, 7, 9, 12, 10, 13, 15]
  const dips = [3, 1, -2, -1, 2, 4, 1, -3, 2, 5]
</script>

<p><SvSparkline data={trend} type="line" width={120} height={28} /> line</p>
<p><SvSparkline data={trend} type="area" width={120} height={28} /> area</p>
<p><SvSparkline data={dips} type="bar" width={120} height={28} negativeColor="#ef4444" /> bars, negatives in red</p>
```

When a cell's trend deserves a full chart, the same numbers feed `SvChart`
with markers and a reference line:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  const trend = [4, 6, 5, 8, 7, 9, 12, 10, 13, 15]
  const spec: ChartSpec = {
    type: 'line',
    categories: trend.map((_, i) => `W${i + 1}`),
    series: [{ label: 'Units', values: trend, marker: 'diamond' }],
    referenceLines: [{ value: 10, label: 'target', dashed: true }],
    height: 200,
  }
</script>

<SvChart {spec} legend={false} />
```

## See also

- [Demo 11-stock-market source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/11-stock-market.svelte)
- [Demo 11-stock-market prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/11-stock-market.md) - drop into an LLM context window
- [Recipes index](./index.md)
