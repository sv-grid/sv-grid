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

  function mountDemos() {
    if (!articleEl) return
    // Tear down anything mounted from a previous doc first.
    for (const m of mounted) {
      try { unmount(m.instance) } catch { /* already gone */ }
      m.host.innerHTML = ''
    }
    mounted = []
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
      const instance = mount(demo.component, { target: frame })
      mounted.push({ host, instance })
    })
  }

  // Scroll to the anchor (if any) after the markdown renders, and mount
  // any interactive demos embedded in the page.
  $effect(() => {
    void html
    void anchor
    if (typeof document === 'undefined') return
    // Mount after Svelte has painted the new {@html} output.
    queueMicrotask(() => {
      mountDemos()
      if (!anchor) {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
        return
      }
      const el = document.getElementById(anchor)
      if (el) el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' })
    })
    return () => {
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

  <main class="flex-1 overflow-x-hidden overflow-y-auto min-h-0">
    <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8">
      <header class="mb-8 flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-2">
          <button
            type="button"
            class="docs-menu-btn md:hidden"
            aria-label="Open documentation menu"
            onclick={() => (mobileNav = true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
              {current.category}
            </p>
            <h2 class="text-2xl font-semibold">{current.title}</h2>
            <p class="mt-1 text-sm" style="color: var(--sg-muted)">
              <code>{current.githubPath}</code>
            </p>
          </div>
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
</style>
