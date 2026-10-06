/**
 * Callouts: point at the thing the narration is talking about.
 *
 * Every video before this one was a title card, a raw screen recording and an
 * end card. When the narration said "every column carries a filter menu",
 * nothing on screen said which part of a 1920x1080 frame to look at, so the
 * viewer either already knew or missed it.
 *
 * This adds three marks, drawn into the recorded page itself so the screencast
 * captures them with no compositing step:
 *
 *   - a spotlight: a hole punched through a dimming layer around one element,
 *   - a label: a short line of text beside the hole, with a pointer at it,
 *   - a pulse: a ring that expands once, for "this just happened".
 *
 * Built the same way as CURSOR_INIT_SCRIPT (see cursor.mjs): appended to
 * <body>, outside the container the recorder applies CSS `zoom` to, so the
 * marks are not scaled twice. `position: fixed` with viewport CSS pixels, and
 * `pointer-events: none` throughout, so a callout can never swallow the click
 * a later beat makes or change what an assertion sees.
 *
 * Rects come from `getBoundingClientRect()` inside the page, which Chromium
 * reports zoom-adjusted, so they are already the viewport pixels the overlay
 * wants. Verified against a recorded frame, not assumed.
 */
export const CALLOUT_INIT_SCRIPT = `
(() => {
  if (window.__tutCalloutInstalled) return
  window.__tutCalloutInstalled = true
  const Z = 2147483646  // just under the cursor, which must stay on top
  const ACCENT = '#f97316'
  const install = () => {
    if (!document.body || document.getElementById('tut-callout')) return
    const style = document.createElement('style')
    style.textContent = [
      '#tut-callout{position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;',
      'opacity:0;transition:opacity .28s ease}',
      '#tut-callout.is-on{opacity:1}',
      // The hole: a box-shadow large enough to cover any viewport dims
      // everything outside it, so one element carries the whole effect.
      '#tut-callout .hole{position:fixed;border-radius:10px;',
      'box-shadow:0 0 0 9999px rgba(8,10,14,.62);border:2px solid ' + ACCENT + ';',
      'transition:left .34s cubic-bezier(.4,0,.2,1),top .34s cubic-bezier(.4,0,.2,1),',
      'width .34s cubic-bezier(.4,0,.2,1),height .34s cubic-bezier(.4,0,.2,1);',
      'will-change:left,top,width,height}',
      '#tut-callout.no-dim .hole{box-shadow:none}',
      '#tut-callout.no-ring .hole{border-color:transparent}',
      '#tut-callout .label{position:fixed;max-width:480px;padding:12px 16px;border-radius:12px;',
      'background:#11151c;border:1px solid rgba(255,255,255,.14);color:#f3f4f6;',
      'font:600 19px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
      'box-shadow:0 18px 40px -16px rgba(0,0,0,.8);opacity:0;transform:translateY(6px);',
      'transition:opacity .24s ease .08s,transform .24s ease .08s}',
      '#tut-callout.is-on .label{opacity:1;transform:translateY(0)}',
      '#tut-callout .label.hidden{display:none}',
      '#tut-callout .label b{color:' + ACCENT + ';font-weight:700}',
      // The pointer triangle, rotated per placement.
      '#tut-callout .label::after{content:"";position:absolute;width:12px;height:12px;',
      'background:#11151c;border-left:1px solid rgba(255,255,255,.14);',
      'border-top:1px solid rgba(255,255,255,.14);transform:rotate(45deg)}',
      '#tut-callout .label.below::after{top:-7px;left:var(--arrow,24px)}',
      '#tut-callout .label.above::after{bottom:-7px;left:var(--arrow,24px);transform:rotate(225deg)}',
      '.tut-callout-pulse{position:fixed;border-radius:10px;border:3px solid ' + ACCENT + ';',
      'opacity:0;pointer-events:none;z-index:' + Z + '}',
      '@keyframes tut-callout-pulse{0%{opacity:0;transform:scale(.985)}',
      '18%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.035)}}',
    ].join('')
    document.head.appendChild(style)

    const root = document.createElement('div')
    root.id = 'tut-callout'
    root.setAttribute('aria-hidden', 'true')
    root.innerHTML = '<div class="hole"></div><div class="label hidden"></div>'
    document.body.appendChild(root)

    const hole = root.querySelector('.hole')
    const label = root.querySelector('.label')

    window.__tutCallout = {
      show(rect, text, opts) {
        const o = opts || {}
        const pad = o.pad == null ? 8 : o.pad
        const vw = window.innerWidth
        const vh = window.innerHeight
        const x = Math.max(0, rect.x - pad)
        const y = Math.max(0, rect.y - pad)
        const w = Math.min(vw - x, rect.width + pad * 2)
        const h = Math.min(vh - y, rect.height + pad * 2)
        root.classList.toggle('no-dim', o.dim === false)
        root.classList.toggle('no-ring', o.ring === false)
        hole.style.left = x + 'px'
        hole.style.top = y + 'px'
        hole.style.width = w + 'px'
        hole.style.height = h + 'px'

        if (text) {
          label.classList.remove('hidden')
          label.innerHTML = text
          // Measure before placing: the box is sized by its own content.
          label.style.left = '0px'
          label.style.top = '0px'
          const lb = label.getBoundingClientRect()
          const below = o.place === 'above' ? false : o.place === 'below' ? true : y + h + 20 + lb.height < vh
          let lx = x + w / 2 - lb.width / 2
          lx = Math.max(16, Math.min(vw - lb.width - 16, lx))
          const ly = below ? y + h + 14 : y - lb.height - 14
          label.style.left = lx + 'px'
          label.style.top = Math.max(16, ly) + 'px'
          label.classList.toggle('below', below)
          label.classList.toggle('above', !below)
          // Point the triangle at the middle of the hole, clamped inside the box.
          const ax = Math.max(16, Math.min(lb.width - 28, x + w / 2 - lx - 6))
          label.style.setProperty('--arrow', ax + 'px')
        } else {
          label.classList.add('hidden')
        }
        root.classList.add('is-on')
      },
      hide() {
        root.classList.remove('is-on')
      },
      pulse(rect) {
        // Traces the element, so it reads on a 1840px row as well as on a
        // cell. A circle only ever suited a square target.
        const pad = 6
        const el = document.createElement('div')
        el.className = 'tut-callout-pulse'
        el.style.left = rect.x - pad + 'px'
        el.style.top = rect.y - pad + 'px'
        el.style.width = rect.width + pad * 2 + 'px'
        el.style.height = rect.height + pad * 2 + 'px'
        el.style.animation = 'tut-callout-pulse .78s cubic-bezier(.2,.7,.3,1) forwards'
        document.body.appendChild(el)
        setTimeout(() => el.remove(), 1000)
      },
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
  else install()
})()
`
