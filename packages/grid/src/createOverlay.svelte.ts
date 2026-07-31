/**
 * createOverlay - the HEADLESS core behind the dialog-type overlays (<SvModal>,
 * <SvDrawer>): the open -> (focus-trap + scroll-lock + Escape/backdrop dismissal)
 * -> restore lifecycle, wired to the shared a11y primitives so nested overlays
 * close top-first via the layer stack. Owns no markup and no styles - the
 * component renders the backdrop/panel and spreads `dialogProps()` for the ARIA.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createOverlay } from '@svgrid/grid'
 *   let dialogEl = $state<HTMLElement | null>(null)
 *   const overlay = createOverlay({
 *     open: () => open,
 *     getDialog: () => dialogEl,
 *     onClose: () => (open = false),
 *   })
 * </script>
 * {#if open}
 *   <div class="backdrop">
 *     <div bind:this={dialogEl} {...overlay.dialogProps({ labelledBy: titleId })}>…</div>
 *   </div>
 * {/if}
 * ```
 */
import { createFocusTrap } from './a11y/focus-trap'
import { lockScroll } from './a11y/scroll-lock'
import { createDismissableLayer } from './a11y/dismissable'

export type OverlayConfig = {
  /** Whether the overlay is currently open. */
  open: () => boolean
  /** The dialog panel element (component owns `bind:this`, passes a getter). */
  getDialog: () => HTMLElement | null
  /** Close the overlay (set your `open` state false + notify). */
  onClose: () => void
  /** Allow Escape to close. Default true. */
  closeOnEsc?: () => boolean
  /** Allow an outside/backdrop click to close. Default true. */
  closeOnBackdrop?: () => boolean
  /** Run once each time the overlay opens - reset transient state (drag, resize,
   *  swipe offset) before the trap/lock/layer are wired. */
  onOpen?: () => void
  /** Trap focus inside the dialog while open. Default true. */
  trapFocus?: () => boolean
  /** Lock body scroll while open. Default true. */
  scrollLock?: () => boolean
  /** Element to focus first when the dialog opens (e.g. a search input).
   *  Defaults to the trap's first focusable. */
  initialFocus?: () => HTMLElement | null
}

export type DialogProps = {
  role: 'dialog'
  'aria-modal': 'true'
  'aria-labelledby': string | undefined
  'aria-label': string | undefined
  tabindex: -1
}

export function createOverlay(config: OverlayConfig) {
  // While open: reset transient state, then hand focus, scroll-lock and
  // Escape/backdrop dismissal to the shared primitives (one tested
  // implementation; nested overlays close top-first via the layer stack).
  $effect(() => {
    if (!config.open() || !config.getDialog()) return
    config.onOpen?.()
    const el = config.getDialog()!
    const trap = (config.trapFocus?.() ?? true)
      ? createFocusTrap(el, config.initialFocus ? { initialFocus: config.initialFocus } : undefined)
      : null
    trap?.activate()
    const unlockScroll = (config.scrollLock?.() ?? true) ? lockScroll() : null
    const layer = createDismissableLayer({
      element: () => config.getDialog(),
      onDismiss: (reason) => {
        const allow = reason === 'escape' ? (config.closeOnEsc?.() ?? true) : (config.closeOnBackdrop?.() ?? true)
        if (allow) config.onClose()
      },
    })
    layer.activate()
    return () => {
      layer.release()
      unlockScroll?.()
      trap?.release()
    }
  })

  return {
    /** Spread onto the dialog panel element. Pass `labelledBy` (an id, when there
     *  is a visible title) or `label` (an accessible name when there isn't). */
    dialogProps: (opts?: { labelledBy?: string; label?: string }): DialogProps => ({
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': opts?.labelledBy,
      'aria-label': opts?.label,
      tabindex: -1,
    }),
  }
}

export type Overlay = ReturnType<typeof createOverlay>
