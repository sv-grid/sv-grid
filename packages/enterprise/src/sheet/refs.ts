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
import { formatA1, colToLetters, lettersToCol, type CellRef } from './address'
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
    case 'table': {
      // Re-serialised, never translated: the whole point of a structured
      // reference is that it does not move when the formula does.
      const parts: string[] = []
      if (node.specifier === '#ThisRow') parts.push(node.column ? `@${node.column}` : '@')
      else if (node.specifier !== '#Data') parts.push(node.specifier)
      if (node.specifier !== '#ThisRow' && node.column) {
        parts.push(node.columnTo ? `[${node.column}]:[${node.columnTo}]` : node.column)
      }
      return `${node.table ?? ''}[${parts.join(',')}]`
    }
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
    case 'empty': return ''
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

/**
 * Point every reference that names sheet `from` at `to` instead: what a
 * sheet rename owes the formulas on the other sheets and the defined
 * names, and what Excel does on one. Parsed and re-rendered rather than
 * substituted as text, so a string literal that happens to contain the old
 * name is left alone and a new name with a space comes out quoted. A
 * formula that names no such sheet is returned as it was, untouched.
 */
/**
 * Excel's reference colours: the A1 references in a formula being typed,
 * each occurrence with the colour of its range, so the cells a formula
 * names and the text that names them can be painted alike. Colours go by
 * distinct range in order of first appearance, so `B5` twice is one
 * colour; `$` anchors and case do not tell ranges apart; a reference into
 * another sheet and anything inside a string are skipped. `rect` is
 * [row1, col1, row2, col2], zero-based and normalised.
 */
export type ReferenceSpan = {
  start: number
  end: number
  key: string
  colour: string
  rect: readonly [number, number, number, number]
}

export const REFERENCE_COLOURS: ReadonlyArray<string> = ['#1e6fd9', '#d62828', '#8e44ad', '#0f9d58', '#e67e22', '#0097a7']

export function referenceSpans(text: string, colours: ReadonlyArray<string> = REFERENCE_COLOURS): ReferenceSpan[] {
  const out: ReferenceSpan[] = []
  if (!text.startsWith('=')) return out
  const blanked = text
    .replace(/"[^"]*"/g, (m) => ' '.repeat(m.length))
    // A sheet-qualified reference belongs to another sheet.
    .replace(/(?:'[^']*'|[A-Za-z_][\w.]*)!\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?/gi, (m) => ' '.repeat(m.length))
  // Case-insensitive: a reference is typed as "b5" as often as "B5", and
  // the engine reads both.
  const re = /(?<![A-Za-z0-9_.!])\$?([A-Za-z]{1,3})\$?(\d{1,7})(?::\$?([A-Za-z]{1,3})\$?(\d{1,7}))?(?![A-Za-z0-9_(])/g
  const order = new Map<string, number>()
  for (const m of blanked.matchAll(re)) {
    const key = m[0].replace(/\$/g, '').toUpperCase()
    const c1 = lettersToCol(m[1]!.toUpperCase()), r1 = Number(m[2]) - 1
    const c2 = m[3] ? lettersToCol(m[3].toUpperCase()) : c1, r2 = m[4] ? Number(m[4]) - 1 : r1
    if (c1 < 0 || c2 < 0 || r1 < 0 || r2 < 0) continue
    let index = order.get(key)
    if (index === undefined) { index = order.size; order.set(key, index) }
    out.push({
      start: m.index!,
      end: m.index! + m[0].length,
      key,
      colour: colours[index % colours.length]!,
      rect: [Math.min(r1, r2), Math.min(c1, c2), Math.max(r1, r2), Math.max(c1, c2)],
    })
  }
  return out
}

export function renameSheetReferences(text: unknown, from: string, to: string): unknown {
  if (typeof text !== 'string' || !text.startsWith('=')) return text
  const wanted = from.toLowerCase()
  if (!text.toLowerCase().includes(wanted)) return text
  let ast: Node
  try {
    ast = parseFormula(text)
  } catch {
    return text
  }
  let changed = false
  const swap = (ref: CellRef): CellRef => {
    if (ref.sheet === null || ref.sheet.toLowerCase() !== wanted) return ref
    changed = true
    return { ...ref, sheet: to }
  }
  const moved = mapNode(ast, (n) => {
    if (n.k === 'ref') return { ...n, ref: swap(n.ref) }
    if (n.k === 'range') return { ...n, from: swap(n.from), to: swap(n.to) }
    return n
  })
  return changed ? formatFormula(moved) : text
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
/**
 * Which sheet an edit happened on, and which sheet the formula being
 * rewritten lives on. With a scope, only references INTO the edited sheet
 * move: an unqualified reference belongs to `self`, a qualified one to the
 * sheet it names. Without one every reference moves, which is right for a
 * single grid that has no sheets to tell apart.
 */
export type EditScope = {
  /** The sheet the rows or columns were inserted in or deleted from. */
  sheet: string
  /** The sheet the formula lives on; null for a defined name, which has no
   *  home sheet, so only its qualified references can match. */
  self: string | null
}

const sameSheet = (a: string | null, b: string): boolean =>
  a !== null && a.toLowerCase() === b.toLowerCase()

export function fixupReferences(text: unknown, edit: StructuralEdit, scope?: EditScope): unknown {
  if (typeof text !== 'string' || !text.startsWith('=')) return text
  if (edit.count <= 0) return text
  let ast: Node
  try {
    ast = parseFormula(text)
  } catch {
    return text
  }

  const broken: CellRef = { col: -1, colAbs: false, row: -1, rowAbs: false, sheet: null }
  const touched = (sheet: string | null): boolean =>
    !scope || sameSheet(sheet ?? scope.self, scope.sheet)

  const moved = mapNode(ast, (n) => {
    if (n.k === 'ref') {
      if (!touched(n.ref.sheet)) return n
      const next = fixRef(n.ref, edit)
      return next === null ? { k: 'ref' as const, ref: broken } : { ...n, ref: next }
    }
    if (n.k === 'range') {
      if (!touched(n.from.sheet ?? n.to.sheet)) return n
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
