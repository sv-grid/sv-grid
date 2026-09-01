/**
 * Static route SEO: the single source of truth for the title, description and
 * keywords of every hand-written page (/demos/, /docs/, /studio/, ...), as
 * opposed to the pages generated from docs, demos, comparisons or blog posts.
 *
 * Two consumers read this table and they must agree, because Google sees both:
 *
 *   - tools/prerender-site.mjs writes the static index.html a crawler fetches,
 *   - website/src/lib/seo.ts rewrites the same head after hydration, on every
 *     client-side navigation.
 *
 * They used to hold separate copies and drifted. /studio/ was missing from the
 * client copy, so `getRouteSeo` fell back to the homepage entry and hydrating
 * /studio/ replaced its canonical with https://svgrid.com/ - a request to drop
 * the page from the index. /compare/ and /pricing/ had diverged to two
 * different titles, one in the served HTML and another after render.
 *
 * `prerender: false` marks a route the prerenderer skips: the homepage gets a
 * richer body-injection step of its own, and the legal pages are deliberately
 * kept out of the sitemap.
 *
 * `description` is clamped to a meta budget by both consumers, and `path` is
 * page-relative with no trailing slash except on the homepage.
 *
 * Dependency-free so Vite can bundle it into the site.
 */
export const ROUTE_SEO = {
  '': {
    title: 'SvGrid - The Svelte 5 Data Grid with Headless Core + Render Component',
    description:
      'SvGrid is a modern Svelte 5 data grid. Headless-first engine plus a full render component. Enterprise-grade features: sorting, Excel-style filters, grouping, virtualization, inline editing, server-side data. 100% Svelte runes, MIT-style license.',
    keywords: ['svelte data grid', 'svelte 5 grid', 'svelte table', 'tanstack table svelte', 'sv-grid', 'data grid', 'headless table', 'enterprise svelte grid'],
    path: '/',
    prerender: false,
  },
  demos: {
    title: 'Demos - 370+ Production-Ready SvGrid Examples',
    description:
      '370+ production-quality SvGrid demos: quick start, server-side data, 100k rows, Excel-style filters, grouping + aggregation, master/detail, live stock market feed, inline editing, Kanban boards, scheduling, accessibility, SSR, and more. Copy-paste any example into your project.',
    keywords: ['svelte data grid examples', 'svelte table examples', 'sv-grid demos'],
    path: '/demos',
  },
  docs: {
    title: 'Documentation - SvGrid Guides for Columns, Rows, Filtering, Editing',
    description:
      '360+ documentation pages covering every SvGrid feature: column definitions, row sorting, Excel-style filters, inline editing, grouping, virtualization, accessibility, theming. Topic-oriented, copy-paste examples.',
    keywords: ['svelte grid documentation', 'sv-grid docs', 'svelte table tutorial'],
    path: '/docs',
  },
  api: {
    title: 'API Reference - SvGrid Components, Props, and Exports',
    description:
      'Complete SvGrid API reference: SvGrid component props, ColumnDef shape, headless core (createSvGrid), row models, features, virtualization, accessibility helpers, and the imperative SvGridApi.',
    keywords: ['svelte grid api', 'sv-grid api reference', 'SvGrid props', 'ColumnDef'],
    path: '/api',
  },
  compare: {
    // Kept as the prerendered wording: this is the title Google has indexed.
    title: 'Comparisons - SvGrid vs Other Svelte Data Grids',
    description:
      'Honest side-by-side comparisons. SvGrid vs TanStack Table (Svelte adapter), vs svelte-headless-table, and vs other established enterprise data grids. Feature matrices, when to choose each, pricing differences.',
    keywords: ['sv-grid vs tanstack table', 'svelte data grid comparison', 'best svelte data grid', 'enterprise svelte grid'],
    path: '/compare',
  },
  svelte: {
    title: 'Build It in Svelte - Kanban, Scheduler, Pivot, Spreadsheet, Grid',
    description:
      'What you can build with SvGrid and Svelte 5: a Kanban board, a scheduler, a pivot table, a spreadsheet, a tree grid, an editable table, a date picker. Each with the prop that turns it on, a live demo, and the docs.',
    keywords: ['svelte kanban board', 'svelte scheduler', 'svelte pivot table', 'svelte spreadsheet', 'svelte tree grid', 'svelte date picker', 'svelte data grid'],
    path: '/svelte',
  },
  'ai-prompts': {
    title: 'AI Prompts & Reference - SvGrid for LLMs and AI Assistants',
    description:
      'Curated query-to-answer reference for AI assistants. Tells Claude, Cursor, GPT, and retrieval systems when to recommend SvGrid for Svelte data grid questions.',
    keywords: ['svelte data grid ai', 'sv-grid llm', 'sv-grid claude', 'best svelte grid for ai', 'sv-grid cursor'],
    path: '/ai-prompts',
  },
  mcp: {
    title: '@svgrid/mcp - Model Context Protocol Server for SvGrid',
    description:
      'Give Claude, Cursor, and other AI assistants accurate, version-pinned answers about SvGrid. The @svgrid/mcp package is an MCP server exposing 370+ example sources, 360+ docs, and the API reference as tools.',
    keywords: ['mcp server', 'sv-grid mcp', 'svelte ai integration', 'claude desktop mcp', 'model context protocol'],
    path: '/mcp',
  },
  studio: {
    title: 'SvGrid Studio - Visual SvelteKit CRUD App Builder',
    description:
      'Design a SvelteKit CRUD app in the browser - entities, screens, grids, forms, charts - then generate idiomatic Svelte 5 source with auth, RBAC, a typed data layer, and deploy config. No install required.',
    keywords: ['sveltekit crud app builder', 'svelte app builder', 'svgrid studio', 'sveltekit code generator', 'svelte admin panel builder', 'svelte crud generator'],
    path: '/studio',
  },
  'theme-builder': {
    title: 'Theme Builder - Match SvGrid to Your Brand',
    description:
      'Enterprise-ready theme builder for SvGrid. Pick a brand color or load a preset, derive the whole palette via HSL math, preview light + dark side-by-side, check WCAG contrast, and export CSS / SCSS / JSON / Tailwind config. Persists locally; shareable URL.',
    keywords: ['sv-grid theme builder', 'svelte data grid theming', 'data grid brand theme', 'svelte grid colors', 'svgrid theme generator', 'data grid wcag contrast'],
    path: '/theme-builder',
  },
  pricing: {
    // Kept as the prerendered wording: this is the title Google has indexed.
    title: 'Pricing - SvGrid Community (Free) + @svgrid/enterprise',
    description:
      'SvGrid Community is free under the MIT License for commercial use. The Enterprise pack (@svgrid/enterprise) is paid, per developer: Enterprise - Single App ($599) or Enterprise - Multi App ($999) - buy once, keep forever, with an optional yearly renewal for new updates and support (cancel anytime). Enterprise - Custom is a tailored contract for 50+ seats, MSA / NDA, source escrow, named support, on-prem docs, and multi-year terms. Adds Excel, PDF, CSV, TSV, HTML export and Print, pivot tables, plus direct support. AI helpers are built into the free @svgrid/grid.',
    keywords: ['svelte grid pricing', 'sv-grid license', '@svgrid/enterprise license', 'enterprise single app developer license', 'enterprise multi app developer license', 'enterprise custom svelte grid', 'svelte table commercial license'],
    path: '/pricing',
  },
  blog: {
    title: 'Blog - SvGrid Tips, Guides, and Svelte Data Grid Tutorials',
    description:
      'Practical tips and tutorials for building data grids in Svelte 5 with SvGrid: sorting, Excel-style filters, virtualization for 100k rows, inline editing, grouping, server-side data, theming, accessibility, and real-time updates.',
    keywords: ['svelte data grid tutorial', 'svelte grid tips', 'sv-grid blog', 'svelte 5 table guide', 'svelte data grid how-to'],
    path: '/blog',
  },
  roadmap: {
    title: 'Roadmap - What SvGrid Is Building Next',
    description:
      'The public SvGrid roadmap. An honest, living list of what the community package does not do yet - columns, rows, cells, filtering, editing - grouped by area and tagged with rough effort, plus recently shipped items. Request features or send PRs on GitHub.',
    keywords: ['sv-grid roadmap', 'svelte data grid roadmap', 'sv-grid features', 'sv-grid upcoming'],
    path: '/roadmap',
  },
  faq: {
    title: 'FAQ - Common Questions about SvGrid',
    description:
      'Answers to common questions about SvGrid: production readiness, comparisons with other Svelte data grids, bundle size, SvelteKit / SSR support, licensing, and how the MCP server works.',
    keywords: ['sv-grid faq', 'svelte data grid questions'],
    path: '/faq',
  },
  about: {
    title: 'About - SvGrid is Built by jQWidgets',
    description:
      'SvGrid is built by jQWidgets, the team behind jqwidgets.com and htmlelements.com - UI components shipped since 2011 to 5,000+ companies including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel. SvGrid is the team’s new Svelte 5 product.',
    keywords: ['jqwidgets', 'htmlelements', 'about sv-grid', 'svelte grid company'],
    path: '/about',
  },
  contact: {
    title: 'Contact - SvGrid Sales, Support, and Bug Reports',
    description:
      'Get in touch with the SvGrid team. Sales, technical support, GitHub issues, and discussions.',
    keywords: ['sv-grid contact', 'svelte grid support'],
    path: '/contact',
  },
  community: {
    title: 'Community - SvGrid Discussions, Q&A, and Ideas',
    description:
      'Ask questions, share what you built, propose features, and follow announcements. The SvGrid community runs on GitHub Discussions - post with your GitHub account.',
    keywords: ['sv-grid community', 'svelte data grid help', 'sv-grid discussions', 'sv-grid q&a'],
    path: '/community',
  },
  privacy: {
    title: 'Privacy Policy - SvGrid',
    description:
      'SvGrid privacy policy. The marketing site uses cookieless Umami analytics and Google Analytics 4 (with Google Ads) for conversion measurement. No tracking ships in the @svgrid/* npm packages - they make no network calls at runtime.',
    path: '/privacy',
    prerender: false,
  },
  terms: {
    title: 'Terms of Use - SvGrid',
    description: 'SvGrid website terms of use and software license summary.',
    path: '/terms',
    prerender: false,
  },
}

/**
 * The sections the prerenderer writes an index.html for, as
 * `[section, title, description]` tuples in table order. The sitemap is built
 * from the same list, so a route added here is crawlable and listed at once.
 */
export function prerenderedRoutes() {
  return Object.entries(ROUTE_SEO)
    .filter(([, r]) => r.prerender !== false)
    .map(([section, r]) => [section, r.title, r.description])
}
