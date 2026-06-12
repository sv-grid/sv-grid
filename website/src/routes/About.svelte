<script lang="ts">
  const products = [
    {
      name: 'jQWidgets',
      url: 'https://www.jqwidgets.com',
      blurb:
        'The original UI toolkit - 80+ widgets across jQuery, Angular, React, Vue, and Web Components. Shipping since 2011.',
    },
    {
      name: 'HTMLElements',
      url: 'https://www.htmlelements.com',
      blurb:
        'Framework-agnostic web components. Drop them into anything that runs HTML - in production at thousands of companies worldwide.',
    },
    {
      name: 'SvGrid',
      url: 'https://github.com/sv-grid/sv-grid',
      blurb:
        'Our Svelte-5-native data grid. Headless engine plus a full render component. The library you are looking at.',
    },
  ]
</script>

<section class="mx-auto max-w-4xl px-6 py-12">
  <header class="mb-12 text-center">
    <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
      About
    </p>
    <h1 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      Built by jQWidgets
    </h1>
    <p class="mt-4 max-w-2xl mx-auto text-base md:text-lg" style="color: var(--site-muted);">
      SvGrid is a product of <a class="underline" style="color: var(--site-accent-2);" href="https://www.jqwidgets.com" target="_blank" rel="noopener noreferrer">jQWidgets</a>,
      the team behind <a class="underline" style="color: var(--site-accent-2);" href="https://www.htmlelements.com" target="_blank" rel="noopener noreferrer">htmlelements.com</a>
      and a portfolio of UI libraries used by 5,000+ customers, including Samsung, Boeing, NVIDIA,
      Microsoft, Nokia, and Intel.
    </p>
  </header>

  <article class="mb-12">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Our story</h2>
    <div class="mt-3 space-y-4 text-base" style="color: var(--sg-fg);">
      <p>
        jQWidgets shipped its first widget in 2011 when jQuery was the web's default. Since then we
        have built data grids, gauges, scheduler controls, charts, and form components for every
        framework cycle - jQuery, Angular, React, Vue, and most recently the native Web Components
        platform that powers <a class="underline" style="color: var(--site-accent-2);" href="https://www.htmlelements.com" target="_blank" rel="noopener noreferrer">htmlelements.com</a>.
      </p>
      <p>
        Our components run in production at <strong>more than 5,000 companies</strong>, including
        Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. Charts, grids, gauges, schedulers, and
        form components ship daily inside enterprise dashboards, internal tools, and customer-facing
        web apps that real people rely on. We take "production-ready" seriously.
      </p>
      <p>
        SvGrid is our answer to a simple question: what would a data grid look like if it were
        written for Svelte 5 from day one, instead of being ported from React conventions?
      </p>
    </div>
  </article>

  <article class="mb-12">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Our products</h2>
    <div class="mt-6 grid gap-4 md:grid-cols-3">
      {#each products as p}
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-lg border p-5 transition-colors"
          style="border-color: var(--sg-border); background: var(--sg-header-bg); color: var(--sg-fg); text-decoration: none;"
        >
          <h3 class="text-lg font-semibold">{p.name}</h3>
          <p class="mt-2 text-sm" style="color: var(--site-muted);">{p.blurb}</p>
          <span class="mt-3 inline-block text-sm" style="color: var(--site-accent-2);">Visit →</span>
        </a>
      {/each}
    </div>
  </article>

  <article class="mb-12">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Engineering quality</h2>
    <p class="mt-3 text-base" style="color: var(--sg-fg);">
      SvGrid ships with a real Vitest suite that covers the headless engine, the render component,
      virtualization, accessibility helpers, and the imperative API. We mount the real
      <code>&lt;SvGrid /&gt;</code> component in jsdom for behavioral tests so the asserts match
      what a user actually sees. TypeScript runs in strict mode across both packages.
    </p>
    <p class="mt-3 text-base" style="color: var(--sg-fg);">
      Current coverage at v1.0: <strong>92.2% lines / 90.9% statements</strong> on the
      measurable surface (168 tests across 14 files). The render component
      (<code>&lt;SvGrid /&gt;</code>) is covered separately by 60+ behavioral mount tests because
      its layout / paint branches depend on real browser metrics that jsdom doesn't expose.
      Full breakdown on the
      <a class="underline" style="color: var(--site-accent-2);" href="#/docs/help/testing-and-quality">Testing &amp; Quality</a>
      docs page - we publish the real numbers, not a marketing one.
    </p>
  </article>

  <article class="mb-12">
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Built with</h2>
    <p class="mt-3 text-base" style="color: var(--sg-fg);">
      This website is built with <a class="underline" style="color: var(--site-accent-2);" href="https://svelte.dev" target="_blank" rel="noopener noreferrer">Svelte 5</a>,
      <a class="underline" style="color: var(--site-accent-2);" href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">Vite</a>,
      and <a class="underline" style="color: var(--site-accent-2);" href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer">Tailwind CSS</a> -
      the same toolchain you would use to build an app on top of SvGrid. The source lives in the
      <code>website/</code> folder of the
      <a class="underline" style="color: var(--site-accent-2);" href="https://github.com/sv-grid/sv-grid" target="_blank" rel="noopener noreferrer">SvGrid monorepo</a>
      and is deployed to GitHub Pages on every push to main.
    </p>
  </article>

  <article>
    <h2 class="text-2xl font-bold tracking-tight" style="color: var(--sg-fg);">Get in touch</h2>
    <p class="mt-3 text-base" style="color: var(--sg-fg);">
      Press, partnerships, hiring, or just a question?
      <a class="underline" style="color: var(--site-accent-2);" href="#/contact">Contact us</a>.
    </p>
  </article>
</section>
