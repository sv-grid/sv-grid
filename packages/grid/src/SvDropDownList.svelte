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
  import { groupOptions, hasGroups, type ListOption } from './list-option'
  import { virtualRange, scrollToIndex } from './virtual'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createDropdownList } from './createDropdownList.svelte'

  type Props = SvEditorProps & {
    options: ReadonlyArray<ListOption>
    value?: string | number | null
    onChange?: (value: string | number) => void
    placeholder?: string
    autoOpen?: boolean
    /** Window the option list (render only visible) for large sets. */
    virtual?: boolean
    /** Fixed option height in px (must match the CSS). Default 34. */
    rowHeight?: number
    /** Show a bottom drag grip so the user can resize the open panel's height
     *  (only while it opens downward). Off by default. */
    resizable?: boolean
  }

  let {
    options,
    value = null,
    onChange,
    placeholder = 'Select…',
    disabled = false,
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
    resizable = false,
  }: Props = $props()

  const autoId = nextEditorId('sv-ddl')
  const uid = $derived(id ?? autoId)

  // Virtualization applies to a flat (ungrouped) list.
  const useVirtual = $derived(virtual && !hasGroups(options))
  let scrollTop = $state(0)
  let viewportH = $state(0)
  const vr = $derived(virtualRange({ scrollTop, viewportHeight: viewportH, rowHeight, count: options.length, overscan: 10 }))
  const windowed = $derived(useVirtual ? options.slice(vr.start, vr.end).map((o, i) => ({ ...o, index: vr.start + i })) : [])

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

  const ddl = createDropdownList({
    options: () => options,
    value: () => value,
    onChange: (v) => onChange?.(v),
    disabled: () => disabled,
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
    // upward top stay correct; otherwise estimate from the option count.
    const estimatedHeight =
      resizable && userHeight != null ? userHeight : Math.min(options.length, 8) * 34 + 8
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
  // Keep the active option scrolled into view (render concern).
  $effect(() => {
    if (!ddl.open) return
    const i = ddl.activeIndex
    if (useVirtual) {
      if (!panelEl) return
      const next = scrollToIndex(i, panelEl.scrollTop, panelEl.clientHeight, rowHeight)
      if (next !== panelEl.scrollTop) { panelEl.scrollTop = next; scrollTop = next }
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

{#if ddl.open}
  <div bind:this={panelEl} class="sv-ddl__panel" class:is-virtual={useVirtual} class:is-resizable={showGrip} use:portalToBody use:popIn={{ up: rect.openUpward }} style:--sv-row-h={`${rowHeight}px`} style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} style:max-height={`${panelMaxH}px`} style:height={resizable && userHeight != null ? `${panelMaxH}px` : undefined} onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)} bind:clientHeight={viewportH} {...ddl.listboxProps()}>
    {#if useVirtual}
      <div class="sv-ddl__spacer" aria-hidden="true" style:height={`${vr.padTop}px`}></div>
      {#each windowed as opt (opt.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
        <div class="sv-ddl__opt" style:height={`${rowHeight}px`} class:is-active={ddl.isActive(opt.index)} class:is-selected={ddl.isSelected(opt)} class:is-disabled={opt.disabled} {...ddl.optionProps(opt.index)}>{#if opt.color}<span class="sv-ddl__swatch" style:background={opt.color}></span>{/if}{opt.label}</div>
      {/each}
      <div class="sv-ddl__spacer" aria-hidden="true" style:height={`${vr.padBottom}px`}></div>
    {:else}
    {#each groupOptions(options) as g (g.group ?? '')}
      {#if g.group != null}
        <div class="sv-ddl__group" role="group" aria-label={g.group}>
          <div class="sv-ddl__group-label" aria-hidden="true">{g.group}</div>
          {#each g.options as opt (opt.value)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
            <div class="sv-ddl__opt" class:is-active={ddl.isActive(opt.index)} class:is-selected={ddl.isSelected(opt)} class:is-disabled={opt.disabled} {...ddl.optionProps(opt.index)}>{#if opt.color}<span class="sv-ddl__swatch" style:background={opt.color}></span>{/if}{opt.label}</div>
          {/each}
        </div>
      {:else}
        {#each g.options as opt (opt.value)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
          <div class="sv-ddl__opt" class:is-active={ddl.isActive(opt.index)} class:is-selected={ddl.isSelected(opt)} class:is-disabled={opt.disabled} {...ddl.optionProps(opt.index)}>{#if opt.color}<span class="sv-ddl__swatch" style:background={opt.color}></span>{/if}{opt.label}</div>
        {/each}
      {/if}
    {/each}
    {/if}
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
  :global(.sv-ddl__opt) { box-sizing: border-box; display: flex; align-items: center; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
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
  /* Faint per-row skeleton so a fast scrollbar-thumb drag reveals placeholder
     rows in this off-screen padding instead of blank, until JS re-windows. */
  :global(.sv-ddl__spacer) {
    padding: 0; margin: 0; flex: none; pointer-events: none;
    background-image: linear-gradient(
      to bottom,
      transparent 0,
      transparent calc((var(--sv-row-h, 34px) - 10px) / 2),
      var(--sg-skeleton, color-mix(in srgb, currentColor 9%, transparent)) calc((var(--sv-row-h, 34px) - 10px) / 2),
      var(--sg-skeleton, color-mix(in srgb, currentColor 9%, transparent)) calc((var(--sv-row-h, 34px) + 10px) / 2),
      transparent calc((var(--sv-row-h, 34px) + 10px) / 2),
      transparent var(--sv-row-h, 34px)
    );
    background-size: 62% var(--sv-row-h, 34px);
    background-repeat: repeat-y;
    background-position: 12px 0;
  }
  :global(.sv-ddl__opt.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-ddl__opt.is-selected) { color: var(--sg-accent, #2563eb); font-weight: 600; }
  :global(.sv-ddl__opt.is-disabled) { opacity: 0.4; cursor: not-allowed; }
  :global(.sv-ddl__group-label) {
    padding: 8px 10px 3px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--sg-muted, #94a3b8);
  }
</style>
