<script lang="ts">
  /**
   * 393. Skill-based eligibility (Enterprise Scheduler Pro)
   * ------------------------------------------------------
   * A dispatch board where each job needs a skill and each technician has a set of
   * them. A job may only be scheduled onto a technician who is QUALIFIED - drag one
   * onto someone who lacks the skill and it snaps back with a "Not eligible" flash;
   * ineligible rows are hatched while you drag. Enforced through the same booking
   * rules as conflicts and working hours. Renderer ships in @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent, type SchedulerEventCommitEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Tech = SchedulerResource & { skills: string[] }
  const techs: Tech[] = [
    { id: 'alex', title: 'Alex (Electrical, HVAC)', color: '#4f46e5', skills: ['Electrical', 'HVAC'] },
    { id: 'bo', title: 'Bo (Plumbing)', color: '#0891b2', skills: ['Plumbing'] },
    { id: 'cy', title: 'Cy (Electrical, Plumbing)', color: '#db2777', skills: ['Electrical', 'Plumbing'] },
    { id: 'dee', title: 'Dee (HVAC)', color: '#16a34a', skills: ['HVAC'] },
  ]
  const skillColor: Record<string, string> = { Electrical: '#4f46e5', Plumbing: '#0891b2', HVAC: '#16a34a' }
  const skills = Object.keys(skillColor)

  type Job = { id: string; title: string; skill: string; customer: string; tech: string; start: string; end: string; color: string }
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return iso(d) }
  const mk = (j: Omit<Job, 'color'>): Job => ({ ...j, color: skillColor[j.skill] ?? '#64748b' })

  let seq = 100
  let rows = $state<Job[]>([
    mk({ id: 'j1', title: 'Panel upgrade', skill: 'Electrical', customer: 'Acme Ltd', tech: 'alex', start: at(8), end: at(10) }),
    mk({ id: 'j2', title: 'AC service', skill: 'HVAC', customer: 'B. Owens', tech: 'alex', start: at(11), end: at(12, 30) }),
    mk({ id: 'j3', title: 'Leak repair', skill: 'Plumbing', customer: 'C. Patel', tech: 'bo', start: at(9), end: at(10, 30) }),
    mk({ id: 'j4', title: 'Pipe reroute', skill: 'Plumbing', customer: 'D. Wright', tech: 'bo', start: at(13), end: at(15) }),
    mk({ id: 'j5', title: 'Outlet install', skill: 'Electrical', customer: 'E. Lee', tech: 'cy', start: at(9), end: at(10) }),
    mk({ id: 'j6', title: 'Sink swap', skill: 'Plumbing', customer: 'F. Brooks', tech: 'cy', start: at(11), end: at(12) }),
    mk({ id: 'j7', title: 'Furnace tune-up', skill: 'HVAC', customer: 'G. Adler', tech: 'dee', start: at(9), end: at(11) }),
    mk({ id: 'j8', title: 'Thermostat swap', skill: 'HVAC', customer: 'H. Mason', tech: 'dee', start: at(13), end: at(14) }),
  ])

  const columns: ColumnDef<any, Job>[] = [
    { field: 'title', header: 'Job', editorType: 'text', width: 150 },
    { field: 'skill', header: 'Skill', editorType: 'list', editorOptions: skills.map((s) => ({ value: s, label: s, color: skillColor[s] })), width: 110 },
    { field: 'customer', header: 'Customer', editorType: 'text', width: 120 },
    { field: 'tech', header: 'Technician', editorType: 'list', editorOptions: techs.map((t) => ({ value: t.id, label: t.title ?? t.id, color: t.color })), width: 160 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onEventMove(e: SchedulerEventMoveEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.tech = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Job>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Job>) { Object.assign(e.row, e.values); e.row.color = skillColor[e.row.skill] ?? e.row.color }
  function onEventAdd(start: Date, end: Date, resourceId?: string) {
    const tech = techs.find((t) => t.id === resourceId) ?? techs[0]
    rows = [...rows, mk({ id: `j${++seq}`, title: 'New job', skill: tech.skills[0] ?? 'Electrical', customer: '', tech: tech.id, start: iso(start), end: iso(end) })]
  }
  function onEventDelete(row: Job) { rows = rows.filter((r) => r !== row) }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Job> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'tech', resources: techs,
    // A job needs the `skill` tag; a technician's `skills` array must include it.
    requiresField: 'skill',
    views: ['timelineDay'], initialView: 'timelineDay',
    businessHours: { start: 8, end: 18 }, dayStartHour: 7, dayEndHour: 19, timelineTickMinWidth: 90,
    editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize, onEventCommit, onEventAdd, onEventDelete,
  }
</script>

<section class="ds">
  <header class="ds-head">
    <div class="ds-title">
      <strong>Dispatch board</strong>
      <span class="ds-sub">A job only drops on a technician who has the skill - try dragging one to the wrong person</span>
    </div>
    <div class="ds-right">
      <div class="ds-legend">{#each skills as s (s)}<span class="ds-chip"><span class="ds-dot" style:background={skillColor[s]}></span>{s}</span>{/each}</div>
      <div class="ds-seg" role="tablist" aria-label="View">
        <button class="ds-seg-btn" role="tab" aria-selected={view === 'timeline'} class:ds-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
        <button class="ds-seg-btn" role="tab" aria-selected={view === 'table'} class:ds-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
      </div>
    </div>
  </header>
  <div class="ds-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable showPagination={false} />
    {/if}
  </div>
</section>

<style>
  .ds { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .ds-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ds-title { display: flex; flex-direction: column; gap: 2px; }
  .ds-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .ds-right { display: flex; align-items: center; gap: 12px; }
  .ds-legend { display: flex; gap: 10px; }
  .ds-chip { display: flex; align-items: center; gap: 5px; font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .ds-dot { width: 9px; height: 9px; border-radius: 3px; }
  .ds-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .ds-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .ds-seg-btn.ds-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .ds-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
