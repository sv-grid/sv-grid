---
noindex: true
---

# Heatmap-tinted numeric cells

> Live in [demo 60-pivot-expandable](https://svgrid.com/demos/60-pivot-expandable/).

<div data-docs-demo="60-pivot-expandable" data-height="480"></div>


## When

Bucket cell values into red/amber/neutral/green tints based on per-column min/max.

## How

Key API surface:

- `cellClass returns heat-1..heat-5 bucket classes`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## The same numbers as a heat map chart

Tinted cells read one number at a time; a heat map chart reads the whole
grid of them at once. `rowsToChartSpec` with a `series` column and
`type: 'heatmap'` builds it from the same rows:

```svelte {runnable}
<script lang="ts">
  import { SvChart, rowsToChartSpec } from '@svgrid/grid'
  const rows = [
    { region: 'North', quarter: 'Q1', revenue: 42 }, { region: 'North', quarter: 'Q2', revenue: 61 }, { region: 'North', quarter: 'Q3', revenue: 55 },
    { region: 'South', quarter: 'Q1', revenue: 30 }, { region: 'South', quarter: 'Q2', revenue: 38 }, { region: 'South', quarter: 'Q3', revenue: 72 },
    { region: 'East', quarter: 'Q1', revenue: 18 }, { region: 'East', quarter: 'Q2', revenue: 24 }, { region: 'East', quarter: 'Q3', revenue: 29 },
  ]
  const spec = { ...rowsToChartSpec(rows, { type: 'bar', category: 'quarter', value: 'revenue', series: 'region' }), type: 'heatmap' as const, height: 220 }
</script>

<SvChart {spec} />
```

Every chart type the engine draws, on one page:

<div data-docs-demo="435-chart-type-gallery" data-height="600"></div>

## See also

- [Demo 60-pivot-expandable source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/60-pivot-expandable.svelte)
- [Demo 60-pivot-expandable prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/60-pivot-expandable.md) - drop into an LLM context window
- [Recipes index](./index.md)
