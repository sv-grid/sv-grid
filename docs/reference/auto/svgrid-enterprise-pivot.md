# `@svgrid/enterprise` · `pivot.ts`

Auto-generated. Source: `packages\enterprise\src\pivot.ts`.

### `type PivotAggregatorId`

Built-in pivot measures, named in {@link PivotValueConfig}. */

```ts
export type PivotAggregatorId =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'countDistinct'
  | 'first'
  | 'last'
```

### `type PivotAggregator`

A custom measure: reduce the values under one cell to the number to display. */

```ts
export type PivotAggregator = (values: ReadonlyArray<unknown>) => unknown
```

### `type PivotValueConfig`

One measure: the field to aggregate and how to aggregate it. */

```ts
export type PivotValueConfig<TData> = {
  /** Row field whose values get aggregated. */
  field: keyof TData & string
  /** Built-in aggregator id, or a custom reducer. */
  agg: PivotAggregatorId | PivotAggregator
  /** Display name in the column header. Defaults to `${field} (${agg})`. */
  label?: string
  /** Optional cell formatter. */
  format?: CellFormatConfig
}
```

### `type PivotConfig`

A pivot definition: the row axis, the column axis, and the measures at their intersections. */

```ts
export type PivotConfig<TData> = {
  /** Outer-most first. Each entry becomes one level of row grouping. */
  rows: ReadonlyArray<keyof TData & string>
  /** Outer-most first. Each entry becomes one level of column grouping. */
  cols: ReadonlyArray<keyof TData & string>
  /** One or more measures aggregated under each column-axis leaf. */
  values: ReadonlyArray<PivotValueConfig<TData>>
  /** Grand-total row at the bottom. Default `true`. */
  grandTotalRow?: boolean
  /** Grand-total column on the right. Default `true`. */
  grandTotalCol?: boolean
  /** Subtotal rows between row groups. Default `true`. */
  rowSubtotals?: boolean
  /** Optional sort for column-axis values per dim level (defaults to alpha). */
  colSort?: (a: unknown, b: unknown, level: number) => number
  /** Optional sort for row-axis values per dim level (defaults to alpha). */
  rowSort?: (a: unknown, b: unknown, level: number) => number
}
```

### `type PivotRowKind`

What a pivot row represents - a group header, a subtotal, a leaf, or the grand total. */

```ts
export type PivotRowKind = 'group' | 'subtotal' | 'leaf' | 'grandTotal'
```

### `type PivotRow`

Shape of one entry in `result.rows`. The first-column label lives at
`__pivotLabel`; every value cell lives at the column id matching the
leaf column generated for its (col-path × measure).

`__pivotParentId` is the `__pivotId` of the row's row-axis parent
(or `null` for top-level groups, the grand-total row, and the one
synthetic "All" row when no row dims are configured). Use it with
`filterCollapsedPivotRows` to hide leaves whose ancestor is
collapsed - that's how expandable pivots are built on top of the
model.

`__pivotExpandable` is `true` for `group` rows that have at least
one descendant. A renderer uses this to decide whether to show a
chevron next to the label.

```ts
export type PivotRow = {
  __pivotId: string
  __pivotKind: PivotRowKind
  __pivotDepth: number
  __pivotLabel: string
  __pivotParentId: string | null
  __pivotExpandable: boolean
  /** Aggregated value cells - keyed by leaf column id. */
  [columnId: string]: unknown
}
```

### `type PivotResult`

A built pivot: the rows to display, and the generated column definitions for its column axis. */

```ts
export type PivotResult<TFeatures extends TableFeatures> = {
  rows: PivotRow[]
  columns: Array<ColumnDef<TFeatures, PivotRow>>
}
```

### `function createPivotModel`

Build a pivot table from flat rows: cross the row axis with the column axis,
aggregate each intersection, and return rows plus generated columns ready to
hand to `<SvGrid>`.

```ts
export function createPivotModel<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  data: ReadonlyArray<TData>,
  config: PivotConfig<TData>,
): PivotResult<TFeatures> {
  if (config.values.length === 0) {
    throw new Error('pivot: at least one value config is required')
  }

  const rowFields = config.rows as ReadonlyArray<string>
  const colFields = config.cols as ReadonlyArray<string>
  const values    = config.values as ReadonlyArray<PivotValueConfig<unknown>>

  // 1. axis trees
  const rowRoot = buildAxisTree(data, rowFields, config.rowSort)
  const colRoot = buildAxisTree(data, colFields, config.colSort)

  // 2. collect col-axis leaf paths (one per value column header chain)
  const colLeafPaths: Array<ReadonlyArray<unknown>> = []
  collectColLeafPaths(colRoot, colLeafPaths)

  // 3. flatten row-axis to pivot rows
  const rows: PivotRow[] = []
  if (rowFields.length === 0) {
    // No row dims: one synthetic "All" row.
    rows.push({
      __pivotId: 'row__all',
      __pivotKind: 'leaf',
      __pivotDepth: 0,
      __pivotLabel: '(All)',
      __pivotParentId: null,
      __pivotExpandable: false,
      ...computeRowValues(
        data as unknown as ReadonlyArray<Record<string, unknown>>,
        colLeafPaths,
        colFields,
        values,
        config.grandTotalCol !== false,
      ),
    })
  } else {
    walkRowTree(
      rowRoot, rows, colLeafPaths, colFields, values,
      config as PivotConfig<unknown>, rowFields, null,
    )
  }

  // 4. grand-total row at bottom
  if (config.grandTotalRow !== false) {
    rows.push({
      __pivotId: 'row__grand_total',
      __pivotKind: 'grandTotal',
      __pivotDepth: 0,
      __pivotLabel: 'Grand total',
      __pivotParentId: null,
      __pivotExpandable: false,
      ...computeRowValues(
        data as unknown as ReadonlyArray<Record<string, unknown>>,
        colLeafPaths,
        colFields,
        values,
        config.grandTotalCol !== false,
      ),
    })
  }

  // 5. column tree
  const columns = buildColumnTree<TFeatures>(
    colRoot,
    values,
    config as PivotConfig<unknown>,
    rowFields.length > 0 ? rowFields.join(' / ') : '',
  )

  return { rows, columns }
}
```

### `const pivotAggregators`

Public registry of built-in aggregators. Useful for surfacing the
available options in a pivot designer UI.

```ts
export const pivotAggregators: Record<PivotAggregatorId, PivotAggregator> = { ...BUILT_IN_AGGS }
```

### `function filterCollapsedPivotRows`

Filter a `result.rows` array down to only the rows the user should
see given the current expansion state. A row stays in the output if
its entire ancestor chain (via `__pivotParentId`) is in `expandedIds`.

Pass `true` to bypass filtering (everything visible - the default
shape `createPivotModel` already returns). Pass an empty array /
empty Set to collapse every group to its subtotal row.

The result is a new array; the input is not mutated.

```ts
export function filterCollapsedPivotRows(
  rows: ReadonlyArray<PivotRow>,
  expandedIds: ReadonlyArray<string> | Set<string> | true,
): PivotRow[] {
  if (expandedIds === true) return rows.slice()
  const expanded =
    expandedIds instanceof Set ? expandedIds : new Set(expandedIds)
  // Parent-of index so the ancestor walk is O(depth) instead of O(rows × depth).
  const parentOf = new Map<string, string | null>()
  for (const r of rows) parentOf.set(r.__pivotId, r.__pivotParentId)

  const out: PivotRow[] = []
  for (const row of rows) {
    // The grand-total row, top-level groups, and the (All) row are
    // always visible (their parent is null).
    if (row.__pivotParentId === null) {
      out.push(row)
      continue
    }
    let parentId: string | null = row.__pivotParentId
    let visible = true
    while (parentId !== null) {
      if (!expanded.has(parentId)) { visible = false; break }
      parentId = parentOf.get(parentId) ?? null
    }
    if (visible) out.push(row)
  }
  return out
}
```
