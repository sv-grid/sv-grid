/**
 * Server-side pivot: turning the fields a backend answered with into the
 * column tree the grid renders.
 *
 * The backend does the pivoting. With `pivotMode` on, each group row it
 * returns carries one value per (pivot key x aggregation), under a field
 * named from the keys and the column joined by a separator - `2024_amount`,
 * or `2024_Q1_amount` with two pivot columns - and the response lists those
 * fields in `pivotResultFields`. This module builds, from that list alone, the
 * header groups per key level with a value column under each, in the same
 * shape the client-side pivot engine produces (`{ id, header, columns }`).
 *
 * The one thing the list cannot say is which trailing segment is the value
 * column when the separator also appears in a key, so the aggregations are
 * matched by suffix: `2024_gross_amount` with an aggregation on `amount`
 * splits as key `2024_gross` + value `amount`.
 */
// Type-only imports are erased, so the root barrel is safe to name here.
import type { ColumnDef } from '@svgrid/grid'
import type { ServerAggregation } from '@svgrid/grid/server'

/** How `buildPivotResultColumns` names, sizes and post-processes the generated value columns. */
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
}

type Node = { key: string; children: Map<string, Node>; leaves: Array<{ field: string; agg: ServerAggregation }> }

/**
 * Parse `pivotResultFields` into a column tree. Fields whose suffix matches no
 * aggregation are skipped - they are not pivoted values.
 */
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

  return emit(root, [])
}
