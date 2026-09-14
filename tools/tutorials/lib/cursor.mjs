/**
 * A visible pointer for the recording.
 *
 * Chromium's screencast (what Playwright's recordVideo captures) never draws
 * the mouse cursor, so a tutorial would show cells editing themselves. This
 * init script adds a fixed-position arrow to the page that follows every
 * `mousemove` and pulses a ring on `mousedown`. Playwright's `page.mouse.*`
 * and locator clicks all dispatch real input events through CDP, so the
 * overlay tracks them with no help from the drive helpers.
 *
 * The overlay is appended to <body>, outside `.demo-page > main`, so the CSS
 * zoom the recorder applies to the demo does not scale it; `clientX/Y` are
 * viewport CSS pixels, which is what `position: fixed` wants. It never
 * intercepts events (`pointer-events: none`) and sits above every popover.
 */
export const CURSOR_INIT_SCRIPT = `
(() => {
  if (window.__tutCursorInstalled) return
  window.__tutCursorInstalled = true
  const install = () => {
    if (!document.body || document.getElementById('tut-cursor')) return
    const style = document.createElement('style')
    style.textContent = [
      '#tut-cursor{position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;',
      'transform:translate(-100px,-100px);transition:transform 40ms linear;will-change:transform}',
      '#tut-cursor svg{display:block;width:28px;height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}',
      '#tut-cursor .ring{position:absolute;left:-6px;top:-6px;width:20px;height:20px;border-radius:50%;',
      'border:2px solid #f97316;opacity:0;transform:scale(.4)}',
      '#tut-cursor.is-down .ring{animation:tut-pulse .32s ease-out forwards}',
      '@keyframes tut-pulse{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(1.9)}}',
    ].join('')
    document.head.appendChild(style)
    const el = document.createElement('div')
    el.id = 'tut-cursor'
    el.setAttribute('aria-hidden', 'true')
    el.innerHTML = '<span class="ring"></span>' +
      '<svg viewBox="0 0 24 24"><path d="M5 3l14 9-6.2 1.2L16 20.5l-2.4 1L10.3 15 5 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.body.appendChild(el)
    document.addEventListener('mousemove', (e) => {
      el.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'
    }, { capture: true, passive: true })
    document.addEventListener('mousedown', (e) => {
      el.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'
      el.classList.remove('is-down')
      void el.offsetWidth
      el.classList.add('is-down')
    }, { capture: true, passive: true })
    document.addEventListener('mouseup', () => {
      setTimeout(() => el.classList.remove('is-down'), 320)
    }, { capture: true, passive: true })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
  else install()
})()
`
