<script lang="ts">
  /**
   * 385. Broadcast - a content & marketing editorial calendar (real app)
   * -------------------------------------------------------------------
   * A content team's console, not a feature demo:
   *  - a live sidebar: search, a channel roster (colour dot + this month's post
   *    count) you can show/hide to filter the calendar, an owner mini-roster, a
   *    "published this month" gauge, and a status legend,
   *  - a KPI strip (scheduled / published / drafts / ideas this month),
   *  - a Month/Week/Agenda calendar of all-day posts and multi-day campaigns,
   *    colour-coded by channel - drag a draft idea from the backlog onto a date
   *    to schedule it, drag a bar to re-time it,
   *  - a channel-coded post card + a companion "content pipeline" table - the
   *    same rows as a grid.
   */
  import {
    SvGrid,
    SvAvatar,
    SvBadge,
    SvButton,
    SvStat,
    SvGauge,
    SvTextInput,
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

  type Channel = 'blog' | 'email' | 'social' | 'video'
  type Status = 'Idea' | 'Draft' | 'Scheduled' | 'Published'
  type Post = {
    id: number; title: string; channel: Channel; status: Status; owner: string
    campaign: string; start: string; end: string; allDay: boolean; color: string
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
    Scheduled: { color: '#6366f1', variant: 'info' },
    Published: { color: '#16a34a', variant: 'success' },
  }

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
  const mk = (p: Omit<Post, 'allDay' | 'color'>): Post => ({ ...p, allDay: true, color: CH[p.channel].color })

  // ~18 posts + multi-day campaigns spread across the whole current month, so
  // the Month grid is full and the Agenda list always has rows.
  let all = $state<Post[]>([
    mk({ id: 1, title: 'Launch week campaign', channel: 'social', status: 'Scheduled', owner: 'Mia', campaign: 'Q3 Launch', start: dm(6), end: dm(11) }),
    mk({ id: 2, title: 'Feature deep-dive', channel: 'blog', status: 'Draft', owner: 'Tom', campaign: 'Q3 Launch', start: dm(3), end: dm(4) }),
    mk({ id: 3, title: 'Monthly newsletter', channel: 'email', status: 'Published', owner: 'Ana', campaign: 'Always-on', start: dm(1), end: dm(2) }),
    mk({ id: 4, title: 'Product demo reel', channel: 'video', status: 'Idea', owner: 'Leo', campaign: 'Q3 Launch', start: dm(9), end: dm(10) }),
    mk({ id: 5, title: 'Customer story: Northwind', channel: 'blog', status: 'Published', owner: 'Tom', campaign: 'Proof', start: dm(13), end: dm(14) }),
    mk({ id: 6, title: 'Webinar promo', channel: 'email', status: 'Draft', owner: 'Ana', campaign: 'Webinar', start: dm(16), end: dm(20) }),
    mk({ id: 7, title: 'Behind the scenes', channel: 'social', status: 'Idea', owner: 'Mia', campaign: 'Always-on', start: dm(21), end: dm(22) }),
    mk({ id: 8, title: 'Q&A livestream', channel: 'video', status: 'Published', owner: 'Leo', campaign: 'Webinar', start: dm(24), end: dm(25) }),
    mk({ id: 9, title: 'Welcome series drip', channel: 'email', status: 'Published', owner: 'Ana', campaign: 'Onboarding', start: dm(0), end: dm(0) }),
    mk({ id: 10, title: 'Product roundup', channel: 'blog', status: 'Published', owner: 'Tom', campaign: 'Always-on', start: dm(2), end: dm(2) }),
    mk({ id: 11, title: 'Poll: feature vote', channel: 'social', status: 'Published', owner: 'Mia', campaign: 'Community', start: dm(5), end: dm(5) }),
    mk({ id: 12, title: 'Tutorial: quick start', channel: 'video', status: 'Scheduled', owner: 'Leo', campaign: 'Onboarding', start: dm(12), end: dm(13) }),
    mk({ id: 13, title: 'Pricing update post', channel: 'blog', status: 'Published', owner: 'Tom', campaign: 'Always-on', start: dm(18), end: dm(18) }),
    mk({ id: 14, title: 'Community spotlight', channel: 'social', status: 'Scheduled', owner: 'Mia', campaign: 'Community', start: dm(26), end: dm(27) }),
    mk({ id: 15, title: 'Roadmap AMA', channel: 'video', status: 'Idea', owner: 'Leo', campaign: 'Community', start: dm(28), end: dm(29) }),
    mk({ id: 16, title: 'Month-in-review email', channel: 'email', status: 'Draft', owner: 'Ana', campaign: 'Always-on', start: dm(29), end: dm(30) }),
    mk({ id: 17, title: 'Changelog digest', channel: 'email', status: 'Published', owner: 'Ana', campaign: 'Always-on', start: dm(23), end: dm(23) }),
    mk({ id: 18, title: 'Founder interview', channel: 'blog', status: 'Scheduled', owner: 'Tom', campaign: 'Proof', start: dm(15), end: dm(16) }),
  ])

  let backlog = $state<Draft[]>([
    { id: 'd1', title: 'Case study: Contoso', durationMin: DAY, color: CH.blog.color },
    { id: 'd2', title: 'Tips thread', durationMin: DAY, color: CH.social.color },
    { id: 'd3', title: 'Release notes email', durationMin: DAY, color: CH.email.color },
    { id: 'd4', title: 'Demo video teaser', durationMin: DAY, color: CH.video.color },
  ])

  // --- Interactive filters ---------------------------------------------------
  let query = $state('')
  let visible = $state<Record<Channel, boolean>>({ blog: true, email: true, social: true, video: true })
  const shownChannels = $derived(channels.filter((c) => visible[c]))
  const q = $derived(query.trim().toLowerCase())
  const rows = $derived(
    all.filter((p) => visible[p.channel] && (q === '' || p.title.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q))),
  )

  // --- Counts + KPIs (everything is seeded within the current month) ----------
  const channelCount = (c: Channel) => all.filter((p) => p.channel === c).length
  const ownerCount = (name: string) => all.filter((p) => p.owner === name).length
  const statusCount = (s: Status) => all.filter((p) => p.status === s).length
  const scheduled = $derived(statusCount('Scheduled'))
  const published = $derived(statusCount('Published'))
  const drafts = $derived(statusCount('Draft'))
  const ideas = $derived(statusCount('Idea'))
  const publishedPct = $derived(all.length ? Math.round((published / all.length) * 100) : 0)

  const columns: ColumnDef<any, Post>[] = [
    { field: 'title', header: 'Content', editorType: 'text', width: 200 },
    { field: 'channel', header: 'Channel', editorType: 'list', editorOptions: channels.map((c) => ({ value: c, label: CH[c].label, color: CH[c].color })), width: 110 },
    { field: 'status', header: 'Status', editorType: 'list', editorOptions: (Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: s, color: STATUS[s].color })), width: 120 },
    { field: 'owner', header: 'Owner', editorType: 'text', width: 100 },
    { field: 'campaign', header: 'Campaign', editorType: 'text', width: 130 },
    { field: 'start', header: 'Publish', editorType: 'date', width: 130 },
    { field: 'end', header: 'Ends', editorType: 'date', width: 130 },
  ]

  function guessChannel(title: string): Channel {
    const t = title.toLowerCase()
    return t.includes('email') || t.includes('notes') ? 'email' : t.includes('thread') || t.includes('social') ? 'social' : t.includes('video') || t.includes('reel') || t.includes('demo') ? 'video' : 'blog'
  }
  function onSchedule(item: Draft, start: Date) {
    const channel = guessChannel(item.title)
    all = [...all, mk({ id: ++seq, title: item.title, channel, status: 'Draft', owner: 'TBD', campaign: 'Backlog', start: isoDay(start), end: isoDay(start) })]
    backlog = backlog.filter((d) => d.id !== item.id)
  }
  function newDraft() {
    const channel = shownChannels[0] ?? 'blog'
    all = [...all, mk({ id: ++seq, title: 'New draft', channel, status: 'Draft', owner: 'TBD', campaign: 'Backlog', start: dm(0), end: dm(0) })]
  }
  function onEventMove(e: SchedulerEventMoveEvent<Post>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end) }
  function onEventResize(e: SchedulerEventResizeEvent<Post>) { e.row.start = isoDay(e.start); e.row.end = isoDay(e.end) }
  function onEventCommit(e: SchedulerEventCommitEvent<Post>) { Object.assign(e.row, e.values); e.row.color = CH[e.row.channel]?.color ?? e.row.color }
  function onEventDelete(row: Post) { all = all.filter((r) => r !== row) }
</script>

{#snippet postBody(row: Post)}
  <span class="ct-ev">
    <span class="ct-ev-dot" style:background={CH[row.channel].color}></span>
    <span class="ct-ev-title">{row.title}</span>
    <span class="ct-ev-status" style:color={STATUS[row.status].color}>{row.status}</span>
  </span>
{/snippet}

<section class="ct">
  <aside class="ct-nav">
    <header class="ct-brand"><span class="ct-brand-mark">📣</span><span><span class="ct-brand-name">Broadcast</span><span class="ct-brand-sub">Editorial calendar</span></span></header>

    <div class="ct-search">
      <SvTextInput bind:value={query} placeholder="Search title / owner" clearable />
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

      <div class="ct-sec-head ct-sec-head-owners">Owners</div>
      {#each owners as o (o.name)}
        <div class="ct-owner">
          <SvAvatar name={o.name} color={o.color} size="sm" />
          <span class="ct-owner-name">{o.name}</span>
          <SvBadge variant="neutral" size="sm">{ownerCount(o.name)}</SvBadge>
        </div>
      {/each}
    </div>

    <div class="ct-gaugewrap">
      <SvGauge value={publishedPct} min={0} max={100} unit="%" label="Published this month" size={130} thickness={12}
        bands={[{ from: 0, to: 40, color: '#dc2626' }, { from: 40, to: 70, color: '#d97706' }, { from: 70, to: 100, color: '#16a34a' }]} />
    </div>

    <div class="ct-legend">
      <div class="ct-sec-head">Status</div>
      {#each Object.entries(STATUS) as [s, v] (s)}
        <div class="ct-legend-row"><span class="ct-legdot" style:background={v.color}></span>{s}</div>
      {/each}
    </div>
  </aside>

  <div class="ct-main">
    <div class="ct-kpis">
      <SvStat label="Scheduled" value={scheduled} hint="this month" />
      <SvStat label="Published" value={published} hint="live this month" trend={published > 0 ? 'up' : 'flat'} />
      <SvStat label="Drafts" value={drafts} hint="in progress" />
      <SvStat label="Ideas" value={ideas} hint="not started" />
    </div>

    <div class="ct-toolbar">
      <div class="ct-toolbar-l"><span class="ct-title">Editorial calendar</span><span class="ct-sub">Toggle channels, drag a draft idea onto a date to schedule it</span></div>
      <SvButton variant="primary" size="sm" onclick={newDraft}>+ New draft</SvButton>
    </div>

    <div class="ct-cal">
      <SvGrid
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
    </div>

    <details class="ct-table">
      <summary>Content pipeline ({all.length})</summary>
      <div class="ct-table-grid">
        <SvGrid data={all} columns={columns} getRowId={(r) => String(r.id)} containerHeight="260px" />
      </div>
    </details>
  </div>
</section>

<style>
  .ct { display: flex; flex: 1 1 auto; min-height: 0; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .ct-nav { flex: 0 0 250px; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--sg-border, #e5e7eb); background: color-mix(in srgb, var(--sg-fg, #1f2937) 3%, transparent); }
  .ct-brand { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid var(--sg-border, #e5e7eb); }
  .ct-brand-mark { font-size: 18px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); }
  .ct-brand-name { display: block; font-weight: 700; }
  .ct-brand-sub { display: block; font-size: 0.72rem; color: var(--sg-muted, #6b7280); }
  .ct-search { padding: 10px 12px 4px; }
  .ct-sec-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #9ca3af); padding: 8px 4px 6px; }
  .ct-sec-head-owners { margin-top: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .ct-sec-count { font-weight: 600; }
  .ct-roster { padding: 4px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 60px; }
  .ct-ch { display: flex; align-items: center; gap: 9px; padding: 6px 6px; border-radius: 8px; cursor: pointer; }
  .ct-ch:hover { background: color-mix(in srgb, var(--sg-fg, #1f2937) 6%, transparent); }
  .ct-ch-off { opacity: 0.5; }
  .ct-ch-label { flex: 1 1 auto; font-size: 0.85rem; font-weight: 600; }
  .ct-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .ct-owner { display: flex; align-items: center; gap: 9px; padding: 5px 6px; border-radius: 8px; }
  .ct-owner-name { flex: 1 1 auto; font-size: 0.85rem; font-weight: 600; }
  .ct-gaugewrap { display: grid; place-items: center; padding: 6px 12px 12px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .ct-legend { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .ct-legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
  .ct-legdot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .ct-main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .ct-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 14px 4px; }
  .ct-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; }
  .ct-toolbar-l { display: flex; flex-direction: column; }
  .ct-title { font-weight: 600; }
  .ct-sub { font-size: 0.76rem; color: var(--sg-muted, #6b7280); }
  .ct-cal { flex: 1 1 auto; min-height: 0; padding: 0 8px; }
  .ct-table { padding: 8px 14px 14px; }
  .ct-table summary { cursor: pointer; font-size: 0.82rem; font-weight: 600; color: var(--sg-muted, #4b5563); padding: 4px 0; }
  .ct-table-grid { margin-top: 8px; }
  .ct-ev { display: flex; align-items: center; gap: 6px; min-width: 0; line-height: 1.2; }
  .ct-ev-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
  .ct-ev-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ct-ev-status { margin-left: auto; font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; flex: none; }
</style>
