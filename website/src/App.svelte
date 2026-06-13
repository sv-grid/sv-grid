<script lang="ts">
  import './index.css'
  import Header from './components/Header.svelte'
  import Footer from './components/Footer.svelte'
  import Home from './routes/Home.svelte'
  import Demos from './routes/Demos.svelte'
  import Docs from './routes/Docs.svelte'
  import Api from './routes/Api.svelte'
  import Pricing from './routes/Pricing.svelte'
  import Mcp from './routes/Mcp.svelte'
  import Faq from './routes/Faq.svelte'
  import About from './routes/About.svelte'
  import Privacy from './routes/Privacy.svelte'
  import Terms from './routes/Terms.svelte'
  import Contact from './routes/Contact.svelte'
  import Compare from './routes/Compare.svelte'
  import AiPrompts from './routes/AiPrompts.svelte'
  import Roadmap from './routes/Roadmap.svelte'
  import LogoLab from './routes/LogoLab.svelte'
  import Blog from './routes/Blog.svelte'
  import ThemeBuilder from './routes/ThemeBuilder.svelte'
  import { applyRouteSeo, applyDocSeo, applyDemoSeo, applyCompareSeo, applyBlogSeo } from './lib/seo'
  import { initAnalytics, trackPageview, funnel } from './lib/analytics'
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
    'theme-builder',
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
      <Demos demoId={route.rest} />
    {:else if route.section === 'docs'}
      <Docs slug={route.rest} />
    {:else if route.section === 'api'}
      <Api />
    {:else if route.section === 'pricing'}
      <Pricing />
    {:else if route.section === 'mcp'}
      <Mcp />
    {:else if route.section === 'faq'}
      <Faq />
    {:else if route.section === 'about'}
      <About />
    {:else if route.section === 'privacy'}
      <Privacy />
    {:else if route.section === 'terms'}
      <Terms />
    {:else if route.section === 'contact'}
      <Contact />
    {:else if route.section === 'compare'}
      <Compare slug={route.rest} />
    {:else if route.section === 'ai-prompts'}
      <AiPrompts />
    {:else if route.section === 'roadmap'}
      <Roadmap />
    {:else if route.section === 'blog'}
      <Blog slug={route.rest} />
    {:else if route.section === 'logo-lab'}
      <LogoLab />
    {:else if route.section === 'theme-builder'}
      <ThemeBuilder />
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
