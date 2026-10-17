<script lang="ts" module>
  /**
   * FAQ accordion block - a heading, one line and a search SvTextInput beside
   * an accordion of questions. Typing filters the list live, highlights each
   * hit with SvMark, opens the answers that match and, when nothing matches,
   * shows a "no matches" state with Clear search and Contact support
   * SvButtons. Uses SvToaster and toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createFaqAccordion() below owns the questions, the search, the
   * match highlighting and the open state with no markup. The component under
   * it is one styled render of that core; import createFaqAccordion from this
   * file (or `npx @svgrid/ui add faq-accordion --headless` for the core alone)
   * to draw your own.
   */
  export type FaqItem = { id: string; question: string; answer: string }
  /** A run of text; `hit` runs matched the search. */
  export type FaqPart = { text: string; hit: boolean }
  export type FaqAccordionOptions = {
    /** Your questions; the demo's sample set is the default. */
    items?: FaqItem[]
    /** Ids open on load. Default: the first question. */
    initialOpen?: string[]
    /** "Contact support" from the no-matches state; gets what the reader searched for. */
    onContact?: (query: string) => void
  }

  const FAQ: FaqItem[] = [
    { id: 'rows', question: 'How do you count billable rows?', answer: 'A row counts once per calendar month, the first time a sync inserts or changes it. Re-syncing an unchanged row is free and deletes are never billed.' },
    { id: 'overage', question: 'What happens if we go over our row limit?', answer: 'Syncs keep running. Extra rows are billed at $8 per million on the next invoice, and workspace owners get an email at 80% and 100% of the limit.' },
    { id: 'cancel', question: 'How do I cancel or downgrade?', answer: 'Under Settings > Billing. A downgrade starts at the end of the billing period. After a cancel your tables stay readable for 30 days, then they are deleted.' },
    { id: 'sso', question: 'Do you support SSO?', answer: 'SAML and OIDC single sign-on are on Teams and above, with guided setup for Okta, Microsoft Entra ID and Google Workspace.' },
    { id: 'owner', question: 'How do I transfer workspace ownership?', answer: 'An owner can promote any admin to owner under Settings > Members. The billing contact and past invoices move with it.' },
    { id: 'region', question: 'Where is our data stored?', answer: 'In the region you pick at sign-up: US (Virginia), EU (Frankfurt) or AU (Sydney). Data and backups stay in that region.' },
    { id: 'sync', question: 'How often do connectors sync?', answer: 'Hourly on Starter, every 15 minutes on Teams and every 5 minutes on Enterprise. Webhook sources such as Stripe push changes within a minute.' },
    { id: 'export', question: 'Can we export everything if we leave?', answer: 'Yes, on every plan. Download any table as CSV or Parquet, or set up a nightly full export to your own S3 bucket.' },
  ]

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let seq = 0

  export function createFaqAccordion(opts: FaqAccordionOptions = {}) {
    const uid = `sv-faqsearch-${seq++}`
    const items = opts.items ?? FAQ
    let query = $state('')
    let open = $state<string[]>(opts.initialOpen ?? (items[0] ? [items[0].id] : []))

    const words = $derived(query.trim().toLowerCase().split(/\s+/).filter(Boolean))
    const pattern = $derived(words.length ? new RegExp(`(${words.map(escapeRe).join('|')})`, 'i') : null)
    const results = $derived(
      words.length
        ? items.filter((q) => {
            const hay = `${q.question} ${q.answer}`.toLowerCase()
            return words.every((w) => hay.includes(w))
          })
        : items,
    )

    function setQuery(v: string) {
      query = v
      // Open up to three results whose answer holds a hit, so the highlight is in view.
      open = words.length
        ? results.filter((q) => words.some((w) => q.answer.toLowerCase().includes(w))).slice(0, 3).map((q) => q.id)
        : []
    }

    const isOpen = (id: string) => open.includes(id)
    const toggle = (id: string) => { open = isOpen(id) ? open.filter((x) => x !== id) : [...open, id] }

    return {
      items,
      get query() { return query },
      set query(v: string) { setQuery(v) },
      /** The questions that match every search word (all of them when empty). */
      get results() { return results },
      get searching() { return words.length > 0 },
      get open() { return open },
      set open(ids: string[]) { open = ids },
      isOpen,
      toggle,
      clear: () => setQuery(''),
      contact: () => opts.onContact?.(query.trim()),
      /** Split text into plain and matched runs for highlighting. */
      parts: (text: string): FaqPart[] =>
        pattern
          ? text.split(pattern).filter(Boolean).map((t) => ({ text: t, hit: words.includes(t.toLowerCase()) }))
          : [{ text, hit: false }],
      /** Spread on a plain <input> if you render your own search box. */
      searchProps: () => ({
        type: 'search' as const,
        value: query,
        oninput: (e: Event) => setQuery((e.currentTarget as HTMLInputElement).value),
      }),
      /** Spread on the question's <button>. */
      triggerProps: (id: string) => ({
        type: 'button' as const,
        id: `${uid}-q-${id}`,
        'aria-expanded': isOpen(id),
        'aria-controls': `${uid}-a-${id}`,
        onclick: () => toggle(id),
      }),
      /** Spread on the answer's container. */
      panelProps: (id: string) => ({ id: `${uid}-a-${id}`, role: 'region' as const, 'aria-labelledby': `${uid}-q-${id}` }),
      /** schema.org FAQPage for <svelte:head>; built from every item, not the filtered list. */
      jsonLd: () => ({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvTextInput, SvMark, SvButton, SvToaster, toast } from '@svgrid/grid'

  const faq = createFaqAccordion({
    onContact: (q) => toast(q ? `Opening a support request about "${q}"` : 'Opening a support request'),
  })
</script>

{#snippet marked(text: string)}{#each faq.parts(text) as p, i (i)}{#if p.hit}<SvMark tone="warning">{p.text}</SvMark>{:else}{p.text}{/if}{/each}{/snippet}

<section class="sv-faqsearch" aria-labelledby="sv-faqsearch-title">
  <div class="sv-faqsearch-side">
    <h2 id="sv-faqsearch-title">How can we help?</h2>
    <p>Answers about billing, access and data in your Fieldline workspace.</p>
    <SvTextInput label="Search questions" type="search" placeholder="Try export or SSO" clearable block bind:value={faq.query} />
    <p class="sv-faqsearch-count" aria-live="polite">
      {faq.searching ? `${faq.results.length} of ${faq.items.length} questions match` : `${faq.items.length} questions`}
    </p>
  </div>

  {#if faq.results.length}
    <div class="sv-faqsearch-list">
      {#each faq.results as item (item.id)}
        <div class="sv-faqsearch-item">
          <h3>
            <button class="sv-faqsearch-trigger" {...faq.triggerProps(item.id)}>
              <span>{@render marked(item.question)}</span>
              <svg class="sv-faqsearch-chev" class:sv-faqsearch-is-open={faq.isOpen(item.id)} viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
            </button>
          </h3>
          {#if faq.isOpen(item.id)}
            <div class="sv-faqsearch-answer" {...faq.panelProps(item.id)}><p>{@render marked(item.answer)}</p></div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="sv-faqsearch-empty">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5M8.5 11h5" /></svg>
      <h3>No questions match "{faq.query.trim()}"</h3>
      <p>Try one word, like "billing" or "region", or ask the support team.</p>
      <div class="sv-faqsearch-empty-row">
        <SvButton variant="outline" onclick={faq.clear}>Clear search</SvButton>
        <SvButton variant="primary" onclick={faq.contact}>Contact support</SvButton>
      </div>
    </div>
  {/if}
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-faqsearch {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr); gap: 48px; align-items: start;
    width: 100%; min-height: 560px; box-sizing: border-box; padding: 48px 40px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  .sv-faqsearch-side h2 { margin: 0 0 10px; font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
  .sv-faqsearch-side > p { margin: 0 0 20px; color: var(--sg-muted, #64748b); font-size: 15px; line-height: 1.55; }
  .sv-faqsearch-side .sv-faqsearch-count { margin: 10px 0 0; font-size: 12.5px; }
  /* The field's own clear button replaces the browser's search-cancel glyph. */
  .sv-faqsearch-side :global(input[type='search']::-webkit-search-cancel-button) { appearance: none; -webkit-appearance: none; }
  .sv-faqsearch-list { border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-faqsearch-item { border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-faqsearch-item h3 { margin: 0; font: inherit; }
  .sv-faqsearch-trigger {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%;
    padding: 16px 4px; border: 0; background: none; color: inherit; text-align: start; cursor: pointer;
    font: inherit; font-size: 15px; font-weight: 600; line-height: 1.4;
  }
  .sv-faqsearch-trigger:hover { color: var(--sg-accent, #2563eb); }
  .sv-faqsearch-trigger:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px; border-radius: 6px; }
  .sv-faqsearch-chev {
    display: block; flex: none; width: 16px; height: 16px; transition: transform .16s;
    fill: none; stroke: var(--sg-muted, #64748b); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
  }
  .sv-faqsearch-chev.sv-faqsearch-is-open { transform: rotate(180deg); }
  .sv-faqsearch-answer p { margin: 0; padding: 0 36px 18px 4px; color: var(--sg-muted, #64748b); font-size: 14px; line-height: 1.6; }
  .sv-faqsearch-empty {
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 24px;
    border: 1px dashed var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-faqsearch-empty svg { display: block; width: 36px; height: 36px; margin-bottom: 12px; fill: none; stroke: var(--sg-muted, #64748b); stroke-width: 1.6; stroke-linecap: round; }
  .sv-faqsearch-empty h3 { margin: 0 0 6px; font-size: 16px; font-weight: 650; overflow-wrap: anywhere; }
  .sv-faqsearch-empty p { margin: 0 0 18px; color: var(--sg-muted, #64748b); font-size: 14px; }
  .sv-faqsearch-empty-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  @media (prefers-reduced-motion: reduce) { .sv-faqsearch-chev { transition: none; } }

  @media (max-width: 760px) {
    .sv-faqsearch { grid-template-columns: minmax(0, 1fr); gap: 24px; min-height: 0; padding: 32px 16px; }
    .sv-faqsearch-side h2 { font-size: 23px; }
    .sv-faqsearch-answer p { padding-right: 4px; }
  }
</style>
