/**
 * CSV / formula injection guard, shared by the grid's CSV and TSV exports and
 * the chart's CSV download. Its own module so the chart does not pull in the
 * whole export serializer for one function.
 */

/** A signed number, as a formatter writes one: `-5`, `+1,234.50`, `-$12`, `-4.5 %`. */
const SIGNED_NUMBER = /^[+-]\s*\p{Sc}?\s*\d[\d.,\s  ]*(?:e[+-]?\d+)?\s*%?\s*\p{Sc}?$/iu

/**
 * The OWASP rule for CSV injection: a cell a spreadsheet would read as a
 * formula (it starts with `=`, `+`, `-`, `@`, a tab or a carriage return) gets
 * a leading `'`, so it opens as text. A signed number in text form is kept as
 * written, or every negative amount in a formatted export would come out as
 * text. Callers apply it to text values only: a number cannot start a formula.
 */
export function escapeFormulaCell(s: string): string {
  const c = s.charCodeAt(0)
  // = + - @ \t \r
  if (c !== 61 && c !== 43 && c !== 45 && c !== 64 && c !== 9 && c !== 13) return s
  if ((c === 43 || c === 45) && SIGNED_NUMBER.test(s)) return s
  return "'" + s
}
