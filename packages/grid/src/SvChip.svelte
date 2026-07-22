<script lang="ts">
  /**
   * SvChip - a compact pill for a selected/filter/entity value: an optional
   * leading avatar/icon, a label, and an optional remove (x) button; optionally
   * clickable. Larger + more interactive than SvBadge (a static status pill).
   * Theme-driven. Parity: Smart chip / tag.
   *
   * ```svelte
   * <SvChip removable onRemove={() => drop(tag)}>{tag}</SvChip>
   * <SvChip variant="accent" onClick={select}>{#snippet leading()}<SvAvatar size="sm" name="Ada" />{/snippet}Ada</SvChip>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Variant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

  type Props = {
    variant?: Variant
    size?: 'sm' | 'md'
    /** Show a remove (x) button. */
    removable?: boolean
    onRemove?: () => void
    /** Make the chip's label a button. */
    onClick?: () => void
    /** Filled solid vs soft tint (default soft). */
    solid?: boolean
    disabled?: boolean
    children?: Snippet
    /** Leading content (avatar / icon). */
    leading?: Snippet
  }

  let {
    variant = 'neutral',
    size = 'md',
    removable = false,
    onRemove,
    onClick,
    solid = false,
    disabled = false,
    children,
    leading,
  }: Props = $props()
</script>

<span class="sv-chip sv-chip--{variant} sv-chip--{size}" class:is-solid={solid} class:is-disabled={disabled}>
  {#if leading}<span class="sv-chip__lead">{@render leading()}</span>{/if}
  {#if onClick}
    <button type="button" class="sv-chip__label sv-chip__label--btn" {disabled} onclick={onClick}>{@render children?.()}</button>
  {:else}
    <span class="sv-chip__label">{@render children?.()}</span>
  {/if}
  {#if removable}
    <button type="button" class="sv-chip__x" aria-label="Remove" {disabled} onclick={onRemove}>&times;</button>
  {/if}
</span>

<style>
  .sv-chip {
    --_c: var(--sg-muted, #64748b);
    display: inline-flex; align-items: center; gap: 5px; box-sizing: border-box;
    border-radius: 999px; font-weight: 550; white-space: nowrap; max-width: 100%;
    color: var(--_c);
    background: color-mix(in srgb, var(--_c) 13%, transparent);
    border: 1px solid color-mix(in srgb, var(--_c) 22%, transparent);
  }
  .sv-chip.is-solid { color: var(--sg-on-accent, #fff); background: var(--_c); border-color: var(--_c); }
  .sv-chip.is-disabled { opacity: 0.55; pointer-events: none; }
  .sv-chip--sm { font-size: 11.5px; padding: 1px 4px 1px 8px; height: 22px; }
  .sv-chip--md { font-size: 12.5px; padding: 2px 5px 2px 10px; height: 26px; }
  .sv-chip:not(:has(.sv-chip__x)).sv-chip--sm { padding-inline-end: 8px; }
  .sv-chip:not(:has(.sv-chip__x)).sv-chip--md { padding-inline-end: 10px; }
  .sv-chip__lead { display: inline-flex; margin-inline-start: -4px; }
  .sv-chip__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .sv-chip__label--btn { background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; }
  .sv-chip__x {
    flex: none; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%;
    background: none; border: 0; color: currentColor; cursor: pointer; font-size: 14px; line-height: 1; opacity: 0.7;
  }
  .sv-chip__x:hover { opacity: 1; background: color-mix(in srgb, currentColor 20%, transparent); }

  .sv-chip--neutral { --_c: var(--sg-muted, #64748b); }
  .sv-chip--accent { --_c: var(--sg-accent, #2563eb); }
  .sv-chip--success { --_c: var(--sg-success, #16a34a); }
  .sv-chip--warning { --_c: var(--sg-warning, #d97706); }
  .sv-chip--danger { --_c: var(--sg-danger, #dc2626); }
  .sv-chip--info { --_c: var(--sg-info, #0891b2); }
</style>
