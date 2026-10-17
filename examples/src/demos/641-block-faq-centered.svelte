<script lang="ts" module>
  /**
   * Centered FAQ accordion block - a centered heading over an SvSegmented
   * category switch (Billing / Account / Data) that swaps the questions in an
   * SvAccordion, with Expand all / Collapse all SvButtons and a contact line
   * under the list. Uses SvToaster and toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createFaqCentered() below owns the questions, the active
   * category and which answers are open with no markup. The component under it
   * is one styled render of that core; import createFaqCentered from this file
   * (or `npx @svgrid/ui add faq-centered --headless` for the core alone) to
   * draw your own.
   */
  export type FaqCategory = { id: string; label: string }
  export type FaqItem = { id: string; category: string; question: string; answer: string }
  export type FaqCenteredOptions = {
    /** Your categories and questions; the demo's sample set is the default. */
    categories?: FaqCategory[]
    items?: FaqItem[]
    /** Category shown first. Default: the first one. */
    initialCategory?: string
    onCategoryChange?: (id: string) => void
    onContact?: () => void
  }

  const CATEGORIES: FaqCategory[] = [
    { id: 'billing', label: 'Billing' },
    { id: 'account', label: 'Account' },
    { id: 'data', label: 'Data' },
  ]
  const FAQ: FaqItem[] = [
    { id: 'rows', category: 'billing', question: 'How do you count billable rows?', answer: 'A row counts once per calendar month, the first time a sync inserts or changes it. Re-syncing an unchanged row is free and deletes are never billed.' },
    { id: 'overage', category: 'billing', question: 'What happens if we go over our row limit?', answer: 'Syncs keep running. Extra rows are billed at $8 per million on the next invoice, and workspace owners get an email at 80% and 100% of the limit.' },
    { id: 'annual', category: 'billing', question: 'Is there a discount for paying yearly?', answer: 'Yearly plans cost ten months of the monthly price. You can switch from monthly at any time; the unused part of the month is credited.' },
    { id: 'cancel', category: 'billing', question: 'How do I cancel?', answer: 'Under Settings > Billing. Your tables stay readable for 30 days after the period ends, then they are deleted.' },
    { id: 'seats', category: 'account', question: 'Who needs a paid seat?', answer: 'Editors and admins. Viewers who only open shared dashboards are free and unlimited.' },
    { id: 'sso', category: 'account', question: 'Do you support SSO?', answer: 'SAML and OIDC single sign-on are on Teams and above, with guided setup for Okta, Microsoft Entra ID and Google Workspace. SCIM provisioning is on Enterprise.' },
    { id: '2fa', category: 'account', question: 'Can we require two-factor sign-in?', answer: 'Admins can turn it on for everyone under Settings > Security. Members without 2FA are asked to set it up at their next sign-in.' },
    { id: 'region', category: 'data', question: 'Where is our data stored?', answer: 'In the region you pick at sign-up: US (Virginia), EU (Frankfurt) or AU (Sydney). Data and backups stay in that region.' },
    { id: 'sync', category: 'data', question: 'How often do connectors sync?', answer: 'Hourly on Starter, every 15 minutes on Teams and every 5 minutes on Enterprise. Webhook sources such as Stripe push changes within a minute.' },
    { id: 'export', category: 'data', question: 'Can we export everything if we leave?', answer: 'Yes, on every plan. Download any table as CSV or Parquet, or set up a nightly full export to your own S3 bucket.' },
  ]

  export function createFaqCentered(opts: FaqCenteredOptions = {}) {
    const categories = opts.categories ?? CATEGORIES
    const items = opts.items ?? FAQ
    const first = opts.initialCategory ?? categories[0]?.id ?? ''
    let category = $state(first)
    const visible = $derived(items.filter((q) => q.category === category))
    // The first question of the starting category is open on load.
    let open = $state<string[]>(items.filter((q) => q.category === first).slice(0, 1).map((q) => q.id))

    function setCategory(id: string) {
      if (id === category) return
      category = id
      open = []
      opts.onCategoryChange?.(id)
    }
    const expandAll = () => { open = visible.map((q) => q.id) }
    const collapseAll = () => { open = [] }

    return {
      categories,
      get category() { return category },
      set category(id: string) { setCategory(id) },
      /** Questions in the active category. */
      get visible() { return visible },
      /** Open question ids; bind an accordion's expanded list to this. */
      get open() { return open },
      set open(ids: string[]) { open = ids },
      get allOpen() { return visible.length > 0 && visible.every((q) => open.includes(q.id)) },
      get noneOpen() { return open.length === 0 },
      expandAll,
      collapseAll,
      contact: () => opts.onContact?.(),
      answerOf: (id: string) => items.find((q) => q.id === id)?.answer ?? '',
      /** { id, label } rows for a list or accordion component. */
      get accordionItems() { return visible.map((q) => ({ id: q.id, label: q.question })) },
      /** Spread on a plain <button> per category when you draw your own switch. */
      categoryProps: (id: string) => ({
        type: 'button' as const,
        'aria-pressed': id === category,
        onclick: () => setCategory(id),
      }),
      /** schema.org FAQPage for <svelte:head>; every category, not only the visible one. */
      jsonLd: () => ({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvSegmented, SvAccordion, SvButton, SvToaster, toast } from '@svgrid/grid'

  const faq = createFaqCentered({
    onContact: () => toast('Opening a support request'),
  })
  const options = faq.categories.map((c) => ({ value: c.id, label: c.label }))
</script>

<section class="sv-faqctr" aria-labelledby="sv-faqctr-title">
  <div class="sv-faqctr-inner">
    <h2 id="sv-faqctr-title">Frequently asked questions</h2>
    <p class="sv-faqctr-lead">Pick a topic. Answers apply to every Fieldline plan unless they name one.</p>

    <div class="sv-faqctr-switch">
      <SvSegmented ariaLabel="Question topic" {options} block value={faq.category} onChange={(v) => (faq.category = String(v))} />
    </div>

    <div class="sv-faqctr-tools">
      <span>{faq.visible.length} questions</span>
      <div class="sv-faqctr-tool-btns">
        <SvButton variant="ghost" size="sm" disabled={faq.allOpen} onclick={faq.expandAll}>Expand all</SvButton>
        <SvButton variant="ghost" size="sm" disabled={faq.noneOpen} onclick={faq.collapseAll}>Collapse all</SvButton>
      </div>
    </div>

    <SvAccordion items={faq.accordionItems} expandMode="multiple" bind:expanded={faq.open}>
      {#snippet panel(item)}<p class="sv-faqctr-answer">{faq.answerOf(item.id)}</p>{/snippet}
    </SvAccordion>

    <p class="sv-faqctr-foot">
      Can't find your answer?
      <button type="button" class="sv-faqctr-link" onclick={faq.contact}>Contact support</button>
    </p>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-faqctr {
    display: flex; justify-content: center;
    width: 100%; min-height: 560px; box-sizing: border-box; padding: 48px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  .sv-faqctr-inner { width: 100%; max-width: 680px; }
  .sv-faqctr-inner h2 { margin: 0 0 8px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
  .sv-faqctr-lead { margin: 0 auto 24px; max-width: 46ch; text-align: center; color: var(--sg-muted, #64748b); font-size: 15px; line-height: 1.55; }
  .sv-faqctr-switch { max-width: 360px; margin: 0 auto 28px; }
  .sv-faqctr-tools {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px;
    font-size: 13px; color: var(--sg-muted, #64748b);
  }
  .sv-faqctr-tool-btns { display: flex; gap: 4px; }
  .sv-faqctr-answer { margin: 0; color: var(--sg-muted, #64748b); }
  .sv-faqctr-foot { margin: 22px 0 0; text-align: center; font-size: 14px; color: var(--sg-muted, #64748b); }
  .sv-faqctr-link {
    padding: 0; border: 0; background: none; font: inherit; font-weight: 600; cursor: pointer;
    color: var(--sg-accent, #2563eb);
  }
  .sv-faqctr-link:hover { text-decoration: underline; }
  .sv-faqctr-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }
  .sv-faqctr :global(.sv-acc__header) { padding: 14px 16px; font-size: 14.5px; }
  .sv-faqctr :global(.sv-acc__body) { padding: 0 16px 16px 40px; }

  @media (max-width: 560px) {
    .sv-faqctr { min-height: 0; padding: 32px 16px; }
    .sv-faqctr-inner h2 { font-size: 23px; }
    .sv-faqctr :global(.sv-acc__body) { padding-left: 16px; }
  }
</style>
