# Transactions

`api.applyTransaction({ add, update, remove })` applies a batch of row
mutations in a **single** data update - one re-render for the whole batch,
not one per row. It's the path to use for high-frequency / streaming feeds
(WebSocket deltas, tick data) where calling `addRow` / `setCellValue` per row
would thrash.

<div data-docs-demo="145-transaction-api" data-height="480"></div>

```ts
const result = api.applyTransaction({
  add:    [newOrder],                          // appended
  update: [{ ...order, price: nextPrice }],    // matched by id
  remove: ['ORD-1001', staleRowRef],           // by id OR row reference
})
// result -> { added: 1, updated: 1, removed: 2 }
```

## Matching

- **`add`** - rows are appended to the data.
- **`update`** - each row is matched to an existing row by **id**, then
  replaced. Set `getRowId` so the grid can compute ids; without it, updates
  can't be matched.
- **`remove`** - accepts row **ids** (needs `getRowId`) and/or row **object
  references** (always works). Unknown ids are silently ignored.

The call returns the counts actually applied, so you can log or reconcile.

## Why batch

Each `applyTransaction` produces exactly one new data array and therefore one
reactive update, regardless of how many rows changed. On a live feed that
emits dozens of deltas per second, batching them per animation frame (or per
WebSocket message) keeps the grid smooth where per-row calls would not.

```ts
// buffer deltas, flush once per frame
let buffer: Delta[] = []
socket.onmessage = (e) => { buffer.push(JSON.parse(e.data)); schedule() }

function schedule() {
  requestAnimationFrame(() => {
    api.applyTransaction({
      add:    buffer.filter((d) => d.type === 'add').map((d) => d.row),
      update: buffer.filter((d) => d.type === 'update').map((d) => d.row),
      remove: buffer.filter((d) => d.type === 'remove').map((d) => d.id),
    })
    buffer = []
  })
}
```

## Notes

- The grid owns its data after mount; read the current rows back with
  `api.getData()` (which reflects applied transactions).
- Selection, expansion, and edit state keyed by `getRowId` survive a
  transaction - that's the point of a stable row id.

See the live [Transaction API](https://sv-grid.com/demos/145-transaction-api)
demo.
