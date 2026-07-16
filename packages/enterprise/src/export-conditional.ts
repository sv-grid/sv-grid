/**
 * Carry the grid's conditional formatting (color scales, data bars, icon sets,
 * predicate rules) into the styled export formats - PDF, xlsx, HTML, and the
 * print view. The grid's engine (`resolveCellFormat`) is pure and reused here
 * via the Svelte-free `@svgrid/grid/format` subpath; this module turns a
 * `ResolvedCellFormat` into the primitives the exporters can render:
 * `{ fill, color, bold, icon }`.
 *
 * Data formats (csv / tsv / json / xml / md) are unstyled, so conditional
 * formatting is ignored there. Data bars can't render as partial-width bars in
 * a spreadsheet cell / PDF cell, so they degrade to a light fill of the bar
 * color; icon sets prepend the icon glyph to the cell text.
 */
import {
  computeColumnStat,
  formatsNeedingStats,
  resolveCellFormat,
  type ColumnStat,
  type ConditionalFormat,
  type ResolvedCellFormat,
} from '@svgrid/grid/format'
import type { RowData } from '@svgrid/grid'
import type { ExportColumn } from './export'

/** The visual primitives an exporter can apply to one cell. */
export type ExportCellVisual = {
  fill?: string
  color?: string
  bold?: boolean
  /** Icon-set glyph to prepend to the cell text. */
  icon?: string
}

export type ExportCellVisualFn = (rowIdx: number, colIdx: number) => ExportCellVisual | undefined

/** Lighten a hex color toward white by `amt` (0..1). Returns input if unparseable. */
function mixWhite(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const int = parseInt(m[1]!, 16)
  const ch = [(int >> 16) & 255, (int >> 8) & 255, int & 255]
  return (
    '#' +
    ch.map((c) => Math.round(c + (255 - c) * amt).toString(16).padStart(2, '0')).join('')
  )
}

function toVisual(resolved: ResolvedCellFormat): ExportCellVisual | undefined {
  const v: ExportCellVisual = {}
  if (resolved.background) v.fill = resolved.background
  // Data bar -> a light fill of the bar color (no partial-width bars in cells).
  if (!v.fill && resolved.dataBar) v.fill = mixWhite(resolved.dataBar.color, 0.72)
  if (resolved.color && resolved.color !== 'transparent') v.color = resolved.color
  if (
    resolved.fontWeight === 'bold' ||
    (typeof resolved.fontWeight === 'number' && resolved.fontWeight >= 600)
  ) {
    v.bold = true
  }
  if (resolved.icon) v.icon = resolved.icon
  return Object.keys(v).length > 0 ? v : undefined
}

/**
 * Precompute per-column stats (for color scales / data bars) and return a
 * `(rowIdx, colIdx) => ExportCellVisual | undefined` lookup over the given
 * rows + columns. Returns a no-op when there are no formats.
 */
export function buildConditionalResolver<TData extends RowData>(
  cols: ReadonlyArray<ExportColumn<TData>>,
  rows: ReadonlyArray<TData>,
  formats: ReadonlyArray<ConditionalFormat<TData>> | undefined,
): ExportCellVisualFn {
  if (!formats || formats.length === 0) return () => undefined

  const stats = new Map<string, ColumnStat | null>()
  if (formatsNeedingStats(formats)) {
    for (const c of cols) {
      stats.set(
        c.field,
        computeColumnStat(rows.map((r) => (r as Record<string, unknown>)[c.field])),
      )
    }
  }

  return (rowIdx, colIdx) => {
    const col = cols[colIdx]
    const row = rows[rowIdx]
    if (!col || !row) return undefined
    const raw = (row as Record<string, unknown>)[col.field]
    const resolved = resolveCellFormat(raw, row, col.field, formats, stats.get(col.field) ?? null)
    return toVisual(resolved)
  }
}
