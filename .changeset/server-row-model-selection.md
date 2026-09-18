---
'@svgrid/enterprise': minor
'@svgrid/grid': minor
---

Selection across rows the grid never loaded, and a bulk edit that reaches them.

A grid that keeps a list of selected ids is right until the rows it has seen
are a window onto a million on a server. The server-side row model can now
keep the selection as a RULE instead - "everything, except these" - so the
header checkbox says `all` with twenty rows on screen, the selection bar
counts a million, and a bulk edit is sent as the rule rather than as a list.

```ts
const ctl = createServerRowModel(source, {
  groupBy: ['region'],
  getRowId: (r) => r.id,
  selection: { groupSelects: 'descendants' },
  onChange,
})
ctl.getSelectionState()
// -> { selectAllChildren: true, toggled: { EMEA: { selectAllChildren: false, ... } } }
await ctl.bulkUpdate({ status: 'archived' }) // every selected row, loaded or not
```

`groupSelects: 'self'` (the default) treats a group row as one row;
`'descendants'` makes ticking a group select everything beneath it, with
exceptions recorded under that group. The rule is plain data
(`getSelectionState` / `setSelectionState`), so it survives a reload and
travels to an endpoint. `createServerSelectionModel` is exported on its own.

`bulkUpdate(patch)` goes through a new optional datasource method,
`ServerDataSource.updateWhere(filterModel, patch, selection)`, then reloads
every open level. A source without it refuses the edit, rather than quietly
writing only the loaded rows. `createInMemoryDataSource` implements it as
the reference, resolving a nested rule level by level.

In `@svgrid/grid`: the `rowSelectionModel` seam (and `GridRowModel.selection`)
gained `selectedCount` and `bulkUpdate`; the selection bar's count chip reads
the model's number when it has one, and the bulk-edit drawer sends its edits
to `bulkUpdate` (keyed by field) instead of writing the loaded cells when the
model provides it. `ServerLeafRow` gained `route`; `ServerSelectionRule` is
the rule's public shape.
