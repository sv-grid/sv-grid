<script lang="ts">
  /**
   * 398. Free/busy + find-a-time (Enterprise Scheduler Pro)
   * ------------------------------------------------------
   * Schedule a meeting across attendees. Each person's busy time - their events
   * here PLUS an external free/busy feed (shaded hatch) - is combined, and "Find a
   * time" surfaces the windows when EVERYONE is free for the chosen length. Click a
   * suggestion to book it for all. Renderer + pure `commonFree` ship in @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, commonFree, availableSlots, type SchedulerProConfig, type Interval } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  const people: SchedulerResource[] = [
    { id: 'ana', title: 'Ana', color: '#4f46e5' },
    { id: 'ben', title: 'Ben', color: '#0891b2' },
    { id: 'cara', title: 'Cara', color: '#db2777' },
  ]

  type Ev = { id: string; title: string; person: string; start: string; end: string; color: string }
  const pcolor = Object.fromEntries(people.map((p) => [p.id, p.color!]))
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return d }
  const ats = (h: number, m = 0) => iso(at(h, m))
  const mk = (id: string, title: string, person: string, sh: number, sm: number, eh: number, em: number): Ev => ({ id, title, person, start: ats(sh, sm), end: ats(eh, em), color: pcolor[person] })

  let seq = 100
  let rows = $state<Ev[]>([
    mk('a1', 'Focus block', 'ana', 9, 0, 10, 30),
    mk('a2', 'Review', 'ana', 13, 0, 14, 0),
    mk('b1', 'Support', 'ben', 9, 30, 11, 0),
    mk('b2', 'Deploy', 'ben', 15, 0, 16, 0),
    mk('c1', 'Design', 'cara', 10, 0, 12, 0),
    mk('c2', 'Interview', 'cara', 14, 0, 15, 0),
  ])

  // External free/busy per person (from their other calendars - not events here).
  const externalBusy: Record<string, Interval[]> = {
    ana: [{ start: at(12, 0), end: at(13, 0) }], // lunch
    ben: [{ start: at(12, 0), end: at(12, 30) }],
    cara: [{ start: at(8, 0), end: at(9, 0) }, { start: at(16, 30), end: at(17, 0) }],
  }
  const freeBusyOf = (r: SchedulerResource) => externalBusy[r.id] ?? []

  const columns: ColumnDef<any, Ev>[] = [
    { field: 'title', header: 'Event', editorType: 'text', width: 150 },
    { field: 'person', header: 'Attendee', editorType: 'list', editorOptions: people.map((p) => ({ value: p.id, label: p.title ?? p.id, color: p.color })), width: 110 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  const DURATIONS = [30, 60]
  let duration = $state(60)

  // Everyone's busy = their events here + their external free/busy.
  const suggestions = $derived.by(() => {
    const dayStart = at(8, 0), dayEnd = at(18, 0)
    const busyByPerson = people.map((p) => [
      ...rows.filter((r) => r.person === p.id).map((r) => ({ start: new Date(r.start), end: new Date(r.end) })),
      ...(externalBusy[p.id] ?? []),
    ])
    const windows = commonFree(busyByPerson, dayStart, dayEnd, duration)
    return windows.flatMap((w) => availableSlots({ working: [w], busy: [], durationMin: duration, stepMin: 30 })).slice(0, 12)
  })

  let booked = $state('')
  function bookMeeting(slot: { start: Date; end: Date }) {
    const s = iso(slot.start), e = iso(slot.end)
    rows = [...rows, ...people.map((p) => ({ id: `m${++seq}`, title: 'Team meeting', person: p.id, start: s, end: e, color: '#7c3aed' }))]
    booked = `Team meeting booked ${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}-${pad(slot.end.getHours())}:${pad(slot.end.getMinutes())}`
  }

  function onEventMove(e: SchedulerEventMoveEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.person = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Ev>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Ev> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'person', resources: people,
    freeBusyOf,
    views: ['timelineDay'], initialView: 'timelineDay',
    businessHours: { start: 8, end: 18 }, dayStartHour: 8, dayEndHour: 18, timelineTickMinWidth: 96, timelineLaneHeight: 26,
    editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize,
  }
</script>

<section class="ft">
  <header class="ft-head">
    <div class="ft-title">
      <strong>Find a time</strong>
      <span class="ft-sub">Hatched = busy elsewhere. Suggestions are when all three are free.</span>
    </div>
    <div class="ft-seg" role="tablist" aria-label="View">
      <button class="ft-seg-btn" role="tab" aria-selected={view === 'timeline'} class:ft-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
      <button class="ft-seg-btn" role="tab" aria-selected={view === 'table'} class:ft-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>
  <div class="ft-bar">
    <span class="ft-lab">Meeting length</span>
    <div class="ft-dur">{#each DURATIONS as d (d)}<button class="ft-dur-btn" class:ft-on2={duration === d} onclick={() => (duration = d)}>{d}m</button>{/each}</div>
    <div class="ft-slots">
      {#if suggestions.length === 0}<span class="ft-none">No common time for {duration}m today</span>{/if}
      {#each suggestions as s (s.start.getTime())}
        <button class="ft-slot" onclick={() => bookMeeting(s)}>{pad(s.start.getHours())}:{pad(s.start.getMinutes())}</button>
      {/each}
    </div>
    {#if booked}<span class="ft-booked">{booked}</span>{/if}
  </div>
  <div class="ft-body">
    {#if view === 'timeline'}
      <SvGrid
      columnResize data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid
      columnResize data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable />
    {/if}
  </div>
</section>

<style>
  .ft { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .ft-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ft-title { display: flex; flex-direction: column; gap: 2px; }
  .ft-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .ft-bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); flex-wrap: wrap; }
  .ft-lab { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .ft-dur { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .ft-dur-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.8rem; padding: 4px 12px; cursor: pointer; }
  .ft-dur-btn.ft-on2 { background: var(--sg-accent, #4f46e5); color: #fff; }
  .ft-slots { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; }
  .ft-slot { border: 1px solid color-mix(in srgb, #7c3aed 55%, transparent); background: color-mix(in srgb, #7c3aed 10%, transparent); color: #7c3aed; font: inherit; font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; cursor: pointer; }
  .ft-slot:hover { background: color-mix(in srgb, #7c3aed 22%, transparent); }
  .ft-none { font-size: 0.78rem; color: var(--sg-muted, #9ca3af); }
  .ft-booked { font-size: 0.78rem; color: #16a34a; font-weight: 600; }
  .ft-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .ft-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .ft-seg-btn.ft-on { background: var(--sg-accent, #4f46e5); color: #fff; }
  .ft-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
