<script lang="ts">
  /**
   * Internal dropdown / listbox control used by the `list` and `chips` cell
   * editors. We deliberately don't reuse the browser-native `<select>` -
   * the native dropdown can't be styled to match the grid theme, picks up
   * the OS color scheme, and on Windows draws the option list with an
   * opaque white system surface that fights the dark theme.
   *
   * Modes:
   *   single  - picking an option fires `onChange(value)` and `onCommit()`.
   *   multi   - toggling fires `onChange(values: array)`; the user
   *             presses Enter / clicks "Done" to fire `onCommit()`.
   *
   * Keyboard model:
   *   ArrowDown / ArrowUp - move highlight (opens the panel if closed).
   *   Enter              - single: toggle highlighted + commit.
   *                        multi: toggle highlighted (stay open).
   *   Escape             - close + onCancel.
   *   Tab                - commit and let focus escape.
   */
  import type { CellEditorOption } from './editors/cell-editors'

  type Props = {
    options: ReadonlyArray<CellEditorOption>
    value: unknown
    multiple?: boolean
    placeholder?: string
    /** When provided, the trigger renders as removable chips of the current value(s). */
    renderChipsInTrigger?: boolean
    /** Add a typeahead input at the top of the popover that filters the
     *  option list as the user types. Used by the rich-select editor. */
    searchable?: boolean
    /** Called with the new full value (scalar for single, array for multi). */
    onChange?: (next: unknown) => void
    /** Called when the user finalizes the selection (single pick, Enter, blur with selection). */
    onCommit?: () => void
    /** Called when the user dismisses (Escape, blur with no change). */
    onCancel?: () => void
  }

  let {
    options,
    value,
    multiple = false,
    placeholder = 'Select…',
    renderChipsInTrigger = false,
    searchable = false,
    onChange,
    onCommit,
    onCancel,
  }: Props = $props()

  let searchQuery = $state('')
  const visibleOptions = $derived(
    !searchable || !searchQuery.trim()
      ? options
      : (() => {
          const q = searchQuery.trim().toLowerCase()
          return options.filter((o) => o.label.toLowerCase().includes(q))
        })(),
  )

  let open = $state(false)
  let highlighted = $state(-1)
  let rootEl: HTMLDivElement | null = $state(null)
  let triggerEl: HTMLButtonElement | null = $state(null)
  let panelEl: HTMLDivElement | null = $state(null)

  /** Viewport-anchored panel position. We `position: fixed` the panel so it
   *  escapes the grid's overflow:hidden scroll container - otherwise the
   *  bottom of the list gets clipped by the pager or the grid's footer. */
  let panelRect = $state<{ top: number; left: number; width: number; openUpward: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false,
  })

  const selectedArr = $derived(
    Array.isArray(value)
      ? (value as Array<string | number>)
      : value == null || value === ''
        ? []
        : [value as string | number],
  )

  const triggerSummary = $derived.by(() => {
    if (selectedArr.length === 0) return placeholder
    if (!multiple) {
      const v = selectedArr[0]!
      const match = options.find((o) => String(o.value) === String(v))
      return match ? match.label : String(v)
    }
    return `${selectedArr.length} selected`
  })

  /** Color of the single selected option, if any (for colored trigger). */
  const selectedColor = $derived.by(() => {
    if (multiple || selectedArr.length !== 1) return undefined
    const v = selectedArr[0]!
    return options.find((o) => String(o.value) === String(v))?.color
  })

  function isSelected(opt: CellEditorOption): boolean {
    return selectedArr.some((v) => String(v) === String(opt.value))
  }

  function toggleOption(opt: CellEditorOption) {
    if (multiple) {
      const exists = isSelected(opt)
      const next = exists
        ? selectedArr.filter((v) => String(v) !== String(opt.value))
        : [...selectedArr, opt.value]
      onChange?.(next)
    } else {
      onChange?.(opt.value)
      open = false
      onCommit?.()
    }
  }

  function openPanel() {
    if (open) return
    open = true
    // Seed the highlight to the first selected option, or top of the list.
    if (highlighted < 0) {
      const idx = options.findIndex((o) => isSelected(o))
      highlighted = idx >= 0 ? idx : 0
    }
    updatePanelPosition()
  }

  /** Recompute the panel's fixed-position rect from the trigger. Auto-
   *  flips upward when there isn't enough room below the trigger. */
  function updatePanelPosition() {
    if (!triggerEl) return
    const r = triggerEl.getBoundingClientRect()
    // Use the smaller of (option count, 10) for the upward-flip math so
    // a 3-option list doesn't think it needs 320px of headroom.
    const visibleCount = Math.min(options.length, 10)
    const estimatedHeight = visibleCount * 32 + (multiple ? 40 : 0) + 8
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
    panelRect = {
      top: openUpward ? r.top - estimatedHeight - 2 : r.bottom + 2,
      left: r.left,
      width: r.width,
      openUpward,
    }
  }

  // Keep the panel anchored as the page scrolls or resizes - without this,
  // scrolling the underlying grid would leave the panel hanging in space.
  $effect(() => {
    if (!open) return
    const reposition = () => updatePanelPosition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  })

  function closePanel() {
    open = false
    highlighted = -1
  }

  function onKeyDown(event: KeyboardEvent) {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      closePanel()
      onCancel?.()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        openPanel()
        return
      }
      highlighted = Math.min(highlighted + 1, options.length - 1)
      scrollHighlightedIntoView()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openPanel()
        return
      }
      highlighted = Math.max(highlighted - 1, 0)
      scrollHighlightedIntoView()
    } else if (event.key === 'Home') {
      if (!open) return
      event.preventDefault()
      highlighted = 0
      scrollHighlightedIntoView()
    } else if (event.key === 'End') {
      if (!open) return
      event.preventDefault()
      highlighted = options.length - 1
      scrollHighlightedIntoView()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (!open) {
        openPanel()
        return
      }
      const opt = options[highlighted]
      if (opt) toggleOption(opt)
      else if (multiple) {
        closePanel()
        onCommit?.()
      }
    } else if (event.key === ' ' && open) {
      event.preventDefault()
      const opt = options[highlighted]
      if (opt) toggleOption(opt)
    } else if (event.key === 'Tab') {
      if (open) closePanel()
      onCommit?.()
    }
  }

  function scrollHighlightedIntoView() {
    queueMicrotask(() => {
      if (!panelEl) return
      const el = panelEl.querySelector<HTMLElement>(`[data-opt-idx="${highlighted}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  function onRootBlur(event: FocusEvent) {
    // Defer to the next tick so a click on an option (mousedown → option
    // commits, then blur) doesn't race-cancel the selection.
    const next = event.relatedTarget as Node | null
    if (next && rootEl?.contains(next)) return
    if (open) closePanel()
    onCommit?.()
  }

  function removeChip(v: string | number, event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const next = selectedArr.filter((x) => String(x) !== String(v))
    onChange?.(multiple ? next : next[0] ?? null)
  }

  function focusTrigger(node: HTMLButtonElement) {
    node.focus()
    // Auto-open so the user can immediately pick - matches the
    // expectation set by clicking into an editing cell.
    openPanel()
  }

  /** Svelte action: detach the element on mount and append it to
   *  document.body, then put it back / remove on destroy. This is how
   *  we "portal" the panel out of the grid's overflow:hidden scroll
   *  container so it can never be clipped, no matter how deeply nested
   *  the editing cell is. */
  function portalToBody(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode === document.body) {
          document.body.removeChild(node)
        }
      },
    }
  }

  /** Close the panel when the user clicks outside both trigger AND
   *  panel - `onfocusout` on the dropdown root no longer catches this
   *  because the portal'd panel is a sibling of body, not a descendant
   *  of rootEl. Wired up only while the panel is open. */
  $effect(() => {
    if (!open) return
    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (rootEl?.contains(target)) return
      if (panelEl?.contains(target)) return
      closePanel()
      onCommit?.()
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true)
  })

  /** Inline style for a chip with a configured `color`. Mirrors the
   *  helper in SvGrid.svelte so colorful chips look identical in the
   *  trigger and the in-cell readonly render. */
  function colorfulChipStyleInline(color: string): string {
    return (
      `background: color-mix(in srgb, ${color} 22%, transparent);` +
      `border-color: color-mix(in srgb, ${color} 45%, transparent);` +
      `color: color-mix(in srgb, ${color} 80%, var(--sg-fg, #0f172a));`
    )
  }
</script>

<!-- All pointer/click events are swallowed at the root so they never reach
     the surrounding cell's selection / pointerdown handlers - picking a
     dropdown option must not also toggle cell selection. -->
<div
  class="sv-grid-dropdown"
  class:sv-grid-dropdown-open={open}
  bind:this={rootEl}
  onfocusout={onRootBlur}
  onclick={(event) => event.stopPropagation()}
  ondblclick={(event) => event.stopPropagation()}
  onpointerdown={(event) => event.stopPropagation()}
  onmousedown={(event) => event.stopPropagation()}
>
  <button
    type="button"
    class="sv-grid-dropdown-trigger"
    class:sv-grid-dropdown-trigger-chips={renderChipsInTrigger && selectedArr.length > 0}
    aria-haspopup="listbox"
    aria-expanded={open}
    bind:this={triggerEl}
    use:focusTrigger
    onclick={() => (open ? closePanel() : openPanel())}
    onkeydown={onKeyDown}
  >
    {#if renderChipsInTrigger && selectedArr.length > 0}
      <span class="sv-grid-dropdown-chips">
        {#each selectedArr as v (String(v))}
          {@const opt = options.find((o) => String(o.value) === String(v))}
          <span
            class="sv-grid-chip sv-grid-chip-removable"
            style={opt?.color ? colorfulChipStyleInline(opt.color) : ''}
          >
            {opt ? opt.label : String(v)}
            <!-- A <button> can't be nested inside the trigger <button>; this is a
                 pointer-only affordance (tabindex -1), so a role="button" span is
                 valid HTML and preserves identical behaviour. -->
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <span
              class="sv-grid-chip-remove"
              role="button"
              aria-label="Remove {opt ? opt.label : String(v)}"
              tabindex={-1}
              onmousedown={(event) => event.preventDefault()}
              onclick={(event) => removeChip(v, event)}
            >×</span>
          </span>
        {/each}
      </span>
    {:else if !multiple && selectedArr.length === 1 && selectedColor}
      <!-- Single-select list whose chosen option carries a color → show it
           as a colored chip inside the trigger, matching how the cell
           renders when not in edit mode. -->
      <span class="sv-grid-chip" style={colorfulChipStyleInline(selectedColor)}>
        {triggerSummary}
      </span>
    {:else}
      <span class="sv-grid-dropdown-label">{triggerSummary}</span>
    {/if}
    <span class="sv-grid-dropdown-caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <!-- Sizing rule:
         - ≤ 10 options → no max-height. The panel grows to its content,
           overflow:auto stays inert, and no scrollbar is ever drawn.
           This matters because measuring "10 × 32px" against the real
           rendered option height (which depends on font + line-height)
           rounds inconsistently across themes and used to produce a
           1-pixel scrollbar on lists as short as 3 items.
         - > 10 options → cap at 10 items + Done-footer chrome so the
           panel never overflows the viewport, and the scrollbar appears.
         Panel is `position: fixed` + portal'd to <body> so it escapes
         the grid's overflow:hidden scroll container. -->
    {@const needsScroll = options.length > 10}
    {@const panelMax = needsScroll ? 10 * 32 + (multiple ? 40 : 0) + 8 : null}
    <div
      class="sv-grid-dropdown-panel"
      class:sv-grid-dropdown-panel-fits={!needsScroll}
      role="listbox"
      aria-multiselectable={multiple}
      bind:this={panelEl}
      use:portalToBody
      style:position="fixed"
      style:top={`${panelRect.top}px`}
      style:left={`${panelRect.left}px`}
      style:width={`${panelRect.width}px`}
      style:max-height={panelMax !== null ? `${panelMax}px` : null}
      style:z-index="9999"
      onpointerdown={(event) => event.stopPropagation()}
      onmousedown={(event) => event.stopPropagation()}
      onclick={(event) => event.stopPropagation()}
    >
      {#if searchable}
        <input
          type="search"
          class="sv-grid-dropdown-search"
          placeholder="Search…"
          bind:value={searchQuery}
          onmousedown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
          onkeydown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); open = false; onCancel?.() }
          }}
        />
      {/if}
      {#if visibleOptions.length === 0}
        <div class="sv-grid-dropdown-empty">{searchable && searchQuery ? `No matches for "${searchQuery}"` : 'No options'}</div>
      {:else}
        {#each visibleOptions as opt, i (String(opt.value))}
          {@const selected = isSelected(opt)}
          <div
            class="sv-grid-dropdown-option"
            class:sv-grid-dropdown-option-selected={selected}
            class:sv-grid-dropdown-option-highlighted={i === highlighted}
            role="option"
            aria-selected={selected}
            data-opt-idx={i}
            onmousedown={(event) => {
              event.preventDefault()
              toggleOption(opt)
            }}
            onmouseenter={() => (highlighted = i)}
          >
            {#if multiple}
              <span class="sv-grid-dropdown-check" aria-hidden="true">
                {selected ? '✓' : ''}
              </span>
            {/if}
            {#if opt.color}
              <!-- Colored options render as a full chip (pill) so the
                   dropdown choices match how the value looks in the cell. -->
              <span class="sv-grid-dropdown-option-chip" style={colorfulChipStyleInline(opt.color)}>{opt.label}</span>
            {:else}
              <span class="sv-grid-dropdown-option-label">{opt.label}</span>
            {/if}
          </div>
        {/each}
      {/if}

      {#if multiple}
        <div class="sv-grid-dropdown-footer">
          <button
            type="button"
            class="sv-grid-dropdown-done"
            onmousedown={(event) => event.preventDefault()}
            onclick={() => {
              closePanel()
              onCommit?.()
            }}
          >Done</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* All colors derive from the grid's host CSS vars so light/dark themes
     "just work". Hard fallbacks are kept so the component is still
     usable in an unthemed page. */
  .sv-grid-dropdown {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
  }

  .sv-grid-dropdown-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 100%;
    min-height: 28px;
    padding: 0 8px;
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
    border: 0;
    outline: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
  }
  .sv-grid-dropdown-trigger:focus {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: -2px;
  }

  .sv-grid-dropdown-trigger-chips {
    align-items: center;
    padding: 4px 8px;
    flex-wrap: wrap;
  }
  .sv-grid-dropdown-chips {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
    align-items: center;
  }

  .sv-grid-dropdown-label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-grid-dropdown-caret {
    flex: 0 0 auto;
    font-size: 10px;
    opacity: 0.7;
    line-height: 1;
  }

  /* Popover sits absolutely below the trigger. The parent
     `.sv-grid-cell-editing` has `overflow: visible`, so this can hang
     past the row. Pulls its surface color from the grid's header bg
     so it reads as a slightly elevated layer on either theme. */
  /* Panel is `position: fixed` AND portal'd into document.body via
     `use:portalToBody`, so it escapes every ancestor overflow / clip /
     transform / stacking context. Coords come from updatePanelPosition(). */
  :global(.sv-grid-dropdown-panel) {
    overflow-y: auto;
    background: var(--sg-header-bg, var(--sg-bg, #ffffff));
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-accent, #2563eb);
    border-radius: 6px;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
    padding: 4px 0;
    font-family: inherit;
  }
  /* When the option list fits in one panel we want NO scrollbar at all -
   * not even a sub-pixel ghost track. `overflow: visible` rules out the
   * scrollbar gutter that some browsers still reserve under
   * `overflow: auto` when content equals max-height. */
  :global(.sv-grid-dropdown-panel.sv-grid-dropdown-panel-fits) {
    overflow: visible;
  }
  :global(.sv-grid-dropdown-option) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    cursor: pointer;
    user-select: none;
    color: var(--sg-fg, #0f172a);
  }
  :global(.sv-grid-dropdown-option-highlighted) {
    background: var(--sg-row-hover-bg, rgba(37, 99, 235, 0.1));
  }
  :global(.sv-grid-dropdown-option-selected) {
    font-weight: 600;
    background: var(--sg-selection-bg, rgba(37, 99, 235, 0.15));
  }
  :global(.sv-grid-dropdown-option-selected.sv-grid-dropdown-option-highlighted) {
    background: var(--sg-row-hover-bg, rgba(37, 99, 235, 0.18));
  }
  :global(.sv-grid-dropdown-option-label) {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.sv-grid-dropdown-check) {
    flex: 0 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--sg-accent, #2563eb);
    font-weight: 700;
  }
  :global(.sv-grid-dropdown-swatch) {
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 25%, transparent);
  }
  /* Colored option chip. Declared `:global` because the option panel is
     portal'd to <body>, where Svelte's scoped classes don't reach. The
     per-chip background / border / text color come from an inline style
     (see colorfulChipStyleInline) so each option matches its cell chip. */
  :global(.sv-grid-dropdown-option-chip) {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 2px 11px;
    border: 1px solid transparent;
    border-radius: 999px;
    font-size: 0.9em;
    font-weight: 600;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.sv-grid-dropdown-empty) {
    padding: 8px 10px;
    color: var(--sg-muted, rgba(15, 23, 42, 0.55));
    font-style: italic;
    font-size: 0.9em;
  }
  :global(.sv-grid-dropdown-footer) {
    display: flex;
    justify-content: flex-end;
    padding: 4px 6px;
    border-top: 1px solid var(--sg-border, rgba(15, 23, 42, 0.08));
    margin-top: 2px;
  }
  :global(.sv-grid-dropdown-done) {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #fff;
    background: var(--sg-accent, #2563eb);
    border: 0;
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
  }
  :global(.sv-grid-dropdown-done:hover) {
    filter: brightness(1.12);
  }

  /* Note: option / footer / swatch styles are declared `:global(...)`
     above because the panel is portal'd to <body> and Svelte's scoped
     class won't survive on children of an element living outside the
     component subtree. */

  /* Theme-aware chip badges. Inside the trigger they sit on the cell
     background, so we need a tone that contrasts on BOTH themes - a
     translucent accent works well in dark mode and reads as a soft
     blue pill in light mode. */
  .sv-grid-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 0.85em;
    line-height: 1.4;
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 18%, transparent);
    color: var(--sg-fg, #0f172a);
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--sg-accent, #2563eb) 35%, transparent);
    white-space: nowrap;
  }
  .sv-grid-chip-removable {
    padding-right: 2px;
  }
  .sv-grid-chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 18%, transparent);
    color: inherit;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }
  .sv-grid-chip-remove:hover {
    background: rgba(220, 38, 38, 0.7);
    color: #fff;
  }
</style>
