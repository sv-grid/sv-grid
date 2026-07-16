<script lang="ts">
  /**
   * SvDropDownList - a single-select dropdown (trigger button + portalled list,
   * no typing). Parity: Smart `smart-drop-down-list`. Controlled via `value` +
   * `onChange`. Popover escapes scroll clipping via popover.ts.
   *
   * One styled renderer over the headless `createDropdownList` core (state +
   * keyboard + ARIA); only portal/measure/scroll render concerns live here.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import type { ListOption } from './list-option'
  import { createDropdownList } from './createDropdownList.svelte'

  type Props = {
    options: ReadonlyArray<ListOption>
    value?: string | number | null
    onChange?: (value: string | number) => void
    placeholder?: string
    disabled?: boolean
    name?: string
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
    autoOpen?: boolean
  }

  let { options, value = null, onChange, placeholder = 'Select…', disabled = false, name, size = 'md', ariaLabel, autoOpen = false }: Props = $props()

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
    const od = (e: PointerEvent) => { const t = e.target as Node | null; if (t && (triggerEl?.contains(t) || panelEl?.contains(t))) return; ddl.close() }
    document.addEventListener('pointerdown', od, true)
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); document.removeEventListener('pointerdown', od, true) }
  })
  // Keep the active option scrolled into view (render concern).
  $effect(() => {
    if (!ddl.open) return
    const i = ddl.activeIndex
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' }))
  })
  function focusOpen(node: HTMLButtonElement) { if (autoOpen) { node.focus(); ddl.openPanel() } }
</script>

<button
  bind:this={triggerEl}
  class="sv-ddl sv-ddl--{size}"
  class:is-open={ddl.open}
  class:is-disabled={disabled}
  {...ddl.triggerProps()}
  use:focusOpen
>
  <span class="sv-ddl__value" class:is-placeholder={!selected}>{selected?.label ?? placeholder}</span>
  <svg class="sv-ddl__chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
</button>

{#if ddl.open}
  <div bind:this={panelEl} class="sv-ddl__panel" use:portalToBody style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} {...ddl.listboxProps()}>
    {#each options as opt, i (opt.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div
        class="sv-ddl__opt"
        class:is-active={ddl.isActive(i)}
        class:is-selected={ddl.isSelected(opt)}
        class:is-disabled={opt.disabled}
        {...ddl.optionProps(i)}
      >{opt.label}</div>
    {/each}
  </div>
{/if}
{#if name}<input type="hidden" {name} value={value ?? ''} />{/if}

<style>
  .sv-ddl {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; width: 200px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; text-align: left;
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    padding: 0 10px; cursor: pointer;
  }
  .sv-ddl--sm { height: 28px; font-size: 12px; }
  .sv-ddl--md { height: 34px; font-size: 13px; }
  .sv-ddl--lg { height: 40px; font-size: 15px; }
  .sv-ddl.is-open, .sv-ddl:focus-visible { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); outline: none; }
  .sv-ddl.is-disabled { opacity: 0.6; cursor: not-allowed; }
  .sv-ddl__value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-ddl__value.is-placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-ddl__chev { color: var(--sg-muted, #64748b); flex: none; }

  :global(.sv-ddl__panel) {
    z-index: 2147483647; max-height: 288px; overflow-y: auto; padding: 4px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; box-shadow: 0 16px 48px -12px rgba(15,23,42,0.35);
  }
  :global(.sv-ddl__opt) { padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  :global(.sv-ddl__opt.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-ddl__opt.is-selected) { color: var(--sg-accent, #2563eb); font-weight: 600; }
  :global(.sv-ddl__opt.is-disabled) { opacity: 0.4; cursor: not-allowed; }
</style>
