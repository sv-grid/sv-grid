<script lang="ts">
  /**
   * 388. Northwind People - a recruiting pipeline console (enterprise)
   * -----------------------------------------------------------------
   * One dataset, five surfaces, in a dockable workspace: the SAME candidate
   * interviews render as a Scheduler (calendar), a Grid (table), a Kanban
   * pipeline (by hiring stage), and a Chart (hiring funnel by department) - all
   * inside an SvDockManager you can drag / resize / float. Editing in any view
   * (drag an interview, move a card, edit a cell) writes back to the one `rows`
   * array, so every surface stays in sync. Grid is the hero.
   */
  import {
    SvGrid,
    SvGridChart,
    SvDockManager,
    dockGroup,
    dockTabs,
    dockPane,
    type DockManagerState,
    type ChartSpec,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
    type BoardCardMoveEvent,
    type BoardCardCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, enableBoardView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()
  enableBoardView()

  type Stage = 'Applied' | 'Screen' | 'Onsite' | 'Offer' | 'Hired'
  type Dept = 'Engineering' | 'Design' | 'Sales' | 'Data'
  type Cand = {
    id: number; name: string; role: string; dept: Dept; stage: Stage; interviewer: string
    score: number; start: string; end: string; color: string
  }

  const DEPT: Record<Dept, string> = { Engineering: '#4f46e5', Design: '#d97706', Sales: '#16a34a', Data: '#0891b2' }
  const depts = Object.keys(DEPT) as Dept[]
  const STAGE: Record<Stage, string> = { Applied: '#94a3b8', Screen: '#0891b2', Onsite: '#d97706', Offer: '#7c3aed', Hired: '#16a34a' }
  const stages = Object.keys(STAGE) as Stage[]
  const interviewers = ['Ava', 'Ben', 'Cora', 'Diego']

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const at = (day: number, h: number, m = 0) => { const d = new Date(monday); d.setDate(monday.getDate() + day); d.setHours(h, m, 0, 0); return iso(d) }
  const mk = (c: Omit<Cand, 'color'>): Cand => ({ ...c, color: DEPT[c.dept] })

  let rows = $state<Cand[]>([
    mk({ id: 1, name: 'Nora Patel', role: 'Senior Frontend Engineer', dept: 'Engineering', stage: 'Onsite', interviewer: 'Ava', score: 82, start: at(0, 9, 0), end: at(0, 10, 0) }),
    mk({ id: 2, name: 'Liam Chen', role: 'Product Designer', dept: 'Design', stage: 'Screen', interviewer: 'Ben', score: 74, start: at(0, 8, 30), end: at(0, 9, 0) }),
    mk({ id: 3, name: 'Sofia Rossi', role: 'Account Executive', dept: 'Sales', stage: 'Applied', interviewer: 'Cora', score: 61, start: at(0, 13, 0), end: at(0, 14, 0) }),
    mk({ id: 4, name: 'Marcus Webb', role: 'Data Engineer', dept: 'Data', stage: 'Offer', interviewer: 'Diego', score: 91, start: at(1, 9, 30), end: at(1, 10, 30) }),
    mk({ id: 5, name: 'Priya Nair', role: 'Backend Engineer', dept: 'Engineering', stage: 'Hired', interviewer: 'Ava', score: 88, start: at(1, 14, 0), end: at(1, 14, 30) }),
    mk({ id: 6, name: 'Tom Fischer', role: 'UX Researcher', dept: 'Design', stage: 'Applied', interviewer: 'Ben', score: 55, start: at(2, 10, 0), end: at(2, 12, 0) }),
    mk({ id: 7, name: 'Ella Novak', role: 'Platform Engineer', dept: 'Engineering', stage: 'Screen', interviewer: 'Ava', score: 70, start: at(2, 9, 0), end: at(2, 9, 45) }),
    mk({ id: 8, name: 'Raj Mehta', role: 'Sales Development Rep', dept: 'Sales', stage: 'Applied', interviewer: 'Cora', score: 48, start: at(3, 8, 30), end: at(3, 9, 0) }),
    mk({ id: 9, name: 'Hana Kim', role: 'Analytics Engineer', dept: 'Data', stage: 'Onsite', interviewer: 'Diego', score: 79, start: at(3, 11, 0), end: at(3, 12, 0) }),
    mk({ id: 10, name: 'Owen Blake', role: 'Regional Sales Lead', dept: 'Sales', stage: 'Offer', interviewer: 'Cora', score: 84, start: at(3, 14, 0), end: at(3, 16, 0) }),
    mk({ id: 11, name: 'Ines Duarte', role: 'Interaction Designer', dept: 'Design', stage: 'Onsite', interviewer: 'Ben', score: 76, start: at(4, 9, 30), end: at(4, 10, 30) }),
    mk({ id: 12, name: 'Victor Hale', role: 'ML Engineer', dept: 'Data', stage: 'Screen', interviewer: 'Diego', score: 67, start: at(4, 13, 0), end: at(4, 14, 0) }),
    mk({ id: 13, name: 'Grace Lin', role: 'Frontend Engineer', dept: 'Engineering', stage: 'Applied', interviewer: 'Ava', score: 59, start: at(4, 8, 30), end: at(4, 9, 0) }),
    mk({ id: 14, name: 'Noah Sterling', role: 'BI Analyst', dept: 'Data', stage: 'Hired', interviewer: 'Diego', score: 86, start: at(2, 15, 0), end: at(2, 16, 30) }),
  ])

  const resources: SchedulerResource[] = interviewers.map((i) => ({ id: i, title: i }))

  const columns: ColumnDef<any, Cand>[] = [
    { field: 'name', header: 'Candidate', editorType: 'text', width: 150 },
    { field: 'role', header: 'Role', editorType: 'text', width: 190 },
    { field: 'dept', header: 'Department', editorType: 'list', editorOptions: depts.map((d) => ({ value: d, label: d, color: DEPT[d] })), width: 130 },
    { field: 'stage', header: 'Stage', editorType: 'list', editorOptions: stages.map((s) => ({ value: s, label: s, color: STAGE[s] })), width: 110 },
    { field: 'interviewer', header: 'Interviewer', editorType: 'list', editorOptions: interviewers.map((i) => ({ value: i, label: i })), width: 110 },
    { field: 'score', header: 'Score', editorType: 'number', width: 90 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  // Chart: a hiring funnel - candidate count by stage (Applied -> Hired), split
  // by department (stacked). Derived, so moving a card / editing a cell
  // re-draws it live.
  const chartSpec = $derived<ChartSpec>({
    type: 'bar',
    stacked: true,
    categories: stages,
    series: depts.map((d) => ({
      label: d,
      color: DEPT[d],
      values: stages.map((st) => rows.filter((r) => r.stage === st && r.dept === d).length),
    })),
  })

  function onEventMove(e: SchedulerEventMoveEvent<Cand>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.interviewer = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Cand>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Cand>) { Object.assign(e.row, e.values); e.row.color = DEPT[e.row.dept] ?? e.row.color }
  function onCardMove(e: BoardCardMoveEvent<Cand>) { e.row.stage = e.toLane as Stage }
  function onCardCommit(e: BoardCardCommitEvent<Cand>) { Object.assign(e.row, e.values); e.row.color = DEPT[e.row.dept] ?? e.row.color }

  const LAYOUT_KEY = 'svgrid-hr-layout-v1'
  const defaultWorkspace = (): DockManagerState => ({
    main: dockGroup('row', [
      dockGroup('column', [
        dockTabs([dockPane('calendar', 'Calendar', { minSize: 200 })]),
        dockTabs([dockPane('board', 'Pipeline', { minSize: 160 })]),
      ], [0.56, 0.44]),
      dockGroup('column', [
        dockTabs([dockPane('chart', 'Funnel', { minSize: 140 })]),
        dockTabs([dockPane('grid', 'Candidates', { minSize: 140 })]),
      ], [0.42, 0.58]),
    ], [0.62, 0.38]),
    floating: [],
    autoHide: [],
  })
  function loadWorkspace(): DockManagerState {
    try { const s = localStorage.getItem(LAYOUT_KEY); if (s) return JSON.parse(s) as DockManagerState } catch { /* ignore */ }
    return defaultWorkspace()
  }
  let workspace = $state<DockManagerState>(loadWorkspace())
  $effect(() => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(workspace)) } catch { /* ignore */ } })

  let chartW = $state(0)
  let chartH = $state(0)
</script>

{#snippet eventBody(row: Cand)}
  <span class="hr-ev"><span class="hr-ev-nm">{row.name}</span><span class="hr-ev-t">{row.role}</span></span>
{/snippet}
{#snippet card(row: Cand)}
  <div class="hr-card">
    <div class="hr-card-top"><span class="hr-card-dot" style:background={DEPT[row.dept]}></span><span class="hr-card-nm">{row.name}</span><span class="hr-card-score">{row.score}</span></div>
    <div class="hr-card-title">{row.role}</div>
    <div class="hr-card-sub">{row.dept} · {row.interviewer}</div>
  </div>
{/snippet}

<section class="hr">
  <header class="hr-head">
    <div class="hr-brand">👥 Northwind People <span class="hr-brand-sub">Talent acquisition</span></div>
    <div class="hr-hint">One dataset, four synced views in a dockable workspace - drag a tab or splitter to rearrange.</div>
    <button class="hr-reset" onclick={() => (workspace = defaultWorkspace())}>Reset layout</button>
  </header>
  <div class="hr-stage">
    <SvDockManager bind:workspace minSize={120}>
      {#snippet pane(p)}
        {#if p.id === 'calendar'}
          <div class="hr-pane">
            <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="100%"
              scheduler={{
                startField: 'start', endField: 'end', titleField: 'name', colorField: 'color',
                resourceField: 'interviewer', resources,
                views: ['week', 'day'], initialView: 'week', initialDate: monday, weekStartsOn: 1,
                dayStartHour: 7, dayEndHour: 18, event: eventBody, tooltip: true, editable: true, drawer: true,
                onEventMove, onEventResize, onEventCommit,
              }} />
          </div>
        {:else if p.id === 'board'}
          <div class="hr-pane">
            <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="100%"
              board={{ groupBy: 'stage', lanes: stages.map((s) => ({ id: s, title: s, color: STAGE[s] })), editable: true, card, onCardMove, onCardCommit }} />
          </div>
        {:else if p.id === 'grid'}
          <div class="hr-pane">
            <SvGrid data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="100%" sortable enableInlineEditing rowHeight={30} fitColumns />
          </div>
        {:else if p.id === 'chart'}
          <div class="hr-pane hr-chartwrap" bind:clientWidth={chartW} bind:clientHeight={chartH}>
            {#if chartW > 20 && chartH > 20}
              <SvGridChart spec={chartSpec} width={chartW - 12} height={chartH - 12} />
            {/if}
          </div>
        {/if}
      {/snippet}
    </SvDockManager>
  </div>
</section>

<style>
  .hr { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .hr-head { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .hr-brand { font-weight: 700; }
  .hr-brand-sub { font-weight: 400; font-size: 0.74rem; color: var(--sg-muted, #6b7280); margin-left: 6px; }
  .hr-hint { font-size: 0.76rem; color: var(--sg-muted, #6b7280); flex: 1 1 auto; }
  .hr-reset { padding: 4px 10px; font-size: 0.8rem; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
  .hr-reset:hover { border-color: var(--sg-accent, #4f46e5); color: var(--sg-accent, #4f46e5); }
  .hr-stage { flex: 1 1 auto; min-height: 360px; padding: 8px; }
  .hr-pane { height: 100%; min-height: 0; }
  .hr-chartwrap { display: grid; place-items: center; padding: 6px; box-sizing: border-box; }
  .hr-ev { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
  .hr-ev-nm { font-weight: 700; font-size: 0.7em; }
  .hr-ev-t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hr-card { display: flex; flex-direction: column; gap: 2px; }
  .hr-card-top { display: flex; align-items: center; gap: 6px; }
  .hr-card-dot { width: 8px; height: 8px; border-radius: 50%; }
  .hr-card-nm { font-weight: 700; font-size: 0.78rem; }
  .hr-card-score { margin-left: auto; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .hr-card-title { font-size: 0.82rem; font-weight: 600; }
  .hr-card-sub { font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  /* Phone: keep the desk at its content height (hidden overflow made it shrink to the
     stage) and let the 720px docking workspace pan inside the card. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .hr { flex-shrink: 0; overflow-x: auto; }
  }
</style>
