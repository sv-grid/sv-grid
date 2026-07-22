<script lang="ts">
  /**
   * SvToaster - renders the shared toast queue (see `toast-store`). Mount ONCE
   * near the app root; call `toast()` from anywhere to push notifications. The
   * container is an `aria-live` region as a visual backstop, though each toast
   * is also announced through the shared live region by the store.
   *
   * ```svelte
   * <SvToaster position="bottom-right" />
   * ```
   */
  import { portalToBody } from './popover'
  import { toastStore, dismissToast, pauseToast, resumeToast, type Toast } from './toast-store.svelte'

  type Position =
    | 'top-left' | 'top-center' | 'top-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right'

  type Props = {
    /** Corner/edge the stack anchors to. Default 'bottom-right'. */
    position?: Position
    /** Max toasts shown at once (older ones stay queued in the store). */
    max?: number
  }

  let { position = 'bottom-right', max = 5 }: Props = $props()

  const visible = $derived(toastStore.toasts.slice(-max))
  const icon = (v: Toast['variant']) =>
    v === 'success' ? '✓' : v === 'error' ? '✕' : v === 'warning' ? '⚠' : 'ℹ'

  // Swipe-to-dismiss: drag a toast sideways past ~60px to dismiss it.
  let drag = $state<{ id: number; startX: number; dx: number } | null>(null)
  function onDown(e: PointerEvent, id: number) {
    drag = { id, startX: e.clientX, dx: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    pauseToast(id)
  }
  function onMove(e: PointerEvent) {
    if (drag) drag = { ...drag, dx: e.clientX - drag.startX }
  }
  function onUp(id: number) {
    if (!drag || drag.id !== id) return
    const dx = drag.dx
    drag = null
    if (Math.abs(dx) > 60) dismissToast(id)
    else resumeToast(id)
  }
  const dragDx = (id: number) => (drag?.id === id ? drag.dx : 0)
</script>

<div class="sv-toaster sv-toaster--{position}" use:portalToBody role="region" aria-label="Notifications">
  {#each visible as t (t.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sv-toast sv-toast--{t.variant}"
      class:is-dragging={drag?.id === t.id}
      role={t.variant === 'error' || t.variant === 'warning' ? 'alert' : 'status'}
      style:transform={dragDx(t.id) ? `translateX(${dragDx(t.id)}px)` : undefined}
      style:opacity={dragDx(t.id) ? 1 - Math.min(Math.abs(dragDx(t.id)) / 160, 0.7) : undefined}
      onmouseenter={() => pauseToast(t.id)}
      onmouseleave={() => resumeToast(t.id)}
      onfocusin={() => pauseToast(t.id)}
      onfocusout={() => resumeToast(t.id)}
      onpointerdown={(e) => onDown(e, t.id)}
      onpointermove={onMove}
      onpointerup={() => onUp(t.id)}
      onpointercancel={() => onUp(t.id)}
    >
      <span class="sv-toast__icon" aria-hidden="true">{icon(t.variant)}</span>
      <div class="sv-toast__content">
        {#if t.title}<div class="sv-toast__title">{t.title}</div>{/if}
        <div class="sv-toast__msg">{t.message}</div>
      </div>
      {#if t.dismissible}
        <button type="button" class="sv-toast__x" aria-label="Dismiss" onclick={() => dismissToast(t.id)}>&times;</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  :global(.sv-toaster) {
    position: fixed; z-index: 2147483001; display: flex; flex-direction: column; gap: 8px;
    padding: 16px; max-width: min(92vw, 380px); pointer-events: none;
  }
  :global(.sv-toaster--top-left) { top: 0; left: 0; }
  :global(.sv-toaster--top-center) { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
  :global(.sv-toaster--top-right) { top: 0; right: 0; }
  :global(.sv-toaster--bottom-left) { bottom: 0; left: 0; flex-direction: column-reverse; }
  :global(.sv-toaster--bottom-center) { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
  :global(.sv-toaster--bottom-right) { bottom: 0; right: 0; flex-direction: column-reverse; }

  :global(.sv-toast) {
    pointer-events: auto;
    display: flex; align-items: flex-start; gap: 10px; width: 100%; box-sizing: border-box;
    padding: 11px 12px; border-radius: 10px; font-size: 13px; line-height: 1.45;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-inline-start: 3px solid var(--_accent, var(--sg-accent, #2563eb));
    box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.4);
    animation: sv-toast-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: transform 0.2s ease, opacity 0.2s ease;
    touch-action: pan-y; /* let vertical scroll through; capture horizontal swipe */
  }
  :global(.sv-toast.is-dragging) { transition: none; cursor: grabbing; user-select: none; }
  @keyframes sv-toast-in { from { opacity: 0; transform: translateY(6px) scale(0.98) } to { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { :global(.sv-toast) { animation: none } }

  :global(.sv-toast--success) { --_accent: var(--sg-success, #16a34a); }
  :global(.sv-toast--error) { --_accent: var(--sg-danger, #dc2626); }
  :global(.sv-toast--warning) { --_accent: var(--sg-warning, #f59e0b); }
  :global(.sv-toast--info) { --_accent: var(--sg-accent, #2563eb); }

  :global(.sv-toast__icon) { flex: none; width: 18px; height: 18px; display: grid; place-items: center; color: var(--_accent); font-weight: 700; }
  :global(.sv-toast__content) { flex: 1; min-width: 0; }
  :global(.sv-toast__title) { font-weight: 650; margin-bottom: 1px; }
  :global(.sv-toast__msg) { color: var(--sg-fg, #0f172a); overflow-wrap: anywhere; }
  :global(.sv-toast__x) {
    flex: none; width: 22px; height: 22px; display: grid; place-items: center; margin: -2px -2px 0 0;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 5px; font-size: 17px; line-height: 1;
  }
  :global(.sv-toast__x:hover) { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
</style>
