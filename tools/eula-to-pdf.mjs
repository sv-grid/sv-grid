// Convert docs/legal/EULA.md to a styled PDF using marked + Playwright (Chromium).
// Usage: node tools/eula-to-pdf.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { marked } from '../node_modules/.pnpm/marked@15.0.12/node_modules/marked/lib/marked.esm.js'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'docs/legal/EULA.md')
const out = resolve(root, 'docs/legal/SvGrid-EULA.pdf')

const md = readFileSync(src, 'utf8')
const body = marked.parse(md)

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @page { margin: 22mm 20mm 20mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Inter, system-ui, Arial, sans-serif;
    color: #1e293b; font-size: 10.5pt; line-height: 1.5; margin: 0;
  }
  h1 {
    font-size: 20pt; color: #0e1525; margin: 0 0 4pt;
    letter-spacing: -0.4pt;
  }
  h1 + p { color: #475569; }
  h2 {
    font-size: 12pt; color: #0e1525; margin: 16pt 0 4pt;
    padding-top: 8pt; border-top: 1px solid #e2e8f0;
  }
  h1, h2 { break-after: avoid; }
  p, li { margin: 4pt 0; }
  ul { margin: 4pt 0 4pt 0; padding-left: 18pt; }
  li { padding-left: 2pt; }
  code {
    font-family: "Cascadia Code", Consolas, monospace; font-size: 9.5pt;
    background: #f1f5f9; padding: 1px 4px; border-radius: 3px; color: #0e1525;
  }
  strong { color: #0e1525; }
  a { color: #ff5a1f; text-decoration: none; }
  .accent-bar { height: 4px; background: #ff5a1f; border-radius: 2px; margin-bottom: 14pt; }
</style></head>
<body><div class="accent-bar"></div>${body}</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'networkidle' })
const pdf = await page.pdf({
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:8pt;color:#94a3b8;padding:0 20mm;display:flex;justify-content:space-between;">' +
    '<span>SvGrid End User License Agreement - jQWidgets Ltd.</span>' +
    '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
})
writeFileSync(out, pdf)
await browser.close()
console.log('Wrote', out, `(${(pdf.length / 1024).toFixed(1)} KB)`)
