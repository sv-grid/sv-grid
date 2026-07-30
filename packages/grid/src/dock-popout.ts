/**
 * dock-popout - open a real browser window and render a dock pane's content
 * inside it (Golden-Layout-style pop-out). Runtime-only: an OS window handle is
 * not serializable, so the manager tracks popped panes separately and pops them
 * back into the layout when the window closes.
 *
 * The popped nodes are created by the main document and adopted into the popup,
 * so they stay driven by the main window's reactivity - the pop-out shows the
 * same live content as the docked view. Stylesheets + `--sg-*` theme tokens are
 * copied across so it looks identical.
 */
import { mount, unmount, type Snippet } from 'svelte'
import DockPopoutHost from './DockPopoutHost.svelte'
import { PANEL_THEME_VARS } from './popover'
import type { DockPane } from './dock-model'

export type Popout = {
  pane: DockPane
  win: Window
  destroy: () => void
}

export type OpenPopoutOptions = {
  pane: DockPane
  paneSnippet: Snippet<[DockPane]>
  /** Element whose resolved `--sg-*` tokens theme the popup. */
  themeSource: HTMLElement
  width?: number
  height?: number
  /** Called (once) when the popup closes, to pop the pane back in. */
  onClose: (paneId: string) => void
}

/** Open a pop-out window for a pane. Returns null if the browser blocked it. */
export function openPopout(opts: OpenPopoutOptions): Popout | null {
  const win = window.open('', '', `width=${opts.width ?? 480},height=${opts.height ?? 360}`)
  if (!win) return null

  const doc = win.document
  doc.title = opts.pane.title

  // Copy every stylesheet so the popped content is styled identically.
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
      const style = doc.createElement('style')
      style.textContent = css
      doc.head.appendChild(style)
    } catch {
      // Cross-origin sheet: re-link it instead of reading its rules.
      if (sheet.href) {
        const link = doc.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        doc.head.appendChild(link)
      }
    }
  }

  // Carry the theme tokens + base look across.
  const cs = getComputedStyle(opts.themeSource)
  for (const v of PANEL_THEME_VARS) {
    const val = cs.getPropertyValue(v).trim()
    if (val) doc.documentElement.style.setProperty(v, val)
  }
  doc.body.style.margin = '0'
  doc.body.style.background = cs.getPropertyValue('--sg-bg').trim() || '#fff'
  doc.body.style.color = cs.getPropertyValue('--sg-fg').trim() || '#0f172a'
  doc.body.style.font = cs.font

  const app = mount(DockPopoutHost, {
    target: doc.body,
    props: { pane: opts.paneSnippet, paneData: opts.pane },
  })

  let done = false
  const finish = (popBackIn: boolean) => {
    if (done) return
    done = true
    clearInterval(poll)
    try { unmount(app) } catch { /* window already tearing down */ }
    if (popBackIn) opts.onClose(opts.pane.id)
  }
  // The user closed the OS window -> pop the pane back into the layout.
  win.addEventListener('beforeunload', () => finish(true))
  const poll = setInterval(() => { if (win.closed) finish(true) }, 400)

  return {
    pane: opts.pane,
    win,
    // Programmatic teardown (dock-back / manager unmount): don't re-pop-in.
    destroy: () => { finish(false); try { win.close() } catch { /* noop */ } },
  }
}
