<script lang="ts">
  /**
   * 381. Horizon - an Outlook-style calendar client (real app)
   * ---------------------------------------------------------
   * A full calendar application built on the Scheduler: a NavPane module rail +
   * a mini date-picker + search + "My calendars" toggles on the left, a KPI
   * strip and the calendar in the middle (Month / Week / Day / Agenda, driven by
   * the mini-picker), and an "Upcoming" grid below - the same rows as the
   * calendar. Meeting cards show attendee avatars. Recurring events with
   * per-occurrence edits, a second time-zone ruler, iCal import/export and undo.
   */
  import {
    SvGrid,
    SvNavPane,
    SvCalendar,
    SvStat,
    SvAvatarGroup,
    SvTextInput,
    type NavModule,
    type NavSection,
    type ColumnDef,
    type RecurrenceRule,
    type SchedulerException,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
    type SchedulerOccurrenceChangeEvent,
    toICS,
    fromICS,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Cal = { id: string; name: string; color: string }
  type Ev = {
    id: number
    title: string
    start: string
    end: string
    allDay?: boolean
    cal: string
    color: string
    who?: string
    attendees?: string[]
    focus?: boolean
    repeat?: RecurrenceRule | null
    exceptions?: SchedulerException[]
  }

  const calendars: Cal[] = [
    { id: 'work', name: 'Work', color: '#4f46e5' },
    { id: 'personal', name: 'Personal', color: '#16a34a' },
    { id: 'family', name: 'Family', color: '#db2777' },
    { id: 'holidays', name: 'Holidays', color: '#d97706' },
  ]
  const CAL_COLOR: Record<string, string> = Object.fromEntries(calendars.map((c) => [c.id, c.color]))

  // Stable avatar colors keyed off attendee name.
  const AV_PALETTE = ['#4f46e5', '#0891b2', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488']
  const avColor = (name: string) => {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return AV_PALETTE[h % AV_PALETTE.length]
  }
  const avatarsOf = (names: string[] | undefined) => (names ?? []).map((n) => ({ name: n, color: avColor(n) }))

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const at = (day: number, h: number, m = 0) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + day)
    d.setHours(h, m, 0, 0)
    return iso(d)
  }

  let seq = 100
  let rows = $state<Ev[]>([
    // Recurring weekday standup (keeps recurrence + exceptions)
    { id: 1, title: 'Daily standup', start: at(0, 9, 0), end: at(0, 9, 15), cal: 'work', color: CAL_COLOR.work, who: 'Team', attendees: ['Jordan Lee', 'Sam Ortiz', 'Priya Nair', 'Owen Bradley'], repeat: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] }, exceptions: [] },
    // Monday
    { id: 2, title: 'Focus: roadmap draft', start: at(0, 10, 0), end: at(0, 12, 0), cal: 'work', color: CAL_COLOR.work, focus: true, who: 'You' },
    { id: 3, title: '1:1 with Sam', start: at(0, 14, 0), end: at(0, 14, 30), cal: 'work', color: CAL_COLOR.work, attendees: ['Sam Ortiz'] },
    // Tuesday
    { id: 4, title: 'Design review', start: at(1, 11, 0), end: at(1, 12, 30), cal: 'work', color: CAL_COLOR.work, who: 'Jordan, Sam', attendees: ['Jordan Lee', 'Sam Ortiz', 'Mia Fenn'] },
    { id: 5, title: 'Focus: spec writing', start: at(1, 14, 0), end: at(1, 16, 0), cal: 'work', color: CAL_COLOR.work, focus: true, who: 'You' },
    // Wednesday
    { id: 6, title: 'Lunch with Alex', start: at(2, 12, 30), end: at(2, 13, 30), cal: 'personal', color: CAL_COLOR.personal, who: 'Alex', attendees: ['Alex Roman'] },
    { id: 7, title: 'Sprint planning', start: at(2, 15, 0), end: at(2, 16, 0), cal: 'work', color: CAL_COLOR.work, attendees: ['Jordan Lee', 'Sam Ortiz', 'Priya Nair', 'Owen Bradley', 'Mia Fenn'] },
    // Thursday
    { id: 8, title: 'Client call', start: at(3, 15, 0), end: at(3, 16, 0), cal: 'work', color: CAL_COLOR.work, who: 'Acme Corp', attendees: ['Dana West', 'Owen Bradley'] },
    { id: 9, title: 'Gym', start: at(3, 18, 0), end: at(3, 19, 0), cal: 'personal', color: CAL_COLOR.personal },
    // Friday
    { id: 10, title: 'Dentist', start: at(4, 10, 0), end: at(4, 11, 0), cal: 'personal', color: CAL_COLOR.personal },
    { id: 11, title: 'Team retro', start: at(4, 13, 0), end: at(4, 14, 0), cal: 'work', color: CAL_COLOR.work, attendees: ['Jordan Lee', 'Sam Ortiz', 'Priya Nair', 'Mia Fenn'] },
    // All-day / weekend
    { id: 12, title: "Mom's birthday", start: at(5, 0, 0), end: at(6, 0, 0), allDay: true, cal: 'family', color: CAL_COLOR.family },
    { id: 13, title: 'Public holiday', start: at(0, 0, 0), end: at(1, 0, 0), allDay: true, cal: 'holidays', color: CAL_COLOR.holidays },
    { id: 14, title: 'Weekend hike', start: at(6, 9, 0), end: at(6, 12, 0), cal: 'personal', color: CAL_COLOR.personal, attendees: ['Alex Roman', 'Chris Vale'] },
  ])

  // Sidebar: calendar visibility toggles + search filter the data the calendar sees.
  let visible = $state(new Set(calendars.map((c) => c.id)))
  let query = $state('')
  const q = $derived(query.trim().toLowerCase())
  const shown = $derived(
    rows.filter(
      (r) =>
        visible.has(r.cal) &&
        (q === '' || r.title.toLowerCase().includes(q) || (r.who ?? '').toLowerCase().includes(q) || (r.attendees ?? []).some((a) => a.toLowerCase().includes(q))),
    ),
  )
  function toggleCal(id: string) {
    const next = new Set(visible)
    next.has(id) ? next.delete(id) : next.add(id)
    visible = next
  }

  // --- KPIs (derived from the full event set) --------------------------------
  const todayKey = iso(new Date()).slice(0, 10)
  const meetingsToday = $derived(rows.filter((r) => r.start.slice(0, 10) === todayKey && !r.allDay).length)
  const weekTotal = $derived(rows.length)
  const focusHours = $derived(
    Math.round(
      rows
        .filter((r) => r.focus)
        .reduce((sum, r) => sum + (new Date(r.end).getTime() - new Date(r.start).getTime()) / 3600000, 0) * 10,
    ) / 10,
  )
  const recurringCount = $derived(rows.filter((r) => r.repeat).length)

  // The mini date-picker <-> calendar are two-way bound through `schedDate`.
  let schedDate = $state<Date>(new Date())
  const miniValue = $derived([schedDate])

  const modules: NavModule[] = [
    { id: 'mail', label: 'Mail', badge: 3 },
    { id: 'cal', label: 'Calendar' },
    { id: 'people', label: 'People' },
    { id: 'tasks', label: 'Tasks' },
  ]
  const navSections: NavSection[] = [
    { id: 'go', label: 'Go to', items: [
      { id: 'today', label: 'Today' },
      { id: 'work', label: 'Work week' },
      { id: 'next', label: 'Next week' },
    ] },
  ]
  function onNav(id: string) {
    if (id === 'today') schedDate = new Date()
    else if (id === 'next') schedDate = new Date(schedDate.getTime() + 7 * 864e5)
  }

  const columns: ColumnDef<any, Ev>[] = [
    { field: 'title', header: 'Subject', editorType: 'text', width: 200 },
    { field: 'cal', header: 'Calendar', editorType: 'list', editorOptions: calendars.map((c) => ({ value: c.id, label: c.name, color: c.color })), width: 120 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 160 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 160 },
  ]

  let icsBox = $state('')
  function exportIcs() {
    icsBox = toICS(shown.map((r) => ({ uid: String(r.id), title: r.title, start: new Date(r.start), end: new Date(r.end), allDay: r.allDay, rrule: r.repeat ?? null })), { stamp: new Date() })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([icsBox], { type: 'text/calendar' }))
    a.download = 'horizon.ics'
    a.click()
  }
  function importIcs() {
    const evs = fromICS(icsBox)
    if (!evs.length) return
    rows = [...rows, ...evs.map((e) => ({ id: ++seq, title: e.title, start: iso(e.start), end: iso(e.end), allDay: e.allDay, cal: 'work', color: CAL_COLOR.work, repeat: e.rrule ?? undefined }))]
    icsBox = ''
  }

  function onOccurrenceChange(e: SchedulerOccurrenceChangeEvent<Ev>) {
    const ex = e.exception
    const key = (ex.occurrenceStart as Date).getTime()
    const stored: SchedulerException = { occurrenceStart: iso(ex.occurrenceStart as Date), ...(ex.deleted ? { deleted: true } : {}), ...(ex.start ? { start: iso(ex.start as Date) } : {}), ...(ex.end ? { end: iso(ex.end as Date) } : {}) }
    e.row.exceptions = [...(e.row.exceptions ?? []).filter((x) => new Date(x.occurrenceStart as string).getTime() !== key), stored]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventResize(e: SchedulerEventResizeEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Ev>) { Object.assign(e.row, e.values); e.row.color = CAL_COLOR[e.row.cal] ?? e.row.color }
  function onEventAdd(start: Date, end: Date) { rows = [...rows, { id: ++seq, title: 'New event', start: iso(start), end: iso(end), cal: 'work', color: CAL_COLOR.work }] }
  function onEventDelete(row: Ev) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet eventBody(row: Ev)}
  <span class="hz-ev">
    <span class="hz-ev-title">{row.title}</span>
    {#if row.attendees && row.attendees.length}
      <span class="hz-ev-people"><SvAvatarGroup avatars={avatarsOf(row.attendees)} max={3} size={18} /></span>
    {:else if row.who}
      <span class="hz-ev-who">{row.who}</span>
    {/if}
  </span>
{/snippet}

<section class="hz">
  <aside class="hz-nav">
    <div class="hz-brand">📅 Horizon</div>
    <div class="hz-mini">
      <SvCalendar value={miniValue} onChange={(d) => { if (d[0]) schedDate = d[0] }} footer={false} months={1} weekNumbers={false} />
    </div>
    <div class="hz-search">
      <SvTextInput bind:value={query} placeholder="Search events / people" clearable />
    </div>
    <div class="hz-cals">
      <div class="hz-cals-head">My calendars</div>
      {#each calendars as c (c.id)}
        <label class="hz-cal"><input type="checkbox" checked={visible.has(c.id)} onchange={() => toggleCal(c.id)} /><span class="hz-cal-dot" style:background={c.color}></span>{c.name}</label>
      {/each}
    </div>
    <div class="hz-legend">
      <div class="hz-cals-head">Legend</div>
      <div class="hz-legend-row"><span class="hz-legend-chip">◷</span> Focus block</div>
      <div class="hz-legend-row"><span class="hz-legend-chip">↻</span> Recurring series</div>
      <div class="hz-legend-row"><span class="hz-legend-chip">▦</span> All-day event</div>
    </div>
    <div class="hz-navpane">
      <SvNavPane sections={navSections} onSelect={onNav} {modules} moduleValue="cal" />
    </div>
  </aside>

  <div class="hz-main">
    <div class="hz-kpis">
      <SvStat label="Today" value={meetingsToday} hint="meetings" />
      <SvStat label="This week" value={weekTotal} hint="events" />
      <SvStat label="Focus time" value={`${focusHours}h`} hint="protected" />
      <SvStat label="Recurring" value={recurringCount} hint="series" />
    </div>
    <div class="hz-toolbar">
      <div class="hz-title">Calendar</div>
      <div class="hz-actions">
        <button onclick={importIcs}>Import .ics</button>
        <button onclick={exportIcs}>Export</button>
      </div>
    </div>
    <div class="hz-cal">
      <SvGrid
        data={shown}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start', endField: 'end', allDayField: 'allDay', titleField: 'title', colorField: 'color',
          recurrenceField: 'repeat', recurrenceExceptionsField: 'exceptions',
          views: ['month', 'week', 'day', 'agenda'], initialView: 'week', weekStartsOn: 1,
          dayStartHour: 7, dayEndHour: 20,
          date: schedDate, onNavigate: (d) => (schedDate = d),
          secondaryTimeZones: [{ id: 'America/Los_Angeles', label: 'SF' }],
          event: eventBody, tooltip: true, history: true, editable: true, drawer: true,
          onOccurrenceChange, onEventMove, onEventResize, onEventCommit, onEventAdd, onEventDelete,
        }}
      />
    </div>
    <details class="hz-list">
      <summary>Upcoming ({shown.length}) - the same rows, as a grid</summary>
      <div class="hz-list-grid">
        <SvGrid data={shown} columns={columns} getRowId={(r) => String(r.id)} sortable enableInlineEditing showPagination={false} rowHeight={32} containerHeight="100%" fitColumns />
      </div>
    </details>
  </div>
</section>

<style>
  .hz { display: flex; flex: 1 1 auto; min-height: 0; gap: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; overflow: hidden; }
  .hz-nav { flex: 0 0 236px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); overflow-y: auto; }
  .hz-brand { font-weight: 700; font-size: 1rem; padding: 12px 14px; }
  .hz-mini { padding: 0 8px 8px; }
  .hz-mini :global(.sv-cal) { width: 100%; font-size: 0.8rem; }
  .hz-search { padding: 0 12px 8px; }
  .hz-cals { padding: 8px 14px; display: flex; flex-direction: column; gap: 6px; }
  .hz-cals-head { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; color: var(--sg-muted, #9ca3af); }
  .hz-cal { display: flex; align-items: center; gap: 7px; font-size: 0.85rem; cursor: pointer; }
  .hz-cal-dot { width: 10px; height: 10px; border-radius: 3px; }
  .hz-legend { padding: 4px 14px 10px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .hz-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--sg-muted, #6b7280); }
  .hz-legend-chip { width: 18px; text-align: center; color: var(--sg-fg, #374151); }
  .hz-navpane { margin-top: auto; min-height: 0; }
  .hz-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .hz-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 14px 4px; }
  .hz-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .hz-title { font-weight: 600; }
  .hz-actions { display: flex; gap: 6px; }
  .hz-actions button { padding: 4px 10px; font-size: 0.8rem; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
  .hz-cal { flex: 1 1 auto; min-height: 0; padding: 8px; }
  .hz-list { flex: 0 0 auto; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .hz-list summary { padding: 6px 14px; font-size: 0.8rem; cursor: pointer; color: var(--sg-muted, #6b7280); }
  .hz-list-grid { height: 180px; padding: 0 8px 8px; }
  .hz-ev { display: flex; align-items: center; gap: 6px; min-width: 0; width: 100%; }
  .hz-ev-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; flex: 1 1 auto; }
  .hz-ev-people { flex: none; margin-left: auto; }
  .hz-ev-who { font-size: 0.72em; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none; }
</style>
