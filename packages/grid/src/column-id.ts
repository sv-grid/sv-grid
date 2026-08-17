// The single definition of a column's id.
//
// A column def normally names itself with `id` or `field`. When it does
// neither, the id is synthesized from where the def sits in the tree. That
// synthesized form is what makes this module necessary: it used to be spelled
// out separately in the engine, in the collapsible-group metadata, and in the
// group-header derivation, and the copies did not agree. The engine keyed
// columns by `<parent>_<depth>_<index>` while the other two used
// `<parent>_d_<index>`, so for an unnamed column every cross-lookup missed -
// `columnGroupShow` never hid it, and its group header measured nothing.
//
// Anything that needs a column's id derives it here.

/**
 * The id the grid engine assigns to a column def.
 *
 * @param def       the column def (only `id` / `field` are read)
 * @param parentId  id of the enclosing column group, if any
 * @param depth     nesting depth of `def` - 0 at the top level
 * @param index     position of `def` within its own sibling array
 */
export function resolveColumnId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: any,
  parentId: string | undefined,
  depth: number,
  index: number,
): string {
  return def.id ?? def.field ?? `${parentId ?? "col"}_${depth}_${index}`;
}
