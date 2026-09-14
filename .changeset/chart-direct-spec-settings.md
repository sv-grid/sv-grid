---
"@svgrid/grid": patch
---

Apply `valueFormat`, `logScale`, `timeAxis` and the chart locale to the
row-reading chart types.

Scatter, gauge and box plot build their spec directly from the rows rather
than through `rowsToChartSpec`, on a path that returned before the block
applying those settings. So `valueFormat: 'currency'` on a gauge silently did
nothing while the same setting on a bar chart worked, which reads as the
setting being broken rather than type-specific.

The settings now go through one helper both paths call, so they cannot drift
apart again. The series-shaped options (`trend`, `averageLine`, `seriesTypes`,
`seriesAxes`) stay on the aggregated path: a direct spec does not have the
series shape they read.
