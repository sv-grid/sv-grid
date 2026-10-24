/**
 * The proposed value drawn in its cell, then the current value struck
 * through.
 *
 * Done by wrapping a column's `cell` template, which needs no free-grid seam.
 * But setting `cell` turns off the grid's own drawing for the whole column:
 * field types, checkboxes, list/chips, sparklines and booleans
 * (`SvGrid.svelte`, every branch gated on `cell == null`). So only columns
 * that already have a `cell`, or draw plain text, are wrapped. The rest keep
 * the tint and the glyph from `formats.ts`.
 */
import { formatValueForExport, renderComponent } from '@svgrid/grid'
import GhostCell from './GhostCell.svelte'
import type { Proposal } from './types'

type Ghostable = { pendingFor(rowId: string, field: string): Proposal | undefined }

/** Whether wrapping this column's `cell` keeps the rest of its cells as they were. */
export function canGhost(def: any, sample?: unknown): boolean {
  if (!def || def.columns?.length) return false
  const field = def.field ?? def.id
  if (!field || def.fieldType || def.sparkline) return false
  if (def.cell != null) return true
  if (def.editorType === 'checkbox' || def.editorType === 'list' || def.editorType === 'chips') return false
  if (def.cellDataType === 'boolean' || typeof sample === 'boolean') return false
  return true
}

/**
 * Wrap the `cell` of every ghostable column whose field has a pending
 * proposal. Returns the same array when nothing needs wrapping.
 */
export function wrapColumns<C extends ReadonlyArray<any>>(
  cols: C,
  fields: ReadonlySet<string>,
  review: Ghostable,
  sample: (field: string) => unknown = () => undefined,
): C {
  if (!fields.size) return cols
  let changed = false
  const out = cols.map((def: any) => {
    if (def?.columns?.length) {
      const inner = wrapColumns(def.columns, fields, review, sample)
      if (inner === def.columns) return def
      changed = true
      return { ...def, columns: inner }
    }
    const field = def?.field ?? def?.id
    if (!fields.has(field) || !canGhost(def, sample(field))) return def
    changed = true
    const original = def.cell
    return {
      ...def,
      // Grids published before the core refreshed `columnDef` on a soft
      // cache hit (`getAllColumns` in core.ts) kept a reused column's old
      // `cell`, and the peer range admits them. A fresh `fieldProps` object
      // makes those rebuild the column (same id, so no state resets). It is
      // read only for `fieldType` columns, which are never wrapped.
      fieldProps: { ...def.fieldProps },
      cell: (ctx: any) => {
        const own = typeof original === 'function' ? original(ctx) : original
        const p = review.pendingFor(String(ctx.row.id), field)
        if (!p) return own
        return renderComponent(GhostCell, {
          own,
          before: ctx.getValue(),
          after: formatValueForExport(p.after, def.format),
          beforeText: formatValueForExport(ctx.getValue(), def.format),
          reason: p.reason,
          source: p.source.label,
        })
      },
    }
  })
  return changed ? (out as unknown as C) : cols
}
