<script lang="ts">
  /**
   * The ribbon.
   *
   * Renders `RIBBON_TABS` and nothing else: the tab strip, then a band of
   * groups, each a block of controls over a small centred group label.
   * That label is the thing that makes a ribbon read as a ribbon rather than
   * as a toolbar, so it is not optional.
   *
   * The geometry is Excel's. A group is three rows of 24px; a large button
   * (icon over label) takes a whole column of that height and a small one
   * takes a row, so Cut / Copy / Paste Special stack beside a tall Paste. A
   * split button pairs a face that applies the last pick with an arrow that
   * opens the menu, and the colour menus are Excel's picker: the theme row,
   * five tints and shades under each colour, then the standard colours.
   *
   * It is responsive the way Excel's is, in Excel's two steps: when the band
   * is narrower than its groups, groups go compact from the right (small
   * buttons keep the icon and drop the label), and only when every group is
   * compact do groups fold, again from the right, into one large button each
   * that opens the group in a dropdown. Nothing is hidden, it is only folded.
   * The three widths of every group are measured off invisible copies of the
   * band, so a group that starts folded still knows how wide it would like
   * to be.
   *
   * It collapses the way Excel's does: a double-click on a tab, the chevron
   * at the band's end or Ctrl+F1 leaves the tab row alone, a click on a tab
   * then shows the band over the sheet until a command runs, and the pin at
   * its end brings it back for good (`collapsed`, bindable).
   *
   * Painted with the grid's own --sg-* tokens rather than Excel's palette, so
   * it matches whatever theme the app runs. Pick the `excel` theme preset and
   * it reads as Excel; pick a dark one and it stays legible.
   *
   * The ribbon owns no sheet state. Every button calls an action from
   * `sheet/ribbon.ts`, which calls the same function the matching keystroke
   * does, so a button and its shortcut cannot drift apart.
   */
  import { SvPopover } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import SvRibbonIcon from './SvRibbonIcon.svelte'
  import {
    RIBBON_TABS,
    type RibbonTab, type RibbonGroup, type RibbonItem, type RibbonOption, type RibbonActionId,
  } from './sheet/ribbon'
  import { THEME_COLOURS, STANDARD_COLOURS } from './sheet/palette'

  type Props = {
    /**
     * How to reach the grid. A getter rather than the context itself because
     * the context is rebuilt per call and the ribbon needs a live one at the
     * moment a button is pressed, not the one that existed at mount.
     */
    cmd: () => GridCommandContext | null
    /** Called after any action that changed something, so the host re-renders. */
    onChange?: () => void
    /** Actions the ribbon does not run itself, because they need chrome. */
    onAction?: (action: RibbonActionId, cmd: GridCommandContext) => void
    /** Which of `onAction`'s toggles are currently on. The host owns that
     *  state (there is no store here to read it from), so it reports it. */
    activeActions?: ReadonlyArray<RibbonActionId>
    tabs?: ReadonlyArray<RibbonTab>
    /** Start on a tab other than the first. */
    tab?: string
    /**
     * Actions to leave off the ribbon: a button nobody answers is worse
     * than no button. A group with nothing left in it goes too.
     */
    without?: ReadonlyArray<RibbonActionId>
    /**
     * Excel's collapsed ribbon: the tabs alone. A click on a tab shows the
     * band over the sheet until a command runs or the pointer leaves;
     * double-clicking a tab, the chevron and Ctrl+F1 toggle it.
     */
    collapsed?: boolean
  }

  let {
    cmd,
    onChange,
    onAction,
    activeActions = [],
    tabs = RIBBON_TABS,
    // Excel opens on Home, not on File, whatever tab comes first.
    tab = $bindable(tabs.some((t) => t.id === 'home') ? 'home' : tabs[0]?.id ?? 'home'),
    without = [],
    collapsed = $bindable(false),
  }: Props = $props()

  /** The band shown over the sheet while the ribbon is collapsed. */
  let peek = $state(false)
  function onTabClick(id: string) {
    if (collapsed) { peek = tab === id ? !peek : true }
    tab = id
  }
  function toggleCollapsed() {
    collapsed = !collapsed
    peek = false
  }
  $effect(() => {
    if (!collapsed) peek = false
  })
  $effect(() => {
    if (!peek) return
    // A click outside the ribbon, or Escape, puts the peeked band away.
    const away = (e: PointerEvent) => { if (!rootEl?.contains(e.target as Node) && !(e.target as HTMLElement)?.closest?.('.sv-popover, .sv-modal')) peek = false }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') peek = false }
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', esc, true) }
  })

  /**
   * Bumped after every action so the `isOn` / `isEnabled` / `current` reads
   * below re-run.
   *
   * They read through the command context into the grid and the format store,
   * neither of which is `$state`, so nothing would otherwise tell Svelte that
   * pressing Bold should light the Bold button up.
   */
  let version = $state(0)

  const current = $derived.by(() => {
    const found = tabs.find((t) => t.id === tab) ?? tabs[0]
    if (!found || without.length === 0) return found
    const groups = found.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => !i.emits || !without.includes(i.emits)) }))
      .filter((g) => g.items.length > 0)
    return { ...found, groups }
  })

  function stateOf(item: RibbonItem): { on: boolean; enabled: boolean } {
    void version
    const context = cmd()
    if (!context) return { on: false, enabled: false }
    if (item.emits) {
      return { on: activeActions.includes(item.emits), enabled: true }
    }
    return {
      on: item.lit ? activeActions.includes(item.lit) : (item.isOn?.(context) ?? false),
      enabled: item.isEnabled?.(context) ?? true,
    }
  }

  function currentOf(item: RibbonItem): string {
    void version
    const context = cmd()
    return context && item.current ? item.current(context) : ''
  }

  function run(item: RibbonItem, value?: string) {
    const context = cmd()
    if (!context) return
    if (item.emits) {
      onAction?.(item.emits, context)
      version += 1
      // Focus goes back to the sheet here too. A dialog the action opens
      // takes it from there and, being what had focus when the dialog
      // opened, the sheet is where the dialog returns it; an action with no
      // dialog (Sort A to Z) leaves the next Ctrl+Z on the sheet rather
      // than on the button.
      context.focus()
      peek = false
      return
    }
    // Only report a change when the action says it did something. A declined
    // action (nothing selected, no store attached) should not make the host
    // re-render and should not look like it worked.
    if (item.run?.(context, value)) onChange?.()
    version += 1
    // The click left focus on the button. Excel puts it back on the sheet, so
    // the next keystroke - Ctrl+Z, or just typing - goes where the user is
    // looking rather than re-pressing Bold.
    context.focus()
    // A command from the peeked band is the band's last act; Excel's goes
    // away the same moment.
    peek = false
  }

  function launch(action: RibbonActionId) {
    const context = cmd()
    if (context) onAction?.(action, context)
    peek = false
  }

  /** Excel puts the shortcut after the name in the tooltip. */
  function tip(item: RibbonItem): string {
    return item.keys ? `${item.title} (${item.keys})` : item.title
  }

  /**
   * Re-read the toggles when the selection moves, so Bold lights up when you
   * click a bold cell rather than only after you press a ribbon button.
   * Cheap: it only bumps a counter, and the reads are lazy.
   */
  function refresh() {
    version += 1
  }

  // ---- split buttons -------------------------------------------------------
  /** The last value picked from each menu, which its face re-applies. */
  let picked = $state<Record<string, string>>({})
  // Every key exists from the start: a popover's `open` is bound to one of
  // these, and binding an undefined value to a prop with a fallback is an
  // error in Svelte rather than a false.
  // svelte-ignore state_referenced_locally
  let menuOpen = $state<Record<string, boolean>>(
    Object.fromEntries(tabs.flatMap((t) => t.groups.flatMap((g) => g.items.map((i) => [i.id, false])))),
  )

  function faceValue(item: RibbonItem): string {
    return picked[item.id] ?? item.initial ?? item.options?.[0]?.value ?? ''
  }

  function pick(item: RibbonItem, value: string) {
    picked = { ...picked, [item.id]: value }
    menuOpen = { ...menuOpen, [item.id]: false }
    run(item, value)
  }

  /** A dropdown's entry: its own action, or the item's run with its value. */
  function pickOption(item: RibbonItem, option: RibbonOption) {
    menuOpen = { ...menuOpen, [item.id]: false }
    if (option.emits) {
      const context = cmd()
      if (!context) return
      onAction?.(option.emits, context)
      version += 1
      context.focus()
      peek = false
      return
    }
    run(item, option.value)
  }

  /** Whether a face's colour bar has a colour to show, or means "none". */
  function barColour(item: RibbonItem): string | null {
    const value = faceValue(item)
    return value === item.none?.value ? null : value
  }

  // ---- responsive collapse -------------------------------------------------
  /** Natural width of each group, expanded, measured off the hidden band. */
  const natural = new Map<string, number>()
  /** The same with the small buttons' labels off: Excel's first step down. */
  const compactWidth = new Map<string, number>()
  /** And folded to one large button, whose width its label sets. */
  const foldedWidth = new Map<string, number>()
  let measured = $state(0)
  let bandWidth = $state(0)
  // svelte-ignore state_referenced_locally
  let groupOpen = $state<Record<string, boolean>>(
    Object.fromEntries(tabs.flatMap((t) => t.groups.map((g) => [g.id, false]))),
  )

  /** A folded group before its button has been measured. */
  const COLLAPSED_WIDTH = 66
  /** The band's own padding (4px a side; `clientWidth` already leaves the
   *  border out) and the collapse chevron at its end (20px and 4px of
   *  margins), so the fit is judged against the space the groups really
   *  get. Without the chevron in the sum the last group sat 18px past the
   *  edge and the band scrolled by that much. */
  const BAND_PADDING = 8 + 24

  function measure(node: HTMLElement, key: string) {
    // "id" measures the group as drawn, "id:compact" with its labels off,
    // "id:folded" as the one large button it folds into.
    const colon = key.indexOf(':')
    const id = colon < 0 ? key : key.slice(0, colon)
    const into = key.endsWith(':compact') ? compactWidth : key.endsWith(':folded') ? foldedWidth : natural
    const record = () => {
      const width = node.getBoundingClientRect().width
      if (width > 0 && into.get(id) !== width) {
        into.set(id, width)
        measured += 1
      }
    }
    record()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(record)
    observer?.observe(node)
    return { destroy: () => observer?.disconnect() }
  }

  /**
   * How the band fits its width, Excel's way and in Excel's order: first
   * the groups go compact from the right (their small buttons keep the
   * icon and lose the label, so Fill Down is an arrow and Wrap Text a
   * glyph), and only when every group is compact and the band is still too
   * narrow do groups fold, again from the right, into one large button
   * each. Recomputed from scratch on every width change rather than
   * nudged, so growing the window undoes exactly what shrinking it did.
   */
  const fit = $derived.by(() => {
    void measured
    const groups = current?.groups ?? []
    const compact = new Set<string>()
    const folded = new Set<string>()
    if (!bandWidth) return { compact, folded }
    const wide = (g: RibbonGroup) => natural.get(g.id) ?? 120
    const narrow = (g: RibbonGroup) => compactWidth.get(g.id) ?? wide(g)
    const oneButton = (g: RibbonGroup) => foldedWidth.get(g.id) ?? COLLAPSED_WIDTH
    let total = BAND_PADDING
    for (const group of groups) total += wide(group)
    for (let i = groups.length - 1; i >= 0 && total > bandWidth; i -= 1) {
      const group = groups[i]!
      if (narrow(group) < wide(group)) { total += narrow(group) - wide(group); compact.add(group.id) }
    }
    for (let i = groups.length - 1; i >= 0 && total > bandWidth; i -= 1) {
      const group = groups[i]!
      total += oneButton(group) - (compact.has(group.id) ? narrow(group) : wide(group))
      folded.add(group.id)
    }
    return { compact, folded }
  })
  const collapsedGroups = $derived(fit.folded)

  /**
   * Excel's column model, made explicit. Items run down a column while
   * their rows go up (1, 2, 3) and a new column starts when they do not,
   * or at a large button, which is a column by itself. The grid's own
   * auto-placement keeps a cursor per row, so a two-item column (Undo over
   * Redo) had the next column's third item slide back under it.
   */
  function placed(items: ReadonlyArray<RibbonItem>): Array<{ item: RibbonItem; col: number }> {
    let col = 0
    let lastRow = 99
    return items.map((item) => {
      const row = item.size === 'large' ? 1 : (item.row ?? 1)
      if (item.size === 'large' || row <= lastRow) col += 1
      lastRow = item.size === 'large' ? 99 : row
      return { item, col }
    })
  }

  /** The icon a folded group shows: its own, else its large command's, else its first. */
  function groupIcon(group: RibbonGroup) {
    return group.icon ?? (group.items.find((i) => i.size === 'large') ?? group.items.find((i) => i.icon))?.icon ?? 'format-cells'
  }

  /**
   * What the empty font option is called. A cell with no font of its own
   * renders in the theme's font, and Excel's combo names the font a cell
   * has ("Aptos Narrow"), so the option reads the theme's first family
   * rather than "Default".
   */
  let rootEl = $state<HTMLDivElement | null>(null)
  let themeFont = $state('Default')
  $effect(() => {
    if (!rootEl) return
    const first = getComputedStyle(rootEl).fontFamily.split(',')[0]?.replace(/["']/g, '').trim()
    if (first) themeFont = first
  })

  function onTabKey(event: KeyboardEvent) {
    const ids = tabs.map((t) => t.id)
    const at = ids.indexOf(tab)
    if (event.key === 'ArrowRight' && at < ids.length - 1) { event.preventDefault(); tab = ids[at + 1]! }
    if (event.key === 'ArrowLeft' && at > 0) { event.preventDefault(); tab = ids[at - 1]! }
  }
</script>

<svelte:window onpointerup={refresh} onkeyup={refresh} />

<!--
  One button, either size. `live` is off inside the hidden measuring band:
  the copy there exists for its width alone, so it reads no state.
-->
{#snippet plainButton(item: RibbonItem, live: boolean)}
  {@const state = live ? stateOf(item) : { on: false, enabled: true }}
  <button
    type="button"
    class="btn"
    class:large={item.size === 'large'}
    class:wide={item.wide && item.size !== 'large'}
    class:on={state.on}
    disabled={!state.enabled}
    title={tip(item)}
    aria-label={item.title}
    aria-pressed={item.kind === 'toggle' ? state.on : undefined}
    onclick={() => run(item)}
  >
    {#if item.icon}
      <SvRibbonIcon name={item.icon} size={item.size === 'large' ? 32 : 16} />
    {:else}
      <span class="glyph" data-glyph={item.id}>{item.label}</span>
    {/if}
    {#if item.size === 'large' || item.wide}
      <span class="label">{item.label}</span>
    {/if}
  </button>
{/snippet}

<!-- Excel's split button: a face that re-applies the last pick, an arrow that opens the menu. -->
{#snippet split(item: RibbonItem, live: boolean)}
  {@const state = live ? stateOf(item) : { on: false, enabled: true }}
  {@const colour = barColour(item)}
  <div class="split" class:on={state.on} class:disabled={!state.enabled}>
    <button
      type="button"
      class="btn face"
      class:has-bar={item.palette}
      disabled={!state.enabled}
      title={tip(item)}
      aria-label={item.title}
      onclick={() => run(item, faceValue(item))}
    >
      {#if item.icon && !(item.palette && item.id === 'text-colour')}
        <SvRibbonIcon name={item.icon} />
      {:else}
        <span class="glyph" data-glyph={item.id}>{item.label}</span>
      {/if}
      {#if item.palette}
        <span class="bar" class:none={colour === null} style:background={colour ?? 'transparent'}></span>
      {/if}
    </button>
    {#if live}
      <SvPopover bind:open={menuOpen[item.id]} placement="bottom-start" arrow={false} offset={2} ariaLabel={item.title}>
        {#snippet anchor()}
          <button
            type="button"
            class="btn arrow"
            disabled={!state.enabled}
            aria-label={`${item.title} options`}
            aria-haspopup="menu"
            aria-expanded={menuOpen[item.id] ?? false}
          ><SvRibbonIcon name="chevron-down" size={10} /></button>
        {/snippet}
        {#if item.palette}
          <div class="palette" role="menu" aria-label={item.title}>
            {#if item.none}
              <button type="button" class="palette-none" role="menuitem" onclick={() => pick(item, item.none!.value)}>
                <span class="swatch no-colour" aria-hidden="true"></span>{item.none.label}
              </button>
            {/if}
            <div class="palette-title">Theme Colors</div>
            <div class="swatches">
              {#each THEME_COLOURS as row, r (r)}
                {#each row as c (c.value + r)}
                  <button type="button" class="swatch" class:shade={r > 0} role="menuitem" title={c.label} aria-label={c.label} style:background={c.value} onclick={() => pick(item, c.value)}></button>
                {/each}
              {/each}
            </div>
            <div class="palette-title">Standard Colors</div>
            <div class="swatches">
              {#each STANDARD_COLOURS as c (c.value)}
                <button type="button" class="swatch" role="menuitem" title={c.label} aria-label={c.label} style:background={c.value} onclick={() => pick(item, c.value)}></button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="menu" role="menu" aria-label={item.title}>
            {#each item.options ?? [] as option (option.value)}
              <button type="button" class="menu-item" role="menuitem" onclick={() => pick(item, option.value)}>
                {#if option.icon}<SvRibbonIcon name={option.icon} />{/if}
                <span>{option.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </SvPopover>
    {:else}
      <span class="btn arrow" aria-hidden="true"><SvRibbonIcon name="chevron-down" size={10} /></span>
    {/if}
  </div>
{/snippet}

<!-- Excel's plain menu button: the face opens the list, every entry acts on its own. -->
{#snippet dropdown(item: RibbonItem, live: boolean)}
  {@const state = live ? stateOf(item) : { on: false, enabled: true }}
  {#snippet face()}
    <button
      type="button"
      class="btn dropdown"
      class:wide={item.wide}
      class:large={item.size === 'large'}
      disabled={!state.enabled}
      title={tip(item)}
      aria-label={item.title}
      aria-haspopup="menu"
      aria-expanded={live ? (menuOpen[item.id] ?? false) : false}
    >
      {#if item.icon}
        <SvRibbonIcon name={item.icon} size={item.size === 'large' ? 32 : 16} />
      {:else}
        <span class="glyph" data-glyph={item.id}>{item.label}</span>
      {/if}
      {#if item.size === 'large' || item.wide}
        <span class="label">{item.label}</span>
      {/if}
      <SvRibbonIcon name="chevron-down" size={8} />
    </button>
  {/snippet}
  {#snippet entries()}
    <div class="menu" role="menu" aria-label={item.title}>
      {#each item.options ?? [] as option (option.value)}
        {#if option.heading}
          <div class="menu-heading" role="presentation">{option.label}</div>
        {:else}
          {#if option.toggle && option.emits}
            {@const on = live && activeActions.includes(option.emits)}
            <button type="button" class="menu-item" class:on role="menuitemcheckbox" aria-checked={on} onclick={() => pickOption(item, option)}>
              {#if option.icon}<SvRibbonIcon name={option.icon} />{/if}
              <span>{option.label}</span>
              {#if option.keys}<span class="keys">{option.keys}</span>{/if}
            </button>
          {:else}
            <button type="button" class="menu-item" role="menuitem" onclick={() => pickOption(item, option)}>
              {#if option.icon}<SvRibbonIcon name={option.icon} />{/if}
              <span>{option.label}</span>
              {#if option.keys}<span class="keys">{option.keys}</span>{/if}
            </button>
          {/if}
        {/if}
      {/each}
    </div>
  {/snippet}
  {#if item.split}
    <!-- Excel's split button. Large: the icon runs the item and the label
         with its chevron opens the entries. Small: face beside arrow, as
         the colour menus. -->
    <div class="split" class:split-large={item.size === 'large'} class:on={state.on} class:disabled={!state.enabled}>
      <button
        type="button"
        class="btn face"
        class:large={item.size === 'large'}
        disabled={!state.enabled}
        title={tip(item)}
        aria-label={item.title}
        onclick={() => run(item)}
      >
        {#if item.icon}
          <SvRibbonIcon name={item.icon} size={item.size === 'large' ? 32 : 16} />
        {:else}
          <span class="glyph" data-glyph={item.id}>{item.label}</span>
        {/if}
        <!-- A small wide split (Merge & Center) prints its label on the face, as
             Excel does; the colour splits stay icon-only. -->
        {#if item.wide && item.size !== 'large'}<span class="label">{item.label}</span>{/if}
      </button>
      {#if live}
        <SvPopover bind:open={menuOpen[item.id]} placement="bottom-start" arrow={false} offset={2} ariaLabel={item.title}>
          {#snippet anchor()}
            <button
              type="button"
              class="btn arrow"
              disabled={!state.enabled}
              aria-label={`${item.title} options`}
              aria-haspopup="menu"
              aria-expanded={menuOpen[item.id] ?? false}
            >{#if item.size === 'large'}<span class="label">{item.label}</span>{/if}<SvRibbonIcon name="chevron-down" size={10} /></button>
          {/snippet}
          {@render entries()}
        </SvPopover>
      {:else}
        <span class="btn arrow" aria-hidden="true">{#if item.size === 'large'}<span class="label">{item.label}</span>{/if}<SvRibbonIcon name="chevron-down" size={10} /></span>
      {/if}
    </div>
  {:else if live}
    <SvPopover bind:open={menuOpen[item.id]} placement="bottom-start" arrow={false} offset={2} ariaLabel={item.title}>
      {#snippet anchor()}
        {@render face()}
      {/snippet}
      {@render entries()}
    </SvPopover>
  {:else}
    {@render face()}
  {/if}
{/snippet}

{#snippet control(item: RibbonItem, live: boolean)}
  {#if item.kind === 'select'}
    {@const state = live ? stateOf(item) : { on: false, enabled: true }}
    <select
      class="select"
      data-select={item.id}
      title={tip(item)}
      aria-label={item.title}
      disabled={!state.enabled}
      value={live ? currentOf(item) : ''}
      onchange={(e) => run(item, e.currentTarget.value)}
    >
      {#if live && currentOf(item) && !item.options?.some((o) => o.value === currentOf(item))}
        <!-- A value the list does not carry (a 17px title) still reads on the
             face, the way Excel's combo shows whatever the cell has. -->
        <option value={currentOf(item)}>{currentOf(item)}</option>
      {/if}
      {#each item.options ?? [] as option (option.value)}
        <option value={option.value}>{option.value === '' && item.id === 'font-family' ? themeFont : option.label}</option>
      {/each}
    </select>
  {:else if item.kind === 'menu'}
    {@render split(item, live)}
  {:else if item.kind === 'dropdown'}
    {@render dropdown(item, live)}
  {:else}
    {@render plainButton(item, live)}
  {/if}
{/snippet}

<!-- The controls of one group, in Excel's three-row block. -->
{#snippet body(group: RibbonGroup, live: boolean)}
  {#if group.layout === 'flow'}
    <div class="controls flow">
      {#each [1, 2, 3] as row (row)}
        {@const items = group.items.filter((i) => (i.row ?? 1) === row)}
        {#if items.length}
          <div class="row">
            {#each items as item (item.id)}{@render control(item, live)}{/each}
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="controls grid">
      {#each placed(group.items) as { item, col } (item.id)}
        <div class="cell" style:grid-row={item.size === 'large' ? '1 / span 3' : String(item.row ?? 1)} style:grid-column={col}>
          {@render control(item, live)}
        </div>
      {/each}
    </div>
  {/if}
{/snippet}

<div class="sv-ribbon" class:collapsed role="toolbar" aria-label="Spreadsheet ribbon" aria-orientation="horizontal" bind:this={rootEl}>
  <div class="tabs" role="tablist" aria-label="Ribbon tabs">
    {#each tabs as entry (entry.id)}
      <button
        type="button"
        role="tab"
        class="tab"
        class:active={entry.id === current?.id}
        aria-selected={entry.id === current?.id}
        tabindex={entry.id === current?.id ? 0 : -1}
        onclick={() => onTabClick(entry.id)}
        ondblclick={toggleCollapsed}
        onkeydown={onTabKey}
      >{entry.label}</button>
    {/each}
    <span class="tabs-grow"></span>
    {#if collapsed && !peek}
      <button type="button" class="ribbon-toggle" title="Expand the Ribbon (Ctrl+F1)" aria-label="Expand the Ribbon" aria-expanded="false" onclick={toggleCollapsed}>
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    {/if}
  </div>

  <div class="band" class:away={collapsed && !peek} class:peek={collapsed && peek} bind:clientWidth={bandWidth}>
    {#each current?.groups ?? [] as group (group.id)}
      {#if collapsedGroups.has(group.id)}
        <section class="group folded" aria-label={group.label}>
          <SvPopover bind:open={groupOpen[group.id]} placement="bottom-start" arrow={false} offset={4} ariaLabel={group.label}>
            {#snippet anchor()}
              <button type="button" class="btn large" aria-haspopup="true" aria-expanded={groupOpen[group.id] ?? false} title={group.label}>
                <span class="fold-icon"><SvRibbonIcon name={groupIcon(group)} size={32} /></span>
                <span class="label">{group.label} <SvRibbonIcon name="chevron-down" size={10} /></span>
              </button>
            {/snippet}
            <div class="popup-group">
              {@render body(group, true)}
              <div class="label-row"><span class="group-label">{group.label}</span></div>
            </div>
          </SvPopover>
        </section>
      {:else}
        <section class="group" class:compact={fit.compact.has(group.id)} aria-label={group.label}>
          {@render body(group, true)}
          <div class="label-row">
            <span class="group-label">{group.label}</span>
            {#if group.launcher}
              <button type="button" class="launcher" title={`${group.label} settings`} aria-label={`${group.label} settings`} onclick={() => launch(group.launcher!)}>
                <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path d="M1 1h3.5M1 1v3.5M1.5 1.5L6.5 6.5M6.5 3.5V6.5H3.5" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            {/if}
          </div>
        </section>
      {/if}
    {/each}
    <!-- Excel's chevron at the band's end: collapse, or pin the peeked band. -->
    <span class="band-grow"></span>
    <button type="button" class="ribbon-toggle in-band" title={collapsed ? 'Pin the Ribbon (Ctrl+F1)' : 'Collapse the Ribbon (Ctrl+F1)'} aria-label={collapsed ? 'Pin the Ribbon' : 'Collapse the Ribbon'} onclick={toggleCollapsed}>
      {#if collapsed}
        <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M4 1.5h4M6 1.5v3.5M3.5 5l2.5 2.5L8.5 5M6 7.5V11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {:else}
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 6.5l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {/if}
    </button>
  </div>

  <!--
    The measuring bands: every group of the current tab expanded, then
    every group compact, invisible and out of the tab order, so the fit
    above has both widths for each group even when it never got to draw
    itself either way.
  -->
  <div class="measure-well" aria-hidden="true" inert>
  <div class="band measure">
    {#each current?.groups ?? [] as group (group.id)}
      <section class="group" use:measure={group.id}>
        {@render body(group, false)}
        <div class="label-row"><span class="group-label">{group.label}</span></div>
      </section>
    {/each}
  </div>
  <div class="band measure">
    {#each current?.groups ?? [] as group (group.id)}
      <section class="group compact" use:measure={`${group.id}:compact`}>
        {@render body(group, false)}
        <div class="label-row"><span class="group-label">{group.label}</span></div>
      </section>
    {/each}
  </div>
  <div class="band measure">
    {#each current?.groups ?? [] as group (group.id)}
      <section class="group folded" use:measure={`${group.id}:folded`}>
        <button type="button" class="btn large" tabindex="-1">
          <span class="fold-icon"><SvRibbonIcon name={groupIcon(group)} size={32} /></span>
          <span class="label">{group.label} <SvRibbonIcon name="chevron-down" size={10} /></span>
        </button>
      </section>
    {/each}
  </div>
  </div>
</div>

<style>
  .sv-ribbon {
    position: relative;
    display: flex;
    flex-direction: column;
    font-family: var(--sg-font, "Segoe UI", system-ui, sans-serif);
    font-size: 12px;
    line-height: 1.2;
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f3f3f3));
    color: var(--sg-fg, #242424);
    border: 1px solid var(--sg-border, #e0e0e0);
    border-radius: var(--sg-radius, 4px);
  }
  /* Collapsed, the peeked band hangs below the tabs over the sheet: the
     ribbon has to sit above the formula bar and the grid's sticky header
     (z-index 30) for it to show. */
  .sv-ribbon.collapsed { z-index: 70; }

  /* ---- tabs ---------------------------------------------------------- */
  .tabs {
    display: flex;
    align-items: stretch;
    gap: 0;
    height: 30px;
    padding: 0 8px;
  }
  .tab {
    position: relative;
    font: inherit;
    border: 0;
    background: transparent;
    color: var(--sg-fg, #242424);
    padding: 0 11px;
    cursor: pointer;
    white-space: nowrap;
    border-radius: 4px 4px 0 0;
  }
  .tab:hover { background: var(--sg-row-hover-bg, rgba(0, 0, 0, 0.04)); }
  .tab.active { color: var(--sg-accent, #107c41); font-weight: 600; }
  /* Excel's selected-tab mark: a short rounded underline, not a full-width
     border, inset from the label's edges. */
  .tab.active::after {
    content: "";
    position: absolute;
    left: 9px;
    right: 9px;
    bottom: 0;
    height: 3px;
    border-radius: 3px 3px 0 0;
    background: var(--sg-accent, #107c41);
  }
  .tab:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -2px;
  }

  /* ---- band ---------------------------------------------------------- */
  /* Excel's band is a white card on the ribbon's grey ground, inset a few
     pixels and rounded, with the groups divided by hairlines inside it. */
  .band {
    display: flex;
    align-items: stretch;
    margin: 0 6px 6px;
    padding: 4px 4px 2px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e0e0e0);
    border-radius: var(--sg-radius-lg, 6px);
    /* Seven folded groups are 472px; on a phone the band is narrower than
       that, and a hidden overflow put Cells and Editing out of reach. The
       band scrolls sideways instead, as Excel's does, without a scrollbar
       stealing a row. */
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .band::-webkit-scrollbar {
    display: none;
  }
  /* The measuring bands live in a well of no size that clips them, so
     their max-content widths never reach the page's scroll width. */
  .measure-well {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }
  .band.measure {
    position: absolute;
    left: 0;
    top: 0;
    width: max-content;
    height: 0;
    margin: 0;
    padding-block: 0;
    border: 0;
  }

  .group {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    /* Three rows of controls and the label row: the band keeps this
       height when every group has folded to a button. */
    min-height: 92px;
    padding: 0 4px;
    border-right: 1px solid var(--sg-border, #e0e0e0);
  }
  .group:last-of-type { border-right: 0; }
  /* Folded: one button the height of the group, its icon centred where the
     controls sit and its label down on the group-label row, so the row of
     labels reads straight across folded and open groups alike. */
  .group.folded { padding: 0 2px; }
  /* The popover's anchor wrapper sits between the group and its button;
     it has to stretch for the button's 100% height to mean the group's. */
  .group.folded :global(.sv-pop__anchor) { flex: 1 1 auto; display: flex; align-items: stretch; }
  .group.folded :global(.btn.large) { height: 100%; padding-top: 0; padding-bottom: 0; gap: 0; }
  .group.folded :global(.btn.large .fold-icon) { flex: 1 1 auto; display: flex; align-items: center; }
  .group.folded :global(.btn.large .label) { height: 16px; padding-bottom: 1px; color: var(--sg-muted, #616161); }
  .group.folded :global(.btn.large:hover .label) { color: inherit; }
  /* Compact: the small buttons keep their icon and drop their label. */
  .group.compact :global(.btn.wide:not(.large) .label) { display: none; }
  .group.compact :global(.btn.wide:not(.large)) { justify-content: center; padding-right: 3px; }
  .group.compact :global(.split .btn.face .label) { display: none; }

  /* Collapsed: the tabs alone; peeked: the band floats over the sheet. */
  /* Not "hidden": a host reset owns that name too. */
  .band.away { display: none; }
  .band.peek {
    position: absolute;
    left: 0;
    right: 0;
    top: 30px;
    z-index: 60;
    margin: 0;
    border-radius: 0 0 var(--sg-radius-lg, 6px) var(--sg-radius-lg, 6px);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  }
  .tabs-grow, .band-grow { flex: 1 1 auto; }
  /* Not "collapse": that is a visibility utility in a host's reset. */
  .ribbon-toggle {
    align-self: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: var(--sg-muted, #616161);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ribbon-toggle.in-band { align-self: flex-end; margin: 0 2px 2px 2px; }
  .ribbon-toggle:hover { background: var(--sg-row-hover-bg, #f0f0f0); border-color: var(--sg-border, #e0e0e0); color: var(--sg-fg, #242424); }

  /* Three rows of 24px: what a large button fills and a small one takes one of. */
  .controls {
    flex: 1 0 auto;
    min-height: 76px;
  }
  .controls.grid {
    display: grid;
    grid-template-rows: repeat(3, 24px);
    grid-auto-columns: max-content;
    grid-auto-flow: row;
    align-content: start;
    gap: 2px 3px;
  }
  .cell { display: flex; align-items: stretch; }
  .cell > :global(*) { flex: 1 1 auto; }
  .controls.flow {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    gap: 2px;
  }
  .controls.flow .row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .label-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 16px;
    margin-top: 2px;
  }
  .group-label {
    font-size: 10.5px;
    color: var(--sg-muted, #616161);
    white-space: nowrap;
    padding: 0 8px;
  }
  /* The dialog box launcher, in the corner where Excel keeps it. */
  .launcher {
    position: absolute;
    right: -4px;
    bottom: 1px;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: var(--sg-muted, #616161);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .launcher:hover { background: var(--sg-row-hover-bg, #f0f0f0); border-color: var(--sg-border, #e0e0e0); color: var(--sg-fg, #242424); }

  /* ---- buttons ------------------------------------------------------- */
  .btn {
    font: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 22px;
    height: 24px;
    padding: 0 2px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    white-space: nowrap;
    position: relative;
  }
  .btn.wide { justify-content: flex-start; padding-right: 6px; }
  .btn:hover:not(:disabled) {
    background: var(--sg-row-hover-bg, #f0f0f0);
    border-color: var(--sg-border, #d1d1d1);
  }
  .btn:active:not(:disabled) { background: var(--sg-muted-bg, #e6e6e6); }
  /* A pressed toggle: Excel tints it, it does not invert it. */
  .btn.on,
  .split.on .btn {
    background: var(--sg-selection-bg, rgba(16, 124, 65, 0.12));
    border-color: var(--sg-border, #d1d1d1);
  }
  .btn:disabled { opacity: 0.38; cursor: default; }
  .btn:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -2px;
  }
  .btn.large {
    flex-direction: column;
    justify-content: flex-start;
    gap: 3px;
    height: 100%;
    min-width: 40px;
    padding: 5px 3px 2px;
  }
  .btn.large .label {
    white-space: normal;
    text-align: center;
    line-height: 1.15;
    max-width: 68px;
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 2px;
  }

  /* Typographic faces: B I U S read as their own styling, as Excel's do. */
  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    font-size: 13px;
    line-height: 1;
  }
  .glyph[data-glyph='bold'] { font-weight: 800; }
  .glyph[data-glyph='italic'] { font-style: italic; font-family: Georgia, "Times New Roman", serif; }
  .glyph[data-glyph='underline'] { text-decoration: underline; }
  .glyph[data-glyph='strike'] { text-decoration: line-through; }
  .glyph[data-glyph='text-colour'] { font-weight: 700; font-size: 14px; transform: translateY(-2px); }
  .glyph[data-glyph='fmt-currency'],
  .glyph[data-glyph='fmt-percent'],
  .glyph[data-glyph='fmt-number'] { font-weight: 600; }

  /* ---- split buttons ------------------------------------------------- */
  .split {
    display: inline-flex;
    align-items: stretch;
    height: 24px;
    border-radius: 4px;
  }
  .split .face { border-radius: 4px 0 0 4px; padding: 0 3px; }
  .split .arrow {
    border-radius: 0 4px 4px 0;
    min-width: 12px;
    width: 12px;
    padding: 0;
    color: var(--sg-muted, #616161);
  }
  .split:hover:not(.disabled) .btn { border-color: var(--sg-border, #d1d1d1); }
  .split:hover:not(.disabled) .face { border-right-color: transparent; }
  .split .face.has-bar { padding-bottom: 4px; }
  /* Excel's colour bar under the icon: the colour the face will apply. */
  .bar {
    position: absolute;
    left: 3px;
    right: 3px;
    bottom: 2px;
    height: 3px;
    border-radius: 1px;
  }
  .bar.none {
    background: repeating-linear-gradient(90deg, var(--sg-muted, #8a8886) 0 3px, transparent 3px 5px) !important;
  }

  /* ---- selects ------------------------------------------------------- */
  .select {
    font: inherit;
    height: 22px;
    padding: 0 2px 0 5px;
    border: 1px solid var(--sg-input-border, var(--sg-border, #d1d1d1));
    border-radius: 3px;
    /* Not transparent: a native select paints its option list with this
       background, and a see-through one is unreadable on a dark theme. */
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-fg, #242424);
  }
  .select[data-select='font-family'] { width: 112px; }
  .select[data-select='font-size'] { width: 46px; }
  .select[data-select='num-format'] { width: 108px; }
  .select:disabled { opacity: 0.38; }
  .select:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -1px;
  }

  /* ---- menus --------------------------------------------------------- */
  .menu {
    min-width: 200px;
    padding: 4px;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 5px 10px;
    font: inherit;
    font-size: 12px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }
  .menu-item:hover { background: var(--sg-row-hover-bg, #f0f0f0); }
  /* A toggle entry that is on (Lock Cell on a locked cell): the same tint
     as a pressed button, so the menu and the ribbon agree. */
  .menu-item.on { background: var(--sg-selection-bg, rgba(16, 124, 65, 0.12)); }
  .menu-item.on:hover { background: var(--sg-muted-bg, #e6e6e6); }
  .menu-item .keys {
    margin-left: auto;
    padding-left: 18px;
    color: var(--sg-muted, #616161);
    font-size: 11px;
  }
  /* Excel's section labels between a menu's groups: small caps, a rule above. */
  .menu-heading {
    margin: 4px 0 2px;
    padding: 6px 10px 2px;
    border-top: 1px solid var(--sg-border, #e1e1e1);
    color: var(--sg-muted, #616161);
    font-size: 11px;
    font-weight: 600;
  }
  .menu-heading:first-child { border-top: 0; margin-top: 0; padding-top: 2px; }
  /* The chevron sits close to the label, as Excel's does, so the face is a
     few pixels wider than the plain button and the band still fits 1050px
     with every group open. */
  .btn.dropdown { padding-right: 3px; }
  /* The large split: icon on top pastes, "Paste v" under it opens the menu. */
  .split.split-large {
    flex-direction: column;
    align-items: stretch;
    height: 100%;
    min-width: 46px;
  }
  .split.split-large .face {
    flex: 1 1 auto;
    border-radius: 4px 4px 0 0;
    justify-content: flex-start;
    padding: 5px 4px 0;
  }
  .split.split-large .arrow {
    width: auto;
    min-width: 0;
    height: auto;
    padding: 0 2px 3px;
    gap: 2px;
    border-radius: 0 0 4px 4px;
    color: inherit;
    font-size: 12px;
    line-height: 1.15;
  }
  .btn.dropdown .label { margin-right: -3px; }

  .palette {
    width: 232px;
    padding: 8px;
    font-size: 12px;
  }
  .palette-none {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 6px;
    margin-bottom: 4px;
    font: inherit;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .palette-none:hover { background: var(--sg-row-hover-bg, #f0f0f0); }
  .palette-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--sg-muted, #616161);
    margin: 6px 0 4px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(10, 18px);
    gap: 0 4px;
  }
  /* The five shades under each theme colour stack touching, one column per
     colour; the base row stands a little apart above them, as in Excel. */
  .swatches .swatch:nth-child(-n + 10) { margin-bottom: 4px; }
  .swatches .swatch.shade { border-radius: 0; border-top-width: 0; }
  .swatches .swatch.shade:nth-child(n + 11):nth-child(-n + 20) { border-top-width: 1px; }
  .swatch {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 2px;
    cursor: pointer;
  }
  .swatch:hover { outline: 2px solid var(--sg-accent, #107c41); outline-offset: 1px; position: relative; z-index: 1; }
  .swatch.no-colour {
    cursor: default;
    background:
      linear-gradient(to top right,
        transparent calc(50% - 1px), var(--sg-danger, #dc2626) 50%,
        transparent calc(50% + 1px)),
      var(--sg-bg, #fff);
  }

  .popup-group {
    display: flex;
    flex-direction: column;
    padding: 6px 8px 2px;
  }
</style>
