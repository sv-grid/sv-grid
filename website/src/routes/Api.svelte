<script lang="ts">
  import { tick } from 'svelte'
  import { sections, sectionGroups, findSection, memberHeading, MEMBER_GROUPS, GROUP_LINKS, type ApiProp } from '../lib/api-reference'
  import { getApiDemo } from '../lib/api-demos'
  import { openSnippetInStackBlitz } from '../lib/stackblitz'
  import { router } from '../lib/router.svelte'

  let { apiRoute = '' }: { apiRoute?: string } = $props()

  // The active section lives in the URL (/api/<sectionId>) so the page is
  // bookmarkable / shareable and browser back-forward works. `apiRoute` is the
  // path segment after /api; fall back to the first section.
  const validSection = (r: string): string => {
    const id = (r || '').split(/[#?]/)[0]!
    return sections.some((s) => s.id === id) ? id : sections[0]!.id
  }
  // Section is derived straight from the URL, so nav clicks and browser
  // back/forward (which both change apiRoute) update the page automatically.
  const selectedId = $derived(validSection(apiRoute))
  const current = $derived(findSection(selectedId))
  const demo = $derived(getApiDemo(current.demo))

  // ---- Member sub-grouping (large sections) -----------------------------
  // Sections listed in MEMBER_GROUPS render their members under labeled
  // subheaders; everything else stays a flat list. The interleaved row list
  // below carries either a group header or a prop, so the table's {#each} can
  // render both.
  type MemberLinks = { docs?: string; demo?: string }
  type DisplayRow = { kind: 'header'; label: string } | { kind: 'prop'; p: ApiProp; links?: MemberLinks }
  const baseName = (n: string): string => n.split('/')[0]!.replace(/\(.*$/, '').trim()
  const displayRows = $derived.by<DisplayRow[]>(() => {
    const props = current.props ?? []
    const groups = MEMBER_GROUPS[current.id]
    if (!groups) return props.map((p) => ({ kind: 'prop' as const, p }))
    const used = new Set<string>()
    const out: DisplayRow[] = []
    for (const g of groups) {
      const items = props
        .filter((p) => g.members.includes(baseName(p.name)))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
      if (!items.length) continue
      const links = GROUP_LINKS[`${current.id}::${g.label}`]
      out.push({ kind: 'header', label: g.label })
      for (const p of items) { used.add(p.name); out.push({ kind: 'prop', p, links }) }
    }
    const other = props.filter((p) => !used.has(p.name)).slice().sort((a, b) => a.name.localeCompare(b.name))
    if (other.length) {
      out.push({ kind: 'header', label: 'Other' })
      for (const p of other) out.push({ kind: 'prop', p })
    }
    return out
  })

  function go(id: string) {
    // Drive the section through the URL; the $effect above syncs selectedId.
    router.navigate('api/' + id)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    // Switching sections collapses any open per-prop example / type-peek
    // panels - rows would not match up across sections anyway.
    expanded = {}
    openTypePeek = {}
  }

  // ---- Clickable type references ----------------------------------------
  // Map a documented type name -> the section that defines it, so a type in
  // the props table (e.g. `ColumnDef[]` on the `columns` prop) links straight
  // to its own section instead of forcing the reader to hunt for it in the nav.
  const TYPE_ALIASES: Record<string, string> = (() => {
    const map: Record<string, string> = {}
    for (const s of sections) {
      // Sections whose title IS a bare type name: ColumnDef, CellFormatConfig,
      // SvGridFilterOperator, SvGridApi, ...
      if (/^[A-Z][A-Za-z0-9]+$/.test(s.title.trim())) map[s.title.trim()] = s.id
    }
    // The multi-type "Row / Cell / Column / Context" section + the context
    // objects passed to cell / header / editor templates.
    Object.assign(map, {
      Row: 'core-types', Cell: 'core-types', Column: 'core-types',
      CellContext: 'core-types', HeaderContext: 'core-types', EditorContext: 'core-types',
    })
    return map
  })()

  type TypeSeg = { text: string; to?: string }
  // Split a type string into identifier / punctuation segments and tag any
  // identifier that resolves to a documented section. Splitting on a captured
  // group keeps the punctuation, so the reconstructed type reads verbatim.
  function linkifyType(type: string, currentId: string): TypeSeg[] {
    return type
      .split(/([A-Za-z_$][A-Za-z0-9_$]*)/)
      .filter((seg) => seg !== '')
      .map((seg) => {
        const to = TYPE_ALIASES[seg]
        return to && to !== currentId ? { text: seg, to } : { text: seg }
      })
  }

  // Per-row "Show example" panels. Keyed by `${sectionId}::${propName}` so a
  // user can keep one open across re-renders within a section.
  let expanded = $state<Record<string, boolean>>({})
  function toggleExample(key: string) {
    expanded[key] = !expanded[key]
  }

  // Inline "peek" of a referenced type's members: clicking a type in the Type
  // column expands that type's properties in a nested table under the row, so
  // the reader never has to leave the section they're on. Keyed by prop key ->
  // target section id (empty = closed); one peek per prop row at a time.
  let openTypePeek = $state<Record<string, string>>({})
  function toggleTypePeek(key: string, sectionId: string) {
    // The type peek is part of the row's expand panel. Clicking a type opens
    // the row and shows that type inline; clicking the same shown type collapses.
    if (expanded[key] && openTypePeek[key] === sectionId) {
      expanded[key] = false
    } else {
      openTypePeek[key] = sectionId
      expanded[key] = true
    }
  }

  // The first documented type referenced by a member's type string (or '').
  function firstDocumentedType(p: ApiProp): string {
    for (const seg of linkifyType(p.type, current.id)) if (seg.to) return seg.to
    return ''
  }

  // Per-row "Copy code" feedback. Cleared on a timer so the visual ack
  // doesn't linger after the user moves on.
  let copied = $state<string>('')
  let copyTimer: ReturnType<typeof setTimeout> | null = null
  function copyCode(key: string, code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      copied = key
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => {
        if (copied === key) copied = ''
      }, 1400)
    })
  }

  // ---- Global member search ---------------------------------------------
  // Flatten every section's props / methods / events into one index so a user
  // can find any of the ~281 members by name or description without first
  // knowing which section it lives in. Selecting a hit jumps to the section
  // AND scrolls to (and briefly flashes) the exact row.
  type MemberHit = {
    sectionId: string
    sectionTitle: string
    category: string
    name: string
    type: string
    description: string
  }
  const allMembers: MemberHit[] = sections.flatMap((s) =>
    (s.props ?? []).map((p) => ({
      sectionId: s.id,
      sectionTitle: s.title,
      category: s.category,
      name: p.name,
      type: p.type,
      description: p.description,
    })),
  )

  let query = $state('')
  let searchEl = $state<HTMLInputElement | null>(null)

  function memberScore(m: MemberHit, toks: string[]): number {
    const name = m.name.toLowerCase()
    const title = m.sectionTitle.toLowerCase()
    const type = m.type.toLowerCase()
    const desc = m.description.toLowerCase()
    let total = 0
    for (const tok of toks) {
      let s = 0
      if (name === tok) s += 100
      else if (name.startsWith(tok)) s += 70
      else if (name.includes(tok)) s += 45
      if (title.includes(tok)) s += 14
      if (type.includes(tok)) s += 8
      if (desc.includes(tok)) s += 6
      if (s === 0) return -1 // every token must match somewhere
      total += s
    }
    return total
  }

  const searchResults = $derived.by(() => {
    const toks = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (toks.length === 0) return null
    return allMembers
      .map((m) => ({ m, score: memberScore(m, toks) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((r) => r.m)
  })

  // A stable DOM id per member row so a search hit can scroll to it.
  function rowId(sectionId: string, name: string): string {
    return `api-prop-${sectionId}--${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  }

  // The member we just jumped to; flashes its row for ~1.6s.
  let flashKey = $state('')
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  // Scroll a member's row into view and flash it (its section must be active).
  async function flashMember(sectionId: string, name: string) {
    await tick()
    const el = document.getElementById(rowId(sectionId, name))
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    const key = `${sectionId}::${name}`
    flashKey = key
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { if (flashKey === key) flashKey = '' }, 1600)
  }

  // Reflect (or clear) the focused member in the URL query so a single row is
  // shareable: /api/<section>?m=<member>. replaceState keeps history tidy.
  function setMemberQuery(name: string | null) {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (name) url.searchParams.set('m', baseName(name))
    else url.searchParams.delete('m')
    history.replaceState({}, '', url)
  }

  async function goToMember(m: MemberHit) {
    expanded = {}
    openTypePeek = {}
    if (m.sectionId !== selectedId) router.navigate('api/' + m.sectionId)
    await tick()
    setMemberQuery(m.name)
    await flashMember(m.sectionId, m.name)
  }

  // Honor a ?m=<member> deep link once the target section is active.
  $effect(() => {
    const wanted = new URLSearchParams(window.location.search).get('m')
    if (!wanted) return
    const prop = (current.props ?? []).find((p) => baseName(p.name) === wanted)
    if (prop) flashMember(current.id, prop.name)
  })

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      query = ''
      searchEl?.blur()
    } else if (e.key === 'Enter' && searchResults && searchResults.length > 0) {
      e.preventDefault()
      goToMember(searchResults[0]!)
    }
  }

  // Global `/` focuses the search (matches the demos gallery).
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
</script>

{#snippet resultsList(results: MemberHit[])}
  {#if results.length === 0}
    <p class="px-2 py-3 text-xs" style="color: var(--sg-muted);">
      No API member matches <em>"{query}"</em>.
    </p>
  {:else}
    <p class="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style="color: var(--sg-muted);">
      {results.length} match{results.length === 1 ? '' : 'es'} · Enter opens the top hit
    </p>
    <ul class="space-y-0.5">
      {#each results as m (m.sectionId + '::' + m.name)}
        <li>
          <button type="button" class="api-hit w-full text-left rounded px-3 py-1.5" onclick={() => goToMember(m)}>
            <span class="api-hit-name font-mono">{m.name}</span>
            <span class="api-hit-sec">{m.sectionTitle}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<!--
  Layout:
  - The outer container is a normal flex row with no fixed height, so the
    page scrolls with the browser (no inner scrollbar inside <main>).
  - The sidebar is `position: sticky` so it stays visible while the
    reference content scrolls past on the right.
  - On mobile the sidebar hides; the user gets a top "Jump to" select
    fallback further down.
-->
<div class="api-shell flex">
  <aside
    class="api-sidebar hidden md:block w-72 shrink-0 border-r p-4"
    style="border-color: var(--sg-border)"
  >
    <div class="mb-6">
      <h1 class="text-lg font-semibold">SvGrid</h1>
      <p class="text-xs" style="color: var(--sg-muted)">
        API reference · {sections.length} sections
      </p>
    </div>

    <div class="api-search-wrap mb-4">
      <svg class="api-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        bind:this={searchEl}
        bind:value={query}
        type="search"
        placeholder="Search API…"
        aria-label="Search API members"
        class="api-search-input"
        onkeydown={onSearchKey}
      />
      {#if query}
        <button type="button" class="api-search-clear" aria-label="Clear search" onclick={() => (query = '')}>×</button>
      {:else}
        <kbd class="api-search-kbd" aria-hidden="true">/</kbd>
      {/if}
    </div>

    <nav aria-label="API sections">
      {#if searchResults !== null}
        {@render resultsList(searchResults)}
      {:else}
      {#each sectionGroups as group (group.category)}
        <div class="mb-4">
          <p
            class="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style="color: var(--sg-muted);"
          >
            {group.category}
          </p>
          <ul class="space-y-1">
            {#each group.items as s (s.id)}
              {@const active = s.id === current.id}
              <li>
                <button
                  type="button"
                  onclick={() => go(s.id)}
                  class="w-full text-left rounded px-3 py-2 text-sm transition-colors"
                  style:background={active ? 'var(--sg-row-hover-bg)' : 'transparent'}
                  style:color={active ? 'var(--sg-fg)' : 'var(--sg-fg)'}
                  style:font-weight={active ? '600' : '400'}
                >
                  {s.title}
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
      {/if}
    </nav>

    <p class="mt-8 text-xs" style="color: var(--sg-muted)">
      Curated from the public type sources. The data behind this page lives
      in <code>website/src/lib/api-reference.ts</code>.
    </p>
  </aside>

  <main class="flex flex-col flex-1 p-6 max-w-5xl">
    <!-- Mobile-only section picker; the desktop sidebar handles this on md+. -->
    <div class="md:hidden mb-6">
      <div class="api-search-wrap mb-3">
        <svg class="api-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          bind:value={query}
          type="search"
          placeholder="Search API…"
          aria-label="Search API members"
          class="api-search-input"
          onkeydown={onSearchKey}
        />
        {#if query}
          <button type="button" class="api-search-clear" aria-label="Clear search" onclick={() => (query = '')}>×</button>
        {/if}
      </div>
      {#if searchResults !== null}
        <div class="mb-2">{@render resultsList(searchResults)}</div>
      {/if}
      <label class="text-xs uppercase tracking-wider" style="color: var(--sg-muted);" for="api-mobile-jump">
        Jump to
      </label>
      <select
        id="api-mobile-jump"
        class="mt-1 w-full rounded border p-2 text-sm"
        style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);"
        value={selectedId}
        onchange={(e) => go((e.currentTarget as HTMLSelectElement).value)}
      >
        {#each sectionGroups as group (group.category)}
          <optgroup label={group.category}>
            {#each group.items as s (s.id)}
              <option value={s.id}>{s.title}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>

    <header class="mb-8">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
        {current.category}
      </p>
      <h1
        class="mt-2 text-3xl md:text-4xl font-bold tracking-tight"
        style="color: var(--sg-fg);"
      >
        {current.title}
      </h1>
      <p class="mt-3 text-base md:text-lg" style="color: var(--site-muted);">{current.blurb}</p>
    </header>

    {#if current.intro}
      <div class="space-y-4 mb-8">
        {#each current.intro as para}
          <p style="color: var(--sg-fg)" class="text-base leading-relaxed">{para}</p>
        {/each}
      </div>
    {/if}

    {#if demo}
      {@const DemoComponent = demo}
      <div class="mb-10">
        <div class="flex items-center gap-2 mb-3">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style="background: rgba(34,197,94,0.15); color: #16a34a;"
          >
            <span
              style="width: 7px; height: 7px; border-radius: 9999px; background: #22c55e; display: inline-block;"
            ></span>
            Live example
          </span>
          <span class="text-xs" style="color: var(--sg-muted);">Runs the real grid - edit, sort, filter, click.</span>
        </div>
        <div
          class="rounded-xl border p-4"
          style="border-color: var(--sg-border); background: var(--sg-bg);"
        >
          {#key current.id}
            <DemoComponent />
          {/key}
        </div>
      </div>
    {/if}

    {#if current.signature}
      <h2 class="mt-4 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Signature
      </h2>
      <pre class="rounded-lg border p-4 text-sm overflow-x-auto font-mono leading-relaxed"
        style="border-color: var(--sg-border); background: #0a1124; color: #e2e8f0;"><code>{current.signature}</code></pre>
    {/if}

    {#if current.props && current.props.length > 0}
      <h2 class="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        {memberHeading(current.category)}
      </h2>
      <div class="overflow-x-auto rounded-lg border" style="border-color: var(--sg-border);">
        <table class="w-full text-sm">
          <thead>
            <tr style="background: var(--sg-row-alt-bg);">
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Name</th>
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Type</th>
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Default</th>
              <th class="p-3 text-left font-semibold" style="color: var(--sg-fg);">Description</th>
            </tr>
          </thead>
          <tbody>
            {#each displayRows as item, i (item.kind === 'header' ? `h:${item.label}` : item.p.name)}
              {#if item.kind === 'header'}
              <tr class="api-group-row">
                <td colspan="4">{item.label}</td>
              </tr>
              {:else}
              {@const p = item.p}
              {@const key = `${current.id}::${p.name}`}
              {@const isOpen = !!expanded[key]}
              {@const hasType = firstDocumentedType(p)}
              {@const rowBg = i % 2 === 0 ? 'var(--sg-header-bg)' : 'var(--sg-bg)'}
              <tr id={rowId(current.id, p.name)} class:api-prop-flash={flashKey === key} style:background={rowBg} style="border-top: 1px solid var(--sg-border)">
                <td class="p-3 align-top font-mono" style="color: var(--sg-fg);">
                  <div class="flex items-center gap-2">
                    {#if p.example || hasType}
                      <button
                        type="button"
                        class="api-expand"
                        aria-expanded={isOpen}
                        aria-controls={`example-${key}`}
                        title={isOpen ? 'Hide details' : hasType ? 'Show example + type' : 'Show example'}
                        onclick={() => toggleExample(key)}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.4"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                          style:transform={isOpen ? 'rotate(90deg)' : 'rotate(0deg)'}
                          style="transition: transform 140ms ease;"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    {:else}
                      <span class="api-expand-placeholder" aria-hidden="true"></span>
                    {/if}
                    <span>{p.name}</span>
                    {#if p.required}
                      <span
                        class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style="background: rgba(239,68,68,0.15); color: #fca5a5;"
                      >
                        Required
                      </span>
                    {/if}
                  </div>
                  {#if p.since}
                    <div class="mt-0.5 text-[11px]" style="color: var(--sg-muted);">since {p.since}</div>
                  {/if}
                </td>
                <td class="p-3 align-top font-mono text-xs" style="color: var(--site-accent-2);">{#each linkifyType(p.type, current.id) as seg}{#if seg.to}<button type="button" class="api-type-link" class:is-open={isOpen && (openTypePeek[key] || hasType) === seg.to} aria-expanded={isOpen && (openTypePeek[key] || hasType) === seg.to} title={`Show ${seg.text} properties`} onclick={() => toggleTypePeek(key, seg.to!)}>{seg.text}</button>{:else}{seg.text}{/if}{/each}</td>
                <td class="p-3 align-top font-mono text-xs" style="color: var(--sg-muted);">{p.default ?? ''}</td>
                <td class="p-3 align-top" style="color: var(--sg-fg);">
                  <div>{p.description}</div>
                  {#if item.links && (item.links.demo || item.links.docs)}
                    <div class="api-links">
                      {#if item.links.demo}
                        <a class="api-link-pill" href={`#/demos/${item.links.demo}`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                          Demo
                        </a>
                      {/if}
                      {#if item.links.docs}
                        <a class="api-link-pill" href={`#/docs/${item.links.docs}`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                          Docs
                        </a>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
              {#if isOpen && p.example}
                <tr style:background={rowBg} id={`example-${key}`}>
                  <td colspan="4" class="px-3 pb-4 pt-0">
                    <div
                      class="api-example-panel rounded-lg border p-3"
                      style="border-color: var(--sg-border); background: #0a1124;"
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style="background: rgba(249,115,22,0.18); color: #fdba74;"
                          >
                            Example
                          </span>
                          <code class="text-xs" style="color: #cbd5e1;">{p.name}</code>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            class="api-example-btn"
                            onclick={() => copyCode(key, p.example ?? '')}
                          >
                            {#if copied === key}
                              <svg
                                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e"
                                stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              Copied
                            {:else}
                              <svg
                                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                              >
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                              </svg>
                              Copy code
                            {/if}
                          </button>
                          <button
                            type="button"
                            class="api-example-btn api-example-btn-primary"
                            title="Open this snippet as an editable Svelte 5 + @svgrid/grid project in StackBlitz"
                            onclick={() =>
                              openSnippetInStackBlitz({
                                sectionTitle: current.title,
                                sectionCategory: current.category,
                                propName: p.name,
                                propType: p.type,
                                description: p.description,
                                code: p.example ?? '',
                              })}
                          >
                            <svg
                              width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                            >
                              <path d="M10.797 14.182H3.635L16.728 0l-3.525 9.818h7.162L7.272 24l3.525-9.818Z" />
                            </svg>
                            Run in StackBlitz
                          </button>
                        </div>
                      </div>
                      <pre
                        class="text-xs leading-relaxed overflow-x-auto"
                        style="color: #e2e8f0; margin: 0;"
                      ><code>{p.example}</code></pre>
                    </div>
                  </td>
                </tr>
              {/if}
              {#if isOpen && (openTypePeek[key] || hasType)}
                {@const peekId = openTypePeek[key] || hasType}
                {@const peek = findSection(peekId)}
                <tr style:background={rowBg}>
                  <td colspan="4" class="px-3 pb-4 pt-1">
                    <div class="api-peek">
                      <div class="api-peek-head">
                        <span class="api-peek-title">
                          <span class="api-peek-badge">type</span>
                          <code>{peek.title}</code>
                          <span class="api-peek-blurb">{peek.blurb}</span>
                        </span>
                        <span class="api-peek-actions">
                          <button type="button" class="api-peek-btn" onclick={() => go(peekId)}>Open full section →</button>
                          <button type="button" class="api-peek-btn" aria-label="Close peek" onclick={() => (expanded[key] = false)}>×</button>
                        </span>
                      </div>
                      {#if peek.props && peek.props.length > 0}
                        <div class="api-peek-table-wrap">
                          <table class="api-peek-table">
                            <thead>
                              <tr><th>Name</th><th>Type</th><th>Description</th></tr>
                            </thead>
                            <tbody>
                              {#each peek.props as pp (pp.name)}
                                <tr>
                                  <td class="font-mono">{pp.name}{#if pp.required}<span class="api-peek-req">req</span>{/if}</td>
                                  <td class="font-mono api-peek-type">{#each linkifyType(pp.type, peekId) as s2}{#if s2.to}<button type="button" class="api-type-link" title={`Jump to ${s2.text}`} onclick={() => go(s2.to!)}>{s2.text}</button>{:else}{s2.text}{/if}{/each}</td>
                                  <td>{pp.description}</td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <p class="api-peek-empty">{peek.blurb} <button type="button" class="api-peek-btn" onclick={() => go(peekId)}>Open full section →</button></p>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if current.example}
      <h2 class="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Example
      </h2>
      <h3 class="text-lg font-semibold" style="color: var(--sg-fg);">{current.example.title}</h3>
      {#if current.example.description}
        <p class="mt-1 text-sm" style="color: var(--site-muted);">{current.example.description}</p>
      {/if}
      <pre class="mt-3 rounded-lg border p-4 text-sm overflow-x-auto font-mono leading-relaxed"
        style="border-color: var(--sg-border); background: #0a1124; color: #e2e8f0;"><code>{current.example.code}</code></pre>
    {/if}

    {#if current.notes && current.notes.length > 0}
      <h2 class="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Notes & gotchas
      </h2>
      <ul class="space-y-2">
        {#each current.notes as note}
          <li
            class="flex items-start gap-2 rounded-lg border p-3 text-sm"
            style="border-color: var(--sg-border); background: var(--sg-header-bg); color: var(--sg-fg);"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="color: var(--site-accent-2); margin-top: 1px; flex-shrink: 0;"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{note}</span>
          </li>
        {/each}
      </ul>
    {/if}

    <footer class="mt-16 border-t pt-6" style="border-color: var(--sg-border);">
      <p class="text-sm" style="color: var(--site-muted);">
        Found a mistake or missing detail? The page is generated from
        <a
          class="underline"
          style="color: var(--site-accent-2);"
          href="https://github.com/sv-grid/sv-grid/blob/main/website/src/lib/api-reference.ts"
          target="_blank"
          rel="noopener noreferrer"
        >website/src/lib/api-reference.ts</a> - PRs welcome.
      </p>
    </footer>
  </main>
</div>

<style>
  /* Sticky sidebar: stays pinned to the top of the viewport (below the
     site header) while the right-hand reference scrolls. self-start is
     critical so the flex parent doesn't stretch the aside to the same
     height as <main>, which would defeat `position: sticky`. */
  .api-shell { align-items: flex-start; }
  .api-sidebar {
    position: sticky;
    top: 4rem; /* site header height */
    align-self: flex-start;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
  }

  /* Per-prop "Show example" toggle: a flat chevron in the Name column that
     rotates 90deg when the example panel below the row is open. A 14x14
     hit-target sized to match the row baseline. */
  .api-expand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    margin-right: 2px;
    border: 0;
    background: transparent;
    cursor: pointer;
    color: var(--site-accent-2);
    border-radius: 3px;
    flex-shrink: 0;
  }
  .api-expand:hover {
    background: color-mix(in srgb, var(--site-accent-2) 14%, transparent);
  }
  .api-expand:focus-visible {
    outline: 2px solid var(--site-accent);
    outline-offset: 2px;
  }
  /* Reserves chevron width for rows without an example so prop names stay
     vertically aligned with rows that do have one. */
  .api-expand-placeholder {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 2px;
    flex-shrink: 0;
  }

  /* Expanded example panel - the second <tr> we render below the prop row. */
  .api-example-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(148, 163, 184, 0.08);
    color: #e2e8f0;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms, border-color 120ms;
  }
  .api-example-btn:hover {
    background: rgba(148, 163, 184, 0.18);
    border-color: rgba(148, 163, 184, 0.45);
  }
  .api-example-btn-primary {
    background: linear-gradient(135deg, #f97316, #ea580c);
    color: white;
    border-color: transparent;
  }
  .api-example-btn-primary:hover {
    background: linear-gradient(135deg, #fb923c, #f97316);
    border-color: transparent;
  }

  /* ---- Global member search ------------------------------------------- */
  .api-search-wrap { position: relative; display: flex; align-items: center; }
  .api-search-icon {
    position: absolute; left: 10px;
    color: var(--sg-muted); pointer-events: none;
  }
  .api-search-input {
    width: 100%;
    border: 1px solid var(--sg-input-border, var(--sg-border));
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border-radius: 8px;
    padding: 7px 32px 7px 32px;
    font-size: 13px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .api-search-input::placeholder { color: var(--sg-muted); }
  .api-search-input:focus {
    border-color: var(--site-accent-2);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--site-accent-2) 22%, transparent);
  }
  .api-search-input::-webkit-search-cancel-button { display: none; }
  .api-search-kbd {
    position: absolute; right: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px; padding: 1px 6px;
    border: 1px solid var(--sg-border); border-radius: 4px;
    color: var(--sg-muted); pointer-events: none;
  }
  .api-search-clear {
    position: absolute; right: 6px;
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 0; background: transparent; color: var(--sg-muted);
    font-size: 18px; line-height: 1; cursor: pointer; border-radius: 4px;
  }
  .api-search-clear:hover {
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.15));
    color: var(--sg-fg);
  }

  /* Flat cross-section result row: member name + the section it lives in. */
  .api-hit {
    display: flex; align-items: baseline; gap: 8px;
    background: transparent; border: 0; cursor: pointer;
    color: var(--sg-fg); transition: background-color 120ms ease;
  }
  .api-hit:hover { background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.12)); }
  .api-hit-name {
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 13px;
  }
  .api-hit-sec {
    flex-shrink: 0; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--sg-muted);
  }

  /* Clickable type reference inside the Type column. Rendered as a bare
     button that inherits the mono/accent styling, marked with a dotted
     underline so it reads as "you can click this to see its shape". */
  .api-type-link {
    border: 0;
    background: transparent;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }
  .api-type-link:hover {
    color: var(--site-accent);
    text-decoration-style: solid;
  }
  .api-type-link.is-open {
    color: var(--site-accent);
    text-decoration-style: solid;
    font-weight: 600;
  }
  .api-type-link:focus-visible {
    outline: 2px solid var(--site-accent);
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* ---- Inline type peek ------------------------------------------------ */
  .api-peek {
    border: 1px solid var(--sg-border);
    border-left: 3px solid var(--site-accent-2);
    border-radius: 8px;
    background: var(--sg-header-bg);
    overflow: hidden;
  }
  .api-peek-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border);
  }
  .api-peek-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  }
  .api-peek-title code {
    font-size: 13px;
    font-weight: 700;
    color: var(--sg-fg);
  }
  .api-peek-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border-radius: 4px;
    background: color-mix(in oklab, var(--site-accent-2) 18%, transparent);
    color: var(--site-accent-2);
  }
  .api-peek-blurb {
    font-size: 11.5px;
    color: var(--sg-muted);
    min-width: 0;
  }
  .api-peek-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .api-peek-btn {
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 3px 9px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .api-peek-btn:hover {
    border-color: var(--site-accent-2);
    color: var(--site-accent-2);
  }
  .api-peek-table-wrap { overflow-x: auto; }
  .api-peek-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  .api-peek-table th {
    text-align: left;
    padding: 6px 12px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sg-muted);
    background: var(--sg-row-alt-bg);
  }
  .api-peek-table td {
    padding: 6px 12px;
    vertical-align: top;
    border-top: 1px solid var(--sg-border);
    color: var(--sg-fg);
  }
  .api-peek-type { color: var(--site-accent-2); }
  .api-peek-req {
    margin-left: 6px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: #fca5a5;
  }
  .api-peek-empty {
    padding: 12px;
    font-size: 12.5px;
    color: var(--sg-muted);
  }

  /* Per-member related links (Docs / Demo) under the description. */
  .api-links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .api-link-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid var(--sg-border);
    background: var(--sg-header-bg);
    color: var(--sg-muted);
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }
  .api-link-pill:hover {
    color: var(--site-accent-2);
    border-color: var(--site-accent-2);
    background: color-mix(in oklab, var(--site-accent-2) 10%, transparent);
  }

  /* Sub-group header row inside a section's member table. */
  .api-group-row > td {
    padding: 10px 12px 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--site-accent-2);
    background: var(--sg-row-alt-bg);
    border-top: 2px solid var(--sg-border);
  }

  /* Flash the row a search hit jumped to, so it's obvious where you landed. */
  .api-prop-flash > td {
    animation: api-prop-flash 1.6s ease-out;
  }
  @keyframes api-prop-flash {
    0%, 22% { background-color: color-mix(in oklab, var(--site-accent-2) 24%, transparent); }
    100%    { background-color: transparent; }
  }
</style>
