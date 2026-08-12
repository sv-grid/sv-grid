<script lang="ts">
  /**
   * 394. Utilization heatmap (Enterprise Scheduler Pro)
   * ---------------------------------------------------
   * A support centre where each queue has a capacity (its team size) and calls
   * overlap on it through the day. The row BACKGROUND is tinted by how loaded the
   * queue is each hour - light when quiet, hot when near capacity, red when over.
   * Distinct from the histogram: it colours the whole lane, so a glance shows where
   * the pressure is. Toggle to the Table - same grid rows. Renderer: @svgrid/enterprise.
   */
  import { SvGrid, type ColumnDef, type SchedulerResource, type SchedulerEventMoveEvent, type SchedulerEventResizeEvent } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey, type SchedulerProConfig } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Queue = SchedulerResource & { cap: number }
  const queues: Queue[] = [
    { id: 'front', title: 'Frontline (4)', color: '#4f46e5', cap: 4 },
    { id: 'billing', title: 'Billing (2)', color: '#0891b2', cap: 2 },
    { id: 'tech', title: 'Tech support (3)', color: '#16a34a', cap: 3 },
  ]
  const queueColor = Object.fromEntries(queues.map((q) => [q.id, q.color!]))

  type Call = { id: string; title: string; queue: string; start: string; end: string; color: string }
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const at = (h: number, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return iso(d) }
  let n = 0
  const mk = (queue: string, sh: number, sm: number, eh: number, em: number): Call => ({ id: `c${++n}`, title: `Call ${n}`, queue, start: at(sh, sm), end: at(eh, em), color: queueColor[queue] ?? '#64748b' })

  let rows = $state<Call[]>([
    // Frontline: morning surge (5 calls touching 9-11 -> over its cap of 4), then eases.
    mk('front', 9, 0, 10, 30), mk('front', 9, 0, 11, 0), mk('front', 9, 30, 11, 0), mk('front', 9, 30, 10, 30), mk('front', 9, 15, 10, 45),
    mk('front', 10, 0, 11, 0),
    mk('front', 13, 0, 14, 0), mk('front', 13, 30, 14, 30), mk('front', 15, 0, 16, 0),
    // Billing: two overlapping late morning (at cap 2), one afternoon.
    mk('billing', 10, 30, 12, 0), mk('billing', 11, 0, 12, 30), mk('billing', 14, 0, 15, 0),
    // Tech: steady load around cap 3 midday.
    mk('tech', 9, 30, 11, 0), mk('tech', 10, 0, 11, 30), mk('tech', 10, 30, 12, 0), mk('tech', 13, 0, 14, 30), mk('tech', 15, 0, 16, 30),
  ])

  const columns: ColumnDef<any, Call>[] = [
    { field: 'title', header: 'Call', editorType: 'text', width: 130 },
    { field: 'queue', header: 'Queue', editorType: 'list', editorOptions: queues.map((q) => ({ value: q.id, label: q.title ?? q.id, color: q.color })), width: 150 },
    { field: 'start', header: 'Start', editorType: 'datetime', width: 150 },
    { field: 'end', header: 'End', editorType: 'datetime', width: 150 },
  ]

  function onEventMove(e: SchedulerEventMoveEvent<Call>) { e.row.start = iso(e.start); e.row.end = iso(e.end); if (e.toResource != null) e.row.queue = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Call>) { e.row.start = iso(e.start); e.row.end = iso(e.end) }

  let view = $state<'timeline' | 'table'>('timeline')

  const schedulerCfg: SchedulerProConfig<any, Call> = {
    startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
    resourceField: 'queue', resources: queues,
    utilizationHeatmap: { capacityField: 'cap' },
    views: ['timelineDay'], initialView: 'timelineDay',
    businessHours: { start: 8, end: 18 }, dayStartHour: 8, dayEndHour: 18, timelineTickMinWidth: 120, timelineLaneHeight: 22,
    collisionMode: 'stack',
    editable: true, tooltip: true, drawer: true,
    onEventMove, onEventResize,
  }
</script>

<section class="hm">
  <header class="hm-head">
    <div class="hm-title">
      <strong>Support load</strong>
      <span class="hm-sub">Row background shows each queue's utilization per hour - hot near capacity, red when over</span>
    </div>
    <div class="hm-seg" role="tablist" aria-label="View">
      <button class="hm-seg-btn" role="tab" aria-selected={view === 'timeline'} class:hm-on={view === 'timeline'} onclick={() => (view = 'timeline')}>Timeline</button>
      <button class="hm-seg-btn" role="tab" aria-selected={view === 'table'} class:hm-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
  </header>
  <div class="hm-body">
    {#if view === 'timeline'}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" scheduler={schedulerCfg} />
    {:else}
      <SvGrid data={rows} columns={columns} getRowId={(r) => r.id} containerHeight="100%" editable showPagination={false} />
    {/if}
  </div>
</section>

<style>
  .hm { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .hm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .hm-title { display: flex; flex-direction: column; gap: 2px; }
  .hm-sub { font-size: 0.78rem; color: var(--sg-muted, #6b7280); }
  .hm-seg { display: inline-flex; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
  .hm-seg-btn { border: 0; background: var(--sg-bg, #fff); color: var(--sg-muted, #6b7280); font: inherit; font-size: 0.82rem; padding: 5px 12px; cursor: pointer; }
  .hm-seg-btn.hm-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .hm-body { flex: 1 1 auto; min-height: 0; padding: 8px; }
</style>
