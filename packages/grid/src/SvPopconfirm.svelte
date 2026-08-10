<script lang="ts">
  /**
   * SvPopconfirm - a lightweight confirm step in a popover anchored to its
   * trigger, for a low-stakes destructive action ("Delete this row?") where a
   * full modal dialog would be too heavy. Click the anchor to reveal a short
   * message plus Cancel / Confirm buttons; confirming runs `onConfirm` and closes.
   * Built on SvPopover, so it is portalled, positioned by the shared engine, and
   * dismisses on Escape / outside-click.
   *
   * ```svelte
   * <SvPopconfirm title="Delete this row?" confirmVariant="danger"
   *               onConfirm={() => remove(row)}>
   *   {#snippet anchor()}<SvButton variant="danger" size="sm">Delete</SvButton>{/snippet}
   * </SvPopconfirm>
   * ```
   */
  import type { Snippet } from 'svelte'
  import SvPopover from './SvPopover.svelte'
  import SvButton from './SvButton.svelte'
  import type { Placement } from './positioning'

  type Props = {
    /** Controlled open state (bindable). */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Bold prompt, e.g. "Delete this row?". */
    title?: string
    /** Optional longer explanation under the title. */
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Variant for the confirm button (use `danger` for destructive actions). */
    confirmVariant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    /** Runs when the user confirms; the popover then closes. */
    onConfirm?: () => void
    /** Runs when the user cancels (or dismisses); the popover then closes. */
    onCancel?: () => void
    /** Preferred placement; flips when there is no room. Default `top`. */
    placement?: Placement
    ariaLabel?: string
    /** The trigger that opens the confirm. */
    anchor?: Snippet
  }

  let {
    open = $bindable(false),
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'primary',
    onConfirm,
    onCancel,
    placement = 'top',
    ariaLabel,
    anchor,
  }: Props = $props()

  function confirm() { onConfirm?.(); open = false }
  function cancel() { onCancel?.(); open = false }
</script>

<SvPopover bind:open {onOpenChange} trigger="click" {placement} minWidth={230} ariaLabel={ariaLabel ?? title} {anchor}>
  <div class="sv-popconfirm">
    {#if title}<div class="sv-popconfirm__title">{title}</div>{/if}
    {#if description}<div class="sv-popconfirm__desc">{description}</div>{/if}
    <div class="sv-popconfirm__actions">
      <SvButton size="sm" variant="ghost" onclick={cancel}>{cancelLabel}</SvButton>
      <SvButton size="sm" variant={confirmVariant} onclick={confirm}>{confirmLabel}</SvButton>
    </div>
  </div>
</SvPopover>

<style>
  .sv-popconfirm__title { font-weight: 650; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .sv-popconfirm__desc { margin-top: 4px; font-size: 12.5px; color: var(--sg-muted, #64748b); line-height: 1.45; }
  .sv-popconfirm__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
</style>
