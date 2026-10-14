/**
 * The formula field's language: `{Field name}` references, numbers, "text",
 * + - * / and & (join), = != < > <= >=, parentheses and functions such as
 * IF, AND, CONCATENATE, ROUND, DATETIME_DIFF. Parsed once into a closure tree;
 * nothing is ever passed to eval or Function. Errors carry a message the field
 * editor shows under the formula.
 */
import { toDate } from './format'

export type FormulaValue = number | string | boolean | Date | null | FormulaValue[]
export type FormulaFn = (row: Record<string, unknown>) => FormulaValue

export class FormulaError extends Error {}

type Tok = { k: 'num' | 'str' | 'ref' | 'id' | 'op' | '(' | ')' | ','; v: string; at: number }

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (/\s/.test(c)) { i++; continue }
    if (c === '{') {
      const end = src.indexOf('}', i)
      if (end < 0) throw new FormulaError(`Unclosed "{" at ${i + 1}`)
      out.push({ k: 'ref', v: src.slice(i + 1, end).trim(), at: i })
      i = end + 1
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) { s += src[j + 1]; j += 2; continue }
        s += src[j++]
      }
      if (j >= src.length) throw new FormulaError(`Unclosed text at ${i + 1}`)
      out.push({ k: 'str', v: s, at: i })
      i = j + 1
      continue
    }
    const num = /^\d+(\.\d+)?|^\.\d+/.exec(src.slice(i))
    if (num) { out.push({ k: 'num', v: num[0], at: i }); i += num[0].length; continue }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))
    if (id) { out.push({ k: 'id', v: id[0], at: i }); i += id[0].length; continue }
    const op = /^(!=|<=|>=|<>|[-+*/&=<>])/.exec(src.slice(i))
    if (op) { out.push({ k: 'op', v: op[0] === '<>' ? '!=' : op[0], at: i }); i += op[0].length; continue }
    if (c === '(' || c === ')' || c === ',') { out.push({ k: c, v: c, at: i }); i++; continue }
    throw new FormulaError(`Unexpected "${c}" at ${i + 1}`)
  }
  return out
}

const isBlank = (v: FormulaValue) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
const toNum = (v: FormulaValue): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.getTime()
  if (v == null || v === '') return 0
  if (Array.isArray(v)) return v.reduce<number>((s, x) => s + toNum(x), 0)
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}
const toText = (v: FormulaValue): string =>
  v == null ? '' : v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(toText).join(', ') : String(v)
const truthy = (v: FormulaValue) => !isBlank(v) && v !== false && v !== 0
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
/**
 * Text written the way a date field or a timestamp stores it (2026-12-04,
 * 2026-12-04T10:30:00Z) as that date; any other text is not a date. A bare
 * YYYY-MM-DD is that day at local midnight, as format.ts reads it.
 */
export function isoDate(text: string): Date | null {
  const s = text.trim()
  return ISO_DATE.test(s) ? toDate(s) : null
}
// A bare YYYY-MM-DD (what a date field stores) is that day at local midnight,
// as format.ts reads it and as TODAY() is, not midnight UTC. Other text is a
// date only with a four-digit year and a separator ("October 5, 2026",
// "10/05/2026"), so "1" or "12" is not read as a year.
const toDateV = (v: FormulaValue): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (v == null || v === '' || typeof v === 'boolean') return null
  if (typeof v === 'number') return toDate(v)
  const s = toText(v).trim()
  return isoDate(s) ?? (/\d{4}/.test(s) && /[/\s,.-]/.test(s) ? toDate(s) : null)
}
const flat = (args: FormulaValue[]): FormulaValue[] => args.flatMap((a) => (Array.isArray(a) ? a : [a]))
const pad2 = (n: number) => String(n).padStart(2, '0')
/** Trim float noise: 2.1 / 0.1 is 21.000000000000004. */
const clean = (n: number) => Number(n.toPrecision(12))

/** A unit name as DATEADD and DATETIME_DIFF read it. "m" is minutes; months are "months". */
const UNITS: Record<string, string> = {
  milliseconds: 'ms', millisecond: 'ms', ms: 'ms',
  seconds: 's', second: 's', s: 's',
  minutes: 'm', minute: 'm', m: 'm',
  hours: 'h', hour: 'h', h: 'h',
  days: 'd', day: 'd', d: 'd',
  weeks: 'w', week: 'w', w: 'w',
  months: 'mo', month: 'mo',
  years: 'y', year: 'y', y: 'y',
}
const UNIT_MS: Record<string, number> = { ms: 1, s: 1e3, m: 6e4, h: 36e5 }
const unitOf = (v: FormulaValue) => UNITS[toText(v).trim().toLowerCase()] ?? null

/** `d` plus `n` months, kept in the month: January 31 plus one month is February 28. */
function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()))
  return r
}
function dateAdd(d: Date, n: number, unit: string): Date {
  if (UNIT_MS[unit]) return new Date(d.getTime() + n * UNIT_MS[unit]!)
  if (unit === 'mo' || unit === 'y') return addMonths(d, Math.trunc(n) * (unit === 'y' ? 12 : 1))
  // Days and weeks move the calendar day, so a daylight-saving change on the
  // way does not land the result on 23:00 the day before.
  const days = n * (unit === 'w' ? 7 : 1)
  const r = new Date(d)
  r.setDate(r.getDate() + Math.trunc(days))
  return new Date(r.getTime() + (days - Math.trunc(days)) * 864e5)
}
/** Local wall-clock time as a number, so a daylight-saving hour does not cut a day short. */
const wall = (d: Date) => d.getTime() - d.getTimezoneOffset() * 6e4
function dateDiff(x: Date, y: Date, unit: string): number {
  if (UNIT_MS[unit]) return Math.trunc((x.getTime() - y.getTime()) / UNIT_MS[unit]!)
  if (unit === 'd' || unit === 'w') return Math.trunc((wall(x) - wall(y)) / (unit === 'w' ? 6048e5 : 864e5))
  let months = (x.getFullYear() - y.getFullYear()) * 12 + x.getMonth() - y.getMonth()
  // Not a whole month yet: September 20 to October 5 is 0 months.
  const at = addMonths(y, months).getTime()
  if (months > 0 && at > x.getTime()) months -= 1
  else if (months < 0 && at < x.getTime()) months += 1
  return unit === 'y' ? Math.trunc(months / 12) : months
}

const FUNCTIONS: Record<string, (a: FormulaValue[]) => FormulaValue> = {
  // logic
  IF: (a) => (truthy(a[0] ?? null) ? (a[1] ?? null) : (a[2] ?? null)),
  AND: (a) => flat(a).every(truthy),
  OR: (a) => flat(a).some(truthy),
  NOT: (a) => !truthy(a[0] ?? null),
  XOR: (a) => flat(a).filter(truthy).length % 2 === 1,
  BLANK: () => null,
  // The parser runs SWITCH lazily; this is its function list entry.
  SWITCH: (a) => {
    for (let i = 1; i + 1 < a.length; i += 2) if (toText(a[0] ?? null) === toText(a[i] ?? null)) return a[i + 1] ?? null
    return a.length % 2 === 0 ? (a[a.length - 1] ?? null) : null
  },
  // text
  CONCATENATE: (a) => a.map(toText).join(''),
  LEN: (a) => toText(a[0] ?? null).length,
  UPPER: (a) => toText(a[0] ?? null).toUpperCase(),
  LOWER: (a) => toText(a[0] ?? null).toLowerCase(),
  TRIM: (a) => toText(a[0] ?? null).trim(),
  LEFT: (a) => toText(a[0] ?? null).slice(0, toNum(a[1] ?? 1)),
  RIGHT: (a) => { const s = toText(a[0] ?? null); const n = toNum(a[1] ?? 1); return n <= 0 ? '' : s.slice(-n) },
  // Without a count, the rest of the text.
  MID: (a) => {
    const s = toText(a[0] ?? null), from = Math.max(0, toNum(a[1] ?? 1) - 1)
    return a.length > 2 ? s.slice(from, from + Math.max(0, toNum(a[2] ?? 0))) : s.slice(from)
  },
  FIND: (a) => toText(a[1] ?? null).indexOf(toText(a[0] ?? null), Math.max(0, toNum(a[2] ?? 1) - 1)) + 1,
  SUBSTITUTE: (a) => toText(a[0] ?? null).split(toText(a[1] ?? null)).join(toText(a[2] ?? null)),
  REPT: (a) => toText(a[0] ?? null).repeat(Math.max(0, Math.min(1000, toNum(a[1] ?? 0)))),
  T: (a) => (typeof a[0] === 'string' ? a[0] : ''),
  // Text with no digit has no value: empty, not 0 (Number('') would say 0).
  VALUE: (a) => { const t = toText(a[0] ?? null).replace(/[^0-9.eE+-]/g, ''); const n = /\d/.test(t) ? Number(t) : NaN; return Number.isFinite(n) ? n : null },
  ARRAYJOIN: (a) => flat([a[0] ?? null]).map(toText).filter(Boolean).join(a.length > 1 ? toText(a[1] ?? null) : ', '),
  // numbers
  SUM: (a) => flat(a).reduce<number>((s, x) => s + toNum(x), 0),
  AVERAGE: (a) => { const v = flat(a).filter((x) => !isBlank(x)); return v.length ? v.reduce<number>((s, x) => s + toNum(x), 0) / v.length : null },
  MAX: (a) => { const v = flat(a).filter((x) => !isBlank(x)).map(toNum); return v.length ? Math.max(...v) : null },
  MIN: (a) => { const v = flat(a).filter((x) => !isBlank(x)).map(toNum); return v.length ? Math.min(...v) : null },
  COUNT: (a) => flat(a).filter((x) => typeof x === 'number').length,
  COUNTA: (a) => flat(a).filter((x) => !isBlank(x)).length,
  ROUND: (a) => { const p = 10 ** toNum(a[1] ?? 0); return Math.round(toNum(a[0] ?? null) * p) / p },
  ROUNDUP: (a) => { const p = 10 ** toNum(a[1] ?? 0); return Math.ceil(toNum(a[0] ?? null) * p) / p },
  ROUNDDOWN: (a) => { const p = 10 ** toNum(a[1] ?? 0); return Math.floor(toNum(a[0] ?? null) * p) / p },
  INT: (a) => Math.floor(toNum(a[0] ?? null)),
  ABS: (a) => Math.abs(toNum(a[0] ?? null)),
  MOD: (a) => toNum(a[0] ?? null) % toNum(a[1] ?? 1),
  POWER: (a) => toNum(a[0] ?? null) ** toNum(a[1] ?? 1),
  SQRT: (a) => Math.sqrt(toNum(a[0] ?? null)),
  // Up or down to a multiple of the significance (default 1): CEILING(7, 5) is 10.
  CEILING: (a) => { const s = toNum(a[1] ?? 1); return s === 0 ? 0 : clean(Math.ceil(clean(toNum(a[0] ?? null) / s)) * s) },
  FLOOR: (a) => { const s = toNum(a[1] ?? 1); return s === 0 ? 0 : clean(Math.floor(clean(toNum(a[0] ?? null) / s)) * s) },
  // dates
  TODAY: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d },
  NOW: () => new Date(),
  YEAR: (a) => toDateV(a[0] ?? null)?.getFullYear() ?? null,
  MONTH: (a) => { const d = toDateV(a[0] ?? null); return d ? d.getMonth() + 1 : null },
  DAY: (a) => toDateV(a[0] ?? null)?.getDate() ?? null,
  WEEKDAY: (a) => toDateV(a[0] ?? null)?.getDay() ?? null,
  // An unknown unit is empty here; one written as text is a compile error (see the parser).
  DATEADD: (a) => {
    const d = toDateV(a[0] ?? null), unit = a.length > 2 ? unitOf(a[2] ?? null) : 'd'
    return d && unit ? dateAdd(d, toNum(a[1] ?? 0), unit) : null
  },
  DATETIME_DIFF: (a) => {
    const x = toDateV(a[0] ?? null), y = toDateV(a[1] ?? null), unit = a.length > 2 ? unitOf(a[2] ?? null) : 's'
    return x && y && unit ? dateDiff(x, y, unit) : null
  },
  IS_BEFORE: (a) => { const x = toDateV(a[0] ?? null), y = toDateV(a[1] ?? null); return !!x && !!y && x < y },
  IS_AFTER: (a) => { const x = toDateV(a[0] ?? null), y = toDateV(a[1] ?? null); return !!x && !!y && x > y },
  // The local calendar day, the same day TODAY() and a date field mean.
  DATESTR: (a) => { const d = toDateV(a[0] ?? null); return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : null },
}

function cmp<T extends number | string>(op: string, x: T, y: T): boolean {
  switch (op) {
    case '=': return x === y
    case '!=': return x !== y
    case '<': return x < y
    case '>': return x > y
    case '<=': return x <= y
    default: return x >= y
  }
}

/** Functions whose third argument is a unit: a unit written as text is checked when the formula compiles. */
const UNIT_ARG = new Set(['DATEADD', 'DATETIME_DIFF'])

/** The functions a formula may call, for the editor's help line. */
export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS).sort()

/** Resolve a `{Field name}` to the row key it reads. */
export type FieldResolver = (name: string) => string | null

/** The message for a formula that names the field it belongs to. */
export const selfReferenceError = (name: string) => new FormulaError(`A formula cannot read its own field {${name.trim()}}`)

/**
 * A resolver over columns: a name matches a header or a field key, ignoring
 * case and outer spaces. `self` lists the names of the formula's own field
 * (its key, its header, a header being typed): naming one is an error.
 */
export function columnResolver(columns: ReadonlyArray<Record<string, unknown>>, self: ReadonlyArray<unknown> = []): FieldResolver {
  const own = new Set(self.filter((s) => s != null && String(s).trim() !== '').map((s) => String(s).trim().toLowerCase()))
  return (name) => {
    const n = name.trim().toLowerCase()
    if (own.has(n)) throw selfReferenceError(name)
    const hit = columns.find((c) => String(c.header ?? '').trim().toLowerCase() === n || String(c.field ?? '').toLowerCase() === n)
    return hit ? String(hit.field ?? hit.id) : null
  }
}

type Node = (row: Record<string, unknown>) => FormulaValue

class Parser {
  i = 0
  constructor(private toks: Tok[], private resolve: FieldResolver, public refs: Set<string>) {}
  peek() { return this.toks[this.i] }
  next() { return this.toks[this.i++] }
  expect(k: Tok['k'], v?: string) {
    const t = this.next()
    if (!t || t.k !== k || (v && t.v !== v)) throw new FormulaError(`Expected "${v ?? k}"${t ? ` at ${t.at + 1}` : ' at the end'}`)
    return t
  }
  parse(): Node {
    const n = this.compare()
    if (this.peek()) throw new FormulaError(`Unexpected "${this.peek()!.v}" at ${this.peek()!.at + 1}`)
    return n
  }
  compare(): Node {
    let left = this.concat()
    for (let t = this.peek(); t && t.k === 'op' && ['=', '!=', '<', '>', '<=', '>='].includes(t.v); t = this.peek()) {
      this.next()
      const op = t.v, l = left, r = this.concat()
      left = (row) => {
        const a = l(row), b = r(row)
        // A date against a stored date (text) or another date compares as dates.
        // An empty or unreadable side matches nothing: only != is true.
        if (a instanceof Date || b instanceof Date) {
          const x = toDateV(a), y = toDateV(b)
          if (!x || !y) return op === '!='
          return cmp(op, x.getTime(), y.getTime())
        }
        const both = typeof a === 'number' || typeof b === 'number'
        const x: number | string = both ? toNum(a) : toText(a)
        const y: number | string = both ? toNum(b) : toText(b)
        return cmp(op, x, y)
      }
    }
    return left
  }
  concat(): Node {
    let left = this.add()
    while (this.peek()?.k === 'op' && this.peek()!.v === '&') {
      this.next()
      const l = left, r = this.add()
      left = (row) => toText(l(row)) + toText(r(row))
    }
    return left
  }
  add(): Node {
    let left = this.mul()
    for (let t = this.peek(); t && t.k === 'op' && (t.v === '+' || t.v === '-'); t = this.peek()) {
      this.next()
      const l = left, r = this.mul(), plus = t.v === '+'
      left = (row) => (plus ? toNum(l(row)) + toNum(r(row)) : toNum(l(row)) - toNum(r(row)))
    }
    return left
  }
  mul(): Node {
    let left = this.unary()
    for (let t = this.peek(); t && t.k === 'op' && (t.v === '*' || t.v === '/'); t = this.peek()) {
      this.next()
      const l = left, r = this.unary(), times = t.v === '*'
      left = (row) => {
        if (times) return toNum(l(row)) * toNum(r(row))
        const d = toNum(r(row))
        return d === 0 ? null : toNum(l(row)) / d
      }
    }
    return left
  }
  unary(): Node {
    const t = this.peek()
    if (t?.k === 'op' && t.v === '-') {
      this.next()
      const n = this.unary()
      return (row) => -toNum(n(row))
    }
    return this.primary()
  }
  primary(): Node {
    const t = this.next()
    if (!t) throw new FormulaError('The formula ends too early')
    if (t.k === 'num') { const n = Number(t.v); return () => n }
    if (t.k === 'str') { const s = t.v; return () => s }
    if (t.k === 'ref') {
      const key = this.resolve(t.v)
      if (key == null) throw new FormulaError(`No field named "${t.v}"`)
      this.refs.add(key)
      return (row) => (row?.[key] ?? null) as FormulaValue
    }
    if (t.k === '(') { const n = this.compare(); this.expect(')'); return n }
    if (t.k === 'id') {
      const upper = t.v.toUpperCase()
      if (upper === 'TRUE' && this.peek()?.k !== '(') return () => true
      if (upper === 'FALSE' && this.peek()?.k !== '(') return () => false
      const fn = FUNCTIONS[upper]
      if (!fn) throw new FormulaError(`Unknown function ${t.v}`)
      this.expect('(')
      const args: Node[] = []
      // Each argument that is a bare text literal, for checking a unit now.
      const literals: Array<string | undefined> = []
      const arg = () => {
        const start = this.i
        args.push(this.compare())
        const only = this.i === start + 1 ? this.toks[start] : undefined
        literals.push(only?.k === 'str' ? only.v : undefined)
      }
      if (this.peek()?.k !== ')') {
        arg()
        while (this.peek()?.k === ',') { this.next(); arg() }
      }
      this.expect(')')
      const unit = literals[2]
      if (UNIT_ARG.has(upper) && unit !== undefined && !unitOf(unit)) {
        throw new FormulaError(`Unknown unit "${unit}" in ${upper}: use ms, seconds, minutes, hours, days, weeks, months or years`)
      }
      // IF and SWITCH evaluate lazily, so IF({x} = 0, 0, 1 / {x}) does not divide by zero.
      if (upper === 'IF') return (row) => (truthy(args[0]?.(row) ?? null) ? (args[1]?.(row) ?? null) : (args[2]?.(row) ?? null))
      if (upper === 'SWITCH') {
        return (row) => {
          if (!args.length) return null
          const v = toText(args[0]!(row))
          for (let i = 1; i + 1 < args.length; i += 2) if (v === toText(args[i]!(row))) return args[i + 1]!(row)
          return args.length % 2 === 0 ? args[args.length - 1]!(row) : null
        }
      }
      return (row) => fn(args.map((a) => a(row)))
    }
    throw new FormulaError(`Unexpected "${t.v}" at ${t.at + 1}`)
  }
}

/** Compile a formula. Throws FormulaError with a message for the user. */
export function compileFormula(src: string, resolve: FieldResolver): { fn: FormulaFn; refs: string[] } {
  if (!src.trim()) throw new FormulaError('The formula is empty')
  const refs = new Set<string>()
  const node = new Parser(tokenize(src), resolve, refs).parse()
  return {
    fn: (row) => {
      try {
        const v = node(row)
        return typeof v === 'number' && !Number.isFinite(v) ? null : v
      } catch {
        return null
      }
    },
    refs: [...refs],
  }
}

/**
 * The formula with each `{name}` that `rename` gives a new name for written
 * as `{new name}`. Braces inside text ("{x}") are left alone; a formula that
 * does not tokenize comes back as it was.
 */
export function renameFormulaRefs(src: string, rename: (name: string) => string | null): string {
  let toks: Tok[]
  try {
    toks = tokenize(src)
  } catch {
    return src
  }
  let out = ''
  let from = 0
  for (const t of toks) {
    if (t.k !== 'ref') continue
    const next = rename(t.v)
    if (next == null) continue
    const end = src.indexOf('}', t.at)
    out += `${src.slice(from, t.at)}{${next}}`
    from = end + 1
  }
  return from ? out + src.slice(from) : src
}

/**
 * The keys of the fields a formula names, as `resolve` reads them. Unlike
 * `compileFormula` it does not stop at a name no field has or at a mistake
 * elsewhere in the formula; a formula that does not tokenize names nothing.
 */
export function formulaRefs(src: string, resolve: FieldResolver): string[] {
  let toks: Tok[]
  try {
    toks = tokenize(src)
  } catch {
    return []
  }
  const keys = new Set<string>()
  for (const t of toks) {
    if (t.k !== 'ref') continue
    try {
      const key = resolve(t.v)
      if (key != null) keys.add(key)
    } catch {
      /* a name the resolver refuses reads nothing */
    }
  }
  return [...keys]
}

/**
 * The formula fields among `columns` that read the field `field` (its key or
 * id): deleting it turns their cells to #ERROR. Names resolve against
 * `columns`, as the field editor resolves them.
 */
export function formulaReaders<T extends Record<string, any>>(columns: ReadonlyArray<T>, field: { field?: unknown; id?: unknown }): T[] {
  const keys = new Set([field.field, field.id].filter((k) => k != null && k !== '').map(String))
  if (!keys.size) return []
  const resolve = columnResolver(columns)
  return columns.filter((c) => {
    if (c.fieldType !== 'formula' || keys.has(String(c.field ?? c.id ?? ''))) return false
    return formulaRefs(String(c.fieldProps?.formula ?? ''), resolve).some((k) => keys.has(k))
  })
}

/** The formula's message if it does not compile, else null. */
export function formulaError(src: string, resolve: FieldResolver): string | null {
  try {
    compileFormula(src, resolve)
    return null
  } catch (e) {
    return e instanceof FormulaError ? e.message : 'The formula is not valid'
  }
}
