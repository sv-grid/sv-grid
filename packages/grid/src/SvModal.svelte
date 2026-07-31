<script lang="ts">
  /**
   * SvModal - an accessible modal dialog: backdrop, focus trap, Escape / backdrop
   * close, and a scale-in animation. Optionally draggable (by its header) and
   * resizable (bottom-right handle). Parity: Smart `smart-window` (modal mode).
   * Portalled to <body> so it overlays everything. Controlled via `open`.
   *
   * ```svelte
   * <SvModal bind:open title="Edit row" draggable resizable>
   *   <p>Body</p>
   *   {#snippet footer()}<button onclick={() => open = false}>Close</button>{/snippet}
   * </SvModal>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { portalToBody } from './popover'
  import { nextEditorId } from './editor-contract'
  import { createOverlay } from './createOverlay.svelte'

  type Props = {
    open?: boolean
    onClose?: () => void
    title?: string
    size?: 'sm' | 'md' | 'lg'
    draggable?: boolean
    resizable?: boolean
    closeOnBackdrop?: boolean
    closeOnEsc?: boolean
    /** Hide the header close (x) button. */
    hideClose?: boolean
    children?: Snippet
    footer?: Snippet
  }

  let {
    open = $bindable(false),
    onClose,
    title,
    size = 'md',
    draggable = false,
    resizable = false,
    closeOnBackdrop = true,
    closeOnEsc = true,
    hideClose = false,
    children,
    footer,
  }: Props = $props()

  const titleId = nextEditorId('sv-modal-title')
  let dialogEl = $state<HTMLDivElement | null>(null)
  let drag = $state({ x: 0, y: 0 })
  let box = $state<{ w: number; h: number } | null>(null)

  function close() { open = false; onClose?.() }

  // Focus trap + scroll lock + Escape/backdrop dismissal come from the shared
  // headless overlay core; this component resets its transient drag/resize on
  // open and renders the panel. See createOverlay.svelte.ts.
  const overlay = createOverlay({
    open: () => open,
    getDialog: () => dialogEl,
    onClose: close,
    closeOnEsc: () => closeOnEsc,
    closeOnBackdrop: () => closeOnBackdrop,
    onOpen: () => { drag = { x: 0, y: 0 }; box = null },
  })

  // --- Drag (header) ---------------------------------------------------------
  let dragging = false
  let dragStart = { x: 0, y: 0, ox: 0, oy: 0 }
  function onHeaderDown(e: PointerEvent) {
    if (!draggable || (e.target as HTMLElement).closest('.sv-modal__x')) return
    dragging = true
    dragStart = { x: e.clientX, y: e.clientY, ox: drag.x, oy: drag.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onHeaderMove(e: PointerEvent) {
    if (!dragging) return
    drag = { x: dragStart.ox + (e.clientX - dragStart.x), y: dragStart.oy + (e.clientY - dragStart.y) }
  }
  function onHeaderUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  // --- Resize (bottom-right handle) ------------------------------------------
  let resizing = false
  let resizeStart = { x: 0, y: 0, w: 0, h: 0 }
  function onResizeDown(e: PointerEvent) {
    if (!resizable || !dialogEl) return
    e.stopPropagation()
    resizing = true
    const r = dialogEl.getBoundingClientRect()
    resizeStart = { x: e.clientX, y: e.clientY, w: r.width, h: r.height }
    box = { w: r.width, h: r.height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onResizeMove(e: PointerEvent) {
    if (!resizing) return
    box = {
      w: Math.max(240, resizeStart.w + (e.clientX - resizeStart.x)),
      h: Math.max(160, resizeStart.h + (e.clientY - resizeStart.y)),
    }
  }
  function onResizeUp(e: PointerEvent) {
    if (!resizing) return
    resizing = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }
</script>

{#if open}
  <div class="sv-modal__backdrop" use:portalToBody>
    <div
      bind:this={dialogEl}
      class="sv-modal sv-modal--{size}"
      class:is-resized={!!box}
      {...overlay.dialogProps({ labelledBy: title ? titleId : undefined })}
      style:transform={`translate(calc(-50% + ${drag.x}px), calc(-50% + ${drag.y}px))`}
      style:width={box ? `${box.w}px` : undefined}
      style:height={box ? `${box.h}px` : undefined}
    >
      {#if title || !hideClose}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="sv-modal__header"
          class:is-draggable={draggable}
          onpointerdown={onHeaderDown}
          onpointermove={onHeaderMove}
          onpointerup={onHeaderUp}
          onpointercancel={onHeaderUp}
        >
          <h2 class="sv-modal__title" id={titleId}>{title ?? ''}</h2>
          {#if !hideClose}
            <button type="button" class="sv-modal__x" aria-label="Close" onclick={close}>&times;</button>
          {/if}
        </div>
      {/if}
      <div class="sv-modal__body">{@render children?.()}</div>
      {#if footer}<div class="sv-modal__footer">{@render footer()}</div>{/if}
      {#if resizable}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="sv-modal__resize"
          aria-hidden="true"
          onpointerdown={onResizeDown}
          onpointermove={onResizeMove}
          onpointerup={onResizeUp}
          onpointercancel={onResizeUp}
        ></div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(.sv-modal__backdrop) {
    position: fixed; inset: 0; z-index: 2147483000;
    background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(1.5px);
    animation: sv-modal-fade 0.16s ease both;
  }
  @keyframes sv-modal-fade { from { opacity: 0 } to { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { :global(.sv-modal__backdrop) { animation: none } }

  :global(.sv-modal) {
    position: fixed; top: 50%; left: 50%;
    display: flex; flex-direction: column; max-width: 94vw; max-height: 88vh; min-width: 240px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; overflow: hidden;
    box-shadow: 0 24px 64px -16px rgba(15, 23, 42, 0.5);
    animation: sv-modal-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes sv-modal-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.94) } to { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { :global(.sv-modal) { animation: none } }
  :global(.sv-modal--sm) { width: 360px; }
  :global(.sv-modal--md) { width: 520px; }
  :global(.sv-modal--lg) { width: 720px; }
  :global(.sv-modal.is-resized) { max-width: none; max-height: none; }

  :global(.sv-modal__header) {
    display: flex; align-items: center; gap: 12px; padding: 13px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  :global(.sv-modal__header.is-draggable) { cursor: move; touch-action: none; user-select: none; }
  :global(.sv-modal__title) { flex: 1; margin: 0; font-size: 15px; font-weight: 650; }
  :global(.sv-modal__x) {
    flex: none; width: 28px; height: 28px; display: grid; place-items: center;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 6px; font-size: 20px; line-height: 1;
  }
  :global(.sv-modal__x:hover) { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  :global(.sv-modal__body) { padding: 16px; overflow: auto; flex: 1; font-size: 13.5px; line-height: 1.6; }
  :global(.sv-modal__footer) {
    display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  :global(.sv-modal__resize) {
    position: absolute; inset-inline-end: 0; bottom: 0; width: 16px; height: 16px;
    cursor: nwse-resize; touch-action: none;
    background: linear-gradient(135deg, transparent 50%, var(--sg-muted, #94a3b8) 50%, var(--sg-muted, #94a3b8) 60%, transparent 60%, transparent 72%, var(--sg-muted, #94a3b8) 72%, var(--sg-muted, #94a3b8) 82%, transparent 82%);
    opacity: 0.6;
  }
</style>
