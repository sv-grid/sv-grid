<script lang="ts">
  /**
   * 385. Broadcast - a content & marketing command center (real app)
   * ----------------------------------------------------------------
   * One grid, two views of the SAME rows - the signature of this console:
   *  - a Calendar <-> Board toggle over a single <SvGrid>. Calendar is the
   *    editorial month (drag a draft idea from the backlog onto a date);
   *    Board is the approval PIPELINE (Idea -> Draft -> In review -> Scheduled
   *    -> Published) where dragging a card between lanes reassigns its status.
   *  - a left rail: channel filters (show/hide + this-month count), a campaign
   *    mini-list, an owner roster, and the status pipeline legend,
   *  - a KPI strip (scheduled / published / in review / total engagement reach),
   *  - engagement is first-class: every post carries a reach number and a 7-point
   *    trend that renders as a sparkline on each board card.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvButton,
    SvStat,
    SvSparkline,
    SvTextInput,
    SvCheckBox,
    type ColumnDef,
    type SchedulerResource,
    type SchedulerEventMoveEvent,
    type SchedulerEventResizeEvent,
    type SchedulerEventCommitEvent,
    type BoardCardMoveEvent,
    type BoardCardCommitEvent,
  } from '@svgrid/grid'
  import { enableSchedulerView, enableBoardView, setLicenseKey } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableSchedulerView()
  enableBoardView()

  type Channel = 'blog' | 'email' | 'social' | 'video'
  type Status = 'Idea' | 'Draft' | 'In review' | 'Scheduled' | 'Published'
  type Post = {
    id: number; title: string; channel: Channel; status: Status; owner: string
    campaign: string; reach: number; trend: number[]
    start: string; end: string; allDay: boolean; color: string
  }
  type Draft = { id: string; title: string; durationMin?: number; color?: string }

  const CH: Record<Channel, { label: string; color: string }> = {
    blog: { label: 'Blog', color: '#4f46e5' },
    email: { label: 'Email', color: '#0891b2' },
    social: { label: 'Social', color: '#db2777' },
    video: { label: 'Video', color: '#d97706' },
  }
  const channels: Channel[] = Object.keys(CH) as Channel[]
  const channelResources: SchedulerResource[] = channels.map((id) => ({ id, title: CH[id].label, color: CH[id].color }))

  const STATUS: Record<Status, { color: string; variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
    Idea: { color: '#94a3b8', variant: 'neutral' },
    Draft: { color: '#d97706', variant: 'warning' },
    'In review': { color: '#7c3aed', variant: 'info' },
    Scheduled: { color: '#6366f1', variant: 'info' },
    Published: { color: '#16a34a', variant: 'success' },
  }
  const statuses = Object.keys(STATUS) as Status[]

  type Owner = { name: string; color: string }
  const owners: Owner[] = [
    { name: 'Mia', color: '#db2777' },
    { name: 'Tom', color: '#4f46e5' },
    { name: 'Ana', color: '#0891b2' },
    { name: 'Leo', color: '#d97706' },
  ]

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const first = new Date()
  first.setDate(1)
  first.setHours(0, 0, 0, 0)
  // start-of-month day helper: dm(0) is the 1st, dm(6) is the 7th, etc.
  const dm = (dayOffset: number) => { const d = new Date(first); d.setDate(first.getDate() + dayOffset); return isoDay(d) }

  const DAY = 24 * 60
  let seq = 100
  // a small, stable-looking 7-point trend from a seed
  const spark = (seed: number): number[] => Array.from({ length: 7 }, (_, i) => 3 + ((seed * (i + 3) * 7) % 12))
  const mk = (p: Omit<Post, 'allDay' | 'color' | 'trend'>): Post => ({ ...p, allDay: true, color: CH[p.channel].color, trend: spark(p.id + p.reach) })

  // ~18 posts + multi-day campaigns spread across the whole current month, so
  // the Month grid is full and the Agenda list always has rows.
  let all = $state<Post[]>([
    mk({ id: 1, title: 'Launch week campaign', channel: 'social', status: 'Scheduled', owner: 'Mia', campaign: 'Q3 Launch', reach: 14200, start: dm(6), end: dm(11) }),
    mk({ id: 2, title: 'Feature deep-dive', channel: 'blog', status: 'Draft', owner: 'Tom', campaign: 'Q3 Launch', reach: 5100, start: dm(3), end: dm(4) }),
    mk({ id: 3, title: 'Monthly newsletter', channel: 'email', status: 'Published', owner: 'Ana', campaign: 'Always-on', reach: 9800, start: dm(1), end: dm(2) }),
    mk({ id: 4, title: 'Product demo reel', channel: 'video', status: 'Idea', owner: 'Leo', campaign: 'Q3 Launch', reach: 2400, start: dm(9), end: dm(10) }),
    mk({ id: 5, title: 'Customer story: Northwind', channel: 'blog', status: 'Published', owner: 'Tom', campaign: 'Proof', reach: 7300, start: dm(13), end: dm(14) }),
    mk({ id: 6, title: 'Webinar promo', channel: 'email', status: 'In review', owner: 'Ana', campaign: 'Webinar', reach: 4600, start: dm(16), end: dm(20) }),
    mk({ id: 7, title: 'Behind the scenes', channel: 'social', status: 'Idea', owner: 'Mia', campaign: 'Always-on', reach: 3100, start: dm(21), end: dm(22) }),
    mk({ id: 8, title: 'Q&A livestream', channel: 'video', status: 'Published', owner: 'Leo', campaign: 'Webinar', reach: 11200, start: dm(24), end: dm(25) }),
    mk({ id: 9, title: 'Welcome series drip', channel: 'email', status: 'Published', owner: 'Ana', campaign: 'Onboarding', reach: 6400, start: dm(0), end: dm(0) }),
    mk({ id: 10, title: 'Product roundup', channel: 'blog', status: 'Published', owner: 'Tom', campaign: 'Always-on', reach: 5900, start: dm(2), end: dm(2) }),
    mk({ id: 11, title: 'Poll: feature vote', channel: 'social', status: 'Published', owner: 'Mia', campaign: 'Community', reach: 8700, start: dm(5), end: dm(5) }),
    mk({ id: 12, title: 'Tutorial: quick start', channel: 'video', status: 'Scheduled', owner: 'Leo', campaign: 'Onboarding', reach: 7600, start: dm(12), end: dm(13) }),
    mk({ id: 13, title: 'Pricing update post', channel: 'blog', status: 'In review', owner: 'Tom', campaign: 'Always-on', reach: 4200, start: dm(18), end: dm(18) }),
    mk({ id: 14, title: 'Community spotlight', channel: 'social', status: 'Scheduled', owner: 'Mia', campaign: 'Community', reach: 6100, start: dm(26), end: dm(27) }),
    mk({ id: 15, title: 'Roadmap AMA', channel: 'video', status: 'Idea', owner: 'Leo', campaign: 'Community', reach: 3500, start: dm(28), end: dm(29) }),
    mk({ id: 16, title: 'Month-in-review email', channel: 'email', status: 'Draft', owner: 'Ana', campaign: 'Always-on', reach: 5300, start: dm(29), end: dm(30) }),
    mk({ id: 17, title: 'Changelog digest', channel: 'email', status: 'Published', owner: 'Ana', campaign: 'Always-on', reach: 4800, start: dm(23), end: dm(23) }),
    mk({ id: 18, title: 'Founder interview', channel: 'blog', status: 'In review', owner: 'Tom', campaign: 'Proof', reach: 8100, start: dm(15), end: dm(16) }),
  ])

  let backlog = $state<Draft[]>([
    { id: 'd1', title: 'Case study: Contoso', durationMin: DAY, color: CH.blog.color },
    { id: 'd2', title: 'Tips thread', durationMin: DAY, color: CH.social.color },
    { id: 'd3', title: 'Release notes email', durationMin: DAY, color: CH.email.color },
    { id: 'd4', title: 'Demo video teaser', durationMin: DAY, color: CH.video.color },
  ])

  // --- View toggle: Calendar <-> Board over the SAME grid ---------------------
  let view = $state<'calendar' | 'board'>('calendar')

  // --- Interactive filters ----------------------------------------------------
  let query = $state('')
  let visible = $state<Record<Channel, boolean>>({ blog: true, email: true, social: true, video: true })
  const shownChannels = $derived(channels.filter((c) => visible[c]))
  const q = $derived(query.trim().toLowerCase())
  const rows = $derived(
    all.filter((p) => visible[p.channel] && (q === '' || p.title.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q) || p.campaign.toLowerCase().includes(q))),
  )

  // --- Counts, campaigns + KPIs (everything is seeded within the current month)
  const channelCount = (c: Channel) => all.filter((p) => p.channel === c).length
  const ownerCount = (name: string) => all.filter((p) => p.owner === name).length
  const statusCount = (s: Status) => all.filter((p) => p.status === s).length
  const campaigns = $derived(
    [...new Set(all.map((p) => p.campaign))].map((name) => ({ name, count: all.filter((p) => p.campaign === name).length })),
  )
  const scheduled = $derived(statusCount('Scheduled'))
  const published = $derived(statusCount('Published'))
  const inReview = $derived(statusCount('In review'))
  const totalReach = $derived(all.reduce((s, p) => s + p.reach, 0))
  const fmtReach = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

  const columns: ColumnDef<any, Post>[] = [
    { field: 'title', header: 'Content', editorType: 'text', width: 200 },
    { field: 'channel', header: 'Channel', editorType: 'list', editorOptions: channels.map((c) => ({ value: c, label: CH[c].label, color: CH[c].color })), width: 110 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: statuses.map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 120 },
    { field: 'owner', header: 'Owner', editorType: 'text', width: 100 },
    { field: 'campaign', header: 'Campaign', editorType: 'text', width: 130 },
    { field: 'reach', header: 'Reach', editorType: 'number', width: 100 },
    { field: 'start', header: 'Publish', editorType: 'date', width: 130 },
    { field: 'end', header: 'Ends', editorType: 'date', width: 130 },
  ]

  // Board pipeline: one lane per approval status, in workflow order.
  const lanes = statuses.map((s) => ({ id: s, title: s, color: STATUS[s].color }))

  function guessChannel(title: string): Channel {
    const t = title.toLowerCase()
    return t.includes('email') || t.includes('notes') ? 'email' : t.includes('thread') || t.includes('social') ? 'social' : t.includes('video') || t.includes('reel') || t.includes('demo') ? 'video' : 'blog'
  }
  function onSchedule(item: Draft, start: Date) {
    const channel = guessChannel(item.title)
    all = [...all, mk({ id: ++seq, title: item.title, channel, status: 'Draft', owner: 'TBD', campaign: 'Backlog', reach: 0, start: isoDay(start), end: isoDay(start) })]
    backlog = backlog.filter((d) => d.id !== item.id)
  }
  function newDraft() {
    const channel = shownChannels[0] ?? 'blog'
    all = [...all, mk({ id: ++seq, title: 'New draft', channel, status: 'Idea', owner: 'TBD', campaign: 'Backlog', reach: 0, start: dm(0), end: dm(0) })]
  }
  // Scheduler edits
  function onEventMove(e: SchedulerEventMoveEvent<Post>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end) }
  function onEventResize(e: SchedulerEventResizeEvent<Post>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Post>) { Object.assign(e.row, e.values); e.row.color = CH[e.row.channel]?.color ?? e.row.color }
  function onEventDelete(row: Post) { all = all.filter((r) => r !== row) }
  // Board edits: dragging a card to another lane advances its approval status.
  function onCardMove(e: BoardCardMoveEvent<Post>) { e.row.status = e.toLane as Status }
  function onCardCommit(e: BoardCardCommitEvent<Post>) { Object.assign(e.row, e.values); e.row.color = CH[e.row.channel]?.color ?? e.row.color }
</script>

{#snippet postBody(row: Post)}
  <span class="ct-ev">
    <span class="ct-ev-dot" style:background={CH[row.channel].color}></span>
    <span class="ct-ev-title">{row.title}</span>
    <span class="ct-ev-status" style:color={STATUS[row.status].color}>{row.status}</span>
  </span>
{/snippet}

{#snippet postCard(row: Post)}
  <div class="ct-card">
    <div class="ct-card-head">
      <span class="ct-card-dot" style:background={CH[row.channel].color}></span>
      <span class="ct-card-title">{row.title}</span>
    </div>
    <div class="ct-card-meta">
      <span class="ct-card-owner"><SvAvatar name={row.owner} size={18} /> {row.owner}</span>
      <SvBadge variant="neutral" size="sm">{row.campaign}</SvBadge>
    </div>
    <div class="ct-card-foot">
      <span class="ct-card-reach">{fmtReach(row.reach)} reach</span>
      <SvSparkline data={row.trend} type="area" width={72} height={20} color={CH[row.channel].color} />
    </div>
  </div>
{/snippet}

<section class="ct" data-mobile-pan>
  <aside class="ct-nav">
    <header class="ct-brand"><span class="ct-brand-mark">📣</span><span><span class="ct-brand-name">Broadcast</span><span class="ct-brand-sub">Content command center</span></span></header>

    <div class="ct-search">
      <SvTextInput bind:value={query} placeholder="Search title / owner / campaign" clearable />
    </div>

    <div class="ct-roster">
      <div class="ct-sec-head">Channels <span class="ct-sec-count">{shownChannels.length}/{channels.length}</span></div>
      {#each channels as c (c)}
        <label class="ct-ch" class:ct-ch-off={!visible[c]}>
          <SvCheckBox checked={visible[c]} onChange={(v) => (visible = { ...visible, [c]: v })} ariaLabel={`Show ${CH[c].label}`} />
          <span class="ct-dot" style:background={CH[c].color}></span>
          <span class="ct-ch-label">{CH[c].label}</span>
          <SvBadge variant="neutral" size="sm">{channelCount(c)}</SvBadge>
        </label>
      {/each}

      <div class="ct-sec-head ct-sec-head-t">Campaigns</div>
      {#each campaigns as cp (cp.name)}
        <div class="ct-camp">
          <span class="ct-camp-name">{cp.name}</span>
          <SvBadge variant="info" size="sm">{cp.count}</SvBadge>
        </div>
      {/each}

      <div class="ct-sec-head ct-sec-head-t">Owners</div>
      {#each owners as o (o.name)}
        <div class="ct-owner">
          <SvAvatar name={o.name} color={o.color} size="sm" />
          <span class="ct-owner-name">{o.name}</span>
          <SvBadge variant="neutral" size="sm">{ownerCount(o.name)}</SvBadge>
        </div>
      {/each}
    </div>

    <div class="ct-legend">
      <div class="ct-sec-head">Pipeline</div>
      {#each statuses as s (s)}
        <div class="ct-legend-row"><span class="ct-legdot" style:background={STATUS[s].color}></span>{s}</div>
      {/each}
    </div>
  </aside>

  <div class="ct-main">
    <div class="ct-kpis">
      <SvStat label="Scheduled" value={scheduled} hint="queued to publish" />
      <SvStat label="Published" value={published} hint="live this month" />
      <SvStat label="In review" value={inReview} hint="awaiting approval" />
      <SvStat label="Engagement" value={fmtReach(totalReach)} hint="total reach" />
    </div>

    <div class="ct-toolbar">
      <div class="ct-toolbar-l">
        <span class="ct-title">{view === 'calendar' ? 'Editorial calendar' : 'Approval pipeline'}</span>
        <span class="ct-sub">
          {view === 'calendar'
            ? 'Drag a draft idea onto a date to schedule it'
            : 'Drag a card between lanes to advance its status'}
        </span>
      </div>
      <div class="ct-toolbar-r">
        <div class="ct-seg" role="tablist" aria-label="View">
          <button class="ct-seg-btn" class:ct-seg-on={view === 'calendar'} role="tab" aria-selected={view === 'calendar'} onclick={() => (view = 'calendar')}>Calendar</button>
          <button class="ct-seg-btn" class:ct-seg-on={view === 'board'} role="tab" aria-selected={view === 'board'} onclick={() => (view = 'board')}>Board</button>
        </div>
        <SvButton variant="primary" size="sm" onclick={newDraft}>+ New draft</SvButton>
      </div>
    </div>

    <div class="ct-stage">
      {#if view === 'calendar'}
        <SvGrid
      columnResize
          data={rows}
          columns={columns}
          getRowId={(r) => String(r.id)}
          containerHeight="100%"
          scheduler={{
            startField: 'start', endField: 'end', titleField: 'title', colorField: 'color',
            allDayField: 'allDay',
            resources: channelResources,
            views: ['month', 'week', 'agenda'], initialView: 'month', initialDate: first, weekStartsOn: 1,
            unscheduled: backlog, backlogTitle: 'Draft ideas',
            event: postBody, tooltip: true, editable: true, drawer: true,
            onSchedule, onEventMove, onEventResize, onEventCommit, onEventDelete,
          }}
        />
      {:else}
        <SvGrid
      columnResize
          data={rows}
          columns={columns}
          getRowId={(r) => String(r.id)}
          containerHeight="100%"
          board={{
            groupBy: 'status',
            lanes,
            editable: true,
            collapsibleLanes: true,
            onCardMove,
            onCardCommit,
            card: postCard,
          }}
        />
      {/if}
    </div>
  </div>
</section>

<style>
  .ct { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .ct-nav { flex: 0 0 230px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .ct-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ct-brand-mark { font-size: 18px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); }
  .ct-brand-name { display: block; font-weight: 700; }
  .ct-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .ct-search { padding: 10px 12px 4px; }
  .ct-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #9ca3af); padding: 8px 4px 6px; }
  .ct-sec-head-t { margin-top: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .ct-sec-count { font-weight: 600; }
  .ct-roster { padding: 4px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 60px; }
  .ct-ch { display: flex; align-items: center; gap: 9px; padding: 6px 6px; border-radius: 8px; cursor: pointer; }
  .ct-ch:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .ct-ch-off { opacity: 0.5; }
  .ct-ch-label { flex: 1 1 auto; font-size: 0.85rem; font-weight: 600; }
  .ct-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .ct-camp { display: flex; align-items: center; gap: 9px; padding: 5px 6px; border-radius: 8px; }
  .ct-camp-name { flex: 1 1 auto; font-size: 0.82rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ct-owner { display: flex; align-items: center; gap: 9px; padding: 5px 6px; border-radius: 8px; }
  .ct-owner-name { flex: 1 1 auto; font-size: 0.85rem; font-weight: 600; }
  .ct-legend { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .ct-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .ct-legdot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .ct-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .ct-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 14px 4px; }
  .ct-kpis :global(.sv-stat) { padding: 7px 12px !important; gap: 2px !important; border-radius: 9px !important; }
  .ct-kpis :global(.sv-stat__value) { font-size: 18px !important; }
  .ct-kpis :global(.sv-stat__label) { font-size: 11px !important; }
  .ct-kpis :global(.sv-stat__foot) { font-size: 11px !important; }
  .ct-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; }
  .ct-toolbar-l { display: flex; flex-direction: column; min-width: 0; }
  .ct-toolbar-r { display: flex; align-items: center; gap: 10px; flex: none; }
  .ct-title { font-weight: 600; }
  .ct-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .ct-seg { display: inline-flex; border: 1px solid var(--sg-border, #d1d5db); border-radius: 8px; overflow: hidden; background: var(--sg-bg, #fff); }
  .ct-seg-btn { appearance: none; border: 0; background: transparent; padding: 5px 14px; font-size: 0.82rem; font-weight: 600; cursor: pointer; color: var(--sg-muted, #6b7280); }
  .ct-seg-btn + .ct-seg-btn { border-left: 1px solid var(--sg-border, #d1d5db); }
  .ct-seg-on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .ct-stage { flex: 1 1 auto; min-height: 0; padding: 0 8px 8px; }
  .ct-ev { display: flex; align-items: center; gap: 6px; min-width: 0; line-height: 1.2; }
  .ct-ev-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
  .ct-ev-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ct-ev-status { margin-left: auto; font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; flex: none; }
  /* Board card */
  .ct-card { display: flex; flex-direction: column; gap: 8px; }
  .ct-card-head { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .ct-card-dot { width: 9px; height: 9px; border-radius: 3px; flex: none; }
  .ct-card-title { font-weight: 600; font-size: 0.84rem; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ct-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ct-card-owner { display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; color: var(--sg-muted, #6b7280); }
  .ct-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ct-card-reach { font-size: 0.72rem; font-weight: 600; color: var(--sg-muted, #6b7280); }

  /* Mobile: this is an app-shell console - a fixed 230px nav rail beside the
     scheduler - and the root hides its overflow, so on a phone the right-hand
     side was silently cut off. Floor it and let the whole console pan inside
     the demo stage (see .demo-stage.is-wide in examples/src/mobile.css), which
     keeps the rail and the timeline aligned. */
  @media (max-width: 767px) {
    .ct {
      min-width: 900px;
    }
  }
  /* Phone: the shell hides overflow for its rounded corners, which makes its automatic
     minimum height 0 - so as a flex item of the demo stage it shrank to the (short)
     phone stage and clipped its lower panes. Keep the content height; the stage
     scrolls vertically and pans sideways. */
  @media (max-width: 767px) {
    .ct { flex-shrink: 0; }
  }
</style>
