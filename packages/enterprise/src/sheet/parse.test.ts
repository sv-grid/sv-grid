import { describe, expect, it } from 'vitest'
import { parseFormula } from './parse'
import { formatFormula } from './refs'
import { tokenize } from './tokenize'
import { formatA1 } from './address'
import { FormulaError, type Node } from './ast'

const parse = (src: string) => parseFormula(src)
const fails = (src: string) => expect(() => parseFormula(src)).toThrow(FormulaError)

describe('literals', () => {
  it('parses numbers, including decimals and scientific notation', () => {
    expect(parse('=1')).toEqual({ k: 'num', v: 1 })
    expect(parse('=1.5')).toEqual({ k: 'num', v: 1.5 })
    expect(parse('=.5')).toEqual({ k: 'num', v: 0.5 })
    expect(parse('=2e3')).toEqual({ k: 'num', v: 2000 })
    expect(parse('=2.5E-3')).toEqual({ k: 'num', v: 0.0025 })
  })

  it('parses strings and unescapes a doubled quote', () => {
    expect(parse('="hi"')).toEqual({ k: 'str', v: 'hi' })
    expect(parse('="say ""hi"""')).toEqual({ k: 'str', v: 'say "hi"' })
  })

  it('parses booleans in any case', () => {
    expect(parse('=TRUE')).toEqual({ k: 'bool', v: true })
    expect(parse('=false')).toEqual({ k: 'bool', v: false })
  })

  it('rejects an unterminated string', () => {
    fails('="oops')
  })
})

describe('references', () => {
  it('keeps $ through to the AST', () => {
    const n = parse('=$A$1') as Extract<Node, { k: 'ref' }>
    expect(n.ref).toMatchObject({ col: 0, row: 0, colAbs: true, rowAbs: true })
  })

  it('parses a range', () => {
    const n = parse('=A1:B10') as Extract<Node, { k: 'range' }>
    expect(formatA1(n.from)).toBe('A1')
    expect(formatA1(n.to)).toBe('B10')
  })

  it('parses a mixed-pinning range', () => {
    const n = parse('=$A1:B$10') as Extract<Node, { k: 'range' }>
    expect(n.from).toMatchObject({ colAbs: true, rowAbs: false })
    expect(n.to).toMatchObject({ colAbs: false, rowAbs: true })
  })

  it('parses an unquoted cross-sheet reference', () => {
    const n = parse('=Orders!B2') as Extract<Node, { k: 'ref' }>
    expect(n.ref.sheet).toBe('Orders')
  })

  it('parses a quoted cross-sheet reference with a space', () => {
    const n = parse("='Price list'!A1") as Extract<Node, { k: 'ref' }>
    expect(n.ref.sheet).toBe('Price list')
  })

  it('parses a quoted cross-sheet RANGE', () => {
    const n = parse("='Price list'!A1:C9") as Extract<Node, { k: 'range' }>
    expect(n.from.sheet).toBe('Price list')
    expect(n.to.sheet).toBe('Price list')
  })

  it('unescapes a doubled apostrophe in a sheet name', () => {
    const n = parse("='Bob''s'!A1") as Extract<Node, { k: 'ref' }>
    expect(n.ref.sheet).toBe("Bob's")
  })

  it('parses a 3D reference across a sheet range, cell and range alike', () => {
    const n = parse('=Sheet1:Sheet3!A1') as Extract<Node, { k: 'ref3d' }>
    expect(n.k).toBe('ref3d')
    expect([n.sheetFrom, n.sheetTo]).toEqual(['Sheet1', 'Sheet3'])
    expect([n.from.col, n.from.row]).toEqual([0, 0])
    expect(n.to).toEqual(n.from)
    const r = parse('=Jan:Dec!B5:B10') as Extract<Node, { k: 'ref3d' }>
    expect([r.sheetFrom, r.sheetTo]).toEqual(['Jan', 'Dec'])
    expect([r.from.col, r.from.row, r.to.row]).toEqual([1, 4, 9])
    // It round-trips, and a plain A1:B2 stays an ordinary range.
    expect(formatFormula(parse('=SUM(Sheet1:Sheet3!A1)'))).toBe('=SUM(Sheet1:Sheet3!A1)')
    expect(formatFormula(parse('=SUM(Jan:Dec!B5:B10)'))).toBe('=SUM(Jan:Dec!B5:B10)')
    expect((parse('=A1:B2') as Node).k).toBe('range')
  })

  it('parses a whole-column range with an open end', () => {
    const n = parse('=A:C') as Extract<Node, { k: 'range' }>
    expect(n.from).toMatchObject({ col: 0, row: null })
    expect(n.to).toMatchObject({ col: 2, row: null })
  })

  it('treats a bare unqualified word as a name, not a column', () => {
    // `=Tax` is a defined name. Only `Tax:Tax` or a sheet prefix makes it a
    // column, which is what keeps `=SUM(Tax)` meaningful.
    expect(parse('=Tax')).toEqual({ k: 'name', name: 'Tax' })
  })
})

describe('operators', () => {
  it('gives multiplication tighter binding than addition', () => {
    const n = parse('=1+2*3') as Extract<Node, { k: 'binary' }>
    expect(n.op).toBe('+')
    expect((n.right as Extract<Node, { k: 'binary' }>).op).toBe('*')
  })

  it('binds ^ left-associatively, as Excel does', () => {
    // 2^3^2 is (2^3)^2 = 64, not 2^(3^2) = 512.
    const n = parse('=2^3^2') as Extract<Node, { k: 'binary' }>
    expect((n.left as Extract<Node, { k: 'binary' }>).op).toBe('^')
    expect(n.right).toEqual({ k: 'num', v: 2 })
  })

  it('binds comparison loosest', () => {
    const n = parse('=1+2>2') as Extract<Node, { k: 'binary' }>
    expect(n.op).toBe('>')
  })

  it('binds & tighter than comparison, looser than arithmetic', () => {
    const n = parse('="a"&1+2') as Extract<Node, { k: 'binary' }>
    expect(n.op).toBe('&')
    expect((n.right as Extract<Node, { k: 'binary' }>).op).toBe('+')
  })

  it('parses the two-character comparisons', () => {
    for (const op of ['<=', '>=', '<>']) {
      expect((parse(`=1${op}2`) as Extract<Node, { k: 'binary' }>).op).toBe(op)
    }
  })

  it('parses unary minus', () => {
    expect(parse('=-1')).toEqual({ k: 'unary', op: '-', arg: { k: 'num', v: 1 } })
  })

  it('binds unary minus tighter than ^, so -2^2 is (-2)^2', () => {
    const n = parse('=-2^2') as Extract<Node, { k: 'binary' }>
    expect(n.op).toBe('^')
    expect(n.left).toEqual({ k: 'unary', op: '-', arg: { k: 'num', v: 2 } })
    // The postfix `%` is tighter still: -2% is -(2/100).
    const p = parse('=-2%') as Extract<Node, { k: 'unary' }>
    expect(p.op).toBe('-')
    expect((p.arg as Extract<Node, { k: 'unary' }>).op).toBe('%')
  })

  it('honours parentheses', () => {
    const n = parse('=(1+2)*3') as Extract<Node, { k: 'binary' }>
    expect(n.op).toBe('*')
    expect((n.left as Extract<Node, { k: 'binary' }>).op).toBe('+')
  })

  it('rejects an unbalanced parenthesis', () => {
    fails('=(1+2')
    fails('=1+2)')
  })
})

describe('function calls', () => {
  it('parses a call with no arguments', () => {
    expect(parse('=TODAY()')).toEqual({ k: 'fn', name: 'TODAY', args: [] })
  })

  it('parses arguments and uppercases the name', () => {
    const n = parse('=sum(A1:A3, 2)') as Extract<Node, { k: 'fn' }>
    expect(n.name).toBe('SUM')
    expect(n.args).toHaveLength(2)
  })

  it('allows space between the name and the parenthesis', () => {
    expect((parse('=SUM (1)') as Extract<Node, { k: 'fn' }>).name).toBe('SUM')
  })

  it('nests calls', () => {
    const n = parse('=IF(A1>0, SUM(B1:B3), 0)') as Extract<Node, { k: 'fn' }>
    expect((n.args[1] as Extract<Node, { k: 'fn' }>).name).toBe('SUM')
  })

  it('reads a trailing comma as an empty argument, as Excel does', () => {
    const n = parseFormula('=SUM(1,)') as Extract<Node, { k: 'fn' }>
    expect(n.args).toHaveLength(2)
    expect(n.args[1]).toEqual({ k: 'empty' })
    const gap = parseFormula('=PMT(1,2,3,,1)') as Extract<Node, { k: 'fn' }>
    expect(gap.args.map((a) => a.k)).toEqual(['num', 'num', 'num', 'empty', 'num'])
  })

  it('rejects a call with no closing parenthesis', () => {
    fails('=SUM(1')
  })
})

describe('the = prefix and whitespace', () => {
  it('accepts a formula with or without the leading =', () => {
    expect(parse('=1+1')).toEqual(parse('1+1'))
  })

  it('rejects an empty formula', () => {
    fails('=')
    fails('=   ')
  })

  it('ignores whitespace between tokens', () => {
    expect(parse('=  1  +  2  ')).toEqual(parse('=1+2'))
  })

  it('rejects trailing junk after a complete expression', () => {
    fails('=1 2')
  })
})

describe('tokenize edge cases', () => {
  it('rejects a character it does not know', () => {
    expect(() => tokenize('1 # 2')).toThrow(FormulaError)
  })

  it('reads a sheet-qualified column as a range, not a name', () => {
    const n = parse('=Orders!C') as Extract<Node, { k: 'range' }>
    expect(n.k).toBe('range')
    expect(n.from).toMatchObject({ col: 2, row: 0 })
    expect(n.to).toMatchObject({ col: 2, row: null })
  })
})

describe('error literals and the boolean functions', () => {
  // Excel, Google Sheets and LibreOffice all write an error cell as a
  // formula that is only the code, and LibreOffice writes every boolean
  // cell as TRUE() or FALSE(). Both used to be #PARSE!.
  it('parses an error code as a value and prints it back', () => {
    expect(formatFormula(parseFormula('=#N/A'))).toBe('=#N/A')
    expect(formatFormula(parseFormula('=IFERROR(A1,#N/A)'))).toBe('=IFERROR(A1,#N/A)')
    expect(formatFormula(parseFormula('=#div/0!'))).toBe('=#DIV/0!')
  })

  it('reads TRUE() and FALSE() as calls, and the bare words as booleans', () => {
    expect(formatFormula(parseFormula('=TRUE()'))).toBe('=TRUE()')
    expect(formatFormula(parseFormula('=IF(A1,TRUE(),FALSE())'))).toBe('=IF(A1,TRUE(),FALSE())')
    expect(formatFormula(parseFormula('=TRUE'))).toBe('=TRUE')
  })
})
