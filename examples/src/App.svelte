<script lang="ts">
  import { demos, demoGroups, findDemo, landingDemo, isEnterpriseCategory, isEditorCategory } from './shared/registry'
  import SourceModal from './shared/SourceModal.svelte'
  import './index.css'

  function readHash(): string {
    return typeof window === 'undefined' ? '' : window.location.hash.replace(/^#\/?/, '')
  }

  type Theme = 'light' | 'dark'
  function readTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'dark'
    const stored = localStorage.getItem('sg-theme')
    return stored === 'light' ? 'light' : 'dark'
  }

  type Preset =
    | 'default' | 'ember'
    | 'shadcn' | 'tailwind' | 'material'
    | 'excel' | 'fluent'
    | 'carbon' | 'sap' | 'salesforce' | 'atlassian' | 'github' | 'antd'
    | 'ag-alpine'
    | 'bootstrap' | 'vercel' | 'linear' | 'notion'
    | 'nord' | 'dracula' | 'catppuccin'
  type PresetGroup = { label: string; presets: { id: Preset; label: string }[] }
  const PRESET_GROUPS: PresetGroup[] = [
    {
      label: 'SvGrid',
      presets: [
        { id: 'ember', label: 'Ember (signature)' },
      ],
    },
    {
      label: 'Modern design systems',
      presets: [
        { id: 'default',  label: 'Default'  },
        { id: 'shadcn',   label: 'shadcn'   },
        { id: 'tailwind', label: 'Tailwind' },
        { id: 'material', label: 'Material' },
      ],
    },
    {
      label: 'Microsoft',
      presets: [
        { id: 'excel',  label: 'Excel'  },
        { id: 'fluent', label: 'Fluent' },
      ],
    },
    {
      label: 'Enterprise',
      presets: [
        { id: 'carbon',     label: 'IBM Carbon'        },
        { id: 'sap',        label: 'SAP Fiori'         },
        { id: 'salesforce', label: 'Salesforce'        },
        { id: 'atlassian',  label: 'Atlassian'         },
        { id: 'github',     label: 'GitHub Primer'     },
        { id: 'antd',       label: 'Ant Design'        },
      ],
    },
    {
      label: 'Grid look-alikes',
      presets: [
        { id: 'ag-alpine', label: 'Alpine' },
      ],
    },
    {
      label: 'Product & startups',
      presets: [
        { id: 'bootstrap', label: 'Bootstrap 5' },
        { id: 'vercel',    label: 'Vercel'      },
        { id: 'linear',    label: 'Linear'      },
        { id: 'notion',    label: 'Notion'      },
      ],
    },
    {
      label: 'Editor themes',
      presets: [
        { id: 'nord',       label: 'Nord'       },
        { id: 'dracula',    label: 'Dracula'    },
        { id: 'catppuccin', label: 'Catppuccin' },
      ],
    },
  ]
  const PRESETS: { id: Preset; label: string }[] =
    PRESET_GROUPS.flatMap((g) => g.presets)
  // Ember (the house theme) is the starting point here and on the website, so
  // the standalone gallery and svgrid.com open on the same look.
  function readPreset(): Preset {
    if (typeof localStorage === 'undefined') return 'ember'
    const stored = localStorage.getItem('sg-preset')
    return (PRESETS.some((p) => p.id === stored) ? stored : 'ember') as Preset
  }

  let route = $state(readHash() || landingDemo.id)
  let theme = $state<Theme>(readTheme())
  let preset = $state<Preset>(readPreset())

  $effect(() => {
    const onHash = () => (route = readHash() || landingDemo.id)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  })

  // Write the theme to <html data-theme> and persist it. Tailwind's `dark:`
  // modifier follows this attribute via the @custom-variant rule in index.css.
  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('sg-theme', theme)
    } catch {
      // ignore storage errors (private mode, quota)
    }
  })

  // Theme preset (shadcn / Excel / Fluent / Material). `default` is a real
  // preset too (themes/default.css - the cool slate palette), so it declares
  // its own tokens rather than inheriting whatever shell hosts the gallery.
  $effect(() => {
    document.documentElement.setAttribute('data-preset', preset)
    try {
      localStorage.setItem('sg-preset', preset)
    } catch {
      /* ignore */
    }
  })

  const current = $derived(findDemo(route))
  const Current = $derived(current.component)

  function go(id: string) {
    window.location.hash = `/${id}`
  }

  // ---- Product switcher: SvGrid / SvGrid Studio / SvGrid Editors --------
  // Studio (data-app builder) and Editors (standalone UI components that double
  // as grid cell editors) are distinct products, so the header switches between
  // them and the gallery scopes to one at a time. `product` follows the open
  // demo, so deep-linking scopes correctly.
  type Product = 'grid' | 'studio' | 'editors'
  const STUDIO_CATEGORY = 'Studio'
  // The Studio lane also carries the grid-powered CRUD app showcases (the
  // "Industry Templates"), which are exactly "grid-powered CRUD screens".
  const STUDIO_CATEGORIES = new Set(['Studio', 'Industry Templates'])
  // Land on the Studio overview (not the visual designer, which auto-fullscreens
  // and would hide the sidebar the switcher lives in).
  const STUDIO_LANDING = '192-data-app-studio'
  const EDITORS_LANDING = '250-calendar'
  const productOf = (cat: string): Product =>
    STUDIO_CATEGORIES.has(cat) ? 'studio' : isEditorCategory(cat as never) ? 'editors' : 'grid'
  const product = $derived<Product>(productOf(current.category))
  const inProduct = (cat: string) => productOf(cat) === product
  const visibleGroups = $derived(demoGroups.filter((g) => inProduct(g.category)))
  const scopedDemos = $derived(demos.filter((d) => inProduct(d.category)))
  const gridLanding = demoGroups.find((g) => productOf(g.category) === 'grid')?.demos[0]?.id ?? demos[0]!.id
  const studioCount = demos.filter((d) => productOf(d.category) === 'studio').length
  const editorsCount = demos.filter((d) => productOf(d.category) === 'editors').length
  const gridCount = demos.length - studioCount - editorsCount

  let productMenu = $state(false)
  function selectProduct(p: Product) {
    productMenu = false
    if (p === product) return
    go(p === 'studio' ? STUDIO_LANDING : p === 'editors' ? EDITORS_LANDING : gridLanding)
  }
  const productName = (p: Product) => (p === 'studio' ? 'SvGrid Studio' : p === 'editors' ? 'SvGrid Editors' : 'SvGrid')
  const productSub = (p: Product) => (p === 'studio' ? 'Data-app builder' : p === 'editors' ? 'UI components & editors' : 'Examples gallery')
  // Close the product menu on an outside click / Escape.
  $effect(() => {
    if (!productMenu) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest('.product-switch')) productMenu = false
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') productMenu = false }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  })

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
  }

  let showSource = $state(false)
  // Full-screen mode: hide the sidebar + demo header so a demo owns the whole
  // viewport. Auto-on for the visual designer (it's a tool, not a boxed demo);
  // any demo can toggle it. Re-derives on demo change, so leaving the designer
  // restores the normal chrome.
  let fullscreen = $state(false)
  $effect(() => {
    fullscreen = current.id === '201-studio-designer'
  })

  // Mobile: the sidebar becomes an off-canvas drawer (see the .demo-sidebar
  // media query). Opening a demo closes it so the demo gets the full width.
  let mobileNavOpen = $state(false)
  $effect(() => {
    current.id // close the drawer whenever the selected demo changes
    mobileNavOpen = false
  })

  // ---- Smart demo search -------------------------------------------------
  // Matches across title, blurb, category, and id. Scores each demo so a
  // title hit beats a blurb-deep mention; multi-token queries treat each
  // whitespace-separated word as an AND (all must match, anywhere). Returns
  // a flat ranked list across categories so users see the best results
  // first instead of hunting through groups.
  let query = $state('')
  let searchEl = $state<HTMLInputElement | null>(null)

  function tokens(q: string): string[] {
    return q.toLowerCase().split(/\s+/).filter(Boolean)
  }

  function scoreDemo(d: typeof demos[number], toks: string[]): number {
    if (toks.length === 0) return 0
    const title = d.title.toLowerCase()
    const blurb = d.blurb.toLowerCase()
    const category = d.category.toLowerCase()
    const id = d.id.toLowerCase()
    let total = 0
    for (const tok of toks) {
      let s = 0
      if (title.startsWith(tok)) s += 60
      else if (title.includes(' ' + tok) || title.includes('-' + tok)) s += 45
      else if (title.includes(tok)) s += 30
      if (id.includes(tok)) s += 18
      if (category.includes(tok)) s += 12
      if (blurb.includes(tok)) s += 8
      // All tokens must hit somewhere; otherwise the whole demo is out.
      if (s === 0) return -1
      total += s
    }
    return total
  }

  const searchResults = $derived.by(() => {
    const toks = tokens(query)
    if (toks.length === 0) return null
    return scopedDemos
      .map((d) => ({ demo: d, score: scoreDemo(d, toks) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.demo)
  })

  function highlight(text: string, toks: string[]): string {
    if (toks.length === 0) return text
    const pattern = toks
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|')
    const re = new RegExp(`(${pattern})`, 'gi')
    return text.replace(re, '<mark class="demo-search-hit">$1</mark>')
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      query = ''
      searchEl?.blur()
    } else if (e.key === 'Enter' && searchResults && searchResults.length > 0) {
      e.preventDefault()
      go(searchResults[0]!.id)
    }
  }

  // Global `/` shortcut to focus the search.
  $effect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      searchEl?.focus()
      searchEl?.select()
    }
    window.addEventListener('keydown', onGlobalKey)
    return () => window.removeEventListener('keydown', onGlobalKey)
  })

  // ---- Collapsible sidebar groups ---------------------------------------
  // Mirrors how DevExpress / Kendo / Syncfusion structure their demo sites:
  // every category collapses; only the section holding the currently-open
  // demo (and "Getting Started") expands by default. Persists across reloads.
  function loadOpenGroups(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem('sg-demo-groups')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return {}
  }
  let openGroups = $state<Record<string, boolean>>(loadOpenGroups())

  // Auto-expand the group containing the active demo on first hit, so
  // landing on a deep-linked demo doesn't leave the sidebar collapsed.
  $effect(() => {
    const cat = current.category
    if (!(cat in openGroups)) {
      openGroups = { ...openGroups, [cat]: true, 'Getting Started': true }
    }
  })
  $effect(() => {
    try { localStorage.setItem('sg-demo-groups', JSON.stringify(openGroups)) } catch { /* ignore */ }
  })

  function toggleGroup(cat: string) {
    openGroups = { ...openGroups, [cat]: !(openGroups[cat] ?? false) }
  }

  // ---- Live GitHub star count -------------------------------------------
  // Fetched once, cached in localStorage for 6h so we stay well under the
  // unauthenticated GitHub API limit (60/hr per IP). If the fetch fails the
  // count is simply hidden and the link still works.
  const GH_REPO = 'sv-grid/sv-grid'
  let stars = $state<number | null>(null)

  function formatStars(n: number): string {
    if (n < 1000) return String(n)
    const k = n / 1000
    return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'k'
  }

  $effect(() => {
    const KEY = 'sg-gh-stars'
    const TTL = 6 * 60 * 60 * 1000
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const { n, t } = JSON.parse(raw)
        if (typeof n === 'number' && Date.now() - t < TTL) {
          stars = n
          return
        }
      }
    } catch { /* ignore */ }
    fetch(`https://api.github.com/repos/${GH_REPO}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.stargazers_count === 'number') {
          stars = d.stargazers_count
          try { localStorage.setItem(KEY, JSON.stringify({ n: stars, t: Date.now() })) } catch { /* ignore */ }
        }
      })
      .catch(() => { /* offline / rate-limited: leave count hidden */ })
  })
</script>

<div class="demo-page flex h-screen">
  {#if !fullscreen && mobileNavOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="demo-backdrop" onclick={() => (mobileNavOpen = false)}></div>
  {/if}
  {#if !fullscreen}
  <aside class="demo-sidebar w-72 shrink-0 border-r border-slate-200 dark:border-slate-700 p-4 overflow-y-auto" class:is-open={mobileNavOpen}>
    <div class="mb-6 flex items-center justify-between">
      <div class="product-switch relative">
        <button
          type="button"
          onclick={() => (productMenu = !productMenu)}
          aria-haspopup="menu"
          aria-expanded={productMenu}
          class="flex items-center gap-1.5 rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <h1 class="text-lg font-semibold leading-none">{productName(product)}</h1>
          <svg class="product-chev {productMenu ? 'is-open' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{productSub(product)}</p>
        {#if productMenu}
          <div role="menu" class="product-menu absolute left-0 top-full mt-1 z-30 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
            {#each [{ id: 'grid', name: 'SvGrid', sub: 'Grid examples', n: gridCount }, { id: 'studio', name: 'SvGrid Studio', sub: 'Data-app builder', n: studioCount }, { id: 'editors', name: 'SvGrid Editors', sub: 'UI components & editors', n: editorsCount }] as opt (opt.id)}
              <button
                type="button"
                role="menuitem"
                onclick={() => selectProduct(opt.id as Product)}
                class="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors {product === opt.id ? 'bg-slate-50 dark:bg-slate-800/60' : ''}"
              >
                <span class="flex-1 min-w-0">
                  <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">{opt.name}</span>
                  <span class="block text-[11px] text-slate-500 dark:text-slate-400">{opt.sub} · {opt.n}</span>
                </span>
                {#if product === opt.id}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button
        type="button"
        onclick={toggleTheme}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        {#if theme === 'dark'}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m4.93 19.07 1.41-1.41" />
            <path d="m17.66 6.34 1.41-1.41" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        {/if}
      </button>
    </div>

    <label class="preset-row mb-4 flex items-center justify-between gap-2 text-xs">
      <span class="text-slate-500 dark:text-slate-400">Theme</span>
      <select
        class="preset-select rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-2 py-1"
        value={preset}
        onchange={(e) => (preset = (e.currentTarget as HTMLSelectElement).value as Preset)}
        aria-label="Theme preset"
      >
        {#each PRESET_GROUPS as group (group.label)}
          <optgroup label={group.label}>
            {#each group.presets as p (p.id)}
              <option value={p.id}>{p.label}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>

    <div class="demo-search-wrap mb-4">
      <svg class="demo-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        bind:this={searchEl}
        bind:value={query}
        type="search"
        placeholder="Search demos…"
        aria-label="Search demos"
        class="demo-search-input"
        onkeydown={onSearchKey}
      />
      {#if query}
        <button type="button" class="demo-search-clear" aria-label="Clear search" onclick={() => (query = '')}>×</button>
      {:else}
        <kbd class="demo-search-kbd" aria-hidden="true">/</kbd>
      {/if}
    </div>

    <nav aria-label="Examples">
      {#if searchResults !== null}
        {@const toks = tokens(query)}
        <div class="mb-2 px-2 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {#if searchResults.length === 0}
            No matches
          {:else}
            {searchResults.length} match{searchResults.length === 1 ? '' : 'es'}
            <span class="text-slate-400 dark:text-slate-500 normal-case tracking-normal"> · Enter to open top hit</span>
          {/if}
        </div>
        {#if searchResults.length === 0}
          <p class="px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
            Nothing matches <em>"{query}"</em>. Try a feature ("pivot", "tree", "export") or an industry ("CRM", "healthcare").
          </p>
        {:else}
          <ul class="space-y-0.5">
            {#each searchResults as demo (demo.id)}
              {@const active = demo.id === current.id}
              <li>
                <button
                  type="button"
                  onclick={() => go(demo.id)}
                  class="demo-row w-full text-left rounded px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 {active ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}"
                >
                  <span class="demo-row-title">
                    {@html highlight(demo.title, toks)}
                    {#if demo.pro}<span class="demo-pro-dot" title="Enterprise feature" aria-label="Enterprise"></span>{/if}
                  </span>
                  <span class="demo-row-cat">{demo.category}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        {#each visibleGroups as group (group.category)}
          {@const isOpen = openGroups[group.category] ?? false}
          <div class="mb-1">
            <button
              type="button"
              onclick={() => toggleGroup(group.category)}
              aria-expanded={isOpen}
              class="demo-group-head w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded"
            >
              <svg class="demo-group-chev {isOpen ? 'is-open' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 6 15 12 9 18" />
              </svg>
              <span class="flex-1 text-left">{group.category}</span>
              {#if isEnterpriseCategory(group.category)}
                <span class="demo-group-pro-badge">Enterprise</span>
              {/if}
              <span class="demo-group-count">{group.demos.length}</span>
            </button>
            {#if isOpen}
              <ul class="space-y-0.5 pb-2">
                {#each group.demos as demo (demo.id)}
                  {@const active = demo.id === current.id}
                  <li>
                    <button
                      type="button"
                      onclick={() => go(demo.id)}
                      class="demo-leaf w-full text-left rounded pl-6 pr-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 {active ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}"
                    >
                      <span class="demo-leaf-title">{demo.title}</span>
                      {#if demo.pro}<span class="demo-pro-dot" title="Enterprise feature" aria-label="Enterprise"></span>{/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      {/if}
    </nav>
    <p class="mt-8 text-xs text-slate-500 dark:text-slate-400">
      Each demo is a single .svelte file under <code>src/demos/</code>. Read the source
      alongside the running app - it is what you would copy into your own project.
    </p>

    <a
      class="gh-star mt-4 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400"
      href="https://github.com/sv-grid/sv-grid"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg class="gh-star-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span class="flex-1">If SvGrid is useful, star it on GitHub</span>
      {#if stars !== null}
        <span class="gh-star-count">{formatStars(stars)}</span>
      {/if}
    </a>
  </aside>
  {/if}

  <main class="flex flex-col flex-1 overflow-x-hidden min-h-0" class:p-6={!fullscreen}>
    {#if !fullscreen}
    <header class="mb-5 flex shrink-0 items-start justify-between gap-4">
      <div class="flex items-start gap-2 min-w-0">
        <button
          type="button"
          onclick={() => (mobileNavOpen = true)}
          class="demo-hamburger md:hidden mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div class="min-w-0">
          <h2 class="text-2xl font-semibold">{current.title}</h2>
          <p class="text-slate-600 dark:text-slate-300">{current.blurb}</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onclick={() => (fullscreen = true)}
          class="hidden md:inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          title="Full screen (hide sidebar)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
          Full screen
        </button>
        <button
          type="button"
          onclick={() => (showSource = true)}
          class="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Source
        </button>
      </div>
    </header>
    {/if}
    <div class="flex flex-col flex-1 min-h-0 relative">
      {#if fullscreen}
        <button
          type="button"
          onclick={() => (fullscreen = false)}
          class="absolute right-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-2.5 py-1.5 text-sm shadow-sm backdrop-blur hover:bg-white dark:border-slate-600 dark:bg-slate-900/90 dark:hover:bg-slate-900"
          title="Exit full screen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M3 15v4a2 2 0 0 0 2 2h4" />
          </svg>
          Exit
        </button>
      {/if}
      {#key current.id}
        <Current />
      {/key}
    </div>
  </main>
</div>

{#if showSource}
  <SourceModal
    title={current.title}
    source={current.source}
    onClose={() => (showSource = false)}
  />
{/if}

<style>
  /* Mobile: the sidebar slides in as an off-canvas drawer over the demo. */
  @media (max-width: 767px) {
    .demo-sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 40;
      width: 85vw;
      max-width: 320px;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      background: var(--sg-bg, #fff);
    }
    :global(.dark) .demo-sidebar {
      background: #0f172a;
    }
    .demo-sidebar.is-open {
      transform: translateX(0);
      box-shadow: 0 12px 48px rgba(15, 23, 42, 0.35);
    }
  }
  @media (min-width: 768px) {
    .demo-backdrop {
      display: none;
    }
  }
  .demo-backdrop {
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgba(15, 23, 42, 0.45);
  }

  .demo-search-wrap {
    position: relative;
    display: flex; align-items: center;
  }
  .demo-search-icon {
    position: absolute; left: 10px;
    color: var(--sg-muted, #94a3b8);
    pointer-events: none;
  }
  .demo-search-input {
    width: 100%;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
    border-radius: 8px;
    padding: 7px 36px 7px 32px;
    font-size: 13px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .demo-search-input::placeholder { color: var(--sg-muted, #94a3b8); }
  .demo-search-input:focus {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--sg-accent, #2563eb) 22%, transparent);
  }
  .demo-search-input::-webkit-search-cancel-button { display: none; }
  .demo-search-kbd {
    position: absolute; right: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    padding: 1px 6px;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 4px;
    color: var(--sg-muted, #94a3b8);
    background: var(--sg-header-bg, transparent);
    pointer-events: none;
  }
  .demo-search-clear {
    position: absolute; right: 6px;
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 0; background: transparent;
    color: var(--sg-muted, #94a3b8);
    font-size: 18px; line-height: 1; cursor: pointer;
    border-radius: 4px;
  }
  .demo-search-clear:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.15)); color: var(--sg-fg, #0f172a); }

  .demo-row { display: flex; align-items: baseline; gap: 8px; }
  .demo-row-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .demo-row-cat {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--sg-muted, #94a3b8); flex-shrink: 0;
  }
  :global(.demo-search-hit) {
    background: color-mix(in oklab, var(--sg-accent, #2563eb) 22%, transparent);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
  }

  /* Collapsible category groups (DevExpress / Kendo style sidebar) */
  .demo-group-head {
    cursor: pointer;
    transition: color 120ms ease, background-color 120ms ease;
  }
  .demo-group-head:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.08)); }
  .demo-group-chev {
    flex-shrink: 0;
    transition: transform 140ms ease;
  }
  .demo-group-chev.is-open { transform: rotate(90deg); }
  .product-chev { flex-shrink: 0; color: rgb(100 116 139); transition: transform 140ms ease; }
  .product-chev.is-open { transform: rotate(180deg); }
  .demo-group-count {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 500;
    color: var(--sg-muted, #94a3b8);
    background: var(--sg-row-hover-bg, rgba(148,163,184,0.15));
    border-radius: 10px;
    padding: 1px 7px;
    letter-spacing: 0;
  }
  .demo-group-pro-badge {
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 4px;
    padding: 1px 5px;
    letter-spacing: 0.04em;
  }

  /* Leaf row with optional Pro dot */
  .demo-leaf { display: flex; align-items: center; gap: 6px; }
  .demo-leaf-title {
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .demo-pro-dot {
    display: inline-block;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    box-shadow: 0 0 0 2px color-mix(in oklab, #8b5cf6 30%, transparent);
    flex-shrink: 0;
  }

  /* Quiet "star on GitHub" nudge: muted until hovered, then the star warms to
     gold. No animation or fill-pop - present, not pushy. */
  .gh-star {
    text-decoration: none;
    transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease;
  }
  .gh-star:hover {
    color: var(--sg-fg, #0f172a);
    border-color: #f59e0b;
    background: color-mix(in oklab, #f59e0b 8%, transparent);
  }
  .gh-star-icon {
    flex-shrink: 0;
    transition: color 140ms ease, fill 140ms ease;
  }
  .gh-star:hover .gh-star-icon {
    color: #f59e0b;
    fill: #f59e0b;
  }
  .gh-star-count {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--sg-muted, #94a3b8);
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.15));
    border-radius: 10px;
    padding: 1px 7px;
  }
  .gh-star:hover .gh-star-count {
    color: #f59e0b;
    background: color-mix(in oklab, #f59e0b 14%, transparent);
  }
</style>
