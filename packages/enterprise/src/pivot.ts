/**
 * Pivot table (@svgrid/enterprise).
 *
 * Turns a flat array of rows + a pivot config into:
 *   - `rows`: a flat array of pivot rows (group, subtotal, leaf, grand
 *     total) suitable for `<SvGrid data={rows} />`.
 *   - `columns`: a nested-header column tree suitable for
 *     `<SvGrid columns={columns} />` - one column per (col-axis path
 *      × value-measure) plus the row-axis "Header" first column.
 *
 * No DOM, no rendering. The grid renders the result with its
 * `columns: ColumnDef[]` + `data: PivotRow[]` like any other dataset.
 *
 * Usage:
 *
 * ```ts
 * import { createPivotModel } from '@svgrid/enterprise'
 *
 * const pivot = createPivotModel(orders, {
 *   rows:   ['region', 'salesPerson'],
 *   cols:   ['quarter'],
 *   values: [
 *     { field: 'amount', agg: 'sum', label: 'Total',  format: { type: 'currency', currency: 'USD' } },
 *     { field: 'amount', agg: 'avg', label: 'Avg' },
 *   ],
 * })
 *
 * // then:
 * <SvGrid data={pivot.rows} columns={pivot.columns} features={features} />
 * ```
 */
import type { ColumnDef, CellFormatConfig, RowData, TableFeatures } from '@svgrid/grid'

// ---------------------------------------------------------------- types

export type PivotAggregatorId =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'countDistinct'
  | 'first'
  | 'last'

export type PivotAggregator = (values: ReadonlyArray<unknown>) => unknown

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

export type PivotRowKind = 'group' | 'subtotal' | 'leaf' | 'grandTotal'

/**
 * Shape of one entry in `result.rows`. The first-column label lives at
 * `__pivotLabel`; every value cell lives at the column id matching the
 * leaf column generated for its (col-path × measure).
 *
 * `__pivotParentId` is the `__pivotId` of the row's row-axis parent
 * (or `null` for top-level groups, the grand-total row, and the one
 * synthetic "All" row when no row dims are configured). Use it with
 * `filterCollapsedPivotRows` to hide leaves whose ancestor is
 * collapsed - that's how expandable pivots are built on top of the
 * model.
 *
 * `__pivotExpandable` is `true` for `group` rows that have at least
 * one descendant. A renderer uses this to decide whether to show a
 * chevron next to the label.
 */
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

export type PivotResult<TFeatures extends TableFeatures> = {
  rows: PivotRow[]
  columns: Array<ColumnDef<TFeatures, PivotRow>>
}

// -------------------------------------------------------- aggregators

const numeric = (vs: ReadonlyArray<unknown>): number[] =>
  vs
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((n): n is number => !Number.isNaN(n))

const BUILT_IN_AGGS: Record<PivotAggregatorId, PivotAggregator> = {
  sum:           (vs) => numeric(vs).reduce((a, b) => a + b, 0),
  avg:           (vs) => {
    const ns = numeric(vs)
    return ns.length === 0 ? null : ns.reduce((a, b) => a + b, 0) / ns.length
  },
  min:           (vs) => (numeric(vs).length === 0 ? null : Math.min(...numeric(vs))),
  max:           (vs) => (numeric(vs).length === 0 ? null : Math.max(...numeric(vs))),
  count:         (vs) => vs.length,
  countDistinct: (vs) => new Set(vs).size,
  first:         (vs) => vs[0] ?? null,
  last:          (vs) => vs[vs.length - 1] ?? null,
}

function resolveAgg(agg: PivotAggregatorId | PivotAggregator): PivotAggregator {
  if (typeof agg === 'function') return agg
  const fn = BUILT_IN_AGGS[agg]
  if (!fn) throw new Error(`pivot: unknown aggregator '${String(agg)}'`)
  return fn
}

// --------------------------------------------------- axis-tree helpers

type AxisNode = {
  /** Dimension level (index into config.cols / config.rows). 0 at root. */
  level: number
  /** Dim value at this node (root has value `null`). */
  value: unknown
  /** Path of values from root to this node (excluding root). */
  path: ReadonlyArray<unknown>
  /** Stable string id for the path. */
  pathKey: string
  /** Direct children, keyed by stringified value. */
  children: Map<string, AxisNode>
  /** Rows reaching this node (leaf or otherwise). */
  rows: unknown[]
}

function defaultCompare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

function buildAxisTree<TData>(
  rows: ReadonlyArray<TData>,
  fields: ReadonlyArray<string>,
  sortBy: ((a: unknown, b: unknown, level: number) => number) | undefined,
): AxisNode {
  const root: AxisNode = {
    level: 0, value: null, path: [], pathKey: '__root',
    children: new Map(), rows: rows as unknown[],
  }
  for (const row of rows as ReadonlyArray<Record<string, unknown>>) {
    let node = root
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i]!
      const value = row[field]
      const key = `${i}:${value === null ? '__null' : String(value)}`
      let child = node.children.get(key)
      if (!child) {
        child = {
          level: i + 1,
          value,
          path: [...node.path, value],
          pathKey: node.pathKey === '__root' ? key : `${node.pathKey}|${key}`,
          children: new Map(),
          rows: [],
        }
        node.children.set(key, child)
      }
      child.rows.push(row)
      node = child
    }
  }
  // Stable, predictable child order at every level.
  sortNode(root, sortBy)
  return root
}

function sortNode(
  node: AxisNode,
  sortBy: ((a: unknown, b: unknown, level: number) => number) | undefined,
): void {
  const entries = Array.from(node.children.entries())
  entries.sort(([, a], [, b]) => (sortBy ?? defaultCompare)(a.value, b.value, a.level - 1))
  node.children = new Map(entries)
  for (const child of node.children.values()) sortNode(child, sortBy)
}

// --------------------------------------------------- column id helpers

/**
 * Generate stable leaf column ids by joining the column-axis path and the
 * measure index. The id is what appears as `data-col-id` and as the key
 * inside each pivot row. Kept short and deterministic.
 */
function leafColumnId(colPath: ReadonlyArray<unknown>, measureIndex: number): string {
  const path = colPath.length === 0 ? 'all' : colPath.map((v) => safe(v)).join('__')
  return `pv__${path}__m${measureIndex}`
}

function safe(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '_')
}

// --------------------------------------------------- column-tree build

function buildColumnTree<TFeatures extends TableFeatures>(
  colRoot: AxisNode,
  values: ReadonlyArray<PivotValueConfig<unknown>>,
  config: PivotConfig<unknown>,
  rowHeaderLabel: string,
): Array<ColumnDef<TFeatures, PivotRow>> {
  // First column: the row-axis tree as a single column. The label per row
  // comes from `__pivotLabel`, with `__pivotDepth` driving the indent.
  const headerCol: ColumnDef<TFeatures, PivotRow> = {
    id: '__pivotRowHeader',
    header: rowHeaderLabel,
    fieldFn: (row) => row.__pivotLabel,
    width: 240,
  }

  function recurse(node: AxisNode): Array<ColumnDef<TFeatures, PivotRow>> {
    // If this is a column-axis leaf (no children), emit one value column
    // per measure.
    if (node.children.size === 0) {
      return values.map((value, i) => {
        const id = leafColumnId(node.path, i)
        const label = value.label ?? `${value.field} (${typeof value.agg === 'function' ? 'custom' : value.agg})`
        return {
          id,
          header: label,
          fieldFn: (row) => row[id],
          format: value.format,
          width: 130,
        } as ColumnDef<TFeatures, PivotRow>
      })
    }
    // Otherwise emit a header group with this node's value as the label
    // and recurse for its children.
    return Array.from(node.children.values()).map((child) => ({
      id: `pv_group_${child.pathKey}`,
      header: String(child.value ?? '(blank)'),
      columns: recurse(child),
    } as unknown as ColumnDef<TFeatures, PivotRow>))
  }

  const valueCols = colRoot.children.size === 0
    // No col dims at all: emit measures as flat columns under no group.
    ? recurse(colRoot)
    : recurse(colRoot)

  const grandTotalCol = config.grandTotalCol !== false
  if (!grandTotalCol) return [headerCol, ...valueCols]

  // Grand total column: one measure column per value config, with no
  // col-path filter.
  const totalCols: Array<ColumnDef<TFeatures, PivotRow>> = values.map((value, i) => {
    const id = leafColumnId(['__total'], i)
    const label = value.label ?? `${value.field} (${typeof value.agg === 'function' ? 'custom' : value.agg})`
    return {
      id,
      header: label,
      fieldFn: (row) => row[id],
      format: value.format,
      width: 140,
    } as ColumnDef<TFeatures, PivotRow>
  })
  const grandTotal: ColumnDef<TFeatures, PivotRow> = {
    id: 'pv_group__grand_total',
    header: 'Total',
    columns: totalCols,
  } as unknown as ColumnDef<TFeatures, PivotRow>

  return [headerCol, ...valueCols, grandTotal]
}

// --------------------------------------------------- row-axis materialise

function collectColLeafPaths(node: AxisNode, into: Array<ReadonlyArray<unknown>>): void {
  if (node.children.size === 0) {
    into.push(node.path)
    return
  }
  for (const child of node.children.values()) collectColLeafPaths(child, into)
}

/**
 * For one source-row set (a row-axis node) compute the value at each
 * column-axis leaf for each measure. Returns a map keyed by column id.
 */
function computeRowValues(
  sourceRows: ReadonlyArray<Record<string, unknown>>,
  colLeafPaths: ReadonlyArray<ReadonlyArray<unknown>>,
  colFields: ReadonlyArray<string>,
  values: ReadonlyArray<PivotValueConfig<unknown>>,
  includeGrandTotalCol: boolean,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // For each col-axis leaf path, filter the source rows to those matching
  // every dim value, then run each measure aggregator.
  for (const colPath of colLeafPaths) {
    const matched = colPath.length === 0
      ? sourceRows
      : sourceRows.filter((r) =>
          colPath.every((value, i) => r[colFields[i]!] === value),
        )
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i]!
      const fn = resolveAgg(value.agg)
      const id = leafColumnId(colPath, i)
      result[id] = fn(matched.map((r) => r[value.field]))
    }
  }

  // Grand-total column: run each measure across the entire source set.
  if (includeGrandTotalCol) {
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i]!
      const fn = resolveAgg(value.agg)
      const id = leafColumnId(['__total'], i)
      result[id] = fn(sourceRows.map((r) => r[value.field]))
    }
  }

  return result
}

/**
 * Build the same value-column keys as `computeRowValues`, but with every cell
 * `null`. Used for group HEADER rows when `rowSubtotals` is off: the row keeps
 * its place in the hierarchy (label + expand/collapse) yet shows no aggregate
 * numbers. Cells are `null` rather than absent so consumers can distinguish a
 * deliberately-blank subtotal from a missing column.
 */
function blankRowValues(
  colLeafPaths: ReadonlyArray<ReadonlyArray<unknown>>,
  values: ReadonlyArray<PivotValueConfig<unknown>>,
  includeGrandTotalCol: boolean,
): Record<string, null> {
  const result: Record<string, null> = {}
  for (const colPath of colLeafPaths) {
    for (let i = 0; i < values.length; i += 1) result[leafColumnId(colPath, i)] = null
  }
  if (includeGrandTotalCol) {
    for (let i = 0; i < values.length; i += 1) result[leafColumnId(['__total'], i)] = null
  }
  return result
}

function walkRowTree(
  node: AxisNode,
  out: PivotRow[],
  colLeafPaths: ReadonlyArray<ReadonlyArray<unknown>>,
  colFields: ReadonlyArray<string>,
  values: ReadonlyArray<PivotValueConfig<unknown>>,
  config: PivotConfig<unknown>,
  rowFields: ReadonlyArray<string>,
  /**
   * The id of the row-axis ancestor that should be reported as
   * `__pivotParentId` on every row emitted under this subtree. `null`
   * at the top level.
   */
  parentId: string | null,
): void {
  const includeGrandTotalCol = config.grandTotalCol !== false
  const wantSubtotals = config.rowSubtotals !== false

  // The "leaf" case: this is a row-axis leaf - no further row dimensions.
  if (node.children.size === 0) {
    out.push({
      __pivotId: `row__${node.pathKey}`,
      __pivotKind: 'leaf',
      __pivotDepth: node.level,
      __pivotLabel: node.value === null ? '(All)' : String(node.value),
      __pivotParentId: parentId,
      __pivotExpandable: false,
      ...computeRowValues(
        node.rows as ReadonlyArray<Record<string, unknown>>,
        colLeafPaths,
        colFields,
        values,
        includeGrandTotalCol,
      ),
    })
    return
  }

  // Group node. Emit the group HEADER row whenever this node is a real group
  // (not the synthetic root, not the deepest level). The header is emitted
  // regardless of `rowSubtotals` so the grouping hierarchy and the
  // expand/collapse parent chain stay intact; the flag only controls whether
  // the header carries its aggregate (subtotal) values or renders as a
  // label-only row. This matches Excel / AG Grid, where hiding subtotals never
  // removes a grouping level from the row axis.
  const isRealGroup = node.level > 0 && node.level < rowFields.length
  let nextParentId: string | null = parentId
  if (isRealGroup) {
    const id = `group__${node.pathKey}`
    out.push({
      __pivotId: id,
      __pivotKind: 'group',
      __pivotDepth: node.level,
      __pivotLabel: String(node.value ?? '(All)'),
      __pivotParentId: parentId,
      __pivotExpandable: true,
      ...(wantSubtotals
        ? computeRowValues(
            node.rows as ReadonlyArray<Record<string, unknown>>,
            colLeafPaths,
            colFields,
            values,
            includeGrandTotalCol,
          )
        : blankRowValues(colLeafPaths, values, includeGrandTotalCol)),
    })
    // Children of this group point at this row as their parent so a
    // collapse hides the whole subtree, not just the immediate leaves.
    nextParentId = id
  }

  for (const child of node.children.values()) {
    walkRowTree(
      child, out, colLeafPaths, colFields, values, config, rowFields, nextParentId,
    )
  }
}

// ------------------------------------------------------------ public API

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

/**
 * Public registry of built-in aggregators. Useful for surfacing the
 * available options in a pivot designer UI.
 */
export const pivotAggregators: Record<PivotAggregatorId, PivotAggregator> = { ...BUILT_IN_AGGS }

/**
 * Filter a `result.rows` array down to only the rows the user should
 * see given the current expansion state. A row stays in the output if
 * its entire ancestor chain (via `__pivotParentId`) is in `expandedIds`.
 *
 * Pass `true` to bypass filtering (everything visible - the default
 * shape `createPivotModel` already returns). Pass an empty array /
 * empty Set to collapse every group to its subtotal row.
 *
 * The result is a new array; the input is not mutated.
 */
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
