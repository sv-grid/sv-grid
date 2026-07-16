<script lang="ts">
  /**
   * SvButton - the base button primitive for the SvGrid UI kit. Variants, sizes,
   * loading + icon slots. Pure `--sg-*` theming. Parity: Smart `smart-button`.
   */
  import type { Snippet } from 'svelte'

  type Props = {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    /** Stretch to the container width. */
    block?: boolean
    href?: string
    ariaLabel?: string
    onclick?: (e: MouseEvent) => void
    children?: Snippet
    /** Leading icon snippet. */
    icon?: Snippet
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    block = false,
    href,
    ariaLabel,
    onclick,
    children,
    icon,
  }: Props = $props()

  const isDisabled = $derived(disabled || loading)
</script>

<svelte:element
  this={href && !isDisabled ? 'a' : 'button'}
  class="sv-btn sv-btn--{variant} sv-btn--{size}"
  class:sv-btn--block={block}
  class:is-loading={loading}
  role={href ? 'button' : undefined}
  href={href && !isDisabled ? href : undefined}
  type={href ? undefined : type}
  disabled={href ? undefined : isDisabled}
  aria-disabled={isDisabled}
  aria-label={ariaLabel}
  aria-busy={loading}
  onclick={(e: MouseEvent) => { if (isDisabled) { e.preventDefault(); return } onclick?.(e) }}
>
  {#if loading}<span class="sv-btn__spinner" aria-hidden="true"></span>{/if}
  {#if icon}<span class="sv-btn__icon">{@render icon()}</span>{/if}
  {#if children}<span class="sv-btn__label">{@render children()}</span>{/if}
</svelte:element>

<style>
  .sv-btn {
    --_accent: var(--sg-accent, #2563eb);
    --_on-accent: var(--sg-on-accent, #fff);
    --_border: var(--sg-border, #cbd5e1);
    --_radius: var(--sg-radius, 8px);
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    font: inherit; font-weight: 600; line-height: 1; white-space: nowrap;
    border: 1px solid transparent; border-radius: var(--_radius); cursor: pointer;
    text-decoration: none; user-select: none; transition: background 0.12s, border-color 0.12s, opacity 0.12s;
  }
  .sv-btn--sm { padding: 5px 10px; font-size: 12px; }
  .sv-btn--md { padding: 8px 14px; font-size: 13px; }
  .sv-btn--lg { padding: 11px 18px; font-size: 15px; }
  .sv-btn--block { width: 100%; }
  .sv-btn[disabled], .sv-btn[aria-disabled='true'] { opacity: 0.55; cursor: not-allowed; }

  .sv-btn--primary { background: var(--_accent); color: var(--_on-accent); }
  .sv-btn--primary:hover:not([disabled]):not([aria-disabled='true']) { background: color-mix(in srgb, var(--_accent) 88%, #000); }
  .sv-btn--secondary { background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a); border-color: var(--_border); }
  .sv-btn--secondary:hover:not([disabled]) { background: var(--sg-row-hover-bg, #e2e8f0); }
  .sv-btn--outline { background: transparent; color: var(--_accent); border-color: var(--_accent); }
  .sv-btn--outline:hover:not([disabled]) { background: color-mix(in srgb, var(--_accent) 10%, transparent); }
  .sv-btn--ghost { background: transparent; color: var(--sg-fg, #0f172a); }
  .sv-btn--ghost:hover:not([disabled]) { background: var(--sg-row-hover-bg, rgba(0,0,0,0.05)); }
  .sv-btn--danger { background: var(--sg-danger, #dc2626); color: #fff; }
  .sv-btn--danger:hover:not([disabled]) { background: color-mix(in srgb, var(--sg-danger, #dc2626) 88%, #000); }

  .sv-btn:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }

  .sv-btn__spinner {
    width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid currentColor; border-top-color: transparent;
    animation: sv-btn-spin 0.6s linear infinite;
  }
  .sv-btn__icon { display: inline-flex; }
  @keyframes sv-btn-spin { to { transform: rotate(360deg); } }
</style>
