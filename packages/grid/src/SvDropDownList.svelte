<script lang="ts">
  /**
   * SvDropDownList - a single-select dropdown (trigger button + portalled list,
   * no typing). Parity: Smart `smart-drop-down-list`. Controlled via `value` +
   * `onChange`. Popover escapes scroll clipping via popover.ts.
   *
   * One styled renderer over the headless `createDropdownList` core (state +
   * keyboard + ARIA); only portal/measure/scroll render concerns live here.
   */
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
  import { startPanelResize } from './panel-resize'
  import { createDismissableLayer } from './a11y/dismissable'
  import { groupOptions, normalizeOptions, flattenForVirtual, type ListOption, type IndexedOption, type RowHeight } from './list-option'
  import { createSvelteVirtualizer } from './virtualization/svelte-virtualizer.svelte'
  import { createJsScroller } from './js-scroller.svelte'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createDropdownList } from './createDropdownList.svelte'
  import { untrack, type Snippet } from 'svelte'

  type Props = SvEditorProps & {
    options: ReadonlyArray<ListOption>
    value?: string | number | null
    onChange?: (value: string | number) => void
    placeholder?: string
    autoOpen?: boolean
    /** Window the option list (render only visible) for large sets. */
    virtual?: boolean
    /** Option height in px - a number, or a per-option function for variable
     *  heights. Must match the rendered row height. Default 34. */
    rowHeight?: RowHeight
    /** Height (px) of a group heading row when virtualized + grouped. Default 28. */
    groupHeaderHeight?: number
    /** Max options shown before the panel scrolls (native-select behaviour). Default 8. */
    maxRows?: number
    /** Show a bottom drag grip so the user can resize the open panel's height
     *  (only while it opens downward). Off by default. */
    resizable?: boolean
    /** Custom render for each option (receives the ListOption). */
    item?: Snippet<[ListOption]>
    /** Content pinned above the option list. */
    header?: Snippet
    /** Content pinned below the option list. */
    footer?: Snippet
    /** Shown when there are no options. */
    noData?: Snippet
  }

  let {
    options,
    value = null,
    onChange,
    placeholder = 'Select…',
    disabled = false,
    readonly = false,
    name,
    size = 'md',
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    autoOpen = false,
    virtual = false,
    rowHeight = 34,
    groupHeaderHeight = 28,
    maxRows = 8,
    resizable = false,
    item,
    header,
    footer,
    noData,
  }: Props = $props()

  const autoId = nextEditorId('sv-ddl')
  const uid = $derived(id ?? autoId)

  // Tolerate primitive / partial options - normalize so labels render + keys are stable.
  const norm = $derived(normalizeOptions(options))

  // Virtualization windows the option list (grouped lists too, via the shared
  // virtualizer + a flattened header/option model with per-row sizes).
  const useVirtual = $derived(virtual)
  let viewportH = $state(0)
  const rowHeightBase = $derived(typeof rowHeight === 'number' ? rowHeight : 34)
  const flat = $derived(flattenForVirtual(norm, { rowHeight, groupHeaderHeight }))
  const uniform = $derived(!flat.hasGroups && typeof rowHeight === 'number')
  const estimateSize = $derived(uniform ? rowHeightBase : (i: number) => flat.sizeAt(i))

  // Generous overscan buffers fast flings; effective viewport never 0 (see SvListBox).
  const OVERSCAN = 20
  const effViewport = $derived(viewportH > 0 ? viewportH : Math.max(1, maxRows * rowHeightBase))

  // Seed with the initial (untracked) values so the first paint of the open panel
  // renders a full window; the effects below keep it synced.
  const virtualizer = createSvelteVirtualizer(
    untrack(() => ({ count: flat.entries.length, estimateSize, overscan: OVERSCAN, viewportHeight: effViewport })),
  )
  // untrack keeps the virtualizer's internal `version` write out of these
  // effects' dependencies, so they re-run only on their real inputs.
  $effect(() => {
    const count = flat.entries.length
    const es = estimateSize
    untrack(() => virtualizer.setOptions({ count, estimateSize: es }))
  })
  $effect(() => {
    const vh = effViewport
    untrack(() => virtualizer.setViewportHeight(vh))
  })
  const vItems = $derived.by(() => {
    virtualizer.version
    return virtualizer.getVirtualItems()
  })
  const totalSize = $derived.by(() => {
    virtualizer.version
    return virtualizer.getTotalSize()
  })
  // JS-driven scroll (see SvListBox / js-scroller): no native scroll, so a fast
  // thumb-drag never flashes the empty panel.
  const scroller = createJsScroller({
    virtualizer,
    totalSize: () => totalSize,
    viewport: () => effViewport,
    lineStep: () => rowHeightBase,
  })

  let triggerEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })
  // User-chosen panel height (px) once they drag the resize grip; null = auto.
  let userHeight = $state<number | null>(null)
  // Effective height cap: the user's drag if any (clamped to the viewport
  // ceiling), otherwise the comfortable bounds-aware height.
  const panelMaxH = $derived(
    resizable && userHeight != null ? Math.min(userHeight, rect.availHeight) : rect.maxHeight,
  )
  const showGrip = $derived(resizable && !rect.openUpward)

  // The virtual panel uses NO native scroll, so its rows are absolutely
  // positioned and can't size the panel. Give it an explicit height (content up
  // to `maxRows`, capped by the resized / bounds-aware ceiling) so the flex
  // viewport (`.sv-ddl__vp`) has a definite height to fill.
  const virtualPanelH = $derived(
    Math.min(
      Math.min(totalSize, Math.max(rowHeightBase, maxRows * rowHeightBase)) + 8,
      rect.maxHeight || Number.POSITIVE_INFINITY,
      resizable && userHeight != null ? panelMaxH : Number.POSITIVE_INFINITY,
    ),
  )

  const ddl = createDropdownList({
    options: () => norm,
    value: () => value,
    onChange: (v) => onChange?.(v),
    disabled: () => disabled,
    readonly: () => readonly,
    ariaLabel: () => ariaLabel,
    focusTrigger: () => triggerEl?.focus(),
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })

  const selected = $derived(ddl.selected)

  function updatePos() {
    if (!triggerEl) return
    // When the user has resized, anchor to THAT height so the flip decision and
    // upward top stay correct; otherwise size to the content up to `maxRows` items
    // (native-select behaviour: no scrollbar until the list exceeds the cap). The
    // +PANEL_CHROME budgets the panel's own padding (8) + border (2) so a list
    // that exactly fills `maxRows` is not clipped by the border-box max-height.
    const PANEL_CHROME = 10
    const estimatedHeight =
      resizable && userHeight != null ? userHeight : Math.min(norm.length, maxRows) * rowHeightBase + PANEL_CHROME
    rect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight })
  }

  function startResize(e: PointerEvent) {
    if (!panelEl) return
    startPanelResize(e, {
      startHeight: panelEl.clientHeight,
      min: 96,
      max: () => rect.availHeight,
      onHeight: (h) => {
        userHeight = h
        updatePos()
      },
    })
  }

  $effect(() => {
    if (!ddl.open) return
    updatePos()
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    // Outside-pointer dismissal via the shared layer stack (Escape stays with
    // the core keyboard handler). Because this layer is pushed ON TOP, a
    // dropdown opened inside a dialog/drawer closes itself first and never
    // dismisses the dialog underneath it.
    const layer = createDismissableLayer({
      element: () => [triggerEl, panelEl],
      onDismiss: () => ddl.close(),
      closeOnEscape: false,
    })
    layer.activate()
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); layer.release() }
  })
  // Keep the active option scrolled into view (render concern) - via the scroller
  // (virtual) or scrollIntoView (native non-virtual).
  $effect(() => {
    if (!ddl.open) return
    const i = ddl.activeIndex
    if (useVirtual) {
      const flatIdx = flat.optionFlatIndex[i]
      if (flatIdx == null) return
      untrack(() => scroller.ensureIndexVisible(flatIdx))
    } else {
      queueMicrotask(() => panelEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' }))
    }
  })
  function focusOpen(node: HTMLButtonElement) { if (autoOpen) { node.focus(); ddl.openPanel() } }
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <button
    bind:this={triggerEl}
    class="sv-ddl sv-ddl--{size}"
    class:is-open={ddl.open}
    class:is-disabled={disabled}
    class:is-invalid={invalid}
    {...ddl.triggerProps()}
    use:focusOpen
  >
    <span class="sv-ddl__value" class:is-placeholder={!selected}>{#if selected?.color}<span class="sv-ddl__swatch" style:background={selected.color}></span>{/if}{selected?.label ?? placeholder}</span>
    <svg class="sv-ddl__chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
  </button>
</SvField>

{#snippet optRow(opt: IndexedOption, h?: number, top?: number)}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="sv-ddl__opt" style:height={h != null ? `${h}px` : undefined} style:transform={top == null ? undefined : `translateY(${top}px)`} class:is-active={ddl.isActive(opt.index)} class:is-selected={ddl.isSelected(opt)} class:is-disabled={opt.disabled} {...ddl.optionProps(opt.index)}>
    {#if item}{@render item(opt)}{:else}{#if opt.color}<span class="sv-ddl__swatch" style:background={opt.color}></span>{/if}{opt.label}{/if}
  </div>
{/snippet}

{#if ddl.open}
  <div bind:this={panelEl} class="sv-ddl__panel" class:is-virtual={useVirtual} class:is-resizable={showGrip} use:portalToBody use:popIn={{ up: rect.openUpward }} style:--sv-row-h={`${rowHeightBase}px`} style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} style:max-height={`${panelMaxH}px`} style:height={useVirtual ? `${virtualPanelH}px` : resizable && userHeight != null ? `${panelMaxH}px` : undefined} onwheel={useVirtual ? scroller.onWheel : undefined} {...ddl.listboxProps()}>
    {#if header}<div class="sv-ddl__header">{@render header()}</div>{/if}
    {#if !norm.length}
      {#if noData}{@render noData()}{:else}<div class="sv-ddl__empty">No options</div>{/if}
    {:else if useVirtual}
      <!-- JS-driven scroller: one clipped viewport holds the windowed rows (moved
           by scrollOffset) + a custom scrollbar. No native scroll = no async gap
           = no blank flash on a fast thumb-drag. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-ddl__vp" bind:clientHeight={viewportH} onpointerdown={scroller.onContentDown} onpointermove={scroller.onContentMove} onpointerup={scroller.onContentUp} onpointercancel={scroller.onContentUp}>
        {#each vItems as vi (vi.key)}
          {@const entry = flat.entries[vi.index]}
          {#if entry?.type === 'group'}
            <div class="sv-ddl__group-label sv-ddl__group-label--abs" aria-hidden="true" style:height={`${vi.size}px`} style:transform={`translateY(${vi.start - scroller.scrollOffset}px)`}>{entry.label}</div>
          {:else if entry}
            {@render optRow(entry.opt, vi.size, vi.start - scroller.scrollOffset)}
          {/if}
        {/each}
        {#if scroller.maxOffset > 0}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="sv-ddl__sb" onpointerdown={scroller.onTrackDown} aria-hidden="true">
            <div class="sv-ddl__thumb" class:is-dragging={scroller.dragging} style:height={`${scroller.thumbH}px`} style:transform={`translateY(${scroller.thumbTop}px)`} onpointerdown={scroller.onThumbDown} onpointermove={scroller.onThumbMove} onpointerup={scroller.onThumbUp} onpointercancel={scroller.onThumbUp}></div>
          </div>
        {/if}
      </div>
    {:else}
    {#each groupOptions(norm) as g (g.group ?? '')}
      {#if g.group != null}
        <div class="sv-ddl__group" role="group" aria-label={g.group}>
          <div class="sv-ddl__group-label" aria-hidden="true">{g.group}</div>
          {#each g.options as opt (opt.index)}
            {@render optRow(opt)}
          {/each}
        </div>
      {:else}
        {#each g.options as opt (opt.index)}
          {@render optRow(opt)}
        {/each}
      {/if}
    {/each}
    {/if}
    {#if footer}<div class="sv-ddl__footer">{@render footer()}</div>{/if}
    {#if showGrip}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-ddl__grip" onpointerdown={startResize} title="Drag to resize" aria-hidden="true">
        <span class="sv-ddl__grip-dots"></span>
      </div>
    {/if}
  </div>
{/if}
{#if name}<input type="hidden" {name} value={value ?? ''} />{/if}

<style>
  .sv-ddl {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; width: 200px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; text-align: start;
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    padding: 0 10px; cursor: pointer;
  }
  .sv-ddl--sm { height: 28px; font-size: 12px; }
  .sv-ddl--md { height: 34px; font-size: 13px; }
  .sv-ddl--lg { height: 40px; font-size: 15px; }
  .sv-ddl.is-open, .sv-ddl:focus-visible { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); outline: none; }
  .sv-ddl.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-ddl.is-invalid.is-open, .sv-ddl.is-invalid:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-ddl.is-disabled { opacity: 0.6; cursor: not-allowed; }
  .sv-ddl__value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-ddl__value.is-placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-ddl__chev { color: var(--sg-muted, #64748b); flex: none; }

  :global(.sv-ddl__panel) {
    box-sizing: border-box; z-index: 2147483647; max-height: 288px; overflow-y: auto; padding: 4px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; box-shadow: 0 16px 48px -12px rgba(15,23,42,0.35);
  }
  /* Virtual panel: a flex column (header / JS-driven viewport / footer / grip)
     with NO native scroll - the viewport moves its rows by `scrollOffset`. */
  :global(.sv-ddl__panel.is-virtual) { display: flex; flex-direction: column; overflow: hidden; }
  :global(.sv-ddl__vp) { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; touch-action: none; }
  :global(.sv-ddl__panel.is-virtual .sv-ddl__opt), :global(.sv-ddl__group-label--abs) { position: absolute; left: 0; right: 0; top: 0; }
  :global(.sv-ddl__sb) { position: absolute; top: 0; right: 1px; bottom: 0; width: 10px; z-index: 2; }
  :global(.sv-ddl__thumb) {
    position: absolute; left: 2px; right: 2px; top: 0; min-height: 24px; border-radius: 4px;
    background: color-mix(in srgb, currentColor 26%, transparent); cursor: default; touch-action: none;
  }
  :global(.sv-ddl__thumb:hover), :global(.sv-ddl__thumb.is-dragging) { background: color-mix(in srgb, currentColor 42%, transparent); }
  :global(.sv-ddl__opt) { box-sizing: border-box; flex: none; display: flex; align-items: center; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  /* Color swatch shown before an option's label (option.color) - in both the
     trigger value and the portalled panel options. */
  :global(.sv-ddl__swatch) {
    display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 3px;
    margin-inline-end: 8px; vertical-align: middle;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, #000 18%, transparent);
  }
  /* Bottom resize grip: a row of dots ("····") the user drags to resize the
     panel. Sticky so it stays pinned at the panel's bottom while options scroll. */
  :global(.sv-ddl__panel.is-resizable) { padding-bottom: 0; }
  :global(.sv-ddl__grip) {
    position: sticky; bottom: 0; z-index: 1; margin: 2px -4px -4px; height: 15px;
    display: flex; align-items: center; justify-content: center; cursor: ns-resize;
    background: var(--sg-bg, #fff); border-top: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 0 0 10px 10px; touch-action: none;
  }
  :global(.sv-ddl__grip-dots) {
    width: 26px; height: 4px; color: var(--sg-muted, #94a3b8); opacity: 0.6;
    background-image: radial-gradient(currentColor 1px, transparent 1.6px);
    background-size: 6px 4px; background-position: center; background-repeat: repeat-x;
  }
  :global(.sv-ddl__grip:hover .sv-ddl__grip-dots) { opacity: 1; }
  :global(.sv-ddl__opt.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-ddl__opt.is-selected) { color: var(--sg-accent, #2563eb); font-weight: 600; }
  :global(.sv-ddl__opt.is-disabled) { opacity: 0.4; cursor: not-allowed; }
  :global(.sv-ddl__group-label) {
    box-sizing: border-box; padding: 8px 10px 3px; font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8);
    display: flex; align-items: flex-end;
  }
  :global(.sv-ddl__empty) { padding: 12px 12px; font-size: 13px; color: var(--sg-muted, #64748b); text-align: center; }
  :global(.sv-ddl__header) { padding: 8px 10px; border-bottom: 1px solid var(--sg-border, #e2e8f0); font-size: 12.5px; color: var(--sg-muted, #64748b); }
  :global(.sv-ddl__footer) { padding: 8px 10px; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 12.5px; }
</style>
