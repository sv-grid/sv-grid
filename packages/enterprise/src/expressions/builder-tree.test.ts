import { describe, it, expect } from 'vitest'
import {
  toBuilderTree,
  fromBuilderTree,
  freshCondition,
  freshGroup,
  MAX_BUILDER_DEPTH,
  type BuilderGroup,
} from './builder-tree'
import type { ExprColumn } from './expression-columns'
import type { PredicateExpr } from './expression-types'

const columns: ReadonlyArray<ExprColumn> = [
  { id: 'region', name: 'Region', type: 'text' },
  { id: 'arr', name: 'ARR', type: 'number' },
  { id: 'risk', name: 'Risk', type: 'text' },
]

const cmp = (column: string, op: 'equals' | 'greaterThan', value: string): PredicateExpr => ({
  kind: 'cmp',
  column,
  op,
  value,
})

/** The property that matters: what goes in comes back out. */
const roundTrips = (expr: PredicateExpr) => {
  const tree = toBuilderTree(expr, columns)
  expect(tree, 'should be representable').not.toBeNull()
  return fromBuilderTree(tree!)
}

describe('flat expressions still round-trip', () => {
  it('a single comparison', () => {
    expect(roundTrips(cmp('region', 'equals', 'EMEA'))).toEqual(
      cmp('region', 'equals', 'EMEA'),
    )
  })

  it('an AND of comparisons', () => {
    const expr: PredicateExpr = {
      kind: 'and',
      parts: [cmp('region', 'equals', 'EMEA'), cmp('arr', 'greaterThan', '50000')],
    }
    expect(roundTrips(expr)).toEqual(expr)
  })

  it('wraps a bare comparison in a root group so the UI has one root', () => {
    const tree = toBuilderTree(cmp('region', 'equals', 'EMEA'), columns)!
    expect(tree.kind).toBe('group')
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]!.kind).toBe('cond')
  })

  it('treats `const true` as an empty builder, not as unrepresentable', () => {
    // This is what Clear leaves behind; it must stay editable.
    const tree = toBuilderTree({ kind: 'const', value: true }, columns)
    expect(tree).not.toBeNull()
    expect(tree!.children).toHaveLength(1)
  })
})

describe('nested groups', () => {
  // The case the flat builder could not show, which is why the Builder tab
  // was disabled for it.
  const nested: PredicateExpr = {
    kind: 'or',
    parts: [
      cmp('region', 'equals', 'EMEA'),
      {
        kind: 'and',
        parts: [cmp('arr', 'greaterThan', '300000'), cmp('risk', 'equals', 'high')],
      },
    ],
  }

  it('is representable', () => {
    expect(toBuilderTree(nested, columns)).not.toBeNull()
  })

  it('round-trips unchanged', () => {
    expect(roundTrips(nested)).toEqual(nested)
  })

  it('keeps the inner combinator distinct from the outer one', () => {
    const tree = toBuilderTree(nested, columns)!
    expect(tree.combinator).toBe('or')
    const inner = tree.children[1]
    expect(inner!.kind).toBe('group')
    expect((inner as BuilderGroup).combinator).toBe('and')
  })

  it('round-trips three levels deep', () => {
    const deep: PredicateExpr = {
      kind: 'and',
      parts: [
        cmp('region', 'equals', 'EMEA'),
        {
          kind: 'or',
          parts: [
            cmp('arr', 'greaterThan', '300000'),
            { kind: 'and', parts: [cmp('risk', 'equals', 'high'), cmp('arr', 'greaterThan', '10')] },
          ],
        },
      ],
    }
    expect(roundTrips(deep)).toEqual(deep)
  })

  it('refuses an expression nested deeper than the UI can render', () => {
    // Better to keep it in text mode, intact, than to draw a tree that runs
    // off the panel and cannot be fully edited.
    let expr: PredicateExpr = cmp('region', 'equals', 'EMEA')
    for (let i = 0; i <= MAX_BUILDER_DEPTH + 1; i++) {
      expr = { kind: 'and', parts: [expr, cmp('arr', 'greaterThan', '1')] }
    }
    expect(toBuilderTree(expr, columns)).toBeNull()
  })
})

describe('negation', () => {
  it('round-trips a negated group', () => {
    const expr: PredicateExpr = {
      kind: 'not',
      expr: {
        kind: 'and',
        parts: [cmp('region', 'equals', 'EMEA'), cmp('arr', 'greaterThan', '50000')],
      },
    }
    expect(roundTrips(expr)).toEqual(expr)
  })

  it('leaves `not` around a single comparison to text mode', () => {
    // `not(region = EMEA)` is said better as `region != EMEA`; offering both
    // would give the builder two spellings of one thing.
    expect(
      toBuilderTree({ kind: 'not', expr: cmp('region', 'equals', 'EMEA') }, columns),
    ).toBeNull()
  })
})

describe('what stays in text mode', () => {
  it('column maths', () => {
    expect(
      toBuilderTree(
        {
          kind: 'scalarCmp',
          left: { kind: 'col', id: 'arr' },
          op: '>',
          right: { kind: 'agg', fn: 'avg', column: 'arr' },
        },
        columns,
      ),
    ).toBeNull()
  })

  it('a group containing column maths, however deep', () => {
    expect(
      toBuilderTree(
        {
          kind: 'and',
          parts: [
            cmp('region', 'equals', 'EMEA'),
            {
              kind: 'scalarCmp',
              left: { kind: 'col', id: 'arr' },
              op: '>',
              right: { kind: 'lit', value: 5 },
            },
          ],
        },
        columns,
      ),
    ).toBeNull()
  })
})

describe('half-built trees do not change what the filter means', () => {
  it('drops an empty group rather than collapsing the expression', () => {
    const tree: BuilderGroup = {
      kind: 'group',
      combinator: 'and',
      negated: false,
      children: [
        { ...freshCondition(columns), column: 'region', op: 'equals', value: 'EMEA' },
        { kind: 'group', combinator: 'and', negated: false, children: [] },
      ],
    }
    // The empty group contributes nothing; the real condition survives.
    expect(fromBuilderTree(tree)).toEqual(cmp('region', 'equals', 'EMEA'))
  })

  it('an entirely empty tree means no filter', () => {
    expect(
      fromBuilderTree({ kind: 'group', combinator: 'and', negated: false, children: [] }),
    ).toEqual({ kind: 'const', value: true })
  })
})

describe('constructors', () => {
  it('freshGroup starts with one editable condition', () => {
    const g = freshGroup(columns)
    expect(g.children).toHaveLength(1)
    expect(g.children[0]!.kind).toBe('cond')
  })

  it('freshCondition picks a valid operator for the first column type', () => {
    const c = freshCondition(columns)
    expect(c.column).toBe('region')
    expect(c.op).toBeTruthy()
  })
})
