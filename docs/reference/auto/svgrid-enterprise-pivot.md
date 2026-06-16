# `@svgrid/enterprise` · `pivot.ts`

Auto-generated. Source: `packages\enterprise\src\pivot.ts`.

### `type PivotAggregatorId`

_No JSDoc yet._

```ts
export type PivotAggregatorId =
```

### `type PivotAggregator`

_No JSDoc yet._

```ts
export type PivotAggregator = (values: ReadonlyArray<unknown>) => unknown
```

### `type PivotValueConfig`

_No JSDoc yet._

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

_No JSDoc yet._

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

_No JSDoc yet._

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

_No JSDoc yet._

```ts
export type PivotResult<TFeatures extends TableFeatures> = {
  rows: PivotRow[]
  columns: Array<ColumnDef<TFeatures, PivotRow>>
}
```

### `function createPivotModel`

_No JSDoc yet._

```ts
export function createPivotModel<
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
```
