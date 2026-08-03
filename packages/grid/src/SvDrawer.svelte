<script lang="ts">
  /**
   * SvDrawer - an edge-anchored side sheet (right / left / top / bottom): a
   * backdrop, a sliding panel, and the full dialog a11y contract. Built entirely
   * on the shared primitives - `createFocusTrap`, `lockScroll` and
   * `createDismissableLayer` - so its focus, scroll-lock and Escape/backdrop
   * behaviour is identical to SvModal and nested overlays close top-first.
   * Portalled to <body>. Controlled via `open`.
   *
   * ```svelte
   * <SvDrawer bind:open side="right" title="Filters">
   *   <p>Body</p>
   *   {#snippet footer()}<button onclick={() => open = false}>Apply</button>{/snippet}
   * </SvDrawer>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { untrack } from 'svelte'
  import { portalToBody } from './popover'
  import { nextEditorId } from './editor-contract'
  import { createOverlay } from './createOverlay.svelte'

  /** Edge the drawer slides from. Kept in sync with the `DrawerSide` export in
   *  index.ts (a bare type-only module script trips the Svelte/Vite parser). */
  type DrawerSide = 'right' | 'left' | 'top' | 'bottom'

  type Props = {
    open?: boolean
    onClose?: () => void
    /** Edge the drawer slides from. Default 'right'. */
    side?: DrawerSide
    /** Panel size along its axis (width for left/right, height for top/bottom).
     *  Any CSS length; defaults to a sensible per-axis value. */
    size?: string
    title?: string
    closeOnBackdrop?: boolean
    closeOnEsc?: boolean
    /** Hide the header close (x) button. */
    hideClose?: boolean
    /** Render as a mobile bottom-sheet: bottom-anchored, rounded top, a grab
     *  handle, and swipe-down-to-close. Overrides `side`. */
    sheet?: boolean
    /** Accessible name when there is no visible `title`. */
    ariaLabel?: string
    /** Fired after the close (exit) animation has finished and the drawer has
     *  left the DOM. Use it to clear the data the drawer was showing so the
     *  content stays put while it slides out. */
    onClosed?: () => void
    children?: Snippet
    footer?: Snippet
  }

  let {
    open = $bindable(false),
    onClose,
    side = 'right',
    size,
    title,
    closeOnBackdrop = true,
    closeOnEsc = true,
    hideClose = false,
    sheet = false,
    ariaLabel,
    onClosed,
    children,
    footer,
  }: Props = $props()

  const titleId = nextEditorId('sv-drawer-title')
  let dialogEl = $state<HTMLDivElement | null>(null)

  // A sheet is a bottom drawer with mobile affordances.
  const effectiveSide = $derived<DrawerSide>(sheet ? 'bottom' : side)
  const horizontal = $derived(effectiveSide === 'left' || effectiveSide === 'right')
  const sizeVar = $derived(size ?? (horizontal ? 'min(400px, 92vw)' : 'min(360px, 85vh)'))

  function close() { open = false; onClose?.() }

  // Enter/exit animation via CSS @keyframes (the pattern SvModal uses - keyframes
  // play on a `use:portalToBody` element; the Svelte `transition:` directive does
  // NOT). `show` keeps the panel mounted; the enter keyframe fires on mount, and
  // on close we add `is-leaving` (exit keyframe) and unmount + fire `onClosed`
  // after the duration. Honors reduced-motion by dropping the hold to 0ms.
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const EXIT_MS = 260
  let show = $state(false)
  let leaving = $state(false)
  let leaveTimer: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    if (open) {
      clearTimeout(leaveTimer)
      leaving = false
      show = true
      return
    }
    // Only run the leave sequence if the drawer was actually shown (skips the
    // initial closed mount, which must not fire onClosed).
    if (untrack(() => show)) {
      leaving = true
      leaveTimer = setTimeout(() => { show = false; leaving = false; onClosed?.() }, reduceMotion ? 0 : EXIT_MS)
    }
  })

  // Swipe-down-to-close for the sheet grab handle.
  let dragY = $state(0)
  let dragging = $state(false)
  let dragStartY = 0
  function onGrabDown(e: PointerEvent) {
    dragging = true
    dragStartY = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onGrabMove(e: PointerEvent) {
    if (!dragging) return
    dragY = Math.max(0, e.clientY - dragStartY)
  }
  function onGrabUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (dragY > 80) close()
    else dragY = 0
  }

  // Focus trap + scroll lock + Escape/backdrop dismissal come from the shared
  // headless overlay core - one tested implementation across every dialog-like
  // overlay, and nested overlays close top-first. See createOverlay.svelte.ts.
  const overlay = createOverlay({
    open: () => open,
    getDialog: () => dialogEl,
    onClose: close,
    closeOnEsc: () => closeOnEsc,
    closeOnBackdrop: () => closeOnBackdrop,
    onOpen: () => { dragY = 0 },
  })
</script>

{#if show}
  <div class="sv-drawer__backdrop" class:is-leaving={leaving} use:portalToBody>
    <div
      bind:this={dialogEl}
      class="sv-drawer sv-drawer--{effectiveSide}"
      class:is-leaving={leaving}
      class:is-sheet={sheet}
      class:is-dragging={dragging}
      {...overlay.dialogProps({ labelledBy: title ? titleId : undefined, label: !title ? ariaLabel : undefined })}
      style:--sv-drawer-size={sizeVar}
      style:transform={sheet && dragY ? `translateY(${dragY}px)` : undefined}
    >
      {#if sheet}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="sv-drawer__grab"
          aria-hidden="true"
          onpointerdown={onGrabDown}
          onpointermove={onGrabMove}
          onpointerup={onGrabUp}
          onpointercancel={onGrabUp}
        ><span></span></div>
      {/if}
      {#if title || !hideClose}
        <div class="sv-drawer__header">
          <h2 class="sv-drawer__title" id={titleId}>{title ?? ''}</h2>
          {#if !hideClose}
            <button type="button" class="sv-drawer__x" aria-label="Close" onclick={close}>&times;</button>
          {/if}
        </div>
      {/if}
      <div class="sv-drawer__body">{@render children?.()}</div>
      {#if footer}<div class="sv-drawer__footer">{@render footer()}</div>{/if}
    </div>
  </div>
{/if}

<style>
  :global(.sv-drawer__backdrop) {
    position: fixed; inset: 0; z-index: 2147483000;
    background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(1.5px);
    animation: sv-drawer-bd-in 0.2s ease backwards;
  }
  :global(.sv-drawer__backdrop.is-leaving) { animation: sv-drawer-bd-out 0.2s ease forwards; }
  @keyframes sv-drawer-bd-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes sv-drawer-bd-out { from { opacity: 1 } to { opacity: 0 } }

  :global(.sv-drawer) {
    position: fixed;
    display: flex; flex-direction: column;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    box-shadow: 0 24px 64px -16px rgba(15, 23, 42, 0.5);
    overflow: hidden;
    /* Slide in on mount; `backwards` fill shows the off-screen start frame with no
       flash, and does NOT hold the end frame - so the sheet drag transform wins. */
    animation: sv-drawer-in 0.26s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  /* Exit keyframe; `forwards` fill holds the off-screen frame until we unmount. */
  :global(.sv-drawer.is-leaving) { animation: sv-drawer-out 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  /* Off-screen vector per edge - the enter/exit keyframes read `--sv-off`. `side`
     is a stated physical edge (like SvToaster's position prop), not a text-flow
     "start/end" - so it stays physical left/right regardless of page dir. */
  :global(.sv-drawer--right), :global(.sv-drawer--left) {
    top: 0; bottom: 0; width: var(--sv-drawer-size); max-width: 100vw;
  }
  :global(.sv-drawer--right) { right: 0; border-left: 1px solid var(--sg-border, #e2e8f0); --sv-off: translateX(100%); }
  :global(.sv-drawer--left) { left: 0; border-right: 1px solid var(--sg-border, #e2e8f0); --sv-off: translateX(-100%); }
  /* Top / bottom: full width, fixed height, slide along Y. */
  :global(.sv-drawer--top), :global(.sv-drawer--bottom) {
    left: 0; right: 0; height: var(--sv-drawer-size); max-height: 100vh;
  }
  :global(.sv-drawer--top) { top: 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); --sv-off: translateY(-100%); }
  :global(.sv-drawer--bottom) { bottom: 0; border-top: 1px solid var(--sg-border, #e2e8f0); --sv-off: translateY(100%); }
  @keyframes sv-drawer-in { from { transform: var(--sv-off) } to { transform: none } }
  @keyframes sv-drawer-out { from { transform: none } to { transform: var(--sv-off) } }

  /* Mobile bottom-sheet: centered, fixed width, rounded top, grab handle. Slides
     along Y like a bottom drawer (enter/exit keyframes read --sv-off from --bottom). */
  :global(.sv-drawer.is-sheet) {
    left: 0; right: 0; margin: 0 auto; top: auto;
    width: min(560px, 100vw); height: auto; max-height: 85vh;
    border: 1px solid var(--sg-border, #e2e8f0); border-bottom: 0;
    border-radius: 16px 16px 0 0;
  }
  /* No transition while the user is dragging the grab handle - follow the finger. */
  :global(.sv-drawer.is-dragging) { transition: none; }
  :global(.sv-drawer__grab) {
    flex: none; display: grid; place-items: center; padding: 8px 0 2px; cursor: grab; touch-action: none;
  }
  :global(.sv-drawer__grab span) {
    display: block; width: 40px; height: 4px; border-radius: 999px; background: var(--sg-border, #cbd5e1);
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.sv-drawer__backdrop), :global(.sv-drawer__backdrop.is-leaving),
    :global(.sv-drawer), :global(.sv-drawer.is-leaving) { animation: none; }
  }

  :global(.sv-drawer__header) {
    display: flex; align-items: center; gap: 12px; padding: 13px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  :global(.sv-drawer__title) { flex: 1; margin: 0; font-size: 15px; font-weight: 650; }
  :global(.sv-drawer__x) {
    flex: none; width: 28px; height: 28px; display: grid; place-items: center;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 6px; font-size: 20px; line-height: 1;
  }
  :global(.sv-drawer__x:hover) { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  :global(.sv-drawer__body) { padding: 16px; overflow: auto; flex: 1; font-size: 13.5px; line-height: 1.6; }
  :global(.sv-drawer__footer) {
    display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
  }
</style>
