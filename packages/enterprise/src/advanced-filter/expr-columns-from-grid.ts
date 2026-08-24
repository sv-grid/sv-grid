/**
 * Derive the expression layer's column metadata from a live grid.
 *
 * Saves every consumer from hand-writing an `ExprColumn[]` that mirrors their
 * column defs and then drifting from it.
 */
import type { ExprColumn, ExprColumnType } from '../expressions/expression-columns'

/** Grid columns as `api.getColumns()` reports them. */
type GridColumnInfo = {
  id: string
  field?: string
  header: string
  visible: boolean
  editorType?: string
}

/**
 * Columns the grid renders but a user cannot meaningfully filter on. These are
 * structural (a checkbox gutter, a row-number gutter) rather than data.
 */
const NON_DATA_IDS = new Set(['__select', '__selection', '__rowNumber', '__autoGroup', '__actions'])

/** Map a grid editorType onto the coarse type the operator catalogue uses. */
function toExprType(editorType: string | undefined): ExprColumnType {
  switch (editorType) {
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'checkbox':
      return 'boolean'
    default:
      return 'text'
  }
}

export type ExprColumnsOptions = {
  /** Include columns currently hidden by the user. Default false. */
  includeHidden?: boolean
}

/**
 * Build `ExprColumn[]` from a grid API.
 *
 * Typed loosely on purpose: `SvGridApi` is generic over features and row type,
 * and this only needs `getColumns()`. Taking the concrete generic here would
 * force every caller to thread both parameters through for no benefit.
 */
export function exprColumnsFromGrid(
  api: { getColumns(): ReadonlyArray<GridColumnInfo> },
  options: ExprColumnsOptions = {},
): ExprColumn[] {
  const out: ExprColumn[] = []
  for (const col of api.getColumns()) {
    if (NON_DATA_IDS.has(col.id)) continue
    if (!options.includeHidden && !col.visible) continue
    out.push({
      id: col.id,
      // Fall back to the id so a column with no header is still addressable
      // in the `[Bracketed Name]` reference syntax.
      name: col.header || col.id,
      type: toExprType(col.editorType),
    })
  }
  return out
}
