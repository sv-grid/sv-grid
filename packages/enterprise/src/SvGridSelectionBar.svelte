<script lang="ts">
  /**
   * The bulk-action bar (Pro renderer for `<SvGrid selectionBar={...}>`).
   *
   * Floats over the grid while rows are selected: a count chip, then the
   * actions that apply to the whole selection, then a clear button - the shape
   * an issue tracker uses for bulk edit.
   *
   * The grid decides WHETHER this exists and normalises the prop; this renders
   * it. Everything it reads comes off the controller handle, so the free grid
   * needs no knowledge of what lives here.
   */
  import { onMount } from 'svelte'
  import SvGridBulkEditDrawer from './SvGridBulkEditDrawer.svelte'

  let { ctrl }: { ctrl: any } = $props()

  type Target = { rows: unknown[]; ids: string[] }
  type Action = {
    key: string
    label: string
    icon?: string
    danger?: boolean
    hidden?: (t: Target) => boolean
    disabled?: (t: Target) => boolean
    action: (t: Target) => void
  }

  const target = $derived(ctrl.selectionBarTarget as Target)
  const count = $derived(target.ids.length)
  const messages = $derived(ctrl.messages)
  const position = $derived(ctrl.selectionBarPosition as 'top' | 'bottom')
  const maxVisible = $derived(ctrl.selectionBarMaxVisible as number)
  const hideClear = $derived(ctrl.selectionBarHideClear as boolean)

  let bulkEditOpen = $state(false)

  // Single-path 24x24 icons, matching the stroke style the grid uses elsewhere.
  const ICON = {
    selectAll: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    editFields: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z',
  }

  /** Turn the built-in string keys into real actions. */
  function resolve(entry: Action | string): Action | 'separator' | null {
    if (typeof entry !== 'string') return entry
    if (entry === 'separator') return 'separator'
    if (entry === 'selectAll') {
      return {
        key: 'selectAll',
        label: messages.selectionBarSelectAll,
        icon: ICON.selectAll,
        // Nothing to do once the whole view is already picked.
        disabled: () => ctrl.headerSelectionState === 'all',
        action: () => ctrl.toggleSelectAllRows(),
      }
    }
    if (entry === 'editFields') {
      return {
        key: 'editFields',
        label: messages.selectionBarEditFields,
        icon: ICON.editFields,
        action: () => (bulkEditOpen = true),
      }
    }
    return null
  }

  // Predicates run per render against the LIVE selection, so a rule like "only
  // at two or more rows" flips as the user ticks rather than freezing at the
  // first paint.
  const entries = $derived(
    (ctrl.selectionBarActions as Array<Action | string>)
      .map(resolve)
      .filter((e): e is Action | 'separator' => e != null)
      .filter((e) => e === 'separator' || !e.hidden?.(target)),
  )
  // Separators do not count towards the limit - they are punctuation, not
  // buttons, and letting them push a real action into the menu would be odd.
  const buttons = $derived(entries.filter((e): e is Action => e !== 'separator'))
  const overflow = $derived(buttons.length > maxVisible ? buttons.slice(maxVisible) : [])
  const overflowKeys = $derived(new Set(overflow.map((a) => a.key)))
  const inline = $derived(entries.filter((e) => e === 'separator' || !overflowKeys.has(e.key)))

  let overflowOpen = $state(false)
  let barEl = $state<HTMLElement | null>(null)

  const fill = (template: string, n: number) => template.replace(/\{count\}/g, String(n))
  const clearSelection = () => ctrl.grid.setRowSelection(() => ({}))

  function run(a: Action) {
    overflowOpen = false
    a.action(target)
  }

  /**
   * Roving focus, which is what `role="toolbar"` promises a screen reader:
   * one tab stop for the bar, then Left/Right between its buttons. Without it
   * a bar with six actions puts six stops between the grid and whatever comes
   * after it.
   */
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (overflowOpen) {
        overflowOpen = false
        event.stopPropagation()
        return
      }
      clearSelection()
      event.stopPropagation()
      return
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const items = [...(barEl?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    if (items.length < 2) return
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    items[(at + step + items.length) % items.length]!.focus()
  }

  // Close the overflow menu on any pointerdown that is not inside the bar.
  onMount(() => {
    const onDown = (e: PointerEvent) => {
      if (!overflowOpen) return
      if (barEl && e.composedPath().includes(barEl)) return
      overflowOpen = false
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  })
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={barEl}
  class="sv-selbar"
  data-position={position}
  role="toolbar"
  aria-label={messages.selectionBarLabel}
  aria-orientation="horizontal"
  onkeydown={onKeydown}
>
  <span class="sv-selbar-count" aria-live="polite">
    <span class="sv-selbar-chip">{count}</span>
    <span class="sv-selbar-count-label">{messages.selectionBarCount}</span>
  </span>

  {#if inline.length}
    <span class="sv-selbar-sep" aria-hidden="true"></span>
  {/if}

  {#each inline as entry, i (entry === 'separator' ? `sep${i}` : entry.key)}
    {#if entry === 'separator'}
      <span class="sv-selbar-sep" aria-hidden="true"></span>
    {:else}
      {@const isDisabled = entry.disabled?.(target) ?? false}
      <button
        type="button"
        class="sv-selbar-btn"
        class:is-danger={entry.danger}
        class:has-icon={!!entry.icon}
        title={entry.label}
        aria-label={entry.label}
        disabled={isDisabled}
        onclick={() => run(entry)}
      >
        {#if entry.icon}
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d={entry.icon} />
          </svg>
        {/if}
        <span>{entry.label}</span>
      </button>
    {/if}
  {/each}

  {#if overflow.length}
    <div class="sv-selbar-more">
      <button
        type="button"
        class="sv-selbar-btn sv-selbar-more-btn"
        aria-haspopup="menu"
        aria-expanded={overflowOpen}
        aria-label={messages.selectionBarMore}
        title={messages.selectionBarMore}
        onclick={() => (overflowOpen = !overflowOpen)}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {#if overflowOpen}
        <div class="sv-selbar-menu" data-position={position} role="menu">
          {#each overflow as a (a.key)}
            {@const isDisabled = a.disabled?.(target) ?? false}
            <button
              type="button"
              class="sv-selbar-menu-item"
              class:is-danger={a.danger}
              role="menuitem"
              disabled={isDisabled}
              onclick={() => run(a)}
            >
              {#if a.icon}
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d={a.icon} />
                </svg>
              {/if}
              <span>{a.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if !hideClear}
    <span class="sv-selbar-sep" aria-hidden="true"></span>
    <button
      type="button"
      class="sv-selbar-clear"
      aria-label={messages.selectionBarClear}
      title={messages.selectionBarClear}
      onclick={clearSelection}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  {/if}
</div>

<SvGridBulkEditDrawer {ctrl} bind:open={bulkEditOpen} />

<style>
  /* `absolute` against `.sv-grid-root`, not `fixed`: fixed escapes the grid and
     floats over the page, which is wrong when there are two grids on a screen,
     and it anchors to the wrong box inside any ancestor with a transform. */
  .sv-selbar {
    position: absolute;
    left: 50%;
    /*
     * Above the grid's own custom scrollbars, which sit at 40 / 41 / 42.
     *
     * At 30 the bar tied with pinned cells and the sticky header and lost to
     * the scrollbars outright: a bottom-anchored bar overlaps the horizontal
     * scrollbar by a pixel and the vertical one by a few, and the scrollbar
     * painted over the bar's corner and shadow.
     *
     * Deliberately BELOW find-in-grid (60) and the menus / backdrops (900+):
     * an overlay the user just opened should win over persistent chrome.
     */
    z-index: 45;
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: calc(100% - 24px);
    --selbar-pad-y: 6px;
    padding: var(--selbar-pad-y) 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #fff);
    box-shadow: 0 8px 28px rgb(15 23 42 / 20%), 0 1px 2px rgb(15 23 42 / 10%);
    font-family: var(--sg-font, inherit);
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
    /* NO overflow here. Any value but `visible` clips absolutely-positioned
       descendants, and the "..." menu is one - setting `overflow-x: auto` as
       an anti-overlap backstop made the menu invisible and unclickable.
       Buttons shrink instead; see .sv-selbar-btn. */
  }
  .sv-selbar[data-position='bottom'] {
    bottom: 16px;
    transform: translateX(-50%);
    animation: sv-selbar-up 140ms ease-out;
  }
  .sv-selbar[data-position='top'] {
    top: 16px;
    transform: translateX(-50%);
    animation: sv-selbar-down 140ms ease-out;
  }
  /* The entrance is what makes the bar read as arriving rather than as a row
     that was always there. Both keyframes keep the -50% X so the slide is
     vertical only. */
  @keyframes sv-selbar-up {
    from { transform: translate(-50%, 10px); opacity: 0; }
    to   { transform: translate(-50%, 0);    opacity: 1; }
  }
  @keyframes sv-selbar-down {
    from { transform: translate(-50%, -10px); opacity: 0; }
    to   { transform: translate(-50%, 0);     opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-selbar[data-position='bottom'],
    .sv-selbar[data-position='top'] { animation: none; }
  }

  /* Count as a chip + label rather than one string: the number is the thing a
     user checks before hitting a destructive button, so it gets its own
     high-contrast block instead of blending into the sentence. */
  .sv-selbar-count {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 6px 0 4px;
    white-space: nowrap;
  }
  .sv-selbar-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 4px;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .sv-selbar-count-label { color: var(--sg-muted, #64748b); }

  .sv-selbar-sep {
    width: 1px;
    align-self: stretch;
    margin: 3px 4px;
    background: var(--sg-border, #e2e8f0);
    flex: none;
  }

  .sv-selbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    /* A flex item will not shrink below its content unless told to, which is
       how six nowrap labels ended up drawn on top of each other on a phone.
       With min-width 0 the label ellipsises instead. */
    min-width: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--sg-fg, #0f172a);
    padding: 5px 9px;
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }
  .sv-selbar-btn:hover:not(:disabled) {
    background: var(--sg-row-hover-bg, rgb(148 163 184 / 14%));
  }
  .sv-selbar-btn:disabled { opacity: 0.4; cursor: default; }
  /* Not red by default. An issue tracker's Delete sits in the same neutral row
     as everything else, and a bar of one red button trains people to ignore
     the colour. `danger: true` is there for when an action really warrants it. */
  .sv-selbar-btn.is-danger { color: var(--sg-danger, #dc2626); }
  .sv-selbar-btn.is-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--sg-danger, #dc2626) 12%, transparent 88%);
  }
  .sv-selbar-more-btn { padding: 5px 7px; flex: none; }
  .sv-selbar-btn > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sv-selbar-btn > svg { flex: none; }

  .sv-selbar-more { position: relative; display: inline-flex; }
  .sv-selbar-menu {
    position: absolute;
    right: 0;
    min-width: 172px;
    padding: 4px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #fff);
    box-shadow: 0 8px 28px rgb(15 23 42 / 20%);
    display: flex;
    flex-direction: column;
    gap: 1px;
    z-index: 1;
  }
  /* Open away from the edge the bar is pinned to, so the menu never falls off
     the grid: a bottom bar opens upward, a top bar opens downward.

     The offset clears the BAR, not the button. `100%` is the trigger wrapper,
     which sits inside the bar's vertical padding - so a plain `100% + 6px`
     left the menu overlapping the bar by the padding. Hence + --selbar-pad-y. */
  .sv-selbar-menu[data-position='bottom'] { bottom: calc(100% + var(--selbar-pad-y) + 6px); }
  .sv-selbar-menu[data-position='top'] { top: calc(100% + var(--selbar-pad-y) + 6px); }

  .sv-selbar-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--sg-fg, #0f172a);
    padding: 7px 9px;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .sv-selbar-menu-item:hover:not(:disabled) {
    background: var(--sg-row-hover-bg, rgb(148 163 184 / 14%));
  }
  .sv-selbar-menu-item:disabled { opacity: 0.4; cursor: default; }
  .sv-selbar-menu-item.is-danger { color: var(--sg-danger, #dc2626); }

  .sv-selbar-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    flex: none;
  }
  .sv-selbar-clear:hover {
    background: var(--sg-row-hover-bg, rgb(148 163 184 / 14%));
    color: var(--sg-fg, #0f172a);
  }

  .sv-selbar button:focus-visible {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: 1px;
  }

  /* Narrow: drop to icons and keep the count chip. Six labelled buttons do not
     fit a phone, and a bar you have to scroll sideways is a bar whose last
     action nobody reaches.

     Only buttons that HAVE an icon lose their label - an icon-less action would
     otherwise render as an empty box. The label survives as the tooltip and as
     the accessible name, which is on the button itself, so nothing is lost to a
     screen reader. */
  @media (max-width: 640px) {
    .sv-selbar { gap: 0; padding-left: 6px; }
    .sv-selbar-btn.has-icon span { display: none; }
    .sv-selbar-btn.has-icon { padding: 6px 8px; }
    .sv-selbar-count { padding-right: 2px; }
    .sv-selbar-count-label { display: none; }
    .sv-selbar-sep { margin: 3px 2px; }
  }
</style>
