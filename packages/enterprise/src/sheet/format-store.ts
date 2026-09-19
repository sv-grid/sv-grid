/**
 * Per-cell formats and styles, keyed so they survive the grid moving rows
 * around.
 *
 * Demo 27 keys its format map by DISPLAY row index. Sort the grid and every
 * bold cell moves to whatever row now sits at that index, which is the kind of
 * bug that looks like a rendering glitch and is actually lost data. This keys
 * by `rowId:columnId`, the same shape the grid already uses for `notes`, so
 * sorting, filtering, column reordering and pagination all leave it alone.
 *
 * Storage is sparse: a sheet of ten thousand cells with three bold ones holds
 * three entries. Most cells have no entry at all and cost nothing.
 */
// Type-only, so it is erased at build time and does not pull SvGrid.svelte in.
import type { BorderSpec } from '@svgrid/grid'
import { colToLetters } from './address'

/** One cell's formatting. Every field optional; absent means inherit. */
/** The boolean fields `toggle` can flip. Every one of them is a plain
 *  on/off attribute of a cell, which is what makes Excel's all-on-turns-off
 *  rule the right one for all of them. */
export type ToggleableField = 'bold' | 'italic' | 'underline' | 'strike' | 'wrap'

export type CellFormatEntry = {
  /** Excel number-format string, e.g. '#,##0.00'. */
  numFmt?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** Text colour, any CSS colour. */
  color?: string
  /** Background fill. */
  fill?: string
  align?: 'left' | 'center' | 'right'
  fontFamily?: string
  fontSize?: number
  wrap?: boolean
  indent?: number
  border?: {
    top?: BorderSpec
    right?: BorderSpec
    bottom?: BorderSpec
    left?: BorderSpec
  }
  /**
   * Excel's Locked flag from Format Cells > Protection. Every cell is locked
   * unless told otherwise, so only `false` is ever stored; the flag means
   * nothing until the sheet is protected, when a locked cell refuses edits.
   */
  locked?: boolean
}

export type Rect = readonly [minRow: number, minCol: number, maxRow: number, maxCol: number]

/** Translates a display position to the stable ids the store keys on. */
export type CellAddressLookup = {
  rowIdAt(rowIndex: number): string | null
  columnIdAt(colIndex: number): string | null
}

export type SheetFormatStore = {
  get(rowId: string, columnId: string): CellFormatEntry | undefined
  /** Merge `patch` into every cell of every rect. A field set to `undefined`
   *  is REMOVED, which is how you clear one attribute without clearing the
   *  cell; `clear` removes the whole entry. An entry left with no fields is
   *  dropped rather than kept as an empty object. */
  set(rects: ReadonlyArray<Rect>, patch: CellFormatEntry, at: CellAddressLookup): void
  /** Remove all formatting from every cell of every rect. */
  clear(rects: ReadonlyArray<Rect>, at: CellAddressLookup): void
  /** Toggle one boolean field across a range. Excel's rule: if EVERY cell in
   *  the range already has it, turn it off; otherwise turn it on. */
  toggle(rects: ReadonlyArray<Rect>, field: ToggleableField, at: CellAddressLookup): void
  /** Drop every entry for a row. Call when a row is deleted, or the store
   *  leaks an entry per removed row for the life of the session. */
  forgetRow(rowId: string): void
  forgetColumn(columnId: string): void
  /** How many cells carry formatting. For tests and diagnostics. */
  readonly size: number
  serialize(): Record<string, CellFormatEntry>
  hydrate(entries: Record<string, CellFormatEntry>): void
  clearAll(): void
  /**
   * Rename every row id at once; `fn` returns the new id, or null to drop
   * the row's entries. For a store keyed on record ids this is never
   * needed - an id travels with its record - but a SHEET keys rows by
   * position (`r4` is the fifth row and nothing else), so inserting a row
   * above the fifth has to move its formats to `r5`, or the band stays on
   * row five while the cells it belonged to move down.
   */
  remapRows(fn: (rowId: string) => string | null): void
  /** The same for column ids. */
  remapColumns(fn: (columnId: string) => string | null): void
}

/**
 * Keys are "rowId columnId" with each half percent-encoded.
 *
 * Encoding is what makes the key reversible. Ids come from the grid and may
 * contain spaces, so a plain join cannot be split back apart - and `hydrate`
 * has to split it, or the row and column indexes come back empty and
 * `forgetRow` / `forgetColumn` become silent no-ops on a restored store.
 */
export function keyOf(rowId: string, columnId: string): string {
  return `${encodeURIComponent(rowId)} ${encodeURIComponent(columnId)}`
}

/** The stored key for a cell by position, for anything building a saved
 *  sheet from the outside: an importer, a fixture, a test. */
export const formatKeyAt = (row: number, col: number): string => keyOf(`r${row}`, colToLetters(col))

function splitKey(key: string): { rowId: string; columnId: string } | null {
  const gap = key.indexOf(' ')
  if (gap < 0) return null
  try {
    return {
      rowId: decodeURIComponent(key.slice(0, gap)),
      columnId: decodeURIComponent(key.slice(gap + 1)),
    }
  } catch {
    return null
  }
}

export function createFormatStore(
  initial?: Record<string, CellFormatEntry>,
): SheetFormatStore {
  const cells = new Map<string, CellFormatEntry>()
  const rowsIndex = new Map<string, Set<string>>()
  const colsIndex = new Map<string, Set<string>>()

  function remember(rowId: string, columnId: string, key: string): void {
    let byRow = rowsIndex.get(rowId)
    if (!byRow) { byRow = new Set(); rowsIndex.set(rowId, byRow) }
    byRow.add(key)
    let byCol = colsIndex.get(columnId)
    if (!byCol) { byCol = new Set(); colsIndex.set(columnId, byCol) }
    byCol.add(key)
  }

  function eachCell(
    rects: ReadonlyArray<Rect>,
    at: CellAddressLookup,
    fn: (rowId: string, columnId: string) => void,
  ): void {
    const seen = new Set<string>()
    for (const [minRow, minCol, maxRow, maxCol] of rects) {
      for (let r = minRow; r <= maxRow; r += 1) {
        const rowId = at.rowIdAt(r)
        if (rowId === null) continue
        for (let c = minCol; c <= maxCol; c += 1) {
          const columnId = at.columnIdAt(c)
          if (columnId === null) continue
          // Overlapping ranges must not apply a toggle twice.
          const key = keyOf(rowId, columnId)
          if (seen.has(key)) continue
          seen.add(key)
          fn(rowId, columnId)
        }
      }
    }
  }

  const store: SheetFormatStore = {
    get(rowId, columnId) {
      return cells.get(keyOf(rowId, columnId))
    },

    set(rects, patch, at) {
      eachCell(rects, at, (rowId, columnId) => {
        const key = keyOf(rowId, columnId)
        const next = { ...(cells.get(key) ?? {}), ...patch }
        // Strip keys explicitly set to undefined so an entry does not grow
        // a field that means nothing.
        for (const [k, v] of Object.entries(next)) {
          if (v === undefined) delete (next as Record<string, unknown>)[k]
        }
        if (Object.keys(next).length === 0) {
          cells.delete(key)
          return
        }
        cells.set(key, next)
        remember(rowId, columnId, key)
      })
    },

    clear(rects, at) {
      eachCell(rects, at, (rowId, columnId) => {
        cells.delete(keyOf(rowId, columnId))
      })
    },

    toggle(rects, field, at) {
      // Excel's rule, and the one users expect: a mixed selection turns ON.
      let all = true
      eachCell(rects, at, (rowId, columnId) => {
        if (!cells.get(keyOf(rowId, columnId))?.[field]) all = false
      })
      // `set` treats undefined as "remove this field", so one pass does both
      // directions.
      store.set(rects, { [field]: all ? undefined : true } as CellFormatEntry, at)
    },

    forgetRow(rowId) {
      for (const key of rowsIndex.get(rowId) ?? []) cells.delete(key)
      rowsIndex.delete(rowId)
    },

    forgetColumn(columnId) {
      for (const key of colsIndex.get(columnId) ?? []) cells.delete(key)
      colsIndex.delete(columnId)
    },

    get size() {
      return cells.size
    },

    serialize() {
      return Object.fromEntries(cells)
    },

    hydrate(entries) {
      cells.clear()
      rowsIndex.clear()
      colsIndex.clear()
      for (const [key, entry] of Object.entries(entries)) {
        cells.set(key, entry)
        // Rebuild the indexes, or forgetRow / forgetColumn do nothing on a
        // store that came back from storage.
        const parts = splitKey(key)
        if (parts) remember(parts.rowId, parts.columnId, key)
      }
    },

    clearAll() {
      cells.clear()
      rowsIndex.clear()
      colsIndex.clear()
    },

    remapRows(fn) {
      const next: Record<string, CellFormatEntry> = {}
      for (const [key, entry] of cells) {
        const parts = splitKey(key)
        if (!parts) continue
        const rowId = fn(parts.rowId)
        if (rowId !== null) next[keyOf(rowId, parts.columnId)] = entry
      }
      store.hydrate(next)
    },

    remapColumns(fn) {
      const next: Record<string, CellFormatEntry> = {}
      for (const [key, entry] of cells) {
        const parts = splitKey(key)
        if (!parts) continue
        const columnId = fn(parts.columnId)
        if (columnId !== null) next[keyOf(parts.rowId, columnId)] = entry
      }
      store.hydrate(next)
    },
  }

  if (initial) store.hydrate(initial)
  return store
}

/** Turn an entry into inline style text for a cell renderer. */
export function entryToStyle(entry: CellFormatEntry | undefined): string {
  if (!entry) return ''
  const parts: string[] = []
  if (entry.bold) parts.push('font-weight:700')
  if (entry.italic) parts.push('font-style:italic')
  if (entry.underline && entry.strike) parts.push('text-decoration:underline line-through')
  else if (entry.underline) parts.push('text-decoration:underline')
  else if (entry.strike) parts.push('text-decoration:line-through')
  if (entry.color) parts.push(`color:${entry.color}`)
  if (entry.fill) parts.push(`background:${entry.fill}`)
  if (entry.align) parts.push(`text-align:${entry.align}`)
  if (entry.fontFamily) parts.push(`font-family:${entry.fontFamily}`)
  if (entry.fontSize) parts.push(`font-size:${entry.fontSize}px`)
  if (entry.wrap) parts.push('white-space:pre-wrap')
  if (entry.indent) parts.push(`padding-left:${entry.indent * 12}px`)
  const borders = borderShadows(entry.border)
  if (borders) parts.push(`box-shadow:${borders}`)
  return parts.join(';')
}

/**
 * Cell borders as inset shadows, one per side.
 *
 * The cell span fills its td edge to edge, so an inset shadow along one
 * edge is a border that costs no layout: a real border would push the text
 * and change the cell's size, and a bordered cell next to a plain one would
 * misalign. Shadows stack, so a cell can carry any combination of sides.
 */
export function borderShadows(border: CellFormatEntry['border']): string {
  if (!border) return ''
  const parts: string[] = []
  const line = (spec: { width?: number; color?: string } | undefined) => ({
    w: spec?.width ?? 1,
    c: spec?.color ?? 'currentColor',
  })
  if (border.top) { const { w, c } = line(border.top); parts.push(`inset 0 ${w}px 0 0 ${c}`) }
  if (border.bottom) { const { w, c } = line(border.bottom); parts.push(`inset 0 -${w}px 0 0 ${c}`) }
  if (border.left) { const { w, c } = line(border.left); parts.push(`inset ${w}px 0 0 0 ${c}`) }
  if (border.right) { const { w, c } = line(border.right); parts.push(`inset -${w}px 0 0 0 ${c}`) }
  return parts.join(',')
}
