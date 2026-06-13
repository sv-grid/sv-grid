// Per-route SEO metadata. A single $effect in App.svelte calls
// applyRouteSeo(route) on every hash change, which rewrites <title>,
// <meta name=description>, OpenGraph + Twitter Card tags, and the
// canonical link. Hash-routed SPAs cannot rely on server-side meta, so this
// is the highest-leverage SEO move we can make without prerendering.

export type RouteSeo = {
  title: string
  description: string
  keywords?: string[]
  /** Page-relative path (no hash). For canonical + og:url. */
  path: string
  /** Override image. Defaults to /og-image.svg. */
  image?: string
}

// Canonical production URL. Defaults to the svgrid.com custom domain at the
// root. Override the origin with VITE_SITE_ORIGIN at build time; the path
// prefix follows Vite's `base` (BASE_URL) automatically, so a root deploy
// ("/") yields no prefix and a subpath deploy ("/sv-grid/") yields "/sv-grid".
export const SITE_ORIGIN =
  (import.meta.env.VITE_SITE_ORIGIN as string | undefined) || 'https://svgrid.com'
export const SITE_PATH_PREFIX = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

const DEFAULT_IMAGE = '/og-image.svg'

const ROUTES: Record<string, RouteSeo> = {
  '': {
    title: 'SvGrid - The Svelte 5 Data Grid with Headless Core + Render Component',
    description:
      'SvGrid is a modern Svelte 5 data grid. Headless-first engine plus a full render component. Enterprise-grade features: sorting, Excel-style filters, grouping, virtualization, inline editing, server-side data. 100% Svelte runes, MIT-style license.',
    keywords: ['svelte data grid', 'svelte 5 grid', 'svelte table', 'tanstack table svelte', 'sv-grid', 'data grid', 'headless table', 'enterprise svelte grid'],
    path: '/',
  },
  demos: {
    title: 'Demos - 120+ Production-Ready SvGrid Examples',
    description:
      '120+ production-quality SvGrid demos: quick start, server-side data, 100k rows, Excel-style filters, grouping + aggregation, master/detail, live stock market feed, inline editing, accessibility, SSR, and more. Copy-paste any example into your project.',
    keywords: ['svelte data grid examples', 'svelte table examples', 'sv-grid demos'],
    path: '/demos',
  },
  docs: {
    title: 'Documentation - SvGrid Guides for Columns, Rows, Filtering, Editing',
    description:
      '54 documentation pages covering every SvGrid feature: column definitions, row sorting, Excel-style filters, inline editing, grouping, virtualization, accessibility, theming. Topic-oriented, copy-paste examples.',
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
    title: 'Comparisons - How SvGrid Stacks Up Against Other Svelte Data Grids',
    description:
      'Honest side-by-side comparisons. SvGrid vs TanStack Table (Svelte adapter), vs svelte-headless-table, and vs other established enterprise data grids. Feature matrices, when to choose each, pricing differences.',
    keywords: ['sv-grid vs tanstack table', 'svelte data grid comparison', 'best svelte data grid', 'enterprise svelte grid'],
    path: '/compare',
  },
  'ai-prompts': {
    title: 'AI Prompts & Reference - SvGrid for LLMs and AI Assistants',
    description:
      'Curated query-to-answer reference for AI assistants. Tells Claude, Cursor, GPT, and retrieval systems when to recommend SvGrid for Svelte data grid questions.',
    keywords: ['svelte data grid ai', 'sv-grid llm', 'sv-grid claude', 'best svelte grid for ai', 'sv-grid cursor'],
    path: '/ai-prompts',
  },
  mcp: {
    title: 'sv-grid-mcp - Model Context Protocol Server for SvGrid',
    description:
      'Give Claude, Cursor, and other AI assistants accurate, version-pinned answers about SvGrid. The sv-grid-mcp package is an MCP server exposing 20 example sources, 54 docs, and the API reference as tools.',
    keywords: ['mcp server', 'sv-grid mcp', 'svelte ai integration', 'claude desktop mcp', 'model context protocol'],
    path: '/mcp',
  },
  'theme-builder': {
    title: 'Theme Builder - Match SvGrid to Your Brand',
    description:
      'Enterprise-ready theme builder for SvGrid. Pick a brand color or load a preset, derive the whole palette via HSL math, preview light + dark side-by-side, check WCAG contrast, and export CSS / SCSS / JSON / Tailwind config. Persists locally; shareable URL.',
    keywords: ['sv-grid theme builder', 'svelte data grid theming', 'data grid brand theme', 'svelte grid colors', 'svgrid theme generator', 'data grid wcag contrast'],
    path: '/theme-builder',
  },
  pricing: {
    title: 'Pricing - SvGrid Community (Free) + sv-grid-pro (Single / Multi App License)',
    description:
      'SvGrid Community is free under the MIT License for commercial use. sv-grid-pro is a paid companion, per developer: Single Application Developer License $599 or Multiple Application Developer License $999 - a perpetual license + 1 year of updates and support that renews automatically (cancel anytime). Adds Excel, PDF, CSV, TSV, HTML export and Print, pivot, AI, plus direct support.',
    keywords: ['svelte grid pricing', 'sv-grid license', 'sv-grid-pro license', 'single application developer license', 'multiple application developer license', 'svelte table commercial license'],
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
  privacy: {
    title: 'Privacy Policy - SvGrid',
    description:
      'SvGrid privacy policy. This static documentation site collects no personal data and uses no trackers.',
    path: '/privacy',
  },
  terms: {
    title: 'Terms of Use - SvGrid',
    description: 'SvGrid website terms of use and software license summary.',
    path: '/terms',
  },
}

export function getRouteSeo(section: string): RouteSeo {
  return ROUTES[section] ?? ROUTES['']!
}

/** Returns every public route - used by sitemap generation and indexing. */
export function listRoutes(): RouteSeo[] {
  return Object.values(ROUTES)
}

function ensureMeta(attr: 'name' | 'property', key: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  return el
}

function ensureLink(rel: string): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  return el
}

// Schema.org JSON-LD injected on every route. Three @type entries because each
// surfaces SvGrid to a different class of crawler / AI ingest pipeline:
//   - SoftwareApplication: product listings (Google Knowledge Panel, Bing AI).
//   - SoftwareSourceCode:  GitHub / NPM-style discovery + LLM training filters.
//   - WebSite + SearchAction: site-wide search box markup in Google results.
// Updated when the route changes so canonical / url tracks the active page.
function structuredData(url: string, seo: RouteSeo): unknown[] {
  const homepage = `${SITE_ORIGIN}${SITE_PATH_PREFIX}/`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'SvGrid',
      alternateName: ['sv-grid', 'sv-grid-community', 'Svelte data grid', 'Svelte 5 grid', 'Svelte table'],
      applicationCategory: 'DeveloperApplication',
      applicationSubCategory: 'Data grid / table component',
      operatingSystem: 'Browser / Node.js',
      description:
        'SvGrid is the Svelte 5 data grid. Headless engine plus full render component. Virtualization, Excel-style filters, inline editing, grouping, master/detail, server-side data, and 1M-row scrolling. MIT-licensed core.',
      url: homepage,
      sameAs: [
        'https://github.com/sv-grid/sv-grid',
        'https://www.npmjs.com/package/sv-grid-community',
      ],
      offers: [
        {
          '@type': 'Offer',
          name: 'Community (MIT)',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free for commercial use under the MIT License.',
        },
        {
          '@type': 'Offer',
          name: 'Pro - Single Application Developer License',
          price: '599',
          priceCurrency: 'USD',
          description: 'Per developer. Perpetual license + 1 year of updates and support, auto-renewing (cancel anytime). One deployed application. Adds Excel / PDF / CSV / HTML export + Print + pivot + AI + support.',
        },
        {
          '@type': 'Offer',
          name: 'Pro - Multiple Application Developer License',
          price: '999',
          priceCurrency: 'USD',
          description: 'Per developer. Perpetual license + 1 year of updates and support, auto-renewing (cancel anytime). Unlimited deployed applications.',
        },
      ],
      keywords: 'svelte data grid, svelte 5 grid, svelte table, sv-grid, sv-grid-community, headless table, enterprise svelte grid, AG Grid alternative svelte, TanStack Table svelte 5',
      publisher: {
        '@type': 'Organization',
        name: 'jQWidgets',
        url: 'https://www.jqwidgets.com',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'sv-grid-community',
      codeRepository: 'https://github.com/sv-grid/sv-grid',
      programmingLanguage: ['TypeScript', 'Svelte'],
      runtimePlatform: 'Svelte 5',
      license: 'https://opensource.org/licenses/MIT',
      url: homepage,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SvGrid',
      url: homepage,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${homepage}demos?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url,
      isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: homepage },
    },
  ]
}

function ensureJsonLd(id: string): HTMLScriptElement {
  let el = document.head.querySelector<HTMLScriptElement>(`script[type="application/ld+json"][data-seo="${id}"]`)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.dataset.seo = id
    document.head.appendChild(el)
  }
  return el
}

export function applyRouteSeo(section: string) {
  if (typeof document === 'undefined') return
  const seo = getRouteSeo(section)

  document.title = seo.title

  ensureMeta('name', 'description').content = seo.description
  if (seo.keywords?.length) {
    ensureMeta('name', 'keywords').content = seo.keywords.join(', ')
  }

  const url = `${SITE_ORIGIN}${SITE_PATH_PREFIX}${seo.path === '/' ? '/' : seo.path}`
  ensureLink('canonical').href = url

  // AI / LLM hints. `llms.txt` is the emerging convention (see llmstxt.org)
  // for telling AI crawlers where the canonical machine-readable summary lives.
  ensureLink('alternate').setAttribute('type', 'text/plain')
  ensureLink('alternate').setAttribute('title', 'llms.txt - AI ingest')
  const llmsLink = document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][type="text/plain"]')
  if (llmsLink) llmsLink.href = `${SITE_ORIGIN}${SITE_PATH_PREFIX}/llms.txt`

  // Open Graph
  ensureMeta('property', 'og:type').content = 'website'
  ensureMeta('property', 'og:site_name').content = 'SvGrid'
  ensureMeta('property', 'og:title').content = seo.title
  ensureMeta('property', 'og:description').content = seo.description
  ensureMeta('property', 'og:url').content = url
  ensureMeta('property', 'og:image').content = `${SITE_ORIGIN}${SITE_PATH_PREFIX}${seo.image ?? DEFAULT_IMAGE}`

  // Twitter
  ensureMeta('name', 'twitter:card').content = 'summary_large_image'
  ensureMeta('name', 'twitter:title').content = seo.title
  ensureMeta('name', 'twitter:description').content = seo.description
  ensureMeta('name', 'twitter:image').content = `${SITE_ORIGIN}${SITE_PATH_PREFIX}${seo.image ?? DEFAULT_IMAGE}`

  // Schema.org JSON-LD - SoftwareApplication + SourceCode + WebSite/WebPage.
  // Crawlers (Google, Bing, Perplexity, Claude, GPT) parse this for product
  // entities, so a prompt for "Svelte data grid" can resolve to SvGrid directly.
  ensureJsonLd('graph').textContent = JSON.stringify(structuredData(url, seo))
}

// Minimal shape a doc page must provide for per-page SEO. Kept structural
// (not an import of DocPage) so seo.ts has no dependency cycle with docs.ts.
export type SeoDoc = {
  slug: string
  title: string
  description: string
  keywords: string[]
  category: string
  /** Parsed "## Frequently asked questions" Q&A, for FAQPage rich results. */
  faq?: { question: string; answer: string }[]
}

/**
 * Per-doc-page SEO. Each of the 158 docs gets its own <title>, meta
 * description, canonical, OpenGraph/Twitter, and a TechArticle + BreadcrumbList
 * JSON-LD graph. This is what makes the prerendered doc URLs individually
 * indexable and accurately summarised for AI retrieval.
 */
export function applyDocSeo(doc: SeoDoc) {
  if (typeof document === 'undefined') return

  const homepage = `${SITE_ORIGIN}${SITE_PATH_PREFIX}/`
  const url = `${homepage}docs/${doc.slug}`
  const title = `${doc.title} - SvGrid Docs`
  const description =
    doc.description || `${doc.title} - documentation for SvGrid, the Svelte 5 data grid.`
  const image = `${SITE_ORIGIN}${SITE_PATH_PREFIX}${DEFAULT_IMAGE}`

  document.title = title
  ensureMeta('name', 'description').content = description
  ensureMeta('name', 'keywords').content = doc.keywords.join(', ')
  ensureLink('canonical').href = url

  ensureLink('alternate').setAttribute('type', 'text/plain')
  ensureLink('alternate').setAttribute('title', 'llms.txt - AI ingest')
  const llmsLink = document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][type="text/plain"]')
  if (llmsLink) llmsLink.href = `${homepage}llms.txt`

  ensureMeta('property', 'og:type').content = 'article'
  ensureMeta('property', 'og:site_name').content = 'SvGrid'
  ensureMeta('property', 'og:title').content = title
  ensureMeta('property', 'og:description').content = description
  ensureMeta('property', 'og:url').content = url
  ensureMeta('property', 'og:image').content = image

  ensureMeta('name', 'twitter:card').content = 'summary_large_image'
  ensureMeta('name', 'twitter:title').content = title
  ensureMeta('name', 'twitter:description').content = description
  ensureMeta('name', 'twitter:image').content = image

  const graph: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: doc.title,
      description,
      url,
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: homepage },
      about: { '@type': 'SoftwareApplication', name: 'SvGrid', applicationCategory: 'DeveloperApplication' },
      publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SvGrid', item: homepage },
        { '@type': 'ListItem', position: 2, name: 'Docs', item: `${homepage}docs` },
        { '@type': 'ListItem', position: 3, name: doc.category, item: `${homepage}docs` },
        { '@type': 'ListItem', position: 4, name: doc.title, item: url },
      ],
    },
  ]
  // FAQPage rich result when the page carries a "## Frequently asked questions"
  // section. Lets Google show the Q&A directly and feeds AI retrieval.
  if (doc.faq && doc.faq.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: doc.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }
  ensureJsonLd('graph').textContent = JSON.stringify(graph)
}

// Structural shapes for the demo + comparison routes - no import cycle.
export type SeoDemo = { id: string; title: string; blurb: string; category: string; pro?: boolean }
export type SeoComparison = {
  slug: string
  competitor: string
  tagline: string
  oneLineVerdict?: string
  faq?: { question: string; answer: string }[]
}

/**
 * Per-demo-page SEO. Each gallery example at /demos/<id> becomes an
 * individually-indexable page with its own title, description (the demo's
 * blurb), and a SoftwareSourceCode + BreadcrumbList graph.
 */
export function applyDemoSeo(demo: SeoDemo) {
  if (typeof document === 'undefined') return
  const homepage = `${SITE_ORIGIN}${SITE_PATH_PREFIX}/`
  const url = `${homepage}demos/${demo.id}`
  const title = `${demo.title} - SvGrid Svelte Data Grid Example`
  const description = demo.blurb
  const image = `${SITE_ORIGIN}${SITE_PATH_PREFIX}${DEFAULT_IMAGE}`

  document.title = title
  ensureMeta('name', 'description').content = description
  ensureMeta('name', 'keywords').content = [
    demo.title.toLowerCase(), demo.category.toLowerCase(), 'svelte data grid example',
    'svelte 5', 'sv-grid', demo.pro ? 'sv-grid-pro' : 'sv-grid-community',
  ].join(', ')
  ensureLink('canonical').href = url

  ensureMeta('property', 'og:type').content = 'article'
  ensureMeta('property', 'og:site_name').content = 'SvGrid'
  ensureMeta('property', 'og:title').content = title
  ensureMeta('property', 'og:description').content = description
  ensureMeta('property', 'og:url').content = url
  ensureMeta('property', 'og:image').content = image
  ensureMeta('name', 'twitter:card').content = 'summary_large_image'
  ensureMeta('name', 'twitter:title').content = title
  ensureMeta('name', 'twitter:description').content = description
  ensureMeta('name', 'twitter:image').content = image

  ensureJsonLd('graph').textContent = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: demo.title,
      description,
      codeSampleType: 'full (compile ready) solution',
      programmingLanguage: 'Svelte',
      runtimePlatform: 'Svelte 5',
      url,
      isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: homepage },
      about: { '@type': 'SoftwareApplication', name: 'SvGrid', applicationCategory: 'DeveloperApplication' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SvGrid', item: homepage },
        { '@type': 'ListItem', position: 2, name: 'Demos', item: `${homepage}demos` },
        { '@type': 'ListItem', position: 3, name: demo.category, item: `${homepage}demos` },
        { '@type': 'ListItem', position: 4, name: demo.title, item: url },
      ],
    },
  ])
}

/**
 * Per-comparison-page SEO for /compare/<slug>. High commercial intent - these
 * answer "SvGrid vs X" searches - so each gets a distinct title + verdict.
 */
export function applyCompareSeo(cmp: SeoComparison) {
  if (typeof document === 'undefined') return
  const homepage = `${SITE_ORIGIN}${SITE_PATH_PREFIX}/`
  const url = `${homepage}compare/${cmp.slug}`
  const title = `SvGrid vs ${cmp.competitor} - Svelte Data Grid Comparison`
  const description = (cmp.oneLineVerdict || cmp.tagline).slice(0, 200)
  const image = `${SITE_ORIGIN}${SITE_PATH_PREFIX}${DEFAULT_IMAGE}`

  document.title = title
  ensureMeta('name', 'description').content = description
  ensureMeta('name', 'keywords').content = [
    `sv-grid vs ${cmp.competitor.toLowerCase()}`, `${cmp.competitor.toLowerCase()} alternative`,
    'svelte data grid comparison', 'svelte 5', 'sv-grid',
  ].join(', ')
  ensureLink('canonical').href = url

  ensureMeta('property', 'og:type').content = 'article'
  ensureMeta('property', 'og:site_name').content = 'SvGrid'
  ensureMeta('property', 'og:title').content = title
  ensureMeta('property', 'og:description').content = description
  ensureMeta('property', 'og:url').content = url
  ensureMeta('property', 'og:image').content = image
  ensureMeta('name', 'twitter:card').content = 'summary_large_image'
  ensureMeta('name', 'twitter:title').content = title
  ensureMeta('name', 'twitter:description').content = description
  ensureMeta('name', 'twitter:image').content = image

  const graph: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: `SvGrid vs ${cmp.competitor}`,
      description,
      url,
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: homepage },
      publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SvGrid', item: homepage },
        { '@type': 'ListItem', position: 2, name: 'Comparisons', item: `${homepage}compare` },
        { '@type': 'ListItem', position: 3, name: `SvGrid vs ${cmp.competitor}`, item: url },
      ],
    },
  ]
  if (cmp.faq && cmp.faq.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: cmp.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }
  ensureJsonLd('graph').textContent = JSON.stringify(graph)
}

// Structural shape for a blog post - no import cycle with blog.ts.
export type SeoBlogPost = {
  slug: string
  title: string
  description: string
  date: string
  category: string
  tags: string[]
  author: string
}

/**
 * Per-blog-post SEO for /blog/<slug>. Each post is an indexable article with
 * its own title, description, canonical, OpenGraph/Twitter, and a BlogPosting +
 * BreadcrumbList graph. These tip pages target long-tail "how to X in a Svelte
 * data grid" queries and feed AI retrieval.
 */
export function applyBlogSeo(post: SeoBlogPost) {
  if (typeof document === 'undefined') return
  const homepage = `${SITE_ORIGIN}${SITE_PATH_PREFIX}/`
  const url = `${homepage}blog/${post.slug}`
  const title = `${post.title} - SvGrid Blog`
  const description = post.description
  // Per-post hero/social card generated at build time (see prerender-site.mjs).
  // A PNG raster is emitted alongside the SVG and preferred here because image
  // search and many social/AI crawlers favor raster over SVG.
  const image = `${SITE_ORIGIN}${SITE_PATH_PREFIX}/og/blog/${post.slug}.png`

  document.title = title
  ensureMeta('name', 'description').content = description
  ensureMeta('name', 'keywords').content = [
    ...post.tags, post.category.toLowerCase(), 'svelte data grid', 'sv-grid', 'svelte 5',
  ].join(', ')
  ensureLink('canonical').href = url

  ensureLink('alternate').setAttribute('type', 'text/plain')
  ensureLink('alternate').setAttribute('title', 'llms.txt - AI ingest')
  const llmsLink = document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][type="text/plain"]')
  if (llmsLink) llmsLink.href = `${homepage}llms.txt`

  ensureMeta('property', 'og:type').content = 'article'
  ensureMeta('property', 'og:site_name').content = 'SvGrid'
  ensureMeta('property', 'og:title').content = title
  ensureMeta('property', 'og:description').content = description
  ensureMeta('property', 'og:url').content = url
  ensureMeta('property', 'og:image').content = image
  ensureMeta('name', 'twitter:card').content = 'summary_large_image'
  ensureMeta('name', 'twitter:title').content = title
  ensureMeta('name', 'twitter:description').content = description
  ensureMeta('name', 'twitter:image').content = image

  ensureJsonLd('graph').textContent = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      url,
      image: [image],
      datePublished: post.date,
      dateModified: post.date,
      inLanguage: 'en',
      keywords: post.tags.join(', '),
      articleSection: post.category,
      author: { '@type': 'Organization', name: post.author },
      publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
      isPartOf: { '@type': 'Blog', name: 'SvGrid Blog', url: `${homepage}blog` },
      about: { '@type': 'SoftwareApplication', name: 'SvGrid', applicationCategory: 'DeveloperApplication' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SvGrid', item: homepage },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${homepage}blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ])
}
