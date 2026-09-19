<script lang="ts">
  /**
   * 478. One plan, four views: Grid, Gantt, Scheduler, Kanban (Enterprise)
   * ----------------------------------------------------------------------
   * One `<SvGrid>`, one array of rows, and a switch between four renderers:
   *
   *   - **Grid** - the plain table, with inline editing on Status, Owner and
   *     Progress. Change a status here and the card moves lane on the board.
   *   - **Gantt** - the same rows as a plan (`gantt` prop): four phases nest
   *     their tasks, links draw as arrows, and dragging a bar writes the new
   *     dates back through `onTaskMove`.
   *   - **Scheduler** - the same rows on a resource timeline (`scheduler`
   *     prop), one lane per owner. Drag a task onto another lane and its
   *     Owner column changes.
   *   - **Kanban** - the same rows as cards in status lanes (`board` prop).
   *     Drop a card on Done and its progress reads 100.
   *
   * Every view writes back through a callback and nothing else, so the same
   * `rows` array is the truth for all four - the line under the switcher
   * names the last write and which view asked for it. Two things the Gantt
   * alone renders: the phase rows (the work-breakdown) and the milestones
   * (diamonds). The other views are handed the tasks only.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvSegmented,
    renderSnippet,
    type ColumnDef,
    type GanttConfig,
    type GanttDependency,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type BoardCardMoveEvent,
    type BoardCardCommitEvent,
  } from '@svgrid/grid'
  import { enableBoardView, enableGanttView, enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()
  enableSchedulerView()
  enableBoardView()

  type Status = 'Backlog' | 'In progress' | 'Review' | 'Done'
  type Row = {
    id: string
    name: string
    /** A phase groups the tasks under it; only the Gantt draws phase rows. */
    kind: 'phase' | 'task' | 'milestone'
    phase: string
    parentId: string | null
    owner: string
    status: Status
    /** Local timestamps, `end` exclusive - the one shape every view reads
     *  the same way. A date-only string would be a calendar day to the
     *  Gantt and UTC midnight to the scheduler. */
    start: string
    end: string
    progress: number
    milestone?: boolean
    allDay: boolean
    color: string
  }

  const PHASE: Record<string, { title: string; color: string }> = {
    p1: { title: 'Discovery', color: '#7c3aed' },
    p2: { title: 'Design', color: '#db2777' },
    p3: { title: 'Build', color: '#2563eb' },
    p4: { title: 'Launch', color: '#16a34a' },
  }
  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'warning' | 'success' }> = {
    Backlog: { color: '#94a3b8', variant: 'neutral' },
    'In progress': { color: '#2563eb', variant: 'info' },
    Review: { color: '#d97706', variant: 'warning' },
    Done: { color: '#16a34a', variant: 'success' },
  }
  const statuses = Object.keys(STATUS) as Status[]
  const OWNER: Record<string, string> = {
    Priya: '#7c3aed',
    Marco: '#0891b2',
    Dana: '#db2777',
    Sven: '#2563eb',
    Mia: '#d97706',
    Lena: '#16a34a',
  }
  const owners = Object.keys(OWNER)
  const ownerResources: SchedulerResource[] = owners.map((id) => ({ id, title: id, color: OWNER[id] }))

  // Anchored on the Monday three weeks back, so the today line lands where
  // Design hands over to Build, with work behind it and ahead of it. Every
  // task starts on a weekday: the offsets below are working-week arithmetic.
  const pad = (n: number) => String(n).padStart(2, '0')
  const isoLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7) - 21)
  /** `d` days from the anchor, as a local timestamp. */
  const at = (d: number) => {
    const x = new Date(base)
    x.setDate(x.getDate() + d)
    return isoLocal(x)
  }

  type Seed = { id: string; name: string; phase: string; owner: string; status: Status; from: number; days: number; progress: number }
  const task = (s: Seed): Row => ({
    id: s.id,
    name: s.name,
    kind: 'task',
    phase: PHASE[s.phase]!.title,
    parentId: s.phase,
    owner: s.owner,
    status: s.status,
    start: at(s.from),
    end: at(s.from + s.days),
    progress: s.progress,
    allDay: true,
    color: PHASE[s.phase]!.color,
  })
  const phase = (id: string): Row => ({
    id,
    name: PHASE[id]!.title,
    kind: 'phase',
    phase: PHASE[id]!.title,
    parentId: null,
    owner: '',
    status: 'Backlog',
    start: at(0),
    end: at(0),
    progress: 0,
    allDay: true,
    color: PHASE[id]!.color,
  })
  const milestone = (id: string, name: string, phaseId: string, from: number): Row => ({
    ...phase(phaseId),
    id,
    name,
    kind: 'milestone',
    parentId: null,
    start: at(from),
    end: at(from),
    milestone: true,
    color: '#f59e0b',
  })

  let rows = $state<Row[]>([
    phase('p1'),
    task({ id: 't1', name: 'Stakeholder interviews', phase: 'p1', owner: 'Priya', status: 'Done', from: 0, days: 5, progress: 100 }),
    task({ id: 't2', name: 'Competitive teardown', phase: 'p1', owner: 'Marco', status: 'Done', from: 2, days: 8, progress: 100 }),
    task({ id: 't3', name: 'Synthesis & brief', phase: 'p1', owner: 'Priya', status: 'Done', from: 10, days: 3, progress: 100 }),

    phase('p2'),
    task({ id: 't4', name: 'Information architecture', phase: 'p2', owner: 'Dana', status: 'Review', from: 14, days: 5, progress: 90 }),
    task({ id: 't5', name: 'Interface mocks', phase: 'p2', owner: 'Dana', status: 'In progress', from: 21, days: 9, progress: 60 }),
    task({ id: 't6', name: 'Design review', phase: 'p2', owner: 'Mia', status: 'Backlog', from: 30, days: 3, progress: 0 }),
    milestone('m1', 'Design sign-off', 'p2', 35),

    phase('p3'),
    task({ id: 't7', name: 'Data model & API', phase: 'p3', owner: 'Sven', status: 'In progress', from: 21, days: 12, progress: 40 }),
    task({ id: 't8', name: 'Front end', phase: 'p3', owner: 'Mia', status: 'In progress', from: 28, days: 19, progress: 10 }),
    task({ id: 't9', name: 'Migration tooling', phase: 'p3', owner: 'Marco', status: 'Backlog', from: 35, days: 9, progress: 0 }),
    task({ id: 't10', name: 'Hardening & QA', phase: 'p3', owner: 'Lena', status: 'Backlog', from: 49, days: 10, progress: 0 }),

    phase('p4'),
    task({ id: 't11', name: 'Beta with design partners', phase: 'p4', owner: 'Priya', status: 'Backlog', from: 59, days: 9, progress: 0 }),
    task({ id: 't12', name: 'Docs & release notes', phase: 'p4', owner: 'Lena', status: 'Backlog', from: 63, days: 8, progress: 0 }),
    task({ id: 't13', name: 'Go-live runbook', phase: 'p4', owner: 'Sven', status: 'Backlog', from: 70, days: 5, progress: 0 }),
    milestone('m2', 'General availability', 'p4', 77),
  ])

  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't3' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 't4' },
    { id: 'd4', from: 't4', to: 't5' },
    { id: 'd5', from: 't5', to: 't6' },
    { id: 'd6', from: 't6', to: 'm1' },
    { id: 'd7', from: 't7', to: 't9' },
    { id: 'd8', from: 't7', to: 't10' },
    { id: 'd9', from: 't8', to: 't10' },
    { id: 'd10', from: 't10', to: 't11' },
    { id: 'd11', from: 't11', to: 't13' },
    { id: 'd12', from: 't13', to: 'm2' },
  ]

  /** The rows every view except the Gantt renders: the tasks themselves. */
  const tasks = $derived(rows.filter((r) => r.kind === 'task'))
  const byId = (id: string) => rows.find((r) => r.id === id)

  // ---- the switcher and the write-back line --------------------------------
  type View = 'grid' | 'gantt' | 'scheduler' | 'kanban'
  let view = $state<View>('gantt')
  const VIEWS: { value: View; label: string }[] = [
    { value: 'grid', label: 'Grid' },
    { value: 'gantt', label: 'Gantt' },
    { value: 'scheduler', label: 'Scheduler' },
    { value: 'kanban', label: 'Kanban' },
  ]
  const HINT: Record<View, string> = {
    grid: 'Edit Status, Owner or Progress inline - the other views read the same rows.',
    gantt: 'Drag a bar or an edge; phases roll up their tasks; arrows are the links.',
    scheduler: 'One lane per owner. Drag a task onto another lane to reassign it.',
    kanban: 'Drag a card between lanes to change its status. Done sets progress to 100.',
  }
  let lastWrite = $state<{ view: string; text: string } | null>(null)
  const note = (v: string, text: string) => (lastWrite = { view: v, text })

  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  /** The inclusive last day a row runs on, for the table and the cards. */
  const lastDay = (iso: string) => fmtDay(isoLocal(new Date(new Date(iso).getTime() - 86_400_000)))
  function writeSpan(row: Row, start: Date, end: Date) {
    row.start = isoLocal(start)
    row.end = isoLocal(end)
  }

  // ---- KPIs -----------------------------------------------------------------
  const count = (s: Status) => tasks.filter((t) => t.status === s).length
  const overall = $derived(Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / Math.max(1, tasks.length)))

  // ---- the grid view --------------------------------------------------------
  const columns: ColumnDef<any, Row>[] = [
    { field: 'name', header: 'Task', width: 220, editable: false,
      cell: (ctx) => renderSnippet(nameCell, { row: ctx.row.original }) },
    { field: 'phase', header: 'Phase', width: 110, editable: false },
    { field: 'owner', header: 'Owner', width: 120, editorType: 'list',
      editorOptions: owners.map((o) => ({ value: o, label: o })),
      cell: (ctx) => renderSnippet(ownerCell, { row: ctx.row.original }) },
    { field: 'status', header: 'Status', width: 130, editorType: 'list',
      editorOptions: statuses.map((s) => ({ value: s, label: s, color: STATUS[s].color })),
      cell: (ctx) => renderSnippet(statusCell, { row: ctx.row.original }) },
    { field: 'start', header: 'Start', width: 100, editable: false,
      cell: (ctx) => fmtDay(ctx.row.original.start) },
    { field: 'end', header: 'Finish', width: 100, editable: false,
      cell: (ctx) => lastDay(ctx.row.original.end) },
    { field: 'progress', header: 'Progress', width: 150, editorType: 'number',
      cell: (ctx) => renderSnippet(progressCell, { row: ctx.row.original }) },
  ]

  // ---- the Gantt view ---------------------------------------------------------
  const ganttCfg: GanttConfig<any, Row> = {
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    milestoneField: 'milestone',
    colorField: 'color',
    tableColumns: ['name', 'owner', '__duration', '__progress'],
    tableWidth: 470,
    dependencies,
    zoom: 'week',
    weekStartsOn: 1,
    editable: true,
    tooltip: true,
    history: true,
    onTaskMove: (e) => {
      writeSpan(e.row, e.start, e.end)
      for (const s of e.subtree ?? []) writeSpan(s.row, s.start, s.end)
      note('Gantt', `${e.row.name} moved to ${fmtDay(e.row.start)}`)
    },
    onTaskResize: (e) => {
      writeSpan(e.row, e.start, e.end)
      note('Gantt', `${e.row.name} now ${fmtDay(e.row.start)} to ${lastDay(e.row.end)}`)
    },
    onProgressChange: (e) => {
      e.row.progress = e.progress
      if (e.progress >= 100) e.row.status = 'Done'
      else if (e.row.status === 'Done') e.row.status = 'Review'
      note('Gantt', `${e.row.name} at ${e.progress}%`)
    },
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const r = byId(m.id)
        if (r) writeSpan(r, m.start, m.end)
      }
      if (moves.length) note('Gantt', `${moves.length} linked task${moves.length === 1 ? '' : 's'} rescheduled`)
    },
  }

  // ---- the scheduler view ------------------------------------------------------
  function onEventMove(e: SchedulerEventMoveEvent<Row>) {
    writeSpan(e.row, e.start, e.end)
    if (e.toResource && e.toResource !== e.row.owner) {
      e.row.owner = e.toResource
      note('Scheduler', `${e.row.name} reassigned to ${e.row.owner}`)
    } else {
      note('Scheduler', `${e.row.name} moved to ${fmtDay(e.row.start)}`)
    }
  }
  function onEventResize(e: SchedulerEventResizeEvent<Row>) {
    writeSpan(e.row, e.start, e.end)
    note('Scheduler', `${e.row.name} now ${fmtDay(e.row.start)} to ${lastDay(e.row.end)}`)
  }

  // ---- the Kanban view ---------------------------------------------------------
  const lanes = statuses.map((s) => ({ id: s, title: s, color: STATUS[s].color, wipLimit: s === 'In progress' ? 4 : undefined }))
  function onCardMove(e: BoardCardMoveEvent<Row>) {
    e.row.status = e.toLane as Status
    if (e.row.status === 'Done') e.row.progress = 100
    else if (e.row.status === 'Backlog') e.row.progress = 0
    else if (e.row.progress >= 100) e.row.progress = 90
    note('Kanban', `${e.row.name} -> ${e.row.status}`)
  }
  function onCardCommit(e: BoardCardCommitEvent<Row>) {
    Object.assign(e.row, e.values)
    note('Kanban', `${e.row.name} edited`)
  }
</script>

{#snippet nameCell(p: { row: Row })}
  <span class="fv-name">
    <span class="fv-dot" style:background={p.row.color}></span>
    {p.row.name}
  </span>
{/snippet}

{#snippet ownerCell(p: { row: Row })}
  <span class="fv-owner">
    <SvAvatar name={p.row.owner} color={OWNER[p.row.owner]} size={20} />
    {p.row.owner}
  </span>
{/snippet}

{#snippet statusCell(p: { row: Row })}
  <SvBadge variant={STATUS[p.row.status].variant} size="sm">{p.row.status}</SvBadge>
{/snippet}

{#snippet progressCell(p: { row: Row })}
  <span class="fv-meter">
    <span class="fv-meter-track"><span class="fv-meter-fill" style:width={`${p.row.progress}%`} style:background={p.row.color}></span></span>
    <span class="fv-meter-pct">{p.row.progress}%</span>
  </span>
{/snippet}

{#snippet eventBody(row: Row)}
  <span class="fv-ev">
    <span class="fv-ev-title">{row.name}</span>
    <span class="fv-ev-pct">{row.progress}%</span>
  </span>
{/snippet}

{#snippet card(row: Row)}
  <div class="fv-card">
    <div class="fv-card-head">
      <span class="fv-dot" style:background={row.color}></span>
      <span class="fv-card-title">{row.name}</span>
    </div>
    <div class="fv-card-meta">
      <span class="fv-owner"><SvAvatar name={row.owner} color={OWNER[row.owner]} size={18} /> {row.owner}</span>
      <span class="fv-card-dates">{fmtDay(row.start)} - {lastDay(row.end)}</span>
    </div>
    <span class="fv-meter-track fv-card-track"><span class="fv-meter-fill" style:width={`${row.progress}%`} style:background={row.color}></span></span>
  </div>
{/snippet}

<section class="fv">
  <header class="fv-head">
    <div class="fv-title">
      <strong>Atlas 3.0 - one plan, four views</strong>
      <span class="fv-sub">{HINT[view]}</span>
    </div>
    <div class="fv-kpis" aria-label="Plan status">
      <span class="fv-kpi"><b>{overall}%</b> overall</span>
      {#each statuses as s (s)}
        <span class="fv-kpi"><span class="fv-dot" style:background={STATUS[s].color}></span><b>{count(s)}</b> {s.toLowerCase()}</span>
      {/each}
    </div>
    <SvSegmented options={VIEWS} bind:value={view} size="sm" ariaLabel="View" />
  </header>

  <div class="fv-write" aria-live="polite">
    {#if lastWrite}
      <span class="fv-write-view">{lastWrite.view}</span> wrote back: {lastWrite.text}
    {:else}
      Change something in any view - the write-back lands in the one array all four read.
    {/if}
  </div>

  <div class="fv-body">
    {#if view === 'grid'}
      <SvGrid
        columnResize
        data={tasks}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        sortable
        fitColumns
        rowHeight={40}
        selectionMode="cell"
        enableInlineEditing
        onCellValueChange={(e) => {
          if (e.columnId === 'progress' && e.row.progress >= 100) e.row.status = 'Done'
          note('Grid', `${e.row.name}: ${e.columnId} is now ${String(e.newValue)}`)
        }}
      />
    {:else if view === 'gantt'}
      <SvGrid
        columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        gantt={ganttCfg}
      />
    {:else if view === 'scheduler'}
      <SvGrid
        columnResize
        data={tasks}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        scheduler={{
          startField: 'start',
          endField: 'end',
          allDayField: 'allDay',
          titleField: 'name',
          colorField: 'color',
          resourceField: 'owner',
          resources: ownerResources,
          views: ['timelineWeek', 'timelineMonth'],
          initialView: 'timelineMonth',
          weekStartsOn: 1,
          editable: true,
          tooltip: true,
          event: eventBody,
          onEventMove,
          onEventResize,
        }}
      />
    {:else}
      <SvGrid
        columnResize
        data={tasks}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        board={{
          groupBy: 'status',
          lanes,
          editable: true,
          card,
          onCardMove,
          onCardCommit,
        }}
      />
    {/if}
  </div>
</section>

<style>
  .fv {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .fv-head {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .fv-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
  .fv-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fv-kpis { display: flex; flex: none; gap: 12px; font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .fv-kpi { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .fv-kpi b { color: var(--sg-fg, #1f2937); font-weight: 600; }
  .fv-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; display: inline-block; }

  .fv-write {
    padding: 6px 14px;
    font-size: 0.76rem;
    color: var(--sg-muted, #6b7280);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent);
  }
  .fv-write-view {
    display: inline-block;
    padding: 1px 7px;
    margin-right: 4px;
    border-radius: 999px;
    font-weight: 600;
    color: var(--sg-accent, #4f46e5);
    background: color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent);
  }
  .fv-body { flex: 1 1 auto; min-height: 0; padding: 8px; }

  .fv-name { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .fv-owner { display: inline-flex; align-items: center; gap: 6px; }
  .fv-meter { display: inline-flex; align-items: center; gap: 8px; width: 100%; }
  .fv-meter-track {
    flex: 1 1 auto;
    height: 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 10%, transparent);
    overflow: hidden;
  }
  .fv-meter-fill { display: block; height: 100%; border-radius: 3px; }
  .fv-meter-pct { flex: none; width: 34px; text-align: right; font-variant-numeric: tabular-nums; font-size: 0.78rem; color: var(--sg-muted, #6b7280); }

  .fv-ev { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .fv-ev-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fv-ev-pct { flex: none; margin-left: auto; font-size: 0.7rem; opacity: 0.85; }

  .fv-card { display: flex; flex-direction: column; gap: 6px; }
  .fv-card-head { display: flex; align-items: center; gap: 7px; }
  .fv-card-title { font-weight: 600; font-size: 0.84rem; }
  .fv-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.74rem; color: var(--sg-muted, #6b7280); }
  .fv-card-dates { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .fv-card-track { display: block; width: 100%; }

  @media (max-width: 767px) {
    .fv { min-width: 860px; flex-shrink: 0; }
  }
</style>
