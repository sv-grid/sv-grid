# Server transactions - Enterprise

A row was added on the server and the grid should show it now, not after a
refetch. A socket said a price moved. A row was deleted and its group should
lose it. Transactions apply those changes to the rows the
[server-side row model](./server-grouping.md) already holds, in place, with
no request: the block cache of the level named by `route` is patched, the row
count follows, and the display list is rebuilt. A refresh is still the way to
bring in what the server knows and the grid does not; a transaction is for
what the app already knows. The demo below is a feed of changes the
server already made: price ticks patch loaded rows in place, new and
shipped orders arrive as batched transactions at their warehouse, and the
log shows the status of each.

<div data-docs-demo="470-server-transactions" data-height="600"></div>

## One transaction

```ts
const result = ctl.applyTransaction({
  route: ['EMEA', 'Germany'],       // the level to change; omit for the top level
  add: [newRow],                    // appended, or at `addIndex`
  addIndex: 0,
  update: [savedRow],               // matched by id
  remove: ['row-42', otherRow],     // ids or rows
})
result.status // 'applied' | 'storeNotFound' | 'storeLoading' | 'storeWaitingToLoad' | 'storeLoadingFailed' | 'cancelled'
result.add    // ids placed, result.update ids found and patched, result.remove ids found and removed
```

Rows are matched by `getRowId` at a leaf level and by the group column's
value at a group level - a group row is its key - so `update: [{ region:
'EMEA', amount: 120 }]` on the root patches the EMEA group's subtotal. The
grand-total row answers to the fixed id `sv-grand-total` and a group footer
to `sv-group-total:<route>`.

`getRowId` is required: a transaction with no way to name a row throws with
a clear message.

Rules worth knowing, each one a test:

- A `remove` of a row outside the loaded blocks is ignored when the level's
  count is known - there is nothing loaded to remove - and the id is not in
  `result.remove`. Pass `rowCount` when you know the count changed anyway.
- A route whose group has not been expanded is `storeNotFound`. A transaction
  does not create levels; add the group row to the parent level instead.
- A row added under a group inherits that group's selection state.
- The parent group row's `childCount` moves by the net add and remove, so
  the badge beside its key stays right. Aggregates are not recomputed by a
  transaction. Call `refresh({ route: parentRoute })` after a leaf edit when
  the subtotal must follow; the flagship demo does exactly that.

## Async transactions

High-frequency updates - a feed, a socket - queue with
`applyTransactionAsync(tx, callback)` and apply in one batch every
`asyncTransactionWaitMs` (default 50 ms), each callback receiving its own
result. `flushAsyncTransactions()` applies the queue now, and
`onAsyncTransactionsFlushed(results)` fires once per batch.

```ts
socket.on('tick', (row) => ctl.applyTransactionAsync({ route: routeOf(row), update: [row] }))
```

`isApplyTransaction(tx)` is a veto: return `false` and the transaction
resolves as `cancelled`, which is how a refresh in flight discards updates
that predate it.

## One row, no transaction

`updateRowData(id, patch, { replace })` patches one loaded row on whatever
level holds it, without a request and without changing its id - the path for
a ticking cell. `replace: true` swaps the whole row instead of merging the
patch. It returns whether the row was found.

## Editing goes through the server, then the transaction

`createRow`, `updateRow` and `deleteRow` on the model call the datasource's
method of the same name, then apply the saved row back as a transaction on
the route that holds it - no refetch of the block. Wire the grid's edit event
to `updateRow`, and refresh the parent level if a subtotal should follow:

```svelte
<SvGrid
  rowModel={ctl}
  {columns}
  editable
  onCellValueChange={async (e) => {
    const meta = e.row.__group
    if (meta.kind !== 'leaf') return
    await ctl.updateRow(String(e.row.id), { [e.columnId]: e.newValue })
    ctl.refresh({ route: meta.route.slice(0, -1) })
  }}
/>
```

Group rows do not take edits: the grid refuses them itself when a row model
marks a row as a group, so the handler only ever sees leaves. Mark the value
columns `cellFlash: true` and an updated cell flashes when the transaction
lands.

`createRow(input, route, addIndex)` puts the saved row at `addIndex` in its
level; without one it goes to the end, which in a level of thousands is
out of sight. `0` is the top of the level; the index a row had before a
delete puts it back where it was, which is what an undo wants. Writes are
non-optimistic unless the model has `optimistic: true`, in which case
`updateRow` and `deleteRow` show the change first and put the row back if
the server refuses; `state.saving` is true while any write is out.

## Delivering a whole level

`applyRowData({ route, rows, rowCount, startRow })` fills a level's store
from data you already have - children that shipped with their parent, a
level pushed over a socket - bypassing the datasource, the debounce and the
concurrency cap.

## More examples

### Server-Side Row Model: 1,000,000 rows

Inline edits applied back as transactions with the subtotal following, add and delete, over a million server-side rows.

<div data-docs-demo="467-server-row-model-1m" data-height="640"></div>

### Optimistic updates and rollback

The free controller's optimistic path: edit a cell, the row changes at once, the server validates, and a rejection rolls the row back.

<div data-docs-demo="115-optimistic-updates" data-height="480"></div>

### WebSocket live updates

Insert, update and delete deltas merged into the grid by id with cell flashes - the same shape a socket feeds `applyTransactionAsync`.

<div data-docs-demo="116-websocket-live-updates" data-height="480"></div>

## See also

- [Server grouping](./server-grouping.md) - the model these transactions apply to.
- [Server selection](./server-selection.md) - what a new row inherits, and the bulk edit by rule.
- [Server editing](./server-editing.md) - the datasource's write methods.
