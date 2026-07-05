<script lang="ts">
  import { mount, unmount } from 'svelte'
  import { Marked } from 'marked'
  import { docGroups, findDoc } from '../lib/docs'
  import { findDemo } from '../lib/demos'
  import { resolveDocsLink } from '../lib/docs-links'
  import { searchDocs, type DocSearchHit } from '../lib/docs-search'
  import { router } from '../lib/router.svelte'

  type Props = { slug: string }
  let { slug }: Props = $props()

  // A rewritten doc link can carry a trailing #anchor (e.g.
  // "getting-started#11-server-side-data"). Split it here so findDoc gets
  // a clean slug and we can scroll to the section after render.
  const slugOnly = $derived(slug.split('#')[0] ?? '')
  const anchor = $derived(slug.includes('#') ? slug.slice(slug.indexOf('#') + 1) : '')

  const current = $derived(findDoc(slugOnly))

  // At the docs root (no slug) show a task-oriented landing instead of the
  // first page's markdown.
  const isLanding = $derived(!slugOnly)

  // Flat page order (sidebar order) for prev / next navigation.
  const flatDocs = docGroups.flatMap((g) => g.pages)
  const currentIndex = $derived(flatDocs.findIndex((d) => d.slug === current.slug))
  const prevDoc = $derived(currentIndex > 0 ? flatDocs[currentIndex - 1] : null)
  const nextDoc = $derived(
    currentIndex >= 0 && currentIndex < flatDocs.length - 1 ? flatDocs[currentIndex + 1] : null,
  )

  // Curated "start here" links for the landing - filtered to slugs that exist
  // so we never render a dead card.
  // `slug` links to a docs page; `route` links to another top-level page (the
  // API reference lives on the dedicated /api page, not in the docs).
  type QuickLink = { label: string; desc: string; slug?: string; route?: string }
  const quickLinks: QuickLink[] = (
    [
      { slug: 'getting-started', label: 'Getting started', desc: 'Install, then render your first grid.' },
      { route: 'playground', label: 'Playground', desc: 'Edit any demo live in your browser, no setup.' },
      { route: 'api', label: 'API reference', desc: 'Every prop, method, and type.' },
      { slug: 'help/recipes', label: 'Recipes / cookbook', desc: '20+ copy-paste patterns.' },
      { slug: 'help/architecture', label: 'Architecture', desc: 'Data, engine, renderer - the model.' },
    ] as QuickLink[]
  ).filter((q) => q.route != null || flatDocs.some((d) => d.slug === q.slug))
  function openQuickLink(q: QuickLink) {
    if (q.route) router.navigate(q.route)
    else if (q.slug) go(q.slug)
  }

  /**
   * Per-group expansion state for the sidebar tree.
   * Persists across navigation; defaultOpen on a group decides the
   * initial value when the user hasn't toggled it yet.
   */
  let openGroups = $state<Record<string, boolean>>({})

  // Mobile: the doc tree + search live in a slide-in drawer. Without this
  // the sidebar is `hidden` on phones and there is no way to navigate or
  // search between pages. Opening a page closes the drawer.
  let mobileNav = $state(false)

  // Rebuild a Marked instance per render so the `walkTokens` closure sees the
  // current slug. Cheap - it's just an option bag.
  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const html = $derived.by(() => {
    const m = new Marked({
      walkTokens(token) {
        if (token.type === 'link') {
          token.href = resolveDocsLink(token.href, current.slug)
        }
      },
    })
    // Inject id="..." on headings so anchor links (#11-server-side-data)
    // can scroll-into-view. marked v15 leaves the renderer plain.
    m.use({
      renderer: {
        heading({ tokens, depth }) {
          const text = this.parser.parseInline(tokens)
          const plain = tokens
            .map((t) => ('text' in t ? t.text : ''))
            .join('')
            .trim()
          // Convert "11. Server-side data" -> "11-server-side-data" to match
          // the format other docs use when they link with ../foo.md#anchor.
          const id = slugify(plain.replace(/^(\d+)\.\s+/, '$1-'))
          return `<h${depth} id="${id}">${text}</h${depth}>`
        },
      },
    })
    return m.parse(current.markdown, { async: false }) as string
  })

  // ---- Inline interactive demos --------------------------------------
  //
  // Authors drop `<div data-docs-demo="<demo-id>" data-height="420"></div>`
  // into the markdown - marked passes raw HTML through unchanged. After
  // each render we walk the article for those placeholders and mount the
  // corresponding demo from the gallery into them.
  //
  // We track every mount so we can unmount on doc change; without this
  // the demo's $effect cleanups never fire and intervals keep ticking
  // after the user navigates away.

  let articleEl: HTMLElement | null = $state(null)
  let mounted: Array<{ host: HTMLElement; instance: ReturnType<typeof mount> }> = []
  // Demos are loaded lazily (their components are per-demo chunks), so mounting
  // is async. This generation token lets a slow chunk that resolves after the
  // user has already navigated away bail out instead of mounting into stale DOM.
  let mountGen = 0

  function mountDemos() {
    if (!articleEl) return
    // Tear down anything mounted from a previous doc first.
    for (const m of mounted) {
      try { unmount(m.instance) } catch { /* already gone */ }
      m.host.innerHTML = ''
    }
    mounted = []
    const gen = ++mountGen
    const placeholders = articleEl.querySelectorAll<HTMLElement>('[data-docs-demo]')
    placeholders.forEach((host) => {
      const demoId = host.getAttribute('data-docs-demo')
      if (!demoId) return
      const heightAttr = host.getAttribute('data-height')
      const height = heightAttr ? Number(heightAttr) : 460
      const demo = findDemo(demoId)
      if (!demo) {
        host.innerHTML = `<div class="docs-demo-missing">Unknown demo id "${demoId}"</div>`
        return
      }
      // Wrap the mount target so the demo's flex layout has a known
      // height container - many gallery demos rely on a height parent.
      host.classList.add('docs-demo-host')
      host.innerHTML = `
        <div class="docs-demo-head">
          <span class="docs-demo-eyebrow">Interactive · ${demo.category}</span>
          <a class="docs-demo-link" href="#/demos/${demo.id}">Open in gallery -&gt;</a>
        </div>
        <div class="docs-demo-frame" style="height:${height}px"></div>
      `
      const frame = host.querySelector<HTMLElement>('.docs-demo-frame')!
      // Fetch the demo's chunk, then mount - unless the doc changed (gen) or
      // the placeholder was replaced (isConnected) while the chunk loaded.
      demo
        .load()
        .then((mod) => {
          if (gen !== mountGen || !frame.isConnected) return
          const instance = mount(mod.default, { target: frame })
          mounted.push({ host, instance })
        })
        .catch(() => {
          if (gen !== mountGen || !frame.isConnected) return
          frame.innerHTML = `<div class="docs-demo-missing">Failed to load demo "${demoId}".</div>`
        })
    })
  }

  // Add a one-click "Copy" button to every code block in the rendered doc.
  // {@html} replaces innerHTML on nav, so we re-run this per render; the guard
  // skips blocks already wrapped.
  function enhanceCodeBlocks() {
    if (!articleEl) return
    articleEl.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
      if (pre.parentElement?.classList.contains('docs-code')) return
      const wrap = document.createElement('div')
      wrap.className = 'docs-code'
      pre.parentNode?.insertBefore(wrap, pre)
      wrap.appendChild(pre)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'docs-copy'
      btn.textContent = 'Copy'
      btn.setAttribute('aria-label', 'Copy code to clipboard')
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
        try {
          await navigator.clipboard.writeText(code)
        } catch {
          /* clipboard blocked - nothing to do */
        }
        btn.textContent = 'Copied!'
        btn.classList.add('is-copied')
        setTimeout(() => {
          btn.textContent = 'Copy'
          btn.classList.remove('is-copied')
        }, 1400)
      })
      wrap.appendChild(btn)
    })
  }

  // "On this page" table of contents + scrollspy. Headings already carry ids
  // (injected by the marked renderer); we list h2/h3 and highlight the one the
  // reader is currently in via an IntersectionObserver.
  let tocItems = $state<Array<{ id: string; text: string; level: number }>>([])
  let activeHeading = $state('')
  let mainScrollEl: HTMLElement | null = $state(null)

  function buildToc() {
    if (!articleEl) {
      tocItems = []
      return
    }
    const heads = [...articleEl.querySelectorAll<HTMLElement>('h2[id], h3[id]')]
    tocItems = heads.map((h) => ({
      id: h.id,
      text: h.textContent?.trim() ?? '',
      level: h.tagName === 'H3' ? 3 : 2,
    }))
    activeHeading = heads[0]?.id ?? ''
    updateActiveHeading()
  }

  // The active section = the last heading whose top has scrolled above a small
  // threshold. Robust across the multi-heading-in-view case (unlike a naive
  // IntersectionObserver) and works with the article's own scroll container.
  function updateActiveHeading() {
    if (!articleEl) return
    const heads = [...articleEl.querySelectorAll<HTMLElement>('h2[id], h3[id]')]
    if (!heads.length) return
    // Scrolled to the bottom: the trailing sections may never reach the top
    // threshold, so activate the last one directly.
    const sc = mainScrollEl
    if (sc && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) {
      activeHeading = heads[heads.length - 1]!.id
      return
    }
    let current = heads[0]!.id
    for (const h of heads) {
      if (h.getBoundingClientRect().top <= 130) current = h.id
      else break
    }
    activeHeading = current
  }

  // Track scroll on the content scroller to drive the "On this page" highlight.
  $effect(() => {
    const el = mainScrollEl
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        updateActiveHeading()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  })

  // Scroll to the anchor (if any) after the markdown renders, and mount
  // any interactive demos embedded in the page.
  $effect(() => {
    void html
    void anchor
    if (typeof document === 'undefined') return
    // Mount after Svelte has painted the new {@html} output.
    queueMicrotask(() => {
      mountDemos()
      enhanceCodeBlocks()
      buildToc()
      if (!anchor) {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
        return
      }
      const el = document.getElementById(anchor)
      if (el) el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' })
    })
    return () => {
      // Invalidate any in-flight lazy demo loads so they don't mount after teardown.
      mountGen++
      for (const m of mounted) {
        try { unmount(m.instance) } catch { /* */ }
      }
      mounted = []
    }
  })

  function go(s: string) {
    router.navigate(`docs/${s}`)
    mobileNav = false
    // Scroll the main column back to the top when navigating - the sidebar
    // can otherwise leave you mid-page on the new doc.
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
  }

  // ---- Search ---------------------------------------------------------

  let searchQuery = $state('')
  let searchFocused = $state(false)
  let highlightIndex = $state(0)
  let searchInputEl: HTMLInputElement | null = $state(null)

  const searchHits: DocSearchHit[] = $derived.by(() =>
    searchQuery.trim().length >= 2 ? searchDocs(searchQuery, 12) : [],
  )
  $effect(() => {
    void searchHits
    highlightIndex = 0
  })

  function selectHit(hit: DocSearchHit) {
    const slugWithAnchor = hit.anchor ? `${hit.page.slug}#${hit.anchor}` : hit.page.slug
    searchQuery = ''
    searchFocused = false
    go(slugWithAnchor)
  }

  function onSearchKey(e: KeyboardEvent) {
    if (searchHits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightIndex = (highlightIndex + 1) % searchHits.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightIndex = (highlightIndex - 1 + searchHits.length) % searchHits.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = searchHits[highlightIndex]
      if (hit) selectHit(hit)
    } else if (e.key === 'Escape') {
      searchQuery = ''
      searchFocused = false
      ;(e.currentTarget as HTMLInputElement).blur()
    }
  }

  // Global keyboard shortcut: Cmd/Ctrl + K focuses the search box.
  $effect(() => {
    if (typeof window === 'undefined') return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputEl?.focus()
        searchInputEl?.select()
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputEl?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

<!-- Layout matches the Demos route: full-height shell, a border-right
     sidebar with a compact "SvGrid · Documentation" header, then a
     scrollable nav. Category labels render as small uppercase eyebrows
     above each flat list of pages - same visual grammar as the demo
     gallery, just with section dividers instead of separate accordions. -->
<div class="flex h-full min-h-0">
  {#if mobileNav}
    <button
      type="button"
      class="docs-backdrop md:hidden"
      aria-label="Close menu"
      onclick={() => (mobileNav = false)}
    ></button>
  {/if}
  <aside
    class="docs-aside w-72 shrink-0 border-r p-4 overflow-y-auto"
    class:is-open={mobileNav}
    style="border-color: var(--sg-border)"
  >
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">SvGrid</h1>
        <p class="text-xs" style="color: var(--sg-muted)">
          Documentation · {docGroups.reduce((n, g) => n + g.pages.length, 0)} pages
        </p>
      </div>
      <button
        type="button"
        class="docs-aside-close md:hidden"
        aria-label="Close menu"
        onclick={() => (mobileNav = false)}
      >×</button>
    </div>

    <!-- Docs search: client-side full-text over every page's title + headings
         + body. Cmd/Ctrl+K or '/' focuses the input from anywhere. -->
    <div class="docs-search mb-5">
      <div class="docs-search-row">
        <svg class="docs-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          bind:this={searchInputEl}
          bind:value={searchQuery}
          placeholder="Search docs..."
          aria-label="Search documentation"
          onfocus={() => (searchFocused = true)}
          onblur={() => setTimeout(() => (searchFocused = false), 120)}
          onkeydown={onSearchKey}
        />
        <kbd class="docs-search-kbd">⌘K</kbd>
      </div>
      {#if searchFocused && searchHits.length > 0}
        <ul class="docs-search-results" role="listbox" aria-label="Search results">
          {#each searchHits as hit, i (hit.page.slug + '#' + hit.anchor + i)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
            <li
              class={`docs-search-result ${i === highlightIndex ? 'is-active' : ''}`}
              role="option"
              aria-selected={i === highlightIndex}
              onmousedown={() => selectHit(hit)}
              onmouseenter={() => (highlightIndex = i)}
            >
              <div class="docs-search-result-head">
                <span class="docs-search-result-title">{hit.page.title}</span>
                <span class="docs-search-result-cat">{hit.page.category}</span>
              </div>
              {#if hit.snippet}
                <div class="docs-search-result-snippet">{@html hit.snippet}</div>
              {/if}
            </li>
          {/each}
        </ul>
      {:else if searchFocused && searchQuery.trim().length >= 2}
        <div class="docs-search-empty">No matches for "{searchQuery}".</div>
      {/if}
    </div>

    <nav aria-label="Docs" class="docs-tree">
      {#each docGroups as group (group.dir || group.category)}
        {@const active = group.pages.some((p) => p.slug === current.slug)}
        {@const open = openGroups[group.dir] ?? (group.defaultOpen || active)}
        <div class="docs-tree-group" style:padding-left={`${group.depth * 12}px`}>
          <button
            type="button"
            class="docs-tree-head"
            class:is-open={open}
            class:is-active={active}
            aria-expanded={open}
            title={group.summary ?? ''}
            onclick={() => (openGroups = { ...openGroups, [group.dir]: !open })}
          >
            <span class="docs-tree-chev" aria-hidden="true">▸</span>
            {#if group.icon}<span class="docs-tree-icon" aria-hidden="true">{group.icon}</span>{/if}
            <span class="docs-tree-label">{group.category}</span>
            <span class="docs-tree-count">{group.pages.length}</span>
          </button>

          {#if open}
            <ul class="docs-tree-list">
              {#each group.pages as doc (doc.slug)}
                {@const isCurrent = doc.slug === current.slug}
                <li>
                  <button
                    type="button"
                    onclick={() => go(doc.slug)}
                    class="docs-tree-leaf"
                    class:is-current={isCurrent}
                  >
                    {doc.title}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </nav>

    <p class="mt-8 text-xs" style="color: var(--sg-muted)">
      Every page is rendered from <code>docs/</code>. Click "Edit on GitHub" to
      propose a change - we ship them straight to the docs.
    </p>
  </aside>

  <main class="flex-1 overflow-x-hidden overflow-y-auto min-h-0" bind:this={mainScrollEl}>
    <div class="docs-main-wrap" class:has-toc={!isLanding && tocItems.length > 0}>
      <div class="docs-main-col">
      {#if isLanding}
        <!-- ===== Task-oriented landing ===== -->
        <button
          type="button"
          class="docs-menu-btn md:hidden mb-4"
          aria-label="Open documentation menu"
          onclick={() => (mobileNav = true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div class="docs-hero">
          <h1 class="docs-hero-title">SvGrid documentation</h1>
          <p class="docs-hero-sub">
            {flatDocs.length} focused pages, each with copy-paste code and a live demo.
            Press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> to search.
          </p>
        </div>

        {#if quickLinks.length}
          <div class="docs-quick">
            {#each quickLinks as q (q.slug ?? q.route)}
              <button type="button" class="docs-quick-card" onclick={() => openQuickLink(q)}>
                <span class="docs-quick-title">{q.label}</span>
                <span class="docs-quick-desc">{q.desc}</span>
              </button>
            {/each}
          </div>
        {/if}

        <h2 class="docs-section-h">Browse by topic</h2>
        <div class="docs-topics">
          {#each docGroups as g (g.category)}
            {#if g.pages.length}
              <button type="button" class="docs-topic-card" onclick={() => go(g.pages[0]!.slug)}>
                <div class="docs-topic-head">
                  {#if g.icon}<span class="docs-topic-icon">{g.icon}</span>{/if}
                  <span class="docs-topic-name">{g.category}</span>
                  <span class="docs-topic-count">{g.pages.length}</span>
                </div>
                {#if g.summary}<p class="docs-topic-sum">{g.summary}</p>{/if}
              </button>
            {/if}
          {/each}
        </div>
      {:else}
        <!-- ===== A normal doc page ===== -->
        <nav class="docs-crumbs" aria-label="Breadcrumb">
          <button
            type="button"
            class="docs-menu-btn md:hidden"
            aria-label="Open documentation menu"
            onclick={() => (mobileNav = true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button type="button" class="docs-crumb-link" onclick={() => router.navigate('docs')}>Docs</button>
          <span class="docs-crumb-sep">/</span>
          <span class="docs-crumb-cat">{current.category}</span>
          <span class="docs-crumb-sep">/</span>
          <span class="docs-crumb-cur">{current.title}</span>
        </nav>

        <header class="mb-8 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-2xl font-semibold">{current.title}</h2>
            <p class="mt-1 text-sm" style="color: var(--sg-muted)">
              <code>{current.githubPath}</code>
            </p>
          </div>
          <a
            href={`https://github.com/sv-grid/sv-grid/blob/main/${current.githubPath}`}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 text-sm"
            style="border-color: var(--sg-border); color: var(--sg-fg); background: transparent;"
          >
            Edit on GitHub
          </a>
        </header>

        <article class="prose" bind:this={articleEl}>
          {@html html}
        </article>

        <!-- Sequential prev / next within the sidebar order. -->
        {#if prevDoc || nextDoc}
          <nav class="docs-pager" aria-label="Pagination">
            {#if prevDoc}
              <button type="button" class="docs-pager-card is-prev" onclick={() => go(prevDoc.slug)}>
                <span class="docs-pager-dir">← Previous</span>
                <span class="docs-pager-title">{prevDoc.title}</span>
              </button>
            {:else}<span></span>{/if}
            {#if nextDoc}
              <button type="button" class="docs-pager-card is-next" onclick={() => go(nextDoc.slug)}>
                <span class="docs-pager-dir">Next →</span>
                <span class="docs-pager-title">{nextDoc.title}</span>
              </button>
            {:else}<span></span>{/if}
          </nav>
        {/if}
      {/if}
      </div>

      {#if !isLanding && tocItems.length > 0}
        <aside class="docs-toc" aria-label="On this page">
          <div class="docs-toc-head">On this page</div>
          <ul class="docs-toc-list">
            {#each tocItems as t (t.id)}
              <li class:is-sub={t.level === 3} class:is-active={activeHeading === t.id}>
                <a
                  href={`#/docs/${current.slug}#${t.id}`}
                  onclick={(e) => {
                    e.preventDefault()
                    document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    activeHeading = t.id
                  }}
                >{t.text}</a>
              </li>
            {/each}
          </ul>
        </aside>
      {/if}
    </div>
  </main>
</div>

<style>
  /* ---- Mobile sidebar drawer ------------------------------------------
     >=768px: sidebar is a normal in-flow column. Below that it slides in
     as a fixed drawer (it is otherwise hidden, leaving no nav on phones). */
  .docs-menu-btn,
  .docs-aside-close {
    display: none;
    align-items: center;
    justify-content: center;
    color: var(--sg-fg);
    background: transparent;
    cursor: pointer;
  }
  .docs-menu-btn {
    width: 38px; height: 38px; flex-shrink: 0;
    border: 1px solid var(--sg-border);
    border-radius: 8px;
  }
  .docs-aside-close {
    width: 30px; height: 30px;
    font-size: 22px; line-height: 1;
    border: 0;
  }
  @media (max-width: 767px) {
    .docs-menu-btn { display: inline-flex; }
    .docs-aside-close { display: inline-flex; }
    .docs-aside {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: 86vw;
      max-width: 340px;
      z-index: 60;
      background: var(--site-bg);
      transform: translateX(-100%);
      transition: transform 200ms ease;
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.35);
    }
    .docs-aside.is-open { transform: translateX(0); }
    .docs-backdrop {
      position: fixed;
      inset: 0;
      z-index: 55;
      background: rgba(0, 0, 0, 0.45);
      border: 0;
    }
  }

  /* Docs search */
  .docs-search { position: relative; }
  .docs-search-row {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    border-radius: 7px;
    padding: 5px 8px 5px 10px;
    transition: border-color 120ms ease;
  }
  .docs-search-row:focus-within {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }
  .docs-search-icon { color: var(--sg-muted, #64748b); flex-shrink: 0; }
  .docs-search-row input {
    flex: 1 1 0;
    background: transparent;
    border: 0;
    outline: none;
    font-size: 12.5px;
    color: var(--sg-fg, #1e293b);
    padding: 2px 0;
    min-width: 0;
  }
  .docs-search-row input::placeholder {
    color: var(--sg-muted, #64748b);
  }
  .docs-search-kbd {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-muted, #64748b);
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid var(--sg-border, #e2e8f0);
    flex-shrink: 0;
  }

  .docs-search-results {
    position: absolute;
    top: calc(100% + 4px);
    left: 0; right: 0;
    z-index: 30;
    list-style: none;
    margin: 0;
    padding: 4px;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
    max-height: 360px;
    overflow: auto;
  }
  .docs-search-result {
    padding: 7px 9px;
    border-radius: 5px;
    cursor: pointer;
    transition: background 80ms ease;
  }
  .docs-search-result.is-active {
    background: var(--sg-header-bg, #f1f5f9);
  }
  .docs-search-result-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .docs-search-result-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--sg-fg, #1e293b);
  }
  .docs-search-result-cat {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    flex-shrink: 0;
  }
  .docs-search-result-snippet {
    margin-top: 3px;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    line-height: 1.4;
  }
  .docs-search-result-snippet :global(mark) {
    background: rgba(245, 158, 11, 0.28);
    color: var(--sg-fg, #1e293b);
    padding: 0 2px;
    border-radius: 2px;
  }
  :global([data-theme='dark']) .docs-search-result-snippet :global(mark) {
    background: rgba(245, 158, 11, 0.45);
    color: #fff;
  }
  .docs-search-empty {
    position: absolute;
    top: calc(100% + 4px);
    left: 0; right: 0;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    z-index: 30;
  }

  /* Interactive demo frames. The host element is injected by markdown
   * via <div data-docs-demo="..." data-height="..."></div> and gets
   * laid out by the script above. */
  :global(.docs-demo-host) {
    margin: 18px 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
    box-shadow: 0 6px 22px rgba(15, 23, 42, 0.06);
  }
  :global(.docs-demo-head) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 233, 0.04));
  }
  :global([data-theme='dark']) :global(.docs-demo-head) {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(14, 165, 233, 0.08));
  }
  :global(.docs-demo-eyebrow) {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-accent, #2563eb);
  }
  :global(.docs-demo-link) {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    text-decoration: none;
  }
  :global(.docs-demo-link:hover) { color: var(--sg-accent, #2563eb); }
  :global(.docs-demo-frame) {
    display: flex;
    flex-direction: column;
    padding: 14px;
    min-height: 0;
    background: var(--sg-bg, #ffffff);
  }
  :global(.docs-demo-frame > *) {
    flex: 1 1 0;
    min-height: 0;
  }
  :global(.docs-demo-missing) {
    padding: 14px;
    color: #b91c1c;
    font-size: 13px;
  }

  /* ---- Sidebar tree ---------------------------------------------- */
  .docs-tree-group   { margin: 0 0 2px; }
  .docs-tree-head {
    display: flex; align-items: center; gap: 6px; width: 100%;
    background: transparent; border: 0;
    padding: 6px 8px;
    font-size: 12.5px; font-weight: 600;
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
  }
  .docs-tree-head:hover   { background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.10)); }
  .docs-tree-head.is-active{ color: var(--site-accent, #4338ca); }
  .docs-tree-chev {
    color: var(--sg-muted, #94a3b8); font-size: 10px; width: 12px;
    transform: rotate(0deg);
    transition: transform 100ms ease;
  }
  .docs-tree-head.is-open .docs-tree-chev { transform: rotate(90deg); }
  .docs-tree-icon { font-size: 12px; opacity: 0.7; width: 14px; text-align: center; }
  .docs-tree-label{ flex: 1; min-width: 0; }
  .docs-tree-count{
    font-size: 10px; font-variant-numeric: tabular-nums;
    color: var(--sg-muted, #94a3b8);
    background: rgba(148, 163, 184, 0.12);
    border-radius: 999px;
    padding: 1px 6px;
  }

  .docs-tree-list {
    list-style: none;
    margin: 2px 0 4px;
    padding: 0 0 0 20px;
    border-left: 1px dashed var(--sg-border, rgba(148, 163, 184, 0.25));
    margin-left: 13px;
  }
  .docs-tree-list li { margin: 0; }
  .docs-tree-leaf {
    display: block; width: 100%;
    background: transparent; border: 0;
    padding: 4px 10px;
    font-size: 12.5px; font-weight: 400;
    color: var(--sg-fg, #0f172a);
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
  }
  .docs-tree-leaf:hover     { background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.10)); }
  .docs-tree-leaf.is-current{
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.18));
    color: var(--site-accent, #4338ca);
    font-weight: 600;
  }

  /* ---- Code block copy button ---------------------------------------- */
  :global(.docs-code) { position: relative; }
  :global(.docs-copy) {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 9px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid var(--sg-border, #334155);
    background: color-mix(in srgb, var(--sg-bg, #0f172a) 80%, transparent);
    color: var(--sg-muted, #94a3b8);
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  :global(.docs-code:hover) .docs-copy,
  :global(.docs-code:focus-within) .docs-copy { opacity: 1; }
  :global(.docs-copy:hover) {
    color: var(--site-accent, #6366f1);
    border-color: var(--site-accent, #6366f1);
  }
  :global(.docs-copy.is-copied) {
    color: #10b981;
    border-color: #10b981;
    opacity: 1;
  }

  /* ---- Breadcrumbs ---------------------------------------------------- */
  .docs-crumbs {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    font-size: 12.5px;
    color: var(--sg-muted, #64748b);
  }
  .docs-crumb-link {
    background: transparent; border: 0; padding: 0; cursor: pointer;
    color: var(--site-accent-2, #6366f1); font-weight: 600;
  }
  .docs-crumb-link:hover { text-decoration: underline; }
  .docs-crumb-sep { opacity: 0.5; }
  .docs-crumb-cat { color: var(--sg-fg, #0f172a); }
  .docs-crumb-cur { color: var(--sg-muted, #64748b); }

  /* ---- Prev / next pager --------------------------------------------- */
  .docs-pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .docs-pager-card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px 14px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: border-color 120ms ease, background-color 120ms ease;
  }
  .docs-pager-card.is-next { text-align: right; align-items: flex-end; }
  .docs-pager-card:hover {
    border-color: var(--site-accent, #6366f1);
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.08));
  }
  .docs-pager-dir { font-size: 11px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .docs-pager-title { font-size: 14px; font-weight: 600; color: var(--sg-fg, #0f172a); }

  /* ---- Landing ------------------------------------------------------- */
  .docs-hero { margin-bottom: 28px; }
  .docs-hero-title { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; }
  .docs-hero-sub { margin-top: 8px; font-size: 15px; color: var(--sg-muted, #64748b); max-width: 60ch; }
  .docs-hero-sub kbd {
    display: inline-block; padding: 1px 6px; font-size: 12px; font-family: ui-monospace, monospace;
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: 5px; background: var(--sg-header-bg, #f8fafc);
  }
  .docs-quick {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;
    margin-bottom: 36px;
  }
  .docs-quick-card {
    display: flex; flex-direction: column; gap: 4px; text-align: left;
    padding: 14px 16px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--site-accent, #6366f1);
    background: color-mix(in srgb, var(--site-accent, #6366f1) 8%, transparent);
    transition: transform 120ms ease, background-color 120ms ease;
  }
  .docs-quick-card:hover { transform: translateY(-2px); background: color-mix(in srgb, var(--site-accent, #6366f1) 14%, transparent); }
  .docs-quick-title { font-size: 14.5px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .docs-quick-desc { font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .docs-section-h { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); margin-bottom: 14px; }
  .docs-topics {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
  }
  .docs-topic-card {
    display: flex; flex-direction: column; gap: 6px; text-align: left;
    padding: 14px 16px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); background: transparent;
    transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }
  .docs-topic-card:hover { transform: translateY(-2px); border-color: var(--site-accent, #6366f1); background: var(--sg-row-hover-bg, rgba(148,163,184,0.06)); }
  .docs-topic-head { display: flex; align-items: center; gap: 8px; }
  .docs-topic-icon { font-size: 16px; }
  .docs-topic-name { font-size: 14.5px; font-weight: 700; color: var(--sg-fg, #0f172a); flex: 1; }
  .docs-topic-count {
    font-size: 11px; font-weight: 700; color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f1f5f9); border-radius: 999px; padding: 1px 8px;
  }
  .docs-topic-sum { font-size: 12.5px; color: var(--sg-muted, #64748b); line-height: 1.4; }

  /* ---- Content + "On this page" layout ------------------------------- */
  .docs-main-wrap {
    width: 100%;
    max-width: 52rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  @media (min-width: 640px) { .docs-main-wrap { padding: 2rem 1.5rem; } }
  /* On wide screens, a doc page shows the content + a sticky TOC rail. */
  @media (min-width: 1180px) {
    .docs-main-wrap.has-toc {
      max-width: 66rem;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 13rem;
      gap: 2.5rem;
      align-items: start;
    }
  }
  .docs-main-col { min-width: 0; }

  .docs-toc {
    position: sticky;
    top: 1.25rem;
    align-self: start;
    display: none;
    max-height: calc(100vh - 3rem);
    overflow-y: auto;
  }
  @media (min-width: 1180px) { .docs-main-wrap.has-toc .docs-toc { display: block; } }
  .docs-toc-head {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); margin-bottom: 10px;
  }
  .docs-toc-list { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--sg-border, #e2e8f0); }
  .docs-toc-list li { line-height: 1.3; }
  .docs-toc-list li.is-sub a { padding-left: 22px; font-size: 12px; }
  .docs-toc-list a {
    display: block;
    padding: 4px 0 4px 12px;
    margin-left: -1px;
    border-left: 2px solid transparent;
    font-size: 12.5px;
    color: var(--sg-muted, #64748b);
    text-decoration: none;
    transition: color 100ms ease, border-color 100ms ease;
  }
  .docs-toc-list a:hover { color: var(--sg-fg, #0f172a); }
  .docs-toc-list li.is-active > a {
    color: var(--site-accent, #6366f1);
    border-left-color: var(--site-accent, #6366f1);
    font-weight: 600;
  }
</style>
