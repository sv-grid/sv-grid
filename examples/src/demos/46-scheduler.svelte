<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 46. Grid as a Scheduler
   * ------------------------
   * Same playbook as the Gantt demo, smaller window: the wide cell is
   * a single-day timeline (07:00 - 20:00) and the rows are resources
   * (people on shift). Each resource has 0-N appointments laid out
   * by start / end. Click an appointment to load it into the side
   * detail panel; click an empty time slot to create a new one.
   *
   *   1. **Per-resource timeline cell.** One absolutely-positioned
   *      block per appointment, sized by minutes-into-day. The grid
   *      itself does no time math - it just renders rows.
   *
   *   2. **Now indicator.** A live red vertical line crosses every
   *      row at the current time; ticks every 30 seconds so the
   *      demo "moves" even with no interaction.
   *
   *   3. **Click to select / edit.** Selected appointment is mirrored
   *      in a right-side detail card with editable title, type, time,
   *      and resource. Save flushes back into the row data - the
   *      grid is the source of truth, the form is a view.
   *
   *   4. **KPI strip.** Booked hours, utilisation %, next-up - the
   *      stats every scheduler dashboard needs.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type ApptType = 'consult' | 'procedure' | 'follow-up' | 'admin' | 'break'

  type Appointment = {
    id: string
    /** epoch ms - same calendar day as DAY_START */
    start: number
    /** epoch ms */
    end: number
    title: string
    type: ApptType
    client: string
  }

  type Resource = {
    id: string
    name: string
    role: string
    avatarColor: string
    appointments: Appointment[]
  }

  // ---- Day window -----------------------------------------------------

  const DAY_START_HOUR = 7   // 07:00
  const DAY_END_HOUR = 20    // 20:00
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const DAY_BASE = today.getTime()
  const DAY_START = DAY_BASE + DAY_START_HOUR * 3_600_000
  const DAY_END = DAY_BASE + DAY_END_HOUR * 3_600_000
  const DAY_SPAN_MS = DAY_END - DAY_START

  const HOUR_LABELS: number[] = []
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h += 1) HOUR_LABELS.push(h)

  // ---- Seed -----------------------------------------------------------

  const APPT_TYPES: readonly ApptType[] = ['consult', 'procedure', 'follow-up', 'admin', 'break']
  const FIRST_NAMES = ['Sasha', 'Priya', 'Jamie', 'Casey', 'Drew', 'Robin', 'Morgan', 'Riley']
  const LAST_NAMES = ['Park', 'Nair', 'Chen', 'Singh', 'Olsen', 'Diaz', 'Tran', 'Khan']
  const ROLES = ['Cardiologist', 'GP', 'Pediatrician', 'Dermatologist', 'PT', 'Endocrinologist']
  const TITLES_BY_TYPE: Record<ApptType, string[]> = {
    consult: ['Initial consult', 'Annual check', 'New patient', 'Symptom review'],
    procedure: ['ECG', 'Skin biopsy', 'Infusion', 'Joint injection', 'Scope'],
    'follow-up': ['Lab review', 'Med titration', 'Post-op follow-up'],
    admin: ['Charting', 'Care team huddle', 'Documentation'],
    break: ['Lunch', 'Break'],
  }
  const CLIENT_FIRST = ['Anna', 'Brad', 'Cara', 'Diego', 'Eve', 'Felix', 'Grace', 'Hugo', 'Ivy', 'Jules', 'Kim', 'Leo']
  const CLIENT_LAST = ['Reed', 'Owens', 'Patel', 'Wright', 'Lee', 'Brooks', 'Adler', 'Mason', 'Cole', 'Ng']
  const AVATAR_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a']

  let prng = 0xC0FFEE17
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }
  function clientName(): string { return `${pick(CLIENT_FIRST)} ${pick(CLIENT_LAST)}` }

  function buildAppointments(resourceId: string): Appointment[] {
    const out: Appointment[] = []
    let cursorMin = 0
    const dayMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60
    let counter = 0
    while (cursorMin < dayMinutes - 30) {
      // Gap before next appointment (0–45 min)
      cursorMin += Math.floor(rnd() * 45)
      if (cursorMin >= dayMinutes - 30) break
      const durMin = 15 + 15 * Math.floor(rnd() * 8) // 15, 30, ..., 120
      const endMin = Math.min(dayMinutes, cursorMin + durMin)
      const type = pick(APPT_TYPES)
      const title = pick(TITLES_BY_TYPE[type])
      const isPersonal = type === 'admin' || type === 'break'
      out.push({
        id: `${resourceId}-A${counter}`,
        start: DAY_START + cursorMin * 60_000,
        end: DAY_START + endMin * 60_000,
        title,
        type,
        client: isPersonal ? '-' : clientName(),
      })
      cursorMin = endMin
      counter += 1
    }
    return out
  }

  function buildResources(): Resource[] {
    const out: Resource[] = []
    for (let i = 0; i < 8; i += 1) {
      const id = `R-${(i + 1).toString().padStart(2, '0')}`
      const name = `Dr. ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
      out.push({
        id,
        name,
        role: pick(ROLES),
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length]!,
        appointments: buildAppointments(id),
      })
    }
    return out
  }

  // ---- State ----------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let resources = $state<Resource[]>(buildResources())

  // svelte-ignore state_referenced_locally
  let selectedApptId = $state<string | null>(resources[0]?.appointments[0]?.id ?? null)
  // svelte-ignore state_referenced_locally
  let selectedResourceId = $state<string | null>(resources[0]?.id ?? null)

  // Live "now" indicator clamped to today's day window - for the demo we
  // pretend the user is mid-shift even after hours so the line is always
  // somewhere visible.
  let now = $state(clampToWindow(Date.now()))
  function clampToWindow(ts: number): number {
    if (ts < DAY_START) return DAY_START + 30 * 60_000
    if (ts > DAY_END) return DAY_END - 30 * 60_000
    return ts
  }
  $effect(() => {
    const id = setInterval(() => { now = clampToWindow(Date.now()) }, 30_000)
    return () => clearInterval(id)
  })

  // Draft for editing the selected appointment.
  const selectedAppt = $derived.by(() => {
    if (!selectedApptId) return null
    for (const r of resources) {
      const a = r.appointments.find((x) => x.id === selectedApptId)
      if (a) return { resource: r, appt: a }
    }
    return null
  })

  type Draft = {
    title: string
    type: ApptType
    client: string
    startMin: number  // minutes since DAY_START
    durMin: number
    resourceId: string
  }
  // svelte-ignore state_referenced_locally
  let draft = $state<Draft | null>(initialDraftFromSelected())
  function initialDraftFromSelected(): Draft | null {
    const sel = selectedAppt
    if (!sel) return null
    return draftFor(sel.appt, sel.resource.id)
  }
  function draftFor(a: Appointment, resourceId: string): Draft {
    return {
      title: a.title,
      type: a.type,
      client: a.client,
      startMin: Math.round((a.start - DAY_START) / 60_000),
      durMin: Math.round((a.end - a.start) / 60_000),
      resourceId,
    }
  }
  $effect(() => {
    // Reset draft when selection changes - independent of typing.
    if (!selectedAppt) {
      draft = null
      return
    }
    draft = draftFor(selectedAppt.appt, selectedAppt.resource.id)
  })

  function saveDraft(): void {
    if (!draft || !selectedAppt) return
    const oldResourceId = selectedAppt.resource.id
    const newResourceId = draft.resourceId
    const apptId = selectedAppt.appt.id
    const updated: Appointment = {
      id: apptId,
      start: DAY_START + draft.startMin * 60_000,
      end: DAY_START + (draft.startMin + draft.durMin) * 60_000,
      title: draft.title,
      type: draft.type,
      client: draft.client,
    }
    resources = resources.map((r) => {
      if (r.id === oldResourceId && r.id === newResourceId) {
        return { ...r, appointments: r.appointments.map((a) => (a.id === apptId ? updated : a)) }
      }
      if (r.id === oldResourceId) {
        return { ...r, appointments: r.appointments.filter((a) => a.id !== apptId) }
      }
      if (r.id === newResourceId) {
        return { ...r, appointments: [...r.appointments, updated].sort((a, b) => a.start - b.start) }
      }
      return r
    })
    selectedResourceId = newResourceId
  }
  function deleteSelected(): void {
    if (!selectedAppt) return
    const rid = selectedAppt.resource.id
    const aid = selectedAppt.appt.id
    resources = resources.map((r) => (r.id === rid ? { ...r, appointments: r.appointments.filter((a) => a.id !== aid) } : r))
    selectedApptId = null
  }

  function selectAppt(resourceId: string, apptId: string): void {
    selectedResourceId = resourceId
    selectedApptId = apptId
  }

  // ---- Layout: keep the axis and the Schedule cell exactly the same
  // width so the "now" line and hour ticks land on identical pixels in
  // both rows. The header axis sits OUTSIDE the grid and the in-cell
  // bars are positioned with `left%` inside the cell. If the two
  // widths drift, the same percentage maps to different pixels and
  // the red line visibly desyncs.

  /** Fixed left columns (Provider / Role / Stats). The header axis reserves
   *  exactly this much on its left so 0% lines up with the Schedule column. */
  const PROVIDER_W = 220
  const ROLE_W = 130
  const STATS_W = 110
  const LEFT_COLS_WIDTH = PROVIDER_W + ROLE_W + STATS_W

  // The Schedule column GROWS to fill the available width. Rather than measure
  // the wrapper and subtract pixels (fragile - misses the grid's real client
  // width + scrollbars), we let the grid do it: `fitColumns` stretches the
  // unpinned columns to fill the container, and we PIN the three fixed
  // columns to their exact widths so ONLY the Schedule column absorbs the
  // slack. The header axis then just flex-fills the same remaining space.
  let pinnedLeft = false
  function pinLeftColumns(api: SvGridApi<typeof features, Resource>) {
    if (pinnedLeft) return
    pinnedLeft = true
    api.setColumnWidth('name', PROVIDER_W)
    api.setColumnWidth('role', ROLE_W)
    api.setColumnWidth('id', STATS_W)
  }

  // ---- Bar math -------------------------------------------------------

  function pctOf(ts: number): number { return ((ts - DAY_START) / DAY_SPAN_MS) * 100 }
  function pct(start: number, end: number): { left: number; width: number } {
    const l = Math.max(0, pctOf(start))
    const r = Math.min(100, pctOf(end))
    return { left: l, width: Math.max(0.4, r - l) }
  }
  function nowPct(): number { return Math.max(0, Math.min(100, pctOf(now))) }

  // ---- KPIs -----------------------------------------------------------

  const kpis = $derived.by(() => {
    let totalMins = 0
    let billableMins = 0
    let nextUp: { resource: string; appt: Appointment } | null = null
    let nextStart = Infinity
    for (const r of resources) {
      for (const a of r.appointments) {
        const dur = (a.end - a.start) / 60_000
        totalMins += dur
        if (a.type !== 'break' && a.type !== 'admin') billableMins += dur
        if (a.start > now && a.start < nextStart) {
          nextStart = a.start
          nextUp = { resource: r.name, appt: a }
        }
      }
    }
    const dayMins = (DAY_END_HOUR - DAY_START_HOUR) * 60 * resources.length
    return {
      booked: Math.round(totalMins / 60),
      util: dayMins ? Math.round((totalMins / dayMins) * 100) : 0,
      billableHours: Math.round(billableMins / 60),
      nextUp,
      apptCount: resources.reduce((s, r) => s + r.appointments.length, 0),
    }
  })

  // ---- Formatters -----------------------------------------------------

  function fmtTime(ts: number): string {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  function fmtRange(a: Appointment): string {
    return `${fmtTime(a.start)} – ${fmtTime(a.end)}`
  }
  function fmtMinAsTime(startMin: number): string {
    return fmtTime(DAY_START + startMin * 60_000)
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet ResourceCell(props: { row: Resource })}
  <span class="sc-res">
    <span class="sc-avatar" style={`background:${props.row.avatarColor}`}>{props.row.name.split(' ').slice(-1)[0]?.charAt(0) ?? ''}</span>
    <span class="sc-res-text">
      <span class="sc-res-name">{props.row.name}</span>
      <span class="sc-res-role">{props.row.role}</span>
    </span>
  </span>
{/snippet}

{#snippet StatsCell(props: { row: Resource })}
  {@const mins = props.row.appointments.reduce((s, a) => s + (a.end - a.start) / 60_000, 0)}
  {@const billable = props.row.appointments.filter((a) => a.type !== 'break' && a.type !== 'admin').reduce((s, a) => s + (a.end - a.start) / 60_000, 0)}
  <span class="sc-stats">
    <span class="sc-stat-line"><span class="tabular-nums">{props.row.appointments.length}</span> appts</span>
    <span class="sc-stat-line sc-muted"><span class="tabular-nums">{Math.round(billable)}</span>/<span class="tabular-nums">{Math.round(mins)}</span> bill min</span>
  </span>
{/snippet}

{#snippet TimelineCell(props: { row: Resource })}
  <span class="sc-tl">
    {#each HOUR_LABELS.slice(0, -1) as h (h)}
      <span class="sc-grid-tick" style={`left: ${((h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%`}></span>
    {/each}
    {#each props.row.appointments as a (a.id)}
      {@const p = pct(a.start, a.end)}
      {@const active = a.id === selectedApptId}
      <button
        type="button"
        class={`sc-appt sc-type-${a.type} ${active ? 'sc-appt-active' : ''}`}
        style={`left: ${p.left}%; width: ${p.width}%`}
        title={`${a.title} · ${fmtRange(a)}${a.client !== '-' ? ' · ' + a.client : ''}`}
        onclick={(e) => { e.stopPropagation(); selectAppt(props.row.id, a.id) }}
      >
        <span class="sc-appt-title">{a.title}</span>
        <span class="sc-appt-time">{fmtTime(a.start)}</span>
      </button>
    {/each}
    <span class="sc-now" style={`left: ${nowPct()}%`}></span>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="sc-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="sc-kpi-strip">
    <div class="sc-kpi">
      <div class="sc-kpi-label">Appointments today</div>
      <div class="sc-kpi-value tabular-nums">{kpis.apptCount}</div>
      <div class="sc-kpi-foot">{resources.length} providers on shift</div>
    </div>
    <div class="sc-kpi">
      <div class="sc-kpi-label">Booked hours</div>
      <div class="sc-kpi-value tabular-nums">{kpis.booked}h</div>
      <div class="sc-kpi-foot">{kpis.billableHours}h billable</div>
    </div>
    <div class="sc-kpi">
      <div class="sc-kpi-label">Utilisation</div>
      <div class={`sc-kpi-value tabular-nums ${kpis.util > 75 ? 'sc-up' : ''}`}>{kpis.util}%</div>
      <div class="sc-kpi-foot">of available capacity</div>
    </div>
    <div class="sc-kpi">
      <div class="sc-kpi-label">Now</div>
      <div class="sc-kpi-value tabular-nums">{fmtTime(now)}</div>
      <div class="sc-kpi-foot">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    </div>
    <div class="sc-kpi">
      <div class="sc-kpi-label">Next up</div>
      <div class="sc-kpi-value sc-next">{kpis.nextUp ? fmtTime(kpis.nextUp.appt.start) : '-'}</div>
      <div class="sc-kpi-foot sc-truncate">{kpis.nextUp ? `${kpis.nextUp.appt.title} · ${kpis.nextUp.resource}` : 'No more today'}</div>
    </div>
  </div>

  <!-- Body: grid + detail -->
  <div class="sc-body flex flex-1 min-h-0 gap-3">
    <div class="sc-master flex-1 min-w-0 flex flex-col">
      <!-- Hour axis. Kept INSIDE the master column so its width tracks
           the grid's width exactly - that's what keeps the red "now"
           line vertically aligned between the axis row and each cell. -->
      <div class="sc-axis-wrap">
        <div class="sc-axis-spacer" style={`flex: 0 0 ${LEFT_COLS_WIDTH}px`}></div>
        <div class="sc-axis">
          {#each HOUR_LABELS as h, i (h)}
            <div class="sc-axis-tick" style={`left: ${(i / (HOUR_LABELS.length - 1)) * 100}%`}>
              <span>{h.toString().padStart(2, '0')}:00</span>
            </div>
          {/each}
          <div class="sc-axis-now" style={`left: ${nowPct()}%`}><span>now</span></div>
        </div>
      </div>

      <div class="flex-1 min-h-0">
        <SvGrid responsive={true}
          data={resources}
          columns={[
            { field: 'name', header: 'Provider', width: PROVIDER_W, editable: false,
              cell: (ctx) => renderSnippet(ResourceCell, { row: ctx.row.original }) },
            { field: 'role', header: 'Role', width: ROLE_W, editable: false },
            { field: 'id', header: 'Stats', width: STATS_W, editable: false,
              cell: (ctx) => renderSnippet(StatsCell, { row: ctx.row.original }) },
            // Base width is just a seed - fitColumns stretches this one column
            // to fill whatever's left (the others are pinned).
            { field: 'appointments', header: 'Schedule', width: 400, editable: false,
              cell: (ctx) => renderSnippet(TimelineCell, { row: ctx.row.original }) },
          ] satisfies ColumnDef<typeof features, Resource>[]}
          features={features}
          filterMode="menu"
          selectionMode="row"
          showRowSelection={false}
          showPagination={false}
          enableInlineEditing={false}
          enableCellSelection={false}
          enableRowSummaries={false}
          rowHeight={64}
          containerHeight="100%"
          fitColumns={true}
          onApiReady={pinLeftColumns}
        />
      </div>
    </div>

    <!-- Detail card -->
    <aside class="sc-detail">
      {#if !selectedAppt || !draft}
        <div class="sc-empty">Click an appointment to inspect or edit it.</div>
      {:else}
        <header class="sc-detail-head">
          <div>
            <div class="sc-detail-title">{draft.title || 'Untitled'}</div>
            <div class="sc-detail-sub">{selectedAppt.appt.id} · {selectedAppt.resource.name}</div>
          </div>
          <span class={`sc-type-pill sc-type-${draft.type}`}>{draft.type}</span>
        </header>

        <div class="sc-form">
          <label class="sc-field">
            <span>Title</span>
            <input type="text" value={draft.title} oninput={(e) => (draft!.title = (e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class="sc-field">
            <span>Client</span>
            <input type="text" value={draft.client} oninput={(e) => (draft!.client = (e.currentTarget as HTMLInputElement).value)} />
          </label>
          <div class="sc-row">
            <label class="sc-field">
              <span>Type</span>
              <select value={draft.type} onchange={(e) => (draft!.type = (e.currentTarget as HTMLSelectElement).value as ApptType)}>
                {#each APPT_TYPES as t (t)}<option value={t}>{t}</option>{/each}
              </select>
            </label>
            <label class="sc-field">
              <span>Provider</span>
              <select value={draft.resourceId} onchange={(e) => (draft!.resourceId = (e.currentTarget as HTMLSelectElement).value)}>
                {#each resources as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
              </select>
            </label>
          </div>
          <div class="sc-row">
            <label class="sc-field">
              <span>Start</span>
              <input
                type="number"
                min={0}
                max={(DAY_END_HOUR - DAY_START_HOUR) * 60 - 15}
                step={15}
                value={draft.startMin}
                oninput={(e) => (draft!.startMin = Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0))}
              />
              <span class="sc-foot">at {fmtMinAsTime(draft.startMin)}</span>
            </label>
            <label class="sc-field">
              <span>Duration (min)</span>
              <input
                type="number"
                min={15}
                max={240}
                step={15}
                value={draft.durMin}
                oninput={(e) => (draft!.durMin = Math.max(15, Number((e.currentTarget as HTMLInputElement).value) || 15))}
              />
              <span class="sc-foot">ends {fmtMinAsTime(draft.startMin + draft.durMin)}</span>
            </label>
          </div>
        </div>

        <footer class="sc-actions">
          <button type="button" class="sc-btn sc-btn-danger" onclick={deleteSelected}>Delete</button>
          <button type="button" class="sc-btn sc-btn-primary" onclick={saveDraft}>Save</button>
        </footer>
      {/if}
    </aside>
  </div>
</section>

<style>
  /* KPI strip */
  .sc-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .sc-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .sc-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .sc-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .sc-kpi-foot { margin-top: 6px; font-size: 11px; color: var(--sg-muted, #64748b); }
  .sc-up { color: #16a34a; }
  :global([data-theme='dark']) .sc-up { color: #4ade80; }
  .sc-next { color: var(--sg-accent, #2563eb); }
  .sc-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Hour axis. NO border-left and NO spacer border-right - those add
   * stray pixels that throw the axis "now" line out of sync with the
   * in-cell "now" line, since the grid's cells have no equivalent
   * border or padding on those edges. */
  .sc-axis-wrap {
    display: flex;
    flex-shrink: 0;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    overflow: hidden;
    margin-bottom: 6px;
    height: 28px;
  }
  .sc-axis-spacer {
    flex-shrink: 0;
  }
  .sc-axis {
    position: relative;
    /* Grow to fill the width left after the fixed-column spacer, so the axis
       always matches the Schedule column - which also fills the container. */
    flex: 1 1 0;
    min-width: 0;
    height: 26px;
  }
  .sc-axis-tick {
    position: absolute;
    top: 0; bottom: 0;
    border-left: 1px solid var(--sg-border, #e2e8f0);
    padding-left: 4px;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    display: flex;
    align-items: center;
  }
  .sc-axis-now {
    position: absolute;
    top: 2px; bottom: 2px;
    border-left: 2px solid #dc2626;
    padding-left: 4px;
    display: flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    color: #dc2626;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Body layout */
  .sc-body { min-height: 0; }
  .sc-master {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Resource cell */
  :global(.sc-res) {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  :global(.sc-avatar) {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: #fff;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
  }
  :global(.sc-res-text) { display: inline-flex; flex-direction: column; line-height: 1.2; }
  :global(.sc-res-name) { font-weight: 600; }
  :global(.sc-res-role) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Stats cell */
  :global(.sc-stats) { display: inline-flex; flex-direction: column; gap: 2px; line-height: 1.2; }
  :global(.sc-stat-line) { font-size: 12px; }
  :global(.sc-muted) { color: var(--sg-muted, #64748b); font-size: 11px; }

  /* Timeline cell. The grid's cells have padding-left: 7px (for the
   * usual text content). The timeline owns its own pixel layout, so we
   * cancel that padding with a negative left margin and stretch the
   * width back to cover the full cell. That keeps the `left%`
   * percentages mapping to the same x range as the header axis above. */
  :global(.sc-tl) {
    position: relative;
    display: block;
    height: 56px;
    width: calc(100% + 7px);
    margin-left: -7px;
  }
  :global(.sc-grid-tick) {
    position: absolute;
    top: 0; bottom: 0;
    width: 0;
    border-left: 1px dashed rgba(148, 163, 184, 0.35);
  }
  :global(.sc-appt) {
    position: absolute;
    top: 4px; bottom: 4px;
    border: 0;
    border-radius: 6px;
    padding: 4px 8px;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    line-height: 1.2;
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  :global(.sc-appt:hover) {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22);
  }
  :global(.sc-appt-active) {
    outline: 2px solid #fff;
    outline-offset: -2px;
    box-shadow: 0 0 0 3px var(--sg-accent, #2563eb);
  }
  :global(.sc-appt-title) {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  :global(.sc-appt-time) {
    font-size: 10px;
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
  }

  :global(.sc-type-consult)   { background: linear-gradient(135deg, #2563eb, #3b82f6); }
  :global(.sc-type-procedure) { background: linear-gradient(135deg, #7c3aed, #a855f7); }
  :global(.sc-type-follow-up) { background: linear-gradient(135deg, #16a34a, #22c55e); }
  :global(.sc-type-admin)     { background: linear-gradient(135deg, #475569, #64748b); }
  :global(.sc-type-break)     { background: linear-gradient(135deg, #d97706, #f59e0b); }

  :global(.sc-now) {
    position: absolute;
    top: 0; bottom: 0;
    border-left: 2px solid #dc2626;
    pointer-events: none;
  }
  :global(.sc-now::before) {
    content: '';
    position: absolute;
    top: -3px;
    left: -4px;
    width: 8px;
    height: 8px;
    background: #dc2626;
    border-radius: 50%;
  }

  /* Detail panel */
  .sc-detail {
    width: 340px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sc-empty {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sg-muted, #64748b);
    font-style: italic;
    padding: 24px;
    text-align: center;
  }
  .sc-detail-head {
    padding: 14px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .sc-detail-title { font-size: 15px; font-weight: 700; }
  .sc-detail-sub { font-size: 11px; color: var(--sg-muted, #64748b); margin-top: 3px; }
  .sc-type-pill {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .sc-form {
    flex: 1 1 auto;
    overflow: auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sc-field { display: flex; flex-direction: column; gap: 4px; }
  .sc-field > span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
  }
  .sc-field > input,
  .sc-field > select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 5px 8px;
    font-size: 12.5px;
  }
  .sc-foot { font-size: 10.5px; color: var(--sg-muted, #64748b); text-transform: none; letter-spacing: 0; }
  .sc-actions {
    padding: 10px 14px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .sc-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 14px;
    font-size: 12px;
    cursor: pointer;
  }
  .sc-btn-primary { border-color: transparent; background: var(--sg-accent, #2563eb); color: #fff; }
  .sc-btn-danger  { color: #b91c1c; border-color: #fecaca; }
  :global([data-theme='dark']) .sc-btn-danger { color: #f87171; border-color: rgba(239,68,68,0.4); }
  .sc-btn:hover { filter: brightness(0.95); }
</style>
