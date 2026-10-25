# `@svgrid/grid` · `chart-pivot.ts`

Auto-generated. Source: `packages\grid\src\chart-pivot.ts`.

### `type PivotResultLike`

What {@link pivotResultToChartSpec} reads: the engine's rows and column tree, loosely typed so either package's result fits.

```ts
export type PivotResultLike = {
  rows: ReadonlyArray<Record<string, unknown>>
  columns: ReadonlyArray<unknown>
}
```

### `type PivotResultChartOptions`

Options for {@link pivotResultToChartSpec}.

```ts
export type PivotResultChartOptions = {
  /** Chart type. Default `'bar'`. A type that reads rows directly (scatter, gauge, box plot, histogram, ranges, bullet, candles) cannot be built from a pivot; see {@link pivotChartType}. */
  type?: ChartType
  /** Stack the series. Default false. */
  stacked?: boolean
  /** Stack to 100%. Implies `stacked`. */
  stacked100?: boolean
  /** Include the grand-total column / row as a series / category. Default false. */
  includeTotals?: boolean
  /** Cap the number of categories (row leaves) charted. */
  maxCategories?: number
  /**
   * The measure's cell format, carried to the chart as `valueFormat` (with
   * `currency` and `locale`), so a cell the table shows as "$469,662" charts
   * as "$470k" on the axis and "$469,662" in the tooltip rather than "470k".
   * With several measures in different formats, pass none.
   */
  format?: CellFormatConfig
  /**
   * The layout's measures, each with its cell `format`, when the caller has
   * them rather than one format: used as `format` when they agree, ignored
   * when a layout mixes a currency and a count (a "$" on the count would be
   * wrong).
   */
  measures?: ReadonlyArray<{ format?: unknown }>
  /** Name the value axis. Default: the measure's label when the layout has one measure, nothing otherwise; `null` for none. */
  yAxisTitle?: string | null
  /** Series colours, when the caller has a palette. */
  palette?: string[]
}
```

### `function pivotChartType`

The type a pivot chart can draw: the one asked for, or a bar chart when that type cannot be built from a pivot.

```ts
export function pivotChartType(type: ChartType | undefined): ChartType
```

### `function pivotFilterColumn`

The grid column a click on a pivot chart filters: the innermost row
dimension, when the grid has a column for that field. A category of the
chart is one value of it, so a value filter there narrows the source rows
and the pivot with them.

```ts
export function pivotFilterColumn(
  rowFields: ReadonlyArray<string>,
  columns: ReadonlyArray<{ id: string }>,
  fieldOf: (id: string) => string | undefined,
): string | null
```

### `function bucketsToChartSpec`

Server aggregates as a spec: the grid panel's `charting.getAggregate` hands
back `{ category, series?, value }` buckets and this lays them out as one
series per distinct `series` (or a single one), categories in first-seen
order, a missing cell as 0.

```ts
export function bucketsToChartSpec(
  buckets: ReadonlyArray<{ category: string; series?: string; value: number }>,
  type: ChartType,
  hasSeries: boolean,
): ChartSpec
```

### `function pivotResultToChartSpec`

A computed pivot as a chart spec. Row leaves become the categories (nested
rows a grouped axis), column leaves the series, totals are left out unless
asked for, the measure's format and name come along, and an empty cell is
a gap.

```ts
export function pivotResultToChartSpec(result: PivotResultLike, opts: PivotResultChartOptions = {}): ChartSpec
```
