/**
 * One slide as a standalone HTML page, 1080 x 1920 (TikTok photo mode, 9:16).
 *
 * TikTok draws its own UI over the bottom of a post (caption, music, the
 * progress dots) and down the right edge (like / comment / share), so the
 * layout keeps everything that has to be read inside SAFE: nothing below
 * y = 1560, and text clear of the right-hand column in the lower half.
 */
import { highlight } from './highlight.mjs'

export const SIZE = { width: 1080, height: 1920 }
const SAFE = { top: 96, side: 72, bottom: 360 }

/**
 * Where a deck can go. TikTok draws its UI over the bottom of the frame, so
 * its safe area stops short; a LinkedIn carousel (4:5, posted as images or as
 * a PDF document) has nothing drawn over it. Both are 1080 wide, so a code
 * line that fits one fits the other.
 */
export const FORMATS = {
  tiktok: { size: SIZE, safe: SAFE },
  linkedin: { size: { width: 1080, height: 1350 }, safe: { top: 72, side: 72, bottom: 72 } },
}
// Code panels reach this far into the side margin: a readable mono size is
// worth more than the margin, and code sits in the top half, clear of
// TikTok's buttons on the right.
const CODE_BLEED = 40

// Ember dark, the product's default theme, so the screenshots and the slide
// around them read as one surface. Orange is for emphasis only.
const C = {
  bg: '#0c0a09',
  panel: '#1c1917',
  border: '#292524',
  fg: '#fafaf9',
  muted: '#a8a29e',
  accent: '#ff5a1f',
}

/**
 * The site's mark (website/src/components/Logo.svelte), redrawn statically: a
 * header row over three body rows, the right-hand column the orange "sorted"
 * column with a caret in its header. Same 24-unit geometry.
 */
function logoSvg(size) {
  const cols = [{ x: 4, w: 6 }, { x: 11, w: 4 }, { x: 16, w: 4 }]
  const rects = []
  for (const c of cols) rects.push(`<rect x="${c.x}" y="4" width="${c.w}" height="4" rx="1.2" fill="${C.fg}" opacity="0.9"/>`)
  const a = cols[2]
  const mid = a.x + a.w / 2
  rects.push(`<path d="M${mid - 1.1} 5.4 L${mid + 1.1} 5.4 L${mid} 6.9 Z" fill="${C.accent}"/>`)
  for (const y of [9, 13, 17]) {
    cols.forEach((c, i) => rects.push(`<rect x="${c.x}" y="${y}" width="${c.w}" height="3" rx="0.9" fill="${i === 2 ? C.accent : C.fg}" opacity="${i === 2 ? 1 : 0.32}"/>`))
  }
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${rects.join('')}</svg>`
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** `==word==` marks the one phrase on a slide that gets the accent colour. */
const rich = (s) => esc(s).replace(/==(.+?)==/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>')

/** Largest mono size (px) at which the longest line still fits the code panel. */
export function codeFontSize(code, maxPx = 34) {
  const longest = Math.max(...code.split('\n').map((l) => l.length), 1)
  const inner = SIZE.width - (SAFE.side - CODE_BLEED) * 2 - 2 * 28 - 2
  // JetBrains Mono advances 0.6em per character.
  return Math.min(maxPx, Math.floor(inner / (longest * 0.6)))
}

/**
 * @param {object} slide   one entry of a deck's `slides`
 * @param {{ index: number, total: number, shot?: string, format?: keyof typeof FORMATS }} ctx  shot = data: URL of the captured image
 */
export function slideHtml(slide, { index, total, shot, format = 'tiktok' }) {
  const { size: SIZE, safe: SAFE } = FORMATS[format]
  const parts = []
  // A clock time over the title, for a deck told as one morning.
  if (slide.stamp) parts.push(`<span class="stamp">${esc(slide.stamp)}</span>`)
  if (slide.title) parts.push(`<h1 class="${slide.kind === 'title' || slide.kind === 'end' ? 'big' : ''}">${rich(slide.title)}</h1>`)
  if (slide.body) parts.push(`<p class="body">${rich(slide.body)}</p>`)
  // A chat thread, team-chat style: avatar, name, time, message. Everything
  // sits on the left so nothing runs under TikTok's buttons on the right.
  if (slide.chat) {
    parts.push(
      `<div class="chat">${slide.chat
        .map((m) => `<div class="msg${m.me ? ' me' : ''}"><span class="av">${esc(m.av ?? m.who.slice(0, 2))}</span><div><b>${esc(m.who)}</b>${m.time ? `<time>${esc(m.time)}</time>` : ''}<p>${rich(m.text)}</p></div></div>`)
        .join('')}</div>`,
    )
  }
  if (slide.code) {
    // A one-to-four line snippet is the point of its slide; let it be big.
    const size = slide.codeSize ?? codeFontSize(slide.code, slide.code.split('\n').length <= 4 ? 44 : 34)
    parts.push(
      `<figure class="code">${slide.file ? `<figcaption>${esc(slide.file)}</figcaption>` : ''}` +
        `<pre style="font-size:${size}px">${highlight(slide.code)}</pre></figure>`,
    )
  }
  // Several crops of one screen (see trim in render.mjs) stack with a small gap.
  if (shot) parts.push(`<div class="shot">${slide.shotLabel ? `<span class="label">${rich(slide.shotLabel)}</span>` : ''}${[shot].flat().map((src) => `<img src="${src}" alt="" />`).join('')}</div>`)
  if (slide.after) parts.push(`<p class="body after">${rich(slide.after)}</p>`)
  if (slide.lines) parts.push(`<ul class="lines">${slide.lines.map((l) => `<li>${rich(l)}</li>`).join('')}</ul>`)

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=block" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${SIZE.width}px; height: ${SIZE.height}px; background: ${C.bg}; color: ${C.fg}; overflow: hidden; }
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .page { position: absolute; inset: ${SAFE.top}px ${SAFE.side}px ${SAFE.bottom}px; display: flex; flex-direction: column; gap: 40px; }
  header { display: flex; justify-content: space-between; align-items: center; font-size: 30px; font-weight: 600; color: ${C.muted}; }
  header b { display: flex; align-items: center; gap: 14px; color: ${C.fg}; font-size: 36px; font-weight: 700; letter-spacing: -0.02em; }
  header b i { font-style: normal; color: ${C.accent}; }
  h1 { font-size: 72px; line-height: 1.08; font-weight: 800; letter-spacing: -0.025em; }
  h1.big { font-size: 96px; line-height: 1.02; }
  em { font-style: normal; color: ${C.accent}; }
  .body { font-size: 40px; line-height: 1.35; color: #d6d3d1; }
  .body code, h1 code, li code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.86em; background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 10px; padding: 0.04em 0.28em; }
  .code { background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 24px; padding: 30px 28px 32px; margin: 0 -${CODE_BLEED}px; }
  .code figcaption { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 26px; color: ${C.muted}; margin-bottom: 20px; }
  pre { font-variant-ligatures: none; font-family: 'JetBrains Mono', ui-monospace, monospace; line-height: 1.5; white-space: pre; color: #e7e5e4; }
  .tk-kw { color: #ff8a5c; }
  .tk-string { color: #a3e635; }
  .tk-comment { color: #78716c; }
  .tk-tag { color: #7dd3fc; }
  .tk-attr { color: #fcd34d; }
  .tk-type { color: #c4b5fd; }
  .tk-number { color: #fdba74; }
  .shot { position: relative; flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
  .shot img { display: block; width: 100%; height: auto; border-radius: 24px; border: 1px solid ${C.border}; box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
  .shot .label { align-self: flex-start; background: ${C.accent}; color: #0c0a09; font-weight: 700; font-size: 32px; padding: 10px 22px; border-radius: 12px; font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .lines { list-style: none; display: flex; flex-direction: column; gap: 28px; font-size: 44px; font-weight: 600; }
  .lines li { border-left: 6px solid ${C.accent}; padding-left: 28px; }
  .after { margin-top: -8px; }
  .stamp { align-self: flex-start; margin-bottom: -16px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 34px; font-weight: 600; color: ${C.accent}; border: 2px solid ${C.accent}; border-radius: 12px; padding: 6px 18px; }
  .chat { display: flex; flex-direction: column; gap: 44px; padding-right: 110px; }
  .msg { display: flex; gap: 24px; align-items: flex-start; }
  .msg .av { flex: 0 0 96px; height: 96px; border-radius: 18px; background: #44403c; color: ${C.fg}; display: grid; place-items: center; font-weight: 800; font-size: 32px; }
  .msg.me .av { background: ${C.accent}; color: #0c0a09; }
  .msg b { font-size: 40px; font-weight: 700; }
  .msg time { margin-left: 16px; font-size: 28px; color: ${C.muted}; }
  .msg p { margin-top: 6px; font-size: 52px; line-height: 1.3; color: #e7e5e4; }
</style></head>
<body><div class="page">
  <header><b>${logoSvg(48)}<span><i>Sv</i>Grid</span></b><span>${index + 1}/${total}</span></header>
  ${parts.join('\n  ')}
</div>
<script>
  // A screenshot taller than the room left on the slide shrinks, keeping its
  // shape, down to half size. Past that the render fails on overflow instead.
  window.__fit = async () => {
    const page = document.querySelector('.page')
    const imgs = [...document.querySelectorAll('.shot img')]
    await Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = r)))))
    const over = page.scrollHeight - page.clientHeight
    if (over <= 0 || !imgs.length) return
    const h = imgs.reduce((a, i) => a + i.getBoundingClientRect().height, 0)
    const k = Math.max(0.5, (h - over - 4) / h)
    for (const i of imgs) i.style.width = i.getBoundingClientRect().width * k + 'px'
  }
</script>
</body></html>`
}
