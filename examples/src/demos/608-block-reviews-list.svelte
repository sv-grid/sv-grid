<script lang="ts" module>
  /**
   * Review list block - the review feed of a product page. Each review has an
   * SvAvatar, the reviewer's name, a Verified purchase SvBadge, a read-only
   * SvRating, the date, a title and a body that clamps to three lines with
   * Read more. Helpful votes count once per review. An SvDropDownList sorts by
   * most helpful, newest, highest or lowest, and an SvButton loads the next
   * page. Pure UI-kit, --sg-* themed.
   *
   * Headless: createReviewList() below owns sorting, paging, the once-per-review
   * helpful vote and the Read more state with no markup. The component under it
   * is one styled render of that core; import createReviewList from this file
   * (or `npx @svgrid/ui add reviews-list --headless` for the core alone) to
   * draw your own.
   */
  export type ListReview = {
    id: number; name: string; verified: boolean; rating: number
    /** ISO date, YYYY-MM-DD. */
    date: string; title: string; body: string; helpful: number
  }
  export type ReviewSort = 'helpful' | 'newest' | 'highest' | 'lowest'
  export type ReviewListOptions = {
    reviews?: ListReview[]
    pageSize?: number
    /** Bodies longer than this get the clamp and a Read more toggle. */
    clampAt?: number
    /** Persist a vote; throw to roll the count back. */
    onVote?: (review: ListReview) => Promise<void> | void
    /** Fetch the next page; return reviews to append (or nothing to reveal local ones). */
    onLoadMore?: () => Promise<ListReview[] | void> | ListReview[] | void
  }

  export const REVIEW_SORTS: { value: ReviewSort; label: string }[] = [
    { value: 'helpful', label: 'Most helpful' },
    { value: 'newest', label: 'Newest' },
    { value: 'highest', label: 'Highest rating' },
    { value: 'lowest', label: 'Lowest rating' },
  ]

  const SAMPLE: ListReview[] = [
    { id: 1, name: 'Priya Shah', verified: true, rating: 5, date: '2026-10-12', title: 'Fits a 16-inch laptop and a rain jacket', body: 'I ride 14 km each way and wanted one bag for the office and the weekend. The padded sleeve takes my 16-inch laptop with room to spare, the back panel stays dry in the rain, and the hip belt takes the weight off my shoulders on the climbs. After a month the roll-top closure shows no wear and the reflective strip on the base is easy to spot at dusk. Only wish: a key clip inside the top pocket.', helpful: 42 },
    { id: 2, name: 'Marcus Osei', verified: true, rating: 4, date: '2026-10-09', title: 'Great pack, tight side pockets', body: 'A 1 L bottle only fits when the main compartment is half empty. Everything else is spot on.', helpful: 18 },
    { id: 3, name: 'Hanna Koch', verified: false, rating: 5, date: '2026-10-04', title: 'Third one I have bought', body: 'The zips on my old one still run smooth after two years of daily use. Bought this one for my partner.', helpful: 9 },
    { id: 4, name: 'Tom Becker', verified: true, rating: 3, date: '2026-09-28', title: 'Good, but runs small', body: 'The torso length is short for me at 190 cm, so the hip belt sits on my stomach instead of my hips. If you are tall, measure your back length and compare it with the size chart before ordering. Build quality is excellent and I would rate it higher in the L size, which was out of stock when I ordered.', helpful: 27 },
    { id: 5, name: 'Lena Vogel', verified: true, rating: 2, date: '2026-09-21', title: 'Buckle cracked in the cold', body: 'The sternum strap buckle snapped at minus 10. Support sent a replacement within three days, which is the only reason this is not one star.', helpful: 31 },
    { id: 6, name: 'Diego Ruiz', verified: true, rating: 5, date: '2026-09-17', title: 'Carry-on sized', body: 'Fits the cabin bag frame on two airlines. Packed five days of clothes in it.', helpful: 6 },
    { id: 7, name: 'Aiko Tanaka', verified: false, rating: 1, date: '2026-09-10', title: 'Seam opened on day one', body: 'Left shoulder strap seam was open out of the box. Returned it for a refund.', helpful: 4 },
    { id: 8, name: 'Sam Okafor', verified: true, rating: 4, date: '2026-09-02', title: 'Comfortable on long walks', body: 'Wore it for a 20 km hike with 7 kg inside. No hot spots on the shoulders.', helpful: 11 },
  ]

  export function createReviewList(opts: ReviewListOptions = {}) {
    const pageSize = opts.pageSize ?? 4
    const clampAt = opts.clampAt ?? 220
    let reviews = $state<ListReview[]>(opts.reviews ?? SAMPLE)
    let sort = $state<ReviewSort>('helpful')
    let visible = $state(pageSize)
    let loading = $state(false)
    let voted = $state<Record<number, boolean>>({})
    let expanded = $state<Record<number, boolean>>({})

    const sorted = $derived.by(() => {
      const list = [...reviews]
      if (sort === 'helpful') list.sort((a, b) => b.helpful - a.helpful)
      if (sort === 'newest') list.sort((a, b) => b.date.localeCompare(a.date))
      if (sort === 'highest') list.sort((a, b) => b.rating - a.rating || b.helpful - a.helpful)
      if (sort === 'lowest') list.sort((a, b) => a.rating - b.rating || b.helpful - a.helpful)
      return list
    })
    const page = $derived(sorted.slice(0, visible))

    function setSort(v: string | number) {
      const next = REVIEW_SORTS.find((s) => s.value === v)?.value
      if (next) { sort = next; visible = pageSize }
    }

    async function vote(r: ListReview) {
      if (voted[r.id]) return
      voted[r.id] = true
      r.helpful += 1
      try {
        await opts.onVote?.(r)
      } catch (err) {
        voted[r.id] = false
        r.helpful -= 1
        throw err
      }
    }

    async function loadMore() {
      if (loading) return
      loading = true
      try {
        const more = await opts.onLoadMore?.()
        if (more?.length) reviews = [...reviews, ...more]
        visible = Math.min(visible + pageSize, reviews.length)
      } finally {
        loading = false
      }
    }

    const isLong = (r: ListReview) => r.body.length > clampAt
    const bodyId = (r: ListReview) => `sv-review-list-body-${r.id}`

    return {
      get reviews() { return reviews },
      get sort() { return sort },
      set sort(v: ReviewSort) { setSort(v) },
      setSort,
      get page() { return page },
      get total() { return sorted.length },
      get hasMore() { return visible < sorted.length },
      get loading() { return loading },
      hasVoted: (r: ListReview) => !!voted[r.id],
      isLong,
      /** True while a long body should render clamped. */
      isClamped: (r: ListReview) => isLong(r) && !expanded[r.id],
      bodyId,
      vote,
      loadMore,
      /** Spread on the Read more <button>. */
      readMoreProps: (r: ListReview) => ({
        type: 'button' as const,
        'aria-expanded': !!expanded[r.id],
        'aria-controls': bodyId(r),
        onclick: () => (expanded[r.id] = !expanded[r.id]),
      }),
      /** Spread on the Helpful <button>; it locks after one vote. */
      helpfulProps: (r: ListReview, onError?: (err: unknown) => void) => ({
        type: 'button' as const,
        'aria-pressed': !!voted[r.id],
        disabled: !!voted[r.id],
        onclick: () => vote(r).catch((err) => onError?.(err)),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvAvatar, SvBadge, SvRating, SvDropDownList, SvButton, SvToaster, toast } from '@svgrid/grid'

  const list = createReviewList({
    // Replace with POST /api/reviews/:id/helpful; a throw rolls the vote back.
    onVote: () => { toast.success('Thanks, your vote was counted') },
    // Replace with a fetch of the next page; here the rest is already loaded.
    onLoadMore: () => new Promise<void>((res) => setTimeout(res, 700)),
  })

  const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`))
  const voteFailed = () => toast.error('Could not save your vote')
</script>

<section class="sv-review-list" aria-labelledby="sv-review-list-title">
  <header class="sv-review-list-top">
    <div>
      <h2 id="sv-review-list-title">Reviews</h2>
      <p class="sv-review-list-muted">Fieldline Trail Pack 28L - {list.reviews.length} reviews</p>
    </div>
    <div class="sv-review-list-sort">
      <SvDropDownList label="Sort by" options={REVIEW_SORTS} value={list.sort} onChange={list.setSort} block />
    </div>
  </header>

  <ul class="sv-review-list-items">
    {#each list.page as r (r.id)}
      <li class="sv-review-list-item">
        <div class="sv-review-list-who">
          <SvAvatar name={r.name} />
          <div class="sv-review-list-meta">
            <span class="sv-review-list-name">{r.name}</span>
            {#if r.verified}<SvBadge variant="success" size="sm">Verified purchase</SvBadge>{/if}
          </div>
          <time class="sv-review-list-date" datetime={r.date}>{formatDate(r.date)}</time>
        </div>

        <div class="sv-review-list-headline">
          <SvRating value={r.rating} readonly size="sm" ariaLabel={`Rated ${r.rating} out of 5`} />
          <h3>{r.title}</h3>
        </div>

        <p id={list.bodyId(r)} class="sv-review-list-body" class:sv-review-list-clamp={list.isClamped(r)}>{r.body}</p>
        {#if list.isLong(r)}
          <button class="sv-review-list-link" {...list.readMoreProps(r)}>{list.isClamped(r) ? 'Read more' : 'Show less'}</button>
        {/if}

        <div class="sv-review-list-foot">
          <button class="sv-review-list-helpful" {...list.helpfulProps(r, voteFailed)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11M3 10h4v11H3zM7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7" /></svg>
            Helpful ({r.helpful})
          </button>
          {#if list.hasVoted(r)}<span class="sv-review-list-muted">You found this helpful</span>{/if}
        </div>
      </li>
    {/each}
  </ul>

  <div class="sv-review-list-more">
    <span class="sv-review-list-muted">Showing {list.page.length} of {list.total}</span>
    {#if list.hasMore}
      <SvButton variant="outline" loading={list.loading} onclick={list.loadMore}>Load more reviews</SvButton>
    {/if}
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  /* Empty stars from the theme: the kit falls back to a light grey that glares on dark themes. */
  .sv-review-list :global(.sv-rating) { --_off: var(--sg-rating-empty, color-mix(in srgb, var(--sg-fg, #0f172a) 22%, var(--sg-bg, #fff))); }
  .sv-review-list {
    width: 100%; box-sizing: border-box; max-width: 820px; margin: 0 auto;
    padding: 32px; color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-review-list-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-review-list-top h2 { margin: 0 0 2px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  .sv-review-list-sort { width: 200px; }
  .sv-review-list-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }

  .sv-review-list-items { list-style: none; margin: 0; padding: 0; }
  .sv-review-list-item { padding: 20px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-review-list-who { display: flex; align-items: center; gap: 12px; }
  .sv-review-list-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
  .sv-review-list-name { font-weight: 650; font-size: 14px; }
  .sv-review-list-date { margin-left: auto; font-size: 12.5px; color: var(--sg-muted, #64748b); white-space: nowrap; }
  .sv-review-list-headline { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; margin: 12px 0 6px; }
  .sv-review-list-headline h3 { margin: 0; font-size: 15px; font-weight: 650; }
  .sv-review-list-body { margin: 0; font-size: 14px; line-height: 1.6; }
  .sv-review-list-clamp { display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .sv-review-list-link { margin-top: 4px; padding: 0; border: 0; background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .sv-review-list-link:hover { text-decoration: underline; }
  .sv-review-list-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }

  .sv-review-list-foot { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
  .sv-review-list-helpful {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; font-size: 12.5px; cursor: pointer;
  }
  .sv-review-list-helpful:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-review-list-helpful:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-review-list-helpful[aria-pressed='true'] { cursor: default; border-color: var(--sg-accent, #4f46e5); background: var(--sg-selection-bg, #e0e7ff); }
  .sv-review-list-helpful svg { display: block; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }

  .sv-review-list-more { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 20px; }

  @media (max-width: 600px) {
    .sv-review-list { padding: 20px 16px; }
    .sv-review-list-top { flex-direction: column; align-items: stretch; }
    .sv-review-list-sort { width: 100%; }
    .sv-review-list-who { flex-wrap: wrap; }
    .sv-review-list-date { margin: -6px 0 0; flex-basis: 100%; padding-left: 48px; box-sizing: border-box; }
  }
</style>
