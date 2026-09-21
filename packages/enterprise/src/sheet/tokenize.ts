/**
 * Formula lexer.
 *
 * The awkward part of spreadsheet lexing is that `A1`, `A1:B2`, `Sheet1!A1`,
 * `'Price list'!A1:B2`, `SUM(` and `TRUE` all start life as the same run of
 * letters and digits. Rather than guess, the lexer reads the whole word plus
 * whatever qualifies it (a `!` before, a `:` after, a `(` after) and decides
 * once, with all of it in hand.
 *
 * `$` is part of a word here and stays in the text handed to `parseA1`, which
 * is what keeps absolute references absolute.
 */
import { parseA1, type CellRef } from './address'
import { FormulaError, type BinaryOp, type SheetError } from './ast'

export type TableRefToken = {
  t: 'table'
  table: string | null
  column: string | null
  columnTo?: string | null
  specifier: '#All' | '#Data' | '#Headers' | '#Totals' | '#ThisRow'
}

export type Token =
  | TableRefToken
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'err'; v: SheetError }
  | { t: 'ref'; ref: CellRef }
  /** The spilled-range operator `A1#`: the anchor a spill is read from. */
  | { t: 'spill'; ref: CellRef }
  | { t: 'range'; from: CellRef; to: CellRef }
  | { t: 'name'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'op'; v: BinaryOp }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'comma' }

const WORD = /[A-Za-z0-9$_.]/

const SPECIFIERS: Record<string, TableRefToken['specifier']> = {
  '#all': '#All',
  '#data': '#Data',
  '#headers': '#Headers',
  '#totals': '#Totals',
  '#this row': '#ThisRow',
}
/** The error values a formula can name, longest first so #NUM! cannot win
 *  the prefix of a longer code. */
const ERROR_LITERAL = /^(#NULL!|#DIV\/0!|#VALUE!|#NAME\?|#NUM!|#N\/A|#REF!|#SPILL!|#CALC!|#CYCLE!)/i

const TWO_CHAR_OPS = new Set(['<=', '>=', '<>'])
const ONE_CHAR_OPS = '+-*/^%&=<>'

export function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0

  /** Index of the next non-space character, without consuming anything. */
  const skipSpace = (): number => {
    let j = i
    while (j < src.length && /\s/.test(src[j]!)) j += 1
    return j
  }

  const readWord = (): string => {
    const start = i
    while (i < src.length && WORD.test(src[i]!)) i += 1
    return src.slice(start, i)
  }

  /**
   * Read a structured reference's bracket, having just consumed the `[`.
   *
   * The grammar is small but irregular: `[Amount]` is a column, `[@Amount]`
   * is this row of it, `[#Totals]` is a specifier, and
   * `[[Qty]:[Amount]]` is a span whose inner brackets are part of the
   * syntax rather than nesting. Reading it as balanced brackets and then
   * picking the pieces apart handles all four without a special case each.
   */
  const readTableBracket = (table: string | null): TableRefToken => {
    let depth = 1
    const start = i
    while (i < src.length && depth > 0) {
      if (src[i] === '[') depth += 1
      else if (src[i] === ']') depth -= 1
      if (depth > 0) i += 1
    }
    if (depth !== 0) throw new FormulaError('#PARSE!')
    const body = src.slice(start, i)
    i += 1  // past the closing ]

    let specifier: TableRefToken['specifier'] = '#Data'
    let column: string | null = null
    let columnTo: string | null = null

    // Split on top-level commas, so [#Data],[Amount] arrives as two parts.
    const parts: string[] = []
    let current = ''
    let inner = 0
    for (const ch of body) {
      if (ch === '[') inner += 1
      else if (ch === ']') inner -= 1
      if (ch === ',' && inner === 0) { parts.push(current); current = ''; continue }
      current += ch
    }
    parts.push(current)

    for (const rawPart of parts) {
      let part = rawPart.trim()
      if (part === '') continue

      if (part.startsWith('@')) {
        specifier = '#ThisRow'
        part = part.slice(1).trim()
        if (part === '') continue
      }

      const known = SPECIFIERS[part.toLowerCase()]
      if (known) { specifier = known; continue }

      // A span: [Qty]:[Amount]
      const span = /^\[([^\]]*)\]\s*:\s*\[([^\]]*)\]$/.exec(part)
      if (span) {
        column = span[1]!.trim()
        columnTo = span[2]!.trim()
        continue
      }

      // A single bracketed part, which is how a name containing a space or a
      // comma is written - and also how a specifier arrives inside a
      // multi-part reference like [[#Headers],[Amount]], so unwrap FIRST
      // and re-check before assuming it names a column.
      const wrapped = /^\[([^\]]*)\]$/.exec(part)
      const unwrapped = (wrapped ? wrapped[1]! : part).trim()
      const inner = SPECIFIERS[unwrapped.toLowerCase()]
      if (inner) { specifier = inner; continue }
      if (unwrapped.startsWith('@')) {
        specifier = '#ThisRow'
        const rest = unwrapped.slice(1).trim()
        if (rest !== '') column = rest
        continue
      }
      column = unwrapped
    }

    return columnTo === null
      ? { t: 'table', table, column, specifier }
      : { t: 'table', table, column, columnTo, specifier }
  }

  /** Turn a word (and possibly `:word` after it) into a ref, range or name. */
  const pushWord = (word: string, sheet: string | null): void => {
    const left = parseA1(word, sheet)

    // Excel accepts whitespace around the range colon: `SUM(A1 : B2)`. Look
    // past it before deciding this is a lone reference, or that formula comes
    // back unparseable.
    const afterSpace = skipSpace()
    if (src[afterSpace] === ':') {
      i = afterSpace + 1
      while (i < src.length && /\s/.test(src[i]!)) i += 1
      const rightWord = readWord()
      const right = parseA1(rightWord, sheet)
      if (!left || !right) throw new FormulaError('#PARSE!')
      out.push({ t: 'range', from: left, to: right })
      return
    }

    if (!left) throw new FormulaError('#PARSE!')

    // A word with no row is a whole-column reference (`A:A` written as `A`),
    // which is a range from row 0 to the end of the sheet.
    if (left.row === null) {
      // A bare word on a sheet-qualified ref is still a column. Unqualified,
      // it could be a defined name - the parser decides using `name` tokens,
      // so only emit a column range when the text looks like one.
      if (sheet !== null) {
        out.push({ t: 'range', from: { ...left, row: 0 }, to: { ...left, row: null } })
        return
      }
      out.push({ t: 'name', v: word })
      return
    }
    // `A1#` is the spilled-range operator: the `#` binds to the reference
    // right before it, with no space between, and names the whole array the
    // cell anchors. A `#` that starts an error literal is handled elsewhere;
    // one sitting immediately after a cell is only ever this.
    if (src[i] === '#') { i += 1; out.push({ t: 'spill', ref: left }); return }
    out.push({ t: 'ref', ref: left })
  }

  while (i < src.length) {
    const ch = src[i]!

    if (/\s/.test(ch)) { i += 1; continue }
    if (ch === '(') { out.push({ t: 'lparen' }); i += 1; continue }
    if (ch === ')') { out.push({ t: 'rparen' }); i += 1; continue }
    if (ch === ',') { out.push({ t: 'comma' }); i += 1; continue }

    // String literal. Excel escapes a quote by doubling it.
    if (ch === '"') {
      i += 1
      let value = ''
      for (;;) {
        if (i >= src.length) throw new FormulaError('#PARSE!')
        if (src[i] === '"') {
          if (src[i + 1] === '"') { value += '"'; i += 2; continue }
          i += 1
          break
        }
        value += src[i]
        i += 1
      }
      out.push({ t: 'str', v: value })
      continue
    }

    // Quoted sheet name: 'Price list'!A1
    if (ch === "'") {
      i += 1
      let sheet = ''
      for (;;) {
        if (i >= src.length) throw new FormulaError('#PARSE!')
        if (src[i] === "'") {
          if (src[i + 1] === "'") { sheet += "'"; i += 2; continue }
          i += 1
          break
        }
        sheet += src[i]
        i += 1
      }
      if (src[i] !== '!') throw new FormulaError('#PARSE!')
      i += 1
      pushWord(readWord(), sheet)
      continue
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const start = i
      while (i < src.length && /[0-9.]/.test(src[i]!)) i += 1
      // Scientific notation: 1e5, 2.5E-3.
      if ((src[i] === 'e' || src[i] === 'E') && /[0-9+-]/.test(src[i + 1] ?? '')) {
        i += 1
        if (src[i] === '+' || src[i] === '-') i += 1
        while (i < src.length && /[0-9]/.test(src[i]!)) i += 1
      }
      const n = Number(src.slice(start, i))
      if (!Number.isFinite(n)) throw new FormulaError('#PARSE!')
      out.push({ t: 'num', v: n })
      continue
    }

    if (/[A-Za-z$_]/.test(ch)) {
      const word = readWord()
      const upper = word.toUpperCase()

      // Unquoted sheet name: Orders!A1
      if (src[i] === '!') {
        i += 1
        pushWord(readWord(), word)
        continue
      }

      // A word followed by `[` is a table: Orders[Amount].
      if (src[i] === '[') { i += 1; out.push(readTableBracket(word)); continue }

      // A word followed by `(` is a call, whatever else it might look like -
      // TRUE and FALSE included, since Excel has TRUE() and FALSE() as
      // functions and that is how LibreOffice writes a boolean cell.
      if (src[skipSpace()] === '(') { out.push({ t: 'fn', v: upper }); continue }

      if (upper === 'TRUE') { out.push({ t: 'bool', v: true }); continue }
      if (upper === 'FALSE') { out.push({ t: 'bool', v: false }); continue }

      pushWord(word, null)
      continue
    }

    // An error written into the formula: =#N/A, =IFERROR(A1, #REF!). Excel
    // reads one as a value, and a file can carry an error cell as a formula
    // that is nothing else.
    if (ch === '#') {
      const code = ERROR_LITERAL.exec(src.slice(i))
      if (code) {
        out.push({ t: 'err', v: code[0].toUpperCase() as SheetError })
        i += code[0].length
        continue
      }
      throw new FormulaError('#PARSE!')
    }

    // A bare `[` is the unqualified form, which only means something in a
    // formula sitting inside a table: [@Amount].
    if (ch === '[') { i += 1; out.push(readTableBracket(null)); continue }

    const two = src.slice(i, i + 2)
    if (TWO_CHAR_OPS.has(two)) { out.push({ t: 'op', v: two as BinaryOp }); i += 2; continue }
    if (ONE_CHAR_OPS.includes(ch)) { out.push({ t: 'op', v: ch as BinaryOp }); i += 1; continue }

    throw new FormulaError('#PARSE!')
  }

  return out
}
