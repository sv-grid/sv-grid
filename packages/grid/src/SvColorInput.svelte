<script lang="ts">
  /**
   * SvColorInput - a color swatch that opens a portalled popover with a hex
   * field, a native picker, and a preset palette. Parity: Smart `smart-color-input`.
   * Emits a hex string. Popover escapes the grid scroll container via popover.ts.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'

  type Props = {
    value?: string
    onChange?: (hex: string) => void
    disabled?: boolean
    readonly?: boolean
    /** Preset swatches. */
    palette?: string[]
    name?: string
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
    autoOpen?: boolean
  }

  const DEFAULT_PALETTE = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#64748b', '#0f172a', '#ffffff',
  ]

  let {
    value = '#3b82f6',
    onChange,
    disabled = false,
    readonly = false,
    palette = DEFAULT_PALETTE,
    name,
    size = 'md',
    ariaLabel,
    autoOpen = false,
  }: Props = $props()

  const isInteractive = $derived(!disabled && !readonly)
  let open = $state(false)
  let hexDraft = $state('')
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let panelRect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  const normalized = $derived(normalizeHex(value) ?? '#000000')

  function normalizeHex(h: string): string | null {
    let s = h.trim()
    if (!s.startsWith('#')) s = '#' + s
    if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('')
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null
  }

  function updatePos() {
    if (!triggerEl) return
    panelRect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: 210, minWidth: 200 })
  }
  function openPanel() {
    if (!isInteractive || open) return
    hexDraft = normalized
    open = true
    updatePos()
  }
  function toggle() { open ? (open = false) : openPanel() }

  function pick(hex: string) {
    const n = normalizeHex(hex)
    if (n) onChange?.(n)
  }
  function commitHex() {
    const n = normalizeHex(hexDraft)
    if (n) onChange?.(n)
    else hexDraft = normalized
  }

  $effect(() => {
    if (!open) return
    const reposition = () => updatePos()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && (triggerEl?.contains(t) || panelEl?.contains(t))) return
      open = false
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('pointerdown', onDown, true)
    }
  })

  function focusOpen(node: HTMLButtonElement) {
    if (!autoOpen) return
    node.focus(); openPanel()
  }
</script>

<button
  type="button"
  bind:this={triggerEl}
  class="sv-color sv-color--{size}"
  class:is-disabled={disabled}
  aria-haspopup="dialog"
  aria-expanded={open}
  aria-label={ariaLabel ?? `Color ${normalized}`}
  disabled={!isInteractive}
  onclick={toggle}
  use:focusOpen
>
  <span class="sv-color__swatch" style:background={normalized}></span>
  <span class="sv-color__hex">{normalized}</span>
</button>

{#if open}
  <div
    class="sv-color__panel"
    bind:this={panelEl}
    use:portalToBody
    style:position="fixed"
    style:top={`${panelRect.top}px`}
    style:left={`${panelRect.left}px`}
    role="dialog"
    aria-label="Choose color"
  >
    <div class="sv-color__top">
      <input class="sv-color__native" type="color" value={normalized} oninput={(e) => pick((e.currentTarget as HTMLInputElement).value)} aria-label="Color picker" />
      <input
        class="sv-color__field"
        type="text"
        bind:value={hexDraft}
        spellcheck="false"
        aria-label="Hex value"
        onblur={commitHex}
        onkeydown={(e) => { if (e.key === 'Enter') commitHex() }}
      />
    </div>
    <div class="sv-color__palette">
      {#each palette as c (c)}
        <button
          type="button"
          class="sv-color__chip"
          class:is-active={normalizeHex(c) === normalized}
          style:background={c}
          aria-label={c}
          onclick={() => { pick(c); open = false }}
        ></button>
      {/each}
    </div>
  </div>
{/if}
{#if name}<input type="hidden" {name} value={normalized} />{/if}

<style>
  .sv-color {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    padding: 0 10px; cursor: pointer; font: inherit;
  }
  .sv-color--sm { height: 28px; font-size: 12px; }
  .sv-color--md { height: 34px; font-size: 13px; }
  .sv-color--lg { height: 40px; font-size: 15px; }
  .sv-color.is-disabled { opacity: 0.6; cursor: not-allowed; }
  .sv-color:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
  .sv-color__swatch { width: 18px; height: 18px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.15); flex: none; }
  .sv-color__hex { font-variant-numeric: tabular-nums; text-transform: lowercase; }

  :global(.sv-color__panel) {
    z-index: 2147483647; width: 208px; padding: 12px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 12px; box-shadow: 0 16px 48px -12px rgba(15,23,42,0.35);
  }
  :global(.sv-color__top) { display: flex; gap: 8px; margin-bottom: 10px; }
  :global(.sv-color__native) { width: 36px; height: 34px; padding: 0; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; background: none; cursor: pointer; }
  :global(.sv-color__field) {
    flex: 1; min-width: 0; height: 34px; padding: 0 10px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 8px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  :global(.sv-color__palette) { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
  :global(.sv-color__chip) { width: 100%; aspect-ratio: 1; border-radius: 5px; border: 1px solid rgba(0,0,0,0.12); cursor: pointer; padding: 0; }
  :global(.sv-color__chip.is-active) { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 1px; }
</style>
