/**
 * Filter checklist labels - the column filter's value list shows each value
 * the way its cell shows it, while the filter still matches the raw value. A
 * status stored as MARKED_AS_FAILED and drawn as "Failed" is offered as
 * "Failed", so a column's accessor can stay the raw value that sorting needs.
 *
 * The label comes from the first of these the column has: a `cell` renderer
 * that returns a string, static `editorOptions` labels, then `formatter` /
 * `format`. Text values are ordered by label; number and date values stay in
 * value order. It plugs into the grid's `facetOptions` seam, which runs in the
 * menu chunk.
 *
 * ```ts
 * import { enableFilterLabels } from '@svgrid/enterprise'
 * enableFilterLabels()
 * ```
 */
import { columnDataType, registerGridExtension } from '@svgrid/grid'
import { hasValidLicense } from './license'
import { emitUnlicensedNudge } from './watermark'

type FacetOption = { value: string; label: string; hint?: string }

/** The text a cell shows for `raw` in `row`, or null when the column draws markup only. */
function cellText(ctrl: any, column: any, raw: unknown, row: any): string | null {
  const def = column.columnDef
  if (typeof def.cell === 'function') {
    const rendered = def.cell({
      cell: { id: `${row.id}_${column.id}`, row, column, getValue: () => raw, getContext: () => ({}) },
      row,
      column,
      table: ctrl.grid,
      getValue: () => raw,
    })
    if (typeof rendered === 'string' || typeof rendered === 'number') return String(rendered)
  }
  // Static lists only: a function or promise source would fetch.
  if (Array.isArray(def.editorOptions)) return ctrl.formatListCellValue(column, raw, row)
  if (def.formatter || def.format) return ctrl.formatCellValue(column, raw, row)
  return null
}

/**
 * The checklist as the cells show it. Exported for tests and for a custom
 * menu; `enableFilterLabels` wires it into every grid.
 */
export function labelFacetOptions(ctrl: any, column: any, options: ReadonlyArray<FacetOption>): FacetOption[] {
  // One row per distinct value, found once per menu open.
  const wanted = new Set(options.map((o) => o.value))
  const rowFor = new Map<string, { raw: unknown; row: any }>()
  for (const row of ctrl.grid.getRowModel().rows as any[]) {
    if (rowFor.size === wanted.size) break
    const raw = row.getCellValueByColumnId(column.id)
    const key = String(raw ?? '')
    if (wanted.has(key) && !rowFor.has(key)) rowFor.set(key, { raw, row })
  }
  const out = options.map((o) => {
    const hit = o.value === '' ? undefined : rowFor.get(o.value)
    const text = hit ? cellText(ctrl, column, hit.raw, hit.row) : null
    return text == null ? o : { ...o, label: text }
  })
  // Numbers and dates keep value order ("$1,000" would collate before "$200").
  const type = columnDataType(column.columnDef)
  if (type === 'number' || type === 'date' || type === 'dateString') return out
  return out.sort((a, b) =>
    a.value === '' || b.value === ''
      ? (a.value === '' ? 0 : 1) - (b.value === '' ? 0 : 1)
      : a.label.localeCompare(b.label, undefined, { numeric: true }),
  )
}

let enabled = false

/**
 * Label every grid's filter checklists as their cells show them. Idempotent;
 * also invoked by {@link installEnterprise}.
 */
export function enableFilterLabels(): void {
  if (enabled) return
  enabled = true
  registerGridExtension({ facetOptions: labelFacetOptions })
  if (!hasValidLicense()) emitUnlicensedNudge()
}
