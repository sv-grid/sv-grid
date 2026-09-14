/**
 * Reference rewriting. The one module allowed to move a reference.
 *
 * Two jobs, both of which the demo engines could not do because they discarded
 * `$` at parse time:
 *
 *   - `translateFormula` shifts RELATIVE parts by a delta and leaves pinned
 *     parts alone. This is what makes fill-down, copy/paste and drag-fill
 *     correct: `=$A$1*B2` filled one row down becomes `=$A$1*B3`.
 *   - `fixupReferences` rewrites every formula in a sheet after rows or columns
 *     are inserted or removed. A reference to a deleted cell becomes `#REF!`;
 *     everything past the edit shifts; a range straddling an insertion grows.
 *
 * Both re-serialise from the AST rather than editing text, so `SUM( A1 : B2 )`
 * comes back normalised instead of half-rewritten.
 */
import { mapNode, PRECEDENCE, type Node } from './ast'
import { formatA1, colToLetters, type CellRef } from './address'
import { parseFormula } from './parse'

/** Shift a single reference's relative parts. */
function translateRef(ref: CellRef, dRow: number, dCol: number): CellRef {
  return {
    ...ref,
    col: ref.colAbs ? ref.col : ref.col + dCol,
    row: ref.row === null || ref.rowAbs ? ref.row : ref.row + dRow,
  }
}

/** True once a reference has been shifted off the sheet. */
function isBroken(ref: CellRef): boolean {
  return ref.col < 0 || (ref.row !== null && ref.row < 0)
}

/** Serialise an AST back to formula text, with the leading `=`. */
export function formatFormula(node: Node): string {
  return `=${render(node)}`
}

/** Render `node` as an operand of something binding at `minPrec`, adding
 *  parentheses when it would otherwise re-associate. */
function wrap(node: Node, minPrec: number): string {
  const text = render(node)
  if (node.k === 'binary' && PRECEDENCE[node.op] < minPrec) return `(${text})`
  // A unary minus has to be parenthesised inside anything tighter than it,
  // so -(A1+B1) and 2^-A1 both survive.
  if (node.k === 'unary' && node.op !== '%' && minPrec > 5) return `(${text})`
  return text
}

function render(node: Node): string {
  switch (node.k) {
    case 'num': return String(node.v)
    case 'str': return `"${node.v.replace(/"/g, '""')}"`
    case 'bool': return node.v ? 'TRUE' : 'FALSE'
    case 'ref': return node.ref.col < 0 || (node.ref.row ?? 0) < 0 ? '#REF!' : formatA1(node.ref)
    case 'range': {
      if (isBroken(node.from) || isBroken(node.to)) return '#REF!'
      // A whole-column range prints as A:C, not A1:C.
      if (node.from.row === null || node.to.row === null) {
        const left = `${node.from.colAbs ? '$' : ''}${colToLetters(node.from.col)}`
        const right = `${node.to.colAbs ? '$' : ''}${colToLetters(node.to.col)}`
        const prefix = node.from.sheet ? `${formatA1({ ...node.from, row: null }).split('!')[0]}!` : ''
        return `${prefix}${left}:${right}`
      }
      const from = formatA1(node.from)
      // The right-hand side drops a repeated sheet prefix: Sheet1!A1:B2.
      const to = formatA1({ ...node.to, sheet: null })
      return `${from}:${to}`
    }
    case 'name': return node.name
    case 'unary':
      return node.op === '%'
        ? `${wrap(node.arg, 6)}%`
        : `${node.op}${wrap(node.arg, 5)}`
    case 'binary': {
      const prec = PRECEDENCE[node.op]
      // The AST does not record parentheses, so they have to be reconstructed
      // from precedence. Emitting the operands bare turns =(A1+B1)*2 into
      // =A2+B2*2, which is a silent wrong answer on every fill and paste.
      //
      // Which SIDE needs one at equal precedence depends on associativity.
      // Left-associative: the right operand does, because a-(b-c) is not
      // a-b-c. Right-associative `^` is the mirror: the LEFT operand does,
      // because (a^b)^c is not a^b^c.
      const rightAssociative = node.op === '^'
      const leftMin = rightAssociative ? prec + 1 : prec
      const rightMin = rightAssociative ? prec : prec + 1
      return `${wrap(node.left, leftMin)}${node.op}${wrap(node.right, rightMin)}`
    }
    case 'fn': return `${node.name}(${node.args.map(render).join(',')})`
  }
}

/**
 * Shift every relative reference in a formula by (dRow, dCol).
 *
 * Anything that is not a formula comes back untouched, so callers can pass a
 * whole column of mixed literals and formulas through it.
 */
export function translateFormula(text: unknown, dRow: number, dCol: number): unknown {
  if (typeof text !== 'string' || !text.startsWith('=')) return text
  if (dRow === 0 && dCol === 0) return text
  let ast: Node
  try {
    ast = parseFormula(text)
  } catch {
    // Not parseable: leave it exactly as the user typed it. Rewriting a
    // half-understood formula is worse than leaving it alone.
    return text
  }
  const moved = mapNode(ast, (n) => {
    if (n.k === 'ref') return { ...n, ref: translateRef(n.ref, dRow, dCol) }
    if (n.k === 'range') {
      return { ...n, from: translateRef(n.from, dRow, dCol), to: translateRef(n.to, dRow, dCol) }
    }
    return n
  })
  return formatFormula(moved)
}

export type StructuralEdit = {
  kind: 'insertRows' | 'deleteRows' | 'insertCols' | 'deleteCols'
  /** 0-based index the edit happens at. */
  at: number
  count: number
}

/**
 * Shift one coordinate through a structural edit. Returns null when the thing
 * it pointed at was deleted, which becomes `#REF!`.
 */
function shiftCoord(value: number, edit: StructuralEdit, inserting: boolean): number | null {
  if (inserting) {
    return value >= edit.at ? value + edit.count : value
  }
  if (value < edit.at) return value
  if (value < edit.at + edit.count) return null
  return value - edit.count
}

function fixRef(ref: CellRef, edit: StructuralEdit): CellRef | null {
  const rows = edit.kind === 'insertRows' || edit.kind === 'deleteRows'
  const inserting = edit.kind === 'insertRows' || edit.kind === 'insertCols'

  if (rows) {
    if (ref.row === null) return ref
    const next = shiftCoord(ref.row, edit, inserting)
    return next === null ? null : { ...ref, row: next }
  }
  const next = shiftCoord(ref.col, edit, inserting)
  return next === null ? null : { ...ref, col: next }
}

/**
 * Rewrite a formula's references after rows or columns are inserted or
 * removed. A reference into the deleted span becomes `#REF!`.
 *
 * A RANGE only breaks when the edit removes all of it. Deleting rows inside a
 * range shrinks it, which is what Excel does and what keeps `=SUM(A1:A10)`
 * meaningful after you delete row 5.
 */
export function fixupReferences(text: unknown, edit: StructuralEdit): unknown {
  if (typeof text !== 'string' || !text.startsWith('=')) return text
  if (edit.count <= 0) return text
  let ast: Node
  try {
    ast = parseFormula(text)
  } catch {
    return text
  }

  const broken: CellRef = { col: -1, colAbs: false, row: -1, rowAbs: false, sheet: null }

  const moved = mapNode(ast, (n) => {
    if (n.k === 'ref') {
      const next = fixRef(n.ref, edit)
      return next === null ? { k: 'ref' as const, ref: broken } : { ...n, ref: next }
    }
    if (n.k === 'range') {
      const from = fixRef(n.from, edit)
      const to = fixRef(n.to, edit)
      // Both ends gone means the whole range was deleted.
      if (from === null && to === null) return { k: 'ref' as const, ref: broken }
      // One end gone: clamp it to the edit point so the range shrinks.
      const rows = edit.kind === 'deleteRows'
      const clamp = (ref: CellRef): CellRef =>
        rows ? { ...ref, row: Math.max(edit.at - 1, 0) } : { ...ref, col: Math.max(edit.at - 1, 0) }
      return {
        ...n,
        from: from ?? clamp(n.from),
        to: to ?? clamp(n.to),
      }
    }
    return n
  })
  return formatFormula(moved)
}
