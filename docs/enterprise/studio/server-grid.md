# Sorting, filtering & paging

In a Studio screen the data lives on the server, so the grid does not sort,
filter, or paginate locally - it renders its **native UI** and emits the user's
intent, and your data source fetches the matching page. This is "server mode",
and it is wired for you in generated screens. This page shows how it works so you
can customize it.

![In server mode the grid renders its native controls but forwards the user's sort, filter, and page intent to your ServerDataSource, which returns the matching page.](/docs-media/studio-server-grid.svg)

## The three server-mode switches

| Prop | UI it renders | Event it emits |
| --- | --- | --- |
| `externalSort` | clickable, indicating headers | `onSortingChange(sortModel)` |
| `externalFilter` | filter row / column menus / global search | `onFiltersChange({ global, columns })` |
| `externalPagination` | the pagination footer | `onPaginationChange({ pageIndex, pageSize })` |

Each says: "show the control, but let me do the work." You forward the event to
the [`createServerDataSource`](./data-binding.md) controller, which fetches and
updates the rows.

## A complete example

```svelte
<script lang="ts">
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import { createKitDataSource, schemaToColumns } from '@svgrid/enterprise'
  import { customersSchema, type CustomersRow } from '$lib/customers.schema'

  const source = createKitDataSource<CustomersRow>({ endpoint: '/api/customers' })
  const columns = schemaToColumns(customersSchema)

  let view = $state<ServerState<CustomersRow>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 25, pageCount: 1, sortModel: [], filterModel: {},
  })
  const controller = createServerDataSource(source, {
    pageSize: 25,
    getRowId: (r) => r.id,
    onChange: (s) => (view = s),
  })
  controller.refresh()
</script>

<SvGrid
  data={view.rows}
  {columns}
  loading={view.loading}
  fitColumns
  enableRowSummaries={false}

  sortable
  externalSort
  onSortingChange={(s) => controller.setSort(s)}

  filterable
  showGlobalFilter
  externalFilter
  onFiltersChange={(f) =>
    controller.setFilter({
      global: f.global || undefined,
      columns: Object.fromEntries(
        f.columns.map((c) => [c.id, {
          operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues,
        }]),
      ),
    })}

  showPagination
  externalPagination
  rowCount={view.total}
  pageIndex={view.pageIndex}
  pageSize={view.pageSize}
  onPaginationChange={({ pageIndex, pageSize }) => {
    if (pageSize !== view.pageSize) controller.setPageSize(pageSize)
    else controller.setPage(pageIndex)
  }}
/>
```

## Notes

- **`rowCount`** is the server total, so the footer shows "1 to 25 of 1,240"
  even though only 25 rows are loaded. Return it from `getRows` as `rowCount`.
- **`fitColumns`** scales columns to fill the width; **`enableRowSummaries={false}`**
  removes the aggregate footer row (on by default).
- The filter operator per column (`contains`, `equals`, `greaterThan`,
  `between`, ...) comes through in `onFiltersChange` - the SQL and REST bindings
  map it for you (`createSqlDataSource`, `planToSql`).
- Sorting and filtering support **multiple columns**; the event carries the full
  model each time.

The generated screen already wires all of this; you rarely write it by hand. It
is here so you can tweak which surfaces are on (say, filter row vs. column menu)
or point the events at a custom controller.

## See also

- [Data binding](./data-binding.md) - the `ServerDataSource` + controller
- [The EntitySchema](./schema.md) · [Databases](./databases.md)
