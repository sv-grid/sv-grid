// Render a branded 1600x900 (16:9) card for a tweet with Chromium and return
// the PNG as a Buffer. Uses the exact brand tokens + 4-tile mark from
// tools/render-social-preview.mjs so tweet images match the GitHub social
// cards and the website OG image. The content (eyebrow / headline / subline /
// footer) is dynamic so the same renderer serves every tweet type: a release,
// a blog post, a feature highlight, or an AI-generated original.
import { chromium } from 'playwright'

const W = 1600
const H = 900

// Brand tokens - kept in sync with tools/render-social-preview.mjs.
const C = {
  page0: '#0a1224', page1: '#161f38',
  markBg0: '#1e2a45', markBg1: '#0c1426',
  brand0: '#ff8a3d', brand1: '#ff3e00',
  white: '#ffffff', ink: '#e8ecf6', muted: '#9aa6c2',
  footer: '#0d152a', grey: '#cbd5e1',
}
const FONT = `'Inter','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif`

// The 4-tile mark (one accent tile), sized in px - lifted from the social card.
function mark(size = 96) {
  const r = Math.round(size * 0.1875)
  const pad = Math.round(size * 0.25)
  const tile = Math.round(size * 0.205)
  const gap = Math.round(size * 0.295)
  const tr = Math.max(2, Math.round(tile * 0.18))
  return `
  <div class="mark" style="width:${size}px;height:${size}px;border-radius:${r}px;">
    <div class="mark-edge" style="border-radius:${r}px;"></div>
    <div class="tiles" style="left:${pad}px;top:${pad}px;">
      <span style="left:0;top:0;width:${tile}px;height:${tile}px;border-radius:${tr}px;background:${C.grey};opacity:.80;"></span>
      <span style="left:${gap}px;top:0;width:${tile}px;height:${tile}px;border-radius:${tr}px;background:linear-gradient(180deg,${C.brand0},${C.brand1});"></span>
      <span style="left:0;top:${gap}px;width:${tile}px;height:${tile}px;border-radius:${tr}px;background:${C.grey};opacity:.62;"></span>
      <span style="left:${gap}px;top:${gap}px;width:${tile}px;height:${tile}px;border-radius:${tr}px;background:${C.grey};opacity:.80;"></span>
    </div>
  </div>`
}

function esc(s = '') {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

const css = `
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;overflow:hidden;}
  .card{position:relative;width:${W}px;height:${H}px;font-family:${FONT};
    background:linear-gradient(135deg,${C.page0},${C.page1});color:${C.white};
    -webkit-font-smoothing:antialiased;}
  .dots{position:absolute;inset:0;
    background-image:radial-gradient(circle, rgba(154,166,194,.07) 1px, transparent 1.4px);
    background-size:28px 28px;}
  .glow{position:absolute;inset:0;
    background:radial-gradient(58% 55% at 80% 10%, rgba(255,90,31,.20), rgba(255,90,31,0) 70%);}
  .mark{position:relative;background:linear-gradient(180deg,${C.markBg0},${C.markBg1});
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);flex:none;}
  .mark-edge{position:absolute;left:0;top:0;right:0;height:50%;
    background:linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0));}
  .tiles{position:absolute;}
  .tiles span{position:absolute;display:block;}
  .grad{background:linear-gradient(90deg,${C.brand0},${C.brand1});
    -webkit-background-clip:text;background-clip:text;color:transparent;}
  .lockup{display:flex;align-items:center;gap:26px;}
  .word{font-weight:800;letter-spacing:-1px;color:${C.ink};font-size:52px;}
  .word .b{opacity:.78;}
  .eyebrow{display:inline-flex;align-items:center;gap:12px;border:1px solid rgba(154,166,194,.28);
    border-radius:999px;padding:10px 22px;font-size:26px;font-weight:700;color:${C.ink};
    background:rgba(255,255,255,.03);letter-spacing:.3px;}
  .eyebrow .dot{width:11px;height:11px;border-radius:50%;
    background:linear-gradient(90deg,${C.brand0},${C.brand1});}
  .headline{font-weight:800;letter-spacing:-2px;line-height:1.05;}
  .subline{color:${C.muted};font-weight:500;line-height:1.45;}
  .footer{position:absolute;left:0;right:0;bottom:0;height:84px;background:${C.footer};
    border-top:1px solid rgba(154,166,194,.18);display:flex;align-items:center;
    justify-content:space-between;padding:0 96px;color:${C.muted};font-weight:600;
    font-size:28px;letter-spacing:.4px;}
`

// Scale the headline font to the length so long titles still fit on the card.
function headlineSize(headline) {
  const len = (headline || '').length
  if (len > 80) return 58
  if (len > 55) return 68
  if (len > 35) return 82
  return 96
}

// content: { eyebrow, headline, subline, footerRight }
export async function renderCard(content) {
  const hSize = headlineSize(content.headline)
  const body = `
  <div class="card">
    <div class="dots"></div><div class="glow"></div>
    <div style="position:absolute;left:96px;top:96px;">
      <div class="lockup">${mark(84)}<div class="word">Sv<span class="b">Grid</span></div></div>
    </div>
    <div style="position:absolute;left:96px;top:300px;right:96px;">
      ${content.eyebrow ? `<div class="eyebrow" style="margin-bottom:34px;"><span class="dot"></span>${esc(content.eyebrow)}</div>` : ''}
      <div class="headline grad" style="font-size:${hSize}px;">${esc(content.headline)}</div>
      ${content.subline ? `<div class="subline" style="margin-top:30px;font-size:34px;max-width:1280px;">${esc(content.subline)}</div>` : ''}
    </div>
    <div class="footer">
      <span>svgrid.com</span>
      <span>${esc(content.footerRight || 'The Svelte 5 data grid')}</span>
    </div>
  </div>`

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
    <style>${css}</style></head><body>${body}</body></html>`

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'load' })
    try { await page.evaluate(() => document.fonts.ready) } catch { /* offline: font stack falls back */ }
    await page.waitForTimeout(300)
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } })
    return png
  } finally {
    await browser.close()
  }
}
