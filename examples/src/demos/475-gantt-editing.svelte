<script lang="ts">
  /**
   * 475. Plan editing (Enterprise Gantt)
   * ------------------------------------
   * The same plan as demo 474, with `editable` on. Every gesture writes back
   * through a callback and nothing else: the view never mutates a row, so the
   * log panel on the right is the complete record of what it asked for.
   *
   *   - Drag a bar to move it. Drag a PHASE and its whole subtree goes with
   *     it, in one `onTaskMove` carrying the batch.
   *   - Drag either edge to resize; drag the diamond on the fill to set
   *     percent complete in 5% steps.
   *   - Drag the dot at a bar's end onto another bar to draw a link. The
   *     edges you drag from and drop on pick FS / SS / FF / SF. A link that
   *     would close a cycle flashes red instead.
   *   - Moving a predecessor slides its successors forward, skipping weekends
   *     and the one holiday below (`respectWorkingTime`).
   *   - Click a bar for the drawer; right-click for the menu; `Ctrl+Z` and
   *     `Ctrl+Shift+Z` undo and redo, replaying the callbacks so the data
   *     follows.
   */
  import { SvGrid, type ColumnDef, type GanttConfig, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableGanttView()

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
  }

  const COLOR = { plan: '#7c3aed', build: '#2563eb', ship: '#16a34a' } as const
  const MILESTONE = '#f59e0b'

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

  let seq = 100
  let rows = $state<Task[]>([
    { id: 'p1', name: 'Plan', owner: 'Priya', start: at(0), progress: 0, parentId: null, color: COLOR.plan },
    { id: 't1', name: 'Scope & estimates', owner: 'Priya', start: at(0), end: at(3), progress: 100, parentId: 'p1', color: COLOR.plan },
    { id: 't2', name: 'Tech design', owner: 'Marco', start: at(6), end: at(10), progress: 60, parentId: 'p1', color: COLOR.plan },

    { id: 'p2', name: 'Build', owner: 'Sven', start: at(13), progress: 0, parentId: null, color: COLOR.build },
    { id: 't3', name: 'Service layer', owner: 'Sven', start: at(13), end: at(20), progress: 30, parentId: 'p2', color: COLOR.build },
    { id: 't4', name: 'Client', owner: 'Mia', start: at(15), end: at(27), progress: 10, parentId: 'p2', color: COLOR.build },
    { id: 't5', name: 'QA pass', owner: 'Lena', start: at(28), end: at(34), progress: 0, parentId: 'p2', color: COLOR.build },

    { id: 'p3', name: 'Ship', owner: 'Omar', start: at(35), progress: 0, parentId: null, color: COLOR.ship },
    { id: 't6', name: 'Release notes', owner: 'Lena', start: at(35), end: at(38), progress: 0, parentId: 'p3', color: COLOR.ship },
    { id: 'm1', name: 'Go live', owner: '-', start: at(41), progress: 0, parentId: null, milestone: true, color: MILESTONE },
  ])

  let dependencies = $state<GanttDependency[]>([
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
    { id: 'd3', from: 't3', to: 't5' },
    { id: 'd4', from: 't4', to: 't5' },
    { id: 'd5', from: 't5', to: 't6' },
    { id: 'd6', from: 't6', to: 'm1' },
  ])

  // One working day off, to show cascades stepping over it.
  const holidays = [at(24)]

  const columns: ColumnDef<any, Task>[] = [
    { field: 'name', header: 'Task', width: 190, editorType: 'text' },
    { field: 'owner', header: 'Owner', width: 90, editorType: 'text' },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]

  // ---- the log: every callback the view fires, newest first ----------------
  type Entry = { id: number; what: string; detail: string }
  let log = $state<Entry[]>([])
  let logSeq = 0
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  function note(what: string, detail: string) {
    log = [{ id: ++logSeq, what, detail }, ...log].slice(0, 40)
  }

  const byId = (id: string) => rows.find((r) => r.id === id)
  /** Write a span back to a row. The view asked; this is the app agreeing. */
  function writeSpan(row: Task, start: Date, end: Date) {
    row.start = iso(start)
    // `end` is exclusive, and these rows store an inclusive date-only finish.
    const last = new Date(end.getTime() - 86400000)
    row.end = iso(last < start ? start : last)
  }

  const ganttCfg: GanttConfig<any, Task> = {
    startField: 'start',
    endField: 'end',
    titleField: 'name',
    progressField: 'progress',
    parentField: 'parentId',
    milestoneField: 'milestone',
    colorField: 'color',
    tableColumns: ['name', 'owner', '__duration', '__progress'],
    dependencies,
    holidays,
    respectWorkingTime: true,
    zoom: 'week',
    weekStartsOn: 1,
    editable: true,
    history: true,
    drawer: true,
    tooltip: true,

    onTaskMove: (e) => {
      writeSpan(e.row, e.start, e.end)
      for (const s of e.subtree ?? []) writeSpan(s.row, s.start, s.end)
      note(
        'onTaskMove',
        `${e.row.name} -> ${fmt(e.start)}${e.subtree?.length ? ` (+${e.subtree.length} in subtree)` : ''}`,
      )
    },
    onTaskResize: (e) => {
      writeSpan(e.row, e.start, e.end)
      note('onTaskResize', `${e.row.name} ${e.edge} edge -> ${fmt(e.start)} to ${fmt(e.end)}`)
    },
    onProgressChange: (e) => {
      e.row.progress = e.progress
      note('onProgressChange', `${e.row.name} -> ${e.progress}%`)
    },
    onDependenciesChange: (moves) => {
      for (const m of moves) {
        const r = byId(m.id)
        if (r) writeSpan(r, m.start, m.end)
      }
      note('onDependenciesChange', `${moves.length} task${moves.length === 1 ? '' : 's'} rescheduled`)
    },
    onDependencyAdd: (dep) => {
      dependencies = [...dependencies, dep]
      note('onDependencyAdd', `${dep.from} -> ${dep.to} (${dep.type ?? 'FS'})`)
    },
    onDependencyRemove: (id) => {
      dependencies = dependencies.filter((d) => d.id !== id)
      note('onDependencyRemove', id)
    },
    onTaskAdd: (start, end, parentId) => {
      const id = `n${++seq}`
      rows = [
        ...rows,
        {
          id,
          name: 'New task',
          owner: 'TBD',
          start: iso(start),
          end: iso(new Date(end.getTime() - 86400000)),
          progress: 0,
          parentId: parentId ?? null,
          color: COLOR.build,
        },
      ]
      note('onTaskAdd', `${id} on ${fmt(start)}${parentId ? ` under ${parentId}` : ''}`)
    },
    onTaskDelete: (row) => {
      rows = rows.filter((r) => r.id !== row.id)
      note('onTaskDelete', row.name)
    },
    onTaskCommit: (e) => {
      Object.assign(e.row, e.values)
      note('onTaskCommit', `${e.row.name}: ${Object.keys(e.values).join(', ')}`)
    },
  }
  // `dependencies` is reassigned when a link is drawn, so the config has to see
  // the new array rather than the one captured above.
  const cfg = $derived({ ...ganttCfg, dependencies })
</script>

<section class="ge">
  <header class="ge-head">
    <div class="ge-title">
      <strong>Editable plan</strong>
      <span class="ge-sub">
        Drag a bar or its edges, drag the diamond to set percent, drag a dot onto another bar to link.
        Ctrl+Z undoes. Nothing here mutates a row until a callback below says so.
      </span>
    </div>
  </header>

  <div class="ge-body">
    <div class="ge-chart">
      <SvGrid
        columnResize
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        containerHeight="100%"
        gantt={cfg}
      />
    </div>

    <aside class="ge-log">
      <div class="ge-log-head">
        <span>Callbacks</span>
        {#if log.length}
          <button class="ge-clear" onclick={() => (log = [])}>Clear</button>
        {/if}
      </div>
      {#if !log.length}
        <p class="ge-empty">Drag something. Every write-back the view asks for shows up here.</p>
      {:else}
        <ol class="ge-entries">
          {#each log as e (e.id)}
            <li class="ge-entry">
              <code class="ge-what">{e.what}</code>
              <span class="ge-detail">{e.detail}</span>
            </li>
          {/each}
        </ol>
      {/if}
    </aside>
  </div>
</section>

<style>
  .ge {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .ge-head { padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ge-title { display: flex; flex-direction: column; gap: 2px; }
  .ge-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }

  .ge-body { flex: 1 1 auto; display: flex; min-height: 0; }
  .ge-chart { flex: 1 1 auto; min-width: 0; padding: 8px; }

  .ge-log {
    flex: 0 0 260px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--sg-border, #e5e7eb);
    background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent);
  }
  .ge-log-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #9ca3af);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .ge-clear {
    border: 0;
    background: transparent;
    color: var(--sg-accent, #4f46e5);
    font: inherit;
    font-size: 0.7rem;
    cursor: pointer;
    text-transform: none;
    letter-spacing: 0;
  }
  .ge-empty { margin: 0; padding: 14px 12px; font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .ge-entries { margin: 0; padding: 6px 0; list-style: none; overflow-y: auto; }
  .ge-entry {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--sg-border, #e5e7eb) 50%, transparent);
  }
  .ge-what { font-size: 0.72rem; font-weight: 600; color: var(--sg-accent, #4f46e5); }
  .ge-detail { font-size: 0.75rem; color: var(--sg-fg, #374151); }

  @media (max-width: 767px) {
    .ge { min-width: 860px; flex-shrink: 0; }
  }
</style>
