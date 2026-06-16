# Column state

"Column state" is the bag of per-column settings that change at runtime:
visibility, width, pinning, sort, filter. SvGrid keeps these as separate
state slices inside the grid instance.
<div data-docs-demo="55-state-maintenance" data-height="540"></div>

## Slices

| Slice | Where it lives | How to read | How to write |
| ----- | -------------- | ----------- | ------------ |
| Visibility | `<SvGrid>` internal | `api.isColumnVisible(id)` | `api.setColumnVisible(id, visible)` |
| Width | `<SvGrid>` internal (resize handles) | drag the right edge of a header | - |
| Pinning | `<SvGrid>` internal | via column menu | via column menu |
| Sort | `state.sorting` | `grid.getState().sorting` | `api.setSort(id, dir)` / `api.clearSort()` |
| Filter | `state.columnFilters` | `grid.getState().columnFilters` | `api.setFilter(id, ...)` / `api.clearFilter(id)` |

## Persisting state

To round-trip column state (e.g. through `localStorage` or the URL),
subscribe via the wrapper's change callbacks and re-apply on mount
through the imperative API:

```svelte
<script lang="ts">
  import type { SvGridApi } from '@svgrid/grid'

  const KEY = 'people-grid-state'

  function loadState() {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    catch { return {} }
  }
  const initial = loadState()

  let sorting = $state<Array<{ id: string; desc: boolean }>>(initial.sorting ?? [])
  let filters = $state<Array<{ id: string; operator: string; value: string }>>(
    initial.filters ?? [],
  )
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  $effect(() => {
    localStorage.setItem(KEY, JSON.stringify({ sorting, filters }))
  })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  onApiReady={(next) => {
    api = next
    // Re-apply saved state on first mount.
    for (const s of initial.sorting ?? []) api.setSort(s.id, s.desc ? 'desc' : 'asc')
    for (const f of initial.filters ?? []) api.setFilter(f.id, { operator: f.operator, value: f.value })
  }}
  onSortingChange={(next) => (sorting = next)}
  onFiltersChange={(next) => (filters = next.columns)}
/>
```

## Resetting state

There is no single "reset" API today. To revert:

- Sort: `api.clearSort()`
- Filters: iterate the active list and call `api.clearFilter(id)`
- Visibility: walk your columns and call `setColumnVisible(id, true)`

Wrap whichever subset you need into your own helper if you do this often.

## Gotchas

- Column **width** is currently tracked per column id inside the SvGrid
  component and is not exposed on `SvGridApi`. If you need to persist user
  resizes you'll have to read the cells after the grid renders or PR an
  accessor onto the API. See [missing-features.md](../missing-features.md).
- Column **pinning** is controlled by the column menu; there is no public
  setter on the API today. Same caveat as above.

## See also

- [Column moving](./column-moving.md)
- [Column pinning](./column-pinning.md)
- [Updating definitions](./updating-definitions.md)
