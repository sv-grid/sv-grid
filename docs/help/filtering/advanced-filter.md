# Advanced filter

The column filters cover one column at a time, joined with AND. The advanced
filter is for the questions that shape does not reach: OR across different
columns, negation, nested groups, and comparisons against an aggregate of the
rows themselves.

<div data-docs-demo="98-advanced-filter-builder" data-height="620"></div>

The engine ships in `@svgrid/enterprise`. The free grid carries the config type
and the seam to plug an engine in, so nothing in `@svgrid/grid` depends on the
commercial package.

## Setup

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte
<script>
  import { SvGrid } from '@svgrid/grid'
  import { SvAdvancedFilter, enableAdvancedFilter } from '@svgrid/enterprise'

  enableAdvancedFilter()
  let api = $state(null)
</script>

{#if api}
  <SvAdvancedFilter {api} />
{/if}
<SvGrid {data} {columns} onApiReady={(a) => (api = a)} />
```

The panel is mounted by you, beside the grid, the same way `SvGridAlerts` is.
There is no grid-side renderer to register, so you decide whether it sits in a
sidebar, a drawer or a dialog.

## The expression

An expression is a JSON AST, so a saved view is just data:

```ts
const expr = {
  kind: 'and',
  parts: [
    { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' },
    { kind: 'cmp', column: 'churnRisk', op: 'in', value: ['medium', 'high'] },
  ],
}
api.setAdvancedFilter(expr)
```

`cmp` uses the **same operator union as the filter row**, and leaf comparisons
delegate to the grid's own `applyExcelFilter`. A "greater than" in the advanced
filter is byte-for-byte a "greater than" in the column menu, rather than a
second implementation that drifts.

| Node | Means |
| --- | --- |
| `cmp` | One column compared with a filter-row operator |
| `and` / `or` | Combine parts |
| `not` | Negate |
| `scalarCmp` | Compare two scalar expressions, so column maths and aggregates |
| `const` | `{ kind: 'const', value: true }` is how "no filter" is spelled |

### Comparing a row to an aggregate

This is the one the column filters cannot express at all, because it compares
each row to a value computed from the rows that survived the other filters:

```ts
api.setAdvancedFilter({
  kind: 'scalarCmp',
  left: { kind: 'col', id: 'arr' },
  op: '>',
  right: { kind: 'agg', fn: 'avg', column: 'arr' },
})
```

The aggregate is folded **once per filter change**, not once per row. A naive
evaluator re-scans the row set for every row, which makes `SUM(x) > N`
quadratic; at a few thousand rows that is the difference between instant and
visibly stuck.

## The builder

The panel edits the expression as a tree: conditions, and groups holding more
conditions. **Add group** nests one level, and a nested group defaults to the
opposite combinator of its parent, since nesting an "all" inside an "all" means
nothing and would only have to be corrected. **NOT** on a group negates it.

Nesting is capped at four levels. Beyond that the panel keeps the expression in
text mode rather than drawing a tree too deep to read.

### What the builder will not show

Column maths and aggregates have no condition-row representation, so an
expression containing them stays in text mode and the **Builder** tab is
disabled with a tooltip explaining why. That is deliberate: a tab that looks
clickable and then refuses reads as a bug, when the refusal is a property of
the expression.

`not` around a *single* condition is also left to text mode. The grid already
has negative operators (`notEquals`, `notContains`), and offering two spellings
of one thing in the builder makes the UI worse, not better.

Text mode always accepts everything:

```
region = "EMEA" AND (arr > 300000 OR seats > 150)
```

## Applying, and what happens on failure

The panel holds a **draft** and only touches the grid on **Apply**. The editor
emits on every keystroke, which is right for an alert rule but here would re-run
the whole filter pipeline per character. Holding the draft also makes the live
"matches N" counter a real preview of what Apply would do rather than a lagging
echo of what already happened.

Filtering **fails open**. If no engine is registered, if the expression fails to
compile, or if anything throws, the rows are left untouched:

> A half-filtered grid is indistinguishable from a correctly filtered one. Silently
> dropping rows because of an internal error is the one outcome worth ruling out,
> so the failure is visible instead: the panel says an expression is set but no
> engine is running it.

That is also why `@svgrid/grid` alone shows every row when you set an expression
without `enableAdvancedFilter()` - the free package never pretends to filter.

## The toolbar indicator

When an advanced filter is set, the grid shows a chip above the table naming it,
with a control to clear it. The filter is authored in a panel you placed, which
may be scrolled away or behind a drawer; without the chip, rows are missing with
nothing on screen to say why. Both strings go through `localeText`
(`advancedFilterActive`, `advancedFilterClear`).

## Server-side

`ServerFilterModel.expression` carries the expression to your backend. The
contract is **all-or-nothing**: apply the whole expression and set
`appliedExpression: true`, or apply none of it.

If a backend ignores it, the grid does **not** filter the page it already has.
Doing so would turn "3 of 1,000,000 match" into a confident lie, and paging
would be incoherent because the next page would re-filter a different slice.
Instead the state carries `expressionUnapplied`, the grid warns once, and the
rows are left alone so you can tell the user the filter did not run.

See [server-side filtering](../server/server-filtering.md).

## API

| Method | Does |
| --- | --- |
| `api.setAdvancedFilter(expr)` | Apply an expression |
| `api.getAdvancedFilter()` | The current expression, or `null` |
| `api.clearAdvancedFilter()` | Remove it |
| `api.isAdvancedFilterActive()` | True only when an engine is actually running it |

`api.clearAllFilters()` clears the advanced filter too, since it promises every
filter surface. Saved views round-trip it through an optional `advancedFilter`
key, so views saved before this feature existed load unchanged.

## More examples

### Set filter (tree / async / Excel)

Three set-list filter patterns: the built-in Excel-style column menu, async-loaded values for huge enums, and a tree-list (Region → Country → City) with cascading checkboxes. All driven through api.setFacetFilter.

<div data-docs-demo="111-set-filter-advanced" data-height="460"></div>

## Try it

The advanced filter composes conditions across columns rather than one column at
a time. Open the filter menu on Age and on Salary and the two conditions AND
together - which is what makes "senior and expensive" a single question.

```svelte {runnable}
<SvGrid data={people} {columns} filterable filterMode="menu" sortable pageable pageSize={4} />
```

## See also

- [Filtering overview](./overview.md)
- [Filter conditions](./filter-conditions.md) - the per-column shape
- [Filter API](./filter-api.md)
