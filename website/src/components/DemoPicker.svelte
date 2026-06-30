<script lang="ts">
  /**
   * Bryntum-style demo picker. A full-screen modal showing every demo as a
   * card with a screenshot thumbnail + description. A left sidebar lists the
   * categories; clicking one filters the grid to that category. Live fuzzy
   * search, keyboard navigation (arrows + Enter), match highlighting, and a
   * focus trap.
   *
   * Thumbnails: tools/capture-demo-thumbs.mjs -> public/thumbs/<id>.webp.
   * A missing thumbnail falls back to a tinted placeholder.
   */
  import { demos, demoGroups, type Demo, type DemoCategory } from '../lib/demos'

  type Props = {
    currentId: string
    onSelect: (id: string) => void
    onClose: () => void
  }
  let { currentId, onSelect, onClose }: Props = $props()

  let query = $state('')
  let selectedCategory = $state<DemoCategory | null>(null)
  let searchEl = $state<HTMLInputElement | null>(null)
  let panelEl = $state<HTMLElement | null>(null)
  let bodyEl = $state<HTMLElement | null>(null)

  const THUMB_BASE = `${import.meta.env.BASE_URL}thumbs/`

  // ---- search -----------------------------------------------------------
  function tokens(q: string): string[] {
    return q.toLowerCase().split(/\s+/).filter(Boolean)
  }
  function scoreDemo(d: Demo, toks: string[]): number {
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
  const toks = $derived(tokens(query))

  // Demos in scope = the selected category (or all), then narrowed by search.
  const scoped = $derived(
    selectedCategory ? demos.filter((d) => d.category === selectedCategory) : demos,
  )
  const results = $derived.by(() => {
    if (toks.length === 0) return null
    return scoped
      .map((d) => ({ demo: d, score: scoreDemo(d, toks) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.demo)
  })
  const shownCount = $derived(results === null ? scoped.length : results.length)

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function highlight(text: string): string {
    const safe = escapeHtml(text)
    if (toks.length === 0) return safe
    const pattern = toks
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|')
    return safe.replace(new RegExp(`(${pattern})`, 'gi'), '<mark class="dp-hit">$1</mark>')
  }

  function selectCategory(cat: DemoCategory | null) {
    selectedCategory = cat
    if (bodyEl) bodyEl.scrollTop = 0
  }

  // ---- keyboard: arrows move card focus, Tab is trapped -----------------
  function cards(): HTMLButtonElement[] {
    return panelEl ? [...panelEl.querySelectorAll<HTMLButtonElement>('.dp-card')] : []
  }
  function moveCardFocus(dir: 'up' | 'down' | 'left' | 'right') {
    const list = cards()
    if (!list.length) return
    const active = document.activeElement as HTMLElement | null
    let idx = active ? list.indexOf(active as HTMLButtonElement) : -1
    if (idx === -1) {
      list[0].focus()
      list[0].scrollIntoView({ block: 'nearest' })
      return
    }
    if (dir === 'right') idx = Math.min(idx + 1, list.length - 1)
    else if (dir === 'left') idx = Math.max(idx - 1, 0)
    else {
      const cur = list[idx].getBoundingClientRect()
      const cx = cur.left + cur.width / 2
      let best = -1
      let bestDist = Infinity
      for (let i = 0; i < list.length; i += 1) {
        if (i === idx) continue
        const r = list[i].getBoundingClientRect()
        const isDown = r.top > cur.top + 4
        const isUp = r.top < cur.top - 4
        if (dir === 'down' ? !isDown : !isUp) continue
        const dx = Math.abs(r.left + r.width / 2 - cx)
        const dy = Math.abs(r.top - cur.top)
        const dist = dy * 2 + dx
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      if (best >= 0) idx = best
    }
    list[idx].focus()
    list[idx].scrollIntoView({ block: 'nearest' })
  }
  function trapTab(e: KeyboardEvent) {
    if (!panelEl) return
    const f = [...panelEl.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
    )
    if (!f.length) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Tab') {
      trapTab(e)
      return
    }
    const inSearch = document.activeElement === searchEl
    if (e.key === 'Enter' && inSearch && results && results.length > 0) {
      e.preventDefault()
      onSelect(results[0]!.id)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveCardFocus('down')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveCardFocus('up')
    } else if (e.key === 'ArrowRight' && !inSearch) {
      e.preventDefault()
      moveCardFocus('right')
    } else if (e.key === 'ArrowLeft' && !inSearch) {
      e.preventDefault()
      moveCardFocus('left')
    }
  }

  $effect(() => {
    searchEl?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  })

  function thumbFallback(e: Event) {
    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="dp-overlay" role="dialog" aria-modal="true" aria-label="Browse demos" tabindex="-1" onclick={onClose}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dp-panel" bind:this={panelEl} onclick={(e) => e.stopPropagation()}>
    <header class="dp-head">
      <svg class="dp-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        bind:this={searchEl}
        bind:value={query}
        type="search"
        class="dp-search"
        placeholder="Search {selectedCategory ?? 'all'} demos by feature, industry, or keyword…"
        aria-label="Search demos"
      />
      <span class="dp-count">{shownCount} {shownCount === 1 ? 'demo' : 'demos'}</span>
      <button type="button" class="dp-close" aria-label="Close" onclick={onClose}>×</button>
    </header>

    <div class="dp-main">
      <nav class="dp-side" aria-label="Categories">
        <button
          type="button"
          class="dp-cat-btn"
          class:is-active={selectedCategory === null}
          onclick={() => selectCategory(null)}
        >
          <span class="dp-cat-name">All demos</span>
          <span class="dp-cat-n">{demos.length}</span>
        </button>
        {#each demoGroups as group (group.category)}
          <button
            type="button"
            class="dp-cat-btn"
            class:is-active={selectedCategory === group.category}
            onclick={() => selectCategory(group.category)}
          >
            <span class="dp-cat-name">{group.category}</span>
            <span class="dp-cat-n">{group.demos.length}</span>
          </button>
        {/each}
      </nav>

      <div class="dp-body" bind:this={bodyEl}>
        {#snippet card(demo: Demo)}
          <button
            type="button"
            class="dp-card"
            class:is-current={demo.id === currentId}
            onclick={() => onSelect(demo.id)}
            title={demo.blurb}
          >
            <div class="dp-thumb">
              <img src={`${THUMB_BASE}${demo.id}.webp`} alt="" loading="lazy" decoding="async" onerror={thumbFallback} />
              {#if demo.pro}<span class="dp-pro">Enterprise</span>{/if}
            </div>
            <div class="dp-meta">
              <div class="dp-title">{@html highlight(demo.title)}</div>
              <div class="dp-blurb">{@html highlight(demo.blurb)}</div>
              <div class="dp-cat">{demo.category}</div>
            </div>
          </button>
        {/snippet}

        {#if results !== null}
          {#if results.length === 0}
            <p class="dp-empty">
              Nothing matches <em>"{query}"</em>{selectedCategory ? ` in ${selectedCategory}` : ''}. Try
              a feature ("pivot", "tree", "export") or an industry ("CRM", "healthcare").
            </p>
          {:else}
            <div class="dp-grid">
              {#each results as demo (demo.id)}{@render card(demo)}{/each}
            </div>
          {/if}
        {:else if selectedCategory === null}
          {#each demoGroups as group (group.category)}
            <section class="dp-section">
              <h3 class="dp-section-head">{group.category}<span class="dp-section-count">{group.demos.length}</span></h3>
              <div class="dp-grid">
                {#each group.demos as demo (demo.id)}{@render card(demo)}{/each}
              </div>
            </section>
          {/each}
        {:else}
          <section class="dp-section">
            <h3 class="dp-section-head">{selectedCategory}<span class="dp-section-count">{scoped.length}</span></h3>
            <div class="dp-grid">
              {#each scoped as demo (demo.id)}{@render card(demo)}{/each}
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .dp-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: color-mix(in oklab, #05080f 78%, transparent);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: clamp(12px, 4vh, 56px) 16px;
  }
  .dp-panel {
    width: min(1480px, 100%);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    background: var(--site-bg-elev, var(--sg-bg, #0b1220));
    border: 1px solid var(--site-border, var(--sg-border, #1f2937));
    border-radius: 16px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }
  .dp-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--site-border, var(--sg-border, #1f2937));
    flex-shrink: 0;
  }
  .dp-search-icon { color: var(--site-muted, #94a3b8); flex-shrink: 0; }
  .dp-search {
    flex: 1; min-width: 0;
    background: transparent; border: 0; outline: none;
    color: var(--site-fg, #e2e8f0); font-size: 16px;
  }
  .dp-search::placeholder { color: var(--site-muted, #94a3b8); }
  .dp-search::-webkit-search-cancel-button { display: none; }
  .dp-count {
    flex-shrink: 0; font-size: 12px;
    color: var(--site-muted, #94a3b8); font-variant-numeric: tabular-nums;
  }
  .dp-close {
    flex-shrink: 0; width: 32px; height: 32px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 0; border-radius: 8px; background: transparent;
    color: var(--site-muted, #94a3b8); font-size: 22px; line-height: 1; cursor: pointer;
  }
  .dp-close:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.15)); color: var(--site-fg, #e2e8f0); }

  /* Body = category sidebar + cards */
  .dp-main { display: flex; min-height: 0; flex: 1; }
  .dp-side {
    flex-shrink: 0;
    width: 232px;
    overflow-y: auto;
    padding: 10px;
    border-right: 1px solid var(--site-border, var(--sg-border, #1f2937));
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .dp-cat-btn {
    display: flex; align-items: center; gap: 8px;
    width: 100%; text-align: left; cursor: pointer;
    border: 0; background: transparent; border-radius: 8px;
    padding: 7px 10px; font-size: 13px;
    color: var(--site-fg, #e2e8f0);
    transition: background-color 120ms ease, color 120ms ease;
  }
  .dp-cat-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .dp-cat-btn.is-active {
    background: color-mix(in oklab, var(--site-accent, #ff5a1f) 16%, transparent);
    color: var(--site-accent, #ff5a1f);
    font-weight: 600;
  }
  .dp-cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dp-cat-n {
    flex-shrink: 0; font-size: 11px; font-variant-numeric: tabular-nums;
    color: var(--site-muted, #94a3b8);
    background: var(--sg-row-hover-bg, rgba(148,163,184,0.15));
    border-radius: 10px; padding: 1px 7px;
  }
  .dp-cat-btn.is-active .dp-cat-n {
    color: var(--site-accent, #ff5a1f);
    background: color-mix(in oklab, var(--site-accent, #ff5a1f) 18%, transparent);
  }

  .dp-body { flex: 1; min-width: 0; overflow-y: auto; padding: 16px; }
  .dp-section { margin-bottom: 22px; }
  .dp-section-head {
    display: flex; align-items: center; gap: 8px; margin: 0 0 10px;
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--site-muted, #94a3b8);
  }
  .dp-section-count {
    font-size: 11px; font-weight: 600; color: var(--site-muted, #94a3b8);
    background: var(--sg-row-hover-bg, rgba(148,163,184,0.15));
    border-radius: 10px; padding: 1px 7px;
  }
  .dp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
    gap: 16px;
  }

  .dp-card {
    display: flex; flex-direction: column; text-align: left;
    background: var(--sg-bg, #0b1220);
    border: 1px solid var(--site-border, var(--sg-border, #1f2937));
    border-radius: 12px; overflow: hidden; cursor: pointer; padding: 0;
    transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
  }
  .dp-card:hover {
    border-color: var(--site-accent, #ff5a1f);
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  }
  .dp-card.is-current { border-color: var(--site-accent, #ff5a1f); box-shadow: 0 0 0 1px var(--site-accent, #ff5a1f); }
  .dp-card:focus-visible { outline: 2px solid var(--site-accent, #ff5a1f); outline-offset: 2px; }

  .dp-thumb {
    position: relative; aspect-ratio: 980 / 460; overflow: hidden;
    background: linear-gradient(135deg, color-mix(in oklab, var(--site-accent, #ff5a1f) 16%, #111827), #0b1220);
  }
  .dp-thumb img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; object-position: top left; display: block;
  }
  .dp-pro {
    position: absolute; top: 8px; right: 8px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.04em; color: #fff;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 5px; padding: 2px 6px;
  }

  .dp-meta {
    padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 3px; flex: 1;
    border-top: 1px solid var(--site-border, var(--sg-border, #1f2937));
  }
  .dp-title { font-size: 13.5px; font-weight: 650; color: var(--site-fg, #e2e8f0); line-height: 1.25; }
  .dp-blurb {
    font-size: 12px; color: var(--site-muted, #94a3b8); line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .dp-cat {
    margin-top: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--site-muted, #94a3b8); opacity: 0.85;
  }
  :global(.dp-hit) {
    background: color-mix(in oklab, var(--site-accent, #ff5a1f) 32%, transparent);
    color: inherit; border-radius: 2px; padding: 0 1px;
  }

  .dp-empty { padding: 40px 8px; text-align: center; color: var(--site-muted, #94a3b8); font-size: 14px; }

  /* Narrow screens: sidebar becomes a horizontal scroll strip above the grid. */
  @media (max-width: 760px) {
    .dp-main { flex-direction: column; }
    .dp-side {
      width: auto;
      flex-direction: row;
      overflow-x: auto;
      border-right: 0;
      border-bottom: 1px solid var(--site-border, var(--sg-border, #1f2937));
    }
    .dp-cat-btn { white-space: nowrap; }
    .dp-cat-name { overflow: visible; }
  }
</style>
