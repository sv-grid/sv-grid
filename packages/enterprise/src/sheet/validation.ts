/**
 * Data validation, Excel's: a rule over some cells says what may be typed
 * into them, and an entry that breaks it is stopped (or warned about)
 * before it lands. Only typed entries are checked, as in Excel: paste, fill
 * and the commands write what they are given.
 *
 * Rules keep their rectangles by position and move with an insert or
 * delete; the last rule that covers a cell is the one that applies, which
 * is what lets a later rule over a smaller block override an earlier one.
 * Bounds and custom rules are text (a literal or a formula) evaluated in
 * the sheet through the context the shell supplies, so `=$B$1` as a
 * maximum follows B1.
 */
import { isError, type CellValue } from './ast'
import { toText } from './coerce'
import { parseEntry } from './entry'
import { translateFormula } from './refs'
import type { StructuralEdit } from './refs'
import { rectContains, shiftRects, subtractRect, rectsIntersect, type Rect } from './rects'

export type ValidationAllow = 'any' | 'whole' | 'decimal' | 'list' | 'date' | 'textLength' | 'custom'
export type ValidationOperator =
  | 'between' | 'notBetween' | 'equal' | 'notEqual'
  | 'greater' | 'less' | 'greaterOrEqual' | 'lessOrEqual'

/** Everything a rule is but where it applies: what the dialog hands back. */
export type ValidationSpec = Omit<ValidationRule, 'id' | 'rects'>

export type ValidationRule = {
  id: string
  rects: ReadonlyArray<Rect>
  allow: ValidationAllow
  /** For whole, decimal, date and textLength. Default between. */
  operator?: ValidationOperator
  /** The bound, the value, the list source or the custom formula: a
   *  literal, a comma list, or a formula starting with '='. */
  value1?: string
  /** The upper bound of between / notBetween. */
  value2?: string
  ignoreBlank: boolean
  /** List rules: show the arrow and the picker on the cell. */
  inCellDropdown: boolean
  alert: { style: 'stop' | 'warning'; title?: string; message?: string }
  /** Excel's Input Message: shown under the cell while it is selected.
   *  Absent when the rule has none. */
  input?: { title?: string; message?: string }
}

/** How a rule reads the sheet: the shell wires the workbook in. */
export type ValidationContext = {
  /**
   * A formula or a literal, evaluated in the sheet. With `entry`, the
   * cell being checked reads as that text: Excel's custom rules refer to
   * the cell they guard (`=A1>B1` on A1), and the entry is not written yet.
   */
  evaluate(text: string, entry?: { row: number; col: number; text: string }): CellValue
  /** The values of a range reference or a name for one; null otherwise. */
  range(text: string): CellValue[][] | null
}

export type ValidationVerdict =
  | { ok: true }
  | { ok: false; style: 'stop' | 'warning'; title: string; message: string }

/** Excel's own words when a rule has no message of its own. */
export const DEFAULT_ALERT_MESSAGE =
  "This value doesn't match the data validation restrictions defined for this cell."

export const OPERATOR_LABELS: Record<ValidationOperator, string> = {
  between: 'between',
  notBetween: 'not between',
  equal: 'equal to',
  notEqual: 'not equal to',
  greater: 'greater than',
  less: 'less than',
  greaterOrEqual: 'greater than or equal to',
  lessOrEqual: 'less than or equal to',
}

let nextId = 1
export function validationId(): string {
  nextId += 1
  return `v${Date.now().toString(36)}${nextId}`
}

/** The rule that applies to (r, c): the last one covering it. */
export function ruleAt(rules: ReadonlyArray<ValidationRule>, r: number, c: number): ValidationRule | undefined {
  for (let i = rules.length - 1; i >= 0; i -= 1) {
    const rule = rules[i]!
    if (rule.rects.some((rect) => rectContains(rect, r, c))) return rule
  }
  return undefined
}

/** The rules touching any of the rectangles. */
export function rulesIn(rules: ReadonlyArray<ValidationRule>, rects: ReadonlyArray<Rect>): ValidationRule[] {
  return rules.filter((rule) => rule.rects.some((a) => rects.some((b) => rectsIntersect(a, b))))
}

/** What the typed text is worth: a formula's result, or the literal coerced. */
function entered(text: string, ctx: ValidationContext): CellValue {
  const t = text.trim()
  if (t.startsWith('=')) return ctx.evaluate(t)
  const parsed = parseEntry(t)
  const plain = parsed ? parsed.value : t
  const n = Number(plain)
  if (plain !== '' && Number.isFinite(n)) return n
  const upper = plain.toUpperCase()
  if (upper === 'TRUE') return true
  if (upper === 'FALSE') return false
  return plain
}

/** A date as milliseconds: an ISO text, or an Excel serial. Null otherwise. */
export function dateValue(v: CellValue): number | null {
  if (typeof v === 'number') return Date.UTC(1899, 11, 30) + v * 86400000
  if (typeof v !== 'string' || !v.trim()) return null
  if (!/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return null
  const ms = Date.parse(v.trim().length === 10 ? `${v.trim()}T00:00:00Z` : v.trim())
  return Number.isNaN(ms) ? null : ms
}

/**
 * A bound or a source, moved from the rule's top-left cell to the cell being
 * checked, as Excel moves a relative reference in a rule: `=A2` as the
 * minimum of G2:G17 reads A5 on G5, while `=$B$1` stays put.
 */
function relative(text: string | undefined, rule: ValidationRule, at: { row: number; col: number }): string | undefined {
  if (text === undefined || !text.trim().startsWith('=')) return text
  const origin = rule.rects[0]
  if (!origin) return text
  return String(translateFormula(text.trim(), at.row - origin[0], at.col - origin[1]))
}

function bound(text: string | undefined, ctx: ValidationContext, as: 'number' | 'date'): number | null {
  if (text === undefined || text.trim() === '') return null
  const v = ctx.evaluate(text)
  if (isError(v)) return null
  if (as === 'date') return dateValue(v)
  if (typeof v === 'boolean') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function compareTo(x: number, op: ValidationOperator, a: number | null, b: number | null): boolean {
  if (a === null) return false
  switch (op) {
    case 'between': return b !== null && x >= Math.min(a, b) && x <= Math.max(a, b)
    case 'notBetween': return b !== null && (x < Math.min(a, b) || x > Math.max(a, b))
    case 'equal': return x === a
    case 'notEqual': return x !== a
    case 'greater': return x > a
    case 'less': return x < a
    case 'greaterOrEqual': return x >= a
    case 'lessOrEqual': return x <= a
  }
}

/**
 * The choices a list rule offers: a comma list as written, or the cells of
 * a range (or a name for one), blanks left out, as text.
 */
export function listChoices(rule: ValidationRule, ctx: ValidationContext): string[] {
  const source = (rule.value1 ?? '').trim()
  if (!source) return []
  if (source.startsWith('=')) {
    const grid = ctx.range(source)
    if (grid) {
      const out: string[] = []
      for (const row of grid) for (const v of row) {
        if (v === '' || v == null) continue
        out.push(isError(v) ? v.error : toText(v))
      }
      return out
    }
    const v = ctx.evaluate(source)
    return isError(v) ? [] : [toText(v)]
  }
  return source.split(',').map((s) => s.trim()).filter((s) => s !== '')
}

/**
 * Whether `text`, typed into (row, col), passes the rule. The verdict
 * carries the alert to show when it does not.
 */
export function checkEntry(
  rule: ValidationRule,
  text: string,
  at: { row: number; col: number },
  ctx: ValidationContext,
): ValidationVerdict {
  const fail = (): ValidationVerdict => ({
    ok: false,
    style: rule.alert.style,
    title: rule.alert.title?.trim() || 'Data validation',
    message: rule.alert.message?.trim() || DEFAULT_ALERT_MESSAGE,
  })
  if (rule.allow === 'any') return { ok: true }
  const trimmed = text.trim()
  if (trimmed === '') return rule.ignoreBlank ? { ok: true } : fail()
  const op = rule.operator ?? 'between'

  switch (rule.allow) {
    case 'whole':
    case 'decimal': {
      const v = entered(text, ctx)
      if (typeof v !== 'number' || !Number.isFinite(v)) return fail()
      if (rule.allow === 'whole' && !Number.isInteger(v)) return fail()
      return compareTo(v, op, bound(relative(rule.value1, rule, at), ctx, 'number'), bound(relative(rule.value2, rule, at), ctx, 'number')) ? { ok: true } : fail()
    }
    case 'date': {
      const ms = dateValue(entered(text, ctx))
      if (ms === null) return fail()
      return compareTo(ms, op, bound(relative(rule.value1, rule, at), ctx, 'date'), bound(relative(rule.value2, rule, at), ctx, 'date')) ? { ok: true } : fail()
    }
    case 'textLength': {
      const v = entered(text, ctx)
      const length = isError(v) ? 0 : toText(v).length
      return compareTo(length, op, bound(relative(rule.value1, rule, at), ctx, 'number'), bound(relative(rule.value2, rule, at), ctx, 'number')) ? { ok: true } : fail()
    }
    case 'list': {
      // Excel matches a list entry without regard to case.
      const v = entered(text, ctx)
      const shown = isError(v) ? v.error : toText(v)
      const needle = shown.toLowerCase()
      return listChoices(rule, ctx).some((choice) => choice.toLowerCase() === needle) ? { ok: true } : fail()
    }
    case 'custom': {
      const formula = (rule.value1 ?? '').trim()
      if (!formula) return fail()
      // The formula is written for the rule's top-left cell and moves with
      // the cell it checks, as a copied formula would.
      const origin = rule.rects[0]
      const source = formula.startsWith('=') ? formula : `=${formula}`
      const moved = origin
        ? String(translateFormula(source, at.row - origin[0], at.col - origin[1]))
        : source
      const v = ctx.evaluate(moved, { row: at.row, col: at.col, text })
      if (isError(v)) return fail()
      const truthy = typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : false
      return truthy ? { ok: true } : fail()
    }
    default:
      return { ok: true }
  }
}

/** The rules after an insert or delete. */
export function shiftValidation(rules: ReadonlyArray<ValidationRule>, edit: StructuralEdit): ValidationRule[] {
  return shiftRects(rules, edit)
}

/** The rules with the rectangles cut out of them: Excel's Clear All. */
export function removeValidation(rules: ReadonlyArray<ValidationRule>, rects: ReadonlyArray<Rect>): ValidationRule[] {
  const out: ValidationRule[] = []
  for (const rule of rules) {
    let kept: Rect[] = [...rule.rects]
    for (const hole of rects) kept = kept.flatMap((rect) => subtractRect(rect, hole))
    if (kept.length) out.push({ ...rule, rects: kept })
  }
  return out
}

/** A short description for a rule, the way Excel's dialog title reads it. */
export function describeRule(rule: ValidationRule): string {
  const op = OPERATOR_LABELS[rule.operator ?? 'between']
  const v1 = rule.value1 ?? ''
  const v2 = rule.value2 ?? ''
  const range = (rule.operator ?? 'between') === 'between' || rule.operator === 'notBetween'
    ? `${v1} and ${v2}`
    : v1
  switch (rule.allow) {
    case 'any': return 'Any value'
    case 'whole': return `Whole number ${op} ${range}`
    case 'decimal': return `Decimal ${op} ${range}`
    case 'date': return `Date ${op} ${range}`
    case 'textLength': return `Text length ${op} ${range}`
    case 'list': return `List: ${v1}`
    case 'custom': return `Custom: ${v1}`
  }
}

/**
 * Excel's Circle Invalid Data: every cell under a rule whose current text
 * breaks it. Blank cells count when the rule says they do. The rectangles
 * are clipped to `rows` by `cols`, the sheet's used extent, so a rule over
 * a whole column costs the cells that hold something.
 */
export function invalidCells(
  rules: ReadonlyArray<ValidationRule>,
  ctx: ValidationContext,
  rawAt: (row: number, col: number) => string,
  rows: number,
  cols: number,
): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = []
  const seen = new Set<number>()
  for (const rule of rules) {
    if (rule.allow === 'any') continue
    for (const [r1, c1, r2, c2] of rule.rects) {
      const rowEnd = Math.min(r2, rows - 1)
      const colEnd = Math.min(c2, cols - 1)
      for (let r = Math.max(0, r1); r <= rowEnd; r += 1) {
        for (let c = Math.max(0, c1); c <= colEnd; c += 1) {
          const key = r * 1048576 + c
          if (seen.has(key)) continue
          seen.add(key)
          // The rule that applies is the last one covering the cell, which
          // may not be this one.
          const applies = ruleAt(rules, r, c)
          if (!applies || applies.allow === 'any') continue
          const text = rawAt(r, c)
          if (text.trim() === '' && applies.ignoreBlank) continue
          if (!checkEntry(applies, text, { row: r, col: c }, ctx).ok) out.push({ row: r, col: c })
        }
      }
    }
  }
  return out
}
