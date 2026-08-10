# Real-time (Supabase)

Make a Studio screen **live**: when a row is inserted, updated, or deleted in the
database - by another user, another tab, or a background job - the grid reflects
it instantly, with no polling. This uses [Supabase Realtime](https://supabase.com/docs/guides/realtime)
(Postgres change streams) and the `createSupabaseRealtime` helper.

![A Postgres change made by another user, tab, or job streams through Supabase Realtime into createSupabaseRealtime, and the grid reflects it instantly with no polling.](/docs-media/studio-realtime.svg)

> **Live demo:** the [Supabase demo](https://svgrid.com/#/demos/194-studio-supabase)
> is real-time out of the box - connect your table, then change a row in the
> Supabase dashboard and watch it flash in the grid. Toggle it with the
> **Live** pill.

---

## Step 1 - Enable Realtime on the table

Realtime is off per table until you add it to the `supabase_realtime`
publication. In the SQL editor:

```sql
alter publication supabase_realtime add table customers;
```

(Or in the dashboard: **Database → Publications → `supabase_realtime`** → enable
your table.) Row-Level Security still applies - a client only receives change
events for rows it is allowed to read.

## Step 2 - Subscribe

Because the grid shows a server-paged view, the correct reaction to a change is
to **refetch the current page** - that keeps the active sort, filter, and page
correct. `debounceMs` coalesces a burst of changes into a single refetch:

```ts
import { createSupabaseRealtime } from '@svgrid/enterprise'

const live = createSupabaseRealtime({
  client,                         // the same supabase-js client used for reads
  table: 'customers',
  debounceMs: 200,
  onChange: () => controller.refresh(),
})

// when the screen unmounts:
live.unsubscribe()
```

That is the whole integration. Sort, filter, and pagination keep working; the
page just stays current.

---

## React to individual changes

`onChange` receives a normalized event, so you can do more than refetch - for
example flash the row that changed. Use `debounceMs: 0` (the default) to see
every event:

```ts
let flash = $state<Set<string>>(new Set())

const live = createSupabaseRealtime<Customer>({
  client,
  table: 'customers',
  onChange: (change) => {
    // change.type: 'INSERT' | 'UPDATE' | 'DELETE'
    // change.new:  the row after the change (INSERT / UPDATE), else null
    // change.old:  its prior identity (UPDATE / DELETE), else null
    const id = change.new?.id ?? change.old?.id
    if (id != null) {
      flash = new Set(flash).add(String(id))
      setTimeout(() => { const n = new Set(flash); n.delete(String(id)); flash = n }, 1600)
    }
    controller.refresh()
  },
})
```

Then paint it via the grid's `rowClass`:

```svelte
<SvGrid ... rowClass={(ctx) => (flash.has(String(ctx.row.id)) ? 'row-flash' : '')} />

<style>
  :global(.sv-grid-row.row-flash td) { animation: flash 1.6s ease-out; }
  @keyframes flash { from { background: #16a34a55; } to { background: transparent; } }
</style>
```

---

## Options

| Option | Purpose |
| --- | --- |
| `client` | your `supabase-js` client (BYO - no dependency added) |
| `table` | the table to watch |
| `schema` | Postgres schema (default `'public'`) |
| `event` | `'INSERT'` \| `'UPDATE'` \| `'DELETE'` \| `'*'` (default `'*'`) |
| `filter` | PostgREST-style row filter, e.g. `'tier=eq.pro'` - only matching rows stream |
| `debounceMs` | coalesce bursts into one `onChange` (use for refetch) |
| `onStatus` | subscription status (`SUBSCRIBED`, `CHANNEL_ERROR`, ...) |
| `channelName` | override the channel name (default `svgrid:{schema}:{table}`) |

Filter to just the rows a screen cares about (fewer events, less refetching):

```ts
createSupabaseRealtime({ client, table: 'deals', filter: 'stage=eq.open', onChange: () => controller.refresh() })
```

---

## Notes

- **Always `unsubscribe()`** on unmount (in Svelte, from `onDestroy` or the
  effect cleanup) so channels don't leak.
- **RLS is enforced** on the stream: clients only receive events for rows their
  policies allow. Realtime is not a way around Row-Level Security.
- **Refetch vs. patch:** refetching on change is the safe default because the
  server owns ordering and paging. Patching rows in place locally is possible for
  a visible `UPDATE`, but an `INSERT` may or may not belong on the current page -
  so let `refresh()` decide.

---

## See also

- [Supabase](./supabase.md) - connect + `createSupabaseDataSource`
- [Data binding](./data-binding.md) - the `ServerDataSource` contract
- [Sorting, filtering & paging](./server-grid.md) - the grid's server-mode UI
