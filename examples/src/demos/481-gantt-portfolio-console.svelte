<script lang="ts">
  /**
   * 481. Portfolio office - a project console (Enterprise Gantt Pro)
   * ----------------------------------------------------------------
   * A PMO console with the Gantt as the hero. A rail on the left lists the
   * portfolio: each project with its health, owner and percent complete;
   * click one and the workspace switches to it. The workspace is a dockable
   * layout (SvDockManager): the plan over a "remaining work by owner" chart
   * and a risk register grid - drag a pane's tab to rearrange, and the
   * layout persists.
   *
   *   - The plan runs with the critical path and baselines on, and is
   *     editable: drag a task and the risk register, the KPIs and the chart
   *     all recompute from the one `rows` array the project holds.
   *   - **Risk register** lists the open tasks with under three days of
   *     slack, ordered by finish: the ones a bad week would push into the
   *     project finish. It reads the same slack the Gantt's Slack column
   *     shows, through `onCriticalPathChange` and the `criticalPath` pass.
   *   - The KPIs are live: tasks, percent complete (duration weighted, the
   *     same rollup the phase bars use), days of slack on the finish, and
   *     the projected finish date against the baseline.
   */
  import {
    SvGrid,
    SvGridChart,
    SvDockManager,
    SvStat,
    SvAvatar,
    dockGroup,
    dockTabs,
    dockPane,
    type DockManagerState,
    type ChartSpec,
    type ColumnDef,
    type GanttDependency,
  } from '@svgrid/grid'
  import { enableGanttView, setLicenseKey, criticalPath, slackDays, makeCalendar, type GanttProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()

  type Health = 'On track' | 'At risk' | 'Late'
  type Task = {
    id: string
    name: string
    owner: string
    start: string
    end?: string
    progress: number
    parentId: string | null
    milestone?: boolean
    color?: string
    bStart?: string
    bEnd?: string
  }
  type Project = {
    id: string
    name: string
    lead: string
    health: Health
    rows: Task[]
    dependencies: GanttDependency[]
  }

  const HEALTH: Record<Health, string> = { 'On track': '#16a34a', 'At risk': '#d97706', Late: '#dc2626' }
  const OWNERS = ['Priya', 'Marco', 'Dana', 'Sven', 'Mia', 'Lena', 'Omar', 'Kai']
  const PHASE_COLORS = ['#7c3aed', '#db2777', '#2563eb', '#0891b2', '#16a34a']

  let seed = 481
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monday = new Date(today)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const dayOf = (d: number) => {
    const x = new Date(monday)
    x.setDate(x.getDate() + d)
    return x
  }
  const at = (d: number) => iso(dayOf(d))
  const weekday = (d: number) => {
    const w = dayOf(d).getDay()
    return w === 6 ? d + 2 : w === 0 ? d + 1 : d
  }
  /** Working days from today to `d` (negative when past), the KPI unit. */
  const daysOut = (d: string) => Math.round((new Date(d).getTime() - today.getTime()) / 86400000)

  type Spec = { name: string; lead: string; startsIn: number; drift: number; phases: Array<[string, string[]]> }
  function build(id: string, spec: Spec): Project {
    const rows: Task[] = []
    const dependencies: GanttDependency[] = []
    let day = weekday(spec.startsIn)
    let prev: string | null = null
    let late = 0
    spec.phases.forEach(([phase, steps], pi) => {
      const pid = `${id}-p${pi + 1}`
      const color = PHASE_COLORS[pi % PHASE_COLORS.length]
      rows.push({ id: pid, name: phase, owner: '', start: at(day), progress: 0, parentId: null, color })
      steps.forEach((step, si) => {
        const tid = `${pid}-t${si + 1}`
        const days = 3 + Math.floor(rnd() * 7)
        const startD = weekday(day)
        const endD = startD + days - 1
        const elapsed = (today.getTime() - dayOf(startD).getTime()) / 86400000
        const progress = elapsed >= days ? 100 : elapsed <= 0 ? 0 : Math.round((elapsed / days) * 10) * 10
        // Drift grows through the plan: the later the task, the further from
        // the dates it was signed off with.
        const drift = Math.round(spec.drift * (si + pi * 2) / 6)
        if (drift > 0) late++
        rows.push({
          id: tid, name: step, owner: OWNERS[Math.floor(rnd() * OWNERS.length)]!, start: at(startD), end: at(endD),
          progress, parentId: pid, color, bStart: at(startD - drift), bEnd: at(endD - drift),
        })
        if (prev) dependencies.push({ id: `${tid}-dep`, from: prev, to: tid })
        prev = tid
        // Most tasks follow their predecessor the next day, which is what makes
        // the chain tight; the odd one leaves a day, and that day is its slack.
        day = endD + 1 + (rnd() < 0.15 ? 1 : 0)
      })
    })
    const mid = `${id}-go`
    rows.push({ id: mid, name: 'Go live', owner: '', start: at(weekday(day + 1)), progress: 0, parentId: null, milestone: true, color: '#f59e0b' })
    if (prev) dependencies.push({ id: `${mid}-dep`, from: prev, to: mid })
    const health: Health = spec.drift >= 6 ? 'Late' : spec.drift >= 3 || late > 3 ? 'At risk' : 'On track'
    return { id, name: spec.name, lead: spec.lead, health, rows, dependencies }
  }

  const projects: Project[] = [
    build('atlas', { name: 'Atlas 3.0 release', lead: 'Priya', startsIn: -35, drift: 2, phases: [
      ['Discovery', ['Stakeholder interviews', 'Competitive teardown', 'Synthesis & brief']],
      ['Design', ['Information architecture', 'Interface mocks', 'Design review']],
      ['Build', ['Data model & API', 'Front end', 'Migration tooling', 'Hardening & QA']],
      ['Launch', ['Beta with design partners', 'Docs & release notes', 'Go-live runbook']],
    ] }),
    build('erp', { name: 'ERP migration', lead: 'Sven', startsIn: -60, drift: 7, phases: [
      ['Assess', ['Process inventory', 'Data audit', 'Vendor selection']],
      ['Configure', ['Chart of accounts', 'Workflows', 'Integrations', 'Reports']],
      ['Migrate', ['Trial load', 'Reconciliation', 'Cut-over rehearsal']],
      ['Adopt', ['Training', 'Hypercare']],
    ] }),
    build('hq', { name: 'HQ refurbishment', lead: 'Omar', startsIn: -20, drift: 4, phases: [
      ['Strip out', ['Asbestos survey', 'Soft strip', 'Services isolation']],
      ['Fit-out', ['Partitions', 'M&E first fix', 'Ceilings', 'M&E second fix', 'Flooring']],
      ['Move', ['Furniture', 'IT install', 'Snagging']],
    ] }),
    build('mobile', { name: 'Mobile app v5', lead: 'Dana', startsIn: -10, drift: 0, phases: [
      ['Foundations', ['Design system', 'Offline store', 'Auth refresh']],
      ['Features', ['Push notifications', 'Tablet layouts', 'Widgets']],
      ['Release', ['Beta ring', 'Store review', 'Rollout']],
    ] }),
    build('soc2', { name: 'SOC 2 Type II', lead: 'Lena', startsIn: 5, drift: 0, phases: [
      ['Scope', ['Control mapping', 'Gap analysis']],
      ['Remediate', ['Access reviews', 'Change management', 'Vendor risk', 'Logging']],
      ['Audit', ['Evidence collection', 'Fieldwork', 'Report']],
    ] }),
  ]

  let activeId = $state(projects[0]!.id)
  const project = $derived(projects.find((p) => p.id === activeId)!)
  // Each project's rows are its own state, so an edit sticks when you switch away and back.
  let rowsById = $state<Record<string, Task[]>>(Object.fromEntries(projects.map((p) => [p.id, p.rows])))
  const rows = $derived(rowsById[activeId]!)
  const tasks = $derived(rows.filter((r) => r.parentId && !r.milestone))

  // --- the planning pass, shared by the register and the KPIs ------------
  const calendar = makeCalendar()
  const cpm = $derived.by(() => {
    const times = new Map<string, { start: Date; end: Date }>()
    for (const r of rows) {
      if (!r.parentId && !r.milestone) continue
      const s = new Date(r.start)
      const e = r.end ? new Date(new Date(r.end).getTime() + 86400000) : s
      times.set(r.id, { start: s, end: e })
    }
    // The same working-time pass the chart draws, so the register's slack is
    // the Slack column's: working days, weekends not counted as room.
    return criticalPath(times, project.dependencies, calendar)
  })
  const finish = $derived(cpm.finish)
  const baselineFinish = $derived(
    tasks.reduce((max, t) => (t.bEnd && t.bEnd > max ? t.bEnd : max), ''),
  )
  const finishSlip = $derived(baselineFinish ? Math.round((finish.getTime() - new Date(baselineFinish).getTime()) / 86400000) - 1 : 0)
  const pctDone = $derived.by(() => {
    let weight = 0
    let done = 0
    for (const t of tasks) {
      const d = t.end ? daysOut(t.end) - daysOut(t.start) + 1 : 1
      weight += d
      done += (d * t.progress) / 100
    }
    return weight ? Math.round((done / weight) * 100) : 0
  })
  const register = $derived(
    tasks
      .filter((t) => t.progress < 100)
      .map((t) => ({ ...t, slack: slackDays(cpm, t.id), late: t.bEnd && t.end ? Math.round((new Date(t.end).getTime() - new Date(t.bEnd).getTime()) / 86400000) : 0 }))
      .filter((t) => t.slack < 3)
      .sort((a, b) => a.end!.localeCompare(b.end!)),
  )

  // --- remaining work by owner ---------------------------------------------
  const workload = $derived.by<ChartSpec>(() => {
    const left = new Map<string, number>()
    for (const t of tasks) {
      const d = t.end ? daysOut(t.end) - daysOut(t.start) + 1 : 1
      left.set(t.owner, (left.get(t.owner) ?? 0) + Math.round(d * (1 - t.progress / 100)))
    }
    const owners = [...left.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    return {
      type: 'bar',
      categories: owners.map(([o]) => o),
      series: [{ label: 'Days left', color: 'var(--sg-accent, #4f46e5)', values: owners.map(([, v]) => v) }],
    }
  })

  const fmt = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = iso(start)
    const last = new Date(end.getTime() - 86400000)
    row.end = iso(last < start ? start : last)
  }

  const columns: ColumnDef<any, Task>[] = [
    { field: 'name', header: 'Task', width: 200 },
    { field: 'owner', header: 'Owner', width: 90 },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]
  type Risk = Task & { slack: number; late: number }
  const registerColumns: ColumnDef<any, Risk>[] = [
    { field: 'name', header: 'Task', width: 140 },
    { field: 'owner', header: 'Owner', width: 84 },
    { field: 'end', header: 'Due', width: 74, cell: (ctx) => fmt(ctx.row.original.end!) },
    { field: 'slack', header: 'Slack', width: 70 },
    { field: 'late', header: 'Drift', width: 72, cell: (ctx) => (ctx.row.original.late > 0 ? `+${ctx.row.original.late} d` : ctx.row.original.late < 0 ? `${ctx.row.original.late} d` : 'on plan') },
  ]

  const ganttCfg = $derived<GanttProConfig<any, Task>>({
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    milestoneField: 'milestone',
    colorField: 'color',
    dependencies: project.dependencies,
    tableColumns: ['name', 'owner', '__duration', '__slack'],
    tableWidth: 380,
    rowHeight: 30,
    zoom: 'month',
    weekStartsOn: 1,
    tooltip: true,
    editable: true,
    history: true,
    criticalPath: true,
    baselineStartField: 'bStart',
    baselineEndField: 'bEnd',
    onTaskMove: (e) => {
      writeSpan(e.row, e.start, e.end)
      for (const s of e.subtree ?? []) writeSpan(s.row, s.start, s.end)
    },
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onProgressChange: (e) => (e.row.progress = e.progress),
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const r = rows.find((x) => x.id === m.id)
        if (r) writeSpan(r, m.start, m.end)
      }
    },
  })

  // --- the dockable workspace ---------------------------------------------
  const LAYOUT_KEY = 'svgrid-portfolio-console-layout-v1'
  const defaultWorkspace = (): DockManagerState => ({
    main: dockGroup('column', [
      dockTabs([dockPane('plan', 'Plan', { minSize: 260, closable: false })]),
      dockGroup('row', [
        dockTabs([dockPane('register', 'Risk register', { minSize: 160 })]),
        dockTabs([dockPane('workload', 'Remaining work by owner', { minSize: 160 })]),
      ], [0.55, 0.45]),
    ], [0.7, 0.3]),
    floating: [],
    autoHide: [],
  })
  function loadWorkspace(): DockManagerState {
    try {
      const s = localStorage.getItem(LAYOUT_KEY)
      if (s) return JSON.parse(s) as DockManagerState
    } catch { /* private mode, or nothing saved */ }
    return defaultWorkspace()
  }
  let workspace = $state<DockManagerState>(loadWorkspace())
  $effect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(workspace)) } catch { /* ignore */ }
  })
  let chartW = $state(0)
  let chartH = $state(0)

  const pct = (p: Project) => {
    const ts = rowsById[p.id]!.filter((r) => r.parentId && !r.milestone)
    return ts.length ? Math.round(ts.reduce((s, t) => s + t.progress, 0) / ts.length) : 0
  }

  // The same rows as a plain table: the Gantt is one view of the grid.
  let view = $state<'gantt' | 'table'>('gantt')
</script>

<section class="po">
  <aside class="po-rail">
    <div class="po-brand">
      <span class="po-brand-mark">◫</span>
      <span><span class="po-brand-name">Portfolio office</span><span class="po-brand-sub">{projects.length} projects</span></span>
    </div>
    <div class="po-list" role="tablist" aria-label="Projects">
      {#each projects as p (p.id)}
        <button
          class="po-proj"
          class:po-proj-on={p.id === activeId}
          role="tab"
          aria-selected={p.id === activeId}
          onclick={() => (activeId = p.id)}
        >
          <span class="po-proj-row">
            <span class="po-health" style:background={HEALTH[p.health]}></span>
            <span class="po-proj-name">{p.name}</span>
            <span class="po-proj-pct">{pct(p)}%</span>
          </span>
          <span class="po-proj-row po-proj-meta">
            <SvAvatar name={p.lead} size={16} />
            <span>{p.lead}</span>
            <span class="po-proj-health" style:color={HEALTH[p.health]}>{p.health}</span>
          </span>
          <span class="po-proj-track"><span class="po-proj-fill" style:width={`${pct(p)}%`}></span></span>
        </button>
      {/each}
    </div>
    <div class="po-legend">
      <span class="po-legend-i"><span class="po-ring"></span>Critical</span>
      <span class="po-legend-i"><span class="po-ghost"></span>Baseline</span>
      <span class="po-legend-i"><span class="po-ghost po-ghost-late"></span>Behind it</span>
    </div>
  </aside>

  <div class="po-main">
    <div class="po-kpis">
      <SvStat label="Tasks" value={tasks.length} hint={`${tasks.filter((t) => t.progress === 100).length} complete`} />
      <SvStat label="Complete" value={`${pctDone}%`} hint="duration weighted" />
      <SvStat label="At risk" value={register.length} hint="under 3 days of slack" />
      <SvStat label="Finish" value={fmt(finish)} hint={finishSlip > 0 ? `${finishSlip} days behind baseline` : finishSlip < 0 ? `${-finishSlip} days ahead of baseline` : 'on the baseline'} />
    </div>
    <div class="po-toolbar">
      <div class="po-title">{project.name} <span class="po-title-sub">lead {project.lead} - drag a task and the register, chart and KPIs follow</span></div>
      <div class="po-seg" role="tablist" aria-label="View">
        <button class="po-seg-btn" role="tab" aria-selected={view === 'gantt'} class:po-on={view === 'gantt'} onclick={() => (view = 'gantt')}>Gantt</button>
        <button class="po-seg-btn" role="tab" aria-selected={view === 'table'} class:po-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
      </div>
      <button class="po-btn" onclick={() => (workspace = defaultWorkspace())}>Reset layout</button>
    </div>
    <div class="po-stage">
      <SvDockManager bind:workspace minSize={120}>
        {#snippet pane(p)}
          {#if p.id === 'plan'}
            <div class="po-pane">
              {#key activeId}
                {#if view === 'gantt'}
                  <SvGrid columnResize data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" gantt={ganttCfg} />
                {:else}
                  <SvGrid columnResize data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" sortable fitColumns />
                {/if}
              {/key}
            </div>
          {:else if p.id === 'register'}
            <div class="po-pane">
              {#if register.length}
                <SvGrid columnResize data={register} columns={registerColumns} getRowId={(r) => r.id} containerHeight="100%" rowHeight={30} selectionMode="none" fitColumns sortable />
              {:else}
                <p class="po-empty">Nothing under three days of slack - every open task has room.</p>
              {/if}
            </div>
          {:else if p.id === 'workload'}
            <div class="po-pane po-chart" bind:clientWidth={chartW} bind:clientHeight={chartH}>
              {#if chartW > 20 && chartH > 20}
                <SvGridChart spec={workload} width={chartW - 12} height={chartH - 12} />
              {/if}
            </div>
          {/if}
        {/snippet}
      </SvDockManager>
    </div>
  </div>
</section>

<style>
  .po { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .po-rail { flex: 0 0 250px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .po-brand { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .po-brand-mark { font-size: 16px; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 14%, transparent); color: var(--sg-accent, #4f46e5); }
  .po-brand-name { display: block; font-weight: 700; font-size: 0.9rem; }
  .po-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .po-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .po-proj {
    display: flex; flex-direction: column; gap: 5px; width: 100%; padding: 9px 10px;
    border: 1px solid transparent; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
  }
  .po-proj:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 5%, transparent); }
  .po-proj-on { background: var(--sg-bg, #fff); border-color: var(--sg-border, #e5e7eb); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
  .po-proj-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .po-proj-name { flex: 1 1 auto; font-weight: 600; font-size: 0.84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .po-proj-pct { font-size: 0.76rem; color: var(--sg-muted, #6b7280); font-variant-numeric: tabular-nums; }
  .po-proj-meta { font-size: 0.74rem; color: var(--sg-muted, #6b7280); }
  .po-proj-health { margin-left: auto; font-weight: 600; }
  .po-health { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .po-proj-track { display: block; height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--sg-fg, #1f2937) 10%, transparent); overflow: hidden; }
  .po-proj-fill { display: block; height: 100%; background: var(--sg-accent, #4f46e5); border-radius: 2px; }
  .po-legend { display: flex; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--sg-border, #e5e7eb); font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .po-legend-i { display: inline-flex; align-items: center; gap: 5px; }
  .po-ring { width: 12px; height: 8px; border-radius: 2px; box-shadow: 0 0 0 2px #dc2626; }
  .po-ghost { width: 12px; height: 5px; border-radius: 2px; background: color-mix(in srgb, var(--sg-fg, #1f2937) 28%, transparent); }
  .po-ghost-late { background: color-mix(in srgb, #dc2626 45%, transparent); }

  .po-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .po-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 14px 4px; }
  .po-kpis :global(.sv-stat) { padding: 7px 12px !important; gap: 2px !important; border-radius: 9px !important; }
  .po-kpis :global(.sv-stat__value) { font-size: 18px !important; }
  .po-kpis :global(.sv-stat__label) { font-size: 11px !important; }
  .po-kpis :global(.sv-stat__foot) { font-size: 11px !important; }
  .po-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .po-title { font-weight: 600; display: flex; align-items: baseline; gap: 8px; min-width: 0; margin-right: auto; }
  .po-title-sub { font-size: 0.75rem; font-weight: 400; color: var(--sg-muted, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .po-seg { display: inline-flex; flex: none; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .po-seg-btn { padding: 5px 12px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 0.8rem; cursor: pointer; }
  .po-seg-btn:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .po-on { background: var(--sg-accent, #4f46e5); color: #fff; }
  .po-on:hover { background: var(--sg-accent, #4f46e5); }
  .po-btn { flex: none; padding: 4px 10px; font-size: 0.8rem; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
  .po-btn:hover { border-color: var(--sg-accent, #4f46e5); color: var(--sg-accent, #4f46e5); }
  .po-stage { flex: 1 1 auto; min-height: 360px; padding: 8px; }
  .po-pane { height: 100%; min-height: 0; }
  .po-chart { display: grid; place-items: center; padding: 6px; box-sizing: border-box; }
  .po-empty { margin: 0; padding: 14px; font-size: 0.8rem; color: var(--sg-muted, #6b7280); }

  @media (max-width: 767px) {
    .po { min-width: 960px; flex-shrink: 0; }
  }
</style>
