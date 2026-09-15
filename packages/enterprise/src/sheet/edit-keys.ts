/**
 * Keys that act on the text of a formula while it is being written.
 *
 * F4 in Excel cycles the reference at the caret through its four anchorings:
 * `A1` -> `$A$1` -> `A$1` -> `$A1` -> `A1`, both ends of a range together.
 * The caret counts as "at" a reference when it sits inside it or right after
 * it, which is where it is after typing one. A sheet prefix (`Orders!A1`)
 * is left as it is; only the cell part turns.
 */
export type TextEdit = { text: string; caret: number }

const CELL = String.raw`\$?[A-Za-z]{1,3}\$?\d+`
const REFERENCE = new RegExp(String.raw`(${CELL})(?::(${CELL}))?`, 'g')

/** The next anchoring in Excel's F4 order. */
function turn(cell: string): string {
  const m = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(cell)
  if (!m) return cell
  const [, colAbs, col, rowAbs, row] = m
  const state = (colAbs ? 2 : 0) + (rowAbs ? 1 : 0)
  // relative -> both -> row only -> column only -> relative
  const next = ({ 0: 3, 3: 1, 1: 2, 2: 0 } as Record<number, number>)[state]!
  return `${next & 2 ? '$' : ''}${col}${next & 1 ? '$' : ''}${row}`
}

export function cycleReference(text: string, caret: number): TextEdit | null {
  if (!text.startsWith('=')) return null
  REFERENCE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = REFERENCE.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (caret < start || caret > end) continue
    // A word character before the match means this is part of a name or a
    // function (SUM1 is not a cell), not a reference.
    const before = text[start - 1]
    if (before && /[A-Za-z0-9_.]/.test(before)) continue
    // And a parenthesis after it makes it a function call: SUM1 is a cell in
    // Excel's grid, SUM1( is not.
    if (text[end] === '(') continue
    const replaced = m[2] ? `${turn(m[1]!)}:${turn(m[2])}` : turn(m[1]!)
    return {
      text: text.slice(0, start) + replaced + text.slice(end),
      caret: start + replaced.length,
    }
  }
  return null
}
