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
/**
 * The row "Show in grid" lands on, for a moment: a stronger wash of the same amber.
 * @internal
 */
export const FLASH_BG = 'var(--sg-review-flash-bg, color-mix(in srgb, var(--sg-warning, #d97706) 32%, transparent))'
/** Drawn before the value, so a pending cell is never marked by colour alone. */
export const PENDING_ICON = '•'
/**
 * A cell two sources disagree on: a red wash (`--sg-review-conflict-bg`) and
 * a "!" before the value, so the grid shows where the panel's conflicts are.
 */
export const CONFLICT_BG = 'var(--sg-review-conflict-bg, color-mix(in srgb, var(--sg-danger, #dc2626) 12%, transparent))'
/**
 * Drawn before the value of a cell two sources disagree on.
 */
export const CONFLICT_ICON = '!'

/**
 * `conditionalFormats` rules that tint the cells of the given proposals, one
 * rule per field, scoped to that field's columns. `review.formats` is built
 * from it.
 */
export function pendingFormats<TData>(
  pending: ReadonlyArray<Proposal>,
  rowId: (row: TData, index: number) => string,
  columns: ReadonlyArray<{ id: string; field?: string }>,
  look: { background: string; icon: string } = { background: PENDING_BG, icon: PENDING_ICON },
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
      when: ({ row }: { row: TData }) => ids.has(String(rowId(row, 0))),
      background: look.background,
      icon: look.icon,
    })
  }
  return out
}
