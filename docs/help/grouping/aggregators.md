# Group aggregators

When grouping is active, each group row can show a rolled-up value per column -
the sum of revenue, the average score, the count of deals. SvGrid does this
declaratively: set `aggregate` on a column and the group header shows the
result, formatted with that column's own `format`.

<div data-docs-demo="142-group-aggregators" data-height="480"></div>

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, columnGroupingFeature, type ColumnDef } from '@svgrid/grid'

  const features = tableFeatures({ columnGroupingFeature })

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'region', header: 'Region' },
    { field: 'revenue', header: 'Revenue', aggregate: 'sum', format: { type: 'currency', currency: 'USD' } },
    { field: 'winRate', header: 'Win rate', aggregate: 'avg', format: { type: 'percent' } },
  ]
</script>

<SvGrid {data} {columns} {features} groupable />
```

## Built-in reducers

| `aggregate`       | Result                                              |
| ----------------- | --------------------------------------------------- |
| `'sum'`           | Sum of the finite numeric values.                   |
| `'avg'`           | Mean of the finite numeric values.                  |
| `'min'` / `'max'` | Smallest / largest value.                           |
| `'count'`         | Number of leaf rows in the group.                   |
| `'countDistinct'` | Number of distinct values.                          |
| `'extent'`        | `"min – max"` range string.                         |
| `'first'`         | The first leaf row's value (e.g. a shared label).   |

Non-numeric and empty cells are ignored by the numeric reducers; an all-empty
group yields no value (the header chip is hidden).

## Custom aggregators

Pass a function for anything the built-ins don't cover - weighted average,
median, percentile, distinct-with-rules. It receives the finite numeric values
and the raw leaf rows:

```ts
const median = (vals: number[]) =>
  vals.length ? [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)] : 0

const columns = [
  { field: 'score', header: 'Median score', aggregate: median },
  // weighted average using two columns off the raw rows:
  {
    field: 'rate',
    header: 'Blended rate',
    aggregate: (_vals, rows: Row[]) => {
      const w = rows.reduce((s, r) => s + r.weight, 0)
      return w ? rows.reduce((s, r) => s + r.rate * r.weight, 0) / w : 0
    },
  },
]
```

## The footer summary row

The same reducers drive the grid's footer row, which totals the whole filtered
set rather than a group. It is **off by default** - turn it on with `summary`:

```svelte
<SvGrid {data} {columns} summary />
```

Out of the box each column falls back to a sensible guess: the sum of a numeric
column, `Count: N` otherwise. Give a column its own `summary` to choose, using
the reducer names from the table above:

```svelte
<script lang="ts">
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'region', header: 'Region' },
    { field: 'revenue', header: 'Revenue', summary: 'sum', format: { type: 'currency', currency: 'USD' } },
    { field: 'winRate', header: 'Win rate', summary: 'avg', format: { type: 'percent' } },
    // Nothing worth totalling in this one.
    { id: 'actions', header: '', summary: false },
  ]
</script>

<SvGrid {data} {columns} summary />
```

`summary` is independent of `aggregate`: one feeds the footer, the other feeds
group rows, and a column can set both to different reducers. `enableRowSummaries`
is the long-form name for the grid prop; `summary` wins when both are set.

## Notes

- Aggregates roll up **all leaf rows** under a group, at every nesting level.
- The aggregated value is stored on the group row, so
  `api.getDisplayedRows()` and `row.getCellValueByColumnId(id)` return it too -
  handy for exporting group totals.
- The reducer is exported as `applyGroupAggregate(agg, columnId, rows)` for
  reuse outside the grid.

See the live [Group aggregators](https://svgrid.com/demos/142-group-aggregators/)
demo.
