/**
 * Precedence-climbing parser over the token stream.
 *
 * One structural choice worth naming: a whole-column reference like `A:A`
 * lexes as a range whose `to.row` is null, and the evaluator fills that in
 * from the sheet's last used row. Resolving it here instead would bake the
 * row count into the AST, and the AST is cached across edits that change it.
 */
import {
  PRECEDENCE, FormulaError,
  type Node, type BinaryOp,
} from './ast'
import { tokenize, type Token } from './tokenize'

export function parse(tokens: ReadonlyArray<Token>): Node {
  let pos = 0
  const peek = (): Token | undefined => tokens[pos]
  const next = (): Token | undefined => tokens[pos++]

  function expression(minPrec: number): Node {
    let left = postfix(primary())
    for (;;) {
      const t = peek()
      if (!t || t.t !== 'op') break
      const prec = PRECEDENCE[t.v]
      if (prec === undefined || prec < minPrec) break
      next()
      // Left-associative for everything except `^`, which Excel binds right.
      const nextMin = t.v === '^' ? prec : prec + 1
      left = { k: 'binary', op: t.v as BinaryOp, left, right: expression(nextMin) }
    }
    return left
  }

  /** Excel's `%` is POSTFIX and divides by a hundred: `50%` is 0.5 and
   *  `A1*5%` is five percent of A1. There is no binary modulo operator in
   *  Excel at all; `MOD()` is the function. */
  function postfix(node: Node): Node {
    let out = node
    while (peek()?.t === 'op' && (peek() as { v: string }).v === '%') {
      next()
      out = { k: 'unary', op: '%', arg: out }
    }
    return out
  }

  function primary(): Node {
    const t = next()
    if (!t) throw new FormulaError('#PARSE!')

    switch (t.t) {
      case 'num': return { k: 'num', v: t.v }
      case 'str': return { k: 'str', v: t.v }
      case 'bool': return { k: 'bool', v: t.v }
      case 'err': return { k: 'err', v: t.v }
      case 'ref': return { k: 'ref', ref: t.ref }
      case 'range': return { k: 'range', from: t.from, to: t.to }
      case 'name': return { k: 'name', name: t.v }
      case 'table':
        return t.columnTo === undefined
          ? { k: 'table', table: t.table, column: t.column, specifier: t.specifier }
          : {
              k: 'table', table: t.table, column: t.column,
              columnTo: t.columnTo, specifier: t.specifier,
            }
      case 'lparen': {
        const inner = expression(1)
        const close = next()
        if (!close || close.t !== 'rparen') throw new FormulaError('#PARSE!')
        return inner
      }
      case 'fn': {
        const open = next()
        if (!open || open.t !== 'lparen') throw new FormulaError('#PARSE!')
        const args: Node[] = []
        // An argument left out between two commas, or before the closing
        // paren after a comma, is an empty node rather than a parse error,
        // as Excel reads `PMT(A1, A2, A3, , 1)`.
        const argument = (): Node => {
          const t = peek()?.t
          return t === 'comma' || t === 'rparen' ? { k: 'empty' } : expression(1)
        }
        if (peek()?.t !== 'rparen') {
          args.push(argument())
          while (peek()?.t === 'comma') {
            next()
            args.push(argument())
          }
        }
        const close = next()
        if (!close || close.t !== 'rparen') throw new FormulaError('#PARSE!')
        let made: Node = { k: 'fn', name: t.v, args }
        // `=LAMBDA(x, x * 2)(5)`: a lambda written and called on the spot.
        // Only a lambda is callable this way, so nothing else changes shape;
        // the call is a `fn` node named `(`, which no tokenizer can produce.
        while (made.k === 'fn' && (made.name === 'LAMBDA' || made.name === '(') && peek()?.t === 'lparen') {
          next()
          const callArgs: Node[] = [made]
          if (peek()?.t !== 'rparen') {
            callArgs.push(argument())
            while (peek()?.t === 'comma') {
              next()
              callArgs.push(argument())
            }
          }
          const end = next()
          if (!end || end.t !== 'rparen') throw new FormulaError('#PARSE!')
          made = { k: 'fn', name: '(', args: callArgs }
        }
        return made
      }
      case 'op': {
        // Unary. Binds tighter than every binary operator except `^`, so
        // `-2^2` is -(2^2) as in Excel, and `-A1*2` is (-A1)*2.
        if (t.v === '-') return { k: 'unary', op: '-', arg: expression(5) }
        if (t.v === '+') return { k: 'unary', op: '+', arg: expression(5) }
        throw new FormulaError('#PARSE!')
      }
      default:
        throw new FormulaError('#PARSE!')
    }
  }

  const node = expression(1)
  if (pos < tokens.length) throw new FormulaError('#PARSE!')
  return node
}

/** Tokenize and parse one formula. Accepts the leading `=` or not. */
export function parseFormula(src: string): Node {
  const body = src.startsWith('=') ? src.slice(1) : src
  if (body.trim() === '') throw new FormulaError('#PARSE!')
  return parse(tokenize(body))
}
