<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 44. Field service / dispatch board
   * ----------------------------------
   * The dispatcher's daily view at a field-service company (HVAC,
   * telecom, utility, broadband). Every active job is a row sorted
   * by SLA. The board updates live as techs check in / out and as
   * customers move around their windows.
   *
   * What the dispatcher does here:
   *
   *   1. **Reassign a job.** Click the Tech cell, pick from the
   *      dropdown - gated by `editable: (ctx) => boolean` so jobs
   *      already marked "done" can't be re-assigned.
   *
   *   2. **Bump priority.** Same story for the Priority cell:
   *      editable while the job is still open, locked once closed.
   *
   *   3. **Read the timeline.** Each row's "Today" cell renders an
   *      inline status timeline: a striped bar marking
   *      received → en-route → on-site → resolved with the lengths
   *      of each segment proportional to the time spent in that
   *      state. Tells the dispatcher who is dwelling.
   *
   *   4. **Watch tech capacity.** The right-hand panel shows each
   *      tech as a load gauge so over-loaded ones go red at a
   *      glance.
   *
   * Live stream uses the same `createStreamSim` helper as demo #34
   * and #42 - emits status transitions and ETA shifts.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type CellContext,
  } from '@svgrid/grid'
  import { createStreamSim } from '../shared/stream-sim'
  import { createPrng } from '../shared/mock-api'

  // ---- Domain ---------------------------------------------------------

  type JobStatus = 'received' | 'scheduled' | 'enroute' | 'onsite' | 'resolved' | 'cancelled'
  type Priority = 'p4_routine' | 'p3_standard' | 'p2_urgent' | 'p1_critical'
  type ServiceKind = 'install' | 'repair' | 'maintenance' | 'inspection' | 'survey'

  type Job = {
    id: string
    customer: string
    address: string
    kind: ServiceKind
    priority: Priority
    status: JobStatus
    techId: string
    /** ms epoch when this job was opened. */
    openedAt: number
    /** ms epoch when the SLA expires. */
    dueAt: number
    /** ms epoch when the tech arrived (if onsite or past). */
    arrivedAt?: number
    /** ms epoch when the work was resolved. */
    resolvedAt?: number
    rowVersion: number
  }

  type Tech = { id: string; name: string; van: string; capacity: number }

  // ---- Seeds ----------------------------------------------------------

  const TECHS: Tech[] = [
    { id: 't-1', name: 'A. Park',   van: 'VAN-12', capacity: 6 },
    { id: 't-2', name: 'J. Chen',   van: 'VAN-08', capacity: 6 },
    { id: 't-3', name: 'R. Diaz',   van: 'VAN-14', capacity: 5 },
    { id: 't-4', name: 'C. Singh',  van: 'VAN-21', capacity: 5 },
    { id: 't-5', name: 'D. Olsen',  van: 'VAN-03', capacity: 4 },
    { id: 't-6', name: 'A. Mehta',  van: 'VAN-17', capacity: 6 },
    { id: 't-7', name: 'Q. Tran',   van: 'VAN-05', capacity: 5 },
  ]
  const KINDS: readonly ServiceKind[] = ['install', 'repair', 'maintenance', 'inspection', 'survey']
  const STATUSES: readonly JobStatus[] = ['received', 'scheduled', 'enroute', 'onsite', 'resolved']
  const PRIORITIES: readonly Priority[] = ['p4_routine', 'p3_standard', 'p2_urgent', 'p1_critical']
  const STREETS = [
    'Main St', 'Oak Ave', 'Pine Rd', 'Cedar Ln', 'Maple Dr',
    'Elm St', 'Birch Way', 'Spruce Ct', 'Willow Pl', 'Ash Blvd',
  ]
  const TOWNS = ['Brookfield', 'Riverside', 'Lakeshore', 'Hillcrest', 'Westgate']

  const prng = createPrng(0xF1E1D5E5)

  function pickFromSet<T>(s: Set<T>): T | null {
    if (s.size === 0) return null
    const idx = Math.floor(Math.random() * s.size)
    let i = 0
    for (const v of s) {
      if (i === idx) return v
      i += 1
    }
    return null
  }

  function seedJob(i: number): Job {
    const openedAt = Date.now() - prng.int(15, 360) * 60_000
    const slaHours = prng.pick([4, 8, 24, 48])
    const dueAt = openedAt + slaHours * 3600_000
    const priority: Priority = prng.pick(PRIORITIES)
    const status: JobStatus = prng.pick(STATUSES)
    const tech = prng.pick(TECHS)
    const arrived = (status === 'onsite' || status === 'resolved')
      ? openedAt + prng.int(30, 90) * 60_000 : undefined
    const resolved = status === 'resolved'
      ? (arrived ?? openedAt) + prng.int(30, 120) * 60_000 : undefined
    return {
      id: `WO-${(40_000 + i).toString(36).toUpperCase()}`,
      customer: ['Helios', 'Atlas', 'Nordic', 'Pacific', 'Vertex'][i % 5]! + ' ' + ['Holdings', 'Industries', 'Group'][i % 3]!,
      address: `${prng.int(100, 9999)} ${prng.pick(STREETS)}, ${prng.pick(TOWNS)}`,
      kind: prng.pick(KINDS),
      priority,
      status,
      techId: tech.id,
      openedAt,
      dueAt,
      arrivedAt: arrived,
      resolvedAt: resolved,
      rowVersion: 1,
    }
  }
  function seedQueue(n: number): Job[] {
    const out: Job[] = []
    for (let i = 0; i < n; i += 1) out.push(seedJob(i))
    return out
  }

  // ---- State ---------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let jobs = $state.raw<Job[]>(seedQueue(40))
  const indexById = new Map<string, number>()
  function reindex() {
    indexById.clear()
    for (let i = 0; i < jobs.length; i += 1) indexById.set(jobs[i]!.id, i)
  }
  reindex()
  let now = $state(Date.now())
  let connection = $state<'connecting' | 'open' | 'paused' | 'closed' | 'reconnecting'>('closed')

  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 30_000)
    return () => clearInterval(id)
  })

  // ---- Stream of status updates --------------------------------------

  type StreamEvt =
    | { type: 'status'; id: string; next: JobStatus }
    | { type: 'arrive'; id: string }
    | { type: 'resolve'; id: string }

  function generateEvent(): StreamEvt {
    const liveIds = new Set<string>(jobs.filter((j) => j.status !== 'resolved' && j.status !== 'cancelled').map((j) => j.id))
    const targetId = pickFromSet(liveIds) ?? jobs[0]?.id ?? ''
    const roll = Math.random()
    if (roll < 0.5) return { type: 'arrive', id: targetId }
    if (roll < 0.85) {
      const next = prng.pick(['scheduled', 'enroute', 'onsite']) as JobStatus
      return { type: 'status', id: targetId, next }
    }
    return { type: 'resolve', id: targetId }
  }

  // svelte-ignore state_referenced_locally
  const stream = createStreamSim<StreamEvt>({ generate: generateEvent, rate: 1, jitter: 0.6 })

  function applyEvent(e: StreamEvt): void {
    const idx = indexById.get(e.id)
    if (idx === undefined) return
    const current = jobs[idx]!
    if (current.status === 'resolved' || current.status === 'cancelled') return
    const next = jobs.slice()
    const upd: Job = { ...current, rowVersion: current.rowVersion + 1 }
    if (e.type === 'status') {
      // Move forward only.
      const order: JobStatus[] = ['received', 'scheduled', 'enroute', 'onsite', 'resolved']
      if (order.indexOf(e.next) > order.indexOf(current.status)) upd.status = e.next
    } else if (e.type === 'arrive') {
      if (current.status === 'enroute' || current.status === 'scheduled') {
        upd.status = 'onsite'
        upd.arrivedAt = Date.now()
      }
    } else if (e.type === 'resolve') {
      if (current.status === 'onsite') {
        upd.status = 'resolved'
        upd.resolvedAt = Date.now()
      }
    }
    next[idx] = upd
    jobs = next
  }

  $effect(() => {
    const off = stream.subscribe((msg) => {
      if (msg.kind === 'status') connection = msg.status
      else applyEvent(msg.data)
    })
    stream.start()
    return () => { off(); stream.stop() }
  })

  function togglePause(): void {
    if (connection === 'paused') stream.resume()
    else stream.pause()
  }

  // ---- Edits ---------------------------------------------------------

  function onCellValueChange(args: { rowIndex: number; columnId: string; newValue: unknown }): void {
    const job = jobs[args.rowIndex]
    if (!job) return
    if (args.columnId === 'techId') {
      const techId = String(args.newValue)
      const next = jobs.slice()
      next[args.rowIndex] = { ...job, techId }
      jobs = next
    } else if (args.columnId === 'priority') {
      const v = String(args.newValue) as Priority
      if (!PRIORITIES.includes(v)) return
      const next = jobs.slice()
      next[args.rowIndex] = { ...job, priority: v }
      jobs = next
    } else if (args.columnId === 'status') {
      const v = String(args.newValue) as JobStatus
      if (!STATUSES.includes(v)) return
      const next = jobs.slice()
      next[args.rowIndex] = { ...job, status: v }
      jobs = next
    }
  }

  function isOpenJob(ctx: CellContext<Job>): boolean {
    const s = ctx.row.original.status
    return s !== 'resolved' && s !== 'cancelled'
  }

  // ---- KPIs ----------------------------------------------------------

  const techIndexById = new Map(TECHS.map((t) => [t.id, t]))
  const loadByTech = $derived.by(() => {
    const map = new Map<string, number>()
    for (const t of TECHS) map.set(t.id, 0)
    for (const j of jobs) {
      if (j.status === 'resolved' || j.status === 'cancelled') continue
      map.set(j.techId, (map.get(j.techId) ?? 0) + 1)
    }
    return map
  })

  const kpis = $derived.by(() => {
    let open = 0, enroute = 0, onsite = 0, resolved = 0, breached = 0
    for (const j of jobs) {
      if (j.status === 'resolved') resolved += 1
      else open += 1
      if (j.status === 'enroute') enroute += 1
      if (j.status === 'onsite') onsite += 1
      if (j.status !== 'resolved' && j.status !== 'cancelled' && now > j.dueAt) breached += 1
    }
    return {
      total: jobs.length,
      open, enroute, onsite, resolved, breached,
    }
  })

  // ---- Formatters ----------------------------------------------------

  function fmtTimeOfDay(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  function fmtSla(j: Job): string {
    if (j.status === 'resolved') return 'closed'
    const remain = j.dueAt - now
    if (remain <= 0) {
      const overdue = Math.floor(-remain / 60_000)
      return `−${Math.floor(overdue / 60)}h ${overdue % 60}m`
    }
    const minutes = Math.floor(remain / 60_000)
    if (minutes < 60) return `${minutes}m`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  }
  function slaTone(j: Job): 'ok' | 'warn' | 'hot' | 'breach' {
    if (j.status === 'resolved') return 'ok'
    const remain = j.dueAt - now
    if (remain <= 0) return 'breach'
    const ratio = remain / (j.dueAt - j.openedAt)
    if (ratio < 0.2) return 'hot'
    if (ratio < 0.5) return 'warn'
    return 'ok'
  }

  function timelineSegments(j: Job): Array<{ tone: string; pct: number }> {
    // Build a normalized timeline from `openedAt` to `now` (or `resolvedAt`).
    const end = j.resolvedAt ?? now
    const total = Math.max(1, end - j.openedAt)
    const segments: Array<{ tone: string; pct: number }> = []
    let cursor = j.openedAt
    // Received → Enroute (until arrivedAt or now)
    const arrived = j.arrivedAt
    if (arrived && arrived > cursor) {
      segments.push({ tone: 'received', pct: ((arrived - cursor) / total) * 100 })
      cursor = arrived
    }
    // Onsite → Resolved
    const resolved = j.resolvedAt
    if (resolved && resolved > cursor) {
      segments.push({ tone: 'onsite', pct: ((resolved - cursor) / total) * 100 })
      cursor = resolved
    } else if (j.status === 'onsite') {
      segments.push({ tone: 'onsite', pct: ((end - cursor) / total) * 100 })
    }
    // Remaining "in-progress" sliver
    if (cursor < end) {
      const tone = j.status === 'enroute' ? 'enroute' : j.status === 'scheduled' ? 'scheduled' : 'received'
      segments.push({ tone, pct: ((end - cursor) / total) * 100 })
    }
    return segments
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(props: { row: Job })}
  <span class="mono">{props.row.id}</span>
  <span class="fs-kind">{props.row.kind}</span>
{/snippet}

{#snippet CustomerCell(props: { row: Job })}
  <span class="fs-customer">{props.row.customer}</span>
  <span class="fs-addr">{props.row.address}</span>
{/snippet}

{#snippet PriorityCell(props: { row: Job })}
  <span class={`fs-priority fs-priority-${props.row.priority}`}>{props.row.priority.replace('p', 'P').replace('_', '·')}</span>
{/snippet}

{#snippet StatusCell(props: { row: Job })}
  <span class={`fs-status fs-status-${props.row.status}`}>{props.row.status.replace('_', ' ')}</span>
{/snippet}

{#snippet TechCell(props: { row: Job })}
  {@const tech = techIndexById.get(props.row.techId)}
  <span class="fs-tech">
    <span class="fs-tech-name">{tech?.name ?? '?'}</span>
    <span class="fs-tech-van">{tech?.van ?? ''}</span>
  </span>
{/snippet}

{#snippet SlaCell(props: { row: Job })}
  {@const tone = slaTone(props.row)}
  <span class={`fs-sla fs-sla-${tone}`}>
    <span class="fs-sla-dot"></span>
    <span class="tabular-nums">{fmtSla(props.row)}</span>
  </span>
{/snippet}

{#snippet TimelineCell(props: { row: Job })}
  <span class="fs-timeline">
    {#each timelineSegments(props.row) as seg, i (i)}
      <span class={`fs-seg fs-seg-${seg.tone}`} style={`width: ${seg.pct}%`}></span>
    {/each}
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="fs-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="fs-kpi-strip">
    <div class="fs-kpi">
      <div class="fs-kpi-label">Open today</div>
      <div class="fs-kpi-value tabular-nums">{kpis.open}</div>
      <div class="fs-kpi-foot">{kpis.resolved} resolved · {kpis.total} total</div>
    </div>
    <div class="fs-kpi">
      <div class="fs-kpi-label">En route</div>
      <div class="fs-kpi-value tabular-nums">{kpis.enroute}</div>
      <div class="fs-kpi-foot">{kpis.onsite} onsite right now</div>
    </div>
    <div class="fs-kpi">
      <div class="fs-kpi-label">Breached</div>
      <div class={`fs-kpi-value tabular-nums ${kpis.breached > 0 ? 'fs-down' : ''}`}>{kpis.breached}</div>
      <div class="fs-kpi-foot">SLA missed</div>
    </div>
    <div class="fs-kpi">
      <div class="fs-kpi-label">Stream</div>
      <div class={`fs-kpi-value fs-conn-${connection}`}>{connection.toUpperCase()}</div>
      <div class="fs-kpi-foot">field check-ins</div>
    </div>
    <div class="fs-kpi">
      <div class="fs-kpi-label">As of</div>
      <div class="fs-kpi-value tabular-nums">{fmtTimeOfDay(now)}</div>
      <div class="fs-kpi-foot">refresh every 30s</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="fs-toolbar">
    <button type="button" class="fs-btn fs-btn-primary" onclick={togglePause}>
      {connection === 'paused' ? '▶ Resume' : '⏸ Pause stream'}
    </button>
    <span class="fs-hint">Reassign by clicking the Tech / Priority cells on open jobs.</span>
  </div>

  <!-- Body: grid + tech capacity sidebar -->
  <div class="fs-body">
    <div class="fs-grid-wrap">
      <SvGrid responsive={true}
        data={jobs}
        columns={[
          { field: 'id', header: 'Work order', width: 130, editable: false,
            cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }) },
          { field: 'customer', header: 'Customer', width: 220, editable: false,
            cell: (ctx) => renderSnippet(CustomerCell, { row: ctx.row.original }) },
          { field: 'priority', header: 'Priority', width: 130,
            editorType: 'list',
            editorOptions: PRIORITIES as unknown as ReadonlyArray<string>,
            editable: isOpenJob,
            cell: (ctx) => renderSnippet(PriorityCell, { row: ctx.row.original }) },
          { field: 'status', header: 'Status', width: 120,
            editorType: 'list',
            editorOptions: STATUSES as unknown as ReadonlyArray<string>,
            editable: isOpenJob,
            cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
          { field: 'techId', header: 'Tech', width: 130,
            editorType: 'list',
            // Use {value, label} so the dropdown shows tech names
            // (the cell renders the name via TechCell, so the
            // editor needs to match the user's visual model).
            editorOptions: TECHS.map((t) => ({ value: t.id, label: t.name })),
            editable: isOpenJob,
            cell: (ctx) => renderSnippet(TechCell, { row: ctx.row.original }) },
          { field: 'dueAt', header: 'SLA', editorType: 'number', width: 110, editable: false,
            cell: (ctx) => renderSnippet(SlaCell, { row: ctx.row.original }) },
          { field: 'arrivedAt', header: 'Today', editorType: 'number', width: 240, editable: false,
            cell: (ctx) => renderSnippet(TimelineCell, { row: ctx.row.original }) },
        ] satisfies ColumnDef<typeof features, Job>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        enableInlineEditing={true}
        enableCellSelection={true}
        rowHeight={48}
        containerHeight="100%"
        fitColumns={false}
        onCellValueChange={onCellValueChange}
      />
    </div>

    <aside class="fs-cap">
      <header class="fs-cap-head">Tech capacity</header>
      <div class="fs-cap-list">
        {#each TECHS as tech (tech.id)}
          {@const load = loadByTech.get(tech.id) ?? 0}
          {@const pct = Math.min(100, (load / tech.capacity) * 100)}
          {@const tone = pct >= 100 ? 'over' : pct >= 80 ? 'hot' : 'ok'}
          <div class="fs-cap-row">
            <div class="fs-cap-meta">
              <span class="fs-cap-name">{tech.name}</span>
              <span class="fs-cap-van">{tech.van}</span>
              <span class="fs-cap-count tabular-nums">{load}/{tech.capacity}</span>
            </div>
            <div class="fs-cap-bar">
              <div class={`fs-cap-fill fs-cap-${tone}`} style={`width: ${pct}%`}></div>
            </div>
          </div>
        {/each}
      </div>
    </aside>
  </div>
</section>

<style>
  /* KPI strip */
  .fs-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .fs-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .fs-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .fs-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
  }
  .fs-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .fs-down { color: #dc2626; }
  :global([data-theme='dark']) .fs-down { color: #f87171; }
  .fs-conn-open { color: #16a34a; }
  .fs-conn-paused { color: #ca8a04; }
  .fs-conn-reconnecting { color: #d97706; }
  .fs-conn-connecting { color: #2563eb; }
  .fs-conn-closed { color: #64748b; }

  /* Toolbar */
  .fs-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .fs-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .fs-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .fs-hint {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
  }

  /* Body */
  .fs-body {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 10px;
  }
  .fs-grid-wrap { min-width: 0; }

  /* Cells */
  :global(.mono) { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  :global(.fs-kind) {
    display: block;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.fs-customer) { font-weight: 600; }
  :global(.fs-addr) {
    display: block;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
  }

  :global(.fs-priority) {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  :global(.fs-priority-p4_routine)  { background: #e2e8f0; color: #475569; }
  :global(.fs-priority-p3_standard) { background: #dbeafe; color: #1d4ed8; }
  :global(.fs-priority-p2_urgent)   { background: #fef3c7; color: #92400e; }
  :global(.fs-priority-p1_critical) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .fs-priority-p4_routine)  { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global([data-theme='dark'] .fs-priority-p3_standard) { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .fs-priority-p2_urgent)   { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .fs-priority-p1_critical) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.fs-status) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.fs-status-received)  { background: #e0e7ff; color: #3730a3; }
  :global(.fs-status-scheduled) { background: #dbeafe; color: #1d4ed8; }
  :global(.fs-status-enroute)   { background: #fef3c7; color: #92400e; }
  :global(.fs-status-onsite)    { background: #fde68a; color: #78350f; }
  :global(.fs-status-resolved)  { background: #dcfce7; color: #166534; }
  :global(.fs-status-cancelled) { background: #fee2e2; color: #b91c1c; }

  :global(.fs-tech) {
    display: inline-flex;
    flex-direction: column;
    gap: 1px;
  }
  :global(.fs-tech-name) { font-weight: 600; }
  :global(.fs-tech-van)  { font-size: 10.5px; color: var(--sg-muted, #64748b); font-family: ui-monospace, Menlo, monospace; }

  :global(.fs-sla) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  :global(.fs-sla-dot) {
    width: 7px; height: 7px; border-radius: 50%; background: currentColor;
  }
  :global(.fs-sla-ok)     { color: #16a34a; }
  :global(.fs-sla-warn)   { color: #ca8a04; }
  :global(.fs-sla-hot)    { color: #ea580c; }
  :global(.fs-sla-breach) { color: #dc2626; }

  :global(.fs-timeline) {
    display: inline-flex;
    width: 220px;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--sg-border, #e2e8f0);
  }
  :global(.fs-seg) {
    display: inline-block;
    height: 100%;
  }
  :global(.fs-seg-received)  { background: #94a3b8; }
  :global(.fs-seg-scheduled) { background: #60a5fa; }
  :global(.fs-seg-enroute)   { background: #f59e0b; }
  :global(.fs-seg-onsite)    { background: #16a34a; }

  /* Tech capacity panel */
  .fs-cap {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    overflow: auto;
    padding: 12px;
  }
  .fs-cap-head {
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 10px;
  }
  .fs-cap-list { display: flex; flex-direction: column; gap: 10px; }
  .fs-cap-row { display: flex; flex-direction: column; gap: 4px; }
  .fs-cap-meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
  }
  .fs-cap-name { font-weight: 600; }
  .fs-cap-van {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    font-family: ui-monospace, Menlo, monospace;
  }
  .fs-cap-count {
    margin-left: auto;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .fs-cap-bar {
    position: relative;
    height: 6px;
    background: var(--sg-border, #e2e8f0);
    border-radius: 3px;
    overflow: hidden;
  }
  .fs-cap-fill {
    position: absolute; inset: 0 auto 0 0;
    transition: width 400ms ease-out;
  }
  .fs-cap-ok   { background: #16a34a; }
  .fs-cap-hot  { background: #ca8a04; }
  .fs-cap-over { background: #dc2626; }
</style>
