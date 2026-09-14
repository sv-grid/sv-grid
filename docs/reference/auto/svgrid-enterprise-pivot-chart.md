# `@svgrid/enterprise` · `pivot-chart.ts`

Auto-generated. Source: `packages\enterprise\src\pivot-chart.ts`.

### `type PivotChartOptions`

Options for {@link pivotToChartSpec}: the chart type and stacking, whether totals chart, a category cap, the measure's format and the value-axis name.

```ts
export type PivotChartOptions = {
  /** Chart type. Default `'bar'`. */
  type?: ChartType
  /** Stack the series. Default false. */
  stacked?: boolean
  /** Include the grand-total column / row as a series / category. Default false. */
  includeTotals?: boolean
  /** Cap the number of categories (row leaves) charted. */
  maxCategories?: number
  /**
   * The measure's cell format, carried to the chart as `valueFormat` (with
   * `currency` and `locale`), so a cell the table shows as "$469,662" charts
   * as "$470k" on the axis and "$469,662" in the tooltip rather than "470k".
   * The designer passes the first value chip's format; with several
   * measures in different formats, pass none and the chart formats plainly.
   */
  format?: CellFormatConfig
  /**
   * Name the value axis. Default: the measure's label when the layout has
   * one measure, nothing otherwise.
   */
  yAxisTitle?: string | null
}
```

### `function pivotToChartSpec`

A computed pivot as a `ChartSpec` for the free chart: row leaves become
categories (nested rows a grouped axis), column leaves the series, totals
left out unless asked for, the measure's format carried over and an empty
cell read as a gap. The designer's Chart view is this function, and the
grid's own Chart panel runs the same mapping (`pivotResultToChartSpec` in
`@svgrid/grid`) in pivot mode.

```ts
export function pivotToChartSpec<TFeatures extends TableFeatures>(
  result: PivotResult<TFeatures>,
  opts: PivotChartOptions = {},
): ChartSpec {
  return pivotResultToChartSpec(result as unknown as PivotResultLike, opts)
}
```
