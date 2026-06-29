<script lang="ts">
  import './index.css'
  import Header from './components/Header.svelte'
  import Footer from './components/Footer.svelte'
  import LazyRoute from './components/LazyRoute.svelte'
  // Home is the default + most-visited route, so it stays statically imported
  // (no extra round-trip on first paint). Every other route is loaded on demand
  // via the ROUTES map below, so its code - and heavy deps like @svgrid/enterprise
  // (pulled by the API reference) - never lands in the entry chunk.
  import Home from './routes/Home.svelte'

  const ROUTES = {
    demos: () => import('./routes/Demos.svelte'),
    docs: () => import('./routes/Docs.svelte'),
    api: () => import('./routes/Api.svelte'),
    pricing: () => import('./routes/Pricing.svelte'),
    mcp: () => import('./routes/Mcp.svelte'),
    faq: () => import('./routes/Faq.svelte'),
    about: () => import('./routes/About.svelte'),
    privacy: () => import('./routes/Privacy.svelte'),
    terms: () => import('./routes/Terms.svelte'),
    contact: () => import('./routes/Contact.svelte'),
    compare: () => import('./routes/Compare.svelte'),
    aiPrompts: () => import('./routes/AiPrompts.svelte'),
    roadmap: () => import('./routes/Roadmap.svelte'),
    logoLab: () => import('./routes/LogoLab.svelte'),
    blog: () => import('./routes/Blog.svelte'),
    themeBuilder: () => import('./routes/ThemeBuilder.svelte'),
    community: () => import('./routes/Community.svelte'),
  }

  import { applyRouteSeo, applyDocSeo, applyDemoSeo, applyCompareSeo, applyBlogSeo } from './lib/seo'
  import { initAnalytics, trackPageview, funnel } from './lib/analytics'
  import { trackGtagPageview } from './lib/gtag'
  import { router } from './lib/router.svelte'
  import { findDoc } from './lib/docs'
  import { findDemo } from './lib/demos'
  import { findComparison } from './lib/comparisons'
  import { findPost } from './lib/blog'

  // History-based routing gives every page a real, individually-indexable URL
  // (e.g. /sv-grid/docs/help/columns/column-definitions). The router module
  // owns URL <-> route translation, a global link interceptor (so existing
  // href="#/..." markup keeps working), and legacy-hash redirects. Routes:
  //   ""              -> Home
  //   "demos"         -> Demos gallery
  //   "demos/<id>"    -> specific demo inside the gallery
  //   "docs"          -> Docs index
  //   "docs/<slug>"   -> specific doc
  //   "api"           -> API reference
  type Theme = 'light' | 'dark'
  function readTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'dark'
    const stored = localStorage.getItem('sg-theme')
    return stored === 'light' ? 'light' : 'dark'
  }

  let raw = $derived(router.route)
  let theme = $state<Theme>(readTheme())

  $effect(() => router.init())

  // Privacy-friendly analytics: no-op unless VITE_ANALYTICS_DOMAIN is set and
  // the visitor hasn't opted out via DNT/GPC. Library stays zero-telemetry.
  $effect(() => initAnalytics())

  // Write the resolved theme to <html data-theme> + persist. Both the SvGrid
  // overrides and our site palette key off this attribute.
  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('sg-theme', theme)
    } catch {
      // ignore storage errors (private mode, quota)
    }
  })

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
  }

  const route = $derived.by(() => {
    const [section, ...rest] = raw.split('/').filter(Boolean)
    return { section: section ?? '', rest: rest.join('/') }
  })

  // Marketing/content routes get a subtle warm-tinted page background so the
  // brand orange feels at home. Demos / API / Docs stay on the neutral surface
  // so the grids (which paint their own --sg-bg) are never tinted.
  const MARKETING = new Set([
    '', 'pricing', 'about', 'faq', 'contact', 'privacy', 'terms',
    'roadmap', 'compare', 'ai-prompts', 'mcp', 'logo-lab', 'blog',
    'theme-builder', 'community',
  ])
  const isMarketing = $derived(MARKETING.has(route.section))
  // App-shell routes lock the layout to the viewport: the nav + content
  // panels inside scroll independently, the page itself does not. Without
  // this, the Footer pushes the body taller than the viewport on docs /
  // demos and the browser adds a third scrollbar on top of the
  // panel-local ones. Api stays page-scrolling because its sidebar uses
  // `position: sticky` against page scroll.
  const APP_SHELL = new Set(['docs', 'demos'])
  const isAppShell = $derived(APP_SHELL.has(route.section))

  // SEO: rewrite head metadata on every route change. Doc pages get their
  // own per-page title/description/canonical + TechArticle/Breadcrumb JSON-LD
  // (derived from the doc itself); everything else uses the static route table.
  $effect(() => {
    const { section, rest } = route
    if (section === 'docs' && rest) {
      applyDocSeo(findDoc(rest.split('#')[0]!))
    } else if (section === 'demos' && rest) {
      applyDemoSeo(findDemo(rest))
    } else if (section === 'compare' && rest) {
      const cmp = findComparison(rest)
      if (cmp) applyCompareSeo(cmp)
      else applyRouteSeo(section)
    } else if (section === 'blog' && rest) {
      const post = findPost(rest)
      if (post) applyBlogSeo(post)
      else applyRouteSeo(section)
    } else {
      applyRouteSeo(section)
    }

    // Funnel instrumentation. A pageview on every route, plus the high-signal
    // consideration events resolved centrally from the route.
    trackPageview()
    // GA4 / Google Ads page_view for the same SPA navigation. The gtag in
    // index.html only fires the landing pageview - this captures every
    // history-based route change so ad conversion attribution stays accurate.
    // Runs after applyRouteSeo so document.title is already updated.
    trackGtagPageview()
    if (section === 'pricing') funnel.pricingViewed()
    else if (section === 'demos' && rest) funnel.demoViewed(rest)
    else if (section === 'compare' && rest) funnel.compareViewed(rest)
  })
</script>

<div class="flex flex-col"
  class:page-warm={isMarketing}
  class:app-shell-layout={isAppShell}
  class:min-h-screen={!isAppShell}>
  <Header active={route.section} {theme} onToggleTheme={toggleTheme} />

  <main class="flex-1 min-h-0">
    {#if route.section === ''}
      <Home />
    {:else if route.section === 'demos'}
      <LazyRoute loader={ROUTES.demos} props={{ demoId: route.rest }} />
    {:else if route.section === 'docs'}
      <LazyRoute loader={ROUTES.docs} props={{ slug: route.rest }} />
    {:else if route.section === 'api'}
      <LazyRoute loader={ROUTES.api} />
    {:else if route.section === 'pricing'}
      <LazyRoute loader={ROUTES.pricing} />
    {:else if route.section === 'mcp'}
      <LazyRoute loader={ROUTES.mcp} />
    {:else if route.section === 'faq'}
      <LazyRoute loader={ROUTES.faq} />
    {:else if route.section === 'about'}
      <LazyRoute loader={ROUTES.about} />
    {:else if route.section === 'privacy'}
      <LazyRoute loader={ROUTES.privacy} />
    {:else if route.section === 'terms'}
      <LazyRoute loader={ROUTES.terms} />
    {:else if route.section === 'contact'}
      <LazyRoute loader={ROUTES.contact} />
    {:else if route.section === 'compare'}
      <LazyRoute loader={ROUTES.compare} props={{ slug: route.rest }} />
    {:else if route.section === 'ai-prompts'}
      <LazyRoute loader={ROUTES.aiPrompts} />
    {:else if route.section === 'roadmap'}
      <LazyRoute loader={ROUTES.roadmap} />
    {:else if route.section === 'blog'}
      <LazyRoute loader={ROUTES.blog} props={{ slug: route.rest }} />
    {:else if route.section === 'community'}
      <LazyRoute loader={ROUTES.community} />
    {:else if route.section === 'logo-lab'}
      <LazyRoute loader={ROUTES.logoLab} />
    {:else if route.section === 'theme-builder'}
      <LazyRoute loader={ROUTES.themeBuilder} />
    {:else}
      <section class="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 class="text-3xl font-bold">Page not found</h1>
        <p class="mt-3 text-[color:var(--site-muted)]">
          The URL <code>#/{raw}</code> doesn't match any route.
        </p>
        <a href="#/" class="btn btn-primary mt-6">Back to home</a>
      </section>
    {/if}
  </main>

  {#if !isAppShell}
    <Footer />
  {/if}
</div>

<style>
  /* On app-shell routes (docs / demos / api) the layout is viewport-
     locked so the inner panels own the scrolling. The footer is also
     hidden - users navigate to About / Privacy / Terms for that
     content. Marketing pages keep the standard min-h-screen flow. */
  .app-shell-layout {
    height: 100vh;
    overflow: hidden;
  }
</style>
