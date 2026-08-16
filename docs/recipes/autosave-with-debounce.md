# Auto-save edits with debounce

Persist every cell edit to the server, debounced so a fast typer
generates one save, not twenty.

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  type Patch = { rowId: string; columnId: string; value: unknown }
  let pending = new Map<string, Patch>()  // dedupe per (rowId, columnId)
  let flushTimer: number | null = null

  function queue(rowId: string, columnId: string, value: unknown) {
    pending.set(`${rowId}::${columnId}`, { rowId, columnId, value })
    if (flushTimer !== null) clearTimeout(flushTimer)
    flushTimer = window.setTimeout(flush, 600)
  }

  async function flush() {
    flushTimer = null
    if (pending.size === 0) return
    const batch = [...pending.values()]
    pending.clear()
    try {
      await fetch('/api/patch', {
        method: 'POST',
        body: JSON.stringify({ patches: batch }),
      })
    } catch {
      // Re-enqueue on failure for next flush.
      for (const p of batch) pending.set(`${p.rowId}::${p.columnId}`, p)
    }
  }
</script>

<svelte:window onbeforeunload={flush} />

<SvGrid
  {data} {columns} features={features}
  onCellValueChange={(e) => queue(e.row.id, e.columnId, e.newValue)}
/>
```

Three details that make this production-grade:

- **Dedupe**. The map key collapses repeated edits to the same cell - only the latest value ships.
- **`beforeunload` flush**. Tab close before debounce fires? Still flushes.
- **Re-enqueue on failure**. Network blip is harmless; retries next tick.

For a more elaborate version with undo / redo, see
[demo 55 (State maintenance)](https://svgrid.com/demos/55-state-maintenance/).

## See also

- [Observability](../help/observability.md) - same callback, different sink
- [Demo 24 (Validation while editing)](https://svgrid.com/demos/24-validation/) - reject-and-rollback on validation failure
