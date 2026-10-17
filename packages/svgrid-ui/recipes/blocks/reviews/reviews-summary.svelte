<script lang="ts" module>
  /**
   * Rating summary block - the ratings header of a product page: the average
   * as a number and a read-only SvRating with half stars, the review count, a
   * 5-to-1 star distribution with bars, and an SvProgress for "would
   * recommend". Each star row is a toggle that filters the recent reviews
   * beside it (aria-pressed marks the active one), with an SvBadge chip and an
   * SvButton to clear the filter. Pure UI-kit, --sg-* themed.
   *
   * Headless: createReviewSummary() below owns the counts, average, filter and
   * the filtered list with no markup. The component under it is one styled
   * render of that core; import createReviewSummary from this file (or `npx
   * @svgrid/ui add reviews-summary --headless` for the core alone) to draw your own.
   */
  export type SummaryReview = { id: number; rating: number; title: string; body: string; author: string; date: string }
  export type ReviewSummaryOptions = {
    /** Reviews per star, usually a GROUP BY on rating. */
    counts?: Record<number, number>
    /** Latest reviews shown beside the distribution. */
    recent?: SummaryReview[]
    /** Share of reviewers who would recommend, 0-100. */
    recommendPct?: number
    onFilter?: (star: number | null) => void
  }

  const SAMPLE_RECENT: SummaryReview[] = [
    { id: 1, rating: 5, title: 'Fits a 16-inch laptop and a jacket', body: 'Used it for a week of commuting by bike. The back panel stays dry and the hip belt actually carries the weight.', author: 'Priya S.', date: 'Oct 12, 2026' },
    { id: 2, rating: 4, title: 'Great pack, side pockets are tight', body: 'A 1 L bottle only fits if the main compartment is half empty. Everything else is spot on.', author: 'Marcus O.', date: 'Oct 9, 2026' },
    { id: 3, rating: 5, title: 'Third one I have bought', body: 'Zips still run smooth after two years on the old one. Bought this for my partner.', author: 'Hanna K.', date: 'Oct 4, 2026' },
    { id: 4, rating: 3, title: 'Good, but runs small', body: 'The torso length is short for me at 190 cm. Check the size chart before ordering.', author: 'Tom B.', date: 'Sep 28, 2026' },
    { id: 5, rating: 2, title: 'Buckle cracked in the cold', body: 'Sternum strap buckle snapped at minus 10. Support sent a replacement within three days.', author: 'Lena V.', date: 'Sep 21, 2026' },
    { id: 6, rating: 1, title: 'Arrived with a torn seam', body: 'Left shoulder strap seam was open out of the box. Returned it for a refund.', author: 'Diego R.', date: 'Sep 15, 2026' },
  ]

  export function createReviewSummary(opts: ReviewSummaryOptions = {}) {
    const counts = opts.counts ?? { 5: 812, 4: 264, 3: 71, 2: 22, 1: 31 }
    const recent = opts.recent ?? SAMPLE_RECENT
    const total = [5, 4, 3, 2, 1].reduce((s, n) => s + (counts[n] ?? 0), 0)
    const average = total ? [5, 4, 3, 2, 1].reduce((s, n) => s + n * (counts[n] ?? 0), 0) / total : 0
    const rows = [5, 4, 3, 2, 1].map((star) => {
      const count = counts[star] ?? 0
      return { star, count, pct: total ? Math.round((count / total) * 100) : 0 }
    })

    let filter = $state<number | null>(null)
    const shown = $derived(filter == null ? recent : recent.filter((r) => r.rating === filter))

    function setFilter(star: number | null) {
      filter = star
      opts.onFilter?.(star)
    }
    const toggle = (star: number) => setFilter(filter === star ? null : star)

    return {
      total,
      average,
      /** Average rounded to the nearest half star, for a read-only rating. */
      stars: Math.round(average * 2) / 2,
      rows,
      recommendPct: opts.recommendPct ?? 91,
      get filter() { return filter },
      set filter(v: number | null) { setFilter(v) },
      get shown() { return shown },
      toggle,
      clear: () => setFilter(null),
      /** Spread on the <button> of one distribution row. */
      rowProps: (star: number) => ({
        type: 'button' as const,
        'aria-pressed': filter === star,
        'aria-label': `${star} star reviews: ${counts[star] ?? 0}, ${rows.find((r) => r.star === star)?.pct ?? 0}%`,
        onclick: () => toggle(star),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvRating, SvProgress, SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  const summary = createReviewSummary()
  const fmt = new Intl.NumberFormat('en-US')
</script>

<section class="sv-review-summary" aria-labelledby="sv-review-summary-title">
  <div class="sv-review-summary-overview">
    <h2 id="sv-review-summary-title">Customer reviews</h2>
    <div class="sv-review-summary-score">
      <span class="sv-review-summary-avg">{summary.average.toFixed(1)}</span>
      <div>
        <SvRating value={summary.stars} allowHalf readonly ariaLabel={`Average rating ${summary.average.toFixed(1)} out of 5`} />
        <p class="sv-review-summary-muted">Based on {fmt.format(summary.total)} reviews</p>
      </div>
    </div>

    <ul class="sv-review-summary-dist">
      {#each summary.rows as row (row.star)}
        <li>
          <button class="sv-review-summary-row" {...summary.rowProps(row.star)}>
            <span class="sv-review-summary-star">{row.star}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 21.7l1.2-6.6L2.5 9.5l6.6-.9z" /></svg>
            </span>
            <span class="sv-review-summary-track" aria-hidden="true"><span style:width={`${row.pct}%`}></span></span>
            <span class="sv-review-summary-count">{fmt.format(row.count)}</span>
          </button>
        </li>
      {/each}
    </ul>

    <div class="sv-review-summary-rec">
      <div class="sv-review-summary-rec-head"><span>Would recommend</span><strong>{summary.recommendPct}%</strong></div>
      <SvProgress value={summary.recommendPct} color="success" size="sm" ariaLabel="Customers who would recommend" />
    </div>

    <SvButton variant="outline" block onclick={() => toast('Opening the review form')}>Write a review</SvButton>
  </div>

  <div class="sv-review-summary-recent">
    <div class="sv-review-summary-recent-head">
      <h3>Recent reviews</h3>
      {#if summary.filter != null}
        <SvBadge variant="accent">{summary.filter} star{summary.filter === 1 ? '' : 's'}</SvBadge>
        <SvButton variant="ghost" size="sm" onclick={summary.clear}>Clear filter</SvButton>
      {/if}
    </div>

    {#each summary.shown as r (r.id)}
      <article class="sv-review-summary-item">
        <SvRating value={r.rating} readonly size="sm" ariaLabel={`Rated ${r.rating} out of 5`} />
        <h4>{r.title}</h4>
        <p>{r.body}</p>
        <span class="sv-review-summary-muted">{r.author} - {r.date}</span>
      </article>
    {:else}
      <p class="sv-review-summary-empty">No recent {summary.filter}-star reviews.</p>
    {/each}
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  /* Empty stars from the theme: the kit falls back to a light grey that glares on dark themes. */
  .sv-review-summary :global(.sv-rating) { --_off: var(--sg-rating-empty, color-mix(in srgb, var(--sg-fg, #0f172a) 22%, var(--sg-bg, #fff))); }
  .sv-review-summary {
    width: 100%; box-sizing: border-box;
    display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: 40px;
    padding: 32px; color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff);
    font-family: var(--sg-font, inherit);
  }
  .sv-review-summary h2 { margin: 0 0 14px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  .sv-review-summary-overview { display: flex; flex-direction: column; gap: 18px; }
  .sv-review-summary-score { display: flex; align-items: center; gap: 14px; margin-top: -6px; }
  .sv-review-summary-avg { font-size: 44px; font-weight: 700; line-height: 1; letter-spacing: -.02em; }
  .sv-review-summary-muted { margin: 4px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }

  .sv-review-summary-dist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .sv-review-summary-row {
    display: grid; grid-template-columns: 34px 1fr 44px; align-items: center; gap: 10px;
    width: 100%; padding: 6px 8px; border: 1px solid transparent; border-radius: var(--sg-radius, 8px);
    background: none; color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-align: left;
  }
  .sv-review-summary-row:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-review-summary-row:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 1px; }
  .sv-review-summary-row[aria-pressed='true'] { background: var(--sg-selection-bg, #e0e7ff); border-color: var(--sg-accent, #4f46e5); }
  .sv-review-summary-star { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
  .sv-review-summary-star svg { display: block; width: 13px; height: 13px; fill: var(--sg-rating-on, #f59e0b); }
  .sv-review-summary-track {
    height: 8px; border-radius: 999px; overflow: hidden;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 10%, var(--sg-bg, #fff));
  }
  .sv-review-summary-track span { display: block; height: 100%; border-radius: inherit; background: var(--sg-rating-on, #f59e0b); }
  .sv-review-summary-count { text-align: right; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }

  .sv-review-summary-rec { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
  .sv-review-summary-rec-head { display: flex; justify-content: space-between; color: var(--sg-muted, #64748b); }
  .sv-review-summary-rec-head strong { color: var(--sg-fg, #0f172a); }

  .sv-review-summary-recent { min-width: 0; }
  .sv-review-summary-recent-head { display: flex; align-items: center; gap: 10px; min-height: 32px; margin-bottom: 4px; }
  .sv-review-summary-recent-head h3 { margin: 0; margin-right: auto; font-size: 16px; font-weight: 650; }
  .sv-review-summary-item { padding: 14px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-review-summary-item:last-child { border-bottom: 0; }
  .sv-review-summary-item h4 { margin: 6px 0 4px; font-size: 14px; font-weight: 650; }
  .sv-review-summary-item p { margin: 0 0 6px; font-size: 13.5px; line-height: 1.55; }
  .sv-review-summary-item .sv-review-summary-muted { margin: 0; font-size: 12.5px; }
  .sv-review-summary-empty { margin: 24px 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }

  @media (max-width: 760px) {
    .sv-review-summary { grid-template-columns: 1fr; gap: 28px; padding: 20px 16px; }
  }
</style>
