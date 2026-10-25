# `@svgrid/enterprise` · `server/server-pivot.ts`

Auto-generated. Source: `packages\enterprise\src\server\server-pivot.ts`.

### `type PivotResultColumnOptions`

How `buildPivotResultColumns` names, sizes and post-processes the generated value columns.

```ts
export type PivotResultColumnOptions = {
  /** The string between key segments and the value column. Default `_`. */
  separator?: string
  /** Header text for a value column. Default: the aggregation as `sum(amount)`. */
  valueHeader?: (aggregation: ServerAggregation) => string
  /**
   * Post-process each generated leaf column - set a width, a format, an align.
   * Receives the field it reads and the default definition.
   */
  pivotResultColumn?: (field: string, column: ColumnDef<any, any>) => ColumnDef<any, any>
  /** Width for a generated value column. Default 120. */
  width?: number
  /**
   * Append a header group of row totals after the pivot keys: one column
   * per aggregation reading the plain aggregate field (`amount`, not
   * `2024_amount`), which the backend puts on every group row in pivot
   * mode beside the per-key fields. `true` labels the group `Total`; a
   * string is the label.
   */
  rowTotals?: boolean | string
}
```

### `function buildPivotResultColumns`

Parse `pivotResultFields` into a column tree. Fields whose suffix matches no
aggregation are skipped - they are not pivoted values.

```ts
export function buildPivotResultColumns(
  fields: ReadonlyArray<string>,
  aggregations: ReadonlyArray<ServerAggregation>,
  options: PivotResultColumnOptions = {},
): Array<ColumnDef<any, any>>
```
