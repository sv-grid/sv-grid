<script lang="ts" module>
  import type { Snippet } from 'svelte'
  export type NavItem = {
    id: string
    label: string
    icon?: Snippet
    /** Right-aligned count/badge (e.g. unread). */
    badge?: string | number
    disabled?: boolean
    /** Nested items (one level of sub-items, indented). */
    children?: NavItem[]
  }
  export type NavSection = {
    id: string
    label?: string
    items: NavItem[]
    /** Show a collapse chevron on the section header. Default true when labelled. */
    collapsible?: boolean
  }
  /** A bottom "module" button (Outlook-style: Mail / Calendar / People / Tasks). */
  export type NavModule = { id: string; label: string; icon?: Snippet; badge?: string | number }
</script>

<script lang="ts">
  /**
   * SvNavPane - an Outlook-style navigation pane: collapsible sections, items with
   * icons and badge counts, one level of nested sub-items, single-select
   * highlight, arrow-key navigation, and an icon-only `collapsed` rail. A common
   * app shell primitive (mail folders, workspace nav, settings).
   */
  import { type EditorDir } from './editor-contract'

  let {
    sections,
    value = $bindable<string | null>(null),
    onSelect,
    expandedSections = $bindable<string[] | undefined>(undefined),
    expandedItems = $bindable<string[]>([]),
    collapsed = false,
    ariaLabel = 'Navigation',
    dir,
    modules,
    moduleValue = $bindable<string | null>(null),
    onModuleSelect,
    moduleRows = $bindable<number | undefined>(undefined),
    height,
  }: {
    sections: ReadonlyArray<NavSection>
    value?: string | null
    onSelect?: (id: string) => void
    /** Open section ids (uncontrolled default = all open). */
    expandedSections?: string[]
    /** Open nested-item ids. */
    expandedItems?: string[]
    /** Icon-only rail (labels hidden). */
    collapsed?: boolean
    ariaLabel?: string
    dir?: EditorDir
    /** Outlook-style bottom module buttons (Mail / Calendar / ...). */
    modules?: ReadonlyArray<NavModule>
    /** Selected module id. */
    moduleValue?: string | null
    onModuleSelect?: (id: string) => void
    /** How many modules show as full labelled rows; the rest collapse to an icon
     *  rail. Draggable via the splitter. Default: all. */
    moduleRows?: number
    /** Pane height in px - lets the splitter redistribute space (recommended
     *  when `modules` is set). */
    height?: number
  } = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
  // Default: every section open.
  const openSections = $derived(new Set(expandedSections ?? sections.map((s) => s.id)))
  const openItems = $derived(new Set(expandedItems))

  function toggleSection(id: string) {
    const next = new Set(openSections)
    next.has(id) ? next.delete(id) : next.add(id)
    expandedSections = [...next]
  }
  function toggleItem(id: string) {
    const next = new Set(openItems)
    next.has(id) ? next.delete(id) : next.add(id)
    expandedItems = [...next]
  }
  function select(item: NavItem) {
    if (item.disabled) return
    if (item.children?.length) { toggleItem(item.id); return }
    value = item.id
    onSelect?.(item.id)
  }

  let rootEl = $state<HTMLElement | null>(null)
  function onItemKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const focusables = [...(rootEl?.querySelectorAll<HTMLElement>('[data-nav]:not([disabled])') ?? [])]
    const i = focusables.indexOf(document.activeElement as HTMLElement)
    const next = focusables[(i + (e.key === 'ArrowDown' ? 1 : -1) + focusables.length) % focusables.length]
    next?.focus()
  }

  // --- Bottom module strip + Outlook-style resize splitter -------------------
  const moduleCount = $derived(modules?.length ?? 0)
  const visibleModules = $derived(Math.max(0, Math.min(moduleCount, moduleRows ?? moduleCount)))
  const fullModules = $derived(modules?.slice(0, visibleModules) ?? [])
  const railModules = $derived(modules?.slice(visibleModules) ?? [])
  const MODULE_ROW = 40

  let splitActive = false
  let splitStart = { y: 0, count: 0 }
  function setRows(n: number) { moduleRows = Math.max(0, Math.min(moduleCount, n)) }
  function onSplitDown(e: PointerEvent) {
    splitActive = true
    splitStart = { y: e.clientY, count: visibleModules }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onSplitMove(e: PointerEvent) {
    if (!splitActive) return
    // Outlook behaviour: dragging the splitter UP enlarges the module strip
    // (more full labelled rows); dragging DOWN collapses rows into the icon rail.
    setRows(splitStart.count + Math.round((splitStart.y - e.clientY) / MODULE_ROW))
  }
  function onSplitUp(e: PointerEvent) {
    if (!splitActive) return
    splitActive = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }
  function onSplitKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') { e.preventDefault(); setRows(visibleModules + 1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setRows(visibleModules - 1) }
  }
  function selectModule(id: string) { moduleValue = id; onModuleSelect?.(id) }
</script>

<nav
  bind:this={rootEl}
  class="sv-nav"
  class:is-collapsed={collapsed}
  dir={resolvedDir}
  aria-label={ariaLabel}
  style:height={height != null ? `${height}px` : undefined}
>
  <div class="sv-nav__scroll" onkeydown={onItemKey}>
  {#each sections as section (section.id)}
    {@const secOpen = openSections.has(section.id)}
    {@const collapsible = section.collapsible ?? !!section.label}
    <div class="sv-nav__section">
      {#if section.label}
        <button
          type="button"
          class="sv-nav__head"
          class:is-open={secOpen}
          aria-expanded={collapsible ? secOpen : undefined}
          onclick={() => collapsible && toggleSection(section.id)}
        >
          {#if collapsible}<svg class="sv-nav__caret" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>{/if}
          <span class="sv-nav__head-label">{section.label}</span>
        </button>
      {/if}
      {#if secOpen || !collapsible}
        <ul class="sv-nav__list" role="list">
          {#each section.items as item (item.id)}
            {@const itemOpen = openItems.has(item.id)}
            <li>
              <button
                type="button"
                class="sv-nav__item"
                class:is-active={value === item.id}
                data-nav
                aria-current={value === item.id ? 'page' : undefined}
                aria-expanded={item.children?.length ? itemOpen : undefined}
                disabled={item.disabled}
                title={collapsed ? item.label : undefined}
                onclick={() => select(item)}
              >
                <span class="sv-nav__icon">{#if item.icon}{@render item.icon()}{:else}<span class="sv-nav__dot"></span>{/if}</span>
                <span class="sv-nav__label">{item.label}</span>
                {#if item.children?.length}<svg class="sv-nav__caret sv-nav__caret--item" class:is-open={itemOpen} viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                {:else if item.badge != null}<span class="sv-nav__badge">{item.badge}</span>{/if}
              </button>
              {#if item.children?.length && itemOpen && !collapsed}
                <ul class="sv-nav__sublist" role="list">
                  {#each item.children as sub (sub.id)}
                    <li>
                      <button type="button" class="sv-nav__item sv-nav__item--sub" class:is-active={value === sub.id} data-nav aria-current={value === sub.id ? 'page' : undefined} disabled={sub.disabled} onclick={() => select(sub)}>
                        <span class="sv-nav__label">{sub.label}</span>
                        {#if sub.badge != null}<span class="sv-nav__badge">{sub.badge}</span>{/if}
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
  </div>

  {#if moduleCount}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sv-nav__msplit"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize module buttons"
      aria-valuemin="0"
      aria-valuemax={moduleCount}
      aria-valuenow={visibleModules}
      tabindex="0"
      onpointerdown={onSplitDown}
      onpointermove={onSplitMove}
      onpointerup={onSplitUp}
      onpointercancel={onSplitUp}
      onkeydown={onSplitKey}
    ><span class="sv-nav__mgrip"></span></div>

    <div class="sv-nav__modules">
      {#each fullModules as m (m.id)}
        <button type="button" class="sv-nav__mod" class:is-active={moduleValue === m.id} aria-current={moduleValue === m.id ? 'page' : undefined} onclick={() => selectModule(m.id)}>
          <span class="sv-nav__micon">{#if m.icon}{@render m.icon()}{/if}</span>
          <span class="sv-nav__label">{m.label}</span>
          {#if m.badge != null}<span class="sv-nav__badge">{m.badge}</span>{/if}
        </button>
      {/each}
      {#if railModules.length}
        <div class="sv-nav__mrail">
          {#each railModules as m (m.id)}
            <button type="button" class="sv-nav__modicon" class:is-active={moduleValue === m.id} title={m.label} aria-label={m.label} aria-current={moduleValue === m.id ? 'page' : undefined} onclick={() => selectModule(m.id)}>
              {#if m.icon}{@render m.icon()}{:else}{m.label.slice(0, 1)}{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</nav>

<style>
  .sv-nav {
    --_accent: var(--sg-accent, #2563eb);
    width: 240px; padding: 8px; box-sizing: border-box; user-select: none;
    background: var(--sg-header-bg, #f8fafc); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 10px);
    font-size: 13px; display: flex; flex-direction: column; gap: 4px;
  }
  .sv-nav.is-collapsed { width: 56px; }
  .sv-nav__section { display: flex; flex-direction: column; }
  .sv-nav__head {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px; margin-top: 4px;
    background: none; border: 0; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #64748b); text-align: start;
  }
  .is-collapsed .sv-nav__head-label { display: none; }
  .sv-nav__caret { color: var(--sg-muted, #94a3b8); transition: transform 0.12s; flex: none; }
  .sv-nav__head.is-open .sv-nav__caret { transform: rotate(90deg); }
  .sv-nav__caret--item.is-open { transform: rotate(90deg); }
  .sv-nav[dir='rtl'] .sv-nav__caret:not(.is-open) { transform: scaleX(-1); }
  .sv-nav__list, .sv-nav__sublist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
  .sv-nav__sublist { padding-inline-start: 26px; }
  .sv-nav__item {
    display: flex; align-items: center; gap: 9px; width: 100%; box-sizing: border-box;
    padding: 7px 9px; background: none; border: 0; border-radius: 7px; cursor: pointer;
    font: inherit; font-size: 13px; color: var(--sg-fg, #0f172a); text-align: start;
    transition: background 0.12s, color 0.12s;
  }
  .sv-nav__item:hover:not(:disabled):not(.is-active) { background: var(--sg-row-hover-bg, #eef1f5); }
  .sv-nav__item:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: -2px; }
  .sv-nav__item:disabled { opacity: 0.45; cursor: not-allowed; }
  .sv-nav__item.is-active { background: color-mix(in srgb, var(--_accent) 15%, transparent); color: var(--_accent); font-weight: 600; }
  .sv-nav__item--sub { padding-block: 5px; font-size: 12.5px; }
  .sv-nav__icon { display: inline-flex; width: 18px; flex: none; color: var(--sg-muted, #64748b); justify-content: center; }
  .sv-nav__item.is-active .sv-nav__icon { color: var(--_accent); }
  .sv-nav__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.5; }
  .is-collapsed .sv-nav__label, .is-collapsed .sv-nav__badge, .is-collapsed .sv-nav__caret--item { display: none; }
  .is-collapsed .sv-nav__item { justify-content: center; padding: 8px 0; }
  .sv-nav__label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-nav__badge {
    flex: none; min-width: 18px; height: 18px; padding: 0 6px; box-sizing: border-box;
    display: inline-flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--_accent) 16%, transparent); color: var(--_accent);
    border-radius: 999px; font-size: 11px; font-weight: 700;
  }
  .sv-nav__caret--item { color: var(--sg-muted, #94a3b8); flex: none; }

  /* Scroll area holds the sections; the module strip is pinned at the bottom. */
  .sv-nav__scroll { flex: 1 1 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
  /* Outlook-style resize splitter: drag down to collapse modules into the icon rail. */
  .sv-nav__msplit { flex: none; height: 11px; display: grid; place-items: center; cursor: row-resize; touch-action: none; }
  .sv-nav__mgrip { width: 30px; height: 3px; border-radius: 999px; background: var(--sg-border, #cbd5e1); transition: background 0.12s; }
  .sv-nav__msplit:hover .sv-nav__mgrip, .sv-nav__msplit:focus-visible .sv-nav__mgrip { background: var(--_accent); }
  .sv-nav__msplit:focus-visible { outline: none; }
  .sv-nav__modules { flex: none; display: flex; flex-direction: column; gap: 1px; border-top: 1px solid var(--sg-border, #e2e8f0); padding-top: 6px; }
  .sv-nav__mod {
    display: flex; align-items: center; gap: 10px; padding: 8px 9px; background: none; border: 0; border-radius: 7px;
    cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); text-align: start;
  }
  .sv-nav__mod:hover:not(.is-active) { background: var(--sg-row-hover-bg, #eef1f5); }
  .sv-nav__mod.is-active { background: color-mix(in srgb, var(--_accent) 15%, transparent); color: var(--_accent); }
  .sv-nav__micon { display: inline-flex; width: 18px; flex: none; color: var(--sg-muted, #64748b); justify-content: center; }
  .sv-nav__mod.is-active .sv-nav__micon { color: var(--_accent); }
  .sv-nav__mrail { display: flex; gap: 4px; padding: 4px 2px 0; flex-wrap: wrap; }
  .sv-nav__modicon {
    width: 34px; height: 34px; display: grid; place-items: center; flex: none;
    background: none; border: 0; border-radius: 7px; cursor: pointer; color: var(--sg-muted, #64748b); font-weight: 700; font-size: 13px;
  }
  .sv-nav__modicon:hover:not(.is-active) { background: var(--sg-row-hover-bg, #eef1f5); color: var(--sg-fg, #0f172a); }
  .sv-nav__modicon.is-active { background: color-mix(in srgb, var(--_accent) 15%, transparent); color: var(--_accent); }
  .is-collapsed .sv-nav__mod .sv-nav__label, .is-collapsed .sv-nav__mod .sv-nav__badge { display: none; }
  .is-collapsed .sv-nav__mod { justify-content: center; padding: 8px 0; }
</style>
