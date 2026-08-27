<script lang="ts">
  /**
   * 381. Horizon - an Outlook-style calendar client (real app)
   * ---------------------------------------------------------
   * A full workspace built on the Scheduler. The NavPane module rail (with icons)
   * SWITCHES the content: Calendar (default), Mail (a two-pane list + reader),
   * People (a contact directory) and Tasks (a checklist). The Calendar module is
   * a DOCKABLE workspace (SvDockManager): the calendar fills the area (Month /
   * Week / Day / Agenda, driven by the mini date-picker), with an "Upcoming" grid
   * and an "Inbox" AUTO-HIDDEN to the bottom edge - click a tab to fly it out, pin
   * to re-dock, or drag / float any pane. The whole arrangement serializes and
   * persists across reloads. Meeting cards show attendee avatars. Recurring events
   * with per-occurrence edits, a second time-zone ruler, iCal import/export, undo.
   */
  import {
    SvGrid,
    SvNavPane,
    SvCalendar,
    SvStat,
    SvAvatar,
    SvAvatarGroup,
    SvBadge,
    SvCheckBox,
    SvTextInput,
    SvDockManager,
    dockTabs,
    dockPane,
    type DockManagerState,
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
    { id: 1, title: 'Daily standup', start: at(0, 9, 0), end: at(0, 9, 30), cal: 'work', color: CAL_COLOR.work, who: 'Team', attendees: ['Jordan Lee', 'Sam Ortiz', 'Priya Nair', 'Owen Bradley'], repeat: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] }, exceptions: [] },
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

  // The NavPane module rail switches the whole content area. Default = Calendar.
  let activeModule = $state('cal')
  const moduleTitle: Record<string, string> = { cal: 'Workspace', mail: 'Mail', people: 'People', tasks: 'Tasks' }

  // Mail module + the auto-hidden Inbox pane.
  type Mail = { id: number; from: string; subject: string; preview: string; time: string; unread?: boolean }
  const inbox: Mail[] = [
    { id: 1, from: 'Jordan Lee', subject: 'Re: roadmap draft - a few notes', preview: 'Left a few comments on the sync engine milestone - can we push the beta a week?', time: '9:12 AM', unread: true },
    { id: 2, from: 'Ivy Okafor', subject: 'Design review deck attached', preview: 'Final board for tomorrow. Slides 4-6 cover the new onboarding flow.', time: '8:47 AM', unread: true },
    { id: 3, from: 'Calendar', subject: 'Invitation: Team retro (Fri 3pm)', preview: 'You have been invited to Team retro. Agenda: what went well / what to change.', time: 'Yesterday', unread: true },
    { id: 4, from: 'Sam Rivera', subject: '1:1 agenda for tomorrow', preview: 'Topics from my side: Q3 goals, headcount, the semantic search launch.', time: 'Yesterday' },
    { id: 5, from: 'Aria Novak', subject: 'Weekend hike - who is in?', preview: 'Thinking Saturday morning, easy 8km loop. Coffee after.', time: 'Mon' },
    { id: 6, from: 'Billing', subject: 'Your July invoice is ready', preview: 'Invoice #2043 for the Team plan is attached. No action needed.', time: 'Mon' },
  ]
  let selectedMailId = $state(1)
  const selectedMail = $derived(inbox.find((m) => m.id === selectedMailId) ?? inbox[0])
  const unreadCount = $derived(inbox.filter((m) => m.unread).length)

  // People module.
  type Person = { id: number; name: string; role: string; team: string; email: string; color: string; status: 'online' | 'busy' | 'away' | 'offline' }
  const people: Person[] = [
    { id: 1, name: 'Jordan Lee', role: 'Product Lead', team: 'Core Platform', email: 'jordan@acme.co', color: '#4f46e5', status: 'online' },
    { id: 2, name: 'Ivy Okafor', role: 'Design Lead', team: 'Growth', email: 'ivy@acme.co', color: '#db2777', status: 'busy' },
    { id: 3, name: 'Sam Rivera', role: 'Eng Manager', team: 'Mobile', email: 'sam@acme.co', color: '#0891b2', status: 'online' },
    { id: 4, name: 'Aria Novak', role: 'Data Scientist', team: 'Data & AI', email: 'aria@acme.co', color: '#16a34a', status: 'away' },
    { id: 5, name: 'Marco Bianchi', role: 'Backend Eng', team: 'Core Platform', email: 'marco@acme.co', color: '#d97706', status: 'offline' },
    { id: 6, name: 'Lena Fischer', role: 'ML Engineer', team: 'Data & AI', email: 'lena@acme.co', color: '#7c3aed', status: 'online' },
    { id: 7, name: 'Omar Haddad', role: 'Growth PM', team: 'Growth', email: 'omar@acme.co', color: '#0ea5e9', status: 'busy' },
    { id: 8, name: 'Mia Chen', role: 'iOS Engineer', team: 'Mobile', email: 'mia@acme.co', color: '#e11d48', status: 'online' },
  ]
  const STATUS_COLOR: Record<Person['status'], string> = { online: '#16a34a', busy: '#dc2626', away: '#d97706', offline: '#94a3b8' }

  // Tasks module.
  type Task = { id: number; title: string; due: string; priority: 'Low' | 'Medium' | 'High'; list: string; done: boolean }
  let tasks = $state<Task[]>([
    { id: 1, title: 'Finalize roadmap draft', due: 'Today', priority: 'High', list: 'Work', done: false },
    { id: 2, title: 'Review design deck', due: 'Today', priority: 'Medium', list: 'Work', done: false },
    { id: 3, title: 'Prep 1:1 with Sam', due: 'Tomorrow', priority: 'Medium', list: 'Work', done: false },
    { id: 4, title: 'Send Q3 goals', due: 'Wed', priority: 'High', list: 'Work', done: true },
    { id: 5, title: 'Book weekend hike', due: 'This week', priority: 'Low', list: 'Personal', done: false },
    { id: 6, title: 'Renew gym membership', due: 'Fri', priority: 'Low', list: 'Personal', done: false },
    { id: 7, title: 'Pay July invoice', due: 'Mon', priority: 'Medium', list: 'Personal', done: true },
  ])
  const tasksDone = $derived(tasks.filter((t) => t.done).length)
  const PRIORITY_VARIANT: Record<Task['priority'], 'neutral' | 'warning' | 'danger'> = { Low: 'neutral', Medium: 'warning', High: 'danger' }

  // The Calendar module's content is a dockable workspace: the calendar fills the
  // main area, with Upcoming + Inbox collapsed to an auto-hide strip at the bottom
  // (a fly-out reveals them). Drag / float / re-dock; serialized to localStorage.
  const LAYOUT_KEY = 'svgrid-horizon-layout-v3'
  const defaultWorkspace = (): DockManagerState => ({
    main: dockTabs([dockPane('calendar', 'Calendar', { closable: false, minSize: 260 })]),
    floating: [],
    // One single-pane entry per pane, so the bottom edge shows an "Upcoming" and
    // an "Inbox" tab and each fly-out carries only its own content (no duplicated
    // tab strip). See `hideSingleTab` on SvDockManager below.
    autoHide: [
      { id: 'ah-upcoming', side: 'bottom', size: 260, leaf: dockTabs([dockPane('upcoming', 'Upcoming')]) },
      { id: 'ah-inbox', side: 'bottom', size: 260, leaf: dockTabs([dockPane('inbox', 'Inbox')]) },
    ],
  })
  function loadWorkspace(): DockManagerState {
    try {
      const s = localStorage.getItem(LAYOUT_KEY)
      if (s) return JSON.parse(s) as DockManagerState
    } catch {
      /* ignore malformed / unavailable storage */
    }
    return defaultWorkspace()
  }
  let workspace = $state<DockManagerState>(loadWorkspace())
  $effect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(workspace))
    } catch {
      /* ignore */
    }
  })
  function resetLayout() { workspace = defaultWorkspace() }

  // The roster an event can invite - drives the drawer's multi-select attendees editor.
  const ATTENDEES = ['Jordan Lee', 'Sam Ortiz', 'Priya Nair', 'Owen Bradley', 'Mia Fenn', 'Alex Roman', 'Dana West', 'Chris Vale']

  const columns: ColumnDef<any, Ev>[] = [
    { field: 'title', header: 'Subject', editorType: 'text', width: 200 },
    { field: 'cal', header: 'Calendar', editorType: 'list', editorOptions: calendars.map((c) => ({ value: c.id, label: c.name, color: c.color })), width: 120 },
    { field: 'attendees', header: 'Attendees', editorType: 'chips', editorOptions: ATTENDEES.map((n) => ({ value: n, label: n })), width: 200 },
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
    const occStart = new Date(e.occurrenceStart as Date) // this occurrence's canonical start

    // "This and following": SPLIT the series - stop the original before this
    // occurrence and start a NEW series here that carries the changes, so they
    // apply to this occurrence AND every one after it.
    if (e.scope === 'following') {
      const origRepeat = e.row.repeat as RecurrenceRule
      const durationMs = new Date(e.row.end).getTime() - new Date(e.row.start).getTime()
      const newStart = ex.start ? new Date(ex.start as Date) : occStart
      const newEnd = ex.end ? new Date(ex.end as Date) : new Date(newStart.getTime() + durationMs)
      const newRow: Ev = {
        ...e.row,
        id: ++seq,
        start: iso(newStart),
        end: iso(newEnd),
        repeat: { ...origRepeat, until: null }, // continues indefinitely from the split
        exceptions: [],
      }
      if (ex.title != null) newRow.title = ex.title
      if (ex.fields) Object.assign(newRow, ex.fields) // attendees / calendar / ...
      newRow.color = CAL_COLOR[newRow.cal] ?? newRow.color
      // Truncate the original series to end the day before the split point, and
      // drop any of its exceptions that fell on/after the split.
      e.row.repeat = { ...origRepeat, until: iso(new Date(occStart.getTime() - 86_400_000)) }
      e.row.exceptions = (e.row.exceptions ?? []).filter((x) => new Date(x.occurrenceStart as string).getTime() < occStart.getTime())
      rows = [...rows, newRow]
      return
    }

    // "This event": store / merge a single per-occurrence exception.
    const key = occStart.getTime()
    const stored: SchedulerException = {
      occurrenceStart: iso(occStart),
      ...(ex.deleted ? { deleted: true } : {}),
      ...(ex.start ? { start: iso(ex.start as Date) } : {}),
      ...(ex.end ? { end: iso(ex.end as Date) } : {}),
      ...(ex.title != null ? { title: ex.title } : {}),
      ...(ex.allDay != null ? { allDay: ex.allDay } : {}),
      ...(ex.fields ? { fields: ex.fields } : {}),
    }
    e.row.exceptions = [...(e.row.exceptions ?? []).filter((x) => new Date(x.occurrenceStart as string).getTime() !== key), stored]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventResize(e: SchedulerEventResizeEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Ev>) { Object.assign(e.row, e.values); e.row.color = CAL_COLOR[e.row.cal] ?? e.row.color }
  function onEventAdd(start: Date, end: Date) { rows = [...rows, { id: ++seq, title: 'New event', start: iso(start), end: iso(end), cal: 'work', color: CAL_COLOR.work }] }
  function onEventDelete(row: Ev) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet iMail()}<span class="hz-mi">✉</span>{/snippet}
{#snippet iCal()}<span class="hz-mi">📅</span>{/snippet}
{#snippet iPeople()}<span class="hz-mi">👥</span>{/snippet}
{#snippet iTasks()}<span class="hz-mi">✓</span>{/snippet}

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

<section class="hz" data-mobile-pan>
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
    <div class="hz-navpane">
      <SvNavPane
        sections={[]}
        moduleValue={activeModule}
        onModuleSelect={(id) => (activeModule = id)}
        modules={[
          { id: 'mail', label: 'Mail', badge: 3, icon: iMail },
          { id: 'cal', label: 'Calendar', icon: iCal },
          { id: 'people', label: 'People', icon: iPeople },
          { id: 'tasks', label: 'Tasks', badge: 2, icon: iTasks },
        ]}
      />
    </div>
  </aside>

  <div class="hz-main">
    {#if activeModule === 'cal'}
      <div class="hz-kpis">
        <SvStat label="Today" value={meetingsToday} hint="meetings" />
        <SvStat label="This week" value={weekTotal} hint="events" />
        <SvStat label="Focus time" value={`${focusHours}h`} hint="protected" />
        <SvStat label="Recurring" value={recurringCount} hint="series" />
      </div>
      <div class="hz-toolbar">
        <div class="hz-title">Workspace <span class="hz-title-sub">Upcoming + Inbox are pinned to the bottom edge - click to reveal</span></div>
        <div class="hz-actions">
          <button onclick={resetLayout} title="Restore the default panel layout">Reset layout</button>
          <button onclick={importIcs}>Import .ics</button>
          <button onclick={exportIcs}>Export</button>
        </div>
      </div>
      <div class="hz-stage">
        <SvDockManager bind:workspace minSize={120}>
          {#snippet pane(p)}
            {#if p.id === 'calendar'}
              <div class="hz-pane">
                <SvGrid
                  data={shown}
                  columns={columns}
                  getRowId={(r) => String(r.id)}
                  containerHeight="100%"
                  scheduler={{
                    startField: 'start', endField: 'end', allDayField: 'allDay', titleField: 'title', colorField: 'color',
                    recurrenceField: 'repeat', recurrenceExceptionsField: 'exceptions',
                    views: ['month', 'week', 'day', 'agenda'], initialView: 'week', weekStartsOn: 1,
                    slotMinutes: 30, slotSizes: [60, 30, 15, 5],
                    dayStartHour: 7, dayEndHour: 20,
                    date: schedDate, onNavigate: (d) => (schedDate = d),
                    secondaryTimeZones: [{ id: 'America/Los_Angeles', label: 'SF' }],
                    event: eventBody, tooltip: true, history: true, editable: true, drawer: true,
                    onOccurrenceChange, onEventMove, onEventResize, onEventCommit, onEventAdd, onEventDelete,
                  }}
                />
              </div>
            {:else if p.id === 'upcoming'}
              <div class="hz-pane">
                <SvGrid data={shown} columns={columns} getRowId={(r) => String(r.id)} sortable enableInlineEditing showPagination={false} rowHeight={32} containerHeight="100%" fitColumns />
              </div>
            {:else if p.id === 'inbox'}
              <div class="hz-inbox">
                {#each inbox as m (m.id)}
                  <div class="hz-mail" class:hz-mail-unread={m.unread}>
                    <SvAvatar name={m.from} size="sm" />
                    <div class="hz-mail-txt"><span class="hz-mail-from">{m.from}</span><span class="hz-mail-sub">{m.subject}</span></div>
                    <span class="hz-mail-time">{m.time}</span>
                  </div>
                {/each}
              </div>
            {/if}
          {/snippet}
        </SvDockManager>
      </div>
    {:else if activeModule === 'mail'}
      <div class="hz-toolbar"><div class="hz-title">Mail <span class="hz-title-sub">{unreadCount} unread</span></div></div>
      <div class="hz-mailview">
        <div class="hz-maillist">
          {#each inbox as m (m.id)}
            <button type="button" class="hz-mail hz-mailitem" class:hz-mail-unread={m.unread} class:is-sel={m.id === selectedMailId} onclick={() => (selectedMailId = m.id)}>
              <SvAvatar name={m.from} size="sm" />
              <div class="hz-mail-txt">
                <div class="hz-mail-l1"><span class="hz-mail-from">{m.from}</span><span class="hz-mail-time">{m.time}</span></div>
                <span class="hz-mail-sub">{m.subject}</span>
                <span class="hz-mail-prev">{m.preview}</span>
              </div>
            </button>
          {/each}
        </div>
        <div class="hz-mailread">
          <div class="hz-read-head">
            <SvAvatar name={selectedMail.from} size="md" />
            <div><div class="hz-read-subj">{selectedMail.subject}</div><div class="hz-read-from">{selectedMail.from} · {selectedMail.time}</div></div>
          </div>
          <p class="hz-read-body">{selectedMail.preview}</p>
          <p class="hz-read-body">Best,<br />{selectedMail.from.split(' ')[0]}</p>
        </div>
      </div>
    {:else if activeModule === 'people'}
      <div class="hz-toolbar"><div class="hz-title">People <span class="hz-title-sub">{people.length} contacts</span></div></div>
      <div class="hz-people">
        {#each people as p (p.id)}
          <div class="hz-person">
            <div class="hz-person-av">
              <SvAvatar name={p.name} color={p.color} size="md" />
              <span class="hz-person-status" style:background={STATUS_COLOR[p.status]} title={p.status}></span>
            </div>
            <div class="hz-person-name">{p.name}</div>
            <div class="hz-person-role">{p.role}</div>
            <div class="hz-person-team">{p.team}</div>
            <a class="hz-person-mail" href={`mailto:${p.email}`}>{p.email}</a>
          </div>
        {/each}
      </div>
    {:else if activeModule === 'tasks'}
      <div class="hz-toolbar"><div class="hz-title">Tasks <span class="hz-title-sub">{tasksDone}/{tasks.length} done</span></div></div>
      <div class="hz-tasks">
        {#each tasks as t (t.id)}
          <label class="hz-task" class:is-done={t.done}>
            <SvCheckBox checked={t.done} onChange={(v) => (t.done = v)} ariaLabel={t.title} />
            <span class="hz-task-title">{t.title}</span>
            <span class="hz-task-list">{t.list}</span>
            <SvBadge variant={PRIORITY_VARIANT[t.priority]} size="sm">{t.priority}</SvBadge>
            <span class="hz-task-due">{t.due}</span>
          </label>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .hz { display: flex; flex: 1 1 auto; min-height: 0; gap: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; overflow: hidden; }
  .hz-nav { flex: 0 0 240px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); overflow: hidden; }
  .hz-nav > * { flex: 0 0 auto; min-width: 0; }
  .hz-mi { display: inline-flex; width: 16px; justify-content: center; }
  .hz-brand { font-weight: 700; font-size: 1rem; padding: 10px 14px 8px; }
  .hz-mini { padding: 0 8px 6px; }
  .hz-mini :global(.sv-cal) { width: 100%; font-size: 0.78rem; }
  .hz-search { padding: 0 12px 8px; }
  .hz-cals { flex: 0 1 auto; min-height: 0; overflow: hidden; padding: 6px 14px 8px; display: flex; flex-direction: column; gap: 5px; }
  .hz-cals-head { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; color: var(--sg-muted, #9ca3af); }
  .hz-cal { display: flex; align-items: center; gap: 7px; font-size: 0.85rem; cursor: pointer; }
  .hz-cal-dot { width: 10px; height: 10px; border-radius: 3px; }
  .hz-legend { padding: 4px 14px 10px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .hz-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--sg-muted, #6b7280); }
  .hz-legend-chip { width: 18px; text-align: center; color: var(--sg-fg, #374151); }
  .hz-navpane { margin-top: auto; min-height: 0; }
  .hz-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .hz-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 14px 4px; }
  .hz-kpis :global(.sv-stat) { padding: 7px 12px !important; gap: 2px !important; border-radius: 9px !important; }
  .hz-kpis :global(.sv-stat__value) { font-size: 18px !important; }
  .hz-kpis :global(.sv-stat__label) { font-size: 11px !important; }
  .hz-kpis :global(.sv-stat__foot) { font-size: 11px !important; }
  .hz-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .hz-title { font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .hz-title-sub { font-size: 0.75rem; font-weight: 400; color: var(--sg-muted, #6b7280); }
  .hz-actions { display: flex; gap: 6px; }
  .hz-actions button { padding: 4px 10px; font-size: 0.8rem; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
  .hz-actions button:hover { border-color: var(--sg-accent, #4f46e5); color: var(--sg-accent, #4f46e5); }
  .hz-stage { flex: 1 1 auto; min-height: 300px; padding: 8px; }
  .hz-pane { height: 100%; min-height: 0; }
  .hz-inbox { height: 100%; overflow-y: auto; display: flex; flex-direction: column; }
  .hz-mail { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .hz-mail-unread { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 7%, transparent); }
  .hz-mail-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .hz-mail-from { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hz-mail-unread .hz-mail-from { color: var(--sg-accent, #4f46e5); }
  .hz-mail-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hz-mail-time { font-size: 0.72rem; color: var(--sg-muted, #9ca3af); flex: none; }
  /* Mail module: list + reading pane */
  .hz-mailview { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(280px, 360px) 1fr; }
  .hz-maillist { min-height: 0; overflow-y: auto; border-right: 1px solid var(--sg-border, #e5e7eb); display: flex; flex-direction: column; }
  .hz-mailitem { text-align: left; background: transparent; border: none; border-bottom: 1px solid var(--sg-border, #e5e7eb); cursor: pointer; color: inherit; font: inherit; align-items: flex-start; }
  .hz-mailitem:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 5%, transparent); }
  .hz-mailitem.is-sel { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent); }
  .hz-mail-l1 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .hz-mail-prev { font-size: 0.74rem; color: var(--sg-muted, #9ca3af); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hz-mailread { min-height: 0; overflow-y: auto; padding: 18px 22px; }
  .hz-read-head { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); margin-bottom: 14px; }
  .hz-read-subj { font-size: 1.05rem; font-weight: 700; }
  .hz-read-from { font-size: 0.8rem; color: var(--sg-muted, #6b7280); }
  .hz-read-body { font-size: 0.9rem; line-height: 1.55; margin: 0 0 12px; max-width: 62ch; }
  /* People module: contact cards */
  .hz-people { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; align-content: start; }
  .hz-person { border: 1px solid var(--sg-border, #e5e7eb); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; background: var(--sg-bg, #fff); }
  .hz-person-av { position: relative; margin-bottom: 6px; }
  .hz-person-status { position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--sg-bg, #fff); }
  .hz-person-name { font-weight: 600; }
  .hz-person-role { font-size: 0.8rem; }
  .hz-person-team { font-size: 0.74rem; color: var(--sg-muted, #6b7280); }
  .hz-person-mail { font-size: 0.74rem; color: var(--sg-accent, #4f46e5); text-decoration: none; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .hz-person-mail:hover { text-decoration: underline; }
  /* Tasks module: checklist */
  .hz-tasks { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 6px 0; }
  .hz-task { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--sg-border, #e5e7eb); cursor: pointer; }
  .hz-task:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 4%, transparent); }
  .hz-task-title { flex: 1 1 auto; font-size: 0.9rem; }
  .hz-task.is-done .hz-task-title { text-decoration: line-through; color: var(--sg-muted, #9ca3af); }
  .hz-task-list { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #9ca3af); }
  .hz-task-due { font-size: 0.78rem; color: var(--sg-muted, #6b7280); min-width: 74px; text-align: right; }
  .hz-ev { display: flex; align-items: center; gap: 6px; min-width: 0; width: 100%; }
  .hz-ev-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; flex: 1 1 auto; }
  .hz-ev-people { flex: none; margin-left: auto; }
  .hz-ev-who { font-size: 0.72em; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none; }

  /* Mobile: this is an app-shell console - a fixed 240px nav rail beside the
     scheduler - and the root hides its overflow, so on a phone the right-hand
     side was silently cut off. Floor it and let the whole console pan inside
     the demo stage (see .demo-stage.is-wide in examples/src/mobile.css), which
     keeps the rail and the timeline aligned. */
  @media (max-width: 767px) {
    .hz {
      min-width: 900px;
    }
  }
</style>
