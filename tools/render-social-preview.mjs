// Render the GitHub social preview cards (1280x640) to PNG with Chromium.
//
//   node tools/render-social-preview.mjs
//
// Output: docs/brand/social/*.png. Three on-brand variants share the brand
// tokens lifted from website/public/og-image.svg (dark navy gradient, the
// 4-tile mark, the Svelte orange->red accent, "Headless-first. Render-ready.").
// Rendered at the GitHub-recommended 1280x640 (deviceScaleFactor 1) so every
// file stays well under GitHub's 1 MB social-preview limit.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTDIR = resolve(ROOT, 'docs/brand/social')
mkdirSync(OUTDIR, { recursive: true })

const W = 1280, H = 640

// Brand tokens (website/public/og-image.svg).
const C = {
  page0: '#0a1224', page1: '#161f38',
  markBg0: '#1e2a45', markBg1: '#0c1426',
  brand0: '#ff8a3d', brand1: '#ff3e00',
  glow: '#ff5a1f',
  white: '#ffffff', ink: '#e8ecf6', muted: '#9aa6c2',
  footer: '#0d152a', grey: '#cbd5e1',
}

const FONT = `'Inter','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif`

// The 4-tile mark (one accent tile), sized in px.
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

// A small product illustration: header row + body rows with one accent cell.
function miniGrid() {
  const widths = [86, 150, 110, 120]
  const rows = []
  for (let r = 0; r < 7; r++) {
    const cells = widths.map((w, i) => {
      const accent = r === 2 && i === 2
      const sel = r === 2
      return `<div class="cell ${accent ? 'cell-accent' : ''} ${sel ? 'cell-sel' : ''}" style="width:${w}px;">
        <span class="bar" style="width:${accent ? 70 : 40 + ((r * 13 + i * 29) % 45)}%;"></span>
      </div>`
    }).join('')
    rows.push(`<div class="grow">${cells}</div>`)
  }
  const head = widths.map((w, i) =>
    `<div class="hcell" style="width:${w}px;">${['ID', 'Name', 'Dept', 'Salary'][i]}</div>`).join('')
  return `<div class="mini"><div class="mini-head">${head}</div><div class="mini-body">${rows.join('')}</div></div>`
}

const baseCss = `
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;overflow:hidden;}
  .card{position:relative;width:${W}px;height:${H}px;font-family:${FONT};
    background:linear-gradient(135deg,${C.page0},${C.page1});color:${C.white};
    -webkit-font-smoothing:antialiased;}
  .dots{position:absolute;inset:0;
    background-image:radial-gradient(circle, rgba(154,166,194,.07) 1px, transparent 1.4px);
    background-size:24px 24px;}
  .glow{position:absolute;inset:0;
    background:radial-gradient(60% 55% at 78% 12%, rgba(255,90,31,.18), rgba(255,90,31,0) 70%);}
  .mark{position:relative;background:linear-gradient(180deg,${C.markBg0},${C.markBg1});
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);flex:none;}
  .mark-edge{position:absolute;left:0;top:0;right:0;height:50%;
    background:linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0));}
  .tiles{position:absolute;}
  .tiles span{position:absolute;display:block;}
  .grad{background:linear-gradient(90deg,${C.brand0},${C.brand1});
    -webkit-background-clip:text;background-clip:text;color:transparent;}
  .lockup{display:flex;align-items:center;gap:22px;}
  .word{font-weight:800;letter-spacing:-1px;}
  .word .b{opacity:.78;}
  .muted{color:${C.muted};}
  .footer{position:absolute;left:0;right:0;bottom:0;height:66px;background:${C.footer};
    border-top:1px solid rgba(154,166,194,.18);display:flex;align-items:center;
    justify-content:space-between;padding:0 80px;color:${C.muted};font-weight:600;
    font-size:22px;letter-spacing:.4px;}
  .pill{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(154,166,194,.28);
    border-radius:999px;padding:7px 16px;font-size:18px;font-weight:600;color:${C.ink};
    background:rgba(255,255,255,.03);}
  .pill .dot{width:8px;height:8px;border-radius:50%;
    background:linear-gradient(90deg,${C.brand0},${C.brand1});}
  .mini{position:absolute;border-radius:14px;overflow:hidden;
    box-shadow:0 30px 60px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.06);background:#0e1730;}
  .mini-head{display:flex;background:#16223f;border-bottom:1px solid rgba(154,166,194,.16);}
  .hcell{padding:12px 14px;font-size:14px;font-weight:700;color:#aeb9d4;
    border-right:1px solid rgba(154,166,194,.10);}
  .mini-body .grow{display:flex;border-bottom:1px solid rgba(154,166,194,.08);}
  .cell{padding:12px 14px;border-right:1px solid rgba(154,166,194,.06);display:flex;align-items:center;}
  .cell .bar{height:9px;border-radius:5px;background:rgba(174,185,212,.30);display:block;}
  .cell-sel{background:rgba(255,90,31,.06);}
  .cell-accent{box-shadow:inset 0 0 0 2px ${C.brand1};}
  .cell-accent .bar{background:linear-gradient(90deg,${C.brand0},${C.brand1});}
`

const variantA = `
<div class="card">
  <div class="dots"></div><div class="glow"></div>
  <div style="position:absolute;left:80px;top:86px;">
    <div class="lockup">${mark(88)}<div class="word" style="font-size:48px;color:${C.ink};">Sv<span class="b">Grid</span></div></div>
  </div>
  <div style="position:absolute;left:80px;top:232px;">
    <div style="font-weight:800;font-size:66px;letter-spacing:-2px;line-height:1.08;">The Svelte 5 data grid.</div>
    <div class="grad" style="font-weight:800;font-size:66px;letter-spacing:-2px;line-height:1.12;">Headless-first. Render-ready.</div>
  </div>
  <div style="position:absolute;left:80px;top:452px;color:${C.muted};font-weight:500;font-size:26px;line-height:1.45;">
    Virtualization, Excel-style filters, cell selection, inline editing - one prop pass.<br/>
    150+ examples. MIT-licensed core. Built for Svelte 5 runes.
  </div>
  <div class="footer"><span>svgrid.com</span><span>Built by jQWidgets</span></div>
</div>`

const variantB = `
<div class="card">
  <div class="dots"></div><div class="glow"></div>
  <div style="position:absolute;left:80px;top:96px;width:560px;">
    <div class="lockup" style="margin-bottom:40px;">${mark(72)}<div class="word" style="font-size:40px;color:${C.ink};">Sv<span class="b">Grid</span></div></div>
    <div style="font-weight:800;font-size:58px;letter-spacing:-1.8px;line-height:1.06;">The Svelte 5</div>
    <div class="grad" style="font-weight:800;font-size:58px;letter-spacing:-1.8px;line-height:1.12;">data grid.</div>
    <div style="margin-top:26px;color:${C.muted};font-weight:500;font-size:24px;line-height:1.5;">
      Headless-first, render-ready.<br/>Virtualization, filters, editing - one prop pass.
    </div>
    <div style="margin-top:30px;display:flex;gap:12px;">
      <span class="pill"><span class="dot"></span>1,000,000 rows</span>
      <span class="pill"><span class="dot"></span>MIT core</span>
      <span class="pill"><span class="dot"></span>150+ examples</span>
    </div>
  </div>
  ${miniGrid().replace('<div class="mini"', '<div class="mini" style="left:720px;top:120px;width:480px;"')}
  <div class="footer"><span>svgrid.com</span><span>Built for Svelte 5 runes</span></div>
</div>`

const variantC = `
<div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
  <div class="dots"></div><div class="glow"></div>
  <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
    <div class="lockup" style="margin-bottom:40px;">${mark(96)}<div class="word" style="font-size:72px;color:${C.ink};">Sv<span class="b">Grid</span></div></div>
    <div class="grad" style="font-weight:800;font-size:52px;letter-spacing:-1.5px;">Headless-first. Render-ready.</div>
    <div style="margin-top:22px;color:${C.muted};font-weight:500;font-size:27px;">
      The Svelte 5 data grid - virtualization, filters, editing, MIT core.
    </div>
  </div>
  <div class="footer" style="justify-content:center;gap:40px;"><span>svgrid.com</span><span style="color:rgba(154,166,194,.5)">|</span><span>Built by jQWidgets</span></div>
</div>`

const variants = [
  ['svgrid-github-social', variantA],          // primary
  ['svgrid-github-social-product', variantB],
  ['svgrid-github-social-centered', variantC],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
for (const [name, body] of variants) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800&display=swap" rel="stylesheet">
    <style>${baseCss}</style></head><body>${body}</body></html>`
  await page.setContent(html, { waitUntil: 'load' })
  try { await page.evaluate(() => document.fonts.ready) } catch { /* offline: font stack falls back */ }
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(OUTDIR, name + '.png'), clip: { x: 0, y: 0, width: W, height: H } })
  console.log('rendered', name + '.png')
}
await browser.close()
console.log('DONE ->', OUTDIR)
