<script lang="ts">
  import { demos, demoGroups, findDemo } from './shared/registry'
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

  let route = $state(readHash() || demos[0]!.id)
  let theme = $state<Theme>(readTheme())

  $effect(() => {
    const onHash = () => (route = readHash() || demos[0]!.id)
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

  const current = $derived(findDemo(route))
  const Current = $derived(current.component)

  function go(id: string) {
    window.location.hash = `/${id}`
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
  }

  let showSource = $state(false)

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
    return demos
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
</script>

<div class="flex h-screen">
  <aside class="w-72 shrink-0 border-r border-slate-200 dark:border-slate-700 p-4 overflow-y-auto">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">SvGrid</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400">Examples gallery</p>
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
                    {#if demo.pro}<span class="demo-pro-dot" title="Pro feature" aria-label="Pro"></span>{/if}
                  </span>
                  <span class="demo-row-cat">{demo.category}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        {#each demoGroups as group (group.category)}
          {@const isOpen = openGroups[group.category] ?? false}
          {@const proCount = group.demos.filter((d) => d.pro).length}
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
              {#if group.category === 'Pro' && proCount > 0}
                <span class="demo-group-pro-badge">Pro</span>
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
                      {#if demo.pro}<span class="demo-pro-dot" title="Pro feature" aria-label="Pro"></span>{/if}
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
  </aside>

  <main class="flex flex-col flex-1 overflow-x-hidden p-6 min-h-0">
    <header class="mb-5 flex shrink-0 items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-2xl font-semibold">{current.title}</h2>
        <p class="text-slate-600 dark:text-slate-300">{current.blurb}</p>
      </div>
      <button
        type="button"
        onclick={() => (showSource = true)}
        class="inline-flex shrink-0 items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        Source
      </button>
    </header>
    <div class="flex flex-col flex-1 min-h-0">
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
</style>
