# Expression query language - Enterprise

The expression language is a small, dependency-free query language your users
author through the UI. It is the connective tissue behind [alerts](./alerts.md)
(and, in time, styled and calculated columns): one model for predicates, scalar
maths, and change detection, evaluated the same way everywhere.

It ships in `@svgrid/enterprise`. Leaf comparisons delegate to the grid's own
`applyExcelFilter`, so an expression's operators mean exactly what the column
filter menu means.

## The editor

`<SvExpressionEditor>` offers two modes over the same value:

- **Builder** (default) - a list of conditions (column + operator + value)
  combined with *all* (AND) or *any* (OR), just like the filter row. Set
  operators show a token input; `between` shows two fields; blank operators show
  none.
- **Text** - a free-text box for power users, with live validation and column
  maths.

Both show a live "matches N of M" count against a sample `rows` array.

```svelte
<script lang="ts">
  import { SvExpressionEditor, type ExprColumn, type PredicateExpr } from '@svgrid/enterprise'

  const columns: ExprColumn[] = [
    { id: 'price', name: 'Price', type: 'number' },
    { id: 'region', name: 'Region', type: 'text' },
  ]
  let expr = $state<PredicateExpr>({ kind: 'const', value: true })
</script>

<SvExpressionEditor {columns} bind:value={expr} rows={sample} />
```

## Text syntax

Column references are a bare id (`price`) or a bracketed label (`[Unit Price]`)
when the name has spaces.

```
price > 100 AND region IN ("EU", "US")
name CONTAINS "widget" OR name STARTSWITH "gadget"
price BETWEEN 10 AND 20
name ISBLANK
price / qty >= 40           -- cross-column maths
SUM(amount) > 10000         -- aggregate over the rows in scope
```

- Logic: `AND`, `OR`, `NOT`, parentheses.
- Text/set/range operators: `CONTAINS`, `STARTSWITH`, `ENDSWITH`, `MATCHES`
  (regex), `IN (…)`, `BETWEEN … AND …`, `ISBLANK`, `ISNOTBLANK`.
- Symbolic comparators: `=`, `!=`, `>`, `<`, `>=`, `<=` (these also drive
  cross-column maths).
- Arithmetic: `+`, `-`, `*`, `/`, `%`, unary `-`.
- Aggregates: `SUM(col)`, `AVG(col)`, `COUNT(col)`.
- Functions: `ABS`, `ROUND`, `FLOOR`, `CEIL`, `MIN`, `MAX`, `IF`, `COALESCE`,
  `CONCAT`, `LOWER`, `UPPER`, `LEN`.

A `column = literal` comparison parses to a grid-filter `cmp` node (so it folds
accents/case like the filter row); general comparisons and maths parse to a
`scalarCmp`.

## The model

The canonical form is a JSON AST - no parser is needed at runtime. Three
families:

- **`PredicateExpr`** - boolean: `and` / `or` / `not` / `cmp` (a filter-operator
  test) / `scalarCmp` (compare two scalar expressions) / `const`.
- **`ScalarExpr`** - a single value: `col` / `lit` / `bin` (arithmetic) / `agg` /
  `func`.
- **`ChangeExpr`** - `changed` / `delta` / `percentChange` / `crossed`, for the
  "relative change" alert trigger.

## Evaluating expressions

```ts
import { evaluatePredicate, parsePredicate, validateExpression } from '@svgrid/enterprise'

const expr = parsePredicate('price > 100 AND region = "EU"', columns)
validateExpression(expr, columns)                 // [] when sound
evaluatePredicate(expr, { row: { price: 120, region: 'EU' } })  // true
```

`evaluateScalar` and `evaluateChange` cover the other two families. All three are
pure functions - safe to unit-test and to run in a Web Worker.

Advanced scalar functions can be injected per evaluation via the context's
`functions` map (for example, to delegate a formula to HyperFormula) without
making it a hard dependency.

## See also

- [Alerts](./alerts.md) - the flagship consumer of this language.
- [Filtering](./filtering/overview.md) - the column filter operators the `cmp` nodes reuse.
