<script lang="ts">
  /**
   * 65. Keyboard shortcuts + ARIA grid pattern
   * -----------------------------------------
   *   - `Ctrl/Cmd+K` open / close the command palette
   *   - `Ctrl/Cmd+/` toggle the keyboard cheat sheet
   *   - `g g`        jump to the first row (vim chord)
   *   - `G`          jump to the last row
   *   - `Esc`        close any open overlay
   *
   * Overlays use plain `position: fixed` with z-index 9999 (no portals)
   * so they always render even when an ancestor creates a stacking
   * context. The document keydown listener bails when the target is a
   * text input, so typing "g" in the palette doesn't trigger the chord.
   */
  import { onMount, tick } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-core'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const rows = makePeople(60)
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  let showPalette = $state(false)
  let showCheatsheet = $state(false)
  let paletteQuery = $state('')
  let paletteInput = $state<HTMLInputElement | null>(null)
  let lastChord = $state<string>('')
  let chordReset: number | null = null

  $effect(() => {
    if (showPalette) tick().then(() => paletteInput?.focus())
  })

  function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    if (!el) return false
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
    return Boolean(el.isContentEditable)
  }

  let prev = ''
  function onKey(e: KeyboardEvent) {
    const isMod = e.ctrlKey || e.metaKey

    if (isMod && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      showPalette = !showPalette
      showCheatsheet = false
      return
    }
    if (isMod && e.key === '/') {
      e.preventDefault()
      showCheatsheet = !showCheatsheet
      return
    }
    if (e.key === 'Escape' && (showPalette || showCheatsheet)) {
      e.preventDefault()
      showPalette = false
      showCheatsheet = false
      return
    }

    if (isTyping(e.target)) { prev = ''; return }

    if (e.key === 'G' && e.shiftKey && !isMod) {
      e.preventDefault()
      jumpToRow(rows.length - 1)
      lastChord = 'G'
      return
    }
    if (e.key === 'g' && !e.shiftKey && !isMod) {
      e.preventDefault()
      if (prev === 'g') {
        jumpToRow(0)
        lastChord = 'gg'
        prev = ''
        return
      }
      prev = 'g'
      if (chordReset) clearTimeout(chordReset)
      chordReset = window.setTimeout(() => { prev = '' }, 700)
      return
    }
    prev = ''
  }

  /** Scroll the grid's viewport so the target row is centred, then focus
   * its first cell. We compute the scroll offset from rowHeight so the row
   * is brought into view even if the virtualizer hasn't rendered it yet,
   * then wait a tick for the new range to render before focusing. */
  async function jumpToRow(i: number) {
    const root = document.querySelector('[role="grid"]') as HTMLElement | null
    if (!root) return
    const ROW_HEIGHT = 32
    // The grid's scroll container is the closest ancestor with overflow set.
    let scroller: HTMLElement | null = root.parentElement
    while (scroller && getComputedStyle(scroller).overflowY === 'visible') {
      scroller = scroller.parentElement
    }
    if (scroller) {
      const target = Math.max(0, i * ROW_HEIGHT - scroller.clientHeight / 2 + ROW_HEIGHT / 2)
      scroller.scrollTop = target
    }
    await tick()
    // Try a few times - the virtualizer may need an extra paint to render
    // the target row after scrollTop changes.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const cell = root.querySelector(`tbody tr[data-svgrid-row="${i}"] td`) as HTMLElement | null
      if (cell) {
        cell.focus()
        cell.scrollIntoView({ block: 'center' })
        return
      }
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    }
  }

  onMount(() => {
    document.addEventListener('keydown', onKey, { capture: true })
    // Auto-focus the grid's first cell after mount so arrow keys / PgUp /
    // PgDn navigate (and auto-scroll) the moment the demo loads. Without
    // this, the user has to click into a cell first - then it looks like
    // "arrow keys don't scroll".
    void tick().then(() => {
      requestAnimationFrame(() => {
        const root = document.querySelector('[role="grid"]') as HTMLElement | null
        const cell = root?.querySelector(
          'tbody tr[data-svgrid-row="0"] td[data-svgrid-col="0"], tbody tr[data-svgrid-row="0"] td',
        ) as HTMLElement | null
        cell?.focus()
      })
    })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  })

  const SHORTCUTS = [
    { keys: ['Ctrl', 'K'],           action: 'Open / close command palette' },
    { keys: ['Ctrl', '/'],           action: 'Toggle this cheat sheet' },
    { keys: ['↑', '↓', '←', '→'],    action: 'Move active cell' },
    { keys: ['Home / End'],          action: 'First / last column in row' },
    { keys: ['PgUp / PgDn'],         action: 'Page up / down' },
    { keys: ['g', 'g'],              action: 'Jump to first row (chord)' },
    { keys: ['G'],                   action: 'Jump to last row' },
    { keys: ['Enter'],               action: 'Start editing the active cell' },
    { keys: ['Esc'],                 action: 'Cancel edit / close overlay' },
    { keys: ['Ctrl', 'C'],           action: 'Copy cell range as TSV' },
    { keys: ['Ctrl', 'V'],           action: 'Paste TSV into range' },
  ]

  type PaletteItem = { id: string; label: string; run: () => void }
  const allItems: PaletteItem[] = [
    { id: 'jump-top',  label: 'Jump to first row',         run: () => jumpToRow(0) },
    { id: 'jump-end',  label: 'Jump to last row',          run: () => jumpToRow(rows.length - 1) },
    { id: 'clear',     label: 'Clear all filters',         run: () => api?.clearAllFilters() },
    { id: 'cheats',    label: 'Show keyboard cheat sheet', run: () => (showCheatsheet = true) },
  ]
  const matches = $derived(
    allItems.filter((it) => it.label.toLowerCase().includes(paletteQuery.toLowerCase())),
  )

  function runItem(it: PaletteItem) {
    // Close the palette first, then defer the action so any panel it
    // opens (e.g. the cheatsheet) mounts cleanly after the palette is
    // unmounted. Without the tick the two overlays race during the same
    // microtask and the second one sometimes never renders.
    showPalette = false
    paletteQuery = ''
    tick().then(() => it.run())
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <button type="button" onclick={() => (showPalette = true)}
      class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
      >⌘ K - Command palette</button>
    <button type="button" onclick={() => (showCheatsheet = !showCheatsheet)}
      class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
      >⌘ / - Keyboard shortcuts</button>
    {#if lastChord}
      <span class="text-xs text-slate-500 dark:text-slate-400">last chord: <code>{lastChord}</code></span>
    {/if}
    <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">Try <kbd>g g</kbd>, <kbd>G</kbd>, <kbd>⌘ K</kbd></span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={[
        { field: 'firstName',  header: 'First',      width: 110 },
        { field: 'lastName',   header: 'Last',       width: 130 },
        { field: 'department', header: 'Department', width: 140 },
        { field: 'country',    header: 'Country',    width: 90 },
        { field: 'age',        header: 'Age',        width: 80 },
        { field: 'salary', header: 'Salary', width: 130,
          format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
      ] satisfies ColumnDef<typeof features, Person>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      virtualization={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>

  <!-- Command palette overlay (no portal - position:fixed + z-index 9999) -->
  {#if showPalette}
    <button type="button" aria-label="Close palette" class="kbd-backdrop"
      onclick={() => (showPalette = false)}></button>
    <div role="dialog" aria-modal="true" aria-label="Command palette" class="kbd-palette">
      <input
        bind:this={paletteInput}
        type="text"
        placeholder="Type a command…"
        bind:value={paletteQuery}
        onkeydown={(e) => { if (e.key === 'Enter' && matches[0]) runItem(matches[0]) }}
      />
      <ul>
        {#each matches as it (it.id)}
          <li>
            <button type="button" onclick={() => runItem(it)}>{it.label}</button>
          </li>
        {/each}
        {#if matches.length === 0}
          <li class="empty">No matches</li>
        {/if}
      </ul>
    </div>
  {/if}

  {#if showCheatsheet}
    <button type="button" aria-label="Close cheat sheet" class="kbd-backdrop"
      onclick={() => (showCheatsheet = false)}></button>
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" class="kbd-cheatsheet">
      <header>
        <span>Keyboard shortcuts</span>
        <button type="button" class="kbd-close" aria-label="Close"
          onclick={() => (showCheatsheet = false)}>×</button>
      </header>
      <ul>
        {#each SHORTCUTS as s (s.action)}
          <li>
            <span>{s.action}</span>
            <span class="keys">
              {#each s.keys as k, i (i)}<kbd>{k}</kbd>{/each}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  kbd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

  .kbd-backdrop {
    position: fixed; inset: 0; z-index: 9998;
    background: rgba(15, 23, 42, 0.45);
    border: 0; padding: 0; cursor: default;
  }

  .kbd-palette {
    position: fixed; z-index: 9999;
    top: 15vh; left: 50%; transform: translateX(-50%);
    width: min(520px, 92vw);
    border-radius: 12px;
    border: 1px solid rgba(15, 23, 42, 0.15);
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35);
    overflow: hidden;
  }
  :global([data-theme="dark"]) .kbd-palette { background: #0f172a; color: #f8fafc; border-color: rgba(255,255,255,0.08); }
  .kbd-palette input {
    display: block; width: 100%;
    background: transparent; color: inherit;
    border: 0; border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    padding: 14px 16px; font-size: 15px;
    outline: none;
  }
  :global([data-theme="dark"]) .kbd-palette input { border-bottom-color: rgba(255,255,255,0.08); }
  .kbd-palette input::placeholder { color: rgba(15, 23, 42, 0.45); }
  .kbd-palette ul { list-style: none; margin: 0; padding: 4px 0; max-height: 360px; overflow: auto; }
  .kbd-palette li button {
    display: block; width: 100%; text-align: left;
    background: transparent; border: 0; color: inherit;
    padding: 8px 16px; font-size: 14px; cursor: pointer;
  }
  .kbd-palette li button:hover { background: rgba(99,102,241,0.12); }
  .kbd-palette li.empty { padding: 12px 16px; color: rgba(15, 23, 42, 0.45); font-size: 13px; }

  .kbd-cheatsheet {
    position: fixed; z-index: 9999;
    top: 80px; right: 24px;
    width: min(380px, 92vw);
    border-radius: 12px;
    border: 1px solid rgba(15, 23, 42, 0.15);
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35);
    overflow: hidden;
  }
  :global([data-theme="dark"]) .kbd-cheatsheet { background: #0f172a; color: #f8fafc; border-color: rgba(255,255,255,0.08); }
  .kbd-cheatsheet header {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    color: rgba(15, 23, 42, 0.55);
    padding: 12px 16px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }
  :global([data-theme="dark"]) .kbd-cheatsheet header { color: rgba(248, 250, 252, 0.55); border-bottom-color: rgba(255,255,255,0.08); }
  .kbd-close {
    background: transparent; border: 0; color: inherit; cursor: pointer;
    font-size: 18px; line-height: 1; padding: 0 4px;
  }
  .kbd-cheatsheet ul { list-style: none; margin: 0; padding: 6px 0; }
  .kbd-cheatsheet li {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 16px; font-size: 13px;
  }
  .kbd-cheatsheet .keys { display: inline-flex; gap: 4px; }
  .kbd-cheatsheet kbd {
    border: 1px solid rgba(15, 23, 42, 0.18);
    background: rgba(241, 245, 249, 0.7);
    border-radius: 4px;
    padding: 2px 6px; font-size: 11px; min-width: 18px; text-align: center;
  }
  :global([data-theme="dark"]) .kbd-cheatsheet kbd { background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); }
</style>
