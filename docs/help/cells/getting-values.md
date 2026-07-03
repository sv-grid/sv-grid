# Getting values

You get cell values in three ways depending on context.
<div data-docs-demo="04-selection-copy-paste" data-height="540"></div>

## Inside a column definition

`field` does the obvious thing - `row[key]`:

```ts
{ field: 'firstName', header: 'First' }
```

Use `fieldFn` for anything computed:

```ts
{
  id: 'fullName',
  header: 'Full name',
  fieldFn: (row) => `${row.firstName} ${row.lastName}`,
}
```

## Inside a cell renderer

A `cell` callback receives a `CellContext`:

```ts
{
  field: 'salary',
  header: 'Salary',
  cell: (ctx) => {
    const value = ctx.getValue()          // unknown
    const row   = ctx.row.original         // your TData
    const all   = ctx.row.getAllCells()    // array of Cell
    return /* renderSnippet / string / etc. */
  },
}
```

`ctx.row.original` is the **raw row object** you passed in - handy when
you want sibling values without going through accessors.

## From outside the grid

After `onApiReady`:

```ts
const v = api.getCellValue(rowIndex, columnId)
api.setCellValue(rowIndex, columnId, newValue)
```

`rowIndex` is the index in the **source data array**, not the post-pipeline
displayed index.

## Reading by row id

There is no `api.getCellValueByRowId(rowId, columnId)` helper today. If you
need that, walk `api.getData()`:

```ts
function valueByRowId(api: SvGridApi<{}, Person>, rowId: string, col: string) {
  const data = api.getData()
  const idx = data.findIndex((r) => r.id === rowId)
  return idx === -1 ? undefined : api.getCellValue(idx, col)
}
```

## See also

- [Cell components](./cell-components.md)
- [Accessing rows](../rows/accessing-rows.md)
