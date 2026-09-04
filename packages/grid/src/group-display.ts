/**
 * Row-grouping display helpers. Two pure, framework-free transforms:
 *
 * - `insertGroupFooters` inserts a footer/total row after each group's children
 *   (and optionally a grand-total row at the end), carrying the group's already
 *   computed aggregate values. Mirrors the server model's footer shape
 *   (`server-group-model.ts`) client-side.
 * - `buildAutoGroupColumns` decides, for a grouping display mode, which synthetic
 *   "auto group" columns to show and which grouped source columns to hide - the
 *   groundwork for `singleColumn` / `multipleColumns` display types (the current
 *   default `groupRows` renders a full-width banner and needs neither).
 *
 * Both are generic over the row / column shape (via small accessor callbacks) so
 * they are trivially unit-testable and carry no dependency on the grid runtime.
 */

/** Grouping display variants. */
export type GroupDisplayType = 'groupRows' | 'singleColumn' | 'multipleColumns'

export type GroupFooterOptions<R> = {
  /** Depth of a row (group rows and their descendants). */
  getDepth: (row: R) => number
  /** True when a row is a group (banner) row. */
  isGroup: (row: R) => boolean
  /** Build a footer row from the group row it closes (carries its aggregates). */
  makeFooter: (groupRow: R) => R
  /** Insert a footer after each group's children. */
  includeGroupFooter?: boolean
  /** Append a grand-total footer at the very end. */
  includeGrandTotalFooter?: boolean
  /** Build the grand-total footer (over the whole set). Return null to skip. */
  makeGrandTotal?: () => R | null
}

/**
 * Insert group footer rows after each group's descendants. A group opened at
 * depth d closes when a later row appears at depth <= d (a sibling group or an
 * ancestor-level row); its footer is emitted at that point. Order is otherwise
 * preserved. No-op when neither footer flag is set.
 */
export function insertGroupFooters<R>(rows: ReadonlyArray<R>, opts: GroupFooterOptions<R>): R[] {
  const { getDepth, isGroup, makeFooter, includeGroupFooter, includeGrandTotalFooter, makeGrandTotal } = opts
  if (!includeGroupFooter && !includeGrandTotalFooter) return [...rows]

  const out: R[] = []
  const openGroups: R[] = []

  const closeTo = (depth: number) => {
    while (openGroups.length > 0) {
      const top = openGroups[openGroups.length - 1]!
      if (getDepth(top) < depth) break
      openGroups.pop()
      if (includeGroupFooter) out.push(makeFooter(top))
    }
  }

  for (const row of rows) {
    // Before adding this row, close any groups it ends (same-or-shallower depth).
    closeTo(getDepth(row))
    out.push(row)
    if (isGroup(row)) openGroups.push(row)
  }
  // Close everything still open at the end.
  closeTo(Number.NEGATIVE_INFINITY)

  if (includeGrandTotalFooter && makeGrandTotal) {
    const gt = makeGrandTotal()
    if (gt != null) out.push(gt)
  }
  return out
}

export type GroupPaginationOptions<R> = {
  /** Depth of a row (group rows and their descendants). */
  getDepth: (row: R) => number
  /** True when a row is a group (banner) row. */
  isGroup: (row: R) => boolean
  /**
   * True when a group row is expanded. Defaults to treating every group as
   * expanded. This matters: an EXPANDED group is a header, reprinted above its
   * children and costing no page budget, while a COLLAPSED group is the visible
   * unit itself and must consume a slot - otherwise a fully collapsed grid has
   * no budget-consuming rows at all and every page comes back empty.
   */
  isExpanded?: (row: R) => boolean
  pageIndex: number
  pageSize: number
}

export type GroupPaginationResult<R> = {
  /** The rows to render for this page: the page's budget-consuming rows, each
   *  preceded by whichever ancestor banners have not been printed yet. */
  rows: R[]
  /** Budget-consuming rows across every page - what the pager divides by.
   *  Data rows plus collapsed group rows; expanded banners do not count. */
  dataRowCount: number
}

/**
 * Paginate a grouped row list by DATA rows, repeating each page's ancestor
 * group headers.
 *
 * Slicing the flat grouped list directly counts group banners against
 * `pageSize`, so `pageSize: 10` over ten groups of two shows almost no data
 * (#73). Here only non-group rows consume the page budget, and a page reprints
 * the group chain its first rows sit under - the same thing a spreadsheet does
 * when a grouped table breaks across pages.
 *
 * Ancestors are tracked with a depth stack rather than parent pointers, so this
 * works on the already-flattened expanded model and needs nothing from the row
 * objects but depth and group-ness.
 */
export function paginateGroupedRows<R>(
  rows: ReadonlyArray<R>,
  opts: GroupPaginationOptions<R>,
): GroupPaginationResult<R> {
  const { getDepth, isGroup, isExpanded, pageIndex, pageSize } = opts
  const expanded = isExpanded ?? (() => true)
  const start = pageIndex * pageSize
  const end = start + pageSize

  const out: R[] = []
  // Expanded banners currently open, outermost first. `printed` marks the ones
  // this page has already emitted, so a group spanning rows 3-8 prints its
  // banner once, not once per row.
  const openGroups: Array<{ row: R; printed: boolean }> = []
  let unitsSeen = 0

  for (const row of rows) {
    const depth = getDepth(row)
    // A row at depth <= an open banner's depth closes it.
    while (openGroups.length > 0 && getDepth(openGroups[openGroups.length - 1]!.row) >= depth) {
      openGroups.pop()
    }
    if (isGroup(row) && expanded(row)) {
      // A header for rows that follow: reprinted per page, costs no budget.
      openGroups.push({ row, printed: false })
      continue
    }
    // Everything else is a visible unit: a data row, or a collapsed group
    // standing in for its whole subtree.
    const index = unitsSeen
    unitsSeen += 1
    if (index < start || index >= end) continue
    for (const g of openGroups) {
      if (g.printed) continue
      g.printed = true
      out.push(g.row)
    }
    out.push(row)
  }

  return { rows: out, dataRowCount: unitsSeen }
}

export type AutoGroupColumnSpec = {
  /** Synthetic column id (e.g. `__autoGroup` or `__group_<field>`). */
  id: string
  /** The grouped field this auto column stands in for (null for the single
   *  combined auto-group column). */
  field: string | null
  /** Nesting level this column represents (0-based), for indentation. */
  level: number
}

export type AutoGroupResult = {
  /** Synthetic auto-group column specs to prepend to the visible columns. */
  autoColumns: AutoGroupColumnSpec[]
  /** Ids of the grouped SOURCE columns to hide (rolled into the auto columns). */
  hiddenSourceIds: Set<string>
}

/**
 * Decide the synthetic auto-group columns for a grouping display mode:
 * - `groupRows`: none (the banner path handles display) - `{ [], {} }`.
 * - `singleColumn`: one combined auto-group column; every grouped source column
 *   is hidden.
 * - `multipleColumns`: one auto column per grouped field; the grouped source
 *   columns are hidden.
 */
export function buildAutoGroupColumns(
  grouping: ReadonlyArray<string>,
  displayType: GroupDisplayType,
): AutoGroupResult {
  if (displayType === 'groupRows' || grouping.length === 0) {
    return { autoColumns: [], hiddenSourceIds: new Set() }
  }
  const hiddenSourceIds = new Set(grouping)
  if (displayType === 'singleColumn') {
    return {
      autoColumns: [{ id: '__autoGroup', field: null, level: 0 }],
      hiddenSourceIds,
    }
  }
  // multipleColumns
  return {
    autoColumns: grouping.map((field, level) => ({ id: `__group_${field}`, field, level })),
    hiddenSourceIds,
  }
}
