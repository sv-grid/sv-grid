/**
 * A1 addressing, with absolute and relative parts kept apart.
 *
 * Every demo copy of this engine does `part.replace(/\$/g, '')` and then treats
 * what is left as relative, so `$A$1` parses and evaluates as `A1`. Nothing
 * notices while nothing translates a formula. The moment fill-down, copy/paste
 * or insert-row exists, `=$A$1*B2` copied down starts reading the wrong cell
 * and quietly returns a plausible wrong number, which is the worst failure mode
 * a spreadsheet has.
 *
 * So `$` is structure here, not noise: `parseA1` reports which halves were
 * pinned, and `refs.ts` is the only module allowed to move the unpinned ones.
 *
 * Rows and columns are 0-based internally (`A1` is `{ row: 0, col: 0 }`) and
 * 1-based on the wire, which is the same convention the grid's selection model
 * uses so nothing has to convert at the boundary.
 */

/** A parsed cell reference. `row: null` means a whole-column ref (`A:A`). */
export type CellRef = {
  col: number
  colAbs: boolean
  /** null for a column-only reference. */
  row: number | null
  rowAbs: boolean
  /** null means "the sheet the formula lives on". */
  sheet: string | null
}

/** 0-based column index to letters: 0 -> A, 25 -> Z, 26 -> AA. */
export function colToLetters(col: number): string {
  if (!Number.isInteger(col) || col < 0) return ''
  let n = col
  let out = ''
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  }
  return out
}

/** Letters to a 0-based column index. Returns -1 for anything unparseable. */
export function lettersToCol(letters: string): number {
  if (!letters || !/^[A-Za-z]+$/.test(letters)) return -1
  let col = 0
  for (const ch of letters.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64)
  return col - 1
}

const REF_RE = /^(\$?)([A-Za-z]+)(?:(\$?)(\d+))?$/

/**
 * Parse one reference part: `A1`, `$A$1`, `A$1`, `$A1`, or a bare column `A`.
 * Returns null when the text is not a reference at all, which is how the
 * tokenizer tells a reference from a bare name.
 */
export function parseA1(text: string, sheet: string | null = null): CellRef | null {
  const m = REF_RE.exec(text)
  if (!m) return null
  const col = lettersToCol(m[2]!)
  if (col < 0) return null
  const rowText = m[4]
  if (rowText === undefined) {
    return { col, colAbs: m[1] === '$', row: null, rowAbs: false, sheet }
  }
  const row = Number(rowText) - 1
  // Row 0 does not exist in A1 notation; `A0` is a name, not a reference.
  if (!Number.isInteger(row) || row < 0) return null
  return { col, colAbs: m[1] === '$', row, rowAbs: m[3] === '$', sheet }
}

/** Render a reference back to A1, `$` included, sheet prefix and all. */
export function formatA1(ref: CellRef): string {
  const col = `${ref.colAbs ? '$' : ''}${colToLetters(ref.col)}`
  const cell = ref.row === null ? col : `${col}${ref.rowAbs ? '$' : ''}${ref.row + 1}`
  if (ref.sheet === null) return cell
  return `${quoteSheet(ref.sheet)}!${cell}`
}

/** A sheet name needs quoting unless it is a bare word. */
export function quoteSheet(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`
}

/** True when the reference points outside a sheet of this size. */
export function isOutOfBounds(ref: CellRef, rowCount: number, colCount: number): boolean {
  if (ref.col < 0 || ref.col >= colCount) return true
  if (ref.row === null) return false
  return ref.row < 0 || ref.row >= rowCount
}
