# Grouping & aggregation

Roll rows up by one or more columns and compute aggregates (sum, avg,
count, min, max, custom) at each group level. Powered by
`columnGroupingFeature` plus per-column `aggregator` config.

Try it: drag a column into the group-by lane, then change aggregators
per column:

<div data-docs-demo="07-grouping-aggregation" data-height="500"></div>

## Minimal example

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures, rowSortingFeature, columnGroupingFeature,
    type ColumnDef,
  } from 'sv-grid-core'

  type Employee = {
    id: number; name: string; department: string;
    salary: number; performance: number
  }

  const features = tableFeatures({ rowSortingFeature, columnGroupingFeature })

  const columns: ColumnDef<typeof features, Employee>[] = [
    { field: 'department', header: 'Department' },
    { field: 'name',       header: 'Name' },
    { field: 'salary',     header: 'Salary',
      aggregator: 'sum',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'performance', header: 'Performance',
      aggregator: 'avg' },
  ]

  const rows: Employee[] = [
    { id: 1, name: 'Ada',   department: 'Engineering', salary: 180_000, performance: 4.8 },
    { id: 2, name: 'Linus', department: 'Engineering', salary: 195_000, performance: 4.6 },
    { id: 3, name: 'Grace', department: 'Operations',  salary: 165_000, performance: 4.9 },
  ]
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  groupBy={['department']}
/>
```

The grid emits one group row per unique department value, with the
group cell showing the rolled-up salary sum + average performance.
Click the chevron on a group row to expand its children.

## Setting the group-by

Three ways, ranked by ergonomic order:

1. **The column menu.** When the user opens a header's menu, "Group
   by this column" toggles that column in/out of the group-by list.
2. **The `groupBy` prop.** Initial state for the group-by list.
3. **The imperative API.** `api.setGroupBy(['department', 'role'])`
   for toolbars / saved views.

The group order is significant - `['region', 'country']` rolls up
country inside region; reverse the array to flip the hierarchy.

## Built-in aggregators

| Aggregator | Returns                                              | Behaviour on empty groups |
| ---------- | ---------------------------------------------------- | ------------------------- |
| `'sum'`    | Sum of numeric cell values                           | `0`                       |
| `'avg'`    | Arithmetic mean (with safe divide-by-zero)           | `null`                    |
| `'count'`  | Number of leaf rows                                  | `0`                       |
| `'min'`    | Smallest value (numeric or `Intl.Collator`-comparable) | `null`                  |
| `'max'`    | Largest value                                        | `null`                    |

`'sum'` / `'avg'` / `'min'` / `'max'` cast values to `Number`. If the
column has non-numeric values mixed in, those rows are skipped.

## Custom aggregator

Pass a function instead of a string for any group-aware computation:

```ts
{
  field: 'orders',
  header: 'Top customer',
  aggregator: (rows) => {
    const top = rows.reduce<Employee | null>(
      (acc, r) => !acc || r.orders > acc.orders ? r : acc,
      null,
    )
    return top?.name ?? '-'
  },
}
```

The callback gets every leaf row in the group (already filtered).
Return whatever the cell should display - string, number, or a
formatted value.

## Custom group cell rendering

By default the group cell shows `key (n)` - e.g. "Engineering (12)".
Override via the column's `cell` template:

```svelte
{#snippet GroupCell(props: { row: GroupRow<Employee> })}
  <span class="font-semibold">
    {props.row.groupKey}
    <span class="text-sm opacity-60">({props.row.subRows.length} reports)</span>
  </span>
{/snippet}
```

The `row.groupKey` is the unique group value (the department name in
the example). `row.subRows` is the children. `row.depth` is the
nesting level (useful for indentation when you group by multiple
columns).

## Aggregating string columns

Strings work with `'count'`, `'min'`, `'max'`, and any custom
aggregator. For sum / avg you'll get `NaN` because the cast to
`Number` fails - the grid renders this as `-` by default.

A useful custom aggregator for strings:

```ts
{
  field: 'tags',
  aggregator: (rows) => {
    const set = new Set<string>()
    for (const r of rows) for (const t of r.tags) set.add(t)
    return Array.from(set).join(', ')
  },
}
```

## Performance

Aggregation runs once per group-by change, NOT per scroll frame. The
cost is O(n) for `count` / `sum` / `avg`, O(n log n) for `min` / `max`
because the engine sorts to find the extreme.

For a 100k-row dataset grouped by two columns with three aggregators,
the pipeline adds ~36 ms to the initial paint (see
[Performance benchmarks](./benchmarks.md)). After that, scroll is
unaffected - the renderer hands each visible group its precomputed
value.

## Group expansion state

`expanded` is owned by the engine by default; you can hoist it for
saved-views purposes:

```svelte
<SvGrid
  ...
  expanded={controlledExpanded}
  onExpandedChange={(next) => (controlledExpanded = next)}
/>
```

The shape is `Record<groupId, boolean>` where `groupId` is the path
through the hierarchy (`'Engineering > Senior'`).

## Group sort vs leaf sort

The sort UI sorts within the active sort scope:

- When grouping is OFF, sort applies to all rows.
- When grouping is ON, sort applies WITHIN each group - groups stay
  in alphabetical (or group-aggregator) order; only the leaves inside
  each group reorder.

To sort the groups themselves by their rolled-up value, set the sort
on the aggregated column AFTER setting the group-by. The grid
recognises that the column is aggregated and sorts the group rows
instead of the leaves.

## Filtering vs grouping

Filters run BEFORE grouping (see [Architecture](./architecture.md) for
the pipeline order). The aggregator only sees rows that passed the
filter. This is what makes "department salary sum, filtered to active
employees only" work without any extra config.

## Pivot vs group-by

When the question is "group by row dimensions, also group by column
dimensions, also pick aggregators per measure" - that's a pivot. The
[pivot helpers](./pivot.md) build a different data structure
optimised for that shape. Use group-by when you only roll up rows;
use pivot when you also roll up columns.

## See also

- [Architecture overview](./architecture.md) - where grouping sits in
  the pipeline.
- [Pivot tables](./pivot.md) - the column-axis version.
- [Row pagination](./rows/row-pagination.md) - the paging stage runs
  AFTER grouping, so group rows count toward the page size.
- [Demo #07 Grouping + aggregation](https://svgrid.com/#/demos/07-grouping-aggregation)
  - the source for the example above.

## Frequently asked questions

### How do I group rows in SvGrid?

Register `columnGroupingFeature` and group by one or more columns. Each group
renders a collapsible header row, and you attach an `aggregator` per column to
compute sum, avg, count, min, max, or a custom reducer at every group level.

### What aggregation functions does SvGrid support?

Built-in `sum`, `avg`, `count`, `min`, and `max`, plus custom aggregators -
any function that reduces a group's rows to a single value. Aggregates compute
at each group level and at the grand-total footer.

### Is grouping the same as a pivot table?

No. Grouping rolls rows up along the row axis. A pivot table also spreads a
field across the column axis with nested headers - that is the `sv-grid-pro`
pivot model. See [Pivot tables](./pivot.md) for the column-axis version.
