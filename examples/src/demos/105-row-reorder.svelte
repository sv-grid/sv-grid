<script lang="ts">
  /**
   * 105. Row reorder (drag rows)
   * ----------------------------
   * A priority queue: drag the ⋮⋮ handle column to move rows up or down.
   * Multi-select aware - check several rows first, then drag the handle
   * of any of them; the whole selection moves as a block.
   *
   * Like the column-reorder demo (104), this is pure user-land. We
   * delegate dragstart on the handle cell, dragover on rows to compute
   * the insertion index, and drop to mutate the data array. The grid
   * picks up the new order automatically.
   *
   * Auto-scroll triggers when the pointer is within 60 px of the
   * scroll-container's top or bottom edge during a drag - the row keeps
   * tracking even if the target is off-screen.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Task = {
    id: string
    rank: number
    title: string
    owner: string
    severity: 'sev1' | 'sev2' | 'sev3'
    eta: string
    impact: 'critical' | 'high' | 'medium' | 'low'
    points: number
  }

  let tasks = $state<Task[]>([
    { id: 'INC-9001', rank: 1, title: 'Mitigate payment-rail outage (Stripe)',  owner: 'Ada Lovelace',     severity: 'sev1', eta: '2h',  impact: 'critical', points: 13 },
    { id: 'INC-9002', rank: 2, title: 'Roll back broken K8s controller release', owner: 'Linus Torvalds',   severity: 'sev1', eta: '1h',  impact: 'critical', points:  8 },
    { id: 'INC-9003', rank: 3, title: 'Investigate elevated 5xx on /checkout',   owner: 'Grace Hopper',     severity: 'sev2', eta: '4h',  impact: 'high',     points:  5 },
    { id: 'INC-9004', rank: 4, title: 'Audit log lag - 8 minutes behind realtime',owner: 'Margaret Hamilton',severity: 'sev2', eta: '6h',  impact: 'high',     points:  3 },
    { id: 'INC-9005', rank: 5, title: 'Search relevance regression (NSFW filter)', owner: 'Yuki Tanaka',    severity: 'sev2', eta: '8h',  impact: 'high',     points:  5 },
    { id: 'INC-9006', rank: 6, title: 'Customer reports broken CSV export',      owner: 'Tim Berners-Lee',  severity: 'sev3', eta: '1d',  impact: 'medium',   points:  2 },
    { id: 'INC-9007', rank: 7, title: 'PagerDuty noisy alerts - tune thresholds', owner: 'Sven Andersson',  severity: 'sev3', eta: '2d',  impact: 'medium',   points:  3 },
    { id: 'INC-9008', rank: 8, title: 'Dashboard slow on Safari (long-tap menu)', owner: 'Mira Sato',       severity: 'sev3', eta: '3d',  impact: 'medium',   points:  3 },
    { id: 'INC-9009', rank: 9, title: 'Translate empty-states (de, fr, ja)',     owner: 'Jordan Wells',    severity: 'sev3', eta: '1w',  impact: 'low',      points:  2 },
    { id: 'INC-9010', rank: 10,title: 'Document Pro license API in /docs',       owner: 'Linda Petersen',  severity: 'sev3', eta: '1w',  impact: 'low',      points:  2 },
    { id: 'INC-9011', rank: 11,title: 'Add accessibility audit to CI',           owner: 'Ada Iyer',        severity: 'sev3', eta: '2w',  impact: 'low',      points:  5 },
    { id: 'INC-9012', rank: 12,title: 'Refactor billing email templates',        owner: 'Ada Lovelace',    severity: 'sev3', eta: '2w',  impact: 'low',      points:  3 },
  ])

  /** Renumber ranks 1..N after any reorder so the rank column stays
   *  consistent with the visible order. */
  function renumber() { tasks = tasks.map((t, i) => ({ ...t, rank: i + 1 })) }

  // ---- Selection (handled in-demo to support multi-row drag) -----------
  let checked = $state<Set<string>>(new Set())
  function toggle(id: string) {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id); else next.add(id)
    checked = next
  }
  function clearChecked() { checked = new Set() }
  const allChecked = $derived(checked.size === tasks.length)

  // ---- Drag state ------------------------------------------------------
  let dragging = $state<string[] | null>(null)   // task ids being dragged (1 or N)
  let dropIndex = $state<number | null>(null)
  let dragRowEl = $state<HTMLElement | null>(null)
  let gridHost = $state<HTMLElement | null>(null)
  let scrollContainer: HTMLElement | null = null

  function startDrag(taskId: string, e: DragEvent) {
    const ids = checked.has(taskId) && checked.size > 1
      ? tasks.filter((t) => checked.has(t.id)).map((t) => t.id)
      : [taskId]
    dragging = ids
    e.dataTransfer?.setData('text/plain', ids.join(','))
    e.dataTransfer!.effectAllowed = 'move'
  }
  function endDrag() {
    dragging = null
    dropIndex = null
    dragRowEl = null
  }

  // dragover delegated on the host: find the row under the cursor.
  function onHostDragOver(e: DragEvent) {
    if (!dragging) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'

    // Auto-scroll near edges
    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect()
      const edge = 60
      if (e.clientY < rect.top + edge)    scrollContainer.scrollTop -= 12
      if (e.clientY > rect.bottom - edge) scrollContainer.scrollTop += 12
    }

    const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>('td[data-svgrid-row]')
    if (!cell) return
    const idx = Number(cell.dataset.svgridRow)
    if (!Number.isFinite(idx)) return
    const rowRect = cell.getBoundingClientRect()
    const top = e.clientY < rowRect.top + rowRect.height / 2
    dropIndex = top ? idx : idx + 1
    dragRowEl = cell.parentElement as HTMLElement
  }

  function onHostDrop(e: DragEvent) {
    e.preventDefault()
    if (!dragging || dropIndex == null) { endDrag(); return }
    const ids = dragging
    let target = dropIndex
    // Build the new array: pull out dragged rows in their original order,
    // then splice into the target position (accounting for indices that
    // shift left when we remove items before the target).
    const moving = ids.map((id) => tasks.findIndex((t) => t.id === id)).filter((i) => i >= 0).sort((a, b) => a - b)
    const movingRows = moving.map((i) => tasks[i]!)
    // How many of the moving rows are above the target index? Decrement
    // target by that count since they'll be removed first.
    const removedAbove = moving.filter((i) => i < target).length
    target -= removedAbove
    const remaining = tasks.filter((_, i) => !moving.includes(i))
    remaining.splice(target, 0, ...movingRows)
    tasks = remaining
    renumber()
    endDrag()
  }

  // Track the scroll-container for auto-scroll. Same pattern as demo 33.
  $effect(() => {
    if (!gridHost) return
    let cancelled = false
    function find() {
      if (cancelled) return
      const el = gridHost!.querySelector<HTMLElement>('.sv-grid-container')
      if (el) { scrollContainer = el; return }
      requestAnimationFrame(find)
    }
    find()
    return () => { cancelled = true; scrollContainer = null }
  })

  // ---- Toolbar actions ------------------------------------------------
  function moveSelected(by: -1 | 1) {
    const ids = Array.from(checked)
    if (ids.length === 0) return
    const positions = ids.map((id) => tasks.findIndex((t) => t.id === id)).sort((a, b) => by === -1 ? a - b : b - a)
    const next = tasks.slice()
    for (const i of positions) {
      const j = i + by
      if (j < 0 || j >= next.length) continue
      const tmp = next[i]!; next[i] = next[j]!; next[j] = tmp
    }
    tasks = next
    renumber()
  }

  // ---- Cell renderers --------------------------------------------------
  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Task>[] = [
    {
      id: 'handle', header: '', width: 36, editable: false,
      cell: (ctx) => renderSnippet(HandleCell, { taskId: ctx.row.original.id, checked: checked.has(ctx.row.original.id) }),
    },
    { field: 'rank',     header: '#',         width:  60, align: 'right', editable: false },
    { field: 'id',       header: 'Incident',  width: 110, editable: false },
    { field: 'title',    header: 'Title',     width: 380, editable: false },
    { field: 'owner',    header: 'Owner',     width: 160, editable: false },
    { field: 'severity', header: 'Severity',  width: 100, editable: false,
      cellClass: (ctx) => `sev-${ctx.getValue()}` },
    { field: 'impact',   header: 'Impact',    width: 120, editable: false,
      cellClass: (ctx) => `imp-${ctx.getValue()}` },
    { field: 'eta',      header: 'ETA',       width:  80, editable: false },
    { field: 'points',   header: 'Pts',       width:  70, align: 'right', editable: false },
  ]
</script>

{#snippet HandleCell(props: { taskId: string; checked: boolean })}
  <span class="hcell">
    <input class="cbx" type="checkbox" aria-label="Select row"
      checked={props.checked}
      onchange={() => toggle(props.taskId)}
      onclick={(e) => e.stopPropagation()} />
    <span class="grip" aria-hidden="true"
      draggable="true"
      ondragstart={(e) => startDrag(props.taskId, e)}
      ondragend={endDrag}
      title="Drag to reorder">⋮⋮</span>
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="toolbar shrink-0">
    <div class="tb-info">
      Drag the <span class="grip-inline">⋮⋮</span> handle to reorder.
      {#if checked.size > 1}
        <strong>{checked.size} rows selected</strong> - drag any handle to move the whole block.
      {:else if checked.size === 1}
        1 row selected. Check more to drag as a block.
      {:else}
        Tip: check multiple rows first to drag them together.
      {/if}
    </div>
    <div class="tb-actions">
      <button class="tb-btn" onclick={() => moveSelected(-1)} disabled={checked.size === 0}>↑ Move up</button>
      <button class="tb-btn" onclick={() => moveSelected( 1)} disabled={checked.size === 0}>↓ Move down</button>
      <button class="tb-btn alt" onclick={clearChecked} disabled={checked.size === 0}>Clear ({checked.size})</button>
    </div>
  </div>

  <div class="grid-host flex-1 min-h-0"
    bind:this={gridHost}
    ondragover={onHostDragOver}
    ondrop={onHostDrop}
    role="presentation"
  >
    <SvGrid responsive={true}
      data={tasks}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />

    {#if dragging && dropIndex !== null && dragRowEl}
      {@const rect = dragRowEl.getBoundingClientRect()}
      {@const hostRect = gridHost!.getBoundingClientRect()}
      <div class="drop-line"
        style:top={`${rect.top - hostRect.top + (dropIndex > Number(dragRowEl.dataset.svgridRow ?? -1) ? rect.height : 0) - 1}px`}
        style:left={`${rect.left - hostRect.left}px`}
        style:width={`${rect.width}px`}
        aria-hidden="true"></div>
    {/if}
  </div>
</section>

<style>
  .toolbar {
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 14px;
  }
  .tb-info { flex: 1; min-width: 280px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .tb-info strong { color: var(--sg-accent, #6366f1); }
  .grip-inline {
    font-weight: 800; color: var(--sg-accent, #6366f1);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 10%, transparent);
    padding: 1px 6px; border-radius: 3px; font-family: ui-monospace, monospace;
  }
  .tb-actions { display: flex; gap: 6px; }
  .tb-btn {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border: 0; border-radius: 6px; padding: 6px 12px;
    font-size: 12.5px; font-weight: 700; cursor: pointer;
  }
  .tb-btn.alt {
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .tb-btn:hover { filter: brightness(1.08); }
  .tb-btn:disabled { opacity: 0.4; cursor: default; filter: grayscale(1); }

  .grid-host { position: relative; }

  /* Handle column ------------------------------------------------- */
  :global(.hcell) {
    display: inline-flex; align-items: center; gap: 6px;
  }
  :global(.cbx) { width: 13px; height: 13px; accent-color: var(--sg-accent, #6366f1); cursor: pointer; }
  :global(.grip) {
    cursor: grab; user-select: none;
    color: var(--sg-muted, #94a3b8);
    font-family: ui-monospace, monospace;
    font-weight: 800; font-size: 14px;
    padding: 0 4px;
  }
  :global(.grip:hover) { color: var(--sg-accent, #6366f1); }
  :global(.grip:active) { cursor: grabbing; }

  .drop-line {
    position: absolute; height: 3px;
    background: var(--sg-accent, #6366f1);
    border-radius: 2px;
    box-shadow: 0 0 8px var(--sg-accent, #6366f1);
    pointer-events: none;
    z-index: 50;
  }

  /* Severity / impact ------------------------------------------- */
  :global(td.sev-sev1) { color: #dc2626; font-weight: 800; }
  :global(td.sev-sev2) { color: #f59e0b; font-weight: 700; }
  :global(td.sev-sev3) { color: var(--sg-muted, #64748b); }
  :global(td.imp-critical) { color: #b91c1c; font-weight: 800; }
  :global(td.imp-high)     { color: #c2410c; font-weight: 700; }
  :global(td.imp-medium)   { color: #d97706; }
  :global(td.imp-low)      { color: var(--sg-muted, #64748b); }
</style>
