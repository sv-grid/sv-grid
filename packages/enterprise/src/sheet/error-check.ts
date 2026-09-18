/**
 * Excel's Error Checking: the sheet read once, the cells worth a second
 * look listed in reading order.
 *
 * Two findings, both Excel's own. A cell whose formula works out to an
 * error is the obvious one, and the dialog says what the error means rather
 * than leaving `#VALUE!` to be looked up. A formula that breaks the pattern
 * of the ones above and below it is the useful one: it is how a total that
 * was dragged one row short, or a cell overtyped with a constant, is found
 * in a column of two hundred that all look alike.
 *
 * Kept out of the shell so it can be tested on a workbook and run by
 * anything else that wants the list: a save-time check, a report, an agent.
 */
import { isError, type CellValue, type SheetError } from './ast'
import { translateFormula } from './refs'

export type ErrorFindingKind = 'error' | 'inconsistent'

export type ErrorFinding = {
  sheet: string
  row: number
  col: number
  kind: ErrorFindingKind
  /** The cell's text, which is the formula for both kinds. */
  text: string
  /** The error in the cell, for `kind: 'error'`. */
  error?: SheetError
  /** What the column's own pattern says the formula would be, for
   *  `kind: 'inconsistent'`. */
  expected?: string
}

/** What each error means, in a sentence, the way Excel's dialog explains it. */
export const ERROR_MEANINGS: Record<SheetError, string> = {
  '#REF!': 'The formula points at a cell that is no longer there, usually because a row, a column or a sheet was deleted.',
  '#CYCLE!': 'The formula depends on its own cell, directly or through others. Turn on iterative calculation if the loop is meant.',
  '#DIV/0!': 'Something is divided by zero, or by a blank cell, which counts as zero.',
  '#VALUE!': 'An argument is the wrong kind: text where a number is needed, most often.',
  '#NAME?': 'A name in the formula is not known: a misspelled function, a defined name that does not exist, or text left without quotes.',
  '#NUM!': 'The numbers are out of range for what was asked: a root of a negative, or a value too large to hold.',
  '#N/A': 'A lookup found nothing. This is the answer, not a fault, when the value really is not there.',
  '#PARSE!': 'The formula could not be read. A bracket or a quote is usually missing.',
  '#SPILL!': 'The answer is a block, and something is in the way of it. Clear the cells the outline covers.',
  '#CALC!': 'The answer is a block the sheet cannot hold: an empty array, or an array inside an array.',
}

export type SheetReader = {
  rowCount(): number
  colCount(): number
  getRaw(row: number, col: number): string
  getValue(row: number, col: number): CellValue
}

/**
 * Every cell worth a look on one sheet, in reading order.
 *
 * `inconsistent` is deliberately quiet: a formula is only called the odd one
 * out when the cells above and below it both hold formulas, those two agree
 * with each other once translated, and this one does not. That is the shape
 * of a column filled down and then broken in the middle, and it is the only
 * shape reported, because an auditing tool that cries wolf is turned off.
 */
export function checkSheet(sheet: string, read: SheetReader): ErrorFinding[] {
  const out: ErrorFinding[] = []
  const rows = read.rowCount()
  const cols = read.colCount()
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const text = read.getRaw(row, col).trim()
      if (!text.startsWith('=')) continue
      const value = read.getValue(row, col)
      if (isError(value)) {
        out.push({ sheet, row, col, kind: 'error', text, error: value.error })
        continue
      }
      const expected = inconsistentWith(read, row, col, text)
      if (expected !== null) out.push({ sheet, row, col, kind: 'inconsistent', text, expected })
    }
  }
  return out
}

/** The formula this cell would hold if it followed its neighbours, or null
 *  when it already does or there is no pattern to follow. */
function inconsistentWith(read: SheetReader, row: number, col: number, text: string): string | null {
  if (row < 1) return null
  const above = read.getRaw(row - 1, col).trim()
  const below = read.getRaw(row + 1, col).trim()
  if (!above.startsWith('=') || !below.startsWith('=')) return null
  const expected = translateFormula(above, 1, 0)
  if (typeof expected !== 'string') return null
  // The neighbours have to agree with each other, or there is no pattern.
  if (translateFormula(above, 2, 0) !== below) return null
  return expected === text ? null : expected
}

/** One line saying what is wrong with a cell, for a dialog or a log. */
export function describeFinding(finding: ErrorFinding): string {
  if (finding.kind === 'error') return ERROR_MEANINGS[finding.error ?? '#VALUE!']
  return `This formula is not the one the cells above and below it use. Theirs would read ${finding.expected} here.`
}
