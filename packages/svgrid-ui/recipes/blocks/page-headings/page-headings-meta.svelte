<script lang="ts" module>
  /**
   * Page heading with meta block - the header of a record page, here a job
   * posting: h1 with a status SvBadge, a wrapping row of meta items with
   * inline-SVG icons (location, salary, closing date, hiring manager), and
   * actions: "Edit", a "Status" SvMenu that moves the posting between Open,
   * Paused and Closed (the badge follows), and a primary "View applicants"
   * SvButton. SvToaster confirms each change. Pure UI-kit, --sg-* themed.
   *
   * Headless: createPostingHeading() below owns the posting status, the
   * status menu items and the meta list with no markup. The component under
   * it is one styled render of that core; import createPostingHeading from
   * this file (or `npx @svgrid/ui add page-headings-meta --headless` for the
   * core alone) to draw your own.
   */
  import type { MenuItem } from '@svgrid/grid'

  const STATUSES = ['Open', 'Paused', 'Closed'] as const
  export type PostingStatus = (typeof STATUSES)[number]
  /** `icon` is an SVG path for a 24x24 viewBox. */
  export type PostingMeta = { icon: string; text: string }
  export type PostingHeadingOptions = {
    /** Starting status; defaults to Open. */
    status?: PostingStatus
    meta?: PostingMeta[]
    /** Called after the status changed. */
    onStatusChange?: (next: PostingStatus, prev: PostingStatus) => void
  }

  const STATUS_LABEL: Record<PostingStatus, string> = {
    Open: 'Open: accepting applicants',
    Paused: 'Paused: hidden from the board',
    Closed: 'Closed: archive posting',
  }
  const SAMPLE_META: PostingMeta[] = [
    { icon: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', text: 'Remote, EU time zones' },
    { icon: 'M3 7h18v10H3z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M6 10v4 M18 10v4', text: 'EUR 90k - 115k' },
    { icon: 'M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4', text: 'Closes Nov 14, 2026' },
    { icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0', text: 'Hiring manager: Grace Okafor' },
  ]

  export function createPostingHeading(opts: PostingHeadingOptions = {}) {
    // One status at a time; the menu disables the current one.
    let status = $state<PostingStatus>(opts.status ?? 'Open')

    function setStatus(next: PostingStatus) {
      if (next === status) return
      const prev = status
      status = next
      opts.onStatusChange?.(next, prev)
    }

    const statusItems = $derived<MenuItem[]>(
      STATUSES.map((s) => ({ label: STATUS_LABEL[s], disabled: s === status, onSelect: () => setStatus(s) })),
    )

    return {
      meta: opts.meta ?? SAMPLE_META,
      statuses: STATUSES,
      get status() { return status },
      set status(v: PostingStatus) { setStatus(v) },
      /** Items for a status menu: one per status, the current one disabled. */
      get statusItems() { return statusItems },
      /** A closed posting takes no more applicants. */
      get accepting() { return status !== 'Closed' },
      setStatus,
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvButton, SvMenu, SvToaster, toast } from '@svgrid/grid'

  const tone = { Open: 'success', Paused: 'warning', Closed: 'neutral' } as const

  const posting = createPostingHeading({
    onStatusChange: (next) => toast.success(next === 'Open' ? 'Posting reopened' : `Posting ${next.toLowerCase()}`),
  })
</script>

<div class="sv-ph-meta">
  <header class="sv-ph-meta-head">
    <div class="sv-ph-meta-titles">
      <div class="sv-ph-meta-title-row">
        <h1>Senior Data Engineer</h1>
        <SvBadge variant={tone[posting.status]} dot>{posting.status}</SvBadge>
      </div>
      <ul class="sv-ph-meta-items">
        {#each posting.meta as m (m.text)}
          <li>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={m.icon} /></svg>
            {m.text}
          </li>
        {/each}
      </ul>
    </div>
    <div class="sv-ph-meta-actions">
      <SvButton variant="ghost" onclick={() => toast('Opening the posting editor')}>Edit</SvButton>
      <SvMenu items={posting.statusItems} ariaLabel="Change status">
        {#snippet anchor()}
          <SvButton variant="secondary">
            <span class="sv-ph-meta-caret">
              Status
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </SvButton>
        {/snippet}
      </SvMenu>
      <SvButton variant="primary" disabled={!posting.accepting} onclick={() => toast('Opening 38 applicants')}>View applicants (38)</SvButton>
    </div>
  </header>

  <section class="sv-ph-meta-body" aria-label="Job description">
    <h2>About the role</h2>
    <p>You will own the ingestion pipelines behind Fieldline's route planner: about 40 Postgres and Kafka sources, 2 TB a day, dbt models on top.</p>
    <div class="sv-ph-meta-skel" aria-hidden="true"><span></span><span></span><span class="sv-ph-meta-short"></span></div>
  </section>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-ph-meta {
    min-height: 360px; padding: 28px 32px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 14px);
  }
  .sv-ph-meta-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap;
    padding-bottom: 20px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-ph-meta-titles { min-width: 0; flex: 1 1 420px; }
  .sv-ph-meta-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  h1 { margin: 0; font-weight: 700; font-size: 26px; line-height: 1.2; letter-spacing: -.02em; }
  .sv-ph-meta-items { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 22px; }
  .sv-ph-meta-items li { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .sv-ph-meta-items svg { flex: none; }
  .sv-ph-meta-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sv-ph-meta-caret { display: inline-flex; align-items: center; gap: 4px; }

  .sv-ph-meta-body { padding-top: 20px; max-width: 640px; }
  h2 { margin: 0 0 8px; font-size: 15px; font-weight: 650; }
  .sv-ph-meta-body p { margin: 0 0 16px; font-size: 14px; line-height: 1.6; }
  .sv-ph-meta-skel { display: flex; flex-direction: column; gap: 8px; }
  .sv-ph-meta-skel span { height: 10px; border-radius: 5px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 9%, transparent); }
  .sv-ph-meta-skel .sv-ph-meta-short { width: 55%; }

  @media (max-width: 640px) {
    .sv-ph-meta { padding: 20px 16px; }
    .sv-ph-meta-titles { flex-basis: 100%; }
    h1 { font-size: 22px; }
    .sv-ph-meta-items { flex-direction: column; gap: 6px; }
    .sv-ph-meta-actions { width: 100%; }
    .sv-ph-meta-actions > :global(.sv-btn--primary) { flex: 1 1 100%; order: -1; }
  }
</style>
