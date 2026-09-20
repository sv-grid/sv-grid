<script lang="ts">
  /**
   * 477. Resource load & a folded axis (Enterprise Gantt Pro)
   * ---------------------------------------------------------
   * A field-service quarter, where the question is not "when" but
   * "who, and are they double-booked":
   *
   *   - **Resource histogram.** `resourceField` says who is on each task and
   *     `resourceHistogram` sums them into a strip under the chart: one row per
   *     crew, one bar per column, counting the jobs that touch it. Anything
   *     past that crew's capacity turns red, so a clash is visible without
   *     reading a single date.
   *   - **Capacity per resource.** The two-van crew can take two jobs at once;
   *     the specialist cannot. Same strip, different ceiling.
   *   - **A folded axis.** `collapseWeekends` takes the Saturdays and Sundays
   *     out of the timeline and leaves a hatched gap where each one was. The
   *     quarter then fits in the width a month used to take, and the working
   *     days keep their real size - nothing is squashed.
   *
   * Drag a job onto a week that is already full and watch the strip go red
   * under it.
   */
  import { SvGrid, type ColumnDef } from '@svgrid/grid'
  import { enableGanttView, setLicenseKey, type GanttProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()

  type Job = {
    id: string
    name: string
    site: string
    crew: string
    start: string
    end: string
    progress: number
    parentId: string | null
    color?: string
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  const at = (d: number) => {
    const x = new Date(base)
    x.setDate(x.getDate() + d)
    return iso(x)
  }

  const CREW = { north: '#2563eb', south: '#0891b2', spec: '#b45309' } as const

  // Two regional crews and one specialist. The specialist is deliberately
  // booked twice over in week three - that is the red bar.
  let rows = $state<Job[]>([
    { id: 'r1', name: 'North region', site: '', crew: '', start: at(0), end: at(24), progress: 0, parentId: null, color: CREW.north },
    { id: 'n1', name: 'Millbrook swap-out', site: 'Millbrook', crew: 'North crew', start: at(0), end: at(4), progress: 100, parentId: 'r1', color: CREW.north },
    { id: 'n2', name: 'Fenwick upgrade', site: 'Fenwick', crew: 'North crew', start: at(7), end: at(13), progress: 60, parentId: 'r1', color: CREW.north },
    { id: 'n3', name: 'Ashfield service', site: 'Ashfield', crew: 'North crew', start: at(10), end: at(17), progress: 20, parentId: 'r1', color: CREW.north },
    { id: 'n4', name: 'Millbrook follow-up', site: 'Millbrook', crew: 'North crew', start: at(21), end: at(24), progress: 0, parentId: 'r1', color: CREW.north },

    { id: 'r2', name: 'South region', site: '', crew: '', start: at(3), end: at(31), progress: 0, parentId: null, color: CREW.south },
    { id: 's1', name: 'Halston install', site: 'Halston', crew: 'South crew', start: at(3), end: at(10), progress: 80, parentId: 'r2', color: CREW.south },
    { id: 's2', name: 'Bracken retrofit', site: 'Bracken', crew: 'South crew', start: at(14), end: at(24), progress: 10, parentId: 'r2', color: CREW.south },
    { id: 's3', name: 'Halston handover', site: 'Halston', crew: 'South crew', start: at(28), end: at(31), progress: 0, parentId: 'r2', color: CREW.south },

    { id: 'r3', name: 'Commissioning', site: '', crew: '', start: at(4), end: at(30), progress: 0, parentId: null, color: CREW.spec },
    { id: 'c1', name: 'Millbrook sign-off', site: 'Millbrook', crew: 'Specialist', start: at(4), end: at(5), progress: 100, parentId: 'r3', color: CREW.spec },
    // These two overlap, and the specialist is one person.
    { id: 'c2', name: 'Fenwick sign-off', site: 'Fenwick', crew: 'Specialist', start: at(14), end: at(17), progress: 0, parentId: 'r3', color: CREW.spec },
    { id: 'c3', name: 'Halston sign-off', site: 'Halston', crew: 'Specialist', start: at(15), end: at(18), progress: 0, parentId: 'r3', color: CREW.spec },
    { id: 'c4', name: 'Bracken sign-off', site: 'Bracken', crew: 'Specialist', start: at(28), end: at(30), progress: 0, parentId: 'r3', color: CREW.spec },
  ])

  const columns: ColumnDef<any, Job>[] = [
    { field: 'name', header: 'Job', width: 190 },
    { field: 'site', header: 'Site', width: 100 },
    { field: 'crew', header: 'Crew', width: 110 },
  ]
  // The table view shows the dates the bars are drawn from.
  const tableColumns: ColumnDef<any, Job>[] = [
    ...columns,
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  let folded = $state(true)

  function writeSpan(row: Job, start: Date, end: Date) {
    row.start = iso(start)
    const last = new Date(end.getTime() - 86400000)
    row.end = iso(last < start ? start : last)
  }

  const cfg: GanttProConfig<any, Job> = $derived({
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    colorField: 'color',
    tableColumns: ['name', 'crew', '__duration'],
    zoom: 'week',
    weekStartsOn: 1,

    // --- the resource layer -------------------------------------------------
    resourceField: 'crew',
    resources: [
      // The north crew runs two vans, so two jobs at once is fine.
      { id: 'North crew', title: 'North crew', capacity: 2 } as never,
      { id: 'South crew', title: 'South crew', capacity: 1 } as never,
      { id: 'Specialist', title: 'Specialist', capacity: 1 } as never,
    ],
    resourceHistogram: { capacityField: 'capacity', height: 96 },

    // --- the folded axis ----------------------------------------------------
    collapseWeekends: folded,
    collapsedGapPx: 10,

    editable: true,
    tooltip: true,
    onTaskMove: (e) => {
      writeSpan(e.row, e.start, e.end)
      for (const s of e.subtree ?? []) writeSpan(s.row, s.start, s.end)
    },
    onTaskResize: (e) => writeSpan(e.row, e.start, e.end),
  })

  // The same rows as a plain table: the Gantt is one view of the grid.
  let view = $state<'gantt' | 'table'>('gantt')
</script>

<section class="rl">
  <header class="rl-head">
    <div class="rl-title">
      <strong>Field service, this quarter</strong>
      <span class="rl-sub">
        The strip under the chart counts each crew's jobs per column. Red is past
        what that crew can take - the specialist is one person with two sign-offs
        in the same week.
      </span>
    </div>
    <label class="rl-toggle">
      <input type="checkbox" bind:checked={folded} />
      Fold weekends out
    </label>
    <div class="rl-seg" role="tablist" aria-label="View">
      <button class="rl-seg-btn" role="tab" aria-selected={view === 'gantt'} class:rl-on={view === 'gantt'} onclick={() => (view = 'gantt')}>Gantt</button>
      <button class="rl-seg-btn" role="tab" aria-selected={view === 'table'} class:rl-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>

  <div class="rl-body">
    {#if view === 'gantt'}
      <SvGrid
        columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        gantt={cfg}
      />
    {:else}
      <SvGrid columnResize data={rows} columns={tableColumns} getRowId={(r) => r.id} containerHeight="100%" sortable fitColumns />
    {/if}
  </div>
</section>

<style>
  .rl {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .rl-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .rl-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rl-seg { display: inline-flex; flex: none; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .rl-seg-btn { padding: 5px 12px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 0.8rem; cursor: pointer; }
  .rl-seg-btn:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .rl-on { background: var(--sg-accent, #4f46e5); color: #fff; }
  .rl-on:hover { background: var(--sg-accent, #4f46e5); }

  .rl-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .rl-toggle {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    padding-top: 3px;
    font-size: 0.78rem;
    color: var(--sg-fg, #374151);
    white-space: nowrap;
    cursor: pointer;
  }
  .rl-body { flex: 1 1 auto; min-height: 0; padding: 8px; }

  @media (max-width: 767px) {
    .rl { min-width: 860px; flex-shrink: 0; }
  }
</style>
