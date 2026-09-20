/**
 * Every string the group chrome draws: `SvGroupCell`, `SvRowGroupPanel` and
 * the text `serverGroupText` hands to copy, export and a pinned grand total.
 * Both components are mounted by the app rather than by the grid, so they
 * cannot read the grid's `localization.text`; pass the same partial map to
 * each (and to `serverGroupText`) and every string follows.
 *
 * `{count}`, `{label}`, `{index}` and `{total}` are substituted where the
 * default shows them.
 */
export type ServerGroupMessages = {
  /** The "load more" row of a level that pages by click: `Load {count} more`. */
  loadMore: string
  /** The same row while its block is in flight. */
  loading: string
  /** The subtotal footer under an expanded group: `Total {label}`. */
  total: string
  /** The grand-total row. */
  grandTotal: string
  /** The accessible name of the row-group panel. */
  rowGroups: string
  /** The panel's leading label. */
  groupBy: string
  /** The panel's empty text. */
  dropHere: string
  /** The first option of the add-a-column select. */
  addGroup: string
  /** The accessible name of that select. */
  addGroupLabel: string
  /** A chip's accessible name: `{label}`, `{index}`, `{total}`. */
  groupedBy: string
  /** A chip's remove button: `{label}`. */
  stopGroupingBy: string
  /** A live announcement after a keyboard reorder: `{label}`, `{index}`, `{total}`. */
  movedTo: string
  /** The accessible name of the Apply / Cancel pair (deferred mode). */
  applyGrouping: string
  apply: string
  cancel: string
}

export const defaultServerGroupMessages: ServerGroupMessages = {
  loadMore: 'Load {count} more',
  loading: 'Loading...',
  total: 'Total {label}',
  grandTotal: 'Grand total',
  rowGroups: 'Row groups',
  groupBy: 'Group by:',
  dropHere: 'Drag a column here to group by it',
  addGroup: '+ Group by',
  addGroupLabel: 'Add a group column',
  groupedBy: 'Grouped by {label}, position {index} of {total}. Press Alt+Arrow keys to reorder.',
  stopGroupingBy: 'Stop grouping by {label}',
  movedTo: '{label} moved to position {index} of {total}',
  applyGrouping: 'Apply grouping',
  apply: 'Apply',
  cancel: 'Cancel',
}

/** Merge a partial map over the English defaults; empty or missing keys keep the default. */
export function resolveServerGroupMessages(
  overrides?: Partial<ServerGroupMessages> | null,
): ServerGroupMessages {
  // The same merge the grid's resolveMessages does, kept local: the unit
  // test project must not pull the grid's root barrel into a server module.
  if (!overrides) return defaultServerGroupMessages
  const out = { ...defaultServerGroupMessages }
  for (const k of Object.keys(overrides) as Array<keyof ServerGroupMessages>) {
    const v = overrides[k]
    if (v != null && v !== '') out[k] = v
  }
  return out
}

/** Substitute `{name}` placeholders. Unknown placeholders are left as they are. */
export function fillMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m))
}
