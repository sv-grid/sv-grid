<script lang="ts">
  /**
   * The sheet tab strip along the bottom of a workbook.
   *
   * Owns no workbook state of its own: it renders what the workbook reports
   * and calls back, so the keyboard shortcuts and the tabs cannot disagree
   * about which sheet is active.
   */
  import { SvModal } from '@svgrid/grid'
  import type { Workbook } from './sheet/workbook'
  import { isValidSheetName } from './sheet/workbook'
  import { useSheetText } from './sheet-text'

  type Props = {
    workbook: Workbook
    /** Called after any change, so the consumer can re-render. */
    onChange?: () => void
    /**
     * Called after a sheet is renamed or removed, before `onChange`. Anything
     * the consumer keeps per sheet and keys by name - the shell keeps a
     * format store per sheet - has to follow the rename or drop the entry,
     * and the workbook itself has no event for either.
     */
    onRename?: (from: string, to: string) => void
    onRemove?: (name: string) => void
    /**
     * The sheets that are hidden: their tabs are not drawn and the menu
     * offers Unhide for each. The consumer keeps the list (the shell keeps
     * it in the document) and answers `onHide` / `onUnhide`.
     */
    hidden?: ReadonlyArray<string>
    onHide?: (name: string) => void
    onUnhide?: (name: string) => void
    /** Excel's Move or Copy > Create a copy. Without it the entry is not offered. */
    onDuplicate?: (name: string) => void
    /** Off hides the add button and the context actions. */
    editable?: boolean
    /**
     * Bump this whenever the workbook is mutated from OUTSIDE the strip - the
     * Ctrl+PageUp/PageDown shortcuts, or app code calling `addSheet`.
     *
     * A `Workbook` is a plain object, not `$state`, so reading `workbook.sheets`
     * creates no reactive dependency and the strip would otherwise render once
     * and then show whatever the sheet list was at mount. Pass the same counter
     * `onChange` increments.
     */
    version?: number
  }

  let { workbook, onChange, onRename, onRemove, hidden = [], onHide, onUnhide, onDuplicate, editable = true, version = 0 }: Props = $props()

  const t = useSheetText()

  let renaming = $state<string | null>(null)
  let draft = $state('')
  let error = $state<string | null>(null)
  let dragging = $state<string | null>(null)

  // The strip's own mutations do not go through the consumer's counter, so it
  // keeps one of its own and reads both.
  let localVersion = $state(0)

  const isHidden = (name: string) => hidden.some((h) => h.toLowerCase() === name.toLowerCase())
  /** The tabs drawn: the workbook's sheets less the hidden ones. */
  const sheets = $derived.by(() => {
    void version
    void localVersion
    return workbook.sheets.filter((name) => !isHidden(name))
  })
  const hiddenSheets = $derived.by(() => {
    void version
    void localVersion
    return workbook.sheets.filter((name) => isHidden(name))
  })
  const activeSheet = $derived.by(() => {
    void version
    void localVersion
    return workbook.active
  })

  function changed() {
    localVersion += 1
    onChange?.()
  }

  function select(name: string) {
    workbook.setActive(name)
    changed()
  }

  function startRename(name: string) {
    if (!editable) return
    renaming = name
    draft = name
    error = null
  }

  function commitRename() {
    const from = renaming
    if (from === null) return
    const to = draft.trim()
    renaming = null
    if (to === '' || to === from) return
    if (!isValidSheetName(to)) {
      error = t('invalidSheetName', { name: to })
      return
    }
    if (!workbook.renameSheet(from, to)) {
      error = t('duplicateSheetName', { name: to })
      return
    }
    error = null
    onRename?.(from, to)
    changed()
  }

  function add() {
    workbook.addSheet()
    changed()
  }

  /** Delete, once confirmed when the sheet holds anything, as Excel asks. */
  let confirmDelete = $state<string | null>(null)

  function hasContent(name: string): boolean {
    for (let r = 0; r < workbook.rowCount(name); r += 1) {
      for (let c = 0; c < workbook.colCount(name); c += 1) {
        if (workbook.getRaw(name, r, c).trim() !== '') return true
      }
    }
    return false
  }

  function askRemove(name: string) {
    if (workbook.sheets.length < 2) return
    if (hasContent(name)) confirmDelete = name
    else remove(name)
  }

  function remove(name: string) {
    confirmDelete = null
    // The workbook refuses to remove the last sheet; reflect that rather than
    // showing a button that does nothing.
    if (!workbook.removeSheet(name)) return
    onRemove?.(name)
    changed()
  }

  function hide(name: string) {
    // Excel refuses to hide the last visible sheet.
    if (sheets.length < 2) return
    onHide?.(name)
    changed()
  }

  function unhide(name: string) {
    onUnhide?.(name)
    changed()
  }

  function duplicate(name: string) {
    onDuplicate?.(name)
    changed()
  }

  // ---- Excel's right-click menu on a tab ------------------------------------
  let menu = $state<{ name: string; x: number; y: number } | null>(null)

  function openMenu(event: MouseEvent, name: string) {
    if (!editable) return
    event.preventDefault()
    select(name)
    menu = { name, x: event.clientX, y: event.clientY }
  }
  /**
   * The tabs sit at the foot of the sheet, so a menu dropped from the click
   * runs off the bottom of the window; it opens upward from the click, as
   * Excel's does, and is pulled back inside at the right edge.
   */
  function keepMenuInView(node: HTMLElement, _at: { x: number; y: number } | null) {
    const fit = () => {
      const box = node.getBoundingClientRect()
      if (!menu) return
      const x = Math.max(8, Math.min(menu.x, window.innerWidth - box.width - 8))
      const y = menu.y + box.height > window.innerHeight - 8 ? Math.max(8, menu.y - box.height) : menu.y
      if (x !== menu.x || y !== menu.y) menu = { ...menu, x, y }
    }
    fit()
    return { update: fit }
  }

  function moveBy(name: string, delta: -1 | 1) {
    const at = workbook.sheets.indexOf(name)
    const to = at + delta
    if (at < 0 || to < 0 || to >= workbook.sheets.length) return
    workbook.moveSheet(name, to)
    changed()
  }

  function insertBefore(name: string) {
    const at = workbook.sheets.indexOf(name)
    const added = workbook.addSheet(undefined, Math.max(at, 0))
    workbook.setActive(added)
    changed()
  }

  // ---- the scroll arrows, for more tabs than fit --------------------------
  // Excel greys each arrow until it can move something: with every tab in
  // view both are grey, and at either end of a long strip the arrow that
  // points off it is. Read from the strip's scroll box after every scroll,
  // resize and tab change.
  let strip = $state<HTMLDivElement | null>(null)
  let canLeft = $state(false)
  let canRight = $state(false)
  function measureStrip() {
    const el = strip
    if (!el) { canLeft = false; canRight = false; return }
    canLeft = el.scrollLeft > 1
    canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  }
  $effect(() => {
    const el = strip
    if (!el) return
    void version
    void sheets
    measureStrip()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureStrip)
    ro?.observe(el)
    el.addEventListener('scroll', measureStrip)
    return () => { ro?.disconnect(); el.removeEventListener('scroll', measureStrip) }
  })
  function scrollTabs(delta: number) {
    strip?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  function onDrop(target: string) {
    const moved = dragging
    dragging = null
    if (!moved || moved === target) return
    const to = workbook.sheets.indexOf(target)
    if (to < 0) return
    workbook.moveSheet(moved, to)
    changed()
  }

  /** Left and right arrows move between tabs, which is what a tablist owes a
   *  keyboard user; the shortcut layer's Ctrl+PageUp/Down does the same from
   *  anywhere in the grid. */
  function onTabKey(event: KeyboardEvent, name: string) {
    const at = sheets.indexOf(name)
    if (event.key === 'ArrowRight' && at < sheets.length - 1) {
      event.preventDefault()
      select(sheets[at + 1]!)
    } else if (event.key === 'ArrowLeft' && at > 0) {
      event.preventDefault()
      select(sheets[at - 1]!)
    } else if (event.key === 'F2') {
      event.preventDefault()
      startRename(name)
    }
  }
</script>

<svelte:window
  onpointerdown={(e) => { if (menu && !(e.target as HTMLElement).closest('.sheet-menu')) menu = null }}
  onkeydown={(e) => { if (e.key === 'Escape') menu = null }}
/>

<div class="sv-sheet-tabs">
  <!-- Excel's tab-scrolling arrows: always drawn, greyed until they can move something. -->
  <div class="nav">
    <button type="button" class="nav-btn" tabindex="-1" aria-label={t('scrollTabsLeft')} disabled={!canLeft} onclick={() => scrollTabs(-120)}>
      <svg viewBox="0 0 8 8" width="8" height="8"><path d="M5.5 1L2.5 4l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <button type="button" class="nav-btn" tabindex="-1" aria-label={t('scrollTabsRight')} disabled={!canRight} onclick={() => scrollTabs(120)}>
      <svg viewBox="0 0 8 8" width="8" height="8"><path d="M2.5 1l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
  </div>

  <div role="tablist" aria-label={t('sheets')} class="tabs" bind:this={strip}>
    {#each sheets as name (name)}
      {@const isActive = name === activeSheet}
      <!-- role="presentation" so the tablist still OWNS the role="tab"
           button: an unmarked wrapper div between them breaks the ARIA
           tablist / tab relationship. -->
      <div
        role="presentation"
        class="tab"
        class:active={isActive}
        class:dragging={dragging === name}
        draggable={editable}
        ondragstart={() => (dragging = name)}
        ondragover={(e) => e.preventDefault()}
        ondrop={() => onDrop(name)}
        ondragend={() => (dragging = null)}
        oncontextmenu={(e) => openMenu(e, name)}
      >
        {#if renaming === name}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="rename"
            aria-label={t('sheetName')}
            autofocus
            value={draft}
            oninput={(e) => (draft = e.currentTarget.value)}
            onblur={commitRename}
            onkeydown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { e.preventDefault(); renaming = null }
            }}
          />
        {:else}
          <button
            type="button"
            role="tab"
            aria-selected={isActive}
            tabindex={isActive ? 0 : -1}
            onclick={() => select(name)}
            ondblclick={() => startRename(name)}
            onkeydown={(e) => onTabKey(e, name)}
          >{name}</button>
        {/if}
      </div>
    {/each}
  </div>

  {#if editable}
    <button type="button" class="add" aria-label={t('newSheet')} title={`${t('newSheet')} (Shift+F11)`} onclick={add}>
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M5 1.5v7M1.5 5h7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
    </button>
  {/if}

  {#if error}
    <span class="error" role="alert">{error}</span>
  {/if}
</div>

{#if menu}
  <!--
    The sheet menu Excel opens on right-click. Delete lives here and nowhere
    on the tab face, so a stray click cannot remove a sheet.
  -->
  <div class="sheet-menu" role="menu" aria-label={`${menu.name} sheet`} style:left={`${menu.x}px`} style:top={`${menu.y}px`} use:keepMenuInView={menu}>
    <button type="button" role="menuitem" onclick={() => { insertBefore(menu!.name); menu = null }}>{t('tabInsert')}</button>
    <button type="button" role="menuitem" disabled={workbook.sheets.length < 2} onclick={() => { askRemove(menu!.name); menu = null }}>{t('tabDelete')}</button>
    <button type="button" role="menuitem" onclick={() => { startRename(menu!.name); menu = null }}>{t('tabRename')}</button>
    {#if onDuplicate}
      <button type="button" role="menuitem" onclick={() => { duplicate(menu!.name); menu = null }}>{t('tabDuplicate')}</button>
    {/if}
    <div class="sep" role="separator"></div>
    <button type="button" role="menuitem" disabled={sheets.indexOf(menu.name) === 0} onclick={() => { moveBy(menu!.name, -1); menu = null }}>{t('tabMoveLeft')}</button>
    <button type="button" role="menuitem" disabled={sheets.indexOf(menu.name) === sheets.length - 1} onclick={() => { moveBy(menu!.name, 1); menu = null }}>{t('tabMoveRight')}</button>
    {#if onHide}
      <div class="sep" role="separator"></div>
      <button type="button" role="menuitem" disabled={sheets.length < 2} onclick={() => { hide(menu!.name); menu = null }}>{t('tabHide')}</button>
      {#if hiddenSheets.length}
        <!-- Excel's Unhide opens a list; here each hidden sheet is an entry. -->
        <div class="heading" role="presentation">{t('tabUnhide')}</div>
        {#each hiddenSheets as name (name)}
          <button type="button" role="menuitem" class="indent" onclick={() => { unhide(name); menu = null }}>{name}</button>
        {/each}
      {/if}
    {/if}
  </div>
{/if}

<SvModal open={confirmDelete !== null} title={t('deleteSheetTitle')} size="sm" onClose={() => (confirmDelete = null)}>
  <div class="sv-sheet-dialog">
    <p class="note">{t('deleteSheetMessage', { name: confirmDelete ?? '' })}</p>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={() => { if (confirmDelete) remove(confirmDelete) }}>{t('delete')}</button>
      <button type="button" class="btn" onclick={() => (confirmDelete = null)}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .sv-sheet-tabs {
    display: flex;
    align-items: stretch;
    height: 26px;
    font-family: var(--sg-font, "Segoe UI", system-ui, sans-serif);
    font-size: 12px;
    background: var(--sg-header-bg, #f3f3f3);
    border-top: 1px solid var(--sg-border, #d1d1d1);
    color: var(--sg-fg, #242424);
  }

  .nav {
    display: flex;
    align-items: center;
    padding: 0 4px 0 6px;
    gap: 2px;
    color: var(--sg-muted, #616161);
  }
  .nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .nav-btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #e6e6e6); color: var(--sg-fg, #242424); }
  .nav-btn:disabled { opacity: 0.35; cursor: default; }

  .tabs {
    display: flex;
    align-items: stretch;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar { display: none; }

  /* Excel's tabs: grey strip, the active one lifted to white with the accent
     drawn as a line along its bottom edge and its name in the accent. */
  .tab {
    position: relative;
    display: flex;
    align-items: stretch;
    min-width: 64px;
    border-right: 1px solid var(--sg-border, #d1d1d1);
  }
  .tab:first-child { border-left: 1px solid var(--sg-border, #d1d1d1); }
  .tab.active {
    background: var(--sg-bg, #fff);
    box-shadow: inset 0 -2px 0 0 var(--sg-accent, #107c41);
  }
  .tab.active button {
    color: var(--sg-accent, #107c41);
    font-weight: 600;
  }
  .tab:not(.active):hover { background: var(--sg-row-hover-bg, #e9e9e9); }
  .tab.dragging { opacity: 0.5; }
  button[role='tab'] {
    flex: 1 1 auto;
    font: inherit;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #444);
    padding: 0 12px;
    cursor: pointer;
    white-space: nowrap;
    text-align: center;
  }
  button[role='tab']:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -2px;
  }

  .add {
    align-self: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: 6px;
    padding: 0;
    border: 1px solid var(--sg-border, #c8c6c4);
    border-radius: 50%;
    background: var(--sg-bg, #fff);
    color: var(--sg-muted, #616161);
    cursor: pointer;
  }
  .add:hover { color: var(--sg-fg, #242424); border-color: var(--sg-muted, #8a8886); }
  .add:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: 1px;
  }

  .rename {
    font: inherit;
    width: 92px;
    margin: 2px 4px;
    border: 1px solid var(--sg-accent, #107c41);
    border-radius: 2px;
    padding: 1px 4px;
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-fg, #242424);
  }
  .error {
    align-self: center;
    margin-left: 8px;
    color: var(--sg-danger, #dc2626);
    font-size: 12px;
  }

  .sheet-menu {
    position: fixed;
    z-index: 1000;
    min-width: 150px;
    padding: 4px;
    font-family: var(--sg-font, "Segoe UI", system-ui, sans-serif);
    font-size: 12px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #242424);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 4px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
  }
  .sheet-menu button {
    display: block;
    width: 100%;
    padding: 5px 10px;
    font: inherit;
    text-align: left;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .sheet-menu button:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f0f0f0); }
  .sheet-menu button:disabled { opacity: 0.4; cursor: default; }
  .sheet-menu .sep { height: 1px; margin: 4px 6px; background: var(--sg-border, #e0e0e0); }
  .sheet-menu .heading { padding: 4px 10px 2px; color: var(--sg-muted, #616161); font-size: 11px; }
  .sheet-menu button.indent { padding-left: 22px; }
  .note { margin: 0; }
</style>
