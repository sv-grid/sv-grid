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
 *
 * A field type (`@svgrid/enterprise/fields`, SvGrid Base) counts as plain
 * text when its type draws no cell of its own (single line text, email,
 * number...): the check runs on the column as the fields module fills it in,
 * the way the grid will see it.
 */
import { formatValueForExport, getGridExtension, renderComponent } from '@svgrid/grid'
import { visibleSpaces } from './cluster'
import GhostCell from './GhostCell.svelte'
import type { Proposal } from './types'

type Ghostable = { pendingFor(rowId: string, field: string): Proposal | undefined }

/**
 * Whether wrapping this column's `cell` keeps the rest of its cells as they
 * were. `columns` is every leaf column, which a field type's fill may read.
 */
export function canGhost(raw: any, sample?: unknown, columns: ReadonlyArray<any> = []): boolean {
  if (!raw || raw.columns?.length) return false
  const ext = getGridExtension()
  // The grid draws a field type's own cell when the module has one for it;
  // otherwise the column draws as an ordinary one.
  if (raw.fieldType && raw.cell == null && ext?.cell && ext.hasCell?.(raw) !== false) return false
  const def = raw.fieldType && ext?.column ? ext.column(raw, columns) : raw
  const field = def.field ?? def.id
  if (!field || def.sparkline) return false
  if (raw.cell != null) return true
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
  const leaves = leafColumns(cols)
  let changed = false
  const out = cols.map((def: any) => {
    if (def?.columns?.length) {
      const inner = wrapColumns(def.columns, fields, review, sample)
      if (inner === def.columns) return def
      changed = true
      return { ...def, columns: inner }
    }
    const field = def?.field ?? def?.id
    if (!fields.has(field) || !canGhost(def, sample(field), leaves)) return def
    changed = true
    const original = def.cell
    return {
      ...def,
      // Grids published before the core refreshed `columnDef` on a soft
      // cache hit (`getAllColumns` in core.ts) kept a reused column's old
      // `cell`, and the peer range admits them. A fresh `fieldProps` object
      // makes those rebuild the column (same id, so no state resets). A field
      // type reads its settings from it; the copy holds the same ones.
      fieldProps: { ...def.fieldProps },
      cell: (ctx: any) => {
        const own = typeof original === 'function' ? original(ctx) : original
        const p = review.pendingFor(String(ctx.row.id), field)
        if (!p) return own
        // The column as the grid holds it: a field type's format is filled in after this wrap.
        const format = ctx.column?.columnDef?.format ?? def.format
        return renderComponent(GhostCell, {
          own,
          before: ctx.getValue(),
          after: formatValueForExport(p.after, format),
          beforeText: typeof ctx.getValue() === 'string' && !format
            ? visibleSpaces(ctx.getValue())
            : formatValueForExport(ctx.getValue(), format),
          reason: p.reason,
          source: p.source.label,
        })
      },
    }
  })
  return changed ? (out as unknown as C) : cols
}

function leafColumns(cols: ReadonlyArray<any>): any[] {
  return cols.flatMap((c) => (c?.columns?.length ? leafColumns(c.columns) : [c]))
}
