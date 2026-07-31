/**
 * createTooltip - the HEADLESS core behind <SvTooltip>: the hover/focus open
 * state machine with a show delay, Escape-to-hide, and the `aria-describedby` /
 * `role="tooltip"` wiring - as prop-getters you spread onto your own anchor and
 * tooltip elements. No styles, no positioning (that is a DOM concern the renderer
 * owns), like `createListbox`.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createTooltip } from '@svgrid/grid'
 *   const tip = createTooltip({ text: () => label })
 * </script>
 * <span {...tip.anchorProps()}>{@render children?.()}</span>
 * {#if tip.open}
 *   <div {...tip.tooltipProps()}>{label}</div>
 * {/if}
 * ```
 */
import { nextEditorId } from './editor-contract'

export type TooltipConfig = {
  /** The tooltip text; the tooltip never opens when it is empty. */
  text?: () => string | undefined
  /** Suppress the tooltip entirely. */
  disabled?: () => boolean
  /** Show delay in ms after hover/focus. Default 300. */
  delay?: () => number
}

export type TooltipAnchorProps = {
  'aria-describedby': string | undefined
  onpointerenter: () => void
  onpointerleave: () => void
  onfocusin: () => void
  onfocusout: () => void
}

export type TooltipProps = {
  id: string
  role: 'tooltip'
}

export function createTooltip(config: TooltipConfig = {}) {
  const id = nextEditorId('sv-tip')
  let open = $state(false)
  let showTimer: ReturnType<typeof setTimeout> | undefined

  function show() {
    if ((config.disabled?.() ?? false) || !(config.text?.() ?? '')) return
    clearTimeout(showTimer)
    showTimer = setTimeout(() => { open = true }, config.delay?.() ?? 300)
  }
  function hide() {
    clearTimeout(showTimer)
    open = false
  }

  // Escape hides the tooltip while it is open (WAI-ARIA tooltip pattern).
  $effect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return {
    get open() { return open },
    /** Stable id of the tooltip element (for `aria-describedby` + the tip's id). */
    tipId: id,
    show,
    hide,
    /** Spread onto the anchor/trigger wrapper. Also mirror `tipId` onto the real
     *  focusable child's `aria-describedby` so AT announces it on focus. */
    anchorProps: (): TooltipAnchorProps => ({
      'aria-describedby': open ? id : undefined,
      onpointerenter: show,
      onpointerleave: hide,
      onfocusin: show,
      onfocusout: hide,
    }),
    /** Spread onto the tooltip element. */
    tooltipProps: (): TooltipProps => ({ id, role: 'tooltip' }),
  }
}

export type Tooltip = ReturnType<typeof createTooltip>
