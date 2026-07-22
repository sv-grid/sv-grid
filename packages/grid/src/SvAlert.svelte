<script lang="ts">
  /**
   * SvAlert - an inline, persistent contextual message (info / success / warning
   * / danger / neutral) with an icon, optional title, dismiss button and trailing
   * actions. Unlike SvToast (transient, floating), an alert stays in the layout.
   * Theme-driven via `--sg-*` semantic tokens. Parity: Smart alert / message.
   */
  import type { Snippet } from 'svelte'

  type Variant = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

  type Props = {
    variant?: Variant
    title?: string
    /** Show a close (x) button. */
    dismissible?: boolean
    onDismiss?: () => void
    /** Hide the leading status icon. */
    hideIcon?: boolean
    /** Softer, borderless tint vs the default bordered card. */
    soft?: boolean
    children?: Snippet
    /** Trailing action buttons / links. */
    actions?: Snippet
    /** Custom leading icon (overrides the default glyph). */
    icon?: Snippet
  }

  let {
    variant = 'info',
    title,
    dismissible = false,
    onDismiss,
    hideIcon = false,
    soft = false,
    children,
    actions,
    icon,
  }: Props = $props()

  let open = $state(true)
  function dismiss() { open = false; onDismiss?.() }
  const glyph = (v: Variant) =>
    v === 'success' ? '✓' : v === 'warning' ? '⚠' : v === 'danger' ? '✕' : v === 'neutral' ? '•' : 'ℹ'
</script>

{#if open}
  <div
    class="sv-alert sv-alert--{variant}"
    class:is-soft={soft}
    role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
  >
    {#if !hideIcon}
      <span class="sv-alert__icon" aria-hidden="true">{#if icon}{@render icon()}{:else}{glyph(variant)}{/if}</span>
    {/if}
    <div class="sv-alert__body">
      {#if title}<div class="sv-alert__title">{title}</div>{/if}
      {#if children}<div class="sv-alert__msg">{@render children()}</div>{/if}
      {#if actions}<div class="sv-alert__actions">{@render actions()}</div>{/if}
    </div>
    {#if dismissible}
      <button type="button" class="sv-alert__x" aria-label="Dismiss" onclick={dismiss}>&times;</button>
    {/if}
  </div>
{/if}

<style>
  .sv-alert {
    --_c: var(--sg-info, #0891b2);
    display: flex; align-items: flex-start; gap: 10px; box-sizing: border-box;
    padding: 11px 12px; border-radius: 10px; font-size: 13px; line-height: 1.5;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid color-mix(in srgb, var(--_c) 30%, var(--sg-border, #e2e8f0));
    border-inline-start: 3px solid var(--_c);
  }
  .sv-alert.is-soft { border: 0; background: color-mix(in srgb, var(--_c) 12%, transparent); }
  .sv-alert--info { --_c: var(--sg-info, #0891b2); }
  .sv-alert--success { --_c: var(--sg-success, #16a34a); }
  .sv-alert--warning { --_c: var(--sg-warning, #d97706); }
  .sv-alert--danger { --_c: var(--sg-danger, #dc2626); }
  .sv-alert--neutral { --_c: var(--sg-muted, #64748b); }
  .sv-alert__icon { flex: none; width: 18px; height: 18px; display: grid; place-items: center; color: var(--_c); font-weight: 700; }
  .sv-alert__body { flex: 1; min-width: 0; }
  .sv-alert__title { font-weight: 650; margin-bottom: 1px; }
  .sv-alert__msg { color: var(--sg-fg, #0f172a); overflow-wrap: anywhere; }
  .sv-alert__actions { display: flex; gap: 8px; margin-top: 8px; }
  .sv-alert__x {
    flex: none; width: 22px; height: 22px; display: grid; place-items: center; margin: -2px -2px 0 0;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 5px; font-size: 17px; line-height: 1;
  }
  .sv-alert__x:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
</style>
