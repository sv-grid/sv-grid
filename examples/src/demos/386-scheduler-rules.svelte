<script lang="ts">
  /**
   * 386. Scheduling rules & policies (enterprise)
   * --------------------------------------------
   * Everything the scheduler can enforce, in one board:
   *  - booking rules: business hours + a hard-blocked lunch band (restrictedHours),
   *    a closed date (restrictedDates), a highlighted holiday (specialDates),
   *    min/max navigable dates, room capacity (maxEventsPerSlot), and a per-doctor
   *    day off (resource.dateOverrides),
   *  - free/busy statuses (busy / tentative / free / out-of-office) with distinct
   *    visuals,
   *  - per-event reminders that fire a toast as their lead time is crossed,
   *  - drag an event onto the "Unscheduled" panel to remove it (onUnschedule),
   *  - a recurring event whose drag / delete / drawer edit asks This / This and
   *    following / All events (onOccurrenceChange with a scope).
   */
  import {
    SvGrid,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerException,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
    type SchedulerOccurrenceChangeEvent,
    type RecurrenceRule,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Status = 'Confirmed' | 'Tentative' | 'Free' | 'Out of office'
  type Appt = {
    id: number; title: string; room: string; status: Status; busy: string
    remindMin?: number; start: string; end: string; color: string
    repeat?: RecurrenceRule | null; exceptions?: SchedulerException[]
  }
  type Waiting = { id: string; title: string; durationMin?: number; color?: string }

  // status -> free/busy value the scheduler visual reads
  const BUSY: Record<Status, string> = { Confirmed: 'busy', Tentative: 'tentative', Free: 'free', 'Out of office': 'oof' }
  const COLOR: Record<Status, string> = { Confirmed: '#4f46e5', Tentative: '#4f46e5', Free: '#16a34a', 'Out of office': '#7c3aed' }

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const dayAt = (offset: number) => { const d = new Date(monday); d.setDate(monday.getDate() + offset); return d }
  const at = (offset: number, h: number, m = 0) => { const d = dayAt(offset); d.setHours(h, m, 0, 0); return iso(d) }
  const now = new Date()

  // Rooms: Dr. Lee takes a specific day off (dateOverrides), the others 8-18.
  const rooms: SchedulerResource[] = [
    { id: 'A', title: 'Dr. Smith', color: '#4f46e5' },
    { id: 'B', title: 'Dr. Jones', color: '#0891b2' },
    { id: 'C', title: 'Dr. Lee', color: '#16a34a', dateOverrides: [{ date: isoDate(dayAt(2)), off: true }] },
  ]

  const mk = (a: Omit<Appt, 'busy' | 'color'>): Appt => ({ ...a, busy: BUSY[a.status], color: COLOR[a.status] })

  let seq = 100
  let rows = $state<Appt[]>([
    mk({ id: 1, title: 'Consult - Rivera', room: 'A', status: 'Confirmed', start: at(0, 9, 0), end: at(0, 9, 45) }),
    mk({ id: 2, title: 'Follow-up - Park', room: 'A', status: 'Tentative', start: at(0, 10, 0), end: at(0, 10, 30) }),
    mk({ id: 3, title: 'Screening - Chen', room: 'B', status: 'Confirmed', start: at(0, 9, 30), end: at(0, 10, 15) }),
    mk({ id: 4, title: 'Hold - walk-in', room: 'B', status: 'Free', start: at(0, 14, 0), end: at(0, 15, 0) }),
    mk({ id: 5, title: 'Conference (OOO)', room: 'A', status: 'Out of office', start: at(1, 9, 0), end: at(1, 12, 0) }),
    mk({ id: 6, title: 'Procedure - Abara', room: 'B', status: 'Confirmed', start: at(1, 10, 0), end: at(1, 11, 0) }),
    // a reminder that fires shortly after load (starts ~8 min out, 15-min lead)
    mk({ id: 7, title: 'Pre-op briefing', room: 'A', status: 'Confirmed', remindMin: 15, start: iso(new Date(now.getTime() + 8 * 60000)), end: iso(new Date(now.getTime() + 38 * 60000)) }),
    // a recurring daily huddle with exceptions support
    mk({ id: 8, title: 'Daily huddle', room: 'B', status: 'Confirmed', start: at(0, 8, 0), end: at(0, 8, 15), repeat: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] }, exceptions: [] }),
  ])
  let backlog = $state<Waiting[]>([
    { id: 'w1', title: 'New patient - Silva', durationMin: 45, color: '#4f46e5' },
    { id: 'w2', title: 'Review - Weber', durationMin: 30, color: '#0891b2' },
  ])

  const columns: ColumnDef<any, Appt>[] = [
    { field: 'title', header: 'Appointment', editorType: 'text', width: 170 },
    { field: 'room', header: 'Room', editorType: 'list', editorOptions: rooms.map((r) => ({ value: r.id, label: r.title ?? r.id, color: r.color })), width: 120 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(BUSY) as Status[]).map((s) => ({ value: s, label: s, color: COLOR[s] })), width: 140 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onSchedule(item: Waiting, start: Date, resourceId?: string) {
    const end = new Date(start.getTime() + (item.durationMin ?? 30) * 60000)
    rows = [...rows, mk({ id: ++seq, title: item.title, room: resourceId ?? 'A', status: 'Confirmed', start: iso(start), end: iso(end) })]
    backlog = backlog.filter((w) => w.id !== item.id)
  }
  function onUnschedule(row: Appt) {
    rows = rows.filter((r) => r !== row)
    backlog = [...backlog, { id: `u${row.id}`, title: row.title, durationMin: 30, color: row.color }]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.room = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Appt>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Appt>) { Object.assign(e.row, e.values); e.row.color = COLOR[e.row.status] ?? e.row.color; e.row.busy = BUSY[e.row.status] ?? e.row.busy }
  function onEventDelete(row: Appt) { rows = rows.filter((r) => r !== row) }

  // Recurrence scope handling: occurrence -> store an exception; following ->
  // split the series (stop the old one before the occurrence, start a new one).
  function onOccurrenceChange(e: SchedulerOccurrenceChangeEvent<Appt>) {
    const row = e.row as Appt
    const occ = new Date(e.occurrenceStart as Date)
    if (e.scope === 'following') {
      // Truncate the original series to end the day before this occurrence.
      const until = new Date(occ); until.setDate(until.getDate() - 1)
      const oldRule = (Array.isArray(row.repeat) ? row.repeat[0] : row.repeat) as RecurrenceRule | undefined
      row.repeat = oldRule ? { ...oldRule, until: isoDate(until) } : row.repeat
      // Start a NEW series at the occurrence, carrying the override.
      const ex = e.exception
      const ns = (ex.start as string) ?? iso(occ)
      const durMs = new Date(row.end).getTime() - new Date(row.start).getTime()
      const ne = ex.end ?? iso(new Date(new Date(ns).getTime() + durMs))
      rows = [...rows, mk({ id: ++seq, title: (ex.title as string) ?? row.title, room: row.room, status: row.status, start: ns as string, end: ne as string, repeat: oldRule ? { ...oldRule, until: undefined } : null, exceptions: [] })]
      return
    }
    // occurrence: merge the exception into the row's list (deleted or overridden).
    const key = new Date((e.exception.occurrenceStart as string)).getTime()
    row.exceptions = [...(row.exceptions ?? []).filter((x) => new Date(x.occurrenceStart as string).getTime() !== key), e.exception]
  }
</script>

<section class="rl">
  <div class="rl-head">
    <div class="rl-title">Scheduling rules &amp; policies</div>
    <div class="rl-sub">Lunch 12-13 is hard-blocked (red hatch); {isoDate(dayAt(4)).slice(5)} is closed; a holiday is tagged; Dr. Lee is off on {isoDate(dayAt(2)).slice(5)}; max 2 per room; drag an event onto Unscheduled to remove it.</div>
  </div>
  <div class="rl-cal">
    <SvGrid
      columnResize
      data={rows}
      columns={columns}
      getRowId={(r) => String(r.id)}
      containerHeight="100%"
      scheduler={{
        startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
        resourceField: 'room', resources: rooms,
        statusField: 'busy',
        reminderField: 'remindMin', onReminder: (r, m) => console.log('reminder', r.title, m),
        recurrenceField: 'repeat', recurrenceExceptionsField: 'exceptions', onOccurrenceChange,
        views: ['week', 'day'], initialView: 'day', initialDate: monday, weekStartsOn: 1,
        dayStartHour: 7, dayEndHour: 19,
        businessHours: { start: 8, end: 18 },
        restrictedHours: [{ start: 12, end: 13 }],
        restrictedDates: [isoDate(dayAt(4))],
        specialDates: [{ date: isoDate(dayAt(3)), label: 'Founders Day', color: '#dc2626' }],
        minDate: isoDate(monday),
        maxDate: isoDate(dayAt(20)),
        maxEventsPerSlot: 2,
        restrictToBusinessHours: true,
        unscheduled: backlog, backlogTitle: 'Unscheduled',
        tooltip: true, editable: true, drawer: true,
        onSchedule, onUnschedule, onEventMove, onEventResize, onEventCommit, onEventDelete,
      }}
    />
  </div>
</section>

<style>
  .rl { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .rl-head { padding: 12px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .rl-title { font-weight: 700; }
  .rl-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); margin-top: 2px; }
  .rl-cal { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
