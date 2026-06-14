<!-- Documented in: docs/help/collaboration.md -->
<script lang="ts">
  /**
   * 149. Real-time collaboration
   * ----------------------------
   * Presence (who's here + where their cursor is) and live edits (a change in
   * one client lands in every other), over a pluggable transport.
   *
   *   const collab = createCollaboration({
   *     user, transport: broadcastChannelTransport('my-grid'),
   *     onPeersChange: (peers) => ...,   // render avatars / cursors
   *     onRemoteEdit: ({ rowId, columnId, value }) => ...,  // apply it
   *   })
   *
   * OPEN THIS DEMO IN TWO TABS - edits and cursors sync live between them
   * with zero backend (BroadcastChannel). Swap the transport for a WebSocket
   * to go cross-machine.
   */
  import {
    SvGrid,
    createCollaboration,
    broadcastChannelTransport,
    tableFeatures,
    type ColumnDef,
    type CellContext,
    type CollabPresence,
  } from 'sv-grid-community'

  const features = tableFeatures({})

  type Row = { id: string; task: string; owner: string; status: string; estimate: number }
  let data = $state<Row[]>([
    { id: 't1', task: 'Design tokens', owner: 'Ada', status: 'In progress', estimate: 5 },
    { id: 't2', task: 'Virtualizer', owner: 'Linus', status: 'Done', estimate: 8 },
    { id: 't3', task: 'Filter menu', owner: 'Grace', status: 'In progress', estimate: 3 },
    { id: 't4', task: 'Pivot engine', owner: 'Alan', status: 'Todo', estimate: 13 },
    { id: 't5', task: 'Export to Excel', owner: 'Margaret', status: 'Review', estimate: 5 },
    { id: 't6', task: 'A11y audit', owner: 'Donald', status: 'Todo', estimate: 8 },
  ])

  // Flash a cell green when a remote user edits it. `cellClass` is a per-
  // column option; this shared callback keys off the live `flashes` map.
  function flashClass(ctx: CellContext<Row>) {
    return flashes[`${ctx.row.id}:${ctx.column.id}`] ? 'collab-flash' : ''
  }

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'task', header: 'Task', width: 200, editorType: 'text', cellClass: flashClass },
    { field: 'owner', header: 'Owner', width: 130, editorType: 'text', cellClass: flashClass },
    {
      field: 'status',
      header: 'Status',
      width: 150,
      editorType: 'list',
      editorOptions: ['Todo', 'In progress', 'Review', 'Done'],
      cellClass: flashClass,
    },
    { field: 'estimate', header: 'Estimate', width: 120, align: 'right', editorType: 'number', cellClass: flashClass },
  ]

  // A random identity per tab.
  const COLORS = ['#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899']
  const NAMES = ['Otter', 'Falcon', 'Bison', 'Lynx', 'Heron', 'Wolf']
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!
  const me = { id: Math.random().toString(36).slice(2), name: pick(NAMES), color: pick(COLORS) }

  let peers = $state<CollabPresence[]>([])
  let flashes = $state<Record<string, number>>({})
  let gridWrap = $state<HTMLElement | null>(null)

  const collab = createCollaboration({
    user: me,
    transport: broadcastChannelTransport('sv-grid-collab-demo'),
    onPeersChange: (p) => (peers = p),
    onRemoteEdit: ({ rowId, columnId, value }) => {
      const i = data.findIndex((r) => r.id === rowId)
      if (i < 0) return
      ;(data[i] as Record<string, unknown>)[columnId] = value
      const key = `${rowId}:${columnId}`
      flashes = { ...flashes, [key]: Date.now() }
      setTimeout(() => {
        const next = { ...flashes }
        delete next[key]
        flashes = next
      }, 1000)
    },
  })
  $effect(() => () => collab.dispose())

  // Recompute remote-cursor overlay boxes from the live cell DOM.
  let cursorBoxes = $state<Array<{ left: number; top: number; w: number; h: number; color: string; name: string }>>([])
  $effect(() => {
    void peers
    let raf = 0
    const recompute = () => {
      if (!gridWrap) return
      const wrap = gridWrap.getBoundingClientRect()
      const boxes: typeof cursorBoxes = []
      for (const p of peers) {
        if (!p.cell) continue
        const i = data.findIndex((r) => r.id === p.cell!.rowId)
        if (i < 0) continue
        const cell = gridWrap.querySelector<HTMLElement>(
          `[data-svgrid-row="${i}"][data-col-id="${p.cell.columnId}"]`,
        )
        if (!cell) continue
        const b = cell.getBoundingClientRect()
        boxes.push({ left: b.left - wrap.left, top: b.top - wrap.top, w: b.width, h: b.height, color: p.color, name: p.name })
      }
      cursorBoxes = boxes
      raf = requestAnimationFrame(recompute)
    }
    raf = requestAnimationFrame(recompute)
    return () => cancelAnimationFrame(raf)
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-semibold" style="color: var(--sg-fg);">
        Live presence + edits via <code>createCollaboration</code>
      </p>
      <div class="flex items-center gap-1.5">
        <span class="collab-avatar" style={`background:${me.color}`} title={`${me.name} (you)`}>{me.name[0]}</span>
        {#each peers as p (p.id)}
          <span class="collab-avatar" style={`background:${p.color}`} title={p.name}>{p.name[0]}</span>
        {/each}
        <span class="ml-2 text-xs" style="color: var(--sg-muted);">
          {peers.length + 1} here
        </span>
      </div>
    </div>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      You are <strong style={`color:${me.color}`}>{me.name}</strong>. Open this
      demo in a second tab - cursors and edits sync live (BroadcastChannel, no
      backend). Double-click a cell to edit.
    </p>
  </div>

  <div class="flex-1 min-h-0 relative" bind:this={gridWrap}>
    <SvGrid
      data={data}
      columns={columns}
      features={features}
      editable
      enableCellSelection
      selectionMode="cell"
      enableRowSummaries={false}
      getRowId={(r) => r.id}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
      onActiveCellChange={(c) => {
        const row = data[c.rowIndex]
        collab.setCell(row ? { rowId: row.id, columnId: c.columnId } : null)
      }}
      onCellValueChange={(e) => {
        const row = data[e.rowIndex]
        if (row) collab.sendEdit(row.id, e.columnId, e.newValue)
      }}
    />
    {#each cursorBoxes as box (box.name + box.left + box.top)}
      <div
        class="collab-cursor"
        style={`left:${box.left}px; top:${box.top}px; width:${box.w}px; height:${box.h}px; --c:${box.color}`}
      >
        <span class="collab-cursor-tag" style={`background:${box.color}`}>{box.name}</span>
      </div>
    {/each}
  </div>
</section>

<style>
  .collab-avatar {
    width: 24px; height: 24px;
    border-radius: 50%;
    color: #fff;
    font-size: 12px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 2px var(--sg-bg, #fff);
  }
  .collab-cursor {
    position: absolute;
    z-index: 15;
    pointer-events: none;
    border: 2px solid var(--c);
    border-radius: 3px;
    box-shadow: 0 0 0 1px var(--c);
  }
  .collab-cursor-tag {
    position: absolute;
    top: -16px; left: -2px;
    font-size: 10px; font-weight: 700;
    color: #fff;
    padding: 0 5px;
    border-radius: 3px;
    white-space: nowrap;
  }
  :global(.sv-grid-cell.collab-flash) {
    animation: collab-flash 1s ease-out;
  }
  @keyframes collab-flash {
    0% { background: rgba(34, 197, 94, 0.5) !important; }
    100% { background: transparent; }
  }
</style>
