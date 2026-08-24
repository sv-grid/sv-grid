/**
 * builder-tree - the shape the structured filter builder edits, and its
 * conversion to and from `PredicateExpr`.
 *
 * The builder used to be flat: one combinator over a list of comparisons.
 * That covers "region is EMEA AND arr > 50000" but not the query people
 * actually reach for next - "EMEA accounts, OR any account over 300k that is
 * also high risk" - which needs a group nested inside the top-level list. Any
 * such expression fell back to text mode, and the Builder tab was disabled.
 *
 * A tree makes those expressible. Two boundaries are deliberate:
 *
 *   - `scalarCmp` (column maths, aggregates) has no place in a
 *     column/operator/value row, so it still forces text mode. That is a
 *     property of the expression, not a missing feature.
 *   - `not` is representable, but only as a group. Negating a single condition
 *     is better said with the negative operator the grid already has
 *     (`notEquals`, `notContains`), so a `not` around one `cmp` is left to text
 *     mode rather than growing a second way to say the same thing.
 *
 * Kept as a pure module so the conversion is unit-testable without mounting a
 * component, and so the round-trip property can be asserted directly.
 */
import type { ExcelFilterOperator } from '@svgrid/grid'
import {
  isRangeOperator,
  isSetOperator,
  isValueless,
  operatorsForType,
  type ExprColumn,
} from './expression-columns'
import type { PredicateExpr } from './expression-types'

/** One column/operator/value row. */
export type BuilderCondition = {
  kind: 'cond'
  column: string
  op: ExcelFilterOperator
  /** Single value, and the low end of a range operator. */
  value: string
  /** High end of a range operator (`between`). */
  valueTo: string
  /** Values for a set operator (`in`, `notIn`). */
  values: string[]
}

/** A combinator over children, which may themselves be groups. */
export type BuilderGroup = {
  kind: 'group'
  combinator: 'and' | 'or'
  /** Wrap the whole group in `not`. */
  negated: boolean
  children: BuilderNode[]
}

export type BuilderNode = BuilderCondition | BuilderGroup

/** How deep the UI allows nesting. */
export const MAX_BUILDER_DEPTH = 4

/** A blank condition on the first column, with that column's first operator. */
export function freshCondition(
  columns: ReadonlyArray<ExprColumn>,
): BuilderCondition {
  const first = columns[0]
  const ops = operatorsForType(first?.type)
  return {
    kind: 'cond',
    column: first?.id ?? '',
    op: ops[0]?.value ?? 'equals',
    value: '',
    valueTo: '',
    values: [],
  }
}

/** A blank group holding one blank condition. */
export function freshGroup(
  columns: ReadonlyArray<ExprColumn>,
  combinator: 'and' | 'or' = 'and',
): BuilderGroup {
  return {
    kind: 'group',
    combinator,
    negated: false,
    children: [freshCondition(columns)],
  }
}

function conditionFromCmp(
  p: Extract<PredicateExpr, { kind: 'cmp' }>,
): BuilderCondition {
  return {
    kind: 'cond',
    column: p.column,
    op: p.op,
    value: p.value != null && !Array.isArray(p.value) ? String(p.value) : '',
    valueTo: p.valueTo != null ? String(p.valueTo) : '',
    values: Array.isArray(p.value) ? p.value.map(String) : [],
  }
}

/**
 * One node of the expression to one node of the builder, or null when the
 * expression cannot be shown as a condition row or a group.
 *
 * `depth` guards against an expression nested deeper than the UI can render.
 * Rather than draw a tree the user cannot fully see, such an expression stays
 * in text mode where it is at least intact and editable.
 */
function nodeFrom(expr: PredicateExpr, depth: number): BuilderNode | null {
  if (depth > MAX_BUILDER_DEPTH) return null
  switch (expr.kind) {
    case 'cmp':
      return conditionFromCmp(expr)
    case 'and':
    case 'or': {
      const children: BuilderNode[] = []
      for (const part of expr.parts) {
        const child = nodeFrom(part, depth + 1)
        if (!child) return null
        children.push(child)
      }
      return {
        kind: 'group',
        combinator: expr.kind,
        negated: false,
        children,
      }
    }
    case 'not': {
      // Only a negated GROUP round-trips. `not` around one comparison is said
      // better by the operator itself, so it stays in text mode.
      const inner = expr.expr
      if (inner.kind !== 'and' && inner.kind !== 'or') return null
      const group = nodeFrom(inner, depth)
      if (!group || group.kind !== 'group') return null
      return { ...group, negated: true }
    }
    default:
      // const / scalarCmp: no condition-row representation.
      return null
  }
}

/**
 * The whole expression as a builder tree, or null if it must stay text.
 *
 * The result is always a group, so the UI has a single root to render even
 * when the expression is one bare comparison.
 */
export function toBuilderTree(
  expr: PredicateExpr,
  columns: ReadonlyArray<ExprColumn>,
): BuilderGroup | null {
  // `const true` is how "no filter yet" is spelled. Show it as an empty
  // builder rather than an unrepresentable expression, so a fresh panel opens
  // on a ready-to-fill row instead of dropping into text mode showing `true`.
  if (expr.kind === 'const') {
    return expr.value ? freshGroup(columns) : null
  }
  const node = nodeFrom(expr, 0)
  if (!node) return null
  if (node.kind === 'cond') {
    return { kind: 'group', combinator: 'and', negated: false, children: [node] }
  }
  return node
}

function cmpFromCondition(c: BuilderCondition): PredicateExpr {
  const base = { kind: 'cmp' as const, column: c.column, op: c.op }
  if (isValueless(c.op)) return base
  if (isSetOperator(c.op)) return { ...base, value: c.values }
  if (isRangeOperator(c.op)) return { ...base, value: c.value, valueTo: c.valueTo }
  return { ...base, value: c.value }
}

function nodeTo(node: BuilderNode): PredicateExpr | null {
  if (node.kind === 'cond') return cmpFromCondition(node)
  const parts: PredicateExpr[] = []
  for (const child of node.children) {
    const part = nodeTo(child)
    // An empty group contributes nothing rather than collapsing the whole
    // expression - a half-built group in the UI must not silently change what
    // the finished filter means.
    if (part) parts.push(part)
  }
  if (parts.length === 0) return null
  const inner: PredicateExpr =
    parts.length === 1 ? parts[0]! : { kind: node.combinator, parts }
  return node.negated ? { kind: 'not', expr: inner } : inner
}

/** The builder tree back to an expression. An empty tree means "no filter". */
export function fromBuilderTree(root: BuilderGroup): PredicateExpr {
  return nodeTo(root) ?? { kind: 'const', value: true }
}
