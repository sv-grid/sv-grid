<script lang="ts">
  /**
   * 476. Critical path & baselines (Enterprise Gantt Pro)
   * ------------------------------------------------------
   * A fit-out schedule with the planning layer on:
   *
   *   - **Critical path.** The chain of tasks with no slack, ringed in red
   *     along with the arrows between them. Slip any of these and the
   *     handover date moves; the others have room, and the Slack column
   *     says how much.
   *   - **Baselines.** The originally agreed dates draw as a ghost bar under
   *     each task. Where the plan has drifted, the ghost turns red and the
   *     tooltip says by how many days.
   *   - **Constraints.** Two tasks are pinned: the inspection cannot start
   *     before its booked date (`SNET`) and handover must finish by its
   *     contract date (`FNLT`). Drag the chain right and the cascade stops
   *     AT the ceiling rather than running past it, leaving the link drawn
   *     as unsatisfied - which is the honest answer when a constraint and a
   *     dependency disagree.
   *
   * Drag a bar and watch the path recompute: shortening a critical task
   * hands the title to whichever chain is longest next.
   */
  import { SvGrid, type ColumnDef, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView, setLicenseKey, type GanttProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()

  type Task = {
    id: string
    name: string
    trade: string
    start: string
    end?: string
    progress: number
    parentId: string | null
    milestone?: boolean
    color?: string
    /** The originally agreed dates. */
    bStart?: string
    bEnd?: string
    con?: 'SNET' | 'FNLT'
    conDate?: string
  }

  const TRADE = {
    strip: '#7c3aed',
    build: '#2563eb',
    fit: '#0891b2',
    sign: '#16a34a',
  } as const

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7) - 7)
  const at = (d: number) => {
    const x = new Date(base)
    x.setDate(x.getDate() + d)
    return iso(x)
  }

  // The long chain runs back to back - strip, structure, services,
  // commissioning, handover - so none of it has a day to give: that is what
  // makes it critical. Joinery and signage branch off with real room.
  let rows = $state<Task[]>([
    { id: 'p1', name: 'Shell', trade: 'strip', start: at(0), progress: 0, parentId: null, color: TRADE.strip },
    { id: 't1', name: 'Strip out', trade: 'strip', start: at(0), end: at(4), progress: 100, parentId: 'p1', color: TRADE.strip, bStart: at(0), bEnd: at(3) },
    { id: 't2', name: 'Structural works', trade: 'build', start: at(5), end: at(18), progress: 70, parentId: 'p1', color: TRADE.build, bStart: at(4), bEnd: at(15) },

    { id: 'p2', name: 'Fit-out', trade: 'fit', start: at(19), progress: 0, parentId: null, color: TRADE.fit },
    { id: 't3', name: 'Services rough-in', trade: 'fit', start: at(19), end: at(32), progress: 30, parentId: 'p2', color: TRADE.fit, bStart: at(16), bEnd: at(29) },
    // The short branch: it feeds commissioning too, but finishes with days
    // to spare, so it is not what the handover date turns on.
    { id: 't4', name: 'Joinery', trade: 'fit', start: at(19), end: at(25), progress: 20, parentId: 'p2', color: TRADE.fit, bStart: at(19), bEnd: at(25) },
    { id: 't5', name: 'Signage & branding', trade: 'sign', start: at(26), end: at(30), progress: 0, parentId: 'p2', color: TRADE.sign, bStart: at(26), bEnd: at(30) },

    { id: 'p3', name: 'Handover', trade: 'sign', start: at(33), progress: 0, parentId: null, color: TRADE.sign },
    // Pinned: the inspector is booked and cannot come earlier.
    { id: 't6', name: 'Commissioning', trade: 'fit', start: at(33), end: at(39), progress: 0, parentId: 'p3', color: TRADE.fit, bStart: at(30), bEnd: at(36), con: 'SNET', conDate: at(33) },
    // Pinned: the lease says the keys change hands by this date.
    { id: 't7', name: 'Snagging & handover', trade: 'sign', start: at(40), end: at(46), progress: 0, parentId: 'p3', color: TRADE.sign, bStart: at(37), bEnd: at(42), con: 'FNLT', conDate: at(48) },

    { id: 'm1', name: 'Keys handed over', trade: 'sign', start: at(47), progress: 0, parentId: null, milestone: true, color: '#f59e0b' },
  ])

  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't2', to: 't4' },
    { id: 'd4', from: 't3', to: 't6' },
    { id: 'd5', from: 't4', to: 't5' },
    { id: 'd6', from: 't5', to: 't6' },
    { id: 'd7', from: 't6', to: 't7' },
    { id: 'd8', from: 't7', to: 'm1' },
  ]

  const columns: ColumnDef<any, Task>[] = [
    { field: 'name', header: 'Task', width: 190 },
    { field: 'trade', header: 'Trade', width: 90 },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  let criticalKeys = $state<string[]>([])
  const nameOf = (id: string) => rows.find((r) => r.id === id)?.name ?? id
  const criticalLeaves = $derived(
    criticalKeys.filter((k) => rows.find((r) => r.id === k)?.parentId != null),
  )

  const iso2 = (d: Date) => iso(d)
  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = iso2(start)
    const last = new Date(end.getTime() - 86400000)
    row.end = iso2(last < start ? start : last)
  }
  const byId = (id: string) => rows.find((r) => r.id === id)

  const cfg: GanttProConfig<any, Task> = {
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    milestoneField: 'milestone',
    colorField: 'color',
    tableColumns: ['name', 'trade', '__duration', '__slack'],
    dependencies,
    zoom: 'month',
    weekStartsOn: 1,

    // --- the planning layer -------------------------------------------------
    criticalPath: true,
    onCriticalPathChange: (keys) => (criticalKeys = keys),
    baselineStartField: 'bStart',
    baselineEndField: 'bEnd',
    constraintField: 'con',
    constraintDateField: 'conDate',

    editable: true,
    tooltip: true,
    onTaskMove: (e) => {
      writeSpan(e.row, e.start, e.end)
      for (const s of e.subtree ?? []) writeSpan(s.row, s.start, s.end)
    },
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const r = byId(m.id)
        if (r) writeSpan(r, m.start, m.end)
      }
    },
  }
</script>

<section class="cp">
  <header class="cp-head">
    <div class="cp-title">
      <strong>Unit 4 fit-out</strong>
      <span class="cp-sub">
        Red rings mark the chain with no slack - slip any of it and the handover moves.
        Grey ghosts are the agreed baseline; red ones mean the plan has drifted late.
      </span>
    </div>
    <div class="cp-legend">
      <span class="cp-key"><span class="cp-swatch cp-swatch-crit"></span>Critical</span>
      <span class="cp-key"><span class="cp-swatch cp-swatch-base"></span>Baseline</span>
      <span class="cp-key"><span class="cp-swatch cp-swatch-late"></span>Behind it</span>
    </div>
  </header>

  {#if criticalLeaves.length}
    <p class="cp-path">
      <strong>Critical path:</strong>
      {criticalLeaves.map(nameOf).join(' → ')}
    </p>
  {/if}

  <div class="cp-body">
    <SvGrid
      columnResize
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      containerHeight="100%"
      gantt={cfg}
    />
  </div>
</section>

<style>
  .cp {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .cp-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .cp-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .cp-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .cp-legend { display: flex; flex: none; gap: 12px; padding-top: 3px; }
  .cp-key { display: inline-flex; align-items: center; gap: 5px; font-size: 0.74rem; color: var(--sg-muted, #6b7280); }
  .cp-swatch { width: 12px; height: 8px; border-radius: 2px; flex: none; }
  .cp-swatch-crit { background: transparent; box-shadow: 0 0 0 2px #dc2626; }
  .cp-swatch-base { height: 5px; background: color-mix(in srgb, var(--sg-fg, #1f2937) 28%, transparent); }
  .cp-swatch-late { height: 5px; background: color-mix(in srgb, #dc2626 45%, transparent); }

  .cp-path {
    margin: 0;
    padding: 7px 14px;
    font-size: 0.78rem;
    color: var(--sg-fg, #374151);
    background: color-mix(in srgb, #dc2626 7%, transparent);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .cp-body { flex: 1 1 auto; min-height: 0; padding: 8px; }

  @media (max-width: 767px) {
    .cp { min-width: 860px; flex-shrink: 0; }
  }
</style>
