/**
 * Free-text expression parsing, stringifying, and validation.
 *
 * The structured builder in `SvExpressionEditor` writes the AST directly; this
 * module powers the optional free-text mode and the "explain this rule" display.
 * The parser is a small recursive-descent / precedence parser - deliberately
 * dependency-free.
 *
 * Grammar (informal):
 *   predicate  := or
 *   or         := and ( "OR" and )*
 *   and        := not ( "AND" not )*
 *   not        := "NOT" not | primary
 *   primary    := "(" predicate ")" | comparison | boolLiteral
 *   comparison := scalar ( symOp scalar
 *                        | "CONTAINS"|"STARTSWITH"|"ENDSWITH"|"MATCHES" scalar
 *                        | "IN" "(" scalarList ")"
 *                        | "BETWEEN" scalar "AND" scalar
 *                        | "ISBLANK" | "ISNOTBLANK" )
 *   scalar     := add ; add := mul (("+"|"-") mul)* ; mul := unary (("*"|"/"|"%") unary)*
 *   unary      := "-" unary | atom
 *   atom       := number | string | TRUE|FALSE|NULL | colRef
 *               | ("SUM"|"AVG"|"COUNT") "(" colRef ")" | ident "(" args ")" | "(" scalar ")"
 *   colRef     := ident | "[" ... "]"
 */
import type { ExcelFilterOperator } from '@svgrid/grid'
import type {
  ComparisonOp,
  PredicateExpr,
  ScalarExpr,
} from './expression-types.js'
import {
  columnRefText,
  resolveColumnRef,
  type ExprColumn,
} from './expression-columns.js'
import { isBuiltinFunction } from './evaluate.js'

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokKind = 'num' | 'str' | 'ident' | 'bracket' | 'kw' | 'op' | 'eof'
type Token = { kind: TokKind; value: string; pos: number }

const KEYWORDS = new Set([
  'AND', 'OR', 'NOT', 'TRUE', 'FALSE', 'NULL',
  'CONTAINS', 'STARTSWITH', 'ENDSWITH', 'MATCHES',
  'IN', 'BETWEEN', 'ISBLANK', 'ISNOTBLANK',
])

const AGG_KEYWORDS = new Set(['SUM', 'AVG', 'COUNT'])

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = input.length
  while (i < n) {
    const c = input[i] as string // i < n, so always defined
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }
    const start = i
    // Bracketed column reference: [ ... ]
    if (c === '[') {
      const end = input.indexOf(']', i + 1)
      if (end < 0) throw new ExpressionParseError('Unclosed "[" reference', start)
      tokens.push({ kind: 'bracket', value: input.slice(i + 1, end), pos: start })
      i = end + 1
      continue
    }
    // String literal (single or double quote)
    if (c === '"' || c === "'") {
      let j = i + 1
      let out = ''
      while (j < n && input[j] !== c) {
        if (input[j] === '\\' && j + 1 < n) {
          out += input[j + 1]
          j += 2
        } else {
          out += input[j]
          j++
        }
      }
      if (j >= n) throw new ExpressionParseError('Unterminated string', start)
      tokens.push({ kind: 'str', value: out, pos: start })
      i = j + 1
      continue
    }
    // Number literal
    if (isDigit(c) || (c === '.' && isDigit(input[i + 1] ?? ''))) {
      let j = i
      while (j < n && (isDigit(input[j]) || input[j] === '.')) j++
      tokens.push({ kind: 'num', value: input.slice(i, j), pos: start })
      i = j
      continue
    }
    // Identifier / keyword
    if (isIdentStart(c)) {
      let j = i
      while (j < n && isIdentPart(input[j])) j++
      const raw = input.slice(i, j)
      const upper = raw.toUpperCase()
      tokens.push({ kind: KEYWORDS.has(upper) ? 'kw' : 'ident', value: KEYWORDS.has(upper) ? upper : raw, pos: start })
      i = j
      continue
    }
    // Multi-char operators
    const two = input.slice(i, i + 2)
    if (two === '>=' || two === '<=' || two === '!=' || two === '<>' || two === '==') {
      tokens.push({ kind: 'op', value: two === '<>' ? '!=' : two === '==' ? '=' : two, pos: start })
      i += 2
      continue
    }
    if ('=<>+-*/%(),'.includes(c)) {
      tokens.push({ kind: 'op', value: c, pos: start })
      i++
      continue
    }
    throw new ExpressionParseError(`Unexpected character "${c}"`, start)
  }
  tokens.push({ kind: 'eof', value: '', pos: n })
  return tokens
}

function isDigit(c: string | undefined): boolean {
  return c != null && c >= '0' && c <= '9'
}
function isIdentStart(c: string | undefined): boolean {
  return c != null && /[A-Za-z_$]/.test(c)
}
function isIdentPart(c: string | undefined): boolean {
  return c != null && /[\w$.]/.test(c)
}

/** Thrown by `parsePredicate` with a character offset into the source. */
export class ExpressionParseError extends Error {
  pos: number
  constructor(message: string, pos: number) {
    super(message)
    this.name = 'ExpressionParseError'
    this.pos = pos
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const SYM_TO_CMP: Partial<Record<string, ExcelFilterOperator>> = {
  '=': 'equals',
  '!=': 'notEquals',
  '>': 'greaterThan',
  '<': 'lessThan',
}

class Parser {
  private pos = 0
  constructor(
    private readonly tokens: Token[],
    private readonly columns: ReadonlyArray<ExprColumn>,
  ) {}

  private peek(): Token {
    // The token stream always ends with an `eof` token, so `pos` is in range.
    return this.tokens[this.pos] as Token
  }
  private next(): Token {
    return this.tokens[this.pos++] as Token
  }
  private eat(kind: TokKind, value?: string): Token {
    const t = this.peek()
    if (t.kind !== kind || (value != null && t.value !== value)) {
      throw new ExpressionParseError(
        `Expected ${value ?? kind}${t.kind === 'eof' ? ' but reached the end' : `, got "${t.value || t.kind}"`}`,
        t.pos,
      )
    }
    return this.next()
  }
  private isKw(v: string): boolean {
    const t = this.peek()
    return t.kind === 'kw' && t.value === v
  }
  private isOp(v: string): boolean {
    const t = this.peek()
    return t.kind === 'op' && t.value === v
  }

  parse(): PredicateExpr {
    const expr = this.parseOr()
    if (this.peek().kind !== 'eof') {
      throw new ExpressionParseError(`Unexpected "${this.peek().value}"`, this.peek().pos)
    }
    return expr
  }

  private parseOr(): PredicateExpr {
    const parts = [this.parseAnd()]
    while (this.isKw('OR')) {
      this.next()
      parts.push(this.parseAnd())
    }
    return parts.length === 1 ? (parts[0] as PredicateExpr) : { kind: 'or', parts }
  }

  private parseAnd(): PredicateExpr {
    const parts = [this.parseNot()]
    while (this.isKw('AND')) {
      this.next()
      parts.push(this.parseNot())
    }
    return parts.length === 1 ? (parts[0] as PredicateExpr) : { kind: 'and', parts }
  }

  private parseNot(): PredicateExpr {
    if (this.isKw('NOT')) {
      this.next()
      return { kind: 'not', expr: this.parseNot() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): PredicateExpr {
    if (this.isOp('(')) {
      // Could be a grouped predicate or a parenthesised scalar comparison.
      const save = this.pos
      this.next()
      // Try predicate group first.
      try {
        const inner = this.parseOr()
        if (this.isOp(')')) {
          this.next()
          return inner
        }
      } catch {
        // fall through to scalar comparison
      }
      this.pos = save
    }
    return this.parseComparison()
  }

  private parseComparison(): PredicateExpr {
    const left = this.parseScalar()
    const t = this.peek()

    // Postfix valueless keyword ops.
    if (this.isKw('ISBLANK') || this.isKw('ISNOTBLANK')) {
      const op: ExcelFilterOperator = this.next().value === 'ISBLANK' ? 'isBlank' : 'isNotBlank'
      return { kind: 'cmp', column: this.expectColumn(left), op }
    }
    // Keyword text/set/range ops.
    if (t.kind === 'kw') {
      switch (t.value) {
        case 'CONTAINS':
        case 'STARTSWITH':
        case 'ENDSWITH':
        case 'MATCHES': {
          this.next()
          const rhs = this.parseScalar()
          const op: ExcelFilterOperator =
            t.value === 'CONTAINS' ? 'contains'
            : t.value === 'STARTSWITH' ? 'startsWith'
            : t.value === 'ENDSWITH' ? 'endsWith'
            : 'regex'
          return { kind: 'cmp', column: this.expectColumn(left), op, value: literalValue(rhs) }
        }
        case 'IN': {
          this.next()
          this.eat('op', '(')
          const items: unknown[] = []
          if (!this.isOp(')')) {
            items.push(literalValue(this.parseScalar()))
            while (this.isOp(',')) {
              this.next()
              items.push(literalValue(this.parseScalar()))
            }
          }
          this.eat('op', ')')
          return { kind: 'cmp', column: this.expectColumn(left), op: 'in', value: items.map((v) => String(v ?? '')) }
        }
        case 'BETWEEN': {
          this.next()
          const lo = literalValue(this.parseScalar())
          this.eat('kw', 'AND')
          const hi = literalValue(this.parseScalar())
          return { kind: 'cmp', column: this.expectColumn(left), op: 'between', value: lo, valueTo: hi }
        }
      }
    }
    // Symbolic comparators.
    if (t.kind === 'op' && ['=', '!=', '>', '<', '>=', '<='].includes(t.value)) {
      const opTok = this.next().value
      const right = this.parseScalar()
      // Prefer a `cmp` (grid-filter semantics) for `col OP literal`; otherwise
      // fall back to a general scalar comparison.
      const cmpOp = SYM_TO_CMP[opTok]
      if (cmpOp && left.kind === 'col' && right.kind === 'lit') {
        return { kind: 'cmp', column: left.id, op: cmpOp, value: right.value }
      }
      return { kind: 'scalarCmp', left, op: opTok as ComparisonOp, right }
    }
    // Bare boolean literal is a constant predicate.
    if (left.kind === 'lit' && typeof left.value === 'boolean') {
      return { kind: 'const', value: left.value }
    }
    throw new ExpressionParseError('Expected a comparison operator', t.pos)
  }

  private expectColumn(expr: ScalarExpr): string {
    if (expr.kind !== 'col') {
      throw new ExpressionParseError('This operator requires a column on its left', this.peek().pos)
    }
    return expr.id
  }

  // Scalar precedence climbing --------------------------------------------

  private parseScalar(): ScalarExpr {
    return this.parseAdd()
  }
  private parseAdd(): ScalarExpr {
    let left = this.parseMul()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().value as '+' | '-'
      left = { kind: 'bin', op, left, right: this.parseMul() }
    }
    return left
  }
  private parseMul(): ScalarExpr {
    let left = this.parseUnary()
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().value as '*' | '/' | '%'
      left = { kind: 'bin', op, left, right: this.parseUnary() }
    }
    return left
  }
  private parseUnary(): ScalarExpr {
    if (this.isOp('-')) {
      this.next()
      return { kind: 'neg', expr: this.parseUnary() }
    }
    return this.parseAtom()
  }
  private parseAtom(): ScalarExpr {
    const t = this.peek()
    if (t.kind === 'num') {
      this.next()
      return { kind: 'lit', value: Number(t.value) }
    }
    if (t.kind === 'str') {
      this.next()
      return { kind: 'lit', value: t.value }
    }
    if (t.kind === 'bracket') {
      this.next()
      return { kind: 'col', id: resolveColumnRef(this.columns, t.value) }
    }
    if (t.kind === 'kw' && (t.value === 'TRUE' || t.value === 'FALSE')) {
      this.next()
      return { kind: 'lit', value: t.value === 'TRUE' }
    }
    if (t.kind === 'kw' && t.value === 'NULL') {
      this.next()
      return { kind: 'lit', value: null }
    }
    if (this.isOp('(')) {
      this.next()
      const inner = this.parseScalar()
      this.eat('op', ')')
      return inner
    }
    if (t.kind === 'ident') {
      this.next()
      // Function or aggregate call?
      if (this.isOp('(')) {
        this.next()
        const args: ScalarExpr[] = []
        if (!this.isOp(')')) {
          args.push(this.parseScalar())
          while (this.isOp(',')) {
            this.next()
            args.push(this.parseScalar())
          }
        }
        this.eat('op', ')')
        const upper = t.value.toUpperCase()
        if (AGG_KEYWORDS.has(upper)) {
          const arg = args[0]
          if (args.length !== 1 || !arg || arg.kind !== 'col') {
            throw new ExpressionParseError(`${upper}() takes a single column reference`, t.pos)
          }
          return { kind: 'agg', fn: upper.toLowerCase() as 'sum' | 'avg' | 'count', column: arg.id }
        }
        return { kind: 'func', name: t.value, args }
      }
      // Bare identifier is a column reference.
      return { kind: 'col', id: resolveColumnRef(this.columns, t.value) }
    }
    throw new ExpressionParseError(`Unexpected "${t.value || t.kind}"`, t.pos)
  }
}

function literalValue(expr: ScalarExpr): unknown {
  if (expr.kind === 'lit') return expr.value
  // Non-literal RHS for a keyword op: fall back to its text form.
  return stringifyScalar(expr, [])
}

/**
 * Parse a free-text predicate into an AST. Column references (`[Name]` or a
 * bare id) are resolved against `columns`. Throws `ExpressionParseError`
 * (carrying a source offset) on a syntax error.
 */
export function parsePredicate(
  text: string,
  columns: ReadonlyArray<ExprColumn> = [],
): PredicateExpr {
  const trimmed = text.trim()
  if (!trimmed) throw new ExpressionParseError('Expression is empty', 0)
  return new Parser(tokenize(trimmed), columns).parse()
}

// ---------------------------------------------------------------------------
// Stringify
// ---------------------------------------------------------------------------

function litText(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return `"${String(value).replace(/"/g, '\\"')}"`
}

/** Render a scalar expression back to source text. */
export function stringifyScalar(
  expr: ScalarExpr,
  columns: ReadonlyArray<ExprColumn>,
): string {
  switch (expr.kind) {
    case 'lit':
      return litText(expr.value)
    case 'col':
      return columnRefText(columns, expr.id)
    case 'neg':
      return `-${wrapScalar(expr.expr, columns)}`
    case 'bin':
      return `${wrapScalar(expr.left, columns)} ${expr.op} ${wrapScalar(expr.right, columns)}`
    case 'agg':
      return `${expr.fn.toUpperCase()}(${columnRefText(columns, expr.column)})`
    case 'func':
      return `${expr.name.toUpperCase()}(${expr.args.map((a) => stringifyScalar(a, columns)).join(', ')})`
  }
}

function wrapScalar(expr: ScalarExpr, columns: ReadonlyArray<ExprColumn>): string {
  const s = stringifyScalar(expr, columns)
  return expr.kind === 'bin' ? `(${s})` : s
}

const CMP_SYMBOL: Partial<Record<ExcelFilterOperator, string>> = {
  equals: '=',
  notEquals: '!=',
  greaterThan: '>',
  lessThan: '<',
}
const CMP_KEYWORD: Partial<Record<ExcelFilterOperator, string>> = {
  contains: 'CONTAINS',
  notContains: 'NOT CONTAINS',
  startsWith: 'STARTSWITH',
  endsWith: 'ENDSWITH',
  regex: 'MATCHES',
}

/** Render a predicate expression back to readable source text. */
export function stringifyPredicate(
  expr: PredicateExpr,
  columns: ReadonlyArray<ExprColumn> = [],
): string {
  switch (expr.kind) {
    case 'const':
      return expr.value ? 'true' : 'false'
    case 'not':
      return `NOT ${wrapPred(expr.expr, columns)}`
    case 'and':
      return expr.parts.map((p) => wrapPred(p, columns)).join(' AND ')
    case 'or':
      return expr.parts.map((p) => wrapPred(p, columns)).join(' OR ')
    case 'scalarCmp':
      return `${stringifyScalar(expr.left, columns)} ${expr.op} ${stringifyScalar(expr.right, columns)}`
    case 'cmp': {
      const col = columnRefText(columns, expr.column)
      if (expr.op === 'isBlank') return `${col} ISBLANK`
      if (expr.op === 'isNotBlank') return `${col} ISNOTBLANK`
      if (expr.op === 'between') return `${col} BETWEEN ${litText(expr.value)} AND ${litText(expr.valueTo)}`
      if (expr.op === 'in' || expr.op === 'notIn') {
        const items = Array.isArray(expr.value) ? expr.value : String(expr.value ?? '').split(/[\n,]/)
        const list = items.map((v) => litText(String(v).trim())).join(', ')
        return `${col} ${expr.op === 'in' ? 'IN' : 'NOT IN'} (${list})`
      }
      const sym = CMP_SYMBOL[expr.op]
      if (sym) return `${col} ${sym} ${litText(expr.value)}`
      const kw = CMP_KEYWORD[expr.op]
      return `${col} ${kw ?? expr.op} ${litText(expr.value)}`
    }
  }
}

function wrapPred(expr: PredicateExpr, columns: ReadonlyArray<ExprColumn>): string {
  const s = stringifyPredicate(expr, columns)
  return expr.kind === 'and' || expr.kind === 'or' ? `(${s})` : s
}

// ---------------------------------------------------------------------------
// Validation + reference collection
// ---------------------------------------------------------------------------

/** Every column id referenced anywhere in a predicate (deduped, in order). */
export function collectColumnRefs(expr: PredicateExpr): string[] {
  const out = new Set<string>()
  walkPredicate(expr, out)
  return [...out]
}

function walkPredicate(expr: PredicateExpr, out: Set<string>): void {
  switch (expr.kind) {
    case 'and':
    case 'or':
      expr.parts.forEach((p) => walkPredicate(p, out))
      return
    case 'not':
      walkPredicate(expr.expr, out)
      return
    case 'cmp':
      out.add(expr.column)
      return
    case 'scalarCmp':
      walkScalar(expr.left, out)
      walkScalar(expr.right, out)
      return
    case 'const':
      return
  }
}

function walkScalar(expr: ScalarExpr, out: Set<string>): void {
  switch (expr.kind) {
    case 'col':
      out.add(expr.id)
      return
    case 'agg':
      out.add(expr.column)
      return
    case 'neg':
      walkScalar(expr.expr, out)
      return
    case 'bin':
      walkScalar(expr.left, out)
      walkScalar(expr.right, out)
      return
    case 'func':
      expr.args.forEach((a) => walkScalar(a, out))
      return
    case 'lit':
      return
  }
}

/**
 * Structurally validate an AST against a column list. Returns a list of
 * human-readable problems (empty when the expression is sound): unknown column
 * references and unknown function names.
 */
export function validateExpression(
  expr: PredicateExpr,
  columns: ReadonlyArray<ExprColumn>,
): string[] {
  const known = new Set(columns.map((c) => c.id))
  const errors: string[] = []
  for (const id of collectColumnRefs(expr)) {
    if (!known.has(id)) errors.push(`Unknown column "${id}"`)
  }
  checkFuncs(expr, errors)
  return errors
}

function checkFuncs(expr: PredicateExpr, errors: string[]): void {
  const visit = (s: ScalarExpr): void => {
    if (s.kind === 'func' && !isBuiltinFunction(s.name)) {
      errors.push(`Unknown function "${s.name}"`)
    }
    if (s.kind === 'func') s.args.forEach(visit)
    if (s.kind === 'bin') {
      visit(s.left)
      visit(s.right)
    }
    if (s.kind === 'neg') visit(s.expr)
  }
  const walk = (p: PredicateExpr): void => {
    if (p.kind === 'and' || p.kind === 'or') p.parts.forEach(walk)
    else if (p.kind === 'not') walk(p.expr)
    else if (p.kind === 'scalarCmp') {
      visit(p.left)
      visit(p.right)
    }
  }
  walk(expr)
}
