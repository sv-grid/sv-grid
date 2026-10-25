/**
 * Bounds for reading an .xlsx file, shared by `importData` and the
 * spreadsheet's `documentFromXlsx`.
 *
 * Both readers build dense rows, filling the gap before a cell with blanks so
 * columns stay aligned. The gap comes from the file: `<c r="ZZZZZZZ1">` asked
 * for about eight billion blanks and took the tab down. A real cell costs bytes
 * in the file; a blank costs nothing, so the blanks are what is budgeted.
 */

/** The last row a spreadsheet has (row 1,048,576). */
export const XLSX_MAX_ROWS = 1_048_576
/** The last column a spreadsheet has (column XFD). */
export const XLSX_MAX_COLS = 16_384
/** Blank cells a reader may add to fill gaps, across the whole sheet. */
export const XLSX_MAX_FILL = 10_000_000

export function xlsxRangeError(ref: string): Error {
  return new Error(
    `@svgrid/enterprise: cell ${ref} is outside the sheet (columns A-XFD, rows 1-1,048,576); the file is not a valid .xlsx`,
  )
}

export function xlsxFillError(): Error {
  return new Error(
    `@svgrid/enterprise: the sheet's cells are spread too thinly to read (more than ${XLSX_MAX_FILL.toLocaleString('en-US')} empty cells between them)`,
  )
}
