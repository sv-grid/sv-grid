/**
 * The tint on cells with a pending proposal, as `conditionalFormats` rules:
 * one rule per field, scoped to that field's columns, matching rows by id.
 * Costs the free grid nothing; the app concatenates these with its own
 * formats, as `BaseTableView.svelte` does for remote changes.
 */
import type { ConditionalFormat } from '@svgrid/grid'
import type { Proposal } from './types'

/**
 * Theme it with `--sg-review-pending-bg`. The default is a light amber wash
 * from `--sg-warning`, kept apart from the accent, which themes use for
 * selection and focus.
 */
export const PENDING_BG = 'var(--sg-review-pending-bg, color-mix(in srgb, var(--sg-warning, #d97706) 13%, transparent))'
/** Drawn before the value, so a pending cell is never marked by colour alone. */
export const PENDING_ICON = '•'

export function pendingFormats<TData>(
  pending: ReadonlyArray<Proposal>,
  rowId: (row: TData, index: number) => string,
  columns: ReadonlyArray<{ id: string; field?: string }>,
): ConditionalFormat<any>[] {
  const rowsByField = new Map<string, Set<string>>()
  for (const p of pending) {
    let ids = rowsByField.get(p.field)
    if (!ids) rowsByField.set(p.field, (ids = new Set()))
    ids.add(p.rowId)
  }
  const out: ConditionalFormat<any>[] = []
  for (const [field, ids] of rowsByField) {
    const cols = columns.filter((c) => (c.field ?? c.id) === field).map((c) => c.id)
    out.push({
      type: 'rule',
      columns: cols.length ? cols : [field],
      when: ({ row }: { row: TData }) => ids.has(rowId(row, 0)),
      background: PENDING_BG,
      icon: PENDING_ICON,
    })
  }
  return out
}
