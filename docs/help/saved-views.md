# Saved views & layout persistence

The pattern for "user changes sort + filters + columns; reopens the
page next week; everything is where they left it." Powered entirely
by your own state - the grid never writes to storage on its own.

![Named-view chips act as a switcher; the active view captures sort, filters, columns, and grouping, then replays into the grid.](/docs-media/grid-saved-views.svg)

Live reference: a reporting workspace with named saved views in
localStorage:

<div data-docs-demo="36-reporting-workspace" data-height="540"></div>

## The shape

A "view" is everything the user can change about the grid that's not
the data itself:

```ts
type GridView = {
  /** Stable id for storage. */
  id: string
  /** Display name in the picker. */
  name: string
  /** Schema version - bump when you change the shape. */
  v: 1
  /** Column visibility, in their preferred order. */
  columns: Array<{ id: string; visible: boolean; width?: number; pinned?: 'left' | 'right' | null }>
  /** Sort spec. */
  sorting: Array<{ id: string; desc: boolean }>
  /** Column filters keyed by column id. */
  filters: Record<string, { operator: string; value: string }>
  /** Group-by columns in order. */
  groupBy: string[]
  /** Active page + page size. */
  pagination?: { page: number; pageSize: number }
  /** Density preset. */
  density?: 'compact' | 'comfortable' | 'spacious'
}
```

Two ground rules:

1. **Always carry a `v` field.** The schema WILL change. Reading an
   older view requires a migration; reading a newer view should fall
   back to defaults.
2. **Store column references by `id`, not array index.** Reordering
   the source columns shouldn't scramble saved views.

## Reading + writing

```ts
const STORAGE_KEY = 'my-app:grid:orders:v1'

function loadView(): GridView | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GridView
    if (parsed.v !== 1) return migrate(parsed)
    return parsed
  } catch {
    return null
  }
}

function saveView(view: GridView): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view))
  } catch {
    // Quota / private mode - swallow.
  }
}
```

Both are no-ops on the server (SSR safe).

## Wiring into the grid

The wrapper exposes change callbacks for the slices users actually
mutate (sort, filter, selection, cell edits). Sort + filter cover the
view-state most apps care about; re-apply on mount through the
imperative API.

```svelte
<script lang="ts">
  import type { SvGridApi } from '@svgrid/grid'

  let view = $state<GridView>(loadView() ?? defaultView())
  let api  = $state<SvGridApi<typeof features, Row> | null>(null)

  // Debounce writes so a flurry of input events doesn't hit localStorage 60x/s.
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function persist() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveView(view), 200)
  }
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  onApiReady={(next) => {
    api = next
    // Replay saved state into the fresh grid.
    if (view.groupBy?.length) api.setGroupBy(view.groupBy)
    for (const s of view.sorting ?? []) api.setSort(s.id, s.desc ? 'desc' : 'asc')
    for (const f of view.filters ?? []) api.setFilter(f.id, { operator: f.operator, value: f.value })
  }}
  onSortingChange={(s) => { view = { ...view, sorting: s }; persist() }}
  onFiltersChange={(next) => { view = { ...view, filters: next.columns }; persist() }}
/>
```

The debounced `persist()` keeps storage writes bounded; the in-memory
`view` updates immediately so the UI is responsive.

> Column width / pinning / visibility change events on the wrapper
> aren't shipped yet. Until they are, persist them only when the user
> hits an explicit "Save view" button (read the current widths from
> `getColumnWidths` once it lands - tracked in
> [Missing features](./missing-features.md)).

## Multiple named views

A view picker is just an array of `GridView`s with one marked active:

```ts
type SavedViews = {
  v: 1
  active: string                       // id of the current view
  views: GridView[]
}
```

UI:

```svelte
<select bind:value={saved.active} onchange={() => applyView(saved.views.find((v) => v.id === saved.active)!)}>
  {#each saved.views as v (v.id)}
    <option value={v.id}>{v.name}</option>
  {/each}
</select>
<button onclick={saveCurrentAsNew}>Save as new view</button>
<button onclick={deleteCurrent} disabled={saved.views.length <= 1}>Delete</button>
```

`applyView` calls the imperative API to push the saved values into
the grid:

```ts
function applyView(view: GridView) {
  if (!api) return
  api.clearAllFilters()
  api.clearSort()
  api.setGroupBy(view.groupBy)
  for (const s of view.sorting) api.setSort(s.id, s.desc ? 'desc' : 'asc')
  for (const [id, f] of Object.entries(view.filters)) api.setFilter(id, f)
  for (const c of view.columns) {
    api.setColumnVisible(c.id, c.visible)
    if (c.width) api.setColumnWidth?.(c.id, c.width)
  }
}
```

## Migrations

A `v: 1` → `v: 2` example: you renamed a field from
`'placedAt'` to `'placed_at'` and want the saved sort + filters to
follow.

```ts
function migrate(input: { v: number } & Record<string, unknown>): GridView {
  if (input.v === 1) {
    const v1 = input as GridView
    return {
      ...v1,
      v: 2,
      sorting: v1.sorting.map((s) => s.id === 'placedAt' ? { ...s, id: 'placed_at' } : s),
      filters: Object.fromEntries(
        Object.entries(v1.filters).map(([id, f]) =>
          id === 'placedAt' ? ['placed_at', f] : [id, f],
        ),
      ),
    } as unknown as GridView
  }
  // Unknown version → start fresh. Better than crashing on someone
  // who downgraded.
  return defaultView()
}
```

## Storage locations

| Storage          | Capacity   | When to use                                                                       |
| ---------------- | ---------- | --------------------------------------------------------------------------------- |
| `localStorage`   | ~5 MB / origin | Default. Per-browser; survives reloads + restarts; no expiry.                |
| `sessionStorage` | ~5 MB / tab | Per-tab views: when the user opens the same screen in two tabs and wants them independent. |
| Cookies          | ~4 KB      | Don't. Saved views grow.                                                          |
| Server / IndexedDB | unbounded | When the view should follow the user across machines (logged-in app).            |

For server-side persistence, replace the `saveView` body with a
`fetch('/api/views', { method: 'PUT', body: JSON.stringify(view) })`.
The pattern is otherwise unchanged.

## Sharing a view via URL

For "send me this view" sharing, encode the view in the URL hash:

```ts
function viewToHash(view: GridView): string {
  // btoa is fine for small payloads; for >2 KB views, use lz-string.
  return btoa(unescape(encodeURIComponent(JSON.stringify(view))))
}
function viewFromHash(hash: string): GridView | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(hash)))) as GridView
  } catch {
    return null
  }
}
```

A "Share" button copies `window.location.origin + '/orders#' +
viewToHash(view)`. The page hydrates from the hash on load and falls
back to the user's saved view if there isn't one.

## What NOT to save

- **Active cell / focus.** Restoring focus on load is jarring; users
  expect to land at the top.
- **Selection.** Same reason.
- **Live data filter state if the underlying rows change between
  visits.** A filter for "Region = EMEA" still works; a filter for
  `customerId = 12345` is broken if 12345 no longer exists.

## SSR + hydration

`localStorage` is undefined on the server. Guard the read in
`loadView()` (the snippet above already does). Defer the
`applyView()` call to `$effect` (or `onMount`) so the server-rendered
output isn't influenced by client-only state.

## See also

- [Architecture overview](./architecture.md) - which state lives
  where.
- [Recipes / Cookbook](./recipes.md) - the saved-views recipe uses
  this page's pattern.
- [Demo #36 Reporting workspace](https://svgrid.com/demos/36-reporting-workspace/)
  - end-to-end implementation.
