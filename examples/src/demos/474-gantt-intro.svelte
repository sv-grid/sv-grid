<script lang="ts">
  /**
   * 474. Project plan (Enterprise Gantt)
   * ------------------------------------
   * A 14-week software release as a Gantt: the task table on the left, the
   * time chart on the right, one bar per grid row. Four phases nest their
   * tasks through `parentField`, so each phase draws a rolled-up summary bar
   * spanning its children - with a percent weighted by DURATION, not by task
   * count, which is why a phase rarely reads as the average of its rows.
   *
   * Finish-to-start links draw as arrows and turn red when a successor sits
   * too early to be legal. Collapse a phase and its children fold away while
   * its summary keeps their full span, and any arrow into it re-points at the
   * summary bar rather than vanishing.
   *
   * Toggle to the Table - the same grid rows, just a view. Search filters
   * both: the Gantt never filters, it draws the rows the grid hands it.
   */
  import { SvGrid, type ColumnDef, type GanttConfig, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()

  type Task = {
    id: string
    name: string
    owner: string
    phase: string
    start: string
    end?: string
    progress: number
    parentId: string | null
    milestone?: boolean
    color?: string
  }

  const PHASE = {
    discovery: '#7c3aed',
    design: '#db2777',
    build: '#2563eb',
    launch: '#16a34a',
  } as const
  const MILESTONE = '#f59e0b'

  // Anchored on the Monday of the current week, so the plan always opens with
  // work in view and the today line somewhere useful.
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7) - 14)
  /** `d` days from the anchor, as a plain date string. */
  const at = (d: number) => {
    const x = new Date(base)
    x.setDate(x.getDate() + d)
    return iso(x)
  }
  /**
   * The inclusive finish of a task that starts `from` days from the anchor
   * (a Monday) and runs `days` WORKING days: every task starts on a weekday
   * and ends on one, the way a real plan is typed in.
   */
  const wd = (from: number, days: number) => {
    let d = from
    for (let left = days; left > 1; left--) {
      d += d % 7 === 4 ? 3 : 1 // Friday -> Monday
    }
    return at(d)
  }

  const mk = (t: Omit<Task, 'color'>): Task => ({
    ...t,
    color: t.milestone ? MILESTONE : PHASE[t.phase as keyof typeof PHASE],
  })

  // A phase row carries no dates of its own: its bar is the rollup of its
  // children, so there is nothing to keep in sync by hand.
  const rows: Task[] = [
    mk({ id: 'p1', name: 'Discovery', owner: 'Priya', phase: 'discovery', start: at(0), progress: 0, parentId: null }),
    mk({ id: 't1', name: 'Stakeholder interviews', owner: 'Priya', phase: 'discovery', start: at(0), end: wd(0, 5), progress: 100, parentId: 'p1' }),
    mk({ id: 't2', name: 'Competitive teardown', owner: 'Marco', phase: 'discovery', start: at(2), end: wd(2, 5), progress: 100, parentId: 'p1' }),
    mk({ id: 't3', name: 'Synthesis & brief', owner: 'Priya', phase: 'discovery', start: at(9), end: wd(9, 3), progress: 80, parentId: 'p1' }),

    mk({ id: 'p2', name: 'Design', owner: 'Dana', phase: 'design', start: at(14), progress: 0, parentId: null }),
    mk({ id: 't4', name: 'Information architecture', owner: 'Dana', phase: 'design', start: at(14), end: wd(14, 5), progress: 100, parentId: 'p2' }),
    mk({ id: 't5', name: 'Interface mocks', owner: 'Dana', phase: 'design', start: at(21), end: wd(21, 10), progress: 55, parentId: 'p2' }),
    mk({ id: 't6', name: 'Design review', owner: 'Omar', phase: 'design', start: at(35), end: wd(35, 3), progress: 0, parentId: 'p2' }),

    mk({ id: 'm1', name: 'Design sign-off', owner: '-', phase: 'design', start: at(38), progress: 0, parentId: null, milestone: true }),

    mk({ id: 'p3', name: 'Build', owner: 'Sven', phase: 'build', start: at(38), progress: 0, parentId: null }),
    mk({ id: 't7', name: 'Data model & API', owner: 'Sven', phase: 'build', start: at(38), end: wd(38, 10), progress: 40, parentId: 'p3' }),
    mk({ id: 't8', name: 'Front end', owner: 'Mia', phase: 'build', start: at(45), end: wd(45, 15), progress: 20, parentId: 'p3' }),
    mk({ id: 't9', name: 'Migration tooling', owner: 'Kai', phase: 'build', start: at(52), end: wd(52, 7), progress: 0, parentId: 'p3' }),
    mk({ id: 't10', name: 'Hardening & QA', owner: 'Lena', phase: 'build', start: at(66), end: wd(66, 8), progress: 0, parentId: 'p3' }),

    mk({ id: 'p4', name: 'Launch', owner: 'Omar', phase: 'launch', start: at(78), progress: 0, parentId: null }),
    mk({ id: 't11', name: 'Beta with design partners', owner: 'Omar', phase: 'launch', start: at(78), end: wd(78, 7), progress: 0, parentId: 'p4' }),
    mk({ id: 't12', name: 'Docs & release notes', owner: 'Lena', phase: 'launch', start: at(80), end: wd(80, 8), progress: 0, parentId: 'p4' }),
    mk({ id: 't13', name: 'Go-live runbook', owner: 'Sven', phase: 'launch', start: at(87), end: wd(87, 5), progress: 0, parentId: 'p4' }),

    mk({ id: 'm2', name: 'General availability', owner: '-', phase: 'launch', start: at(94), progress: 0, parentId: null, milestone: true }),
  ]

  // Finish-to-start ordering. `t7` and `t8` both feed hardening (a diamond),
  // and the two milestones gate the phases either side of them.
  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't3' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 't4' },
    { id: 'd4', from: 't4', to: 't5' },
    { id: 'd5', from: 't5', to: 't6' },
    { id: 'd6', from: 't6', to: 'm1' },
    { id: 'd7', from: 'm1', to: 't7' },
    { id: 'd8', from: 't7', to: 't9' },
    { id: 'd9', from: 't7', to: 't10' },
    { id: 'd10', from: 't8', to: 't10' },
    { id: 'd11', from: 't10', to: 't11' },
    { id: 'd12', from: 't11', to: 't13' },
    { id: 'd13', from: 't13', to: 'm2' },
  ]

  const columns: ColumnDef<any, Task>[] = [
    { field: 'name', header: 'Task', width: 210 },
    { field: 'owner', header: 'Owner', width: 90 },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  const ganttCfg: GanttConfig<any, Task> = {
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    milestoneField: 'milestone',
    colorField: 'color',
    // Name the two built-ins alongside the real columns: `__duration` counts
    // working days off the resolved bar, `__progress` draws a small meter.
    tableColumns: ['name', 'owner', '__duration', '__progress'],
    dependencies,
    zoom: 'week',
    weekStartsOn: 1,
    tooltip: true,
  }

  let view = $state<'gantt' | 'table'>('gantt')
  const done = $derived(rows.filter((r) => !r.milestone && r.parentId && r.progress === 100).length)
  const leaves = $derived(rows.filter((r) => !r.milestone && r.parentId).length)
</script>

<section class="gt">
  <header class="gt-head">
    <div class="gt-title">
      <strong>Atlas 3.0 release plan</strong>
      <span class="gt-sub">
        Four phases, {leaves} tasks, {done} complete - collapse a phase and its summary keeps the span
      </span>
    </div>
    <div class="gt-seg" role="tablist" aria-label="View">
      <button
        class="gt-seg-btn"
        role="tab"
        aria-selected={view === 'gantt'}
        class:gt-on={view === 'gantt'}
        onclick={() => (view = 'gantt')}
      >Gantt</button>
      <button
        class="gt-seg-btn"
        role="tab"
        aria-selected={view === 'table'}
        class:gt-on={view === 'table'}
        onclick={() => (view = 'table')}
      >Table</button>
    </div>
  </header>

  <div class="gt-body">
    {#if view === 'gantt'}
      <SvGrid
        columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        gantt={ganttCfg}
      />
    {:else}
      <SvGrid
        columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        sortable
        fitColumns
      />
    {/if}
  </div>
</section>

<style>
  .gt {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .gt-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .gt-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .gt-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .gt-seg {
    display: inline-flex;
    flex: none;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 8px;
    overflow: hidden;
  }
  .gt-seg-btn {
    padding: 5px 12px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .gt-seg-btn:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .gt-on {
    background: var(--sg-accent, #4f46e5);
    color: #fff;
  }
  .gt-on:hover { background: var(--sg-accent, #4f46e5); }
  .gt-body { flex: 1 1 auto; min-height: 0; padding: 8px; }

  /* Phone: a Gantt is a wide document by nature - let the stage pan it
     sideways rather than squeezing the chart to nothing. */
  @media (max-width: 767px) {
    .gt { min-width: 760px; flex-shrink: 0; }
  }
</style>
