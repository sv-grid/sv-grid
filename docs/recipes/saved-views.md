# Saved views (localStorage)

Per-user grid layouts. Each "view" snapshots column widths, pinning,
sort, filter, page index, and (optionally) grouping. Switching views
restores the snapshot.

```svelte
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'

  type View = {
    name: string
    widths:  Record<string, number>
    pinning: { left: string[]; right: string[] }
    sort:    Array<{ id: string; desc: boolean }>
    filters: Record<string, { operator: string; value: string; valueTo?: string }>
  }

  const KEY = 'svgrid:views'
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let views = $state<View[]>(JSON.parse(localStorage.getItem(KEY) ?? '[]'))

  function save(name: string) {
    if (!api) return
    const v: View = {
      name,
      widths:  api.getColumnWidths(),
      pinning: api.getColumnPinning(),
      sort:    [], // hook into your sort state
      filters: api.getFilters(),
    }
    views = [...views.filter((x) => x.name !== name), v]
    localStorage.setItem(KEY, JSON.stringify(views))
  }

  function load(v: View) {
    if (!api) return
    for (const [id, w] of Object.entries(v.widths)) api.setColumnWidth(id, w)
    api.setColumnPinning(v.pinning)
    for (const [id, f] of Object.entries(v.filters)) api.setFilter(id, f as never)
  }
</script>

<div class="view-bar">
  {#each views as v (v.name)}
    <button onclick={() => load(v)}>{v.name}</button>
  {/each}
  <button onclick={() => save(prompt('Name?') ?? 'View')}>Save current</button>
</div>

<SvGrid data={rows} columns={columns} features={features}
  onApiReady={(next) => (api = next)} />
```

## GDPR / HIPAA tip

The snapshot stores column STATE only - never row VALUES. If you
were to save `api.getDisplayedRows()` you'd land row data in
localStorage; don't. See [GDPR + data residency](../compliance/gdpr.md).

## See also

- [Demo 63 (Column layout API)](https://svgrid.com/demos/63-column-layout-api/) - live
- [State maintenance](../help/state-maintenance.md) - undo/redo + bookmarks + JSON IO
- [Persist column layout to URL](./persist-column-layout-to-url.md) - shareable links
