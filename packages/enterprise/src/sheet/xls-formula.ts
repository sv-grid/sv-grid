/**
 * Formulas in an .xls, which are not text.
 *
 * BIFF8 keeps a formula as RPN: a run of tokens, each a byte and its
 * operand, that a stack machine would run. `=SUM(A1:A3)*2` is stored as an
 * area token, a function token, a number token and a multiply token, and
 * nothing in the file spells the formula out. So reading one means walking
 * the tokens back into text, and writing one means walking our own AST into
 * tokens.
 *
 * Not every formula translates. Excel 97 had no XLOOKUP and no LET, and
 * there is no token for a function it did not have, so `rpnFromFormula`
 * answers null and the writer falls back to the cached value. Reading works
 * the same way round: a token this module does not know stops the walk and
 * the cell keeps the value the file cached for it.
 */
import { colToLetters } from './address'
import { parseFormula } from './parse'
import type { BinaryOp, Node } from './ast'

/**
 * Excel's function table: the index a token names, and how many arguments
 * the function takes when that count is fixed.
 *
 * A fixed-arity function is written with ptgFunc, which carries only the
 * index; everything else is ptgFuncVar, which carries the count as well.
 * Getting that wrong produces a file that opens with the wrong formula, so
 * the table is checked against files written by a real spreadsheet in
 * `xls-formula.test.ts` rather than trusted.
 */
const FUNCTIONS: Record<string, [id: number, args: number]> = {
  COUNT: [0, -1], IF: [1, -1], ISNA: [2, 1], ISERROR: [3, 1], SUM: [4, -1], AVERAGE: [5, -1],
  MIN: [6, -1], MAX: [7, -1], ROW: [8, -1], COLUMN: [9, -1], NA: [10, 0], NPV: [11, -1],
  STDEV: [12, -1], DOLLAR: [13, -1], FIXED: [14, -1], SIN: [15, 1], COS: [16, 1], TAN: [17, 1],
  ATAN: [18, 1], PI: [19, 0], SQRT: [20, 1], EXP: [21, 1], LN: [22, 1], LOG10: [23, 1],
  ABS: [24, 1], INT: [25, 1], SIGN: [26, 1], ROUND: [27, 2], LOOKUP: [28, -1], INDEX: [29, -1],
  REPT: [30, 2], MID: [31, 3], LEN: [32, 1], VALUE: [33, 1], TRUE: [34, 0], FALSE: [35, 0],
  AND: [36, -1], OR: [37, -1], NOT: [38, 1], MOD: [39, 2], DCOUNT: [40, 3], DSUM: [41, 3],
  DAVERAGE: [42, 3], DMIN: [43, 3], DMAX: [44, 3], DSTDEV: [45, 3], VAR: [46, -1], DVAR: [47, 3],
  TEXT: [48, 2], PV: [56, -1], FV: [57, -1], NPER: [58, -1], PMT: [59, -1], RATE: [60, -1],
  MIRR: [61, 3], IRR: [62, -1], RAND: [63, 0], MATCH: [64, -1], DATE: [65, 3], TIME: [66, 3],
  DAY: [67, 1], MONTH: [68, 1], YEAR: [69, 1], WEEKDAY: [70, -1], HOUR: [71, 1], MINUTE: [72, 1],
  SECOND: [73, 1], NOW: [74, 0], AREAS: [75, 1], ROWS: [76, 1], COLUMNS: [77, 1], OFFSET: [78, -1],
  SEARCH: [82, -1], TRANSPOSE: [83, 1], TYPE: [86, 1], ATAN2: [97, 2], ASIN: [98, 1], ACOS: [99, 1],
  CHOOSE: [100, -1], HLOOKUP: [101, -1], VLOOKUP: [102, -1], ISREF: [105, 1], LOG: [109, -1],
  CHAR: [111, 1], LOWER: [112, 1], UPPER: [113, 1], PROPER: [114, 1], LEFT: [115, -1],
  RIGHT: [116, -1], EXACT: [117, 2], TRIM: [118, 1], REPLACE: [119, 4], SUBSTITUTE: [120, -1],
  CODE: [121, 1], FIND: [124, -1], CELL: [125, -1], ISERR: [126, 1], ISTEXT: [127, 1],
  ISNUMBER: [128, 1], ISBLANK: [129, 1], T: [130, 1], N: [131, 1], DATEVALUE: [140, 1],
  TIMEVALUE: [141, 1], SLN: [142, 3], SYD: [143, 4], DDB: [144, -1], INDIRECT: [148, -1],
  CLEAN: [162, 1], MDETERM: [163, 1], MINVERSE: [164, 1], MMULT: [165, 2], IPMT: [167, -1],
  PPMT: [168, -1], COUNTA: [169, -1], PRODUCT: [183, -1], FACT: [184, 1], DPRODUCT: [189, 3],
  ISNONTEXT: [190, 1], STDEVP: [193, -1], VARP: [194, -1], DSTDEVP: [195, 3], DVARP: [196, 3],
  TRUNC: [197, -1], ISLOGICAL: [198, 1], DCOUNTA: [199, 3], ROUNDUP: [212, 2], ROUNDDOWN: [213, 2],
  RANK: [216, -1], ADDRESS: [219, -1], DAYS360: [220, -1], TODAY: [221, 0], VDB: [222, -1],
  MEDIAN: [227, -1], SUMPRODUCT: [228, -1], SINH: [229, 1], COSH: [230, 1], TANH: [231, 1],
  ASINH: [232, 1], ACOSH: [233, 1], ATANH: [234, 1], DGET: [235, 3], INFO: [244, 1], DB: [247, -1],
  FREQUENCY: [252, 2], 'ERROR.TYPE': [261, 1], AVEDEV: [269, -1], BETADIST: [270, -1],
  GAMMALN: [271, 1], BETAINV: [272, -1], BINOMDIST: [273, 4], CHIDIST: [274, 2], CHIINV: [275, 2],
  COMBIN: [276, 2], CONFIDENCE: [277, 3], CRITBINOM: [278, 3], EVEN: [279, 1], EXPONDIST: [280, 3],
  FDIST: [281, 3], FINV: [282, 3], FISHER: [283, 1], FISHERINV: [284, 1], FLOOR: [285, 2],
  GAMMADIST: [286, 4], GAMMAINV: [287, 3], CEILING: [288, 2], HYPGEOMDIST: [289, 4],
  LOGNORMDIST: [290, 3], LOGINV: [291, 3], NEGBINOMDIST: [292, 3], NORMDIST: [293, 4],
  NORMSDIST: [294, 1], NORMINV: [295, 3], NORMSINV: [296, 1], STANDARDIZE: [297, 3], ODD: [298, 1],
  PERMUT: [299, 2], POISSON: [300, 3], TDIST: [301, 3], WEIBULL: [302, 4], SUMXMY2: [303, 2],
  SUMX2MY2: [304, 2], SUMX2PY2: [305, 2], CHITEST: [306, 2], CORREL: [307, 2], COVAR: [308, 2],
  FORECAST: [309, 3], FTEST: [310, 2], INTERCEPT: [311, 2], PEARSON: [312, 2], RSQ: [313, 2],
  STEYX: [314, 2], SLOPE: [315, 2], TTEST: [316, 4], PROB: [317, -1], DEVSQ: [318, -1],
  GEOMEAN: [319, -1], HARMEAN: [320, -1], SUMSQ: [321, -1], KURT: [322, -1], SKEW: [323, -1],
  ZTEST: [324, -1], LARGE: [325, 2], SMALL: [326, 2], QUARTILE: [327, 2], PERCENTILE: [328, 2],
  PERCENTRANK: [329, -1], MODE: [330, -1], TRIMMEAN: [331, 2], TINV: [332, 2],
  CONCATENATE: [336, -1], POWER: [337, 2], RADIANS: [342, 1], DEGREES: [343, 1],
  SUBTOTAL: [344, -1], SUMIF: [345, -1], COUNTIF: [346, 2], COUNTBLANK: [347, 1], ISPMT: [350, 4],
  ROMAN: [354, -1], HYPERLINK: [359, -1], AVERAGEA: [361, -1], MAXA: [362, -1], MINA: [363, -1],
  STDEVPA: [364, -1], VARPA: [365, -1], STDEVA: [366, -1], VARA: [367, -1],
}

const FUNCTION_NAMES = new Map<number, string>()
for (const [name, [id]] of Object.entries(FUNCTIONS)) if (!FUNCTION_NAMES.has(id)) FUNCTION_NAMES.set(id, name)

/** The function a token index names, for the reader. */
export const xlsFunctionName = (id: number): string | undefined => FUNCTION_NAMES.get(id)

/** The token index and fixed arity of a function, for the writer. */
export const xlsFunction = (name: string): [id: number, args: number] | undefined =>
  FUNCTIONS[name.toUpperCase()]

/** The error codes BIFF8 numbers, both ways. */
const ERROR_CODES: Record<number, string> = {
  0x00: '#NULL!', 0x07: '#DIV/0!', 0x0f: '#VALUE!', 0x17: '#REF!',
  0x1d: '#NAME?', 0x24: '#NUM!', 0x2a: '#N/A',
}
export const xlsErrorText = (code: number): string => ERROR_CODES[code] ?? '#VALUE!'
export const xlsErrorCode = (text: string): number => {
  const found = Object.entries(ERROR_CODES).find(([, t]) => t === text.toUpperCase())
  return found ? Number(found[0]) : 0x0f
}

// ---------------------------------------------------------------------------
// Reading: tokens back into text.

export type XlsReadContext = {
  /** The sheet, or sheet span, a 3d reference index names. */
  sheetAt(index: number): string | null
  /** A defined name by its one-based index. */
  nameAt(index: number): string | null
  /** The cell the formula sits in: the relative forms are offsets from it. */
  row: number
  col: number
}

/** One value on the stack, with the binding power of its top operator so a
 *  parenthesis is added only where the text would otherwise read wrong. */
type Piece = { text: string; power: number }

const ATOM = 8

const OPERATORS: Record<number, [op: string, power: number]> = {
  0x03: ['+', 3], 0x04: ['-', 3], 0x05: ['*', 4], 0x06: ['/', 4], 0x07: ['^', 5], 0x08: ['&', 2],
  0x09: ['<', 1], 0x0a: ['<=', 1], 0x0b: ['=', 1], 0x0c: ['>=', 1], 0x0d: ['>', 1], 0x0e: ['<>', 1],
  0x0f: [' ', 6], 0x10: [',', 6], 0x11: [':', 7],
}

const cellText = (row: number, col: number, rowRel: boolean, colRel: boolean): string =>
  `${colRel ? '' : '$'}${colToLetters(col)}${rowRel ? '' : '$'}${row + 1}`

/** A relative offset as stored: signed, and wrapped at the sheet's edge. */
const signed16 = (v: number): number => (v << 16) >> 16
const signed8 = (v: number): number => (v << 24) >> 24

/**
 * The text of a formula stored as RPN, or null when a token is one this
 * reader does not translate.
 *
 * `relative` is set for a shared formula, whose references are offsets from
 * the cell rather than addresses.
 */
export function formulaFromRpn(bytes: Uint8Array, ctx: XlsReadContext): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const stack: Piece[] = []
  const push = (text: string, power = ATOM) => { stack.push({ text, power }) }
  /** An operand, wrapped when it binds more loosely than what is around it. */
  const pop = (power: number): string | null => {
    const piece = stack.pop()
    if (!piece) return null
    return piece.power < power ? `(${piece.text})` : piece.text
  }

  let at = 0
  while (at < bytes.length) {
    const token = bytes[at]!
    at += 1
    const base = token < 0x20 ? token : (token & 0x1f) | 0x20
    const operator = OPERATORS[base]
    if (operator) {
      const [op, power] = operator
      // The right operand of a left-associative operator needs the bracket
      // at equal power too: a - (b - c) is not a - b - c.
      const right = pop(op === '-' || op === '/' || op === '^' ? power + 1 : power)
      const left = pop(power)
      if (left === null || right === null) return null
      push(`${left}${op}${right}`, power)
      continue
    }
    switch (base) {
      case 0x12: { // unary plus
        const arg = pop(6)
        if (arg === null) return null
        push(`+${arg}`, 6)
        break
      }
      case 0x13: { // unary minus
        const arg = pop(6)
        if (arg === null) return null
        push(`-${arg}`, 6)
        break
      }
      case 0x14: { // percent
        const arg = pop(6)
        if (arg === null) return null
        push(`${arg}%`, 6)
        break
      }
      case 0x15: { // the brackets the user typed
        const arg = stack.pop()
        if (!arg) return null
        push(`(${arg.text})`)
        break
      }
      case 0x16: // a skipped argument
        push('')
        break
      case 0x17: { // a text literal
        const read = shortString(bytes, at)
        if (!read) return null
        at = read.next
        push(`"${read.text.replace(/"/g, '""')}"`)
        break
      }
      case 0x19: { // an attribute: mostly hints, but one of them is a SUM
        const grbit = bytes[at]!
        const word = view.getUint16(at + 1, true)
        at += 3
        if (grbit & 0x04) at += (word + 1) * 2 // the jump table of a CHOOSE
        if (grbit & 0x10) { // the one-argument SUM Excel writes as an attribute
          const arg = pop(0)
          if (arg === null) return null
          push(`SUM(${arg})`)
        }
        break
      }
      case 0x1c: // an error value
        push(xlsErrorText(bytes[at]!))
        at += 1
        break
      case 0x1d:
        push(bytes[at] ? 'TRUE' : 'FALSE')
        at += 1
        break
      case 0x1e:
        push(String(view.getUint16(at, true)))
        at += 2
        break
      case 0x1f:
        push(String(view.getFloat64(at, true)))
        at += 8
        break
      case 0x21: { // a function with a fixed number of arguments
        const id = view.getUint16(at, true)
        at += 2
        const name = xlsFunctionName(id)
        if (!name) return null
        const count = FUNCTIONS[name]![1]
        const args = takeArgs(stack, count < 0 ? 0 : count)
        if (!args) return null
        push(`${name}(${args.join(',')})`)
        break
      }
      case 0x22: { // a function with a stated number of arguments
        const count = bytes[at]! & 0x7f
        const id = view.getUint16(at + 1, true) & 0x7fff
        at += 3
        const args = takeArgs(stack, count)
        if (!args) return null
        // 255 is "a function this format has no number for": Excel writes a
        // name in front of the arguments and calls that, which is how a
        // modern function survives being saved as an .xls at all.
        if (id === 255) {
          const called = args.shift()
          if (!called) return null
          push(`${modernName(called)}(${args.join(',')})`)
          break
        }
        const name = xlsFunctionName(id)
        if (!name) return null
        push(`${name}(${args.join(',')})`)
        break
      }
      case 0x23: { // a defined name
        const name = ctx.nameAt(view.getUint16(at, true))
        at += 4
        if (!name) return null
        push(modernName(name))
        break
      }
      case 0x24: { // a cell
        const row = view.getUint16(at, true)
        const col = view.getUint16(at + 2, true)
        at += 4
        push(cellText(row, col & 0x3fff, (col & 0x8000) !== 0, (col & 0x4000) !== 0))
        break
      }
      case 0x25: { // a rectangle
        const r1 = view.getUint16(at, true)
        const r2 = view.getUint16(at + 2, true)
        const c1 = view.getUint16(at + 4, true)
        const c2 = view.getUint16(at + 6, true)
        at += 8
        push(`${cellText(r1, c1 & 0x3fff, (c1 & 0x8000) !== 0, (c1 & 0x4000) !== 0)}:${cellText(r2, c2 & 0x3fff, (c2 & 0x8000) !== 0, (c2 & 0x4000) !== 0)}`)
        break
      }
      case 0x26: // a cached area list: the expression itself follows
      case 0x27:
        at += 6
        break
      case 0x29: // a subexpression whose length is stated and then walked
        at += 2
        break
      case 0x2a: // a reference that was deleted out from under the formula
        at += 4
        push('#REF!')
        break
      case 0x2b:
        at += 8
        push('#REF!')
        break
      case 0x2c: { // a cell, as an offset from this one
        const row = view.getUint16(at, true)
        const col = view.getUint16(at + 2, true)
        at += 4
        const rowRel = (col & 0x8000) !== 0
        const colRel = (col & 0x4000) !== 0
        const here = rowRel ? ctx.row + signed16(row) : row
        const there = colRel ? ctx.col + signed8(col & 0xff) : col & 0x3fff
        if (here < 0 || there < 0) { push('#REF!'); break }
        push(cellText(here, there, rowRel, colRel))
        break
      }
      case 0x2d: { // a rectangle, as offsets from this cell
        const r1 = view.getUint16(at, true)
        const r2 = view.getUint16(at + 2, true)
        const c1 = view.getUint16(at + 4, true)
        const c2 = view.getUint16(at + 6, true)
        at += 8
        const from = offsetCell(r1, c1, ctx)
        const to = offsetCell(r2, c2, ctx)
        if (!from || !to) { push('#REF!'); break }
        push(`${from}:${to}`)
        break
      }
      case 0x39: { // a name in another workbook
        const name = ctx.nameAt(view.getUint16(at + 2, true))
        at += 6
        if (!name) return null
        push(modernName(name))
        break
      }
      case 0x3a: { // a cell on another sheet
        const sheet = ctx.sheetAt(view.getUint16(at, true))
        const row = view.getUint16(at + 2, true)
        const col = view.getUint16(at + 4, true)
        at += 6
        const cell = cellText(row, col & 0x3fff, (col & 0x8000) !== 0, (col & 0x4000) !== 0)
        push(sheet ? `${sheet}!${cell}` : cell)
        break
      }
      case 0x3b: { // a rectangle on another sheet
        const sheet = ctx.sheetAt(view.getUint16(at, true))
        const r1 = view.getUint16(at + 2, true)
        const r2 = view.getUint16(at + 4, true)
        const c1 = view.getUint16(at + 6, true)
        const c2 = view.getUint16(at + 8, true)
        at += 10
        const rect = `${cellText(r1, c1 & 0x3fff, (c1 & 0x8000) !== 0, (c1 & 0x4000) !== 0)}:${cellText(r2, c2 & 0x3fff, (c2 & 0x8000) !== 0, (c2 & 0x4000) !== 0)}`
        push(sheet ? `${sheet}!${rect}` : rect)
        break
      }
      case 0x3c:
        at += 6
        push('#REF!')
        break
      case 0x3d:
        at += 10
        push('#REF!')
        break
      default:
        return null
    }
  }
  // A walk that ends with anything but one value on the stack read a token
  // wrongly somewhere, and half a formula is worse than none.
  const answer = stack.pop()
  return answer && stack.length === 0 ? answer.text : null
}

/**
 * The function a name stands for. Excel has no token for a function it
 * gained after 2003, so it writes `_xlfn.XLOOKUP` as a defined name and
 * calls that; the name is the function, and this is where it turns back
 * into one.
 */
export const modernName = (name: string): string =>
  name.startsWith('_xlfn.') ? name.slice('_xlfn.'.length).replace(/^_xlws\./, '') : name

/** Whether a defined name is only Excel's wrapper for a modern function. */
export const isModernFunctionName = (name: string): boolean => name.startsWith('_xlfn.')

function offsetCell(row: number, col: number, ctx: XlsReadContext): string | null {
  const rowRel = (col & 0x8000) !== 0
  const colRel = (col & 0x4000) !== 0
  const here = rowRel ? ctx.row + signed16(row) : row
  const there = colRel ? ctx.col + signed8(col & 0xff) : col & 0x3fff
  return here < 0 || there < 0 ? null : cellText(here, there, rowRel, colRel)
}

/** The last `count` values, in the order they were written. */
function takeArgs(stack: Piece[], count: number): string[] | null {
  if (stack.length < count) return null
  const args = stack.splice(stack.length - count, count).map((p) => p.text)
  return args
}

/** A string token: a length byte, a flag byte, then the characters. */
function shortString(bytes: Uint8Array, at: number): { text: string; next: number } | null {
  const count = bytes[at]
  const flags = bytes[at + 1]
  if (count === undefined || flags === undefined) return null
  const wide = (flags & 0x01) !== 0
  let text = ''
  let cursor = at + 2
  for (let i = 0; i < count; i += 1) {
    if (wide) {
      text += String.fromCharCode(bytes[cursor]! | (bytes[cursor + 1]! << 8))
      cursor += 2
    } else {
      text += String.fromCharCode(bytes[cursor]!)
      cursor += 1
    }
  }
  return { text, next: cursor }
}

// ---------------------------------------------------------------------------
// Writing: our AST into tokens.

export type XlsWriteContext = {
  /** The index a reference to this sheet takes, adding one if needed. */
  sheetRef(name: string): number
  /** The index of a defined name, or null when the workbook has no such name. */
  nameRef(name: string): number | null
}

class Bytes {
  private data: number[] = []
  byte(v: number): void { this.data.push(v & 0xff) }
  word(v: number): void { this.data.push(v & 0xff, (v >> 8) & 0xff) }
  double(v: number): void {
    const buffer = new DataView(new ArrayBuffer(8))
    buffer.setFloat64(0, v, true)
    for (let i = 0; i < 8; i += 1) this.data.push(buffer.getUint8(i))
  }
  push(...values: number[]): void { for (const v of values) this.data.push(v & 0xff) }
  get length(): number { return this.data.length }
  toBytes(): Uint8Array { return Uint8Array.from(this.data) }
}

/** The RPN for a formula, or null when something in it BIFF8 cannot say. */
export function rpnFromFormula(text: string, ctx: XlsWriteContext): Uint8Array | null {
  let node: Node
  try {
    node = parseFormula(text.startsWith('=') ? text.slice(1) : text)
  } catch {
    return null
  }
  const out = new Bytes()
  return emit(node, out, ctx) ? out.toBytes() : null
}

const OPERATOR_TOKENS: Record<BinaryOp, number> = {
  '+': 0x03, '-': 0x04, '*': 0x05, '/': 0x06, '^': 0x07, '&': 0x08,
  '<': 0x09, '<=': 0x0a, '=': 0x0b, '>=': 0x0c, '>': 0x0d, '<>': 0x0e,
}

/** The row and column words of a reference, flags and all. */
function refWords(out: Bytes, row: number, col: number, rowAbs: boolean, colAbs: boolean): void {
  out.word(row)
  out.word((col & 0x3fff) | (rowAbs ? 0 : 0x8000) | (colAbs ? 0 : 0x4000))
}

/** The last row of a sheet in Excel 97-2003, which is where a whole-column
 *  reference has to stop. */
const LAST_ROW = 65535
const LAST_COL = 255

function emit(node: Node, out: Bytes, ctx: XlsWriteContext): boolean {
  switch (node.k) {
    case 'num':
      // A small whole number has a token of its own, two bytes instead of eight.
      if (Number.isInteger(node.v) && node.v >= 0 && node.v <= 0xffff) { out.byte(0x1e); out.word(node.v) }
      else { out.byte(0x1f); out.double(node.v) }
      return true
    case 'str': {
      if (node.v.length > 255) return false
      out.byte(0x17)
      out.byte(node.v.length)
      out.byte(0x01)
      for (const ch of node.v) out.word(ch.charCodeAt(0))
      return true
    }
    case 'bool':
      out.byte(0x1d)
      out.byte(node.v ? 1 : 0)
      return true
    case 'err':
      out.byte(0x1c)
      out.byte(xlsErrorCode(node.v))
      return true
    case 'empty':
      out.byte(0x16)
      return true
    case 'ref': {
      const row = node.ref.row ?? 0
      if (node.ref.col > LAST_COL || row > LAST_ROW) return false
      if (node.ref.sheet) {
        out.byte(0x7a)
        out.word(ctx.sheetRef(node.ref.sheet))
      } else {
        out.byte(0x44)
      }
      refWords(out, row, node.ref.col, node.ref.rowAbs, node.ref.colAbs)
      return true
    }
    case 'range': {
      const { from, to } = node
      if (from.col > LAST_COL || to.col > LAST_COL) return false
      const r1 = from.row ?? 0
      const r2 = to.row ?? LAST_ROW
      if (r1 > LAST_ROW || r2 > LAST_ROW) return false
      const sheet = from.sheet ?? to.sheet
      if (sheet) {
        out.byte(0x7b)
        out.word(ctx.sheetRef(sheet))
      } else {
        out.byte(0x45)
      }
      out.word(r1)
      out.word(r2)
      out.word((from.col & 0x3fff) | (from.rowAbs ? 0 : 0x8000) | (from.colAbs ? 0 : 0x4000))
      out.word((to.col & 0x3fff) | (to.rowAbs ? 0 : 0x8000) | (to.colAbs ? 0 : 0x4000))
      return true
    }
    case 'name': {
      const index = ctx.nameRef(node.name)
      if (index === null) return false
      out.byte(0x43)
      out.word(index)
      out.word(0)
      return true
    }
    case 'unary':
      if (node.op === '%') {
        if (!emit(node.arg, out, ctx)) return false
        out.byte(0x14)
        return true
      }
      if (!emit(node.arg, out, ctx)) return false
      out.byte(node.op === '-' ? 0x13 : 0x12)
      return true
    case 'binary':
      if (!emit(node.left, out, ctx)) return false
      if (!emit(node.right, out, ctx)) return false
      out.byte(OPERATOR_TOKENS[node.op])
      return true
    case 'fn': {
      const found = xlsFunction(node.name)
      if (!found) return false
      const [id, args] = found
      if (node.args.length > 0x7f) return false
      for (const arg of node.args) if (!emit(arg, out, ctx)) return false
      if (args >= 0) {
        if (node.args.length !== args) return false
        out.byte(0x41)
        out.word(id)
      } else {
        out.byte(0x42)
        out.byte(node.args.length)
        out.word(id)
      }
      return true
    }
    // A table reference means nothing in a file this old, and neither an
    // array constant nor a spill has a token: the cell keeps its value.
    default:
      return false
  }
}
