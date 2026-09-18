# Server selection - Enterprise

A grid that keeps a list of selected ids is right until the rows it has seen
are a window onto a million on a server. Then "select all" has to mean a
million, the header checkbox has to say so, and a bulk edit has to reach rows
that never came down the wire. None of that fits a list of ids. It fits a
**rule** - "everything, except these" - which is what the
[server-side row model](./server-grouping.md) keeps when you turn selection
on. The demo shows the rule as `getSelectionState()` reports it, flat and
per group, with a bulk edit the server applies by rule.

<div data-docs-demo="471-server-selection" data-height="600"></div>

## Turning it on

```ts
const ctl = createServerRowModel(source, {
  groupBy: ['region', 'country'],
  aggregations: [{ col: 'amount', fn: 'sum' }, { col: 'id', fn: 'count' }],
  getRowId: (r) => String(r.id),
  selection: { groupSelects: 'descendants' },
  grandTotalRow: 'pinnedBottom',
})
```

The model then supplies the grid's `rowSelectionModel` through `rowModel`:
the row checkboxes, the header checkbox and `api.selectAllRows()` all read
and write the rule instead of a list. Placeholder rows are skipped; there is
nothing there to select.

## Two shapes of rule

`groupSelects: 'self'` (the default) keeps one flat rule:

```json
{ "selectAll": true, "toggled": ["row-17", "row-90"] }
```

`toggled` are the exceptions - deselected ids under `selectAll: true`,
selected ids under `false`. A group row is a row like any other.

`groupSelects: 'descendants'` keeps a tree of rules, so ticking a group
selects everything beneath it and an exception inside a group is recorded
under that group:

```json
{
  "selectAllChildren": true,
  "toggled": {
    "EMEA": { "selectAllChildren": false, "group": true,
              "toggled": { "Germany": { "selectAllChildren": true, "group": true, "toggled": {} } } }
  }
}
```

reads as "everything, except EMEA, except Germany within it".
`'filteredDescendants'` is accepted as an alias: on a server the filter is
already applied, so the rule is the same.

Both shapes are plain data. `ctl.getSelectionState()` returns the rule and
`ctl.setSelectionState(rule)` restores it, so a selection survives a page
reload or travels to an endpoint. Under a `descendants` rule the state also
carries `groupBy`, the columns its levels are keyed by, which is what a
backend needs to resolve it.

## An honest count

The selection bar's chip and `selection.selectedCount()` count what the rule
selects, not what is loaded: a million under select-all, a million minus two
exceptions, or exactly the ticked rows. Under grouping, the model reads the
total from a `count` aggregation on the grand total row - that is the only
place the server says how many leaves there are - and reports `null` (unknown)
without one, which the bar shows as the loaded count.

`api.getSelectedRows()` stays what it says: the selected rows the grid has
loaded. Under select-all that is a window, never the whole set.

## A bulk edit by rule

`ctl.bulkUpdate(patch)` sends the current filter model, the patch and the
rule to the datasource's optional `updateWhere(filterModel, patch, selection)`
and resolves with how many rows changed, then reloads every open level. The
Enterprise selection bar's **Edit fields** drawer calls it when the grid runs
on a row model, so "edit 1,000,000 rows" is one request carrying one rule.

A datasource without `updateWhere` refuses the bulk edit rather than quietly
writing only the loaded rows. `createInMemoryDataSource` implements it as the
reference, resolving a nested rule level by level; `createKitDataSource`
sends it as one message that `createKitHandlers` runs through the same
authorize, validate, scope and audit hooks as a single-row update. A SQL
backend resolves a flat rule as `WHERE <filters> AND id NOT IN (<toggled>)`
under select-all, and a nested one by walking group values the way the grid
builds routes.

## A new row's selection

A row added by a [transaction](./server-transactions.md) under a group
inherits that group's state: selected under a selected group, not under a
deselected one. An indeterminate group passes on its last settled state.

## More examples

### Server-Side Row Model: 1,000,000 rows

Select-all across a million server-side rows with a bulk edit by rule, on the flagship demo.

<div data-docs-demo="467-server-row-model-1m" data-height="640"></div>

### The selection bar

The bar itself, on client-side rows: the count chip, the built-in actions, the bulk-edit drawer and an app's own buttons.

<div data-docs-demo="430-selection-bar" data-height="480"></div>

### Bulk server operations

Select rows, choose an operation, and send one request for all of them - the pattern a bulk edit by rule generalises to rows the grid never loaded.

<div data-docs-demo="117-bulk-operations" data-height="480"></div>

## See also

- [Server grouping](./server-grouping.md) - the model the selection belongs to.
- [Server transactions](./server-transactions.md) - what a new row inherits.
- [Selection bar](../rows/selection-bar.md) - the bar, the count chip and the bulk-edit drawer.
