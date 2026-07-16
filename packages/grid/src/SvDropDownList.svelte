<script lang="ts">
  /**
   * SvDropDownList - a single-select dropdown (trigger button + portalled list,
   * no typing). Parity: Smart `smart-drop-down-list`. Controlled via `value` +
   * `onChange`. Popover escapes scroll clipping via popover.ts.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import type { ListOption } from './list-option'

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

  let open = $state(false)
  let active = $state(-1)
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  const selected = $derived(options.find((o) => o.value === value) ?? null)
  const enabledIdx = $derived(options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0))

  function updatePos() {
    if (!triggerEl) return
    rect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: Math.min(options.length, 8) * 34 + 8 })
  }
  function openPanel() {
    if (disabled || open) return
    open = true
    active = Math.max(0, options.findIndex((o) => o.value === value))
    updatePos()
  }
  function close() { open = false }
  function toggle() { open ? close() : openPanel() }
  function pick(i: number) {
    const o = options[i]
    if (!o || o.disabled) return
    onChange?.(o.value); close(); triggerEl?.focus()
  }
  function move(d: number) {
    const pos = enabledIdx.indexOf(active)
    active = enabledIdx[(pos + d + enabledIdx.length) % enabledIdx.length] ?? active
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }))
  }
  function onKeydown(e: KeyboardEvent) {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPanel(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { e.preventDefault(); close(); triggerEl?.focus() }
    else if (e.key === 'Home') { active = enabledIdx[0] ?? 0 }
    else if (e.key === 'End') { active = enabledIdx.at(-1) ?? 0 }
  }

  $effect(() => {
    if (!open) return
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const od = (e: PointerEvent) => { const t = e.target as Node | null; if (t && (triggerEl?.contains(t) || panelEl?.contains(t))) return; close() }
    document.addEventListener('pointerdown', od, true)
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); document.removeEventListener('pointerdown', od, true) }
  })
  function focusOpen(node: HTMLButtonElement) { if (autoOpen) { node.focus(); openPanel() } }
</script>

<button
  bind:this={triggerEl}
  type="button"
  class="sv-ddl sv-ddl--{size}"
  class:is-open={open}
  class:is-disabled={disabled}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={ariaLabel}
  {disabled}
  onclick={toggle}
  onkeydown={onKeydown}
  use:focusOpen
>
  <span class="sv-ddl__value" class:is-placeholder={!selected}>{selected?.label ?? placeholder}</span>
  <svg class="sv-ddl__chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
</button>

{#if open}
  <div bind:this={panelEl} class="sv-ddl__panel" use:portalToBody style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} role="listbox" tabindex="-1">
    {#each options as opt, i (opt.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div
        class="sv-ddl__opt"
        class:is-active={i === active}
        class:is-selected={opt.value === value}
        class:is-disabled={opt.disabled}
        role="option"
        tabindex="-1"
        aria-selected={opt.value === value}
        data-idx={i}
        onclick={() => pick(i)}
        onpointermove={() => { if (!opt.disabled) active = i }}
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
