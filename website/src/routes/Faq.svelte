<script lang="ts">
  type Item = { q: string; a: string }
  type Group = { title: string; items: Item[] }

  const groups: Group[] = [
    {
      title: 'Product',
      items: [
        {
          q: 'How does SvGrid compare to other Svelte data grids?',
          a: 'SvGrid is a Svelte-5-native data grid that covers a broad feature surface most enterprise grids charge extra for: Excel-style filters, grouping, master/detail, virtualization. The API is designed around Svelte runes ($state / $derived / $effect) and snippets rather than ported from a React or Angular library. See the Compare page for side-by-side matrices against TanStack Table, svelte-headless-table, and other established options.',
        },
        {
          q: 'Is SvGrid production-ready?',
          a: 'Yes. SvGrid is at v1.0. The example gallery covers the documented surface, and our sibling products (jQWidgets / htmlelements.com) are used in production by 5,000+ customers including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. Follow semver: minor releases are additive.',
        },
        {
          q: 'Is the library covered by tests?',
          a: 'Yes. 168 tests across 14 files. Vitest suite with mounted-component behavioral tests against the real <SvGrid /> render layer plus pure unit tests for the headless engine, virtualization, accessibility, and formatting helpers. v1.0 coverage: 92.2% lines / 90.9% statements / 82.9% functions / 82.2% branches on the measurable surface (the SvGrid render component is covered separately by 60+ behavioral mount tests because its layout / paint branches depend on real browser metrics). Full breakdown on the Testing & Quality page.',
        },
        {
          q: 'Does it support Svelte 4?',
          a: 'No. SvGrid is built on Svelte 5 runes. If you are still on Svelte 4, consider htmlelements.com (the sibling product from jQWidgets) which supports vanilla JS and any framework.',
        },
        {
          q: 'Does it work with SvelteKit / SSR?',
          a: 'Yes. Demo 19 ("Server-side rendering") demonstrates SSR with a pre-hydration snapshot. The render component is safe to render on the server; the headless engine is also SSR-safe.',
        },
        {
          q: 'How big is the bundle?',
          a: 'Measured gzipped with Svelte as an excluded peer dependency: the headless core (createSvGrid + a row model) is about 7.5 kB, and the full <SvGrid> render component - virtualization, Excel-style filters, inline editing, grouping, tree, and accessibility in one import - is about 42 kB (around 189 kB minified). The library ships as ESM; sv-grid-pro features are separate subpath imports that lazy-load.',
        },
      ],
    },
    {
      title: 'Licensing & support',
      items: [
        {
          q: 'What is the license?',
          a: 'sv-grid-community is MIT-licensed - permissive, SPDX-recognised, and friendly to corporate legal review. The paid companion package sv-grid-pro (data export + print) ships under a separate commercial license.',
        },
        {
          q: 'Do I need to pay for production use?',
          a: 'Not for the core library - sv-grid-community is MIT-licensed, free for commercial use. Pay for sv-grid-pro only if you need the export + print feature pack or paid support. Two Pro license tiers, per developer: Single Application Developer License ($599) for one deployed app, Multiple Application Developer License ($999) for unlimited apps. Each is a perpetual license that includes 1 year of updates and support and renews automatically each year (cancel anytime, keep your paid-term versions). Without a key, Pro features still work but render an "Unlicensed sv-grid-pro" watermark.',
        },
        {
          q: 'What is the difference between Single Application and Multiple Application Developer License?',
          a: 'Single Application covers one deployed production application - typically the standard pick for product teams shipping one SaaS product. Multiple Application covers an unlimited number of deployed applications in your organisation (including subsidiaries and sister products) - best for product suites, platforms, and internal-tools teams. Both are per-developer perpetual licenses that include 1 year of updates and support and renew automatically (cancel anytime); they unlock the same feature set, the difference is deployment scope.',
        },
        {
          q: 'How do I get support?',
          a: 'For Community users: open a GitHub issue. For Pro customers (Single or Multiple App): email support@jqwidgets.com - we respond within one business day. Pro customers also get a private Slack channel.',
        },
        {
          q: 'Is there a roadmap?',
          a: 'Yes - see the public Roadmap page (https://svgrid.com/roadmap). It groups what is not built yet by area (columns, rows, cells, filtering, editing) with a rough effort tag, plus a "recently shipped" track record. Request features or send PRs on GitHub.',
        },
      ],
    },
    {
      title: 'Integrating with AI',
      items: [
        {
          q: 'What is the MCP server for?',
          a: 'sv-grid-mcp gives Claude / Cursor / any MCP-capable AI tool access to the SvGrid examples and docs at runtime. That eliminates hallucinated APIs and stale answers. See the MCP page for setup.',
        },
        {
          q: 'Can I use the MCP server offline?',
          a: 'Yes. The server runs entirely on stdio with no network calls; the example sources and docs are bundled into the npm package.',
        },
      ],
    },
    {
      title: 'Company',
      items: [
        {
          q: 'Who builds SvGrid?',
          a: 'SvGrid is developed by jQWidgets - the team behind jQWidgets, htmlelements.com, and Smart UI. We have been shipping UI components since 2011 to 5,000+ customers including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel.',
        },
        {
          q: 'Where can I see other products from your team?',
          a: 'jqwidgets.com for the jQuery / Angular / React / Vue libraries, htmlelements.com for the vanilla web-components library. SvGrid is our Svelte-native effort.',
        },
        {
          q: 'Is the website itself open source?',
          a: 'Yes. The website is built with Svelte 5 + Vite + Tailwind, lives in the same monorepo as the library at website/, and is deployed to GitHub Pages on every push to main.',
        },
      ],
    },
  ]

  let open = $state<Record<string, boolean>>({})
  function toggle(key: string) {
    open[key] = !open[key]
  }

  // Inject FAQPage structured data so search engines and LLM crawlers ingest
  // the Q&A pairs directly. Mounts on enter, cleans up on leave.
  const faqJson = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((g) =>
      g.items.map((i) => ({
        '@type': 'Question',
        name: i.q,
        acceptedAnswer: { '@type': 'Answer', text: i.a },
      })),
    ),
  }
  $effect(() => {
    const id = 'faq-page-jsonld'
    let el = document.getElementById(id) as HTMLScriptElement | null
    if (!el) {
      el = document.createElement('script')
      el.id = id
      el.type = 'application/ld+json'
      document.head.appendChild(el)
    }
    el.textContent = JSON.stringify(faqJson)
    return () => {
      const e = document.getElementById(id)
      if (e) e.remove()
    }
  })
</script>

<section class="mx-auto max-w-4xl px-6 py-12">
  <header class="mb-10 text-center">
    <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
      Frequently asked questions
    </p>
    <h1 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      FAQ
    </h1>
    <p class="mt-4 max-w-2xl mx-auto text-base" style="color: var(--site-muted);">
      Don't see your question? <a class="underline" style="color: var(--site-accent-2);" href="#/contact">Contact us</a>.
    </p>
  </header>

  {#each groups as group}
    <h2 class="mt-12 mb-4 text-xl font-bold tracking-tight" style="color: var(--sg-fg);">
      {group.title}
    </h2>
    <div class="space-y-2">
      {#each group.items as item, i}
        {@const key = `${group.title}::${i}`}
        {@const isOpen = !!open[key]}
        <div class="rounded-lg border" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
          <button
            type="button"
            onclick={() => toggle(key)}
            class="flex w-full items-center justify-between gap-4 p-4 text-left"
            aria-expanded={isOpen}
          >
            <span class="font-semibold" style="color: var(--sg-fg);">{item.q}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              style:transform={isOpen ? 'rotate(90deg)' : 'rotate(0)'}
              style="transition: transform 120ms ease; color: var(--site-muted); flex-shrink: 0;"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {#if isOpen}
            <div class="px-4 pb-4 text-sm" style="color: var(--site-muted);">{item.a}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</section>
