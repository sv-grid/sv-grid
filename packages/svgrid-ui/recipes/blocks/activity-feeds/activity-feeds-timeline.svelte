<script lang="ts" module>
  /**
   * Activity timeline block - a project's recent activity grouped by day. Each
   * day is an SvTimeline whose marker colour and glyph name the event type
   * (commit, comment, deploy, status change); the `item` snippet renders the
   * actor, what they did and a relative time. SvButton "Load more" appends
   * older events with a loading state, SvBadge counts the events shown.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createActivityTimeline() below owns the events, the day grouping,
   * relative times and the Load more flow with no markup. The component under
   * it is one styled render of that core; import createActivityTimeline from
   * this file (or `npx @svgrid/ui add activity-feeds-timeline --headless` for
   * the core alone) to draw your own.
   */
  import type { TimelineItem } from '@svgrid/grid'

  export type ActivityKind = 'commit' | 'comment' | 'deploy' | 'status'
  export type Activity = { id: number; kind: ActivityKind; actor: string; verb: string; target: string; detail?: string; at: number }
  export type OlderPage = { events: Activity[]; done: boolean }
  export type ActivityTimelineOptions = {
    /** One clock for the whole feed: every relative time is measured from here. */
    now?: number
    events?: Activity[]
    /**
     * Fetch the page before `before` (the oldest `at` shown); `page` counts
     * from 0. Return `done: true` with the last page. Defaults to the sample's
     * older pages.
     */
    loadOlder?: (before: number, page: number) => Promise<OlderPage> | OlderPage
    /** Called once the last page has been appended. */
    onEnd?: () => void
  }

  export const ACTIVITY_KINDS: Record<ActivityKind, { label: string; glyph: string; color: string }> = {
    commit: { label: 'Commit', glyph: '↑', color: 'var(--sg-info, #0284c7)' },
    comment: { label: 'Comment', glyph: '…', color: 'color-mix(in srgb, var(--sg-fg, #0f172a) 55%, var(--sg-bg, #fff))' },
    deploy: { label: 'Deploy', glyph: '▲', color: 'var(--sg-success, #16a34a)' },
    status: { label: 'Status', glyph: '⇄', color: 'var(--sg-warning, #d97706)' },
  }

  // Sample timestamps: `ago` is minutes before now, `on` is a clock time a
  // number of days back.
  function clock(now: number) {
    const ago = (minutes: number) => now - minutes * 60_000
    const on = (daysBack: number, hh: number, mm: number) => {
      const d = new Date(now)
      d.setDate(d.getDate() - daysBack)
      return d.setHours(hh, mm, 0, 0)
    }
    return { ago, on }
  }

  function sampleEvents(now: number): Activity[] {
    const { ago, on } = clock(now)
    return [
      { id: 1, kind: 'deploy', actor: 'Priya Natarajan', verb: 'deployed', target: 'v2.14.0 to production', detail: 'Build 4812, 3 migrations applied', at: ago(14) },
      { id: 2, kind: 'comment', actor: 'Tom Okafor', verb: 'commented on', target: 'LUM-311 Retry failed webhooks', detail: 'The backoff caps at 10 minutes now. Can we log the final attempt?', at: ago(52) },
      { id: 3, kind: 'commit', actor: 'Priya Natarajan', verb: 'pushed 3 commits to', target: 'main', detail: 'fix(webhooks): cap retry backoff at 10 min', at: ago(95) },
      { id: 4, kind: 'status', actor: 'Ines Duarte', verb: 'moved', target: 'LUM-298 Billing export', detail: 'In review -> Done', at: ago(190) },
      { id: 5, kind: 'commit', actor: 'Tom Okafor', verb: 'pushed 1 commit to', target: 'feat/sso-groups', detail: 'Map IdP groups to workspace roles', at: on(1, 16, 40) },
      { id: 6, kind: 'deploy', actor: 'Ines Duarte', verb: 'deployed', target: 'v2.13.2 to staging', at: on(1, 11, 5) },
    ]
  }

  /** The sample's older pages, the ones a real app would fetch with a cursor. */
  export function sampleOlderActivity(now: number): Activity[][] {
    const { on } = clock(now)
    return [
      [
        { id: 7, kind: 'status', actor: 'Priya Natarajan', verb: 'moved', target: 'LUM-305 Usage alerts', detail: 'To do -> In progress', at: on(2, 17, 20) },
        { id: 8, kind: 'comment', actor: 'Ines Duarte', verb: 'commented on', target: 'LUM-298 Billing export', detail: 'CSV opens fine in Excel with the BOM added.', at: on(2, 14, 2) },
        { id: 9, kind: 'commit', actor: 'Ines Duarte', verb: 'pushed 2 commits to', target: 'main', detail: 'chore: bump csv writer to 4.2', at: on(2, 9, 48) },
      ],
      [
        { id: 10, kind: 'deploy', actor: 'Tom Okafor', verb: 'deployed', target: 'v2.13.1 to production', at: on(4, 15, 30) },
        { id: 11, kind: 'status', actor: 'Tom Okafor', verb: 'reopened', target: 'LUM-287 Timezone in digests', detail: 'Done -> In progress', at: on(4, 10, 12) },
      ],
    ]
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const dayFmt = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' })
  const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0)

  export function createActivityTimeline(opts: ActivityTimelineOptions = {}) {
    const now = opts.now ?? Date.now()
    const older = opts.loadOlder ? null : sampleOlderActivity(now)
    const loadOlder = opts.loadOlder ?? ((_before: number, page: number): OlderPage =>
      ({ events: older![page] ?? [], done: page + 1 >= older!.length }))

    let events = $state<Activity[]>(opts.events ?? sampleEvents(now))
    let page = $state(0)
    let hasMore = $state(true)
    let loading = $state(false)

    function relative(at: number) {
      const s = Math.round(Math.min(0, at - now) / 1000)
      if (s > -60) return rtf.format(s, 'second')
      if (s > -3600) return rtf.format(Math.round(s / 60), 'minute')
      if (s > -86400) return rtf.format(Math.round(s / 3600), 'hour')
      return rtf.format(Math.round(s / 86400), 'day')
    }
    function dayLabel(t: number) {
      const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000)
      return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : dayFmt.format(t)
    }

    const byId = $derived(new Map(events.map((e) => [e.id, e])))
    // Newest first, one group per calendar day, each item shaped for SvTimeline.
    const days = $derived.by(() => {
      const out: { key: number; label: string; items: TimelineItem[] }[] = []
      for (const e of [...events].sort((a, b) => b.at - a.at)) {
        const key = startOfDay(e.at)
        let day = out.find((d) => d.key === key)
        if (!day) out.push((day = { key, label: dayLabel(e.at), items: [] }))
        const k = ACTIVITY_KINDS[e.kind]
        day.items.push({ id: e.id, title: e.verb, time: relative(e.at), color: k.color, icon: k.glyph })
      }
      return out
    })

    async function loadMore() {
      if (loading || !hasMore) return
      loading = true
      try {
        const oldest = events.reduce((min, e) => Math.min(min, e.at), Infinity)
        const res = await loadOlder(oldest, page)
        events = [...events, ...res.events]
        page += 1
        if (res.done) { hasMore = false; opts.onEnd?.() }
      } finally {
        loading = false
      }
    }

    return {
      kinds: ACTIVITY_KINDS,
      get events() { return events },
      set events(v: Activity[]) { events = v },
      /** Day groups, newest first, with SvTimeline-ready items. */
      get days() { return days },
      get loading() { return loading },
      get hasMore() { return hasMore },
      /** The event behind a timeline item id. */
      eventOf: (id: string | number | undefined) => byId.get(Number(id)),
      relative,
      dayLabel,
      loadMore,
      /** Spread on the Load more <button>. */
      loadMoreProps: () => ({
        type: 'button' as const,
        disabled: loading,
        'aria-busy': loading,
        onclick: () => { void loadMore() },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvTimeline, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const now = Date.now()
  const older = sampleOlderActivity(now)
  const feed = createActivityTimeline({
    now,
    // Stand-in for fetch(`/api/activity?before=${before}`).
    loadOlder: (_before, page) =>
      new Promise((res) => setTimeout(() => res({ events: older[page] ?? [], done: page + 1 >= older.length }), 800)),
    onEnd: () => toast('That is the start of the project history'),
  })
</script>

<section class="sv-feed" aria-labelledby="sv-feed-title">
  <header class="sv-feed-head">
    <div>
      <h2 id="sv-feed-title">Activity</h2>
      <p class="sv-feed-muted">Lumen web app, all branches and issues</p>
    </div>
    <SvBadge variant="neutral">{feed.events.length} events</SvBadge>
  </header>

  <ul class="sv-feed-legend" aria-label="Event types">
    {#each Object.values(feed.kinds) as k (k.label)}
      <li><span class="sv-feed-swatch" style:background={k.color} aria-hidden="true"></span>{k.label}</li>
    {/each}
  </ul>

  {#each feed.days as day (day.key)}
    <div class="sv-feed-day">
      <h3>{day.label}</h3>
      <SvTimeline items={day.items}>
        {#snippet item(it)}
          {@const e = feed.eventOf(it.id)}
          {#if e}
            <div class="sv-feed-row">
              <p class="sv-feed-what"><strong>{e.actor}</strong> {e.verb} <span class="sv-feed-target">{e.target}</span></p>
              <time datetime={new Date(e.at).toISOString()} title={new Date(e.at).toLocaleString()}>{it.time}</time>
            </div>
            {#if e.detail}<p class="sv-feed-detail" class:sv-feed-quote={e.kind === 'comment'}>{e.detail}</p>{/if}
          {/if}
        {/snippet}
      </SvTimeline>
    </div>
  {/each}

  <div class="sv-feed-more">
    {#if feed.hasMore}
      <SvButton variant="outline" loading={feed.loading} onclick={feed.loadMore}>{feed.loading ? 'Loading older events' : 'Load more'}</SvButton>
    {:else}
      <p class="sv-feed-muted">No older activity</p>
    {/if}
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-feed {
    width: 100%; box-sizing: border-box; max-width: 720px; margin: 0 auto; padding: 28px 28px 32px;
    display: flex; flex-direction: column; gap: 18px; min-height: 560px;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); font-family: var(--sg-font, inherit);
  }
  .sv-feed-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .sv-feed-head h2 { margin: 0 0 4px; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-feed-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-feed-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-feed-legend li { display: inline-flex; align-items: center; gap: 6px; }
  .sv-feed-swatch { width: 8px; height: 8px; border-radius: 50%; }
  .sv-feed-day h3 {
    margin: 0 0 12px; padding-bottom: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
    color: var(--sg-muted, #64748b); border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  /* Bigger markers so the type glyph reads at a glance. */
  .sv-feed-day :global(.sv-timeline__marker) { width: 20px; height: 20px; margin-top: 0; font-size: 12px; font-weight: 700; }
  .sv-feed-row { display: flex; align-items: baseline; gap: 12px; }
  .sv-feed-what { margin: 0; font-size: 13.5px; line-height: 1.45; min-width: 0; overflow-wrap: anywhere; }
  .sv-feed-what strong { font-weight: 600; }
  .sv-feed-target { font-weight: 500; color: var(--sg-fg, #0f172a); }
  time { margin-left: auto; flex: none; font-size: 12px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-feed-detail { margin: 3px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--sg-muted, #64748b); overflow-wrap: anywhere; }
  .sv-feed-detail.sv-feed-quote { padding: 6px 10px; border-radius: var(--sg-radius, 6px); background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff)); }
  .sv-feed-more { display: flex; justify-content: center; padding-top: 4px; }

  @media (max-width: 560px) {
    .sv-feed { padding: 20px 16px 24px; }
    .sv-feed-head { flex-wrap: wrap; }
    .sv-feed-row { flex-direction: column; gap: 2px; flex-wrap: wrap; }
    time { margin-left: 0; }
  }
</style>
