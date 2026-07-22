<script lang="ts">
  /**
   * SvEmptyState - a centered placeholder for empty lists, no-results, and blank
   * screens: an icon/illustration, a title, a description, and an action slot.
   * Theme-driven. Parity: Smart empty / no-data states.
   *
   * ```svelte
   * <SvEmptyState title="No orders yet" description="Create your first order to get going.">
   *   <SvButton>New order</SvButton>
   * </SvEmptyState>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    title?: string
    description?: string
    /** Tighter padding (for empty dropdowns / small panels). */
    compact?: boolean
    /** Custom icon / illustration (overrides the default). */
    icon?: Snippet
    /** Action buttons / links. */
    children?: Snippet
  }

  let { title, description, compact = false, icon, children }: Props = $props()
</script>

<div class="sv-empty" class:is-compact={compact}>
  <div class="sv-empty__icon" aria-hidden="true">
    {#if icon}
      {@render icon()}
    {:else}
      <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="8" y="12" width="32" height="26" rx="3" /><path d="M8 20h32" /><path d="M16 28h10" />
      </svg>
    {/if}
  </div>
  {#if title}<div class="sv-empty__title">{title}</div>{/if}
  {#if description}<p class="sv-empty__desc">{description}</p>{/if}
  {#if children}<div class="sv-empty__actions">{@render children()}</div>{/if}
</div>

<style>
  .sv-empty {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 6px; padding: 44px 24px; color: var(--sg-fg, #0f172a);
  }
  .sv-empty.is-compact { padding: 22px 16px; }
  .sv-empty__icon {
    color: var(--sg-muted, #94a3b8); margin-bottom: 4px;
    display: grid; place-items: center; width: 66px; height: 66px; border-radius: 16px;
    background: var(--sg-row-hover-bg, #f1f5f9);
  }
  .sv-empty.is-compact .sv-empty__icon { width: 48px; height: 48px; }
  .sv-empty__title { font-size: 15px; font-weight: 650; }
  .sv-empty__desc { margin: 0; max-width: 42ch; color: var(--sg-muted, #64748b); font-size: 13px; line-height: 1.55; }
  .sv-empty__actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
