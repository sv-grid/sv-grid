/**
 * Master-detail logic. The testable core behind `SvGridMasterDetail.svelte`:
 * track which parent rows are expanded and splice a synthetic "detail" row in
 * after each expanded parent, so a single `<SvGrid>` renders both the master
 * rows and a full-width detail region (via the grid's `isDetailRow` /
 * `renderDetailRow`). Pure - no Svelte, no DOM.
 */

/** A synthetic row inserted after an expanded parent; carries the parent it belongs to. */
export type DetailRow<TParent> = { __svgridDetail: true; parent: TParent; parentId: string }

/** True for the synthetic detail rows produced by `buildDisplayRows`. */
export function isDetailRow(row: unknown): row is DetailRow<unknown> {
  return !!row && typeof row === 'object' && (row as { __svgridDetail?: unknown }).__svgridDetail === true
}

/** Toggle a parent id in the expanded set, returning a new set (immutable). */
export function toggleExpanded(expanded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(expanded)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Weave detail rows into the master rows: each expanded parent is followed by a
 * `DetailRow` marker. Order is otherwise preserved, so the grid renders parents
 * in place with their detail region directly beneath.
 */
export function buildDisplayRows<TParent>(
  parents: ReadonlyArray<TParent>,
  expanded: ReadonlySet<string>,
  getRowId: (parent: TParent) => string,
): Array<TParent | DetailRow<TParent>> {
  const out: Array<TParent | DetailRow<TParent>> = []
  for (const parent of parents) {
    out.push(parent)
    const id = getRowId(parent)
    if (expanded.has(id)) out.push({ __svgridDetail: true, parent, parentId: id })
  }
  return out
}
