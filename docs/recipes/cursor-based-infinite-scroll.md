# Cursor-based infinite scroll

Sparse-load a 100k-row audit log without paginating. Pattern:
debounce on scroll, fetch the next chunk by cursor, splice into
`$state`.

```svelte
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'

  type Event = { id: string; ts: string; actor: string; action: string }
  let rows = $state<Event[]>([])
  let cursor = $state<string | null>(null)
  let loading = $state(false)
  let exhausted = $state(false)

  async function loadMore() {
    if (loading || exhausted) return
    loading = true
    try {
      const r = await fetch(`/api/events?cursor=${cursor ?? ''}&limit=200`)
      const { items, next } = await r.json() as { items: Event[]; next: string | null }
      rows = [...rows, ...items]
      cursor = next
      if (!next || items.length === 0) exhausted = true
    } finally {
      loading = false
    }
  }

  $effect(() => { void loadMore() })

  /** Wire the wrapper's scroll container to trigger near the end. */
  function onScroll(el: HTMLElement) {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) loadMore()
  }
</script>

<div onscroll={(e) => onScroll(e.currentTarget as HTMLElement)}
     style="height: 100%; overflow: auto;">
  <SvGrid data={rows} columns={columns} features={features}
    showPagination={false} virtualization={true} containerHeight="100%" />
  {#if loading}<p>Loading more…</p>{/if}
  {#if exhausted}<p>End of log.</p>{/if}
</div>
```

## Why cursor + not page number

For append-only logs (audit, time-series), page numbers shift
underneath you as new events arrive. Cursor (server-issued opaque
token) is stable.

## Cancellation

When the user filters mid-scroll, abort the in-flight fetch:

```ts
let controller: AbortController | null = null

async function loadMore() {
  controller?.abort()
  controller = new AbortController()
  const r = await fetch(`...`, { signal: controller.signal })
  ...
}
```

## See also

- [Demo 33 (Server-side infinite scroll)](https://svgrid.com/demos/33-server-infinite/) - live
- [Server-side data](../help/server-side-data.md) - the full pattern catalog
- [Real-time / streaming](../help/real-time.md) - if events arrive PUSHED instead of PULLED
