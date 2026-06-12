<script lang="ts">
  /**
   * 76. Kanban board + grid - one dataset, two views
   * ------------------------------------------------
   * A flat `tasks` $state array is the single source of truth. Render it
   * as a professional Kanban board (lanes of stacked cards, drag-to-move)
   * or as a <SvGrid> table - the SvGrid "same data, many views" story.
   *
   * Moving a card rewrites the task's `status`; every derived view
   * (lane buckets, counts, points, and the table) updates reactively.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'

  type Status = 'backlog' | 'in_progress' | 'review' | 'done'
  type Priority = 'low' | 'normal' | 'high' | 'urgent'
  type Task = {
    id: string
    title: string
    assignee: string
    priority: Priority
    points: number
    status: Status
  }

  const LANES: { id: Status; label: string; tint: string }[] = [
    { id: 'backlog',     label: 'Backlog',     tint: '#64748b' },
    { id: 'in_progress', label: 'In progress', tint: '#6366f1' },
    { id: 'review',      label: 'Review',      tint: '#f59e0b' },
    { id: 'done',        label: 'Done',        tint: '#10b981' },
  ]
  const LANE_ORDER: Status[] = LANES.map((l) => l.id)
  const STATUS_LABEL: Record<Status, string> = {
    backlog: 'Backlog', in_progress: 'In progress', review: 'Review', done: 'Done',
  }
  const STATUS_TINT: Record<Status, string> = {
    backlog: '#64748b', in_progress: '#6366f1', review: '#f59e0b', done: '#10b981',
  }

  let tasks = $state<Task[]>([
    { id: 'JIRA-001', title: 'Audit dashboard latency under 50k rows', assignee: 'Ada Lovelace',    priority: 'high',   points: 8,  status: 'backlog' },
    { id: 'JIRA-002', title: 'Migrate auth to passkeys',               assignee: 'Linus Torvalds',  priority: 'urgent', points: 13, status: 'backlog' },
    { id: 'JIRA-009', title: 'Bulk-edit confirm dialog',               assignee: 'Ada Iyer',        priority: 'normal', points: 3,  status: 'backlog' },
    { id: 'JIRA-011', title: 'Empty-state illustrations',              assignee: 'Noah Kim',        priority: 'low',    points: 2,  status: 'backlog' },
    { id: 'JIRA-003', title: 'Add column pinning to mobile',           assignee: 'Grace Hopper',    priority: 'normal', points: 5,  status: 'in_progress' },
    { id: 'JIRA-004', title: 'Internationalise empty-state copy',      assignee: 'Yuki Tanaka',     priority: 'low',    points: 3,  status: 'in_progress' },
    { id: 'JIRA-010', title: 'Right-click context menu polish',        assignee: 'Jordan Wells',    priority: 'low',    points: 2,  status: 'in_progress' },
    { id: 'JIRA-005', title: 'Performance pass on row virtualizer',    assignee: 'Sven Andersson',  priority: 'high',   points: 8,  status: 'review' },
    { id: 'JIRA-006', title: 'Document the SvGridApi surface',         assignee: 'Mira Sato',       priority: 'normal', points: 5,  status: 'review' },
    { id: 'JIRA-007', title: 'Wire export to design system',           assignee: 'Tim Berners-Lee', priority: 'normal', points: 5,  status: 'done' },
    { id: 'JIRA-008', title: 'Theming studio - dark variant',          assignee: 'Linda Petersen',  priority: 'low',    points: 2,  status: 'done' },
  ])

  let view = $state<'board' | 'table'>('board')

  // ---- Derived views -----------------------------------------------------
  const byLane = $derived.by(() => {
    const m: Record<Status, Task[]> = { backlog: [], in_progress: [], review: [], done: [] }
    for (const t of tasks) m[t.status].push(t)
    return m
  })
  const points = $derived.by(() => {
    const p: Record<Status, number> = { backlog: 0, in_progress: 0, review: 0, done: 0 }
    for (const t of tasks) p[t.status] += t.points
    return p
  })

  // ---- Moves -------------------------------------------------------------
  function setStatus(id: string, to: Status) {
    const t = tasks.find((x) => x.id === id)
    if (!t || t.status === to) return
    tasks = tasks.map((x) => (x.id === id ? { ...x, status: to } : x))
  }
  function shift(id: string, dir: -1 | 1) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const ni = LANE_ORDER.indexOf(t.status) + dir
    if (ni < 0 || ni >= LANE_ORDER.length) return
    setStatus(id, LANE_ORDER[ni]!)
  }

  let dragId = $state<string | null>(null)
  let overLane = $state<Status | null>(null)

  function initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  }
  function avatarColor(name: string): string {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
    return `hsl(${h} 55% 45%)`
  }

  // ---- Table view --------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const columns: ColumnDef<typeof features, Task>[] = [
    { field: 'id',       header: 'Key',      width: 110 },
    { field: 'title',    header: 'Title',    width: 300 },
    { field: 'assignee', header: 'Assignee', width: 170, cell: (c) => renderSnippet(AssigneeCell, { name: c.row.original.assignee }) },
    { field: 'priority', header: 'Priority', width: 110, cell: (c) => renderSnippet(PriPill, { p: c.row.original.priority }) },
    { field: 'points',   header: 'Points',   width: 90, align: 'right' },
    { field: 'status',   header: 'Status',   width: 140, cell: (c) => renderSnippet(StatusPill, { s: c.row.original.status }) },
  ]
</script>

<!-- Shared cell bits -->
{#snippet PriPill(props: { p: Priority })}
  <span class={`pri pri-${props.p}`}>{props.p}</span>
{/snippet}
{#snippet StatusPill(props: { s: Status })}
  <span class="status-pill" style:color={STATUS_TINT[props.s]}
    style:background={`color-mix(in oklab, ${STATUS_TINT[props.s]} 15%, transparent)`}>
    <span class="dot" style:background={STATUS_TINT[props.s]}></span>{STATUS_LABEL[props.s]}
  </span>
{/snippet}
{#snippet AssigneeCell(props: { name: string })}
  <span class="assignee">
    <span class="avatar" style:background={avatarColor(props.name)}>{initials(props.name)}</span>
    <span class="assignee-name">{props.name}</span>
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="topbar shrink-0">
    <p class="hint">
      One flat <code>tasks</code> array, two views. Drag cards between lanes - the task <code>status</code>,
      lane counts, and the table all update reactively.
    </p>
    <div class="seg">
      <button type="button" class:active={view === 'board'} onclick={() => (view = 'board')}>Board</button>
      <button type="button" class:active={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>

  {#if view === 'board'}
    <div class="board flex-1 min-h-0">
      {#each LANES as lane}
        <div
          class="lane"
          class:over={overLane === lane.id && dragId != null}
          role="list"
          ondragover={(e) => { e.preventDefault(); overLane = lane.id; if (e.dataTransfer) e.dataTransfer.dropEffect = 'move' }}
          ondragleave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) overLane = null }}
          ondrop={(e) => {
            e.preventDefault()
            const id = e.dataTransfer?.getData('text/plain') || dragId
            if (id) setStatus(id, lane.id)
            overLane = null; dragId = null
          }}
        >
          <div class="lane-head" style:--tint={lane.tint}>
            <span class="lane-dot" style:background={lane.tint}></span>
            <span class="lane-label">{lane.label}</span>
            <span class="lane-count">{byLane[lane.id].length}</span>
            <span class="lane-pts">{points[lane.id]} pts</span>
          </div>

          <div class="lane-body">
            {#each byLane[lane.id] as t (t.id)}
              {@const idx = LANE_ORDER.indexOf(t.status)}
              <div
                class="card"
                class:dragging={dragId === t.id}
                role="listitem"
                draggable="true"
                ondragstart={(e) => {
                  dragId = t.id
                  if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', t.id)
                    e.dataTransfer.effectAllowed = 'move'
                    // Use just this card as the drag image (not the whole lane).
                    e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, e.offsetX, e.offsetY)
                  }
                }}
                ondragend={() => { dragId = null; overLane = null }}
              >
                <div class="card-head">
                  <span class="card-id">{t.id}</span>
                  {@render PriPill({ p: t.priority })}
                </div>
                <div class="card-title">{t.title}</div>
                <div class="card-foot">
                  <span class="assignee">
                    <span class="avatar" style:background={avatarColor(t.assignee)}>{initials(t.assignee)}</span>
                    <span class="assignee-name">{t.assignee}</span>
                  </span>
                  <span class="card-pts">{t.points}</span>
                </div>
                <div class="card-move">
                  <button type="button" aria-label="Move to previous lane" disabled={idx === 0} onclick={() => shift(t.id, -1)}>◂</button>
                  <button type="button" aria-label="Move to next lane" disabled={idx === LANE_ORDER.length - 1} onclick={() => shift(t.id, 1)}>▸</button>
                </div>
              </div>
            {/each}

            {#if byLane[lane.id].length === 0}
              <div class="lane-empty">Drop tasks here</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="table-host flex-1 min-h-0">
      <SvGrid
        data={tasks}
        columns={columns}
        features={features}
        filterMode="menu"
        showPagination={false}
        rowHeight={44}
        containerHeight="100%"
        fitColumns={true}
        getRowId={(t) => t.id}
      />
    </div>
  {/if}
</section>

<style>
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .hint { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .hint code { font-family: ui-monospace, Menlo, Consolas, monospace; background: rgba(99,102,241,0.10); padding: 1px 5px; border-radius: 3px; color: #4338ca; font-size: 12px; }

  .seg { display: inline-flex; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .seg button { padding: 6px 16px; border: 0; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-weight: 600; font-size: 13px; cursor: pointer; }
  .seg button.active { background: #4338ca; color: #fff; }

  /* Board */
  .board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
  .lane {
    flex: 1 1 0; min-width: 250px; display: flex; flex-direction: column;
    background: var(--sg-header-bg, #f1f5f9); border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 12px; overflow: hidden;
    transition: outline-color 120ms, background-color 120ms; outline: 2px solid transparent; outline-offset: -2px;
  }
  .lane.over { outline-color: #6366f1; background: color-mix(in oklab, #6366f1 8%, var(--sg-header-bg, #f1f5f9)); }
  :global([data-theme="dark"]) .lane { background: #0b1220; }

  .lane-head {
    display: flex; align-items: center; gap: 8px; padding: 11px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    border-top: 3px solid var(--tint);
    font-weight: 700; font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .lane-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .lane-label { flex: 1; }
  .lane-count {
    min-width: 22px; text-align: center; font-size: 12px; font-weight: 700;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 999px; padding: 1px 7px;
  }
  .lane-pts { font-size: 11px; font-weight: 600; color: var(--sg-muted, #94a3b8); }

  .lane-body { display: flex; flex-direction: column; gap: 9px; padding: 10px; overflow-y: auto; flex: 1; min-height: 60px; }

  .card {
    display: flex; flex-direction: column; gap: 7px;
    padding: 11px 12px; border-radius: 10px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    box-shadow: 0 1px 2px rgba(15,23,42,0.05);
    cursor: grab; transition: box-shadow 120ms, transform 120ms, border-color 120ms;
  }
  .card:hover { box-shadow: 0 6px 18px rgba(15,23,42,0.10); border-color: color-mix(in oklab, #6366f1 40%, var(--sg-border, #e2e8f0)); transform: translateY(-1px); }
  .card:active { cursor: grabbing; }
  .card.dragging { opacity: 0.5; box-shadow: none; }
  :global([data-theme="dark"]) .card { background: #111a2e; }

  .card-head { display: flex; align-items: center; justify-content: space-between; }
  .card-id { font-size: 11px; color: var(--sg-muted, #94a3b8); font-variant-numeric: tabular-nums; font-weight: 600; }
  .card-title { font-size: 13.5px; line-height: 1.35; color: var(--sg-fg, #0f172a); font-weight: 500; }
  .card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .card-pts {
    font-size: 11px; font-weight: 700; color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f1f5f9); border-radius: 6px; padding: 1px 7px; font-variant-numeric: tabular-nums;
  }

  .card-move { display: flex; gap: 4px; margin-top: 1px; }
  .card-move button {
    flex: 1; padding: 3px 0; background: transparent; border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px; color: var(--sg-muted, #64748b); cursor: pointer; font-size: 12px; line-height: 1;
  }
  .card-move button:hover:not(:disabled) { background: rgba(99,102,241,0.10); color: var(--sg-fg, #0f172a); border-color: #6366f1; }
  .card-move button:disabled { opacity: 0.3; cursor: default; }

  .lane-empty {
    margin: auto; padding: 18px; text-align: center; font-size: 12px; font-style: italic;
    color: var(--sg-muted, #94a3b8); border: 1px dashed var(--sg-border, #cbd5e1); border-radius: 8px; width: 100%;
  }

  /* Pills / avatars (shared) */
  .pri { font-size: 10px; font-weight: 800; letter-spacing: 0.03em; padding: 1px 7px; border-radius: 999px; text-transform: uppercase; }
  .pri-urgent { background: #fef2f2; color: #b91c1c; }
  .pri-high   { background: #fff7ed; color: #c2410c; }
  .pri-normal { background: #eff6ff; color: #1d4ed8; }
  .pri-low    { background: #f1f5f9; color: #475569; }

  .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  .assignee { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
  .avatar { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; color: #fff; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
  .assignee-name { font-size: 12px; color: var(--sg-muted, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
