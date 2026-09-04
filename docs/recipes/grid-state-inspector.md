# Grid state inspector

> Mount a dev-only side panel that shows the live grid state - filters,
> selection, active cell, column order, pinning, visibility - updated
> every animation frame. The thing every dev wishes was always-on while
> debugging.

## When

You're stuck on one of:

- "Why isn't this filter narrowing the rows? Is it even applied?"
- "Did the column reorder write into the api state?"
- "What rowIndex is the active cell - so I can verify my onCellClick handler?"
- "Selection looks broken - is it the api or the renderer?"

Sticking `console.log(api.getXxx())` everywhere works once. A panel
that polls every reader every frame answers all of these at once.

## The contract

The `SvGridApi` exposes a snapshot getter for every piece of public
state you might care about:

| Reader                  | What it returns                                           |
| ----------------------- | --------------------------------------------------------- |
| `getFilters()`          | Per-column operator-filter clauses                        |
| `getSelectedRowIds()`   | Array of row ids currently selected                       |
| `getSelected()`         | Cell selection ranges `[r0,c0,r1,c1][]`                   |
| `getActiveCell()`       | The focused cell, or null                                 |
| `getColumnOrder()`      | Column ids in current visual order                        |
| `getColumnPinning()`    | `{ left: [], right: [] }`                                 |
| `getColumns()`          | Every column with `id`, `header`, `visible`               |
| `getDisplayedRows()`    | The post-pipeline visible rows                            |
| `getData()`             | The pre-pipeline data array                               |

Sort state is *event-driven only* (`onSortingChange`) - there is no
`getSorting()` getter. The pattern below tracks it locally in the
panel to fill the gap.

## Implementation

```svelte {runnable}
<script lang="ts">
  import {
    SvGrid, tableFeatures,
    rowSortingFeature, columnFilteringFeature,
    rowSelectionFeature, rowExpandingFeature,
    type SvGridApi, type ColumnDef,
  } from '@svgrid/grid'

  type Row = { id: number; name: string; team: string; score: number; active: boolean }
  const rows: Row[] = [/* ... */]

  const features = tableFeatures({
    rowSortingFeature, columnFilteringFeature,
    rowSelectionFeature, rowExpandingFeature,
  })
  const columns: ColumnDef<typeof features, Row>[] = [/* ... */]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  type Snapshot = {
    filters: unknown
    selectedRowIds: unknown
    activeCell: unknown
    columnOrder: unknown
    columnPinning: unknown
    columns: unknown
    displayedRowCount: number
    cellSelection: unknown
  }
  let snap = $state<Snapshot | null>(null)
  let running = $state(true)

  // Track sort locally - the api has no getSorting() reader.
  let sortField = $state<string | null>(null)
  let sortDesc  = $state(false)

  $effect(() => {
    if (!running) return
    let raf = 0
    function tick() {
      if (api) {
        snap = {
          filters:           api.getFilters(),
          selectedRowIds:    api.getSelectedRowIds(),
          activeCell:        api.getActiveCell(),
          columnOrder:       api.getColumnOrder(),
          columnPinning:     api.getColumnPinning(),
          columns:           api.getColumns().map((c) => ({
            id: c.id, header: c.header, visible: c.visible,
          })),
          displayedRowCount: api.getDisplayedRows().length,
          cellSelection:     api.getSelected(),
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })

  // "Click a leaf to mutate it back" - quick mutators that drive the
  // grid api from the panel. Sort goes asc → desc → off.
  function flipSort(field: string) {
    if (!api) return
    if (sortField === field) {
      if (!sortDesc) { sortDesc = true; api.setSort(field, 'desc') }
      else { sortField = null; api.clearSort() }
    } else {
      sortField = field; sortDesc = false
      api.setSort(field, 'asc')
    }
  }
  function clearAll() {
    if (!api) return
    api.clearSort()
    api.clearAllFilters()
    sortField = null; sortDesc = false
  }
</script>

<button onclick={() => flipSort('score')}>Flip score sort</button>
<button onclick={clearAll}>Clear</button>
<button onclick={() => (running = !running)}>
  {running ? '⏸ Pause' : '▶ Resume'}
</button>

<SvGrid
  data={rows}
  {columns}
  {features}
  enableCellSelection
  onApiReady={(a) => (api = a)}
/>

<aside class="devtools">
  <h3>Grid state · live</h3>
  {#if snap}
    {#each Object.entries(snap) as [k, v] (k)}
      <section>
        <span class="key">{k}</span>
        <pre><code>{JSON.stringify(v, null, 2)}</code></pre>
      </section>
    {/each}
  {/if}
</aside>
```

## Polling vs subscribing

This recipe polls every frame for simplicity - 16ms cadence, no
subscriptions to manage. For most dev panels that's fine; the cost is
a few JSON.stringify calls per frame.

If you want event-driven instead, hook the grid's `on*` callbacks:

```ts
<SvGrid
  ...
  onSortingChange={(sorting) => log('sort', sorting)}
  onFiltersChange={(filters) => log('filter', filters)}
  onCellSelectionChange={(ranges) => log('cellsel', ranges)}
  onColumnOrderChange={(order) => log('colorder', order)}
/>
```

Event-driven catches every mutation without missing intermediate states
that polling might skip over. Polling catches state changes that don't
have a callback (e.g. the active cell moving via keyboard).

A real devtools panel combines both: poll on rAF for the current
snapshot, plus a separate event log seeded from the callbacks.

## Don't ship to production

Wrap behind an env flag:

```svelte
{#if import.meta.env.DEV || localStorage.getItem('svgrid:devtools') === 'on'}
  <Devtools />
{/if}
```

Polling every frame and serialising the whole snapshot is fine in dev,
unnecessary in prod.

## Demo

## See also

- [`SvGridApi` reference](../reference/SvGridApi.md) - every reader the panel calls
- [Profiling with a FPS HUD](./profiling-with-fps-hud.md) - the perf-focused twin
- [Headless engine reference](../reference/headless-engine.md) - skip the grid component entirely
