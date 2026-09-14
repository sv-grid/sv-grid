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
    let left = primary()
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

  function primary(): Node {
    const t = next()
    if (!t) throw new FormulaError('#PARSE!')

    switch (t.t) {
      case 'num': return { k: 'num', v: t.v }
      case 'str': return { k: 'str', v: t.v }
      case 'bool': return { k: 'bool', v: t.v }
      case 'ref': return { k: 'ref', ref: t.ref }
      case 'range': return { k: 'range', from: t.from, to: t.to }
      case 'name': return { k: 'name', name: t.v }
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
        if (peek()?.t !== 'rparen') {
          args.push(expression(1))
          while (peek()?.t === 'comma') {
            next()
            args.push(expression(1))
          }
        }
        const close = next()
        if (!close || close.t !== 'rparen') throw new FormulaError('#PARSE!')
        return { k: 'fn', name: t.v, args }
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
