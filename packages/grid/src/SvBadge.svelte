<script lang="ts">
  /**
   * SvBadge - a small status pill / count label. Themed via `--sg-*` tokens with
   * soft `color-mix` tints so it sits well on light and dark. Parity: Smart badge.
   *
   * ```svelte
   * <SvBadge variant="success">Active</SvBadge>
   * <SvBadge variant="danger" dot /> 3 failed
   * ```
   */
  import type { Snippet } from 'svelte'

  type Variant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

  type Props = {
    variant?: Variant
    size?: 'sm' | 'md'
    /** Rounded-pill shape (default) vs a softer rounded rect. */
    pill?: boolean
    /** Show a leading status dot instead of / before content. */
    dot?: boolean
    children?: Snippet
  }

  let { variant = 'neutral', size = 'md', pill = true, dot = false, children }: Props = $props()
</script>

<span class="sv-badge sv-badge--{variant} sv-badge--{size}" class:is-pill={pill} class:has-dot={dot}>
  {#if dot}<span class="sv-badge__dot" aria-hidden="true"></span>{/if}
  {@render children?.()}
</span>

<style>
  .sv-badge {
    --_c: var(--sg-muted, #64748b);
    display: inline-flex; align-items: center; gap: 5px; box-sizing: border-box;
    font-weight: 600; line-height: 1; white-space: nowrap;
    color: var(--_c);
    background: color-mix(in srgb, var(--_c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--_c) 26%, transparent);
    border-radius: 6px;
  }
  .sv-badge.is-pill { border-radius: 999px; }
  .sv-badge--sm { font-size: 10.5px; padding: 2px 7px; }
  .sv-badge--md { font-size: 12px; padding: 3px 9px; }
  .sv-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--_c); }

  .sv-badge--neutral { --_c: var(--sg-muted, #64748b); }
  .sv-badge--accent { --_c: var(--sg-accent, #2563eb); }
  .sv-badge--success { --_c: var(--sg-success, #16a34a); }
  .sv-badge--warning { --_c: var(--sg-warning, #d97706); }
  .sv-badge--danger { --_c: var(--sg-danger, #dc2626); }
  .sv-badge--info { --_c: var(--sg-info, #0891b2); }
</style>
