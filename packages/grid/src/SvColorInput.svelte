<script lang="ts">
  /**
   * SvColorInput - a color swatch that opens a portalled popover with a hex
   * field, a native picker, and a preset palette. Parity: Smart `smart-color-input`.
   * Emits a hex string. Popover escapes the grid scroll container via popover.ts.
   *
   * The styled renderer over the headless `createColorInput` core: hex
   * normalization, palette, draft field and open/close state come from the core;
   * the portal + anchored measurement stay here (render concerns).
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import { createColorInput } from './createColorInput.svelte'

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

  let {
    value = '#3b82f6',
    onChange,
    disabled = false,
    readonly = false,
    palette,
    name,
    size = 'md',
    ariaLabel,
    autoOpen = false,
  }: Props = $props()

  const col = createColorInput({
    value: () => value,
    onChange: (hex) => onChange?.(hex),
    disabled: () => disabled,
    readonly: () => readonly,
    palette: () => palette as string[],
    ariaLabel: () => ariaLabel,
  })

  let triggerEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let panelRect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  function updatePos() {
    if (!triggerEl) return
    panelRect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: 210, minWidth: 200 })
  }

  $effect(() => {
    if (!col.popover.open) return
    updatePos()
    const reposition = () => updatePos()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && (triggerEl?.contains(t) || panelEl?.contains(t))) return
      col.popover.close()
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
    node.focus(); col.popover.show()
  }
</script>

<button
  bind:this={triggerEl}
  class="sv-color sv-color--{size}"
  class:is-disabled={disabled}
  {...col.swatchProps()}
  use:focusOpen
>
  <span class="sv-color__swatch" style:background={col.normalized}></span>
  <span class="sv-color__hex">{col.normalized}</span>
</button>

{#if col.popover.open}
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
      <input class="sv-color__native" type="color" value={col.normalized} oninput={(e) => col.pick((e.currentTarget as HTMLInputElement).value)} aria-label="Color picker" />
      <input
        class="sv-color__field"
        type="text"
        bind:value={col.hexDraft}
        spellcheck="false"
        aria-label="Hex value"
        onblur={col.commitHex}
        onkeydown={(e) => { if (e.key === 'Enter') col.commitHex() }}
      />
    </div>
    <div class="sv-color__palette">
      {#each col.palette as c (c)}
        <button
          class="sv-color__chip"
          class:is-active={col.isActive(c)}
          style:background={c}
          {...col.chipProps(c)}
        ></button>
      {/each}
    </div>
  </div>
{/if}
{#if name}<input type="hidden" {name} value={col.normalized} />{/if}

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
