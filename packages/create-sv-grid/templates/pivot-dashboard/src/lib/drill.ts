/**
 * Drill-through: turn a clicked pivot cell back into the facts behind it.
 *
 * A pivot cell is the intersection of a row path and a column path. To find its
 * source rows you need both, and the pivot gives them in two different shapes:
 *
 *   - the **row** path is the chain of ancestors up to the clicked `PivotRow`,
 *     matched positionally against `layout.rows`;
 *   - the **column** path is encoded in the column id, `pv__<dim>__<dim>__m<i>`,
 *     where the trailing `m<i>` indexes into `layout.values`.
 *
 * Both decode to a plain `{ field: value }` filter, and the facts that match
 * every entry are the ones that produced the cell. Because the total is
 * recomputed from those same facts, the rail can never disagree with the grid.
 *
 * Kept free of Svelte and of the grid packages so it can be unit-tested on its
 * own - see drill.test.ts.
 */
import type { Fact } from './facts'

/** The subset of `PivotRow` this needs. Structural, so it does not drag the
 *  enterprise types into a file that is otherwise pure. */
export type PivotRowLike = {
  __pivotId?: string
  __pivotParentId?: string | null
  __pivotLabel?: unknown
  __pivotKind?: string
}

/** The subset of `PivotLayout` this needs. */
export type PivotLayoutLike = {
  rows: string[]
  cols: string[]
  values: { field: string }[]
}

export type Drill = {
  /** Human label for the clicked row, for the rail heading. */
  rowLabel: string
  /** Field/value pairs the facts must match. */
  filter: Record<string, string>
  /** The facts behind the cell. */
  facts: Fact[]
  /** Which measure the clicked column showed. */
  measure: string
  /** That measure summed over `facts` - equal to the cell the user clicked. */
  total: number
}

/**
 * Walk from the clicked row up to the root, then match the chain positionally
 * against `layout.rows`.
 *
 * The grand-total row filters on nothing: every fact contributed to it.
 */
export function rowFilterFor(
  row: PivotRowLike,
  allRows: PivotRowLike[],
  layout: PivotLayoutLike,
): Record<string, string> {
  if (row.__pivotKind === 'grandTotal') return {}
  const chain: PivotRowLike[] = []
  let current: PivotRowLike | undefined = row
  while (current) {
    chain.unshift(current)
    // Annotated: without it TypeScript infers `parentId` from `current`, which
    // this line then reassigns, and the inference becomes circular.
    const parentId: string | null | undefined = current.__pivotParentId
    current = parentId ? allRows.find((r) => r.__pivotId === parentId) : undefined
  }
  const filter: Record<string, string> = {}
  for (let i = 0; i < chain.length && i < layout.rows.length; i += 1) {
    filter[layout.rows[i]!] = String(chain[i]!.__pivotLabel)
  }
  return filter
}

/**
 * Decode a pivot column id into its column-axis filter and its measure.
 *
 * A subtotal column carries fewer dimension segments than `layout.cols` has,
 * which is exactly right: fewer constraints means a wider slice.
 */
export function colFilterFor(
  colId: string,
  layout: PivotLayoutLike,
): { filter: Record<string, string>; measure: string } {
  const parts = colId.startsWith('pv__') ? colId.slice(4).split('__') : []
  const last = parts[parts.length - 1]
  const measureIndex = last?.startsWith('m') ? Number(last.slice(1)) : 0
  const dimensions = parts.slice(0, Math.max(0, parts.length - 1))

  const filter: Record<string, string> = {}
  for (let i = 0; i < dimensions.length && i < layout.cols.length; i += 1) {
    filter[layout.cols[i]!] = dimensions[i]!
  }
  return { filter, measure: layout.values[measureIndex]?.field ?? layout.values[0]?.field ?? 'revenue' }
}

/**
 * The facts behind one clicked cell, plus the measure total over them.
 *
 * Works for leaf cells, subtotals and the grand total without special-casing:
 * each simply contributes fewer filter entries, so the slice widens.
 */
export function drillThrough(
  facts: Fact[],
  row: PivotRowLike,
  colId: string,
  allRows: PivotRowLike[],
  layout: PivotLayoutLike,
): Drill {
  const filter = { ...rowFilterFor(row, allRows, layout), ...colFilterFor(colId, layout).filter }
  const { measure } = colFilterFor(colId, layout)

  const matched = facts.filter((fact) => {
    for (const [field, value] of Object.entries(filter)) {
      if (String((fact as unknown as Record<string, unknown>)[field]) !== value) return false
    }
    return true
  })

  const total = matched.reduce(
    (sum, fact) => sum + Number((fact as unknown as Record<string, unknown>)[measure] ?? 0),
    0,
  )

  return {
    rowLabel: row.__pivotKind === 'grandTotal' ? 'Grand total' : String(row.__pivotLabel ?? ''),
    filter,
    facts: matched,
    measure,
    total,
  }
}

/** "EMEA / Germany / Q1" - the filter read back as a breadcrumb. */
export function drillBreadcrumb(drill: Drill): string {
  const parts = Object.values(drill.filter)
  return parts.length ? parts.join(' / ') : 'All data'
}
