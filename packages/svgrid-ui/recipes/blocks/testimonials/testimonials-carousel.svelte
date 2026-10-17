<script lang="ts" module>
  /**
   * Testimonial carousel block - one large customer quote at a time in an
   * SvCarousel with previous/next arrows, dots, swipe and autoplay that pauses
   * on hover or focus, has a stop toggle and stays off when the reader asks for
   * reduced motion. Each slide has a read-only SvRating, the quote, an
   * SvAvatar with initials, name, role and a "Read the story" SvButton; a row
   * of inline-SVG company wordmarks under it jumps to that company's quote.
   * Uses SvToaster and toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createTestimonialCarousel() below owns the quotes, the active
   * index and the autoplay interval (0 under reduced motion) with no markup.
   * The component under it is one styled render of that core; import
   * createTestimonialCarousel from this file (or `npx @svgrid/ui add
   * testimonials-carousel --headless` for the core alone) to draw your own.
   */
  export type CarouselMark = 'ring' | 'peak' | 'hex' | 'bars' | 'leaf'
  export type CarouselQuote = {
    id: string; quote: string; name: string; role: string; company: string
    /** Which made-up glyph draws the company's wordmark. */
    mark: CarouselMark
    rating?: number
  }
  export type TestimonialCarouselOptions = {
    /** Your quotes; the demo's sample set is the default. */
    items?: CarouselQuote[]
    /** Autoplay interval in ms; 0 turns autoplay off. */
    interval?: number
    /** Start with autoplay off; set `reducedMotion` from prefers-reduced-motion. */
    reducedMotion?: boolean
    onChange?: (index: number, item: CarouselQuote) => void
    /** "Read the story" on a slide: link to that customer's case study. */
    onStory?: (item: CarouselQuote) => void
  }

  const SAMPLE: CarouselQuote[] = [
    { id: 'northwind', name: 'Dana Whitfield', role: 'Dispatch lead', company: 'Northwind Freight', mark: 'peak', rating: 5,
      quote: 'We stopped rebuilding the dispatch board from three spreadsheets every morning. Orders and warehouse stock land in one table by 6:05, and each coordinator gets about 40 minutes back a day.' },
    { id: 'copperleaf', name: 'Rafael Ortiz', role: 'Controller', company: 'Copperleaf Foods', mark: 'leaf', rating: 5,
      quote: 'Month-end close went from six working days to three. We only look at the orders the reconciliation view flags, which is usually under 3% of them.' },
    { id: 'lumen', name: 'Amara Okafor', role: 'Head of operations', company: 'Lumen Health', mark: 'ring', rating: 5,
      quote: 'We added 14 clinics in one quarter without hiring another analyst. Every clinic fills in the same intake table, and the regional leads read all of them in one rolled-up view.' },
    { id: 'kestrel', name: 'Mei Tanaka', role: 'SRE manager', company: 'Kestrel Labs', mark: 'hex', rating: 4,
      quote: 'The on-call handoff doc is gone. Failed syncs post the broken rows straight into our incident channel, so whoever picks it up starts with the data instead of a summary.' },
    { id: 'harbor', name: 'Priya Raman', role: 'Support operations', company: 'Harbor & Vale', mark: 'bars', rating: 5,
      quote: 'Our returns backlog was 1,900 tickets in March and under 200 by May. Refunds now start from the table instead of a weekly CSV export.' },
  ]

  export function createTestimonialCarousel(opts: TestimonialCarouselOptions = {}) {
    const items = opts.items ?? SAMPLE
    const every = opts.interval ?? 7000
    let index = $state(0)
    let reducedMotion = $state(opts.reducedMotion ?? false)

    function go(i: number) {
      if (!items.length) return
      index = ((i % items.length) + items.length) % items.length
      opts.onChange?.(index, items[index]!)
    }

    return {
      items,
      get index() { return index },
      set index(i: number) { if (i !== index) go(i) },
      get current() { return items[index] },
      /** Interval to hand the carousel: 0 while reduced motion is on. */
      get autoplay() { return reducedMotion ? 0 : every },
      get reducedMotion() { return reducedMotion },
      set reducedMotion(v: boolean) { reducedMotion = v },
      go,
      next: () => go(index + 1),
      prev: () => go(index - 1),
      story: (i: number) => { const q = items[i]; if (q) opts.onStory?.(q) },
      /** Spread on a button that jumps to quote i (the wordmark row). */
      jumpProps: (i: number) => ({
        type: 'button' as const,
        'aria-current': (i === index ? 'true' : undefined) as 'true' | undefined,
        'aria-label': `Quote from ${items[i]?.company ?? ''}`,
        onclick: () => go(i),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvCarousel, SvAvatar, SvRating, SvButton, SvToaster, toast } from '@svgrid/grid'

  const quotes = createTestimonialCarousel({ onStory: (q) => toast(`Opening the ${q.company} story`) })

  // Autoplay stays off for readers who ask the OS for reduced motion.
  $effect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    quotes.reducedMotion = mq.matches
    const sync = () => (quotes.reducedMotion = mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  })
</script>

{#snippet glyph(mark: CarouselMark)}
  <svg viewBox="0 0 20 20" aria-hidden="true">
    {#if mark === 'peak'}<path d="M2 16l6-10 3.5 5.5L14 8l4 8z" />
    {:else if mark === 'leaf'}<path d="M4 16C4 8 9 4 17 3c-1 8-5 13-13 13zm0 0l7-7" />
    {:else if mark === 'hex'}<path d="M10 2l7 4v8l-7 4-7-4V6z" />
    {:else if mark === 'ring'}<circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" />
    {:else}<path d="M3 17V9M8 17V5M13 17v-6M18 17V3" />{/if}
  </svg>
{/snippet}

<section class="sv-tcarousel" aria-labelledby="sv-tcarousel-title">
  <h2 id="sv-tcarousel-title">Teams that run their operations on Fieldline</h2>

  <div class="sv-tcarousel-frame">
    <SvCarousel count={quotes.items.length} bind:current={quotes.index} autoplay={quotes.autoplay} ariaLabel="Customer quotes">
      {#snippet slide(i)}
        {@const q = quotes.items[i]}
        {#if q}
          <figure class="sv-tcarousel-slide">
            <div class="sv-tcarousel-top">
              <svg class="sv-tcarousel-qmark" viewBox="0 0 32 24" aria-hidden="true"><path d="M0 24V14C0 6 4 1 12 0v5c-4 1-6 4-6 8h6v11zm18 0V14c0-8 4-13 12-14v5c-4 1-6 4-6 8h6v11z" /></svg>
              {#if q.rating != null}
                <SvRating value={q.rating} readonly size="sm" ariaLabel={`Rated ${q.rating} out of 5`} />
              {/if}
            </div>
            <blockquote><p>{q.quote}</p></blockquote>
            <figcaption>
              <SvAvatar name={q.name} size={48} />
              <span class="sv-tcarousel-who">
                <strong>{q.name}</strong>
                <span>{q.role}, {q.company}</span>
              </span>
              <SvButton variant="ghost" size="sm" onclick={() => quotes.story(i)}>Read the story</SvButton>
            </figcaption>
          </figure>
        {/if}
      {/snippet}
    </SvCarousel>
  </div>

  <ul class="sv-tcarousel-logos" aria-label="Jump to a customer">
    {#each quotes.items as q, i (q.id)}
      <li>
        <button class="sv-tcarousel-logo" {...quotes.jumpProps(i)}>
          {@render glyph(q.mark)}<span>{q.company}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-tcarousel :global(.sv-rating) { --_off: var(--sg-rating-empty, color-mix(in srgb, var(--sg-fg, #0f172a) 22%, var(--sg-bg, #fff))); }
  .sv-tcarousel {
    display: flex; flex-direction: column; align-items: center; gap: 28px;
    width: 100%; box-sizing: border-box; padding: 56px 40px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-tcarousel h2 { margin: 0; max-width: 560px; text-align: center; font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.25; }
  .sv-tcarousel-frame {
    width: 100%; max-width: 860px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-tcarousel-frame :global(.sv-carousel__slide) { display: flex; }
  .sv-tcarousel-slide { display: flex; flex-direction: column; gap: 20px; width: 100%; margin: 0; padding: 44px 76px 52px; box-sizing: border-box; }
  .sv-tcarousel-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sv-tcarousel-qmark { display: block; width: 32px; height: 24px; fill: color-mix(in srgb, var(--sg-fg, #0f172a) 22%, transparent); }
  .sv-tcarousel-slide blockquote { margin: 0; flex: 1; }
  .sv-tcarousel-slide blockquote p { margin: 0; font-size: 21px; line-height: 1.5; letter-spacing: -.01em; font-weight: 500; }
  .sv-tcarousel-slide figcaption { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; }
  .sv-tcarousel-who { display: flex; flex-direction: column; margin-right: auto; font-size: 13.5px; line-height: 1.4; }
  .sv-tcarousel-who strong { font-size: 15px; font-weight: 650; }
  .sv-tcarousel-who span { color: var(--sg-muted, #64748b); }

  .sv-tcarousel-logos { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 10px; }
  .sv-tcarousel-logo {
    display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px;
    border: 1px solid transparent; border-radius: var(--sg-radius, 8px); background: none; cursor: pointer;
    font: inherit; font-size: 14px; font-weight: 700; letter-spacing: -.01em;
    color: color-mix(in srgb, var(--sg-muted, #64748b) 80%, transparent);
  }
  .sv-tcarousel-logo svg { display: block; width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .sv-tcarousel-logo:hover { color: var(--sg-fg, #0f172a); }
  .sv-tcarousel-logo[aria-current='true'] { color: var(--sg-fg, #0f172a); border-color: var(--sg-border, #e2e8f0); }
  .sv-tcarousel-logo:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .sv-tcarousel-frame :global(.sv-carousel__track) { transition: none; }
  }

  @media (max-width: 640px) {
    .sv-tcarousel { padding: 36px 16px; gap: 22px; }
    .sv-tcarousel h2 { font-size: 22px; }
    .sv-tcarousel-slide { padding: 28px 22px 64px; }
    .sv-tcarousel-slide blockquote p { font-size: 17px; }
    /* Arrows move beside the dots so they do not cover the quote. */
    .sv-tcarousel-frame :global(.sv-carousel__arrow) { top: auto; bottom: 10px; transform: none; }
    .sv-tcarousel-frame :global(.sv-carousel__dots) { bottom: 23px; }
    .sv-tcarousel-logo { padding: 6px 8px; font-size: 13px; }
  }
</style>
