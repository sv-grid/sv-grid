# Server editing

The Server-Side Row Model has a read side (`getRows`) and an optional **write
side**. Implement whichever of `createRow` / `updateRow` / `deleteRow` your
backend supports, and `createServerDataSource` gives you matching controller
methods that call through and keep the on-screen page in sync. This page is a
deep dive into that write path: the non-optimistic default, built-in optimistic
updates with rollback, the `saving` state, surfacing validation errors, and
optimistic concurrency.

It builds on the [Server-Side Row Model](./server-row-model.md), where the same
controller owns paging, sorting, and filtering.

![An edited cell calls the controller updateRow method; when optimistic it patches the local row immediately, then calls the source updateRow on the server and reconciles by refresh, rolling the local row back if the server rejects.](/docs-media/server-editing.svg)

## The optional write side

`ServerDataSource` is a read model by default. The three write methods are
optional; add only the ones your backend can serve:

```ts
type ServerDataSource<Row> = {
  getRows(request): Promise<{ rows: ReadonlyArray<Row>; rowCount: number }>

  // Optional write side - implement whichever your backend supports.
  createRow?(input: Partial<Row>): Promise<Row>
  updateRow?(id: string, patch: Partial<Row>): Promise<Row>
  deleteRow?(id: string): Promise<void>
}
```

A source that only implements `getRows` stays a pure read model. If you call a
controller method whose source counterpart is missing, it rejects with a clear
error (`the datasource does not implement updateRow()`) rather than failing
silently - so a read-only source stays read-only.

## The controller methods

Each write method flips `saving`, runs the source write, and then reconciles the
current page:

| Method                 | Does                                                        |
| ---------------------- | ---------------------------------------------------------- |
| `createRow(input)`     | Create through the source, then `refresh()` the page. Resolves with the created row. |
| `updateRow(id, patch)` | Update by id. Non-optimistic by default; optimistic when configured. |
| `deleteRow(id)`        | Delete by id. Non-optimistic by default; optimistic when configured. |

```ts
const source: ServerDataSource<Row> = {
  async getRows(req) {
    const res = await fetch('/api/rows', { method: 'POST', body: JSON.stringify(req) })
    const { rows, total } = await res.json()
    return { rows, rowCount: total }
  },
  async updateRow(id, patch) {
    const res = await fetch(`/api/rows/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    if (!res.ok) throw new Error(await res.text())
    return res.json() // the saved row
  },
  async createRow(input) {
    const res = await fetch('/api/rows', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async deleteRow(id) {
    const res = await fetch(`/api/rows/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
  },
}

const ctl = createServerDataSource(source, { pageSize: 50, onChange: (s) => (view = s) })

// Commit a cell edit:
await ctl.updateRow(String(row.id), { status: 'active' })
```

## Non-optimistic by default

By default writes are **non-optimistic**: the controller runs the source method,
and only after the follow-up `refresh()` of the current page lands does the grid
reflect the change. The sequence for `updateRow`:

1. `saving` goes `true`.
2. `source.updateRow(id, patch)` runs on the server.
3. On success, the current page is re-fetched (`refresh()`), picking up the
   authoritative row.
4. `saving` goes `false`.

This is the safest default - what you render is always what the last fetch
returned - at the cost of a round trip before the change is visible. If the
write itself fails, the read state is left untouched.

## Built-in optimistic updates

For instant feedback, opt in with `optimistic: true` and a `getRowId` so the
controller can locate a row inside the current page:

```ts
const ctl = createServerDataSource(source, {
  pageSize: 50,
  onChange: (s) => (view = s),
  optimistic: true,
  getRowId: (r) => String(r.id), // required - without it, optimistic is ignored
})
```

Now `updateRow` patches the local row **immediately**, then reconciles with the
server result:

- `updateRow(id, patch)` merges `patch` into the local row on the spot, awaits
  `source.updateRow`, and replaces the local row with the returned server row.
  If the server rejects, it restores the previous row and re-throws.
- `deleteRow(id)` removes the local row and decrements `total` at once. If the
  server rejects, it restores both the row and the count.

If the target row is not on the current page, optimistic `updateRow` /
`deleteRow` fall back to the plain non-optimistic path (there is nothing local
to patch). `createRow` is always non-optimistic - a new row's server-assigned
id and page position are not known until the refresh.

## The `saving` state

Every write flips a dedicated `saving` flag on the state, separate from the
`loading` flag used by `getRows`:

```ts
type ServerState<Row> = {
  rows: ReadonlyArray<Row>
  total: number
  loading: boolean   // a getRows fetch is in flight
  saving: boolean    // a create / update / delete is in flight
  error: unknown
  // ...pageIndex, pageSize, pageCount, sortModel, filterModel
}
```

Bind `saving` to a toolbar spinner or to disable the save button, and `loading`
to the grid overlay - they never fight each other.

```svelte
<button disabled={view.saving} onclick={save}>
  {view.saving ? 'Saving...' : 'Save'}
</button>
```

## Surfacing validation errors

Server-side validation is just a rejected promise. Have your source `throw` when
the server responds with a validation failure; the controller lets that
rejection propagate out of `createRow` / `updateRow` / `deleteRow` (and, in
optimistic mode, rolls the local change back first). Catch it at the call site
and show it:

```svelte
<script lang="ts">
  let formError = $state<string | null>(null)

  async function save(id: string, patch: Partial<Row>) {
    formError = null
    try {
      await ctl.updateRow(id, patch)
    } catch (err) {
      // Optimistic mode has already rolled the row back to its prior value.
      formError = err instanceof Error ? err.message : 'Save failed'
    }
  }
</script>

{#if formError}
  <div role="alert">{formError}</div>
{/if}
```

Because the write methods reject rather than throwing into `onChange`, your
render never sees a half-applied state: either the write resolved and the page
reconciled, or it rejected and (in optimistic mode) rolled back.

## Optimistic concurrency

Optimistic *UI* (patch-then-reconcile) is separate from optimistic
*concurrency* (rejecting stale writes). The controller handles the UI; you
enforce concurrency on the server by carrying a version token - a `version`
counter or an `updatedAt` timestamp - and rejecting a write whose token no
longer matches the current row.

```ts
async updateRow(id, patch) {
  const res = await fetch(`/api/rows/${id}`, {
    method: 'PATCH',
    headers: { 'If-Match': String(patch.version) }, // the version the client last read
    body: JSON.stringify(patch),
  })
  if (res.status === 409) throw new Error('This row changed since you opened it - reload and retry.')
  if (!res.ok) throw new Error(await res.text())
  return res.json() // includes the new version
}
```

On the server, make the write conditional so a stale token updates nothing:

```sql
UPDATE rows SET status = $status, version = version + 1
WHERE id = $id AND version = $expectedVersion;   -- 0 rows affected => conflict, return 409
```

A `409` becomes a rejected promise, so in optimistic mode the local row rolls
back automatically and your `catch` shows the conflict. Return the fresh row
(with its new version) from a successful write so the next edit carries the
current token.

## See also

- [Server-Side Row Model](./server-row-model.md) - the datasource contract, request lifecycle, and race safety.
- [Server filtering](./server-filtering.md) - the read side: filter model, operators, and parameterized WHERE.
