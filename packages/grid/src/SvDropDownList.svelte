<script lang="ts">
  /**
   * SvDropDownList - a single-select dropdown (trigger button + portalled list,
   * no typing). Parity: Smart `smart-drop-down-list`. Controlled via `value` +
   * `onChange`. Popover escapes scroll clipping via popover.ts.
   *
   * One styled renderer over the headless `createDropdownList` core (state +
   * keyboard + ARIA); only portal/measure/scroll render concerns live here.
   */
  import { flushSync } from 'svelte'
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
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
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

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
    rect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: Math.min(options.length, 8) * 34 + 8 })
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
    <span class="sv-ddl__value" class:is-placeholder={!selected}>{selected?.label ?? placeholder}</span>
    <svg class="sv-ddl__chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
  </button>
</SvField>

{#if ddl.open}
  <div bind:this={panelEl} class="sv-ddl__panel" class:is-virtual={useVirtual} use:portalToBody use:popIn={{ up: rect.openUpward }} style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} onscroll={(e) => { scrollTop = e.currentTarget.scrollTop; if (useVirtual) flushSync() }} bind:clientHeight={viewportH} {...ddl.listboxProps()}>
    {#if useVirtual}
      <div class="sv-ddl__sizer" aria-hidden="true" style:height={`${vr.totalHeight}px`}></div>
      {#each windowed as opt (opt.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
        <div class="sv-ddl__opt sv-ddl__opt--abs" style:height={`${rowHeight}px`} style:transform={`translateY(${opt.index * rowHeight}px)`} class:is-active={ddl.isActive(opt.index)} class:is-selected={ddl.isSelected(opt)} class:is-disabled={opt.disabled} {...ddl.optionProps(opt.index)}>{opt.label}</div>
      {/each}
    {:else}
    {#each groupOptions(options) as g (g.group ?? '')}
      {#if g.group != null}
        <div class="sv-ddl__group" role="group" aria-label={g.group}>
          <div class="sv-ddl__group-label" aria-hidden="true">{g.group}</div>
          {#each g.options as opt (opt.value)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
            <div class="sv-ddl__opt" class:is-active={ddl.isActive(opt.index)} class:is-selected={ddl.isSelected(opt)} class:is-disabled={opt.disabled} {...ddl.optionProps(opt.index)}>{opt.label}</div>
          {/each}
        </div>
      {:else}
        {#each g.options as opt (opt.value)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
          <div class="sv-ddl__opt" class:is-active={ddl.isActive(opt.index)} class:is-selected={ddl.isSelected(opt)} class:is-disabled={opt.disabled} {...ddl.optionProps(opt.index)}>{opt.label}</div>
        {/each}
      {/if}
    {/each}
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
    z-index: 2147483647; max-height: 288px; overflow-y: auto; padding: 4px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; box-shadow: 0 16px 48px -12px rgba(15,23,42,0.35);
  }
  :global(.sv-ddl__opt) { box-sizing: border-box; display: flex; align-items: center; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  :global(.sv-ddl__panel.is-virtual) { position: fixed; will-change: scroll-position; }
  :global(.sv-ddl__sizer) { padding: 0; margin: 0; pointer-events: none; }
  :global(.sv-ddl__opt--abs) { position: absolute; inset-inline: 4px; top: 4px; }
  :global(.sv-ddl__opt.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-ddl__opt.is-selected) { color: var(--sg-accent, #2563eb); font-weight: 600; }
  :global(.sv-ddl__opt.is-disabled) { opacity: 0.4; cursor: not-allowed; }
  :global(.sv-ddl__group-label) {
    padding: 8px 10px 3px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--sg-muted, #94a3b8);
  }
</style>
