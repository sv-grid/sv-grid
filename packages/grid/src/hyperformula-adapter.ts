/**
 * HyperFormula adapter — Excel-class formula evaluation for SvGrid.
 *
 * `hyperformula` is an OPTIONAL peer dependency. Consumers who want
 * full Excel-compatible formulas install it themselves:
 *
 * ```bash
 *   pnpm add hyperformula
 * ```
 *
 * The adapter wraps an HF instance around the grid's flat-row data:
 *
 *   - Treats each `data[]` row as a spreadsheet row
 *   - Each registered field maps to a spreadsheet column
 *   - Values that start with `=` are evaluated by HF
 *   - The adapter returns the computed rows ready to render
 *   - On edit, call `update(rowIdx, field, value)` and the adapter
 *     re-evaluates only the cells HF tells it are dirty
 *
 * Why not bundle HF: it's ~1MB minified and 99% of grids never need it.
 * Keeping it peer-optional means tiny default bundle + heavy-formula
 * users get the ~400 functions (VLOOKUP, INDIRECT, IFS, XLOOKUP, full
 * date/time/financial libraries) on demand.
 */

/** Minimal HF type surface this adapter uses. Mirrored here (rather
 *  than importing) so consumers without `hyperformula` installed still
 *  type-check. */
export type HyperFormulaInstance = {
  setCellContents(
    cell: { sheet: number; row: number; col: number },
    contents: unknown,
  ): Array<{ address: { sheet: number; row: number; col: number }; newValue: unknown }>
  getCellValue(cell: { sheet: number; row: number; col: number }): unknown
  /** Bulk-load an entire sheet in one call (one recalc instead of one per
   *  cell). Optional so minimal / mock instances still satisfy the type;
   *  the adapter falls back to per-cell `setCellContents` when it's absent. */
  setSheetContent?(sheetId: number, values: unknown[][]): unknown
  destroy(): void
  rebuildAndRecalculate(): void
}

export type HyperFormulaSheetConfig<T extends Record<string, unknown>> = {
  /** The HF instance the consumer constructed (so they pick the
   *  license key + options). */
  hyperformula: HyperFormulaInstance
  /** Sheet index inside the HF instance. Default 0. */
  sheetId?: number
  /** Source rows. Cell values starting with `=` are evaluated. */
  rows: T[]
  /** Ordered list of fields to expose to the formula engine. The
   *  order determines the HF column index, which is how A1-style
   *  references resolve. */
  fields: ReadonlyArray<keyof T & string>
}

export type HyperFormulaSheet<T extends Record<string, unknown>> = {
  /** Rows with every `=...` formula replaced by its evaluated value.
   *  Use this in a custom cell renderer to DISPLAY the result. */
  computed: T[]
  /** Rows with formulas kept as their raw `=SUM(...)` strings.
   *  Pass this as `<SvGrid data={...}>` so the inline editor lets the
   *  user edit the formula text itself, not the evaluated value. */
  raw: T[]
  /** Call when a cell edit lands. Returns the new computed + raw
   *  snapshots so the consumer can reassign both. */
  update(rowIndex: number, field: keyof T & string, value: unknown): {
    computed: T[]
    raw: T[]
  }
  /** Tear the adapter + the HF instance down (releases memory). */
  destroy(): void
}

/** Build a live spreadsheet adapter around a HyperFormula instance.
 *  Returns computed rows + an `update()` hook to push edits back into
 *  the engine. */
export function createHyperFormulaSheet<T extends Record<string, unknown>>(
  config: HyperFormulaSheetConfig<T>,
): HyperFormulaSheet<T> {
  const { hyperformula: hf, rows, fields } = config
  const sheetId = config.sheetId ?? 0
  const colByField = new Map<string, number>()
  fields.forEach((f, i) => colByField.set(f as string, i))

  // 1. Seed HF with every cell. HF expects raw strings for formulas
  //    (`'=A1+B1'`) and primitives for everything else. Prefer a single bulk
  //    `setSheetContent` write - it recalculates ONCE instead of once per
  //    setCellContents, ~3x faster to mount a large sheet (e.g. 200x26). Fall
  //    back to per-cell for instances that don't expose it.
  if (typeof hf.setSheetContent === 'function') {
    const grid = rows.map((row) => fields.map((f) => row[f as keyof T]))
    hf.setSheetContent(sheetId, grid)
  } else {
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r]!
      for (let c = 0; c < fields.length; c += 1) {
        const field = fields[c]! as string
        hf.setCellContents({ sheet: sheetId, row: r, col: c }, row[field as keyof T])
      }
    }
  }

  /** Pull computed values out of HF into a fresh row array. Preserves
   *  any non-formula fields (i.e. those not in `fields`) untouched. */
  function snapshot(): T[] {
    const out: T[] = new Array(rows.length)
    for (let r = 0; r < rows.length; r += 1) {
      const next: Record<string, unknown> = { ...rows[r]! }
      for (let c = 0; c < fields.length; c += 1) {
        const field = fields[c]! as string
        const v = hf.getCellValue({ sheet: sheetId, row: r, col: c })
        next[field] = v
      }
      out[r] = next as T
    }
    return out
  }

  function rawSnapshot(): T[] {
    return rows.map((r) => ({ ...r }))
  }
  return {
    computed: snapshot(),
    raw: rawSnapshot(),
    update(rowIndex, field, value) {
      const col = colByField.get(field as string)
      if (col !== undefined) {
        hf.setCellContents({ sheet: sheetId, row: rowIndex, col }, value)
      }
      rows[rowIndex] = { ...rows[rowIndex]!, [field]: value } as T
      return { computed: snapshot(), raw: rawSnapshot() }
    },
    destroy() { hf.destroy() },
  }
}
