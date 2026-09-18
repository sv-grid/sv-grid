/**
 * Excel's Evaluate Formula, as a list of steps.
 *
 * The dialog shows a formula with one part underlined, and every click
 * replaces that part with what it is worth, until the whole thing is the
 * cell's answer. It is the fastest way to find which half of a long formula
 * is the wrong half, which is why it is the auditing tool people reach for
 * after the tracing arrows.
 *
 * The steps are worked out here rather than in the dialog, so they can be
 * tested without a browser and reused by anything that wants to explain a
 * formula: a tooltip, a report, an agent.
 *
 * How a part is evaluated: it is printed back to a formula and handed to the
 * caller, which passes it to the workbook. That keeps this module out of the
 * evaluator entirely, so names, tables, other sheets and custom functions all
 * mean exactly what they mean in the cell, with no second implementation to
 * disagree with the first.
 */
import { isError, PRECEDENCE, type CellValue, type Node } from './ast'
import { formatFormula } from './refs'

/** A reference that stands for a block rather than one value: printed, never
 *  replaced, because `A1:A9` on its own is not a number. */
function isBlock(node: Node): boolean {
  return node.k === 'range' || node.k === 'name' || node.k === 'table'
}

/**
 * A formula printed back from its tree, without the leading `=`.
 *
 * The printer a fill-down already uses, so a step reads the way the sheet
 * itself would write the formula, brackets and all.
 */
export function printNode(node: Node): string {
  return formatFormula(node).slice(1)
}

/** What a value looks like inside a formula being stepped through. */
export function printValue(value: CellValue): string {
  if (isError(value)) return value.error
  if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

/**
 * The working tree: a node whose children may already have been replaced by
 * the values they worked out to. Each replacement remembers what it came
 * from, so the next step can be evaluated as the formula it really is
 * rather than as a formula over printed numbers.
 */
type Work =
  | { kind: 'value'; value: CellValue; origin: Node }
  | { kind: 'node'; node: Node; children: Work[] }

function toWork(node: Node): Work {
  switch (node.k) {
    case 'unary': return { kind: 'node', node, children: [toWork(node.arg)] }
    case 'binary': return { kind: 'node', node, children: [toWork(node.left), toWork(node.right)] }
    case 'fn': return { kind: 'node', node, children: node.args.map(toWork) }
    default: return { kind: 'node', node, children: [] }
  }
}

/** The formula a piece of the working tree stands for. */
function originOf(work: Work): Node {
  if (work.kind === 'value') return work.origin
  const node = work.node
  switch (node.k) {
    case 'unary': return { ...node, arg: originOf(work.children[0]!) }
    case 'binary': return { ...node, left: originOf(work.children[0]!), right: originOf(work.children[1]!) }
    case 'fn': return { ...node, args: work.children.map(originOf) }
    default: return node
  }
}

/** Print the working tree, and record where each piece landed. */
function printWork(work: Work, spans: Map<Work, [number, number]>, at = 0): string {
  const record = (text: string) => {
    spans.set(work, [at, at + text.length])
    return text
  }
  if (work.kind === 'value') return record(printValue(work.value))
  const node = work.node
  if (work.children.length === 0) return record(printNode(node))
  if (node.k === 'unary') {
    const arg = work.children[0]!
    if (node.op === '%') {
      const inner = printWorkWrapped(arg, spans, at, 6)
      return record(`${inner}%`)
    }
    const inner = printWorkWrapped(arg, spans, at + node.op.length, 5)
    return record(`${node.op}${inner}`)
  }
  if (node.k === 'binary') {
    // The shared printer's rule: at equal precedence the right operand takes
    // the bracket, and `^` is the mirror of that because it binds rightwards.
    const p = PRECEDENCE[node.op]
    const rightAssociative = node.op === '^'
    const left = printWorkWrapped(work.children[0]!, spans, at, rightAssociative ? p + 1 : p)
    const right = printWorkWrapped(work.children[1]!, spans, at + left.length + node.op.length, rightAssociative ? p : p + 1)
    return record(`${left}${node.op}${right}`)
  }
  // A function call, including the `(` node a lambda's arguments build.
  const lambda = node.k === 'fn' && node.name === '('
  const head = lambda ? printWork(work.children[0]!, spans, at) : `${(node as { name: string }).name}`
  const args = lambda ? work.children.slice(1) : work.children
  let out = `${head}(`
  args.forEach((child, i) => {
    if (i > 0) out += ','
    out += printWork(child, spans, at + out.length)
  })
  return record(`${out})`)
}

function printWorkWrapped(work: Work, spans: Map<Work, [number, number]>, at: number, need: number): string {
  const bare = work.kind === 'node'
    && ((work.node.k === 'binary' && PRECEDENCE[work.node.op] < need)
      || (work.node.k === 'unary' && work.node.op !== '%' && need > 5))
  const inner = printWork(work, spans, at + (bare ? 1 : 0))
  return bare ? `(${inner})` : inner
}

/**
 * The next piece to evaluate: the leftmost, deepest one whose own parts are
 * already values. A block reference (`A1:A9`, a name, a table column) is
 * left where it is, and so is a literal, since neither is a step.
 */
function nextPiece(work: Work): Work | null {
  if (work.kind === 'value') return null
  const node = work.node
  // IF picks a branch. Once the condition is a value the whole call is one
  // step, so the branch that is not taken is never evaluated and never
  // reports an error the cell does not have.
  const isIf = node.k === 'fn' && node.name === 'IF'
  if (isIf) {
    const condition = work.children[0]
    if (condition && condition.kind !== 'value') {
      const inner = nextPiece(condition)
      return inner ?? condition
    }
    return work
  }
  for (const child of work.children) {
    const inner = nextPiece(child)
    if (inner) return inner
  }
  if (work.children.length === 0) {
    // A leaf: a single cell is a step, a literal and a block are not.
    return node.k === 'ref' ? work : null
  }
  // Every child is a value or a block, so this call is ready.
  return work.children.every((c) => c.kind === 'value' || (c.kind === 'node' && (isBlock(c.node) || c.node.k === 'empty' || c.children.length === 0)))
    ? work
    : null
}

export type EvaluationStep = {
  /** The formula as it stands before this step, `=` included. */
  formula: string
  /** The part about to be worked out, as offsets into `formula`. */
  from: number
  to: number
  /** That part on its own, as it reads at this point in the walk. */
  expression: string
  /** What it is worth. */
  value: CellValue
}

/**
 * Walk a formula the way Excel's Evaluate Formula does.
 *
 * `evaluate` is given one sub-formula at a time, `=` included, and answers
 * with its value; the workbook's `evaluateText` is exactly that. The last
 * step's value is the cell's own.
 */
export function evaluationSteps(
  ast: Node,
  evaluate: (formula: string) => CellValue,
  limit = 100,
): EvaluationStep[] {
  const steps: EvaluationStep[] = []
  let root = toWork(ast)
  for (let i = 0; i < limit; i += 1) {
    const spans = new Map<Work, [number, number]>()
    const formula = printWork(root, spans)
    const piece = nextPiece(root)
    if (!piece) break
    const span = spans.get(piece)
    if (!span) break
    // Evaluated as the formula it really is, with every reference still in
    // place, and shown as it now reads, with the parts already worked out
    // standing as their values. The two agree because a replacement only
    // ever stands for what it was worth.
    const origin = originOf(piece)
    const value = evaluate(`=${printNode(origin)}`)
    steps.push({
      formula: `=${formula}`,
      from: span[0] + 1,
      to: span[1] + 1,
      expression: formula.slice(span[0], span[1]),
      value,
    })
    const replaced: Work = { kind: 'value', value, origin }
    root = replace(root, piece, replaced)
    if (root === replaced) break
  }
  return steps
}

/** The tree with one piece swapped out. */
function replace(work: Work, target: Work, next: Work): Work {
  if (work === target) return next
  if (work.kind === 'value') return work
  const children = work.children.map((c) => replace(c, target, next))
  return children.some((c, i) => c !== work.children[i]) ? { ...work, children } : work
}
