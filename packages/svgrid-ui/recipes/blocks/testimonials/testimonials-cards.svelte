<script lang="ts" module>
  /**
   * Testimonial cards block - six customer quotes in a masonry-style column
   * layout (3 columns, 2 on tablets, 1 on phones). Each card has the quote, an
   * optional read-only SvRating, an SvAvatar with initials, the person's name
   * and role, and the company's wordmark as inline SVG. Long quotes open with
   * Read more. A header shows the average rating and an SvButton to the
   * customer stories. Pure UI-kit, --sg-* themed.
   *
   * Headless: createTestimonialCards() below owns the quotes, the excerpts,
   * the expanded state and the average rating with no markup. The component
   * under it is one styled render of that core; import createTestimonialCards
   * from this file (or `npx @svgrid/ui add testimonials-cards --headless` for
   * the core alone) to draw your own.
   */
  export type CompanyMark = 'ring' | 'peak' | 'hex' | 'bars' | 'leaf' | 'wave'
  export type Testimonial = {
    id: string; quote: string; name: string; role: string; company: string
    /** Which made-up glyph draws the company's wordmark. */
    mark: CompanyMark
    /** 1-5; leave it out for quotes without a star rating. */
    rating?: number
  }
  export type TestimonialCardsOptions = {
    /** Your quotes; the demo's sample set is the default. */
    items?: Testimonial[]
    /** Quotes longer than this many characters open with Read more. */
    excerptLength?: number
    /** The header button: link to your case studies page. */
    onStories?: () => void
  }

  const SAMPLE: Testimonial[] = [
    { id: 'northwind', name: 'Dana Whitfield', role: 'Dispatch lead', company: 'Northwind Freight', mark: 'peak', rating: 5,
      quote: 'We used to rebuild the dispatch board from three spreadsheets every morning. Now the order and warehouse syncs land in one table by 6:05, and the 7:00 standup starts from it. That is about 40 minutes back per coordinator, every day.' },
    { id: 'copperleaf', name: 'Rafael Ortiz', role: 'Controller', company: 'Copperleaf Foods', mark: 'leaf', rating: 5,
      quote: 'Month-end close went from six working days to three. The reconciliation view flags the orders that do not match the ledger, so we only look at those.' },
    { id: 'kestrel', name: 'Mei Tanaka', role: 'SRE manager', company: 'Kestrel Labs', mark: 'hex',
      quote: 'Our on-call handoff doc is gone. Alerts post the failing rows straight into the channel.' },
    { id: 'lumen', name: 'Amara Okafor', role: 'Head of operations', company: 'Lumen Health', mark: 'ring', rating: 5,
      quote: 'We onboarded 14 clinics in one quarter without hiring another analyst. Every clinic gets the same intake table, and the regional leads see all of them rolled up in one view.' },
    { id: 'tidewater', name: 'Jonas Lindqvist', role: 'Ops analyst', company: 'Tidewater Logistics', mark: 'wave', rating: 4,
      quote: 'Price got us to try it. The audit log is why we stayed: when a carrier disputes a delivery, we can show who changed the status and when, to the second. Exports to the carrier portal still need a manual step.' },
    { id: 'harbor', name: 'Priya Raman', role: 'Support operations', company: 'Harbor & Vale', mark: 'bars', rating: 5,
      quote: 'Our returns backlog was 1,900 tickets in March. By May it was under 200, mostly because refunds now start from the table instead of a weekly CSV export.' },
  ]

  let seq = 0

  export function createTestimonialCards(opts: TestimonialCardsOptions = {}) {
    const uid = `sv-tcards-${seq++}`
    const items = opts.items ?? SAMPLE
    const max = opts.excerptLength ?? 170
    const rated = items.filter((t) => t.rating != null)
    const average = rated.length ? rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length : 0
    let expanded = $state<string[]>([])

    const isLong = (t: Testimonial) => t.quote.length > max
    const isExpanded = (id: string) => expanded.includes(id)
    const toggle = (id: string) => { expanded = isExpanded(id) ? expanded.filter((x) => x !== id) : [...expanded, id] }

    return {
      items,
      average,
      ratedCount: rated.length,
      isLong,
      isExpanded,
      toggle,
      /** The quote to show: cut at a word boundary while collapsed. */
      text: (t: Testimonial) => (!isLong(t) || isExpanded(t.id) ? t.quote : `${t.quote.slice(0, max).replace(/\s+\S*$/, '')}...`),
      stories: () => opts.onStories?.(),
      /** Spread on the Read more <button>; aria-controls points at the quote. */
      toggleProps: (t: Testimonial) => ({
        type: 'button' as const,
        'aria-expanded': isExpanded(t.id),
        'aria-controls': `${uid}-q-${t.id}`,
        onclick: () => toggle(t.id),
      }),
      /** Spread on the element that holds the quote text. */
      quoteProps: (t: Testimonial) => ({ id: `${uid}-q-${t.id}` }),
    }
  }
</script>

<script lang="ts">
  import { SvAvatar, SvRating, SvButton, SvToaster, toast } from '@svgrid/grid'

  const cards = createTestimonialCards({ onStories: () => toast('Opening customer stories') })
</script>

{#snippet wordmark(t: Testimonial)}
  <span class="sv-tcards-mark">
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {#if t.mark === 'peak'}<path d="M2 16l6-10 3.5 5.5L14 8l4 8z" />
      {:else if t.mark === 'leaf'}<path d="M4 16C4 8 9 4 17 3c-1 8-5 13-13 13zm0 0l7-7" />
      {:else if t.mark === 'hex'}<path d="M10 2l7 4v8l-7 4-7-4V6z" />
      {:else if t.mark === 'ring'}<circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" />
      {:else if t.mark === 'wave'}<path d="M2 8c3-3 5 3 8 0s5 3 8 0M2 13c3-3 5 3 8 0s5 3 8 0" />
      {:else}<path d="M3 17V9M8 17V5M13 17v-6M18 17V3" />{/if}
    </svg>
    {t.company}
  </span>
{/snippet}

<section class="sv-tcards" aria-labelledby="sv-tcards-title">
  <header class="sv-tcards-head">
    <div>
      <h2 id="sv-tcards-title">What changed for ops teams</h2>
      <p>Quotes from customer interviews, July to September 2026.</p>
    </div>
    <div class="sv-tcards-score">
      <SvRating value={Math.round(cards.average * 2) / 2} allowHalf readonly size="sm" ariaLabel={`Average rating ${cards.average.toFixed(1)} out of 5`} />
      <span>{cards.average.toFixed(1)} average from {cards.ratedCount} rated quotes</span>
      <SvButton variant="outline" size="sm" onclick={cards.stories}>Read customer stories</SvButton>
    </div>
  </header>

  <ul class="sv-tcards-cols">
    {#each cards.items as t (t.id)}
      <li class="sv-tcards-item">
        <figure>
          <div class="sv-tcards-top">
            {@render wordmark(t)}
            {#if t.rating != null}
              <SvRating value={t.rating} readonly size="sm" ariaLabel={`Rated ${t.rating} out of 5`} />
            {/if}
          </div>
          <blockquote {...cards.quoteProps(t)}><p>{cards.text(t)}</p></blockquote>
          {#if cards.isLong(t)}
            <button class="sv-tcards-more" {...cards.toggleProps(t)}>{cards.isExpanded(t.id) ? 'Show less' : 'Read more'}</button>
          {/if}
          <figcaption>
            <SvAvatar name={t.name} size={40} />
            <span class="sv-tcards-who"><strong>{t.name}</strong><span>{t.role}</span></span>
          </figcaption>
        </figure>
      </li>
    {/each}
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-tcards :global(.sv-rating) { --_off: var(--sg-rating-empty, color-mix(in srgb, var(--sg-fg, #0f172a) 22%, var(--sg-bg, #fff))); }
  .sv-tcards {
    width: 100%; box-sizing: border-box; padding: 48px 40px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-tcards-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 28px; }
  .sv-tcards-head h2 { margin: 0 0 6px; font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
  .sv-tcards-head p { margin: 0; color: var(--sg-muted, #64748b); font-size: 14.5px; }
  .sv-tcards-score { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-tcards-cols { list-style: none; margin: 0; padding: 0; columns: 3; column-gap: 18px; }
  .sv-tcards-item { break-inside: avoid; margin-bottom: 18px; }
  .sv-tcards-item figure {
    display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin: 0; padding: 22px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-tcards-item blockquote { margin: 0; }
  .sv-tcards-item blockquote p { margin: 0; font-size: 15px; line-height: 1.6; }
  .sv-tcards-more {
    margin-top: -6px; padding: 0; border: 0; background: none; cursor: pointer;
    font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-accent, #2563eb);
  }
  .sv-tcards-more:hover { text-decoration: underline; }
  .sv-tcards-more:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }
  .sv-tcards-item figcaption {
    display: flex; align-items: center; gap: 12px; width: 100%;
    padding-top: 14px; border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-tcards-top { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
  .sv-tcards-who { display: flex; flex-direction: column; min-width: 0; font-size: 13px; line-height: 1.35; }
  .sv-tcards-who strong { font-weight: 650; font-size: 14px; }
  .sv-tcards-who span { color: var(--sg-muted, #64748b); }
  .sv-tcards-mark {
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    font-size: 14px; font-weight: 700; letter-spacing: -.01em; color: color-mix(in srgb, var(--sg-fg, #0f172a) 70%, var(--sg-bg, #fff));
  }
  .sv-tcards-mark svg { display: block; width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  @media (max-width: 1024px) {
    .sv-tcards-cols { columns: 2; }
  }
  @media (max-width: 640px) {
    .sv-tcards { padding: 32px 16px; }
    .sv-tcards-head h2 { font-size: 23px; }
    .sv-tcards-cols { columns: 1; }
    .sv-tcards-item figure { padding: 18px; }
  }
</style>
