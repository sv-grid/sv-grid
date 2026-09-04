<script lang="ts">
  // Kanban board rendering is an Enterprise feature - register the renderer.
  import { enableBoardView } from "@svgrid/enterprise";
  enableBoardView();
  /**
   * 346. Large board (per-lane virtualization)
   * ------------------------------------------
   * Thousands of cards per lane, kept smooth with `board.virtualized` - only
   * the cards in view are ever in the DOM. Drag the slider to change the card
   * count; drag-and-drop and keyboard move still work across the whole window.
   */
  import { SvGrid, tableFeatures, rowSortingFeature, type ColumnDef, type BoardCardMoveEvent } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })
  let view = $state<'board' | 'table'>('board')

  type Item = { id: number; title: string; status: string; area: string }

  const LANES = ['backlog', 'active', 'blocked', 'done'] as const
  const AREAS = ['api', 'ui', 'infra', 'docs', 'perf']

  let count = $state(4000)
  let rows = $state<Item[]>([])

  function build(n: number): Item[] {
    const out: Item[] = new Array(n)
    for (let i = 0; i < n; i += 1) {
      out[i] = {
        id: i + 1,
        title: `${AREAS[i % AREAS.length].toUpperCase()}-${i + 1}: task ${i + 1}`,
        status: LANES[i % LANES.length],
        area: AREAS[i % AREAS.length],
      }
    }
    return out
  }
  // Seed + rebuild whenever the count changes.
  $effect(() => {
    rows = build(count)
  })

  const columns: ColumnDef<any, Item>[] = [
    { field: 'title', header: 'Task' },
    { field: 'area', header: 'Area' },
    { field: 'status', header: 'Status' },
  ]

  const lanes = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'active', title: 'Active', color: '#3b82f6' },
    { id: 'blocked', title: 'Blocked', color: '#ef4444' },
    { id: 'done', title: 'Done', color: '#22c55e' },
  ]

  const fmt = new Intl.NumberFormat('en-US')

  function onCardMove(e: BoardCardMoveEvent<Item>) {
    e.row.status = e.toLane
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex items-center justify-between gap-3 shrink-0 flex-wrap">
    <div class="text-sm kb-note">
      The same <strong>&lt;SvGrid&gt;</strong>, two views: <strong>{fmt.format(rows.length)}</strong>
      cards virtualized as a board, or the same rows virtualized as a table.
    </div>
    <div class="flex items-center gap-3 shrink-0">
      <div class="inline-flex rounded-md border overflow-hidden text-sm kb-switch">
        <button class="px-3 py-1 kb-tab {view === 'board' ? 'kb-tab-on' : ''}"
          onclick={() => (view = 'board')}>Board</button>
        <button class="px-3 py-1 kb-tab {view === 'table' ? 'kb-tab-on' : ''}"
          onclick={() => (view = 'table')}>Table</button>
      </div>
      <label class="flex items-center gap-2 text-sm">
        Cards:
        <input type="range" min="1000" max="50000" step="1000" bind:value={count} />
        <span class="tabular-nums w-16 text-right">{fmt.format(count)}</span>
      </label>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if view === 'board'}
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        board={{
          groupBy: 'status',
          lanes,
          virtualized: true,
          cardHeight: 64,
          laneSummary: (list) => fmt.format(list.length),
          onCardMove,
        }}
      />
    {:else}
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        getRowId={(r) => String(r.id)}
        sortable
        rowHeight={34}
        containerHeight="100%"
        fitColumns
      />
    {/if}
  </div>

  <footer class="text-sm shrink-0 kb-foot">
    ~{fmt.format(Math.round(rows.length / lanes.length))} cards per lane · a few dozen DOM nodes.
  </footer>
</section>

<style>
  /* Toolbar chrome follows the active grid theme via --sg-* tokens.
     Lane colours stay fixed - they identify the lane, not the theme. */
  .kb-note { color: var(--sg-fg, #475569); }
  .kb-foot { color: var(--sg-muted, #64748b); }
  .kb-switch { border-color: var(--sg-border, #cbd5e1); }
  .kb-tab {
    background: transparent;
    color: var(--sg-fg, inherit);
  }
  .kb-tab:not(.kb-tab-on):hover { background: var(--sg-row-hover-bg, transparent); }
  .kb-tab-on {
    background: var(--sg-accent, #1e293b);
    color: var(--sg-on-accent, #ffffff);
  }
</style>
