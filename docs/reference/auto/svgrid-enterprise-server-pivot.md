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
): Array<ColumnDef<any, any>> {
  const sep = options.separator ?? '_'
  const width = options.width ?? 120
  const header = options.valueHeader ?? ((a) => `${a.fn}(${a.col})`)
  const root: Node = { key: '', children: new Map(), leaves: [] }

  // Longest aggregation column first, so `net_amount` wins over `amount` for
  // a field ending in `_net_amount`.
  const aggs = [...aggregations].sort((a, b) => b.col.length - a.col.length)

  for (const field of fields) {
    const agg = aggs.find((a) => field === a.col || field.endsWith(sep + a.col))
    if (!agg) continue
    const keyPart = field === agg.col ? '' : field.slice(0, field.length - agg.col.length - sep.length)
    const keys = keyPart === '' ? [] : keyPart.split(sep)
    let node = root
    for (const key of keys) {
      let next = node.children.get(key)
      if (!next) {
        next = { key, children: new Map(), leaves: [] }
        node.children.set(key, next)
      }
      node = next
    }
    node.leaves.push({ field, agg })
  }

  const leafColumn = (field: string, agg: ServerAggregation): ColumnDef<any, any> => {
    const base = { id: field, field, header: header(agg), width, align: 'right' } as ColumnDef<any, any>
    return options.pivotResultColumn ? options.pivotResultColumn(field, base) : base
  }

  const emit = (node: Node, path: string[]): Array<ColumnDef<any, any>> => {
    const out: Array<ColumnDef<any, any>> = []
    for (const child of node.children.values()) {
      const childPath = [...path, child.key]
      out.push({
        id: `pv_group_${childPath.join(sep)}`,
        header: child.key,
        columns: emit(child, childPath),
      } as unknown as ColumnDef<any, any>)
    }
    for (const leaf of node.leaves) out.push(leafColumn(leaf.field, leaf.agg))
    return out
  }

  const out = emit(root, [])
  if (options.rowTotals) {
    out.push({
      id: 'pv_group_total',
      header: typeof options.rowTotals === 'string' ? options.rowTotals : 'Total',
      columns: aggregations.map((a) => leafColumn(a.col, a)),
    } as unknown as ColumnDef<any, any>)
  }
  return out
}
```
