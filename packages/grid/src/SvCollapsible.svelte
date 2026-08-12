<script lang="ts">
  /**
   * SvCollapsible - a single show/hide region with an accessible trigger (the
   * standalone form of one accordion item). The header toggles the panel with a
   * rotating chevron; the panel animates its height open/closed and respects
   * `prefers-reduced-motion`.
   *
   * ```svelte
   * <SvCollapsible title="Advanced options" bind:open>
   *   ...content...
   * </SvCollapsible>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { nextEditorId } from './editor-contract'

  type Props = {
    /** Header text (ignored when a `header` snippet is given). */
    title?: string
    /** Open state (bindable). */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    disabled?: boolean
    /** Custom header content (replaces `title`). */
    header?: Snippet
    children?: Snippet
  }

  let { title, open = $bindable(false), onOpenChange, disabled = false, header, children }: Props = $props()

  const uid = nextEditorId('sv-collapse')
  function toggle() {
    if (disabled) return
    open = !open
    onOpenChange?.(open)
  }
</script>

<div class="sv-collapse" class:is-open={open} class:is-disabled={disabled}>
  <button
    class="sv-collapse__trigger"
    type="button"
    {disabled}
    aria-expanded={open}
    aria-controls={`${uid}-panel`}
    id={`${uid}-trigger`}
    onclick={toggle}
  >
    <span class="sv-collapse__label">{#if header}{@render header()}{:else}{title}{/if}</span>
    <svg class="sv-collapse__chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
  </button>
  <div class="sv-collapse__region" id={`${uid}-panel`} role="region" aria-labelledby={`${uid}-trigger`} inert={!open}>
    <div class="sv-collapse__content">{@render children?.()}</div>
  </div>
</div>

<style>
  .sv-collapse { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-bg, #fff); }
  .sv-collapse__trigger {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; box-sizing: border-box;
    padding: 11px 14px; background: none; border: 0; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 600;
    color: var(--sg-fg, #0f172a); text-align: start;
  }
  .sv-collapse__trigger:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f1f5f9); border-radius: 10px; }
  .sv-collapse__trigger:disabled { opacity: 0.55; cursor: not-allowed; }
  .sv-collapse__trigger:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px; border-radius: 10px; }
  .sv-collapse__label { min-width: 0; }
  .sv-collapse__chev { flex: none; color: var(--sg-muted, #64748b); transition: transform 0.16s ease; }
  .sv-collapse.is-open .sv-collapse__chev { transform: rotate(180deg); }
  .sv-collapse__region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.18s ease; }
  .sv-collapse.is-open .sv-collapse__region { grid-template-rows: 1fr; }
  .sv-collapse__content { overflow: hidden; padding: 0 14px; min-height: 0; }
  .sv-collapse.is-open .sv-collapse__content { padding-bottom: 13px; }
  @media (prefers-reduced-motion: reduce) { .sv-collapse__region, .sv-collapse__chev { transition: none; } }
</style>
