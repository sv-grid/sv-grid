/**
 * The view bar's panels open in a layer on <body>, after the bar in the page,
 * so Tab from the button would not reach them. On open a panel takes focus
 * (its first control); on close, if focus was still in it, focus goes back to
 * what had it before (the button that opened it).
 */
const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function panelFocus(node: HTMLElement): { destroy: () => void } {
  const before = document.activeElement as HTMLElement | null
  queueMicrotask(() => {
    if (!node.isConnected || node.contains(document.activeElement)) return
    node.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  })
  return {
    destroy() {
      const active = document.activeElement
      if ((!active || active === document.body || node.contains(active)) && before?.isConnected) before.focus()
    },
  }
}
