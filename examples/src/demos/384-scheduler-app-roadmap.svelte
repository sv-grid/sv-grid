<script lang="ts">
  /**
   * 384. Portfolio roadmap - a product portfolio planner (real app)
   * ---------------------------------------------------------------
   * Dashboard-forward, not a feature demo. The signature is a live
   * PORTFOLIO-HEALTH strip sitting on top of a Gantt timeline:
   *  - a left rail: brand, a squad roster (lead avatar + active-initiative
   *    count) you can show/hide to filter the roadmap, and a status legend,
   *  - a PORTFOLIO-HEALTH band - four mini charts, all DERIVED from the data
   *    and pure CSS / SvSparkline: a status-mix stacked bar, capacity-by-squad
   *    bars, a delivered-effort burn-up sparkline, and an on-track gauge,
   *  - a compact KPI strip (initiatives / in progress / at risk / shipped),
   *  - the scheduler as a timeline grouped by squad: initiatives are multi-week
   *    bars carrying a progress meter, milestones are amber flags. Zoom
   *    Month / Year; drag a bar to reschedule or hand it to another squad;
   *    drop an idea from the backlog. A companion table holds the same rows.
   * Every chart recomputes as the roadmap changes - schedule, reassign, edit.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvButton,
    SvStat,
    SvGauge,
    SvProgress,
    SvSparkline,
    SvCheckBox,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()

  type Status = 'Planned' | 'In progress' | 'At risk' | 'Shipped'
  type Init = {
    id: number; title: string; squad: string; owner: string; status: Status
    effort: number; progress: number; start: string; end: string; allDay: boolean; color: string
  }
  type Idea = { id: string; title: string; durationMin?: number; color?: string }

  const MILESTONE = '#f59e0b'
  const STATUS_ORDER: Status[] = ['Planned', 'In progress', 'At risk', 'Shipped']
  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    Planned: { color: '#6366f1', variant: 'info' },
    'In progress': { color: '#0891b2', variant: 'info' },
    'At risk': { color: '#dc2626', variant: 'danger' },
    Shipped: { color: '#16a34a', variant: 'success' },
  }

  type Squad = SchedulerResource & { lead: string; initials: string }
  const squads: Squad[] = [
    { id: 'core', title: 'Core Platform', color: '#4f46e5', lead: 'Priya Shah', initials: 'PS' },
    { id: 'growth', title: 'Growth', color: '#0891b2', lead: 'Dana Cole', initials: 'DC' },
    { id: 'mobile', title: 'Mobile', color: '#16a34a', lead: 'Sven Ohm', initials: 'SO' },
    { id: 'data', title: 'Data & AI', color: '#db2777', lead: 'Lena Ross', initials: 'LR' },
  ]

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const first = new Date()
  first.setDate(1)
  first.setHours(0, 0, 0, 0)
  const dm = (dayOffset: number) => { const d = new Date(first); d.setDate(first.getDate() + dayOffset); return isoDay(d) }
  const dayOff = (s: string) => Math.round((new Date(`${s}T00:00`).getTime() - first.getTime()) / 86400000)

  const DAY = 24 * 60
  const mk = (i: Omit<Init, 'color'>): Init => ({ ...i, color: i.owner === '-' ? MILESTONE : STATUS[i.status].color })

  let seq = 100
  let rows = $state<Init[]>([
    // Core Platform
    mk({ id: 1, title: 'Realtime sync engine', squad: 'core', owner: 'Priya', status: 'In progress', effort: 21, progress: 60, start: dm(1), end: dm(18), allDay: true }),
    mk({ id: 2, title: 'Billing v2', squad: 'core', owner: 'Marco', status: 'Planned', effort: 34, progress: 5, start: dm(20), end: dm(45), allDay: true }),
    mk({ id: 3, title: 'API rate limiting', squad: 'core', owner: 'Priya', status: 'Shipped', effort: 8, progress: 100, start: dm(0), end: dm(9), allDay: true }),
    // Growth
    mk({ id: 4, title: 'Referral program', squad: 'growth', owner: 'Dana', status: 'At risk', effort: 13, progress: 35, start: dm(3), end: dm(24), allDay: true }),
    mk({ id: 5, title: 'Pricing page rework', squad: 'growth', owner: 'Dana', status: 'In progress', effort: 8, progress: 55, start: dm(10), end: dm(22), allDay: true }),
    mk({ id: 6, title: 'Lifecycle emails', squad: 'growth', owner: 'Omar', status: 'Planned', effort: 5, progress: 0, start: dm(24), end: dm(38), allDay: true }),
    // Mobile
    mk({ id: 7, title: 'Onboarding revamp', squad: 'mobile', owner: 'Sven', status: 'In progress', effort: 13, progress: 45, start: dm(6), end: dm(15), allDay: true }),
    mk({ id: 8, title: 'Offline mode', squad: 'mobile', owner: 'Sven', status: 'Planned', effort: 21, progress: 10, start: dm(18), end: dm(40), allDay: true }),
    mk({ id: 9, title: 'Push notifications', squad: 'mobile', owner: 'Mia', status: 'At risk', effort: 8, progress: 25, start: dm(12), end: dm(28), allDay: true }),
    // Data & AI
    mk({ id: 10, title: 'Model eval harness', squad: 'data', owner: 'Lena', status: 'Shipped', effort: 8, progress: 100, start: dm(2), end: dm(12), allDay: true }),
    mk({ id: 11, title: 'Semantic search', squad: 'data', owner: 'Lena', status: 'In progress', effort: 34, progress: 40, start: dm(14), end: dm(38), allDay: true }),
    mk({ id: 12, title: 'Warehouse migration', squad: 'data', owner: 'Kai', status: 'Planned', effort: 21, progress: 0, start: dm(26), end: dm(46), allDay: true }),
    // milestones (single-day amber flags)
    mk({ id: 13, title: '🚩 Public beta', squad: 'core', owner: '-', status: 'Planned', effort: 0, progress: 0, start: dm(24), end: dm(25), allDay: true }),
    mk({ id: 14, title: '🚩 Investor demo', squad: 'growth', owner: '-', status: 'Planned', effort: 0, progress: 0, start: dm(30), end: dm(31), allDay: true }),
    mk({ id: 15, title: '🚩 v3.0 launch', squad: 'data', owner: '-', status: 'Planned', effort: 0, progress: 0, start: dm(40), end: dm(41), allDay: true }),
  ])
  let backlog = $state<Idea[]>([
    { id: 'i1', title: 'SSO for enterprise', durationMin: 14 * DAY, color: STATUS.Planned.color },
    { id: 'i2', title: 'Usage-based pricing', durationMin: 21 * DAY, color: STATUS.Planned.color },
    { id: 'i3', title: 'Push-to-web parity', durationMin: 10 * DAY, color: STATUS.Planned.color },
  ])

  const isMilestone = (r: Init) => r.owner === '-'

  // --- Interactive filters (roster show/hide) --------------------------------
  let hidden = $state<Record<string, boolean>>({})
  // Only mount the companion table while its <details> is open, so a collapsed
  // table never renders a stray (horizontally-scrolling) grid off-screen.
  let tableOpen = $state(false)
  const shownSquads = $derived(squads.filter((s) => !hidden[s.id]))
  const filtered = $derived(rows.filter((r) => !hidden[r.squad]))
  const activeCount = (id: string) => rows.filter((r) => r.squad === id && !isMilestone(r)).length

  // --- Portfolio metrics (all derived - the whole dashboard reacts) ----------
  const initiatives = $derived(rows.filter((r) => !isMilestone(r)))
  const inProgress = $derived(initiatives.filter((r) => r.status === 'In progress').length)
  const atRisk = $derived(initiatives.filter((r) => r.status === 'At risk').length)
  const shipped = $derived(initiatives.filter((r) => r.status === 'Shipped').length)
  // delivery on-track = share of initiatives not flagged at risk (higher is better)
  const onTrack = $derived(initiatives.length ? Math.round(((initiatives.length - atRisk) / initiatives.length) * 100) : 0)

  // Chart 1: status mix -> horizontal stacked bar segments
  const statusMix = $derived(
    STATUS_ORDER.map((s) => {
      const count = initiatives.filter((r) => r.status === s).length
      return { label: s, count, color: STATUS[s].color, pct: initiatives.length ? (count / initiatives.length) * 100 : 0 }
    }),
  )
  // Chart 2: capacity by squad -> summed effort (story points) per squad
  const capacity = $derived(
    squads.map((sq) => ({
      id: sq.id,
      initials: sq.initials,
      color: sq.color,
      effort: initiatives.filter((r) => r.squad === sq.id).reduce((sum, r) => sum + r.effort, 0),
    })),
  )
  const capMax = $derived(Math.max(1, ...capacity.map((c) => c.effort)))
  const capTotal = $derived(capacity.reduce((s, c) => s + c.effort, 0))
  // Chart 3: delivered-effort burn-up over the planning window (progress-weighted)
  const deliveryTrend = $derived.by(() => {
    const span = 56
    const buckets = 9
    const out: number[] = []
    for (let b = 1; b <= buckets; b++) {
      const cutoff = (b / buckets) * span
      let total = 0
      for (const r of initiatives) {
        const s = dayOff(r.start)
        const e = dayOff(r.end)
        if (s > cutoff) continue
        const frac = e <= s ? 1 : Math.max(0, Math.min(1, (cutoff - s) / (e - s)))
        total += r.effort * (r.progress / 100) * frac
      }
      out.push(Math.round(total))
    }
    return out
  })

  const columns: ColumnDef<any, Init>[] = [
    { field: 'title', header: 'Initiative', editorType: 'text', width: 190 },
    { field: 'squad', header: 'Squad', editorType: 'list', editorOptions: squads.map((s) => ({ value: s.id, label: s.title ?? s.id, color: s.color })), width: 140 },
    { field: 'owner', header: 'Owner', editorType: 'text', width: 100 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 130 },
    { field: 'effort', header: 'Effort', editorType: 'number', width: 90 },
    { field: 'progress', header: 'Progress', editorType: 'number', width: 100 },
    { field: 'start', header: 'Start', editorType: 'date', width: 130 },
    { field: 'end', header: 'End', editorType: 'date', width: 130 },
  ]

  function onSchedule(item: Idea, start: Date, resourceId?: string) {
    const squad = resourceId ?? shownSquads[0]?.id ?? squads[0].id
    const end = new Date(start.getTime() + (item.durationMin ?? 14 * DAY) * 60000)
    rows = [...rows, mk({ id: ++seq, title: item.title, squad, owner: 'TBD', status: 'Planned', effort: 8, progress: 0, start: isoDay(start), end: isoDay(end), allDay: true })]
    backlog = backlog.filter((i) => i.id !== item.id)
  }
  function newInitiative() {
    const squad = shownSquads[0]?.id ?? squads[0].id
    rows = [...rows, mk({ id: ++seq, title: 'New initiative', squad, owner: 'TBD', status: 'Planned', effort: 8, progress: 0, start: dm(1), end: dm(14), allDay: true })]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Init>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end); if (e.toResource != null) e.row.squad = e.toResource }
  function onEventResize(e: SchedulerEventResizeEvent<Init>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Init>) { Object.assign(e.row, e.values); e.row.color = isMilestone(e.row) ? MILESTONE : STATUS[e.row.status]?.color ?? e.row.color }
  function onEventDelete(row: Init) { rows = rows.filter((r) => r !== row) }
</script>

{#snippet initBody(row: Init)}
  {#if row.owner === '-'}
    <span class="rm-ev"><span class="rm-ev-top"><span class="rm-ev-title">{row.title}</span></span></span>
  {:else}
    <span class="rm-ev">
      <span class="rm-ev-top">
        <span class="rm-ev-title">{row.title}</span>
        <span class="rm-ev-owner">{row.owner}</span>
      </span>
      <span class="rm-ev-prog"><SvProgress value={row.progress} max={100} size="sm" /></span>
    </span>
  {/if}
{/snippet}

<section class="rm" data-mobile-pan>
  <aside class="rm-nav">
    <header class="rm-brand"><span class="rm-brand-mark">🗺</span><span><span class="rm-brand-name">Roadmap</span><span class="rm-brand-sub">Portfolio planning</span></span></header>

    <div class="rm-roster">
      <div class="rm-sec-head">Squads <span class="rm-sec-count">{shownSquads.length}/{squads.length}</span></div>
      {#each squads as s (s.id)}
        <label class="rm-squad" class:rm-squad-off={hidden[s.id]}>
          <SvCheckBox checked={!hidden[s.id]} onChange={(v) => (hidden = { ...hidden, [s.id]: !v })} ariaLabel={`Show ${s.title}`} />
          <SvAvatar name={s.lead} color={s.color} size="sm" />
          <span class="rm-squad-txt">
            <span class="rm-squad-name">{s.title}</span>
            <span class="rm-squad-lead">{s.lead}</span>
          </span>
          <SvBadge variant="neutral" size="sm">{activeCount(s.id)}</SvBadge>
        </label>
      {/each}
    </div>

    <div class="rm-legend">
      <div class="rm-sec-head">Status</div>
      {#each Object.entries(STATUS) as [s, v] (s)}
        <div class="rm-legend-row"><span class="rm-dot" style:background={v.color}></span>{s}</div>
      {/each}
      <div class="rm-legend-row"><span class="rm-dot rm-dot-flag" style:background={MILESTONE}></span>Milestone</div>
    </div>
  </aside>

  <div class="rm-main">
    <header class="rm-head">
      <div class="rm-head-l"><span class="rm-title">Portfolio health</span><span class="rm-sub">Live signals across {initiatives.length} initiatives - recomputed as you plan</span></div>
      <SvButton variant="primary" size="sm" onclick={newInitiative}>+ New initiative</SvButton>
    </header>

    <!-- PORTFOLIO-HEALTH strip: four mini charts, all derived, pure CSS / SvSparkline -->
    <div class="rm-health">
      <div class="rm-hcard">
        <div class="rm-hcard-title">Status mix</div>
        <div class="rm-stack" role="img" aria-label="Initiative count by status">
          {#each statusMix as seg (seg.label)}
            {#if seg.count > 0}
              <div class="rm-stack-seg" style:width={`${seg.pct}%`} style:background={seg.color} title={`${seg.label}: ${seg.count}`}></div>
            {/if}
          {/each}
        </div>
        <div class="rm-stack-legend">
          {#each statusMix as seg (seg.label)}
            <span class="rm-mini-leg"><span class="rm-dot" style:background={seg.color}></span>{seg.label}<b>{seg.count}</b></span>
          {/each}
        </div>
      </div>

      <div class="rm-hcard">
        <div class="rm-hcard-title">Capacity by squad <span class="rm-hcard-note">{capTotal} pts</span></div>
        <div class="rm-bars">
          {#each capacity as c (c.id)}
            <div class="rm-bar-col" class:rm-bar-off={hidden[c.id]} title={`${c.effort} story points`}>
              <span class="rm-bar-val">{c.effort}</span>
              <span class="rm-bar-track"><span class="rm-bar-fill" style:height={`${Math.max(4, (c.effort / capMax) * 100)}%`} style:background={c.color}></span></span>
              <span class="rm-bar-label">{c.initials}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="rm-hcard">
        <div class="rm-hcard-title">Delivery trend</div>
        <div class="rm-spark">
          <SvSparkline data={deliveryTrend} type="area" width={200} height={46} color={STATUS.Shipped.color} />
        </div>
        <div class="rm-hcard-cap">Delivered effort, cumulative</div>
      </div>

      <div class="rm-hcard rm-hcard-gauge">
        <div class="rm-hcard-title">On-track</div>
        <SvGauge value={onTrack} min={0} max={100} unit="%" size={96} thickness={10}
          bands={[{ from: 0, to: 40, color: '#dc2626' }, { from: 40, to: 70, color: '#d97706' }, { from: 70, to: 100, color: '#16a34a' }]} />
        <div class="rm-hcard-cap">{initiatives.length - atRisk} of {initiatives.length} not at risk</div>
      </div>
    </div>

    <div class="rm-kpis">
      <SvStat label="Initiatives" value={initiatives.length} hint="on the roadmap" />
      <SvStat label="In progress" value={inProgress} hint="active now" />
      <SvStat label="At risk" value={atRisk} hint="need attention" invert trend={atRisk > 0 ? 'up' : 'flat'} />
      <SvStat label="Shipped" value={shipped} hint="delivered" trend={shipped > 0 ? 'up' : 'flat'} />
    </div>

    <div class="rm-toolbar">
      <span class="rm-tb-title">Timeline</span>
      <span class="rm-tb-sub">Drag a bar to reschedule or reassign, drop an idea from the backlog, zoom Month / Year</span>
    </div>

    <div class="rm-cal">
      <SvGrid
      columnResize
        data={filtered}
        columns={columns}
        getRowId={(r) => String(r.id)}
        containerHeight="100%"
        scheduler={{
          startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
          allDayField: 'allDay',
          resourceField: 'squad', resources: shownSquads,
          views: ['timelineMonth', 'timelineYear'], initialView: 'timelineMonth', weekStartsOn: 1,
          unscheduled: backlog, backlogTitle: 'Idea backlog',
          event: initBody, tooltip: true, editable: true, drawer: true,
          onSchedule, onEventMove, onEventResize, onEventCommit, onEventDelete,
        }}
      />
    </div>

    <details class="rm-table" bind:open={tableOpen}>
      <summary>All initiatives ({rows.length})</summary>
      {#if tableOpen}
        <div class="rm-table-grid">
          <SvGrid
      columnResize data={rows} columns={columns} getRowId={(r) => String(r.id)} containerHeight="260px" fitColumns />
        </div>
      {/if}
    </details>
  </div>
</section>

<style>
  .rm { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }

  /* Left rail */
  .rm-nav { flex: 0 0 230px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .rm-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .rm-brand-mark { font-size: 20px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); }
  .rm-brand-name { display: block; font-weight: 700; }
  .rm-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .rm-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #9ca3af); padding: 8px 4px 6px; }
  .rm-sec-count { font-weight: 600; }
  .rm-roster { padding: 8px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 60px; }
  .rm-squad { display: flex; align-items: center; gap: 9px; padding: 7px 6px; border-radius: 8px; cursor: pointer; }
  .rm-squad:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .rm-squad-off { opacity: 0.5; }
  .rm-squad-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .rm-squad-name { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm-squad-lead { font-size: 0.7rem; color: var(--sg-muted, #6b7280); }
  .rm-legend { padding: 8px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .rm-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .rm-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .rm-dot-flag { border-radius: 2px; }

  /* Main column */
  .rm-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .rm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px 6px; }
  .rm-head-l { display: flex; flex-direction: column; }
  .rm-title { font-weight: 700; font-size: 0.98rem; }
  .rm-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }

  /* Portfolio-health strip */
  /* The timeline is this app's centrepiece, and the chrome above it was taking
     400px of a 638px pane - leaving the calendar 240px, of which only ~114px
     reached the squad rows. Two of four squads were cut off below the fold on a
     1040px viewport. These are the same cards, just denser. */
  .rm-health { display: grid; grid-template-columns: 1.25fr 1.1fr 1.2fr 0.85fr; gap: 8px; padding: 2px 14px 6px; }
  .rm-hcard { display: flex; flex-direction: column; gap: 5px; padding: 7px 10px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; background: var(--sg-bg, #fff); min-width: 0; }
  .rm-hcard-title { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8); }
  .rm-hcard-note { font-weight: 700; color: var(--sg-fg, #334155); letter-spacing: 0; text-transform: none; font-size: 0.7rem; }
  .rm-hcard-cap { font-size: 0.7rem; color: var(--sg-muted, #6b7280); text-align: center; }
  .rm-hcard-gauge { align-items: center; }

  /* Chart 1: status-mix stacked bar */
  .rm-stack { display: flex; width: 100%; height: 16px; border-radius: 8px; overflow: hidden; background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .rm-stack-seg { height: 100%; min-width: 3px; transition: width 0.3s ease; }
  .rm-stack-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: auto; }
  .rm-mini-leg { display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; color: var(--sg-muted, #6b7280); }
  .rm-mini-leg b { color: var(--sg-fg, #334155); font-variant-numeric: tabular-nums; }

  /* Chart 2: capacity bars */
  .rm-bars { display: flex; align-items: stretch; gap: 8px; height: 42px; }
  .rm-bar-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .rm-bar-off { opacity: 0.45; }
  .rm-bar-val { font-size: 0.62rem; font-weight: 700; color: var(--sg-fg, #334155); font-variant-numeric: tabular-nums; }
  .rm-bar-track { flex: 1 1 auto; width: 100%; max-width: 26px; display: flex; align-items: flex-end; }
  .rm-bar-fill { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.3s ease; }
  .rm-bar-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.02em; color: var(--sg-muted, #6b7280); }

  /* Chart 3: sparkline */
  .rm-spark { flex: 1 1 auto; display: grid; place-items: center; }
  .rm-spark :global(svg) { width: 100%; }

  /* KPI strip */
  .rm-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 2px 14px 6px; }
  .rm-kpis :global(.sv-stat) { padding: 7px 12px !important; gap: 2px !important; border-radius: 9px !important; }
  .rm-kpis :global(.sv-stat__value) { font-size: 18px !important; }
  .rm-kpis :global(.sv-stat__label) { font-size: 11px !important; }
  .rm-kpis :global(.sv-stat__foot) { font-size: 11px !important; }

  /* Toolbar + timeline */
  .rm-toolbar { display: flex; align-items: baseline; gap: 10px; padding: 6px 14px 4px; }
  .rm-tb-title { font-weight: 700; font-size: 0.9rem; }
  .rm-tb-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .rm-cal { flex: 1 1 auto; min-height: 220px; padding: 0 8px; }
  .rm-table { padding: 8px 14px 14px; }
  .rm-table summary { cursor: pointer; font-size: 0.82rem; font-weight: 600; color: var(--sg-muted, #4b5563); padding: 4px 0; }
  .rm-table-grid { margin-top: 8px; }

  /* Event bar body */
  .rm-ev { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; gap: 2px; }
  .rm-ev-top { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .rm-ev-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm-ev-owner { font-size: 0.74em; opacity: 0.85; flex: none; }
  .rm-ev-prog { display: block; width: 70px; }

  /* Mobile: this is an app-shell console - a fixed 230px nav rail beside the
     scheduler - and the root hides its overflow, so on a phone the right-hand
     side was silently cut off. Floor it and let the whole console pan inside
     the demo stage (see .demo-stage.is-wide in examples/src/mobile.css), which
     keeps the rail and the timeline aligned. */
  @media (max-width: 767px) {
    .rm {
      min-width: 900px;
    }
  }
  /* Phone: the shell hides overflow for its rounded corners, which makes its automatic
     minimum height 0 - so as a flex item of the demo stage it shrank to the (short)
     phone stage and clipped its lower panes. Keep the content height; the stage
     scrolls vertically and pans sideways. */
  @media (max-width: 767px) {
    .rm { flex-shrink: 0; }
  }
</style>
