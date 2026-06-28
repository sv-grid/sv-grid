<script lang="ts">
  /**
   * Demos route - mirrors examples/src/App.svelte so the look inside the
   * website is indistinguishable from `pnpm dev` on the gallery package.
   * The only changes vs. the original: hash-routed under /demos, theme
   * locked to dark, no theme toggle.
   */
  import { demos, demoGroups, findDemo } from '../lib/demos'
  import SourceModal from '../components/SourceModal.svelte'
  import { openInStackBlitz } from '../lib/stackblitz'
  import { router } from '../lib/router.svelte'

  type Props = { demoId: string }
  let { demoId }: Props = $props()

  const current = $derived(findDemo(demoId))

  // Mobile: the sidebar is a slide-in drawer (it would otherwise eat ~288px
  // of a phone screen and crush the demo). Opening a demo closes it.
  let mobileNav = $state(false)

  function go(id: string) {
    router.navigate(`demos/${id}`)
    mobileNav = false
  }

  // Source is loaded on demand (the registry only holds a lazy loader), so the
  // raw text ships only when the user actually opens the source panel.
  let showSource = $state(false)
  let sourceText = $state<string | null>(null)

  async function openSource() {
    sourceText = null
    showSource = true
    sourceText = await current.loadSource()
  }

  // ---- Theme preset chooser (shadcn / Excel / Fluent / Material) ----------
  type Preset =
    | 'default' | 'shadcn' | 'tailwind' | 'material'
    | 'excel' | 'fluent'
    | 'carbon' | 'sap' | 'salesforce' | 'atlassian' | 'github' | 'antd'
    | 'ag-alpine'
  type PresetGroup = { label: string; presets: { id: Preset; label: string }[] }
  const PRESET_GROUPS: PresetGroup[] = [
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
  ]
  const PRESETS: { id: Preset; label: string }[] =
    PRESET_GROUPS.flatMap((g) => g.presets)
  function readPreset(): Preset {
    if (typeof localStorage === 'undefined') return 'default'
    const stored = localStorage.getItem('sg-preset')
    return (PRESETS.some((p) => p.id === stored) ? stored : 'default') as Preset
  }
  let preset = $state<Preset>(readPreset())
  $effect(() => {
    if (preset === 'default') {
      document.documentElement.removeAttribute('data-preset')
    } else {
      document.documentElement.setAttribute('data-preset', preset)
    }
    try { localStorage.setItem('sg-preset', preset) } catch { /* ignore */ }
  })

  // ---- Smart demo search (mirrors examples/src/App.svelte) ---------------
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
  function loadOpenGroups(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem('sg-demo-groups')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return {}
  }
  let openGroups = $state<Record<string, boolean>>(loadOpenGroups())

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

<div class="demo-page flex h-full min-h-0">
  {#if mobileNav}
    <button
      type="button"
      class="demo-backdrop md:hidden"
      aria-label="Close menu"
      onclick={() => (mobileNav = false)}
    ></button>
  {/if}
  <aside
    class="demo-aside w-72 shrink-0 border-r p-4 overflow-y-auto"
    class:is-open={mobileNav}
    style="border-color: var(--sg-border)"
  >
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">SvGrid</h1>
        <p class="text-xs" style="color: var(--sg-muted)">Examples gallery</p>
      </div>
      <button
        type="button"
        class="demo-aside-close md:hidden"
        aria-label="Close menu"
        onclick={() => (mobileNav = false)}
      >×</button>
    </div>

    <label class="preset-row mb-4 flex items-center justify-between gap-2 text-xs">
      <span style="color: var(--sg-muted)">Theme</span>
      <select
        class="preset-select rounded border px-2 py-1"
        style="background: var(--sg-input-bg, var(--sg-bg)); color: var(--sg-fg); border-color: var(--sg-input-border, var(--sg-border));"
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
        <div class="mb-2 px-2 text-[11px] uppercase tracking-wider" style="color: var(--sg-muted);">
          {#if searchResults.length === 0}
            No matches
          {:else}
            {searchResults.length} match{searchResults.length === 1 ? '' : 'es'}
            <span class="normal-case tracking-normal" style="color: var(--sg-muted); opacity: 0.7;"> · Enter to open top hit</span>
          {/if}
        </div>
        {#if searchResults.length === 0}
          <p class="px-3 py-4 text-xs" style="color: var(--sg-muted);">
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
                  class="demo-row w-full text-left rounded px-3 py-1.5 text-sm transition-colors"
                  style:background={active ? 'var(--sg-row-hover-bg)' : 'transparent'}
                  style:color="var(--sg-fg)"
                  style:font-weight={active ? '600' : '400'}
                >
                  <span class="demo-row-title">
                    {@html highlight(demo.title, toks)}
                    {#if demo.pro}<span class="demo-pro-dot" title="Enterprise feature" aria-label="Enterprise"></span>{/if}
                  </span>
                  <span class="demo-row-cat" style="color: var(--sg-muted);">{demo.category}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        {#each demoGroups as group (group.category)}
          {@const isOpen = openGroups[group.category] ?? false}
          <div class="mb-1">
            <button
              type="button"
              onclick={() => toggleGroup(group.category)}
              aria-expanded={isOpen}
              class="demo-group-head w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded transition-colors"
              style="color: var(--sg-muted);"
            >
              <svg class="demo-group-chev {isOpen ? 'is-open' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 6 15 12 9 18" />
              </svg>
              <span class="flex-1 text-left">{group.category}</span>
              {#if group.category === 'Enterprise'}
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
                      class="demo-leaf w-full text-left rounded pl-6 pr-3 py-1.5 text-sm transition-colors"
                      style:background={active ? 'var(--sg-row-hover-bg)' : 'transparent'}
                      style:color="var(--sg-fg)"
                      style:font-weight={active ? '600' : '400'}
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
    <p class="mt-8 text-xs" style="color: var(--sg-muted)">
      Each demo is a single .svelte file under <code>examples/src/demos/</code>. Read the source
      alongside the running app - it is what you would copy into your own project.
    </p>

    <a
      class="gh-star mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
      style="border-color: var(--sg-border); color: var(--sg-muted);"
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

  <main class="flex flex-col flex-1 overflow-x-hidden p-3 sm:p-6 min-h-0">
    <header class="mb-5 flex shrink-0 items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-2">
        <button
          type="button"
          class="demo-menu-btn md:hidden"
          aria-label="Open demos menu"
          onclick={() => (mobileNav = true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div class="min-w-0">
          <h2 class="text-xl sm:text-2xl font-semibold">{current.title}</h2>
          <p class="text-sm" style="color: var(--sg-muted)">{current.blurb}</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onclick={() => openInStackBlitz(current)}
          class="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm"
          style="border-color: var(--sg-border); color: var(--sg-fg); background: transparent;"
          title="Open this demo as an editable project in StackBlitz"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10.797 14.182H3.635L16.728 0l-3.525 9.818h7.162L7.272 24l3.525-9.818Z" />
          </svg>
          <span class="hidden sm:inline">Edit in StackBlitz</span>
        </button>
        <button
          type="button"
          onclick={openSource}
          class="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm"
          style="border-color: var(--sg-border); color: var(--sg-fg); background: transparent;"
          title="View source"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span class="hidden sm:inline">Source</span>
        </button>
      </div>
    </header>
    <div class="flex flex-col flex-1 min-h-0">
      {#key current.id}
        {#await current.load()}
          <div class="flex flex-1 items-center justify-center text-sm" style="color: var(--sg-muted);">
            Loading demo…
          </div>
        {:then mod}
          {@const Current = mod.default}
          <Current />
        {:catch}
          <div class="flex flex-1 items-center justify-center text-sm" style="color: var(--sg-muted);">
            Failed to load this demo. Try refreshing the page.
          </div>
        {/await}
      {/key}
    </div>
  </main>
</div>

{#if showSource}
  <SourceModal
    title={current.title}
    source={sourceText ?? '// Loading source…'}
    onClose={() => (showSource = false)}
  />
{/if}

<style>
  /* ---- Mobile sidebar drawer ------------------------------------------
     On >=768px the sidebar is a normal in-flow column. Below that it
     becomes a fixed slide-in drawer so the demo gets the full width. */
  .demo-menu-btn,
  .demo-aside-close {
    display: none;
    align-items: center;
    justify-content: center;
    color: var(--sg-fg);
    background: transparent;
    border: 1px solid var(--sg-border);
    border-radius: 8px;
    cursor: pointer;
  }
  .demo-menu-btn { width: 38px; height: 38px; flex-shrink: 0; }
  .demo-aside-close {
    width: 30px; height: 30px;
    font-size: 22px; line-height: 1;
    border: 0;
  }
  @media (max-width: 767px) {
    .demo-menu-btn { display: inline-flex; }
    .demo-aside-close { display: inline-flex; }
    .demo-aside {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: 84vw;
      max-width: 320px;
      z-index: 60;
      background: var(--site-bg);
      transform: translateX(-100%);
      transition: transform 200ms ease;
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.35);
    }
    .demo-aside.is-open { transform: translateX(0); }
    .demo-backdrop {
      position: fixed;
      inset: 0;
      z-index: 55;
      background: rgba(0, 0, 0, 0.45);
      border: 0;
    }
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
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1));
    background: var(--sg-input-bg, var(--sg-bg, #0b1220));
    color: var(--sg-fg, #e2e8f0);
    border-radius: 8px;
    padding: 7px 36px 7px 32px;
    font-size: 13px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .demo-search-input::placeholder { color: var(--sg-muted, #94a3b8); }
  .demo-search-input:focus {
    border-color: var(--sg-accent, #3b82f6);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--sg-accent, #3b82f6) 22%, transparent);
  }
  .demo-search-input::-webkit-search-cancel-button { display: none; }
  .demo-search-kbd {
    position: absolute; right: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    padding: 1px 6px;
    border: 1px solid var(--sg-border, #374151);
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
  .demo-search-clear:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.15)); color: var(--sg-fg, #e2e8f0); }

  .demo-row { display: flex; align-items: baseline; gap: 8px; }
  .demo-row-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .demo-row-cat {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
    flex-shrink: 0;
  }
  :global(.demo-search-hit) {
    background: color-mix(in oklab, var(--sg-accent, #3b82f6) 30%, transparent);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
  }

  /* Collapsible category groups (DevExpress / Kendo style sidebar) */
  .demo-group-head { cursor: pointer; }
  .demo-group-head:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.08)); }
  .demo-group-chev { flex-shrink: 0; transition: transform 140ms ease; }
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
    color: var(--sg-fg);
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
    color: var(--sg-muted);
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.15));
    border-radius: 10px;
    padding: 1px 7px;
  }
  .gh-star:hover .gh-star-count {
    color: #f59e0b;
    background: color-mix(in oklab, #f59e0b 14%, transparent);
  }
</style>
