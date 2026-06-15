<script lang="ts">
  // Embed real, live SvGrid instances from the gallery - not screenshots.
  // Both are lazy-mounted on scroll (see `onceVisible`) so the landing page
  // stays light and the live stock-ticker interval doesn't run off-screen.
  import StockMarket from '@demos/11-stock-market.svelte'
  import QuickStart from '@demos/01-quick-start.svelte'
  import { funnel } from '../lib/analytics'

  // The smallest complete SvGrid - the canonical minimal example from
  // docs/getting-started/2-first-grid.md. Keep the two in sync.
  const quickStartCode = `<script lang="ts">
  import { SvGrid, type ColumnDef } from 'sv-grid-community'

  const rows = [
    { firstName: 'Ada',   age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ]

  const columns: ColumnDef<{}, (typeof rows)[number]>[] = [
    { field: 'firstName', header: 'First name' },
    { field: 'age',       header: 'Age' },
    { field: 'status',    header: 'Status' },
  ]
<\/script>

<SvGrid data={rows} columns={columns} />`

  // ---- Lazy-mount helper: only render a demo once it scrolls near view ----
  function onceVisible(node: HTMLElement, cb: () => void) {
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { cb(); io.disconnect() } },
      { rootMargin: '300px' },
    )
    io.observe(node)
    return { destroy() { io.disconnect() } }
  }
  let showQuick = $state(false)
  let showStock = $state(false)

  // ---- Copy-to-clipboard for install commands ----------------------------
  let copied = $state('')
  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      copied = text
      funnel.installCopied(text.replace('npm install ', '').trim())
      setTimeout(() => { if (copied === text) copied = '' }, 1400)
    })
  }

  // ---- Headline stats (single source of truth, used across the page) ------
  const stats = [
    { n: 'Svelte 5', l: 'native runes' },
    { n: '42 KB', l: 'gzip (7.5 KB core)' },
    { n: 'MIT', l: 'free, commercial' },
    { n: '150+', l: 'live demos' },
    { n: 'MCP', l: 'AI-ready' },
  ]

  const packages = [
    {
      name: 'sv-grid-community',
      tag: 'Free · MIT',
      blurb:
        'The full data grid. Sorting, Excel-style filters, grouping, virtualization, inline editing, server-side data, master/detail, tree, WAI-ARIA. Free under the MIT License, including commercial use.',
      install: 'npm install sv-grid-community',
      cta: { label: 'View on npm', href: 'https://www.npmjs.com/package/sv-grid-community' },
    },
    {
      name: 'sv-grid-pro',
      tag: 'From $599/dev',
      blurb:
        'Companion feature pack that plugs into Community: export to Excel (xlsx), PDF, CSV, TSV, HTML, plus a paginated printable view, pivot tables, and AI helpers. Single Application ($599) or Multiple Application ($999) Developer License, per developer. Buy once, keep forever - optional yearly renewal for new updates and support, cancel anytime. Email support, private Slack, priority bug fixes.',
      install: 'npm install sv-grid-pro',
      cta: { label: 'See license tiers', href: '#/pricing' },
      highlight: true,
    },
  ]

  // ---- "How it compares" funnel into the 18 comparison pages -------------
  const compares = [
    { label: 'AG Grid', href: '#/compare/ag-grid' },
    { label: 'TanStack Table', href: '#/compare/tanstack-table' },
    { label: 'MUI X DataGrid', href: '#/compare/mui-x-datagrid' },
    { label: 'Handsontable', href: '#/compare/handsontable' },
    { label: 'svelte-headless-table', href: '#/compare/svelte-headless-table' },
  ]

  // ---- Home FAQ (also prerendered + emitted as FAQPage JSON-LD) -----------
  const homeFaqs = [
    {
      q: 'Can I build Svelte data grids for free with SvGrid?',
      a: 'Yes. The sv-grid-community package is free under the MIT License, including commercial use. No license key, no row-count cap, no enterprise upsell pop-ups.',
    },
    {
      q: 'How fast is SvGrid?',
      a: 'It renders 100,000 rows x 100 columns smoothly thanks to row + column virtualization - only the visible window is in the DOM. The headless engine has its own performance test suite tracking the row pipeline.',
    },
    {
      q: 'Can I customize the style of my data grid?',
      a: 'Yes. Re-theme via the --sg-* CSS custom properties (full Tailwind integration documented in the Tailwind guide). Custom cell renderers, header components, and editors all accept any Svelte component or snippet.',
    },
    {
      q: 'Is SvGrid compatible with my framework?',
      a: 'SvGrid is Svelte 5 only by design - it uses runes ($state / $derived / $effect) and snippets, not Svelte 4 stores, and pays no abstraction tax for cross-framework support. For React, Angular, Vue, or vanilla web components, the same team ships htmlelements.com.',
    },
    {
      q: 'Does SvGrid work with AI tools and assistants?',
      a: 'Yes. It ships an MCP (Model Context Protocol) server so Claude, Cursor, Zed, and other assistants answer accurately about the grid, plus a published llms.txt / llms-full.txt for retrieval. There are AI demos (natural-language filter, smart paste) in the gallery.',
    },
    {
      q: 'How is SvGrid different from TanStack Table?',
      a: 'SvGrid is Svelte-5-native with a built-in <SvGrid /> render component - virtualization, Excel-style filters, cell selection, and inline editing work in one prop pass. TanStack Table is multi-framework and headless-only, so you build the DOM layer yourself. See the Compare page for a side-by-side matrix.',
    },
    {
      q: 'What is the difference between sv-grid-community and sv-grid-pro?',
      a: 'sv-grid-community is the full grid: sorting, filtering, grouping, virtualization, inline editing, server-side data, master/detail, tree, accessibility. Free under the MIT License. sv-grid-pro is a paid companion that adds export (Excel, PDF, CSV, TSV, HTML), a printable view, pivot tables, and AI helpers, plus direct support.',
    },
    {
      q: 'How much does sv-grid-pro cost?',
      a: 'Two self-serve license tiers, both per developer. Single Application Developer License ($599) covers one deployed app; Multiple Application Developer License ($999) covers unlimited deployed apps in your organisation. Buy once, keep forever - the optional yearly renewal pays for new updates and support, and you can cancel anytime and keep every version released during your paid term. For 50+ seats, MSA / NDA / on-prem / multi-year terms, see the Enterprise tier on the pricing page.',
    },
  ]

  let openFaq = $state<Record<number, boolean>>({})
  function toggleFaq(i: number) { openFaq[i] = !openFaq[i] }

  // Feature cards (with icons for scannability). Each card carries a
  // "proof" deep-link into the demos gallery or docs so the claim is
  // verifiable in one click - not marketing copy. The AI-native card
  // surfaces the MCP / llms.txt story that buyers and AI assistants
  // look for.
  type FeatureCard = {
    title: string
    icon: string
    body: string
    proofs: Array<{ label: string; href: string }>
  }
  const features: FeatureCard[] = [
    { title: 'Headless or render-component',
      icon: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      body: 'Use createSvGrid for full control, or drop in the <SvGrid> component for a batteries-included experience.',
      proofs: [
        { label: 'Why headless', href: '#/docs/why-headless' },
        { label: 'Quick start',  href: '#/demos/01-quick-start' },
      ] },
    { title: 'Enterprise-grade features',
      icon: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
      body: 'Sorting, Excel-style filters, grouping, aggregation, tree, master/detail, server-side data, virtualization.',
      proofs: [
        { label: 'Sort/filter/paginate', href: '#/demos/02-sort-filter-paginate' },
        { label: 'Tree + master/detail', href: '#/demos/08-tree-and-master-detail' },
        { label: 'Server-side',          href: '#/demos/33-server-infinite' },
      ] },
    { title: 'Built for Svelte 5',
      icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
      body: 'Native runes ($state, $derived, $effect). Snippets for cell renderers. No React or Angular core underneath.',
      proofs: [
        { label: 'Reading & writing data', href: '#/docs/getting-started/3-data-and-columns' },
        { label: 'Custom cell components', href: '#/docs/help/cells/cell-components' },
      ] },
    { title: '100k × 100 dataset, smooth',
      icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
      body: 'Row + column virtualization, chunked loading, and a CSP-compliant runtime - no eval, no inline scripts.',
      proofs: [
        { label: '100k × 100 demo',  href: '#/demos/06-large-dataset' },
        { label: '1 million rows',   href: '#/demos/78-million-rows' },
        { label: 'CSP compliant',    href: '#/demos/16-csp-compliant' },
      ] },
    { title: 'Inline editing + cascade',
      icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
      body: 'Typed cell editors (text, number, checkbox, date, select) with dirty tracking, validation, and cascade formulas.',
      proofs: [
        { label: 'Inline editing',     href: '#/demos/05-inline-editing' },
        { label: 'Cascade editing',    href: '#/demos/18-cascade-editing' },
        { label: 'Editor types + slot',href: '#/demos/84-editor-types' },
      ] },
    { title: 'AI-native',
      icon: 'M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2M4 4h16v16H4zM9 9h6v6H9z',
      body: 'Bundled MCP server + llms.txt so Claude, Cursor, and Zed answer accurately. Natural-language filter and smart-paste demos included.',
      proofs: [
        { label: 'MCP server',     href: '#/docs/help/mcp-server' },
        { label: 'NL filter bar',  href: '#/demos/92-nl-filter-bar' },
        { label: 'AI Smart Paste', href: '#/demos/75-ai-smart-paste' },
      ] },
    { title: 'Accessible by default',
      icon: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 9h16M12 9v7M9 21l3-5 3 5',
      body: 'WAI-ARIA grid roles, full keyboard navigation, aria-live announcements, high-contrast focus toggle.',
      proofs: [
        { label: 'Accessibility demo',      href: '#/demos/17-accessibility' },
        { label: 'Keyboard shortcuts',      href: '#/demos/65-keyboard-shortcuts' },
        { label: 'High-contrast theme',     href: '#/demos/96-high-contrast-theme' },
      ] },
    { title: 'Tested + typed',
      icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
      body: 'A Vitest suite with mounted-component behavioral tests, Playwright E2E specs, and TypeScript strict mode. 329 published tests, not marketing.',
      proofs: [
        { label: 'Test coverage in the roadmap', href: '#/roadmap' },
        { label: 'API reference',                href: '#/docs/help/api-reference' },
      ] },
    // 9th card - rounds out the 3×3 grid. Speaks to integration breadth,
    // which a single demo can't carry on its own.
    { title: 'Integrates with anything',
      icon: 'M10 13a5 5 0 0 0 7.5 1.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-1.5l-3 3a5 5 0 0 0 7 7l1.5-1.5',
      body: 'Excel/PDF/CSV export, GraphQL + REST adapters, Chart.js + Smart.Chart live sync, Excel/CSV import, password-protected XLSX, and a sustained 600ms cell-edit-to-network roundtrip.',
      proofs: [
        { label: 'Export + Print',     href: '#/demos/21-export-and-print' },
        { label: 'GraphQL adapter',    href: '#/demos/72-graphql-adapter' },
        { label: 'Chart.js sync',      href: '#/demos/73-chartjs-sync' },
        { label: 'Excel/CSV import',   href: '#/demos/53-excel-import' },
      ] },
  ]
</script>

<!-- ---------- HERO --------------------------------------------------------- -->

<section class="relative overflow-hidden">
  <div class="hero-glow"></div>
  <div class="dot-grid absolute inset-0 opacity-50" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-7xl px-6 pt-20 pb-12 text-center">
    <div
      class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
      style="border-color: var(--site-border); background: var(--site-bg-elev); color: var(--site-muted);"
    >
      <span class="inline-block h-1.5 w-1.5 rounded-full" style="background:var(--site-brand)"></span>
      The Svelte 5 data grid · <code class="ml-1">sv-grid-community</code> <span class="opacity-50">·</span> <code>sv-grid-pro</code>
    </div>

    <h1
      class="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]"
      style="color: var(--sg-fg)"
    >
      The Svelte 5 data grid.<br />
      <span class="bg-clip-text text-transparent" style="background-image: linear-gradient(90deg, #ff8a3d, #ff3e00);">
        Headless-first. Render-ready.
      </span>
    </h1>

    <p class="mx-auto mt-6 max-w-2xl text-lg md:text-xl" style="color: var(--site-muted);">
      Virtualization, Excel-style filters, cell selection, and inline editing in one
      prop pass - not a React grid wrapped in a Svelte shim. Built for Svelte 5 runes
      from the first line, with a headless engine underneath when you need full
      control. 150+ production-quality examples.
    </p>

    <!-- Credibility stat row -->
    <div class="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
      {#each stats as s}
        <div class="text-center">
          <div class="text-xl font-extrabold leading-none" style="color: var(--sg-fg);">{s.n}</div>
          <div class="mt-1 text-[11px] uppercase tracking-wider" style="color: var(--site-muted);">{s.l}</div>
        </div>
      {/each}
    </div>

    <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
      <a href="#/docs/getting-started" class="btn btn-primary">Get started</a>
      <a href="#/demos" class="btn btn-ghost">
        Browse 150+ demos
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
      </a>
      <a href="https://github.com/sv-grid/sv-grid" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1-.02-1.95-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.23 2.78.11 3.07.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
        </svg>
        Star on GitHub
      </a>
    </div>

    <!-- Click-to-copy install commands -->
    <div class="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
      {#each ['npm install sv-grid-community', 'npm install sv-grid-pro'] as cmd}
        <button
          type="button"
          onclick={() => copy(cmd)}
          class="group inline-flex items-center gap-3 rounded-lg border px-4 py-2"
          style="border-color: var(--site-border); background: var(--site-bg-elev); color: var(--site-muted);"
          aria-label={`Copy: ${cmd}`}
        >
          <span class="kbd">npm</span>
          <code style="color: var(--site-fg)">{cmd.replace('npm install ', '')}</code>
          {#if copied === cmd}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.6"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity:.6">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</section>

<!-- ---------- QUICK START: CODE + LIVE RESULT ------------------------------ -->
<section class="mx-auto max-w-7xl px-6 pb-16">
  <div class="text-center mb-8">
    <p class="text-xs font-semibold uppercase tracking-[0.18em]" style="color: var(--site-accent-2);">Frictionless start</p>
    <h2 class="mt-2 text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--sg-fg)">A real grid in ~15 lines.</h2>
    <p class="mt-2 text-sm md:text-base" style="color: var(--site-muted);">
      No config, no providers, no wrappers. Install, pass <code>data</code> and <code>columns</code>, done - the result on the right is live.
    </p>
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="overflow-hidden rounded-xl border" style="border-color: var(--site-border); background: #0a1124;">
      <div class="flex items-center gap-2 border-b px-4 py-2" style="border-color: var(--site-border);">
        <span class="h-2.5 w-2.5 rounded-full" style="background:#ff5f57"></span>
        <span class="h-2.5 w-2.5 rounded-full" style="background:#febc2e"></span>
        <span class="h-2.5 w-2.5 rounded-full" style="background:#28c840"></span>
        <code class="ml-2 text-xs" style="color: #94a3b8;">App.svelte</code>
      </div>
      <pre class="overflow-x-auto p-4 text-xs leading-relaxed" style="color: #e2e8f0;"><code>{quickStartCode}</code></pre>
    </div>

    <div
      class="overflow-hidden rounded-xl border shadow-xl"
      style="border-color: var(--site-border); background: var(--site-bg-elev); min-height: 440px;"
      use:onceVisible={() => (showQuick = true)}
    >
      <div class="flex h-full flex-col p-4">
        {#if showQuick}<QuickStart />{:else}<div class="flex flex-1 items-center justify-center text-sm" style="color: var(--site-muted);">Loading live grid…</div>{/if}
      </div>
    </div>
  </div>
</section>

<!-- ---------- SOCIAL PROOF STRIP ------------------------------------------- -->
<section class="mx-auto max-w-7xl px-6 pb-8 -mt-4">
  <p class="text-center text-xs uppercase tracking-[0.18em] font-semibold" style="color: var(--site-muted);">
    Built by jQWidgets - UI components since 2011, trusted in production by 5,000+ companies
  </p>
  <ul class="mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-semibold" style="color: var(--site-fg); opacity: 0.85;">
    <li>Samsung</li><li class="opacity-50">·</li><li>Boeing</li><li class="opacity-50">·</li><li>NVIDIA</li>
    <li class="opacity-50">·</li><li>Microsoft</li><li class="opacity-50">·</li><li>Nokia</li><li class="opacity-50">·</li><li>Intel</li>
  </ul>
  <p class="mt-3 text-center text-xs" style="color: var(--site-muted); max-width: 48rem; margin-left: auto; margin-right: auto;">
    These companies use the team's existing UI suites (jQWidgets, htmlelements.com).
    SvGrid is a new Svelte 5 product from the same team - it inherits the engineering, not the customer list.
  </p>
</section>

<!-- ---------- LIVE DEMO ---------------------------------------------------- -->
<section class="relative mx-auto max-w-7xl px-6 pb-20">
  <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--sg-fg)">Live: a stock market feed</h2>
      <p class="mt-1 text-sm md:text-base" style="color: var(--site-muted);">
        25 symbols, 500 ms tick. Cells flash green / red on each up- and down-tick. Sorting and cell selection still work while live - try clicking a column header.
      </p>
    </div>
    <a href="#/demos/11-stock-market" class="text-sm font-medium" style="color: var(--site-accent-2);">Open in gallery →</a>
  </div>

  <div
    class="overflow-hidden rounded-xl border shadow-2xl"
    style="border-color: var(--site-border); background: var(--site-bg-elev); height: 560px;"
    use:onceVisible={() => (showStock = true)}
  >
    <div class="flex h-full flex-col p-4">
      {#if showStock}<StockMarket />{:else}<div class="flex flex-1 items-center justify-center text-sm" style="color: var(--site-muted);">Loading live demo…</div>{/if}
    </div>
  </div>
</section>

<!-- ---------- FEATURE GRID ------------------------------------------------- -->
<section class="mx-auto max-w-7xl px-6 pb-20">
  <div class="text-center mb-10">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--sg-fg)">Everything you'd expect from a serious grid.</h2>
    <p class="mt-2 text-sm md:text-base" style="color: var(--site-muted);">And the things you only get when the library is native to Svelte.</p>
  </div>

  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each features as f (f.title)}
      <div class="card flex flex-col">
        <div class="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style="background: color-mix(in oklab, var(--site-accent) 14%, transparent); color: var(--site-accent-2);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={f.icon} /></svg>
        </div>
        <h3 class="text-base font-semibold mb-1" style="color: var(--sg-fg)">{f.title}</h3>
        <p class="text-sm flex-1" style="color: var(--site-muted);">{f.body}</p>

        <!-- Per-card proof links: every claim is one click from a
             demo or docs page that backs it up. -->
        <div class="mt-4 pt-3 flex flex-wrap gap-1.5"
          style="border-top: 1px dashed color-mix(in oklab, var(--site-border) 70%, transparent);">
          <span class="proof-label">Proof:</span>
          {#each f.proofs as p (p.href)}
            <a class="proof-chip" href={p.href}>
              {p.label}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6"></path>
              </svg>
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- ---------- HOW IT COMPARES --------------------------------------------- -->
<section class="mx-auto max-w-7xl px-6 pb-20">
  <div class="rounded-2xl border p-7 md:p-9" style="border-color: var(--site-border); background: var(--sg-header-bg);">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-xl md:text-2xl font-bold tracking-tight" style="color: var(--sg-fg)">How does SvGrid compare?</h2>
        <p class="mt-1 text-sm md:text-base" style="color: var(--site-muted);">
          Honest, feature-by-feature pages against the grids you might evaluate - including where the alternative wins.
        </p>
      </div>
      <a href="#/compare" class="btn btn-ghost shrink-0">All comparisons →</a>
    </div>
    <div class="mt-5 flex flex-wrap gap-2.5">
      {#each compares as c}
        <a href={c.href} class="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium"
          style="border-color: var(--site-border); background: var(--site-bg-elev); color: var(--sg-fg);">
          SvGrid vs {c.label}
        </a>
      {/each}
    </div>
  </div>
</section>

<!-- ---------- TWO PACKAGES ------------------------------------------------- -->
<section class="mx-auto max-w-7xl px-6 pb-24">
  <div class="text-center mb-10">
    <p class="text-xs font-semibold uppercase tracking-[0.18em]" style="color: var(--site-accent-2);">Two packages</p>
    <h2 class="mt-2 text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--sg-fg)">Free Community. Paid Pro for export, pivot, AI &amp; support.</h2>
    <p class="mt-2 text-sm md:text-base" style="color: var(--site-muted);">Use one or both. Pro plugs into Community - no separate runtime.</p>
  </div>

  <div class="grid gap-5 md:grid-cols-2">
    {#each packages as p}
      <div class="relative rounded-2xl border p-7 flex flex-col"
        style:border-color={p.highlight ? 'var(--site-accent)' : 'var(--sg-border)'}
        style:background={p.highlight ? 'linear-gradient(135deg, rgba(255,90,31,0.10), rgba(245,158,11,0.05))' : 'var(--sg-header-bg)'}
        style:box-shadow={p.highlight ? '0 10px 30px rgba(255,90,31,0.12)' : 'none'}>
        <div class="flex items-center gap-3">
          <code class="text-base font-bold" style="color: var(--sg-fg);">{p.name}</code>
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style:background={p.highlight ? '#c2410c' : 'var(--sg-row-alt-bg)'}
            style:color={p.highlight ? '#fff' : 'var(--site-muted)'}>{p.tag}</span>
        </div>
        <p class="mt-3 text-sm" style="color: var(--sg-fg);">{p.blurb}</p>
        <pre class="mt-4 rounded p-3 text-xs overflow-x-auto" style="background: #0a1124; color: #e2e8f0;"><code>{p.install}</code></pre>
        <a href={p.cta.href}
          target={p.cta.href.startsWith('http') ? '_blank' : null}
          rel={p.cta.href.startsWith('http') ? 'noopener noreferrer' : null}
          class="mt-4 text-sm font-semibold" style="color: var(--site-accent-2);">{p.cta.label} →</a>
      </div>
    {/each}
  </div>
</section>

<!-- ---------- FAQ ACCORDION ------------------------------------------------ -->
<section class="mx-auto max-w-7xl px-6 pb-20">
  <header class="mb-12">
    <p class="text-xs font-semibold uppercase tracking-[0.18em]" style="color: var(--site-muted);">Svelte data grid FAQs</p>
    <h2 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">Frequently Asked Questions</h2>
    <p class="mt-3 max-w-3xl text-base md:text-lg" style="color: var(--site-muted);">
      How many rows can SvGrid handle? How fast is it? Is it free? Does it work with AI tools? Answers to the most common questions and more.
    </p>
  </header>

  <div class="grid gap-x-12 md:grid-cols-2">
    {#each homeFaqs as item, i}
      {@const isOpen = !!openFaq[i]}
      <div class="border-t" style:border-color={'var(--sg-border)'}>
        <button type="button" onclick={() => toggleFaq(i)}
          class="flex w-full items-center justify-between gap-6 py-6 text-left transition-colors" aria-expanded={isOpen}>
          <span class="text-lg font-semibold" style="color: var(--sg-fg);">{item.q}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            style:transform={isOpen ? 'rotate(90deg)' : 'rotate(0)'}
            style="transition: transform 160ms ease; color: var(--site-muted); flex-shrink: 0;">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        {#if isOpen}
          <div class="pb-6 text-sm md:text-base" style="color: var(--site-muted); max-width: 56ch;">{item.a}</div>
        {/if}
      </div>
    {/each}
    <div class="border-t" style="border-color: var(--sg-border);"></div>
    <div class="border-t" style="border-color: var(--sg-border);"></div>
  </div>
</section>

<!-- ---------- CTA STRIP ---------------------------------------------------- -->
<section class="mx-auto max-w-7xl px-6 pb-24">
  <div class="rounded-2xl border p-8 md:p-12 text-center"
    style="border-color: var(--site-border); background: linear-gradient(135deg, rgba(255,62,0,0.14), rgba(245,158,11,0.08));">
    <h2 class="text-2xl md:text-3xl font-bold" style="color: var(--sg-fg)">Ready to drop SvGrid into your app?</h2>
    <p class="mt-2 max-w-2xl mx-auto" style="color: var(--site-muted);">
      Start from one of 150+ examples - quick start, server-side data, inline editing, 100k rows, grouping, tree, master/detail, live updates, and more.
    </p>
    <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
      <a href="#/docs/getting-started" class="btn btn-primary">Get started</a>
      <a href="#/demos" class="btn btn-ghost">Browse the gallery</a>
    </div>
  </div>
</section>
