<script lang="ts">
  /**
   * Demos route - mirrors examples/src/App.svelte so the look inside the
   * website is indistinguishable from `pnpm dev` on the gallery package.
   * The only changes vs. the original: hash-routed under /demos, theme
   * locked to dark, no theme toggle.
   */
  import { tick, untrack } from 'svelte'
  import { demos, demoGroups, findDemo, type DemoCategory } from '../lib/demos'
  import SourceModal from '../components/SourceModal.svelte'
  import { openInStackBlitz } from '../lib/stackblitz'
  import { downloadProject } from '../lib/project-export'
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

  let downloading = $state(false)
  async function downloadProjectZip() {
    downloading = true
    try {
      const src = await current.loadSource()
      await downloadProject(src, current.id, current.title)
    } catch (e) {
      console.error('project download failed', e)
    } finally {
      downloading = false
    }
  }

  // ---- Theme preset chooser (shadcn / Excel / Fluent / Material) ----------
  type Preset =
    | 'default' | 'shadcn' | 'tailwind' | 'material'
    | 'excel' | 'fluent'
    | 'carbon' | 'sap' | 'salesforce' | 'atlassian' | 'github' | 'antd'
    | 'ag-alpine'
    | 'bootstrap' | 'vercel' | 'linear' | 'notion'
    | 'nord' | 'dracula' | 'catppuccin'
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

  // ---- Nav mode switcher (list tree vs card grid) -----------------------
  type NavMode = 'list' | 'grid'
  function readNavMode(): NavMode {
    try { return localStorage.getItem('sg-nav-mode') === 'grid' ? 'grid' : 'list' } catch { return 'list' }
  }
  let navMode = $state<NavMode>(readNavMode())
  $effect(() => {
    try { localStorage.setItem('sg-nav-mode', navMode) } catch { /* ignore */ }
  })

  // ---- Grid-mode search / category filter --------------------------------
  let gridQuery = $state('')
  let gridCategory = $state<DemoCategory | null>(null)
  let gridSearchEl = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (navMode === 'grid') tick().then(() => gridSearchEl?.focus())
  })

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && navMode === 'grid') navMode = 'list'
  }

  function gridTokens(q: string): string[] {
    return q.toLowerCase().split(/\s+/).filter(Boolean)
  }
  const gridToks = $derived(gridTokens(gridQuery))
  function scoreDemo(d: { title: string; blurb: string; category: string; id: string }, toks: string[]): number {
    if (!toks.length) return 1
    const title = d.title.toLowerCase(); const blurb = d.blurb.toLowerCase()
    const cat = d.category.toLowerCase(); const id = d.id.toLowerCase()
    let total = 0
    for (const tok of toks) {
      let s = 0
      if (title.startsWith(tok)) s += 60
      else if (title.includes(tok)) s += 30
      if (id.includes(tok)) s += 18
      if (cat.includes(tok)) s += 12
      if (blurb.includes(tok)) s += 8
      if (s === 0) return -1
      total += s
    }
    return total
  }
  const gridDemos = $derived.by(() => {
    const scoped = gridCategory ? demos.filter((d) => d.category === gridCategory) : demos
    if (!gridToks.length) return scoped
    return scoped
      .map((d) => ({ d, s: scoreDemo(d, gridToks) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.d)
  })

  const THUMB_BASE = `/thumbs/`

  // ---- List-mode search -------------------------------------------------
  let listQuery = $state('')
  const listToks = $derived(gridTokens(listQuery))
  const listDemos = $derived.by(() => {
    if (!listToks.length) return []
    return demos
      .map((d) => ({ d, s: scoreDemo(d, listToks) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.d)
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
  let asideEl = $state<HTMLElement | null>(null)

  // When the active demo changes, make sure its group is open and scroll the
  // tree so the active item is in view. `untrack` reading openGroups keeps this
  // from re-firing (and reopening) when the user later collapses a group.
  $effect(() => {
    const id = current.id
    const cat = current.category
    untrack(() => {
      if (!(cat in openGroups)) {
        openGroups = { ...openGroups, [cat]: true, 'Getting Started': true }
      } else if (!openGroups[cat]) {
        openGroups = { ...openGroups, [cat]: true }
      }
    })
    tick().then(() => {
      const el = asideEl?.querySelector<HTMLElement>(`[data-demo-id="${CSS.escape(id)}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
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

<svelte:window onkeydown={handleGlobalKeydown} />
<div class="demo-page flex h-full min-h-0" style="position: relative">
  {#if mobileNav}
    <button
      type="button"
      class="demo-backdrop md:hidden"
      aria-label="Close menu"
      onclick={() => (mobileNav = false)}
    ></button>
  {/if}
  <aside
    bind:this={asideEl}
    class="demo-aside shrink-0 border-r p-4 overflow-y-auto"
    class:is-open={mobileNav}
    style="border-color: var(--sg-border)"
  >
    <div class="mb-4 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold">SvGrid</h1>
        <p class="text-xs" style="color: var(--sg-muted)">Examples gallery</p>
      </div>
      <div class="demo-nav-toggle" role="group" aria-label="Navigation view">
        <button
          type="button"
          class="demo-nav-btn"
          class:is-active={navMode === 'list'}
          aria-pressed={navMode === 'list'}
          title="List view"
          onclick={() => (navMode = 'list')}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
        <button
          type="button"
          class="demo-nav-btn"
          class:is-active={navMode === 'grid'}
          aria-pressed={navMode === 'grid'}
          title="Card grid view"
          onclick={() => (navMode = 'grid')}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
            <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
          </svg>
        </button>
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

    <div class="list-search-wrap mb-3">
      <svg class="list-search-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
      </svg>
      <input
        bind:value={listQuery}
        type="search"
        class="list-search"
        placeholder="Filter demos…"
        aria-label="Filter demos"
      />
      {#if listQuery}
        <button type="button" class="list-search-clear" onclick={() => (listQuery = '')} aria-label="Clear filter">×</button>
      {/if}
    </div>

    <nav aria-label="Examples">
      {#if listQuery}
        {#if listDemos.length === 0}
          <p class="list-search-empty">No matches for <em>"{listQuery}"</em></p>
        {:else}
          <ul class="space-y-0.5 pb-2">
            {#each listDemos as demo (demo.id)}
              {@const active = demo.id === current.id}
              <li>
                <button
                  type="button"
                  data-demo-id={demo.id}
                  onclick={() => go(demo.id)}
                  class="demo-leaf w-full text-left rounded pl-3 pr-3 py-1.5 text-sm transition-colors"
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
                      data-demo-id={demo.id}
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

  {#if navMode === 'grid'}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="browse-backdrop" onclick={() => (navMode = 'list')} aria-hidden="true"></div>
    <div class="browse-panel" role="dialog" aria-label="Browse demos">
      <div class="demo-grid-search-wrap mb-3">
        <svg class="demo-grid-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input
          bind:this={gridSearchEl}
          bind:value={gridQuery}
          type="search"
          class="demo-grid-search"
          placeholder="Search demos…"
          aria-label="Search demos"
        />
        {#if gridQuery}
          <button type="button" class="demo-grid-search-clear" onclick={() => (gridQuery = '')} aria-label="Clear search">×</button>
        {/if}
      </div>

      <div class="demo-grid-cats mb-3">
        <button
          type="button"
          class="demo-grid-cat"
          class:is-active={gridCategory === null}
          onclick={() => (gridCategory = null)}
        >All</button>
        {#each demoGroups as g (g.category)}
          <button
            type="button"
            class="demo-grid-cat"
            class:is-active={gridCategory === g.category}
            onclick={() => (gridCategory = gridCategory === g.category ? null : g.category)}
          >{g.category}</button>
        {/each}
      </div>

      <div class="demo-cards" role="list">
        {#each gridDemos as demo (demo.id)}
          {@const active = demo.id === current.id}
          <button
            type="button"
            role="listitem"
            class="demo-card"
            class:is-active={active}
            onclick={() => { go(demo.id); navMode = 'list' }}
            title={demo.blurb}
          >
            <div class="demo-card-thumb">
              <img
                src={`${THUMB_BASE}${demo.id}.webp`}
                alt=""
                loading="lazy"
                decoding="async"
                onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
              {#if demo.pro}<span class="demo-card-pro">Enterprise</span>{/if}
            </div>
            <div class="demo-card-meta">
              <span class="demo-card-cat">{demo.category}</span>
              <span class="demo-card-title">{demo.title}</span>
              <span class="demo-card-blurb">{demo.blurb}</span>
            </div>
          </button>
        {/each}
        {#if gridDemos.length === 0}
          <p class="demo-grid-empty">No demos match <em>"{gridQuery}"</em></p>
        {/if}
      </div>
    </div>
  {/if}

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
          onclick={() => router.navigate(`playground/${current.id}`)}
          class="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm"
          style="border-color: var(--sg-border); color: var(--sg-fg); background: transparent;"
          title="Open this demo in the live playground - edit a config and preview instantly"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
          <span class="hidden sm:inline">Edit</span>
        </button>
        <button
          type="button"
          onclick={downloadProjectZip}
          disabled={downloading}
          class="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm disabled:opacity-60"
          style="border-color: var(--sg-border); color: var(--sg-fg); background: transparent;"
          title="Download a runnable npm project (npm install && npm run dev)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
          </svg>
          <span class="hidden sm:inline">{downloading ? 'Zipping…' : 'Project'}</span>
        </button>
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
  /* Navigation-tree scrollbar. Uses the same `--sg-scrollbar-*` tokens the grid
     styles its own scrollbar with - each theme preset (and light/dark) sets
     them on `.demo-page`, so the sidebar scrollbar matches the chosen theme's
     surface + neutral tones exactly, instead of an accent-colored thumb. */
  .demo-aside {
    width: 288px;
    transition: width 180ms ease;
    scrollbar-width: thin;
    scrollbar-color: var(--sg-scrollbar-thumb, #b1bccd) var(--sg-scrollbar-bg, transparent);
  }
  /* ---- Browse panel (appears to right of sidebar in grid/card mode) ------- */
  .browse-backdrop {
    position: absolute;
    left: 288px; top: 0; right: 0; bottom: 0;
    z-index: 49;
    background: rgba(0, 0, 0, 0.25);
  }
  .browse-panel {
    position: absolute;
    left: 288px; top: 0; bottom: 0; right: 0;
    z-index: 50;
    overflow-y: auto;
    padding: 16px 14px;
    background: var(--sg-bg, #fff);
    border-left: 1px solid var(--sg-border, #e2e8f0);
    scrollbar-width: thin;
    scrollbar-color: var(--sg-scrollbar-thumb, #b1bccd) var(--sg-scrollbar-bg, transparent);
  }

  /* ---- Nav mode toggle (list / grid) -------------------------------------- */
  .demo-nav-toggle {
    display: inline-flex;
    border: 1px solid var(--sg-border, #334155);
    border-radius: 7px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--sg-bg);
  }
  .demo-nav-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 28px;
    background: transparent;
    border: 0;
    color: var(--sg-muted);
    cursor: pointer;
    transition: background 120ms, color 120ms;
  }
  .demo-nav-btn:hover { color: var(--sg-fg); }
  .demo-nav-btn.is-active {
    background: var(--sg-accent, #3b82f6);
    color: var(--sg-on-accent, #fff);
  }
  .demo-nav-btn + .demo-nav-btn { border-left: 1px solid var(--sg-border, #334155); }

  /* ---- Grid view: search -------------------------------------------------- */
  .demo-grid-search-wrap {
    position: relative;
    display: flex; align-items: center;
  }
  .demo-grid-search-icon {
    position: absolute; left: 9px;
    color: var(--sg-muted, #64748b);
    pointer-events: none;
  }
  .demo-grid-search {
    width: 100%;
    padding: 7px 28px 7px 30px;
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border: 1px solid var(--sg-input-border, var(--sg-border));
    border-radius: 8px;
    font-size: 13px;
  }
  .demo-grid-search:focus { outline: none; border-color: var(--sg-accent, #3b82f6); }
  .demo-grid-search-clear {
    position: absolute; right: 8px;
    background: transparent; border: 0;
    color: var(--sg-muted, #64748b);
    cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px;
  }

  /* ---- Grid view: category chips ------------------------------------------ */
  .demo-grid-cats {
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .demo-grid-cat {
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid var(--sg-border, #334155);
    background: transparent;
    color: var(--sg-muted, #94a3b8);
    font-size: 11px; cursor: pointer;
    transition: background 120ms, color 120ms, border-color 120ms;
    white-space: nowrap;
  }
  .demo-grid-cat:hover { color: var(--sg-fg); border-color: var(--sg-accent, #3b82f6); }
  .demo-grid-cat.is-active {
    background: var(--sg-accent, #3b82f6);
    border-color: var(--sg-accent, #3b82f6);
    color: #fff;
  }

  /* ---- Grid view: cards --------------------------------------------------- */
  .demo-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    align-content: start;
    padding: 4px 2px;
  }
  .demo-card {
    display: flex; flex-direction: column;
    background: var(--sg-header-bg, rgba(255,255,255,0.04));
    border: 1px solid var(--sg-border, #334155);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: border-color 120ms, box-shadow 120ms, transform 120ms;
  }
  .demo-card:hover {
    border-color: var(--sg-accent, #3b82f6);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.18);
  }
  .demo-card.is-active {
    border-color: var(--sg-accent, #3b82f6);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--sg-accent, #3b82f6) 30%, transparent);
  }
  .demo-card-thumb {
    position: relative;
    width: 100%;
    padding-top: 56.25%; /* 16:9 */
    background: color-mix(in oklab, var(--sg-accent, #3b82f6) 8%, var(--sg-bg, #0b1220));
    overflow: hidden;
    flex-shrink: 0;
  }
  .demo-card-thumb img {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    object-fit: cover; object-position: top left;
    display: block;
  }
  .demo-card-pro {
    position: absolute; top: 6px; right: 6px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
    padding: 2px 6px; border-radius: 3px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
  }
  .demo-card-meta {
    display: flex; flex-direction: column; gap: 4px;
    padding: 10px 12px 12px;
    flex: 1;
  }
  .demo-card-cat {
    font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-accent, #3b82f6);
  }
  .demo-card-title {
    font-size: 13px; font-weight: 600; line-height: 1.3;
    color: var(--sg-fg, #e2e8f0);
  }
  .demo-card-blurb {
    font-size: 11.5px; line-height: 1.5;
    color: var(--sg-muted, #64748b);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .demo-grid-empty {
    grid-column: 1 / -1;
    padding: 16px 0;
    text-align: center;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .demo-aside::-webkit-scrollbar { width: 12px; height: 12px; }
  .demo-aside::-webkit-scrollbar-track {
    background: var(--sg-scrollbar-bg, transparent);
    box-shadow: inset 1px 0 0 0 var(--sg-scrollbar-border, transparent);
  }
  .demo-aside::-webkit-scrollbar-thumb {
    background: var(--sg-scrollbar-thumb, #b1bccd);
    border-radius: var(--sg-scrollbar-thumb-radius, 6px);
    border: 3px solid transparent;
    background-clip: padding-box;
  }
  .demo-aside::-webkit-scrollbar-thumb:hover { background: var(--sg-scrollbar-thumb-hover, #8693a7); }
  .demo-aside::-webkit-scrollbar-thumb:active { background: var(--sg-scrollbar-thumb-active, #64748b); }

  /* ---- List-mode search --------------------------------------------------- */
  .list-search-wrap {
    position: relative;
    display: flex; align-items: center;
  }
  .list-search-icon {
    position: absolute; left: 8px;
    color: var(--sg-muted);
    pointer-events: none;
  }
  .list-search {
    width: 100%;
    padding: 5px 24px 5px 26px;
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border: 1px solid var(--sg-input-border, var(--sg-border));
    border-radius: 7px;
    font-size: 12px;
  }
  .list-search:focus { outline: none; border-color: var(--sg-accent, #3b82f6); }
  .list-search-clear {
    position: absolute; right: 6px;
    background: transparent; border: 0;
    color: var(--sg-muted); cursor: pointer;
    font-size: 15px; line-height: 1; padding: 0 2px;
  }
  .list-search-empty {
    padding: 8px 10px;
    font-size: 12px;
    color: var(--sg-muted);
  }

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
