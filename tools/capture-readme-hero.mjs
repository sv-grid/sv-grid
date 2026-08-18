/**
 * Capture the hero screenshot used at the top of README.md and
 * packages/grid/README.md.
 *
 * Same approach as capture-demo-thumbs.mjs, but at deviceScaleFactor 2 and a
 * wider clip, because GitHub renders the README column at ~850 CSS px and npm
 * a little wider - a 1x thumbnail looks soft on any retina display.
 *
 * Output goes to website/public/brand/ so it is served from
 * https://svgrid.com/brand/<name>.png. READMEs must reference it by absolute
 * URL: npm does not resolve repo-relative image paths.
 *
 * Usage:
 *   1. Start the gallery:  pnpm dev            # serves :5174
 *   2. node tools/capture-readme-hero.mjs [demoId] [baseUrl]
 *
 * Defaults to the trading-desk demo, which shows the most grid surface at
 * once (pinned columns, formatting, live updates).
 */
import { mkdir, stat, copyFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'website', 'public', 'brand')

const args = process.argv.slice(2)
const DEMO = args.find((a) => !a.startsWith('http')) || '00-trading-desk'
const BASE = args.find((a) => a.startsWith('http')) || 'http://localhost:5174'
const OUT = join(OUT_DIR, 'svgrid-hero.png')

const reqWeb = createRequire(join(ROOT, 'website', 'package.json'))
const { chromium } = reqWeb('playwright')

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1680, height: 940 },
  deviceScaleFactor: 2,
})

try {
  await page.goto(`${BASE}/#/${DEMO}`, { waitUntil: 'domcontentloaded' })
  await page
    .waitForSelector('main .sv-grid-container, main table', { timeout: 20000 })
    .catch(() => {})
  // Let virtualization settle and any intro animation finish.
  await page.waitForTimeout(2200)

  // Start the clip below the demo's title + blurb prose, so the hero shows
  // product and not a half-cut sentence. We walk main's children and take the
  // first one that isn't a heading or a paragraph.
  const box = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return null
    const mb = main.getBoundingClientRect()
    const header = main.querySelector('header')
    const scope = header?.parentElement === main ? main : main
    let top = mb.y + (header?.getBoundingClientRect().height || 0)
    for (const el of scope.children) {
      if (el.tagName === 'HEADER') continue
      if (/^(H1|H2|H3|P)$/.test(el.tagName)) {
        const r = el.getBoundingClientRect()
        top = Math.max(top, r.bottom)
        continue
      }
      const r = el.getBoundingClientRect()
      if (r.height > 40) { top = r.top; break }
    }
    return { x: mb.x, y: mb.y, width: mb.width, top }
  })
  if (!box) throw new Error('no <main> found - is the gallery running?')

  const pad = 10
  await page.screenshot({
    path: OUT,
    type: 'png',
    clip: {
      x: Math.max(box.x + pad, 0),
      y: Math.max(box.top + 4, 0),
      width: Math.max(box.width - pad * 2, 100),
      height: 566,
    },
  })

  // Keep a copy in the public repo. website/ is a private submodule, so the
  // tracked source of truth for the asset has to live outside it.
  await mkdir(join(ROOT, 'docs', 'brand', 'screenshots'), { recursive: true })
  await copyFile(OUT, join(ROOT, 'docs', 'brand', 'screenshots', 'svgrid-hero.png'))

  const kb = Math.round((await stat(OUT)).size / 1024)
  process.stdout.write(`capture-readme-hero: ${DEMO} -> ${OUT} (${kb} KB)\n`)
  if (kb > 400) {
    process.stdout.write('  note: over 400 KB. Consider a shorter clip height.\n')
  }
} finally {
  await browser.close()
}
