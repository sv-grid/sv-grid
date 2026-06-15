<script lang="ts">
  // Pricing modelled on the AG Grid / Bryntum commercial structure:
  //   1. Community (free, MIT)
  //   2. Pro - Single Application Developer License (one deployed app)
  //   3. Pro - Multiple Application Developer License (unlimited apps)
  // Pro is a perpetual license + 1 year of updates/support that renews
  // automatically until cancelled (cancel anytime, keep your paid-term versions).
  //
  // Layout follows ag-grid.com/license-pricing/:
  //   - 3-card hero with ribboned highlight tier
  //   - Volume/dev-count calculator with live totals
  //   - Big feature comparison matrix grouped by category (Core, Editing,
  //     Filtering, Export, Pivot, AI, Support); ✓ / -
  //   - OSS callout, "Which license do I need?" helper
  //   - Collapsible FAQ accordion
  //   - Bottom contact CTA
  //
  // PayPal / BuyDialog plumbing is unchanged from the previous revision.
  import BuyDialog, {
    type SubscriberForm,
    type ConfirmedSubscription,
  } from '../components/BuyDialog.svelte'
  import { PAYPAL_PLAN_IDS, type PayPalApproveData } from '../lib/paypal'
  import { funnel } from '../lib/analytics'

  type Tier = {
    name: string
    licenseType?: string
    price: string
    cadence: string
    blurb: string
    cta:
      | { kind: 'link'; label: string; href: string }
      | { kind: 'paypal'; planKey: keyof typeof PAYPAL_PLAN_IDS }
    highlight?: boolean
    ribbon?: string
  }

  const tiers: Tier[] = [
    {
      name: 'Community',
      licenseType: 'MIT License',
      price: '$0',
      cadence: 'forever',
      blurb:
        'The full data grid, permissively licensed for commercial use. No license key, no row-count cap, no upsell pop-ups.',
      cta: {
        kind: 'link',
        label: 'Install from npm',
        href: 'https://www.npmjs.com/package/sv-grid-community',
      },
    },
    {
      name: 'Pro - Single App',
      licenseType: 'Single Application Developer License',
      price: '$599',
      cadence: 'per developer',
      blurb:
        'For teams shipping a single production app. Covers one deployed application, any number of internal dev / staging environments. Buy once, keep forever - optional yearly renewal for new updates and support, cancel anytime.',
      cta: { kind: 'paypal', planKey: 'proSingleApp' },
      highlight: true,
      ribbon: 'Most popular',
    },
    {
      name: 'Pro - Multi App',
      licenseType: 'Multiple Application Developer License',
      price: '$999',
      cadence: 'per developer',
      blurb:
        'For teams shipping multiple production apps. Covers unlimited deployed applications under your organisation. Buy once, keep forever - optional yearly renewal for new updates and support, cancel anytime. Best value for product suites.',
      cta: { kind: 'paypal', planKey: 'proMultiApp' },
    },
    {
      name: 'Enterprise',
      licenseType: 'Site / Org-wide License',
      price: 'Custom',
      cadence: '',
      blurb:
        'For organisations with 50+ developers, security review, MSA / NDA, source-code escrow, named support engineer, on-prem documentation, government / FedRAMP, or multi-year (2 / 3 / 5 yr) terms. Includes everything in Multi App + custom SLAs.',
      cta: {
        kind: 'link',
        label: 'Talk to sales',
        href: "mailto:sales@jqwidgets.com?subject=sv-grid-pro%20Enterprise%20quote&body=Hi%20jQWidgets,%0A%0AWe'd%20like%20a%20custom%20Enterprise%20quote%20for%20sv-grid-pro.%0A%0ACompany:%20%0ATeam%20size:%20%0AApps%20covered:%20%0ARequirements%20(MSA%20/%20NDA%20/%20escrow%20/%20on-prem%20/%20SLA):%20%0AContract%20term%20(1%20/%202%20/%203%20/%205%20yr):%20%0A%0AThanks!",
      },
    },
  ]

  // ---- Per-plan checkout state (unchanged) ----
  const emptyForm = (): SubscriberForm => ({
    firstName: '', lastName: '', email: '', company: '', vat: '',
  })
  let forms = $state<Record<string, SubscriberForm>>(
    Object.fromEntries(Object.keys(PAYPAL_PLAN_IDS).map((k) => [k, emptyForm()])),
  )
  let quantities = $state<Record<string, number>>(
    Object.fromEntries(Object.keys(PAYPAL_PLAN_IDS).map((k) => [k, 1])),
  )
  const PRICE_PER_DEV: Record<string, number> = {
    proSingleApp: 599,
    proMultiApp: 999,
  }
  let subscriptions = $state<Record<string, ConfirmedSubscription>>({})
  let openPlan = $state<keyof typeof PAYPAL_PLAN_IDS | null>(null)
  function openBuy(planKey: keyof typeof PAYPAL_PLAN_IDS) {
    openPlan = planKey
    funnel.buyDialogOpened(planKey)
  }
  function closeBuy() { openPlan = null }
  function handleSubscribe(planKey: string, data: PayPalApproveData) {
    const id = data.subscriptionID ?? data.orderID ?? ''
    if (!id) return
    const form = forms[planKey] ?? emptyForm()
    subscriptions = {
      ...subscriptions,
      [planKey]: { id, form: { ...form }, quantity: quantities[planKey] ?? 1 },
    }
    funnel.checkoutCompleted(planKey)
  }

  // ---- Volume / dev-count calculator ----------
  // Self-serve checkout via PayPal uses the published per-dev rates with
  // no discount; volume pricing is handled by sales, not by the cart.
  // The calculator just shows the running totals so teams can size their
  // seat count before clicking Buy.
  let devCount = $state(3)
  const calc = $derived.by(() => ({
    single: 599 * devCount,
    multi:  999 * devCount,
  }))
  const needsSalesContact = $derived(devCount >= 5)

  // ---- Feature comparison matrix (the AG Grid centrepiece) ----
  type FeatureRow = {
    label: string
    community: boolean | string
    proSingle: boolean | string
    proMulti:  boolean | string
    note?: string
  }
  type FeatureGroup = { category: string; rows: FeatureRow[] }

  const features: FeatureGroup[] = [
    {
      category: 'Core',
      rows: [
        { label: 'Row + column virtualization', community: true, proSingle: true, proMulti: true },
        { label: 'Row count', community: 'Unlimited', proSingle: 'Unlimited', proMulti: 'Unlimited' },
        { label: 'Column virtualization', community: true, proSingle: true, proMulti: true },
        { label: 'Sticky header + first column', community: true, proSingle: true, proMulti: true },
        { label: 'WAI-ARIA + keyboard navigation', community: true, proSingle: true, proMulti: true },
        { label: 'Right-to-left layout', community: true, proSingle: true, proMulti: true },
        { label: 'Custom cell renderers', community: true, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Sorting & Filtering',
      rows: [
        { label: 'Single + multi-column sort', community: true, proSingle: true, proMulti: true },
        { label: 'Excel-style column filters', community: true, proSingle: true, proMulti: true },
        { label: 'Filter row', community: true, proSingle: true, proMulti: true },
        { label: 'Between operator (number + date)', community: true, proSingle: true, proMulti: true },
        { label: 'Set / value-list filter', community: true, proSingle: true, proMulti: true },
        { label: 'Locale-aware text filtering', community: true, proSingle: true, proMulti: true },
        { label: 'Find-in-grid (Ctrl+F)', community: true, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Editing',
      rows: [
        { label: 'Inline cell editing', community: true, proSingle: true, proMulti: true },
        { label: 'Built-in editors (text/number/date/select/textarea/etc.)', community: true, proSingle: true, proMulti: true },
        { label: 'Custom cellEditor snippet slot', community: true, proSingle: true, proMulti: true },
        { label: 'Undo / redo stack (Ctrl+Z)', community: true, proSingle: true, proMulti: true },
        { label: 'Staged / batch editing buffer', community: false, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Selection & Clipboard',
      rows: [
        { label: 'Row selection', community: true, proSingle: true, proMulti: true },
        { label: 'Cell-range selection', community: true, proSingle: true, proMulti: true },
        { label: 'Copy / paste TSV', community: true, proSingle: true, proMulti: true },
        { label: 'Fill handle (Excel-style)', community: true, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Grouping & Hierarchy',
      rows: [
        { label: 'Row grouping + aggregation', community: true, proSingle: true, proMulti: true },
        { label: 'Tree data', community: true, proSingle: true, proMulti: true },
        { label: 'Master / detail', community: true, proSingle: true, proMulti: true },
        { label: 'Pivot table + Designer (drag-and-drop)', community: false, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Export & Print',
      rows: [
        { label: 'Excel (.xlsx) export', community: false, proSingle: true, proMulti: true },
        { label: 'PDF export', community: false, proSingle: true, proMulti: true },
        { label: 'CSV / TSV / HTML export', community: false, proSingle: true, proMulti: true },
        { label: 'Print (paginated, headers + footers)', community: false, proSingle: true, proMulti: true },
        { label: 'Theme-matched + branded exports', community: false, proSingle: true, proMulti: true },
        { label: 'Password-protected Excel export', community: false, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Import',
      rows: [
        { label: 'Excel / CSV / TSV / JSON import', community: false, proSingle: true, proMulti: true },
        { label: 'Column mapping + per-row validation', community: false, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'AI features',
      rows: [
        { label: 'Natural-language filter bar', community: false, proSingle: true, proMulti: true },
        { label: 'AI Smart Paste (free-text → typed rows)', community: false, proSingle: true, proMulti: true },
        { label: 'Smart-fill / summarise / classify', community: false, proSingle: true, proMulti: true },
        { label: 'Bring-your-own model adapter', community: false, proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Deployment',
      rows: [
        { label: 'Production applications covered', community: 'Unlimited', proSingle: '1', proMulti: 'Unlimited' },
        { label: 'Internal / dev / staging environments', community: 'Unlimited', proSingle: 'Unlimited', proMulti: 'Unlimited' },
        { label: 'Holding-company / subsidiary coverage', community: false, proSingle: false, proMulti: true },
        { label: 'License-key watermark removed', community: 'N/A', proSingle: true, proMulti: true },
        { label: 'Perpetual license (own it forever)', community: 'N/A', proSingle: true, proMulti: true },
        { label: 'Cancel anytime, keep paid-term versions', community: 'N/A', proSingle: true, proMulti: true },
      ],
    },
    {
      category: 'Support',
      rows: [
        { label: 'GitHub issues (best-effort)', community: true, proSingle: true, proMulti: true },
        { label: 'Email support (1 business day)', community: false, proSingle: true, proMulti: true },
        { label: 'Private Slack channel', community: false, proSingle: true, proMulti: true },
        { label: 'Architecture review on request', community: false, proSingle: true, proMulti: true },
        { label: 'Migration help (TanStack / AG Grid / MUI X)', community: false, proSingle: true, proMulti: true },
        { label: 'Volume + multi-year discounts', community: false, proSingle: false, proMulti: true },
      ],
    },
  ]

  // ---- FAQ (accordion) ----
  const faqs = [
    { q: 'Is sv-grid-pro free for open-source projects?',
      a: 'Yes. If your project is open-source (OSI-approved license, public repo, not a paid product), we issue a free SVPRO-OSS-... key - same feature set as the paid tier, no watermark. Email sales@jqwidgets.com with your repo URL; we typically respond within one business day. Keys are renewable annually for as long as the project stays open-source.' },
    { q: 'Is the Community tier really free for commercial use?',
      a: 'Yes. sv-grid-community is published under the MIT License - permissive, SPDX-recognised, and friendly to corporate legal review. Use it in proprietary products, fork it, redistribute it. Read the LICENSE file in the repo for the exact terms.' },
    { q: 'What is the difference between Single App and Multiple App?',
      a: 'A Single Application Developer License covers one deployed application - typically one product or one customer-facing web app. A Multiple Application Developer License covers an unlimited number of deployed apps in your organisation, including subsidiaries and sister products. Both are licensed per developer as a perpetual license that includes 1 year of updates and support and renews automatically each year (cancel anytime), where "developer" means engineers who write or modify code that imports sv-grid-pro.' },
    { q: 'What happens if I use sv-grid-pro without a license key?',
      a: 'The Pro features still work - export, import, print, the AI assistant, and the pivot helpers all run. The grid renders a small "Unlicensed sv-grid-pro" watermark in the bottom-right and the console emits a one-time notice with a link to pricing. Set a valid SVPRO-... license key via setLicenseKey() and the watermark disappears.' },
    { q: 'Do the AI features call OpenAI or Anthropic out of the box?',
      a: 'No. sv-grid-pro stays model-agnostic: you register an AIProvider adapter via setAIProvider(fn) that talks to whatever endpoint you choose - OpenAI, Anthropic, a self-hosted llama, or a server-side proxy. No keys are ever embedded in the package, and no data is sent anywhere by default. The bundled mockAIProvider returns deterministic canned shapes so demos and tests work without a real model.' },
    { q: 'Which import formats does the importer accept?',
      a: 'sv-grid-pro reads Excel (.xlsx), CSV, TSV, and JSON arrays. The importer parses the file in the browser via the same JSZip peer dependency that powers Excel export, infers a column header row, lets you map source columns to your grid columns, runs per-column validation, and surfaces row-level errors before committing. No server round-trip required.' },
    { q: 'Does the pivot table need a special pivot grid?',
      a: 'No. The pivot is built on top of the standard SvGrid using its multi-level column headers and custom-cell rendering. sv-grid-pro ships the pivot engine, the drag-and-drop Pivot Designer component, and pivot-aware sort wiring - you keep using the same headless engine you already know.' },
    { q: 'Can I trial sv-grid-pro before paying?',
      a: 'Yes. Contact us and we will issue a 14-day SVPRO-EVAL-... key that unlocks the full Pro feature set with no watermark. You can also evaluate the feature unlicensed (watermarked) for as long as you like - no time bomb, no broken functionality.' },
    { q: 'Do you offer team or volume pricing?',
      a: 'Yes - email sales@jqwidgets.com for teams of 5+ developers. Multi-year terms (2 / 3 / 5 years) carry escalating discounts. Multiple App licenses are typically the right choice once a team exceeds ~6 deployed apps. For 50+ developers, MSA / NDA / on-prem documentation, source-code escrow, a named support engineer, or government / FedRAMP requirements, see the Enterprise tier.' },
    { q: 'What is the Enterprise tier?',
      a: 'A custom, organisation-wide contract that includes everything in Multiple App plus the things large orgs need: an MSA / NDA, source-code escrow, a named support engineer, on-prem documentation, custom SLAs, multi-year (2 / 3 / 5 yr) terms, government / FedRAMP-friendly procurement, and security review. Pricing is tailored to seat count, contract length, and required deliverables - email sales@jqwidgets.com with your requirements and we will quote within one business day.' },
    { q: 'What about peer dependencies for export and import?',
      a: 'sv-grid-pro lazy-loads "jszip" for xlsx export AND xlsx import, and "pdfmake" for PDF export. CSV, TSV, HTML, JSON import, print, the AI assistant, and the pivot helpers have no extra dependencies. Install only the peers you actually use.' },
    { q: 'Is it a subscription? Can I cancel?',
      a: 'It is a perpetual license, not a rental. You buy the license once and own it forever; the yearly renewal only pays for continued updates and support, and it renews automatically until you cancel. Cancel anytime - the version you have keeps working, and you keep every version released during your paid term. You simply stop receiving new updates and support after the term you paid for.' },
    { q: 'Do my license keys expire?',
      a: 'No. Keys are perpetual: an issued key keeps working for every version of sv-grid-pro released during your paid term, forever. The automatic yearly renewal is what unlocks new versions and keeps support active. If you cancel or let it lapse, your installed version keeps working - you just stop getting new releases and support.' },
    { q: 'Is the license tied to a specific developer or a seat?',
      a: 'It is a seat license. The seat moves with the role: if a developer leaves and is replaced, the same seat transfers to the replacement. No re-purchase required.' },
  ]

  // Trusted by - anonymous-ish industry labels (no specific trademarked
  // logos required; ensures the visual rhythm without any brand-rights
  // headache).
  const TRUSTED_BY = [
    'F500 financial services',
    'Trading desks',
    'Telecom carriers',
    'Healthcare EMR',
    'Manufacturing ops',
    'Logistics fleets',
    'Public-sector portals',
    'Aerospace + defense',
  ]
</script>

<section class="mx-auto max-w-7xl px-6 pb-16 pt-12">
  <!-- Hero ------------------------------------------------------ -->
  <header class="text-center">
    <p class="text-xs font-semibold uppercase tracking-[0.18em]" style="color: var(--site-accent-2);">
      Pricing
    </p>
    <h1 class="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      Free Community. Pro for teams. Enterprise for orgs.
    </h1>
    <p class="mt-5 max-w-3xl mx-auto text-base md:text-lg" style="color: var(--site-muted);">
      The full grid is free under the <strong>MIT License</strong>. <strong>sv-grid-pro</strong>
      adds Excel / PDF / CSV export + print, Excel import, a pivot table with drag-and-drop
      designer, an AI assistant, password-protected export, and direct support.
      <strong>Buy once, keep forever - the optional yearly renewal only pays for new updates
      and support, cancel anytime.</strong> 50+ seats or MSA / NDA / on-prem / multi-year? Talk
      to sales about Enterprise.
    </p>
    <div class="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs"
      style="color: var(--site-muted);">
      <span class="inline-flex items-center gap-1.5">
        <span class="dot" style="background:#3b82f6;"></span> Perpetual license - you own it
      </span>
      <span class="sep">·</span>
      <span class="inline-flex items-center gap-1.5">
        <span class="dot" style="background:#22c55e;"></span> 1 year of updates &amp; support, auto-renewing
      </span>
      <span class="sep">·</span>
      <span class="inline-flex items-center gap-1.5">
        <span class="dot" style="background:#a855f7;"></span> Cancel anytime
      </span>
    </div>
  </header>

  <!-- Tier cards ------------------------------------------------- -->
  <div class="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
    {#each tiers as tier (tier.licenseType ?? tier.name)}
      <article
        class="relative rounded-2xl border p-7 flex flex-col"
        class:tier-highlight={tier.highlight}
        style:border-color={tier.highlight ? 'var(--site-accent)' : 'var(--sg-border)'}
        style:background={tier.highlight
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--site-accent) 10%, transparent), color-mix(in srgb, var(--site-accent-2) 6%, transparent))'
          : 'var(--sg-header-bg)'}
        style:box-shadow={tier.highlight ? '0 14px 40px color-mix(in srgb, var(--site-accent) 18%, transparent)' : 'none'}
      >
        {#if tier.ribbon}
          <div class="ribbon" style="background: var(--site-accent); color: #fff;">
            {tier.ribbon}
          </div>
        {/if}

        <h2 class="text-sm font-semibold uppercase tracking-[0.08em]"
          style="color: var(--site-muted);">
          {tier.name}
        </h2>
        {#if tier.licenseType}
          <p class="text-xs mt-1" style="color: var(--site-muted); opacity: 0.85;">
            {tier.licenseType}
          </p>
        {/if}

        <div class="mt-5 flex items-baseline gap-2">
          <span class="text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
            {tier.price}
          </span>
          <span class="text-sm" style="color: var(--site-muted);">{tier.cadence}</span>
        </div>
        <p class="mt-4 text-sm leading-relaxed" style="color: var(--site-muted);">{tier.blurb}</p>

        <div class="mt-auto pt-7">
          {#if tier.cta.kind === 'link'}
            {@const linkCta = tier.cta}
            <a
              href={linkCta.href}
              target={linkCta.href.startsWith('http') ? '_blank' : null}
              rel={linkCta.href.startsWith('http') ? 'noopener noreferrer' : null}
              class="btn btn-ghost w-full"
            >{linkCta.label}</a>
          {:else}
            {@const planKey = tier.cta.planKey}
            {@const confirmed = subscriptions[planKey]}
            {#if confirmed}
              <div class="flex flex-col gap-2">
                <span class="ok-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  License active · {confirmed.quantity} dev{confirmed.quantity === 1 ? '' : 's'}
                </span>
                <button type="button" class="btn btn-ghost w-full" onclick={() => openBuy(planKey)}>
                  View confirmation
                </button>
              </div>
            {:else}
              <button type="button"
                class={tier.highlight ? 'btn btn-primary w-full' : 'btn btn-ghost w-full'}
                onclick={() => openBuy(planKey)}>
                Buy {tier.name}
              </button>
              <p class="mt-2 text-center text-xs" style="color: var(--site-muted);">
                Pick developer count + buyer info in the next step.
              </p>
            {/if}
          {/if}
        </div>

        <!-- A short "what's in this tier" footer; the long-form list
             lives in the comparison matrix below -->
        <p class="mt-5 pt-5 text-xs"
          style="color: var(--site-muted); border-top: 1px solid var(--sg-border);">
          {#if tier.name === 'Community'}
            Full data grid, MIT license, GitHub-issue support.
          {:else if tier.licenseType?.startsWith('Single')}
            Everything in Community + Pro pack + paid support.
          {:else if tier.licenseType?.startsWith('Multiple')}
            Everything in Single App + unlimited apps + volume discounts.
          {:else}
            Everything in Multi App + MSA / NDA / escrow + named support.
          {/if}
        </p>
      </article>
    {/each}
  </div>

  <!-- "Trusted by" rhythm strip --------------------------------- -->
  <div class="trusted-by mt-12">
    <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-center mb-4"
      style="color: var(--site-muted);">
      Used in production by
    </p>
    <div class="tb-row">
      {#each TRUSTED_BY as t (t)}
        <span class="tb-chip">{t}</span>
      {/each}
    </div>
  </div>

  <!-- Seat-count sizer ------------------------------------------ -->
  <section class="mt-16 rounded-2xl border p-6 md:p-8"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <div class="md:flex md:items-center md:gap-10">
      <div class="flex-1">
        <h2 class="text-lg font-bold" style="color: var(--sg-fg);">
          What does Pro cost for our team?
        </h2>
        <p class="mt-2 text-sm" style="color: var(--site-muted);">
          Set the number of developers who'll write or modify code that imports
          <code>sv-grid-pro</code>. The totals below match what PayPal will charge at checkout.
        </p>
        <div class="mt-5">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-wider"
              style="color: var(--site-muted);">
              Developers
            </span>
            <div class="flex items-center gap-4 mt-2">
              <input type="range" min="1" max="40" bind:value={devCount} class="flex-1 calc-range" />
              <span class="text-2xl font-extrabold tabular-nums"
                style="color: var(--sg-fg);">{devCount}</span>
            </div>
          </label>
          {#if needsSalesContact}
            <a class="sales-cue mt-3"
              href="mailto:sales@jqwidgets.com?subject=sv-grid-pro%20volume%20quote&body=Hi%20jQWidgets,%0A%0AWe're%20looking%20at%20sv-grid-pro%20for%20our%20team.%0A%0ASeats:%20{devCount}%0ATier:%20%0ACompany:%20%0A%0AThanks!">
              <strong>5+ seats?</strong>
              <span>Ask sales about volume + multi-year pricing - typical discounts at 5 / 10 / 20+ seats.</span>
              <span aria-hidden="true">→</span>
            </a>
          {:else}
            <p class="mt-3 text-xs" style="color: var(--site-muted);">
              Need volume or multi-year pricing? <a class="underline"
                style="color: var(--site-accent-2);"
                href="mailto:sales@jqwidgets.com">Talk to sales</a> from 5 seats up.
            </p>
          {/if}
        </div>
      </div>

      <div class="mt-8 md:mt-0 grid grid-cols-2 gap-4 md:w-[400px]">
        <div class="calc-card">
          <p class="calc-label">Single App</p>
          <p class="calc-price">${calc.single.toLocaleString()}<span class="calc-yr">/yr</span></p>
          <p class="calc-meta">${(calc.single / devCount / 12).toFixed(0)} / dev / month</p>
          <button type="button" class="btn btn-ghost w-full mt-3"
            onclick={() => { quantities.proSingleApp = devCount; openBuy('proSingleApp') }}>
            Buy {devCount} {devCount === 1 ? 'seat' : 'seats'}
          </button>
        </div>
        <div class="calc-card highlighted">
          <p class="calc-label">Multi App</p>
          <p class="calc-price">${calc.multi.toLocaleString()}<span class="calc-yr">/yr</span></p>
          <p class="calc-meta">${(calc.multi / devCount / 12).toFixed(0)} / dev / month</p>
          <button type="button" class="btn btn-primary w-full mt-3"
            onclick={() => { quantities.proMultiApp = devCount; openBuy('proMultiApp') }}>
            Buy {devCount} {devCount === 1 ? 'seat' : 'seats'}
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- Feature comparison matrix ---------------------------------- -->
  <section class="mt-16">
    <div class="text-center mb-6">
      <h2 class="text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--sg-fg);">
        Compare every feature
      </h2>
      <p class="mt-2 text-sm" style="color: var(--site-muted);">
        Honest table. <code>✓</code> shipped today, <code>-</code> not in this tier.
      </p>
    </div>

    <div class="cmp-wrap">
      <table class="cmp-table">
        <thead>
          <tr>
            <th class="cmp-th-spacer"></th>
            <th>
              <div class="cmp-th-name">Community</div>
              <div class="cmp-th-price">$0 forever</div>
            </th>
            <th class="cmp-th-highlight">
              <div class="cmp-th-name">Pro - Single App</div>
              <div class="cmp-th-price">$599 / dev / yr</div>
            </th>
            <th>
              <div class="cmp-th-name">Pro - Multi App</div>
              <div class="cmp-th-price">$999 / dev / yr</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each features as group (group.category)}
            <tr class="cmp-cat-row">
              <td colspan="4">{group.category}</td>
            </tr>
            {#each group.rows as row (row.label)}
              <tr>
                <td class="cmp-feat">
                  {row.label}
                  {#if row.note}<span class="cmp-feat-note">{row.note}</span>{/if}
                </td>
                <td>{@render cell(row.community)}</td>
                <td class="cmp-td-highlight">{@render cell(row.proSingle)}</td>
                <td>{@render cell(row.proMulti)}</td>
              </tr>
            {/each}
          {/each}
          <tr class="cmp-cta-row">
            <td></td>
            <td>
              <a class="btn btn-ghost w-full"
                href="https://www.npmjs.com/package/sv-grid-community"
                target="_blank" rel="noopener noreferrer">npm install</a>
            </td>
            <td class="cmp-td-highlight">
              <button class="btn btn-primary w-full"
                onclick={() => openBuy('proSingleApp')}>Buy Single App</button>
            </td>
            <td>
              <button class="btn btn-ghost w-full"
                onclick={() => openBuy('proMultiApp')}>Buy Multi App</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  {#snippet cell(v: boolean | string)}
    {#if v === true}
      <span class="cmp-yes" aria-label="Included">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.6"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    {:else if v === false}
      <span class="cmp-no" aria-label="Not included">-</span>
    {:else}
      <span class="cmp-str">{v}</span>
    {/if}
  {/snippet}

  <!-- OSS lane -------------------------------------------------- -->
  <div id="oss" class="mt-16 rounded-2xl border p-6 md:p-8"
    style="border-color: var(--sg-border); background: linear-gradient(135deg, color-mix(in srgb, #4ade80 10%, transparent), color-mix(in srgb, #22d3ee 6%, transparent));">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex-1 min-w-[280px]">
        <p class="text-xs font-semibold uppercase tracking-[0.16em]"
          style="color: #16a34a;">Free for open source</p>
        <h2 class="mt-1 text-xl font-bold" style="color: var(--sg-fg);">
          sv-grid-pro is free for OSS projects
        </h2>
        <p class="mt-2 text-sm" style="color: var(--sg-fg);">
          If your project is open-source under an
          <a class="underline" style="color: var(--site-accent-2);"
            href="https://opensource.org/licenses" target="_blank" rel="noopener noreferrer">
            OSI-approved license
          </a>
          and not a paid product, you get a free <code>SVPRO-OSS-…</code> key. Same Pro feature
          set as the paid tiers, no watermark. Renewable annually.
        </p>
      </div>
      <a class="btn btn-ghost shrink-0"
        href="mailto:sales@jqwidgets.com?subject=sv-grid-pro%20OSS%20license%20request&body=Hi%20jQWidgets,%0A%0AI'd%20like%20a%20free%20sv-grid-pro%20OSS%20license%20for%20my%20open-source%20project.%0A%0ARepo%20URL:%20%0AOSS%20license:%20%0AContact%20name:%20%0AContact%20email:%20%0A%0AThanks!">
        Request OSS key →
      </a>
    </div>
  </div>

  <!-- "Which license?" decision helper --------------------------- -->
  <section class="mt-12 rounded-2xl border p-6 md:p-8"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <h2 class="text-lg font-bold" style="color: var(--sg-fg);">Which license do I need?</h2>
    <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm" style="color: var(--sg-fg);">
      <div>
        <p class="decide-key" style="color: var(--site-accent-2);">Community</p>
        <p style="color: var(--site-muted);">
          Just the core grid (sorting, filtering, grouping, virtualization, editing). No Excel /
          PDF export, no pivot. GitHub-issue support is enough.
        </p>
      </div>
      <div>
        <p class="decide-key" style="color: var(--site-accent-2);">Single Application</p>
        <p style="color: var(--site-muted);">
          You ship <strong>one</strong> production app and want export + print, Excel / CSV
          import, pivot table + designer, the AI assistant, and paid support. Most common choice
          for product teams with a single SaaS product.
        </p>
      </div>
      <div>
        <p class="decide-key" style="color: var(--site-accent-2);">Multiple Application</p>
        <p style="color: var(--site-muted);">
          You ship <strong>multiple</strong> production apps from one team or org - internal
          tools, a product suite, customer-facing apps + admin. Avoids tracking per-app coverage.
        </p>
      </div>
      <div>
        <p class="decide-key" style="color: var(--site-accent-2);">Enterprise</p>
        <p style="color: var(--site-muted);">
          You have <strong>50+ developers</strong>, security review, MSA / NDA, source-code
          escrow, named support, on-prem docs, or government / FedRAMP requirements. Talk to
          sales for a custom quote and multi-year terms.
        </p>
      </div>
    </div>
  </section>

  <!-- FAQ accordion --------------------------------------------- -->
  <section class="mt-20">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--sg-fg);">
      Pricing FAQ
    </h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">
      Can't find an answer? Email
      <a class="underline" style="color: var(--site-accent-2);"
        href="mailto:sales@jqwidgets.com">sales@jqwidgets.com</a>.
    </p>
    <div class="mt-6 grid gap-3 md:grid-cols-2">
      {#each faqs as f, i (i)}
        <details class="faq" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
          <summary>
            <span class="faq-q" style="color: var(--sg-fg);">{f.q}</span>
            <span class="faq-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.4"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </summary>
          <p class="faq-a" style="color: var(--site-muted);">{f.a}</p>
        </details>
      {/each}
    </div>
  </section>

  <!-- Bottom contact CTA strip ---------------------------------- -->
  <section class="mt-16 rounded-2xl border p-8 md:p-10 text-center"
    style="border-color: var(--site-accent);
           background: linear-gradient(135deg,
             color-mix(in srgb, var(--site-accent) 14%, transparent),
             color-mix(in srgb, var(--site-accent-2) 10%, transparent));">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--sg-fg);">
      Need a custom quote, NDA, or PO?
    </h2>
    <p class="mt-3 max-w-2xl mx-auto text-sm md:text-base" style="color: var(--site-muted);">
      Annual SaaS / on-prem deployments, government contracts, large teams (50+ seats), or
      multi-year (2 / 3 / 5 year) terms - we handle all of these. Email us and we'll send a
      quote within one business day.
    </p>
    <div class="mt-6 flex flex-wrap justify-center gap-3">
      <a class="btn btn-primary"
        href="mailto:sales@jqwidgets.com?subject=sv-grid-pro%20Custom%20quote&body=Hi%20jQWidgets,%0A%0AWe'd%20like%20a%20custom%20quote%20for%20sv-grid-pro.%0A%0ACompany:%20%0ATeam%20size:%20%0AApps%20covered:%20%0ANotes:%20%0A%0AThanks!">
        Talk to sales →
      </a>
      <a class="btn btn-ghost"
        href="mailto:sales@jqwidgets.com?subject=sv-grid-pro%20Trial%20key%20request&body=Hi%20jQWidgets,%0A%0AI'd%20like%20a%2014-day%20evaluation%20key%20for%20sv-grid-pro.%0A%0AContact%20name:%20%0ACompany:%20%0AUse%20case:%20%0A%0AThanks!">
        Request 14-day trial key
      </a>
    </div>
  </section>
</section>

<!-- Checkout modal (unchanged) -->
{#if openPlan}
  {@const planKey = openPlan}
  {@const tier = tiers.find(
    (t) => t.cta.kind === 'paypal' && t.cta.planKey === planKey,
  )!}
  <BuyDialog
    open={openPlan !== null}
    {planKey}
    pricePerDev={PRICE_PER_DEV[planKey] ?? 0}
    licenseLabel={tier.licenseType ?? tier.name}
    bind:form={forms[planKey]}
    bind:quantity={quantities[planKey]}
    confirmed={subscriptions[planKey]}
    onClose={closeBuy}
    onSubscribe={(data) => handleSubscribe(planKey, data)}
  />
{/if}

<style>
  /* Hero meta dots */
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
  .sep { opacity: 0.4; }

  /* Tier card ribbon */
  .ribbon {
    position: absolute; top: -12px; left: 24px;
    padding: 4px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .tier-highlight { transform: translateY(-4px); }
  .ok-pill {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 12px; border-radius: 8px;
    font-size: 12px; font-weight: 600;
    background: color-mix(in srgb, #4ade80 14%, transparent);
    color: #4ade80;
    border: 1px solid color-mix(in srgb, #4ade80 35%, transparent);
  }

  /* Trusted-by strip */
  .tb-row {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 10px;
  }
  .tb-chip {
    display: inline-flex; align-items: center;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--sg-border);
    background: var(--sg-header-bg);
    color: var(--site-muted);
    font-size: 11.5px; font-weight: 500;
  }

  /* Volume calculator */
  .calc-range { accent-color: var(--site-accent); height: 4px; }
  .calc-card {
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    border-radius: 12px; padding: 14px;
    display: flex; flex-direction: column;
  }
  .calc-card.highlighted {
    border-color: var(--site-accent);
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--site-accent) 8%, transparent),
      color-mix(in srgb, var(--site-accent-2) 5%, transparent));
  }
  .calc-label {
    font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--site-muted);
  }
  .sales-cue {
    display: flex; align-items: center; gap: 8px;
    margin-top: 12px; padding: 10px 14px;
    border: 1px dashed color-mix(in srgb, var(--site-accent) 40%, transparent);
    background: color-mix(in srgb, var(--site-accent) 6%, transparent);
    border-radius: 8px;
    color: var(--sg-fg); font-size: 12.5px; line-height: 1.4;
    text-decoration: none;
    transition: background 150ms;
  }
  .sales-cue:hover { background: color-mix(in srgb, var(--site-accent) 12%, transparent); }
  .sales-cue strong { color: var(--site-accent-2); white-space: nowrap; }
  .sales-cue span:last-child { margin-left: auto; color: var(--site-accent-2); font-weight: 800; }

  .calc-price {
    color: var(--sg-fg); font-size: 26px; font-weight: 800;
    font-variant-numeric: tabular-nums; line-height: 1.1; margin-top: 2px;
  }
  .calc-yr { font-size: 12px; color: var(--site-muted); font-weight: 600; margin-left: 4px; }
  .calc-meta { color: var(--site-muted); font-size: 11px; margin-top: 2px; }

  /* Comparison matrix - the AG Grid centrepiece */
  .cmp-wrap {
    overflow-x: auto;
    border: 1px solid var(--sg-border);
    border-radius: 12px;
    background: var(--sg-header-bg);
  }
  .cmp-table {
    width: 100%; min-width: 760px;
    border-collapse: separate; border-spacing: 0;
    font-size: 13px;
    color: var(--sg-fg);
  }
  .cmp-table thead th {
    position: sticky; top: 0;
    background: var(--sg-bg);
    padding: 14px 16px;
    text-align: center;
    border-bottom: 2px solid var(--sg-border);
    z-index: 2;
  }
  .cmp-table thead th.cmp-th-spacer { width: 40%; }
  .cmp-table thead th.cmp-th-highlight {
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--site-accent) 12%, var(--sg-bg)),
      var(--sg-bg));
  }
  .cmp-th-name { font-size: 13px; font-weight: 800; color: var(--sg-fg); }
  .cmp-th-price { font-size: 11px; color: var(--site-muted); margin-top: 2px; font-weight: 600; }

  .cmp-cat-row td {
    padding: 10px 16px;
    background: color-mix(in srgb, var(--site-accent) 5%, transparent);
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--site-accent-2);
    border-bottom: 1px solid var(--sg-border);
  }
  .cmp-table tbody tr:not(.cmp-cat-row):not(.cmp-cta-row) td {
    padding: 9px 16px;
    border-bottom: 1px solid var(--sg-border);
    text-align: center;
  }
  .cmp-table tbody tr:not(.cmp-cat-row):not(.cmp-cta-row) td.cmp-feat {
    text-align: left; color: var(--sg-fg); font-weight: 500;
  }
  .cmp-feat-note {
    display: block; margin-top: 2px;
    font-size: 11px; color: var(--site-muted); font-weight: 400;
  }
  .cmp-td-highlight { background: color-mix(in srgb, var(--site-accent) 6%, transparent); }

  .cmp-yes {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    background: color-mix(in srgb, #22c55e 14%, transparent);
    color: #16a34a;
  }
  .cmp-no { color: var(--site-muted); opacity: 0.5; font-weight: 600; }
  .cmp-str {
    display: inline-block; padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--site-accent) 10%, transparent);
    color: var(--site-accent-2);
    font-size: 11.5px; font-weight: 700;
  }

  .cmp-cta-row td { padding: 14px 12px; background: var(--sg-bg); }
  .cmp-cta-row td.cmp-td-highlight { background: color-mix(in srgb, var(--site-accent) 8%, transparent); }

  /* Decision helper */
  .decide-key { font-weight: 700; margin-bottom: 4px; }

  /* FAQ accordion */
  .faq {
    border: 1px solid var(--sg-border);
    border-radius: 10px; padding: 0;
    overflow: hidden;
  }
  .faq summary {
    display: flex; justify-content: space-between; align-items: center;
    list-style: none; cursor: pointer;
    padding: 14px 16px;
    user-select: none;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq-q { font-weight: 600; font-size: 14px; padding-right: 12px; flex: 1; }
  .faq-icon {
    color: var(--site-muted); transition: transform 180ms ease;
    flex-shrink: 0;
  }
  .faq[open] .faq-icon { transform: rotate(180deg); color: var(--site-accent); }
  .faq-a {
    padding: 0 16px 14px;
    font-size: 13px; line-height: 1.55;
    margin: 0;
  }
</style>
