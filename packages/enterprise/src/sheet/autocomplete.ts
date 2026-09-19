/**
 * Formula-bar autocomplete, kept out of the component so the interesting part
 * is testable without mounting anything.
 *
 * The job is narrow: given the text in the bar and where the caret is, work out
 * whether the user is partway through typing a function name, and if so which
 * ones match. Everything else (arrow keys, accepting a suggestion) is a list
 * with an index, which the component owns.
 */
import { FUNCTIONS } from './functions'
import { ARRAY_FUNCTIONS } from './packs/array'

export type FunctionSuggestion = {
  name: string
  /** Where the partial name starts, so accepting can splice it out. */
  start: number
  /** Where the caret is, i.e. where the partial name ends. */
  end: number
}

/** The evaluator dispatches these itself, so they are not in the table. */
const EVALUATOR_NAMES = ['IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH', 'ISERROR', 'ISERR', 'ISNA', 'ROW', 'COLUMN', 'ADDRESS', 'OFFSET', 'INDIRECT',
  // LET, LAMBDA and the helpers that take one: the evaluator answers these
  // itself, since a lambda is an AST rather than a value.
  'LET', 'LAMBDA', 'MAP', 'BYROW', 'BYCOL', 'REDUCE', 'SCAN', 'MAKEARRAY']
const NAMES = [...new Set([...Object.keys(FUNCTIONS), ...Object.keys(ARRAY_FUNCTIONS), ...EVALUATOR_NAMES])].sort()

/** Signature hints, for the ones whose argument order is not obvious. */
export const SIGNATURES: Record<string, string> = {
  LET: 'LET(name, value, ..., calculation)',
  LAMBDA: 'LAMBDA(parameter, ..., calculation)',
  MAP: 'MAP(array, ..., lambda)',
  BYROW: 'BYROW(array, lambda)',
  BYCOL: 'BYCOL(array, lambda)',
  REDUCE: 'REDUCE(initial, array, lambda)',
  SCAN: 'SCAN(initial, array, lambda)',
  MAKEARRAY: 'MAKEARRAY(rows, columns, lambda)',
  VLOOKUP: 'VLOOKUP(lookup, table, colIndex)',
  HLOOKUP: 'HLOOKUP(lookup, table, rowIndex)',
  XLOOKUP: 'XLOOKUP(lookup, haystack, results, [ifMissing])',
  INDEX: 'INDEX(range, row, [col])',
  MATCH: 'MATCH(lookup, range, [mode])',
  SUMIF: 'SUMIF(range, criterion, [sumRange])',
  SUMIFS: 'SUMIFS(sumRange, range, criterion, ...)',
  COUNTIF: 'COUNTIF(range, criterion)',
  COUNTIFS: 'COUNTIFS(range, criterion, ...)',
  AVERAGEIF: 'AVERAGEIF(range, criterion, [avgRange])',
  IF: 'IF(condition, then, else)',
  IFS: 'IFS(condition, value, ...)',
  IFERROR: 'IFERROR(value, fallback)',
  SWITCH: 'SWITCH(subject, case, value, ..., [default])',
  ROUND: 'ROUND(number, digits)',
  TEXT: 'TEXT(number, pattern)',
  TEXTJOIN: 'TEXTJOIN(separator, skipEmpty, ...)',
  SUBSTITUTE: 'SUBSTITUTE(text, find, replace)',
  MID: 'MID(text, start, length)',
  DATE: 'DATE(year, month, day)',
  EOMONTH: 'EOMONTH(date, months)',
  PMT: 'PMT(rate, nper, pv, [fv], [type])',
  IPMT: 'IPMT(rate, per, nper, pv, [fv], [type])',
  PPMT: 'PPMT(rate, per, nper, pv, [fv], [type])',
  PV: 'PV(rate, nper, pmt, [fv], [type])',
  FV: 'FV(rate, nper, pmt, [pv], [type])',
  NPER: 'NPER(rate, pmt, pv, [fv], [type])',
  RATE: 'RATE(nper, pmt, pv, [fv], [type], [guess])',
  NPV: 'NPV(rate, value1, ...)',
  IRR: 'IRR(values, [guess])',
  SLN: 'SLN(cost, salvage, life)',
  SUMPRODUCT: 'SUMPRODUCT(array1, [array2], ...)',
  CEILING: 'CEILING(number, significance)',
  'CEILING.MATH': 'CEILING.MATH(number, [significance], [mode])',
  FLOOR: 'FLOOR(number, significance)',
  'FLOOR.MATH': 'FLOOR.MATH(number, [significance], [mode])',
  MROUND: 'MROUND(number, multiple)',
  TRUNC: 'TRUNC(number, [digits])',
  LOG: 'LOG(number, [base])',
  RANDBETWEEN: 'RANDBETWEEN(bottom, top)',
  QUOTIENT: 'QUOTIENT(numerator, denominator)',
  LARGE: 'LARGE(range, k)',
  SMALL: 'SMALL(range, k)',
  PERCENTILE: 'PERCENTILE(range, k)',
  'PERCENTILE.INC': 'PERCENTILE.INC(range, k)',
  'PERCENTILE.EXC': 'PERCENTILE.EXC(range, k)',
  QUARTILE: 'QUARTILE(range, quart)',
  'QUARTILE.INC': 'QUARTILE.INC(range, quart)',
  'QUARTILE.EXC': 'QUARTILE.EXC(range, quart)',
  AVERAGEIFS: 'AVERAGEIFS(avgRange, range, criterion, ...)',
  MAXIFS: 'MAXIFS(maxRange, range, criterion, ...)',
  MINIFS: 'MINIFS(minRange, range, criterion, ...)',
  CORREL: 'CORREL(range1, range2)',
  SLOPE: 'SLOPE(known_ys, known_xs)',
  INTERCEPT: 'INTERCEPT(known_ys, known_xs)',
  FORECAST: 'FORECAST(x, known_ys, known_xs)',
  'FORECAST.LINEAR': 'FORECAST.LINEAR(x, known_ys, known_xs)',
  REPT: 'REPT(text, count)',
  IMAGE: 'IMAGE(source, [alt_text])',
  NUMBERVALUE: 'NUMBERVALUE(text, [decimal_separator], [group_separator])',
  REPLACE: 'REPLACE(old_text, start, count, new_text)',
  EXACT: 'EXACT(text1, text2)',
  WEEKDAY: 'WEEKDAY(date, [type])',
  EDATE: 'EDATE(date, months)',
  NETWORKDAYS: 'NETWORKDAYS(start_date, end_date, [holidays])',
  WORKDAY: 'WORKDAY(start_date, days, [holidays])',
  WEEKNUM: 'WEEKNUM(date, [type])',
  TIME: 'TIME(hour, minute, second)',
  YEARFRAC: 'YEARFRAC(start_date, end_date, [basis])',
  NA: 'NA()',
  CHOOSE: 'CHOOSE(index, value1, ...)',
  ROW: 'ROW([reference])',
  COLUMN: 'COLUMN([reference])',
  ADDRESS: 'ADDRESS(row, column, [abs], [a1], [sheet])',
  OFFSET: 'OFFSET(reference, rows, cols, [height], [width])',
  INDIRECT: 'INDIRECT(text, [a1])',
  FILTER: 'FILTER(array, include, [if_empty])',
  UNIQUE: 'UNIQUE(array, [by_col], [exactly_once])',
  SORT: 'SORT(array, [sort_index], [sort_order], [by_col])',
  SORTBY: 'SORTBY(array, by_array1, [sort_order1], ...)',
  SEQUENCE: 'SEQUENCE(rows, [columns], [start], [step])',
  TRANSPOSE: 'TRANSPOSE(array)',
  TEXTSPLIT: 'TEXTSPLIT(text, col_delimiter, [row_delimiter], [ignore_empty])',
}

/**
 * The word being typed immediately before the caret, if it could be a function
 * name. Returns null when the caret is not in a formula, or sits somewhere a
 * function name cannot start (inside a string, or right after a reference).
 */
export function partialAt(text: string, caret: number): { word: string; start: number } | null {
  if (!text.startsWith('=')) return null
  const upto = text.slice(0, caret)

  // Inside a string literal there is nothing to suggest. Count unescaped
  // quotes: an odd number means the caret is inside one.
  let quotes = 0
  for (let i = 0; i < upto.length; i += 1) {
    if (upto[i] === '"') {
      if (upto[i + 1] === '"') { i += 1; continue }
      quotes += 1
    }
  }
  if (quotes % 2 === 1) return null

  const m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(upto)
  if (!m) return null
  const word = m[1]!
  const start = caret - word.length
  // A word followed by digits is a cell reference being typed, not a function.
  if (/\d$/.test(word)) return null
  return { word, start }
}

/**
 * Function names matching what is being typed.
 *
 * Prefix matches first, then anything merely containing the text, so typing
 * "look" still finds VLOOKUP. Within each group, SHORTER names rank first:
 * alphabetical order puts SUBSTITUTE above SUM for "SU", which is exactly
 * backwards from what someone typing two letters wants.
 */
export function suggestFunctions(
  text: string,
  caret: number,
  limit = 8,
): FunctionSuggestion[] {
  const partial = partialAt(text, caret)
  if (!partial || partial.word.length < 1) return []
  const upper = partial.word.toUpperCase()
  const prefix: string[] = []
  const contains: string[] = []
  for (const name of NAMES) {
    if (name === upper) continue
    if (name.startsWith(upper)) prefix.push(name)
    else if (name.includes(upper)) contains.push(name)
  }
  const byCloseness = (a: string, b: string) =>
    a.length - b.length || a.localeCompare(b)
  return [...prefix.sort(byCloseness), ...contains.sort(byCloseness)]
    .slice(0, limit)
    .map((name) => ({ name, start: partial.start, end: caret }))
}

/** Splice an accepted suggestion in, leaving the caret inside the parens. */
export function applySuggestion(
  text: string,
  suggestion: FunctionSuggestion,
): { text: string; caret: number } {
  const before = text.slice(0, suggestion.start)
  const after = text.slice(suggestion.end)
  // Do not double up a parenthesis the user already typed.
  const needsParen = !after.startsWith('(')
  // Only the OPENING parenthesis, as Excel inserts it. Inserting the pair
  // put the caret between them, and everyone who then typed the arguments
  // finished with a ")" of their own and got =SUM(A1:A3)) and #PARSE!.
  // The closing one is supplied at commit by `balanceParens` when it is
  // still missing, which is what Excel does too.
  const inserted = needsParen ? `${suggestion.name}(` : suggestion.name
  return {
    text: before + inserted + after,
    caret: before.length + inserted.length,
  }
}

/**
 * Close the parentheses a formula left open, the way Excel corrects
 * "=SUM(A1:A3" to "=SUM(A1:A3)" when it is entered. Quoted text is skipped,
 * so a ")" inside a string neither closes nor needs closing. Text that is
 * not a formula, or has more closers than openers, is returned as it is:
 * that one is an error the engine should report, not paper over.
 */
export function balanceParens(text: string): string {
  if (!text.startsWith('=')) return text
  let depth = 0
  let inString = false
  for (const ch of text) {
    if (ch === '"') inString = !inString
    else if (!inString && ch === '(') depth += 1
    else if (!inString && ch === ')') depth -= 1
  }
  return depth > 0 ? text + ')'.repeat(depth) : text
}

/** The signature hint for whatever call the caret is inside, if any. */
export function signatureAt(text: string, caret: number): string | null {
  if (!text.startsWith('=')) return null
  const upto = text.slice(0, caret)
  // Walk back looking for an unclosed '(' and read the name before it.
  let depth = 0
  for (let i = upto.length - 1; i >= 0; i -= 1) {
    const ch = upto[i]!
    if (ch === ')') { depth += 1; continue }
    if (ch === '(') {
      if (depth > 0) { depth -= 1; continue }
      const name = /([A-Za-z][A-Za-z0-9.]*)$/.exec(upto.slice(0, i))?.[1]
      if (!name) return null
      const upper = name.toUpperCase()
      return SIGNATURES[upper] ?? (upper in FUNCTIONS ? `${upper}(...)` : null)
    }
  }
  return null
}
