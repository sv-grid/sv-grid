# Named views

A "view" is a saved snapshot of the grid's state - sort, filters, column
order/width/visibility, page, grouping. Named views let a user save the layout
they like and switch between them. SvGrid ships this as a small manager over
the grid's `getState()` / `setState()`, with pluggable storage.

```svelte
<script lang="ts">
  import { SvGrid, createNamedViews, localStorageViews, type SvGridApi } from 'sv-grid-community'

  let views: ReturnType<typeof createNamedViews> | null = null

  function onApiReady(api: SvGridApi<F, Row>) {
    views = createNamedViews(api, { storage: localStorageViews('my-grid-views') })
  }
</script>

<SvGrid {data} {columns} {features} onApiReady={onApiReady} />

<button onclick={() => views?.save('Top earners')}>Save</button>
<button onclick={() => views?.load('Top earners')}>Restore</button>
```

## The manager API

`createNamedViews(api, { storage })` returns:

| Method            | Does                                                       |
| ----------------- | ---------------------------------------------------------- |
| `list()`          | All saved views, oldest first.                             |
| `save(name)`      | Capture the current state under `name` (overwrites a dup). |
| `load(name)`      | Apply a saved view. Returns `false` if unknown.            |
| `remove(name)`    | Delete a view. Returns `false` if unknown.                 |
| `rename(a, b)`    | Rename, unless `b` already exists.                         |
| `has(name)`       | Whether a view exists.                                     |

It's pure and synchronous - all persistence goes through the storage adapter.

## Storage adapters

- **`localStorageViews(key)`** - persists per browser. SSR-safe (no-ops when
  `localStorage` is unavailable).
- **`memoryViews()`** - in-memory only (the default if you pass no storage).
- **Custom** - implement `ViewStorage` (`read()` / `write(views)`) to sync
  views to a server or a per-user account:

```ts
const serverStorage: ViewStorage = {
  read: () => cachedViews,
  write: (views) => { cachedViews = views; fetch('/api/views', { method: 'PUT', body: JSON.stringify(views) }) },
}
createNamedViews(api, { storage: serverStorage })
```

## Notes

- A view stores whatever `api.getState()` returns; restoring calls
  `api.setState(view.state)`, which applies only the keys present.
- This is the building block; the demo wires a simple save-box + chips UI on
  top, but the manager is headless so you can render views however you like.

See the live [Named views](https://sv-grid.com/demos/143-named-views) demo.
