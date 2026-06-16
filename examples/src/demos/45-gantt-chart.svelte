<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 45. Grid as a Gantt chart
   * --------------------------
   * Same grid engine, different cell strategy: every task row gets
   * one wide "Schedule" cell whose snippet renders an absolutely-
   * positioned bar laid out by the task's start / end dates. The
   * left columns are the regular project meta (name, owner, dates,
   * progress) and the right column is the visual timeline.
   *
   * Things this demo proves SvGrid can do without a Gantt plug-in:
   *
   *   1. **Custom cell rendering owns the timeline.** The grid never
   *      sees calendar columns - just one wide cell per row. Bar
   *      position is `left:` / `width:` in percentages computed
   *      from the project window (jan 1 - dec 31, this year).
   *
   *   2. **Phase coloring + progress fill.** Each bar carries the
   *      phase color outside, with an interior fill clipped to the
   *      task's `progress` percentage. Reads like a real Gantt view.
   *
   *   3. **A "today" line.** A vertical dashed line crosses every
   *      row at today's date so the user sees what's behind and
   *      what's still in front. Updates live via a 60-second tick.
   *
   *   4. **Sort + filter still works.** Tasks can be sorted by start,
   *      filtered by owner, etc. - the timeline cells reflow because
   *      they're just regular grid cells.
   *
   * No external Gantt library - the whole thing is ~600 lines.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-core'

  // ---- Domain ---------------------------------------------------------

  type Phase = 'planning' | 'design' | 'build' | 'test' | 'release'

  type Task = {
    id: string
    name: string
    owner: string
    phase: Phase
    /** epoch ms */
    start: number
    /** epoch ms */
    end: number
    progress: number          // 0-100
    /** ID of the task this one waits on (or null). Drawn as a label
     *  in the meta column; arrows would be a separate layer. */
    dependsOn: string | null
  }

  // ---- Project window -------------------------------------------------

  const YEAR = new Date().getUTCFullYear()
  const PROJECT_START = Date.UTC(YEAR, 0, 1)   // Jan 1
  const PROJECT_END = Date.UTC(YEAR, 11, 31)   // Dec 31
  const PROJECT_SPAN_MS = PROJECT_END - PROJECT_START

  const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  // ---- Seed (a realistic SaaS release plan) ---------------------------

  function d(month: number, day: number): number {
    return Date.UTC(YEAR, month - 1, day)
  }

  const TASKS: Task[] = [
    { id: 'P-01', name: 'Quarterly planning',          owner: 'A. Park',   phase: 'planning', start: d(1,  5),  end: d(1, 25),  progress: 100, dependsOn: null },
    { id: 'P-02', name: 'Roadmap freeze',              owner: 'A. Park',   phase: 'planning', start: d(1, 25),  end: d(2, 10),  progress: 100, dependsOn: 'P-01' },
    { id: 'D-01', name: 'Brand refresh + UI tokens',   owner: 'R. Diaz',   phase: 'design',   start: d(2,  1),  end: d(3, 20),  progress: 100, dependsOn: 'P-02' },
    { id: 'D-02', name: 'New dashboard mocks',         owner: 'C. Singh',  phase: 'design',   start: d(2, 15),  end: d(4,  5),  progress: 95,  dependsOn: 'P-02' },
    { id: 'D-03', name: 'Mobile flows',                owner: 'D. Olsen',  phase: 'design',   start: d(3,  1),  end: d(4, 15),  progress: 80,  dependsOn: 'D-01' },
    { id: 'B-01', name: 'Auth service rewrite',        owner: 'J. Chen',   phase: 'build',    start: d(3, 15),  end: d(6,  1),  progress: 70,  dependsOn: 'P-02' },
    { id: 'B-02', name: 'Reporting v2 backend',        owner: 'Q. Tran',   phase: 'build',    start: d(4,  1),  end: d(7, 15),  progress: 50,  dependsOn: 'P-02' },
    { id: 'B-03', name: 'Dashboard frontend',          owner: 'A. Mehta',  phase: 'build',    start: d(4, 10),  end: d(7, 31),  progress: 45,  dependsOn: 'D-02' },
    { id: 'B-04', name: 'Mobile app v2',               owner: 'D. Olsen',  phase: 'build',    start: d(4, 20),  end: d(8, 30),  progress: 35,  dependsOn: 'D-03' },
    { id: 'B-05', name: 'Migration tooling',           owner: 'R. Khan',   phase: 'build',    start: d(5,  1),  end: d(7, 15),  progress: 40,  dependsOn: 'B-01' },
    { id: 'B-06', name: 'Marketplace integrations',    owner: 'M. Park',   phase: 'build',    start: d(5, 15),  end: d(9, 10),  progress: 25,  dependsOn: 'B-01' },
    { id: 'T-01', name: 'Internal beta',               owner: 'R. Diaz',   phase: 'test',     start: d(7,  1),  end: d(8, 15),  progress: 60,  dependsOn: 'B-03' },
    { id: 'T-02', name: 'Performance hardening',       owner: 'J. Chen',   phase: 'test',     start: d(7, 15),  end: d(9, 15),  progress: 40,  dependsOn: 'B-02' },
    { id: 'T-03', name: 'Customer pilot',              owner: 'A. Park',   phase: 'test',     start: d(8,  1),  end: d(9, 30),  progress: 30,  dependsOn: 'T-01' },
    { id: 'T-04', name: 'Compliance review',           owner: 'M. Park',   phase: 'test',     start: d(8, 15),  end: d(10, 15), progress: 20,  dependsOn: null  },
    { id: 'R-01', name: 'GA marketing',                owner: 'C. Singh',  phase: 'release',  start: d(9, 15),  end: d(10, 31), progress: 10,  dependsOn: null  },
    { id: 'R-02', name: 'Public release + handover',   owner: 'A. Park',   phase: 'release',  start: d(10,  1), end: d(11, 30), progress:  5,  dependsOn: 'T-03' },
    { id: 'R-03', name: 'Q4 retro + 2027 planning',    owner: 'A. Park',   phase: 'release',  start: d(11,  1), end: d(12, 20), progress:  0,  dependsOn: 'R-02' },
  ]

  // ---- State ----------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const tasks = $state<Task[]>(TASKS)

  let now = $state(Date.now())
  // Live tick so the "today" line stays current across long sessions.
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 60_000)
    return () => clearInterval(id)
  })

  // ---- Layout: keep the month-axis row and the Schedule column exactly
  // the same width so the "today" line and month ticks land on identical
  // pixels in both rows. If we drift, the same `left%` value maps to
  // different pixels and the lines visibly desync.

  /** Fixed left columns. The header axis reserves exactly this much. */
  const LEFT_W = { id: 90, name: 260, owner: 130, phase: 120, progress: 170, start: 180 }
  const LEFT_COLS_WIDTH = LEFT_W.id + LEFT_W.name + LEFT_W.owner + LEFT_W.phase + LEFT_W.progress + LEFT_W.start

  // The Schedule column GROWS to fill the available width. Instead of measuring
  // the wrapper (fragile - misses the grid's real client width + scrollbars),
  // we let the grid fill itself: `fitColumns` stretches the unpinned columns,
  // and we PIN the fixed columns so ONLY the Schedule column absorbs the slack.
  // The header axis just flex-fills the same remaining space.
  let pinnedLeft = false
  function pinLeftColumns(api: SvGridApi<typeof features, Task>) {
    if (pinnedLeft) return
    pinnedLeft = true
    for (const [id, w] of Object.entries(LEFT_W)) api.setColumnWidth(id, w)
  }

  // ---- Bar math --------------------------------------------------------

  function pctOf(ts: number): number {
    return ((ts - PROJECT_START) / PROJECT_SPAN_MS) * 100
  }
  function pct(start: number, end: number): { left: number; width: number } {
    const left = Math.max(0, pctOf(start))
    const right = Math.min(100, pctOf(end))
    return { left, width: Math.max(0.5, right - left) }
  }
  function todayPct(): number {
    return Math.max(0, Math.min(100, pctOf(now)))
  }

  // ---- KPIs -----------------------------------------------------------

  const kpis = $derived.by(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.progress >= 100).length
    const inFlight = tasks.filter((t) => t.progress > 0 && t.progress < 100).length
    const notStarted = tasks.filter((t) => t.progress === 0).length
    const avgProgress = total ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total) : 0
    const overdue = tasks.filter((t) => t.end < now && t.progress < 100).length
    return { total, done, inFlight, notStarted, avgProgress, overdue }
  })

  // ---- Formatters -----------------------------------------------------

  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function fmtDuration(start: number, end: number): string {
    const days = Math.round((end - start) / 86_400_000)
    if (days < 14) return `${days}d`
    return `${Math.round(days / 7)}w`
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(props: { row: Task })}
  <span class="mono gc-id">{props.row.id}</span>
{/snippet}

{#snippet NameCell(props: { row: Task })}
  <span class="gc-name">{props.row.name}</span>
  {#if props.row.dependsOn}
    <span class="gc-dep">after {props.row.dependsOn}</span>
  {/if}
{/snippet}

{#snippet PhaseCell(props: { row: Task })}
  <span class={`gc-phase gc-phase-${props.row.phase}`}>{props.row.phase}</span>
{/snippet}

{#snippet ProgressCell(props: { row: Task })}
  <span class="gc-prog">
    <span class="gc-prog-bar"><span class={`gc-prog-fill gc-phase-${props.row.phase}-bg`} style={`width: ${props.row.progress}%`}></span></span>
    <span class="tabular-nums">{props.row.progress}%</span>
  </span>
{/snippet}

{#snippet RangeCell(props: { row: Task })}
  <span class="gc-range">{fmtDate(props.row.start)} → {fmtDate(props.row.end)}</span>
  <span class="gc-dur">{fmtDuration(props.row.start, props.row.end)}</span>
{/snippet}

{#snippet TimelineCell(props: { row: Task })}
  {@const p = pct(props.row.start, props.row.end)}
  {@const overdue = props.row.end < now && props.row.progress < 100}
  <span class="gc-tl">
    <span
      class={`gc-bar gc-phase-${props.row.phase}-bg ${overdue ? 'gc-bar-overdue' : ''}`}
      style={`left: ${p.left}%; width: ${p.width}%`}
    >
      <span class="gc-bar-fill" style={`width: ${props.row.progress}%`}></span>
      <span class="gc-bar-label">{props.row.id}</span>
    </span>
    <!-- Today indicator inside each row keeps the visual continuous
         even when the row is taller than the cell padding. -->
    <span class="gc-today" style={`left: ${todayPct()}%`}></span>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="gc-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="gc-kpi-strip">
    <div class="gc-kpi">
      <div class="gc-kpi-label">Total tasks</div>
      <div class="gc-kpi-value tabular-nums">{kpis.total}</div>
      <div class="gc-kpi-foot">{kpis.done} done · {kpis.inFlight} in flight</div>
    </div>
    <div class="gc-kpi">
      <div class="gc-kpi-label">Avg progress</div>
      <div class="gc-kpi-value tabular-nums">{kpis.avgProgress}%</div>
      <div class="gc-kpi-foot">{kpis.notStarted} not started</div>
    </div>
    <div class="gc-kpi">
      <div class="gc-kpi-label">Overdue</div>
      <div class={`gc-kpi-value tabular-nums ${kpis.overdue > 0 ? 'gc-down' : ''}`}>{kpis.overdue}</div>
      <div class="gc-kpi-foot">past their end date</div>
    </div>
    <div class="gc-kpi">
      <div class="gc-kpi-label">Project window</div>
      <div class="gc-kpi-value gc-window">{YEAR}</div>
      <div class="gc-kpi-foot">Jan 1 → Dec 31</div>
    </div>
    <div class="gc-kpi">
      <div class="gc-kpi-label">Today</div>
      <div class="gc-kpi-value tabular-nums">{fmtDate(now)}</div>
      <div class="gc-kpi-foot tabular-nums">{Math.round(todayPct())}% through the year</div>
    </div>
  </div>

  <div class="flex-1 min-h-0 flex flex-col">
    <!-- Month axis strip. Lives in the same wrapper as the grid so its
         width tracks the grid exactly; that's what keeps the today line
         and month ticks aligned with the in-cell bars below. -->
    <div class="gc-axis-wrap">
      <div class="gc-axis-spacer" style={`flex: 0 0 ${LEFT_COLS_WIDTH}px`}></div>
      <div class="gc-axis">
        {#each MONTH_LABELS as label, i (label)}
          <div class="gc-axis-tick" style={`left: ${(i / 12) * 100}%`}>
            <span>{label}</span>
          </div>
        {/each}
        <div class="gc-axis-today" style={`left: ${todayPct()}%`}>
          <span>today</span>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0">
      <SvGrid
        data={tasks}
        columns={[
          { field: 'id', header: 'ID', width: LEFT_W.id, editable: false,
            cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }) },
          { field: 'name', header: 'Task', width: LEFT_W.name, editable: false,
            cell: (ctx) => renderSnippet(NameCell, { row: ctx.row.original }) },
          { field: 'owner', header: 'Owner', width: LEFT_W.owner, editable: false },
          { field: 'phase', header: 'Phase', width: LEFT_W.phase, editable: false,
            cell: (ctx) => renderSnippet(PhaseCell, { row: ctx.row.original }) },
          { field: 'progress', header: 'Progress', width: LEFT_W.progress, editable: false,
            cell: (ctx) => renderSnippet(ProgressCell, { row: ctx.row.original }) },
          { field: 'start', header: 'Range', width: LEFT_W.start, editable: false,
            cell: (ctx) => renderSnippet(RangeCell, { row: ctx.row.original }) },
          // Base width is a seed - fitColumns stretches this one column to fill.
          { field: 'end', header: 'Schedule', width: 400, editable: false,
            cell: (ctx) => renderSnippet(TimelineCell, { row: ctx.row.original }) },
        ] satisfies ColumnDef<typeof features, Task>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={44}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={pinLeftColumns}
      />
    </div>
  </div>
</section>

<style>
  /* KPI strip */
  .gc-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .gc-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .gc-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .gc-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
  }
  .gc-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .gc-window {
    color: var(--sg-accent, #2563eb);
  }
  .gc-down { color: #dc2626; }
  :global([data-theme='dark']) .gc-down { color: #f87171; }

  /* Month axis. NO border-left and NO spacer border-right - the grid's
   * cells have no equivalent edges, so any pixels we add here push the
   * today line out of sync with the in-cell bars. */
  .gc-axis-wrap {
    display: flex;
    flex-shrink: 0;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    overflow: hidden;
    margin-bottom: 6px;
    height: 30px;
  }
  .gc-axis-spacer { flex-shrink: 0; }
  .gc-axis {
    position: relative;
    /* Grow to fill the width left after the fixed-column spacer, matching the
       Schedule column (which also fills the container). */
    flex: 1 1 0;
    min-width: 0;
    height: 30px;
  }
  .gc-axis-tick {
    position: absolute;
    top: 0; bottom: 0;
    border-left: 1px solid var(--sg-border, #e2e8f0);
    padding-left: 4px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    display: flex;
    align-items: center;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .gc-axis-today {
    position: absolute;
    top: 2px; bottom: 2px;
    border-left: 2px dashed var(--sg-accent, #2563eb);
    padding-left: 4px;
    display: flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--sg-accent, #2563eb);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Cells */
  :global(.mono) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }
  :global(.gc-id) { color: var(--sg-muted, #64748b); }
  :global(.gc-name) { font-weight: 600; }
  :global(.gc-dep) {
    display: block;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  :global(.gc-phase) {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: capitalize;
  }
  :global(.gc-phase-planning)  { background: #e0e7ff; color: #3730a3; }
  :global(.gc-phase-design)    { background: #fce7f3; color: #9d174d; }
  :global(.gc-phase-build)     { background: #dbeafe; color: #1d4ed8; }
  :global(.gc-phase-test)      { background: #fef3c7; color: #92400e; }
  :global(.gc-phase-release)   { background: #dcfce7; color: #166534; }
  :global([data-theme='dark'] .gc-phase-planning) { background: rgba(99,102,241,.18); color: #a5b4fc; }
  :global([data-theme='dark'] .gc-phase-design)   { background: rgba(236,72,153,.18); color: #f9a8d4; }
  :global([data-theme='dark'] .gc-phase-build)    { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .gc-phase-test)     { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .gc-phase-release)  { background: rgba(34,197,94,.18); color: #4ade80; }

  /* Phase fill colors used inside bars and progress rows. */
  :global(.gc-phase-planning-bg) { background: #6366f1; }
  :global(.gc-phase-design-bg)   { background: #ec4899; }
  :global(.gc-phase-build-bg)    { background: #2563eb; }
  :global(.gc-phase-test-bg)     { background: #ca8a04; }
  :global(.gc-phase-release-bg)  { background: #16a34a; }

  :global(.gc-prog) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :global(.gc-prog-bar) {
    position: relative;
    width: 80px;
    height: 6px;
    background: var(--sg-border, #e2e8f0);
    border-radius: 3px;
    overflow: hidden;
  }
  :global(.gc-prog-fill) {
    position: absolute; inset: 0 auto 0 0;
    border-radius: 3px;
    transition: width 350ms ease-out;
  }

  :global(.gc-range) {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  :global(.gc-dur) {
    display: block;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Timeline column cell */
  :global(.gc-tl) {
    position: relative;
    display: block;
    /* Cancel the grid cell's 7px left padding so the timeline owns
     * every pixel of the Schedule column - that's what keeps the today
     * line aligned with the header axis above. */
    width: calc(100% + 7px);
    margin-left: -7px;
    height: 28px;
  }
  :global(.gc-bar) {
    position: absolute;
    top: 4px; bottom: 4px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
    opacity: 0.92;
  }
  :global(.gc-bar-fill) {
    position: absolute; inset: 0 auto 0 0;
    background: rgba(0, 0, 0, 0.22);
  }
  :global(.gc-bar-label) {
    position: absolute; inset: 0 0 0 6px;
    display: flex;
    align-items: center;
    font-size: 10.5px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.04em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  :global(.gc-bar-overdue) {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.6);
  }
  :global(.gc-today) {
    position: absolute;
    top: 0; bottom: 0;
    border-left: 2px dashed var(--sg-accent, #2563eb);
    pointer-events: none;
  }
</style>
