/**
 * createTooltip - the HEADLESS core behind <SvTooltip>: the hover/focus open
 * state machine with a show delay, an optional close delay, a shared delay-group
 * (so moving between grouped tooltips skips the re-delay), Escape-to-hide, and the
 * `aria-describedby` / `role="tooltip"` wiring - as prop-getters you spread onto
 * your own anchor and tooltip elements. No styles, no positioning (that is a DOM
 * concern the renderer owns), like `createListbox`.
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
  /** Hide delay in ms after leave/blur. Default 0. Give it room for interactive tips. */
  closeDelay?: () => number
  /**
   * Delay-group id. Tooltips sharing a group open INSTANTLY while any group
   * member is open or was open within a short grace window - so scanning a
   * toolbar of icon buttons does not re-wait the show delay each time.
   */
  group?: () => string | undefined
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

/** Grace window (ms) after a group tooltip closes during which the next opens instantly. */
const GROUP_SKIP_WINDOW = 300
type GroupEntry = { openCount: number; lastCloseAt: number }
const groupRegistry = new Map<string, GroupEntry>()
function groupEntry(id: string): GroupEntry {
  let e = groupRegistry.get(id)
  if (!e) { e = { openCount: 0, lastCloseAt: 0 }; groupRegistry.set(id, e) }
  return e
}
const now = () => (typeof Date !== 'undefined' ? Date.now() : 0)

export function createTooltip(config: TooltipConfig = {}) {
  const id = nextEditorId('sv-tip')
  let open = $state(false)
  let showTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let counted = false // whether this instance is currently counted in its group

  function groupId() { return config.group?.() }

  /** Effective show delay: 0 when the group is warm (a member open / just closed). */
  function effectiveDelay(): number {
    const base = config.delay?.() ?? 300
    const g = groupId()
    if (!g) return base
    const e = groupEntry(g)
    if (e.openCount > 0 || now() - e.lastCloseAt < GROUP_SKIP_WINDOW) return 0
    return base
  }

  function markOpen() {
    open = true
    const g = groupId()
    if (g && !counted) { counted = true; groupEntry(g).openCount++ }
  }
  function reallyHide() {
    open = false
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
    const g = groupId()
    if (g && counted) { counted = false; const e = groupEntry(g); e.openCount--; e.lastCloseAt = now() }
  }

  function show() {
    if ((config.disabled?.() ?? false) || !(config.text?.() ?? '')) return
    clearTimeout(hideTimer)
    if (open) return
    clearTimeout(showTimer)
    showTimer = setTimeout(markOpen, effectiveDelay())
  }
  /** Delayed hide (honors `closeDelay`) - used by pointer/focus leave. */
  function scheduleHide() {
    clearTimeout(showTimer)
    const cd = config.closeDelay?.() ?? 0
    if (cd > 0 && open) { clearTimeout(hideTimer); hideTimer = setTimeout(reallyHide, cd) }
    else reallyHide()
  }
  /** Immediate hide - used by Escape and imperative callers. */
  function hide() { reallyHide() }

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
    /** Keep an interactive tip open while the pointer is over it. */
    keepOpen: show,
    /** Delayed hide honoring `closeDelay` (pointer/focus leave). */
    scheduleHide,
    /** Spread onto the anchor/trigger wrapper. Also mirror `tipId` onto the real
     *  focusable child's `aria-describedby` so AT announces it on focus. */
    anchorProps: (): TooltipAnchorProps => ({
      'aria-describedby': open ? id : undefined,
      onpointerenter: show,
      onpointerleave: scheduleHide,
      onfocusin: show,
      onfocusout: scheduleHide,
    }),
    /** Spread onto the tooltip element. */
    tooltipProps: (): TooltipProps => ({ id, role: 'tooltip' }),
  }
}

export type Tooltip = ReturnType<typeof createTooltip>
