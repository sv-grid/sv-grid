<script lang="ts">
  /**
   * SvListBox - an inline single/multi-select list (WAI-ARIA listbox) with
   * roving highlight + full keyboard. Parity: Smart `smart-list-box`. Controlled
   * via `value` (scalar or array) + `onChange`. Scales to huge option sets with
   * `virtual` - windowing over the shared `createSvelteVirtualizer` (slot-keyed
   * DOM recycling), which also windows GROUPED lists and mixes row heights.
   *
   * Virtual mode uses a JS-DRIVEN scroller (like Smart): the option list does
   * NOT use native overflow scroll - a single `scrollOffset` state positions the
   * rows (`translateY`) AND drives the virtualizer window in the same reactive
   * flush. Native scroll is composited off the main thread, so it paints the
   * empty scrolled position a frame before JS can re-window (the "blank on a
   * fast thumb-drag" flash); driving the offset in JS removes that async gap.
   */
  import { untrack, type Snippet } from 'svelte'
  import { groupOptions, normalizeOptions, flattenForVirtual, type ListOption, type IndexedOption, type RowHeight } from './list-option'
  import { createSvelteVirtualizer } from './virtualization/svelte-virtualizer.svelte'
  import { createJsScroller } from './js-scroller.svelte'
  import { createListbox } from './createListbox.svelte'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'

  type Props = SvEditorProps & {
    options: ReadonlyArray<ListOption>
    value?: string | number | Array<string | number> | null
    onChange?: (value: any) => void
    multiple?: boolean
    /** Visible height in rows before scrolling. */
    rows?: number
    /** Window the list (render only visible rows) for large option sets. */
    virtual?: boolean
    /** Row height in px - a number, or a per-option function for variable
     *  heights. Must match the rendered row height. Default 32. */
    rowHeight?: RowHeight
    /** Height (px) of a group heading row when virtualized + grouped. Default 28. */
    groupHeaderHeight?: number
    /** Custom per-option content. Receives the option. */
    item?: Snippet<[ListOption]>
    /** @deprecated Use `item`. */
    itemTemplate?: Snippet<[ListOption]>
  }

  let {
    options,
    value = null,
    onChange,
    multiple = false,
    disabled = false,
    size = 'md',
    rows = 7,
    virtual = false,
    rowHeight = 32,
    groupHeaderHeight = 28,
    item,
    itemTemplate,
    ariaLabel,
    name,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
  }: Props = $props()

  // Stable id anchors the label/hint/error wiring even when no `id` is passed.
  const autoId = nextEditorId('sv-lb')
  const uid = $derived(id ?? autoId)

  // Tolerate primitive / partial options (e.g. setOptions([1, 2, 3])): normalize
  // to { value, label } so labels render and keys are never undefined.
  const norm = $derived(normalizeOptions(options))

  // The styled listbox is just a renderer over the headless core.
  const lb = createListbox({
    options: () => norm,
    value: () => value,
    onChange: (v) => onChange?.(v),
    multiple: () => multiple,
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })
  const isSel = (o: ListOption) => lb.isSelected(o.value)

  const rowHeightBase = $derived(typeof rowHeight === 'number' ? rowHeight : 32)
  const optHeight = (o: IndexedOption) => (typeof rowHeight === 'function' ? rowHeight(o, o.index) : rowHeight)

  // --- Virtualization ---------------------------------------------------------
  const useVirtual = $derived(virtual)
  let listEl = $state<HTMLDivElement | null>(null)
  let viewportH = $state(0)

  const flat = $derived(flattenForVirtual(norm, { rowHeight, groupHeaderHeight }))
  const uniform = $derived(!flat.hasGroups && typeof rowHeight === 'number')
  const estimateSize = $derived(uniform ? rowHeightBase : (i: number) => flat.sizeAt(i))

  const OVERSCAN = 6
  // Effective viewport height: measured, or the computed `rows` height until the
  // viewport element is measured. Never 0.
  const effViewport = $derived(viewportH > 0 ? viewportH : Math.max(1, rows * rowHeightBase))

  const virtualizer = createSvelteVirtualizer(
    untrack(() => ({ count: flat.entries.length, estimateSize, overscan: OVERSCAN, viewportHeight: effViewport })),
  )

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

  // JS-driven scroll: one offset positions the rows AND drives the virtualizer
  // window in the same flush - no native scroll, so no async "blank flash".
  const scroller = createJsScroller({
    virtualizer,
    totalSize: () => totalSize,
    viewport: () => effViewport,
    lineStep: () => rowHeightBase,
  })

  // Keep the active option in view - via the scroller (virtual) or scrollIntoView
  // (native non-virtual). Driven by roving keyboard nav.
  $effect(() => {
    const i = lb.activeIndex
    if (useVirtual) {
      const flatIdx = flat.optionFlatIndex[i]
      if (flatIdx == null) return
      untrack(() => scroller.ensureIndexVisible(flatIdx))
    } else {
      queueMicrotask(() => listEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' }))
    }
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <!-- Div-based listbox (role comes from `lb.rootProps()`). -->
  <div
    bind:this={listEl}
    class="sv-listbox sv-listbox--{size}"
    class:is-invalid={invalid}
    class:is-virtual={useVirtual}
    style:--sv-rows={rows}
    style:--sv-row-h={`${rowHeightBase}px`}
    onwheel={useVirtual ? scroller.onWheel : undefined}
    {...lb.rootProps()}
  >
    {#if useVirtual}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sv-listbox__vp"
        bind:clientHeight={viewportH}
        onpointerdown={scroller.onContentDown}
        onpointermove={scroller.onContentMove}
        onpointerup={scroller.onContentUp}
        onpointercancel={scroller.onContentUp}
      >
        {#each vItems as vi (vi.key)}
          {@const entry = flat.entries[vi.index]}
          {#if entry?.type === 'group'}
            <div class="sv-listbox__group" role="presentation" style:height={`${vi.size}px`} style:transform={`translateY(${vi.start - scroller.scrollOffset}px)`}>{entry.label}</div>
          {:else if entry}
            {@render optionRow(entry.opt, entry.opt.index, vi.size, vi.start - scroller.scrollOffset)}
          {/if}
        {/each}
      </div>
      {#if scroller.maxOffset > 0}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sv-listbox__sb" onpointerdown={scroller.onTrackDown} aria-hidden="true">
          <div
            class="sv-listbox__thumb"
            class:is-dragging={scroller.dragging}
            style:height={`${scroller.thumbH}px`}
            style:transform={`translateY(${scroller.thumbTop}px)`}
            onpointerdown={scroller.onThumbDown}
            onpointermove={scroller.onThumbMove}
            onpointerup={scroller.onThumbUp}
            onpointercancel={scroller.onThumbUp}
          ></div>
        </div>
      {/if}
    {:else}
      {#each groupOptions(norm) as g (g.group ?? ' ')}
        {#if g.group != null}<div class="sv-listbox__group" role="presentation">{g.group}</div>{/if}
        {#each g.options as opt (opt.index)}
          {@render optionRow(opt, opt.index)}
        {/each}
      {/each}
    {/if}
  </div>
  {#if name}{#each lb.selectedValues as v (v)}<input type="hidden" {name} value={v} />{/each}{/if}
</SvField>

{#snippet optionInner(opt: ListOption)}
  {#if multiple}<span class="sv-listbox__check" aria-hidden="true">{isSel(opt) ? '✓' : ''}</span>{/if}
  {#if item ?? itemTemplate}{@render (item ?? itemTemplate)!(opt)}{:else}<span class="sv-listbox__label">{opt.label}</span>{/if}
{/snippet}

{#snippet optionRow(opt: IndexedOption, index: number, h?: number, top?: number)}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div
    class="sv-listbox__opt"
    class:is-selected={isSel(opt)}
    class:is-active={lb.isActive(index)}
    class:is-disabled={opt.disabled}
    style:height={`${h ?? optHeight(opt)}px`}
    style:transform={top == null ? undefined : `translateY(${top}px)`}
    {...lb.optionProps(index)}
  >
    {@render optionInner(opt)}
  </div>
{/snippet}

<style>
  .sv-listbox {
    --_accent: var(--sg-accent, #2563eb);
    margin: 0; list-style: none;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    width: 220px; outline: none; --_fs: 13px;
  }
  /* Native scroll for the (fully rendered) non-virtual list. */
  .sv-listbox:not(.is-virtual) {
    padding: 4px; overflow-y: auto;
    max-height: calc(var(--sv-rows, 7) * var(--sv-row-h, 32px) + 8px);
  }
  /* JS-driven scroller for the virtual list: fixed height, no native scroll -
     the rows are absolutely positioned and moved by `scrollOffset`. */
  .sv-listbox.is-virtual {
    padding: 0; overflow: hidden; position: relative;
    height: calc(var(--sv-rows, 7) * var(--sv-row-h, 32px) + 8px);
  }
  .sv-listbox--sm { --_fs: 12px; }
  .sv-listbox--lg { --_fs: 15px; }
  .sv-listbox:focus-visible { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-listbox.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-listbox.is-invalid:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }

  /* The clipped viewport that holds the translated rows. */
  .sv-listbox__vp { position: absolute; inset: 4px; overflow: hidden; touch-action: none; }
  .sv-listbox.is-virtual .sv-listbox__opt,
  .sv-listbox.is-virtual .sv-listbox__group { position: absolute; left: 0; right: 0; top: 0; }

  /* Custom scrollbar (mouse affordance; keyboard nav handles a11y scrolling). */
  .sv-listbox__sb { position: absolute; top: 4px; right: 2px; bottom: 4px; width: 10px; z-index: 2; }
  .sv-listbox__thumb {
    position: absolute; left: 2px; right: 2px; top: 0; min-height: 24px;
    border-radius: 4px; background: color-mix(in srgb, currentColor 26%, transparent);
    cursor: default; touch-action: none;
  }
  .sv-listbox__thumb:hover, .sv-listbox__thumb.is-dragging { background: color-mix(in srgb, currentColor 42%, transparent); }

  .sv-listbox__opt {
    display: flex; align-items: center; gap: 8px; box-sizing: border-box; flex: none; padding: 0 10px;
    border-radius: 6px; cursor: pointer; font-size: var(--_fs, 13px);
  }
  .sv-listbox__opt.is-active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-listbox__opt.is-selected { background: color-mix(in srgb, var(--_accent) 14%, transparent); color: var(--_accent); font-weight: 600; }
  .sv-listbox__opt.is-selected.is-active { background: color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-listbox__opt.is-disabled { opacity: 0.4; cursor: not-allowed; }
  .sv-listbox__group {
    box-sizing: border-box; padding: 8px 10px 3px; font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8);
    display: flex; align-items: flex-end;
  }
  .sv-listbox__check { width: 14px; text-align: center; color: var(--_accent); }
  .sv-listbox__label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
