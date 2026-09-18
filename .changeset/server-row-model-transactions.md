---
'@svgrid/enterprise': minor
'@svgrid/grid': patch
---

Transactions on the server-side row model: change rows in a level without a
request.

```ts
ctl.applyTransaction({
  route: ['EMEA'],
  add: [newOrder], addIndex: 0,
  update: [changedOrder],
  remove: ['order-42'],
})
// -> { status: 'applied', add: ['order-99'], update: ['order-7'], remove: ['order-42'] }
```

Rows are matched by `getRowId` at a leaf level and by the group column's
value at a group level; the grand total answers to `sv-grand-total`.
Removing a group takes its expansion and cached children with it. A row that
is not in the cache is left alone (and not counted), and `rowCount` on the
transaction overrides the arithmetic when the caller knows better. The result
carries one of six statuses - `applied`, `storeNotFound`, `cancelled` (the
`isApplyTransaction` veto said no), `storeLoading`, `storeWaitingToLoad`,
`storeLoadingFailed` - so a caller can tell "nothing there" from "not yet".

`applyTransactionAsync(tx, callback?)` batches everything that arrives within
`asyncTransactionWaitMs` (50 ms by default) into one apply and one render,
holds back a transaction whose level is still loading, and reports each batch
through `onAsyncTransactionsFlushed`; `flushAsyncTransactions()` forces it.

`updateRowData(id, patch, { replace? })` patches one loaded row on whatever
level holds it, for a socket-driven tick where nothing is added or removed.

`createRow(input, route?)` / `updateRow(id, patch)` / `deleteRow(id)` write
through the datasource and apply what it returned as a transaction, so an
edit no longer refetches the level. Aggregates are not recomputed by that;
`refresh({ route })` the parent when a subtotal must follow.

In `@svgrid/grid`, `createBlockCache` gained `findIndex`, and `insert` /
`remove` now work within whichever run of loaded blocks holds the index (a
user who scrolled to the middle can add or remove there) instead of only from
block 0, dropping the blocks past the edit so they re-fetch at their shifted
offsets. A mutation also invalidates the cached row array synchronously - a
read straight after `patch()` used to return the old row until the next tick.
