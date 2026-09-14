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
export function pivotChartType(type: ChartType | undefined): ChartType {
  return !type || UNSHAPED.has(type) ? 'bar' : type
}
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
): string | null {
  const field = rowFields[rowFields.length - 1]
  return (field && columns.find((c) => fieldOf(c.id) === field)?.id) || null
}
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
): ChartSpec {
  const cats: string[] = []
  const catIdx = new Map<string, number>()
  const seriesMap = new Map<string, number[]>()
  for (const b of buckets) {
    let ci = catIdx.get(b.category)
    if (ci === undefined) {
      ci = cats.length
      catIdx.set(b.category, ci)
      cats.push(b.category)
    }
    const key = hasSeries ? (b.series ?? '') : 'value'
    let arr = seriesMap.get(key)
    if (!arr) {
      arr = []
      seriesMap.set(key, arr)
    }
    arr[ci] = (arr[ci] ?? 0) + b.value
  }
  return {
    type,
    categories: cats,
    series: [...seriesMap.entries()].map(([label, values]) => ({ label, values: cats.map((_, i) => values[i] ?? 0) })),
  }
}
```

### `function pivotResultToChartSpec`

A computed pivot as a chart spec. Row leaves become the categories (nested
rows a grouped axis), column leaves the series, totals are left out unless
asked for, the measure's format and name come along, and an empty cell is
a gap.

```ts
export function pivotResultToChartSpec(result: PivotResultLike, opts: PivotResultChartOptions = {}): ChartSpec {
  const type = pivotChartType(opts.type)

  // Category rows: the row-axis leaves. Fall back to the grand-total (single
  // "All") row when no row dims are configured, then to every row.
  let catRows = result.rows.filter((r) => r.__pivotKind === 'leaf')
  if (!catRows.length) catRows = result.rows.filter((r) => r.__pivotKind === 'grandTotal')
  if (!catRows.length) catRows = result.rows.slice()
  if (opts.maxCategories && catRows.length > opts.maxCategories) catRows = catRows.slice(0, opts.maxCategories)
  // Categories are the leaf's OWN label; when rows are nested, emit a parent
  // tier (categoryGroups) so the axis reads "Americas | Canada, USA ..." as a
  // grouped axis rather than colliding on a bare repeated leaf label.
  const byId = new Map(result.rows.map((r) => [r.__pivotId as string, r]))
  const ownLabel = (r: Record<string, unknown>) => String(r.__pivotLabel ?? '').trim() || '(blank)'
  const categories = catRows.map(ownLabel)
  const parentOf = (r: Record<string, unknown>) => (r.__pivotParentId ? byId.get(r.__pivotParentId as string) : undefined)
  const nested = catRows.length > 0 && catRows.every((r) => parentOf(r) !== undefined)
  let categoryGroups: Array<{ label: string; span: number }> | undefined
  if (nested) {
    categoryGroups = []
    let prevId: unknown
    for (const r of catRows) {
      const pid = r.__pivotParentId
      const last = categoryGroups[categoryGroups.length - 1]
      if (last && pid === prevId) last.span += 1
      else {
        categoryGroups.push({ label: ownLabel(parentOf(r)!), span: 1 })
        prevId = pid
      }
    }
  }

  // Collect the leaf value columns, carrying the accumulated column-group path
  // so a series can be labelled by its column path ("Q1", or "Q1 · Revenue").
  type Leaf = { id: string; path: string[]; header: string }
  const leaves: Leaf[] = []
  const walk = (cols: LooseColumn[] | undefined, path: string[]): void => {
    for (const c of cols ?? []) {
      if (!c || c.id === '__pivotRowHeader') continue
      // Skip the grand-total column group (and its leaves) unless asked for.
      if (!opts.includeTotals && typeof c.id === 'string' && c.id.startsWith('pv_group__grand')) continue
      if (Array.isArray(c.columns)) walk(c.columns, [...path, String(c.header ?? '')])
      else if (typeof c.id === 'string') leaves.push({ id: c.id, path, header: String(c.header ?? '') })
    }
  }
  walk(result.columns as LooseColumn[], [])

  const filtered = opts.includeTotals ? leaves : leaves.filter((l) => !l.id.includes('__total'))
  const uniqueHeaders = new Set(filtered.map((l) => l.header))
  const series = filtered.map((l) => ({
    label: l.path.length === 0 ? l.header : uniqueHeaders.size > 1 ? [...l.path, l.header].join(' · ') : l.path.join(' · '),
    values: catRows.map((r) => {
      const v = r[l.id]
      // An empty cell (an average over no rows is null) is a gap in the
      // chart, not a zero bar; a sum over no rows is the 0 the engine wrote.
      if (v == null || v === '') return Number.NaN
      return typeof v === 'number' ? v : Number(v)
    }),
  }))

  // With one measure the value axis can carry its name; the series are then
  // the column-axis values and say nothing about what is measured.
  const measureLabel = uniqueHeaders.size === 1 && filtered.length ? filtered[0]!.header : ''
  const yAxisTitle = opts.yAxisTitle === undefined ? measureLabel : opts.yAxisTitle
  const formats = (opts.measures ?? []).map((m) => m.format as CellFormatConfig | undefined)
  const agreed = formats[0] && formats.every((f) => f && JSON.stringify(f) === JSON.stringify(formats[0])) ? formats[0] : undefined
  const fmt = chartFormat(opts.format ?? agreed)

  return {
    type,
    categories,
    series,
    ...(categoryGroups && categoryGroups.length > 1 ? { categoryGroups } : {}),
    ...(opts.stacked || opts.stacked100 ? { stacked: true } : {}),
    ...(opts.stacked100 ? { stacked100: true } : {}),
    ...(opts.palette ? { palette: opts.palette } : {}),
    ...fmt,
    ...(yAxisTitle ? { yAxis: { ...fmt.yAxis, title: yAxisTitle } } : {}),
  }
}
```
