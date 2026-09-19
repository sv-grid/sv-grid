<script lang="ts">
  /**
   * 480. A programme of 40 sites, 640 tasks (Enterprise Gantt Pro)
   * ---------------------------------------------------------------
   * A fibre roll-out: 40 sites, each a phase of 16 linked tasks, staggered
   * across a year. The point is what stays the same at this size:
   *
   *   - **Row windowing.** Past 300 rows only the rows near the viewport
   *     render, so scrolling 640 tasks costs what scrolling 40 does.
   *   - **The critical path over 600 links.** Every site is its own chain,
   *     so the critical one is whichever chain ends last - the site the
   *     programme finish date turns on. Collapse everything and its summary
   *     bar still carries the ring.
   *   - **Baselines at scale.** Each site carries the dates it was signed
   *     off with; the ones running late show a red ghost, and the strip at
   *     the top counts them.
   *   - **A folded axis, when it applies.** The chart opens at the month
   *     preset, where a tick is a week. Ctrl+wheel in to the week preset and
   *     `collapseWeekends` takes the Saturdays and Sundays out of the axis.
   *
   * It opens with every site collapsed, so the first screen is the programme
   * as forty summary bars - the shape of the year. Open a site for its
   * tasks; Expand all for the whole 680 rows. Type a site or a trade into
   * the search box and the grid filters, the Gantt drawing what is left.
   */
  import { SvGrid, type ColumnDef } from '@svgrid/grid'
  import { enableGanttView, setLicenseKey, type GanttProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()

  type Task = {
    id: string
    name: string
    site: string
    trade: string
    start: string
    end?: string
    progress: number
    parentId: string | null
    color?: string
    bStart?: string
    bEnd?: string
  }

  // A seeded generator, so the programme is the same on every load and the
  // critical site is always the same site.
  let seed = 20260901
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Programme start: the Monday 8 weeks back. The chart opens on today, and
  // a site runs about 13 weeks, so the first sites in the list are the ones
  // mid-build rather than a page of finished rows whose bars sit off to the
  // left; the tail of the programme runs a year on.
  const base = new Date(today)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7) - 56)
  const dayOf = (d: number) => {
    const x = new Date(base)
    x.setDate(x.getDate() + d)
    return x
  }
  const at = (d: number) => iso(dayOf(d))
  /** Skip to the next Monday when `d` lands on a weekend. */
  const weekday = (d: number) => {
    const w = dayOf(d).getDay()
    return w === 6 ? d + 2 : w === 0 ? d + 1 : d
  }

  const TRADE: Record<string, string> = {
    Survey: '#7c3aed',
    Civils: '#b45309',
    Cabling: '#2563eb',
    Splicing: '#0891b2',
    Testing: '#16a34a',
  }
  const STEPS: Array<[string, string, number]> = [
    ['Desktop survey', 'Survey', 3],
    ['Site walk', 'Survey', 2],
    ['Wayleave consents', 'Survey', 8],
    ['Traffic management plan', 'Civils', 4],
    ['Duct route excavation', 'Civils', 9],
    ['Chamber installation', 'Civils', 5],
    ['Reinstatement', 'Civils', 4],
    ['Sub-duct pull', 'Cabling', 3],
    ['Fibre pull', 'Cabling', 6],
    ['Cabinet build', 'Cabling', 4],
    ['Splice enclosures', 'Splicing', 5],
    ['Cabinet splicing', 'Splicing', 4],
    ['OTDR testing', 'Testing', 3],
    ['Power meter checks', 'Testing', 2],
    ['Snag list', 'Testing', 3],
    ['Handover pack', 'Testing', 2],
  ]
  const TOWNS = ['Ashby', 'Brixham', 'Calder', 'Denby', 'Elsdon', 'Farndale', 'Glenmoor', 'Hexley', 'Ilkley', 'Jarrow',
    'Kelso', 'Lydford', 'Marple', 'Norham', 'Oakham', 'Pentre', 'Quorn', 'Ripley', 'Selby', 'Tetbury',
    'Uphill', 'Verwood', 'Wetherby', 'Yarm', 'Alnwick', 'Bakewell', 'Clitheroe', 'Dalton', 'Egremont', 'Frome',
    'Goole', 'Helmsley', 'Ingleton', 'Keswick', 'Leyburn', 'Malton', 'Newent', 'Otley', 'Padstow', 'Rothbury']

  const rows: Task[] = []
  const dependencies: { id: string; from: string; to: string }[] = []
  for (let s = 0; s < 40; s++) {
    const siteId = `s${s + 1}`
    const town = TOWNS[s]!
    rows.push({ id: siteId, name: `${town} exchange area`, site: town, trade: '', start: at(0), progress: 0, parentId: null, color: '#475569' })
    // Sites start every 6 working days or so, so the programme spreads over the year.
    let day = weekday(s * 8 + Math.floor(rnd() * 5))
    // The whole site slipped or gained a few days against its baseline.
    const drift = rnd() < 0.3 ? 3 + Math.floor(rnd() * 8) : rnd() < 0.5 ? -2 : 0
    let prev: string | null = null
    for (let i = 0; i < STEPS.length; i++) {
      const [step, trade, len] = STEPS[i]!
      const id = `${siteId}-t${i + 1}`
      const days = len + (rnd() < 0.25 ? 1 : 0)
      const startD = weekday(day)
      const endD = startD + days - 1
      // Progress from where today falls in the task, with some noise.
      const doneBy = (today.getTime() - dayOf(startD).getTime()) / 86400000
      const progress = doneBy >= days ? 100 : doneBy <= 0 ? 0 : Math.round((doneBy / days) * 100 / 10) * 10
      rows.push({
        id, name: step, site: town, trade, start: at(startD), end: at(endD), progress, parentId: siteId, color: TRADE[trade],
        bStart: at(startD - drift), bEnd: at(endD - drift),
      })
      if (prev) dependencies.push({ id: `${id}-dep`, from: prev, to: id })
      prev = id
      day = endD + 1 + (rnd() < 0.2 ? 2 : 0)
    }
  }

  const holidays = [at(50), at(51), at(120), at(180), at(181)]
  const tasks = rows.filter((r) => r.parentId)
  const done = tasks.filter((t) => t.progress === 100).length
  const lateSites = new Set(tasks.filter((t) => t.bEnd && t.end && t.end > t.bEnd).map((t) => t.site)).size

  let criticalSite = $state<string>('')
  // Collapse is hoisted so the plan can open folded: forty bars, one per site.
  let collapsed = $state<string[]>(rows.filter((r) => r.parentId == null).map((r) => r.id))
  const columns: ColumnDef<any, Task>[] = [
    { field: 'name', header: 'Task', width: 220 },
    { field: 'site', header: 'Site', width: 100 },
    { field: 'trade', header: 'Trade', width: 90 },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  const cfg = $derived<GanttProConfig<any, Task>>({
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    colorField: 'color',
    dependencies,
    holidays,
    tableColumns: ['name', 'trade', '__duration', '__slack'],
    tableWidth: 420,
    rowHeight: 30,
    zoom: 'month',
    weekStartsOn: 1,
    labelPosition: 'none',
    tooltip: true,
    searchPlaceholder: 'Search 640 tasks by site, trade or step',

    criticalPath: true,
    // A site row is in no link of its own, so the keys are tasks; they all
    // belong to the one chain that ends last.
    onCriticalPathChange: (keys) => {
      criticalSite = rows.find((r) => r.id === keys[0])?.site ?? ''
    },
    baselineStartField: 'bStart',
    baselineEndField: 'bEnd',
    collapseWeekends: true,
    collapsedGapPx: 6,
    collapsed,
    onCollapseChange: (next) => (collapsed = next),
  })

  // The same rows as a plain table: the Gantt is one view of the grid.
  let view = $state<'gantt' | 'table'>('gantt')
</script>

<section class="pg">
  <header class="pg-head">
    <div class="pg-title">
      <strong>Fibre roll-out, {base.getFullYear()}</strong>
      <span class="pg-sub">
        40 sites, {tasks.length} tasks, {dependencies.length} links, folded to one bar per site. Open a site, or Expand all: rows past the viewport are not rendered, and the critical path is recomputed on every change.
      </span>
    </div>
    <div class="pg-stats">
      <span class="pg-stat"><b>{done}</b> tasks complete</span>
      <span class="pg-stat pg-stat-late"><b>{lateSites}</b> sites behind baseline</span>
      {#if criticalSite}
        <span class="pg-stat pg-stat-crit"><b>{criticalSite}</b> sets the finish date</span>
      {/if}
    </div>
    <div class="pg-seg" role="tablist" aria-label="View">
      <button class="pg-seg-btn" role="tab" aria-selected={view === 'gantt'} class:pg-on={view === 'gantt'} onclick={() => (view = 'gantt')}>Gantt</button>
      <button class="pg-seg-btn" role="tab" aria-selected={view === 'table'} class:pg-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>

  <div class="pg-body">
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
      <SvGrid columnResize data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" sortable fitColumns />
    {/if}
  </div>
</section>

<style>
  .pg {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .pg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .pg-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pg-seg { display: inline-flex; flex: none; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .pg-seg-btn { padding: 5px 12px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 0.8rem; cursor: pointer; }
  .pg-seg-btn:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .pg-on { background: var(--sg-accent, #4f46e5); color: #fff; }
  .pg-on:hover { background: var(--sg-accent, #4f46e5); }

  .pg-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .pg-stats { display: flex; flex: none; gap: 8px; }
  .pg-stat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.76rem;
    color: var(--sg-muted, #6b7280);
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 5%, transparent);
    white-space: nowrap;
  }
  .pg-stat b { color: var(--sg-fg, #1f2937); font-weight: 600; }
  .pg-stat-late { background: color-mix(in srgb, #dc2626 9%, transparent); }
  .pg-stat-late b { color: #dc2626; }
  .pg-stat-crit { background: color-mix(in srgb, #dc2626 9%, transparent); }
  .pg-stat-crit b { color: #dc2626; }
  .pg-body { flex: 1 1 auto; min-height: 0; padding: 8px; }

  @media (max-width: 767px) {
    .pg { min-width: 860px; flex-shrink: 0; }
  }
</style>
