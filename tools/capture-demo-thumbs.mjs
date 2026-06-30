/**
 * Capture a thumbnail screenshot for every demo registered in the website
 * registry, into website/public/thumbs/<id>.webp. Used by the demo picker
 * modal on /demos.
 *
 * Usage:
 *   1. Start the examples gallery:  (cd examples && npm run dev)   # serves :5174
 *   2. node tools/capture-demo-thumbs.mjs [baseUrl] [idFilter]
 *      (or `pnpm thumbs` from the repo root, which expects the gallery running)
 *
 *      baseUrl   - default http://localhost:5174
 *      idFilter  - optional comma list of ids (or a number N) to capture a
 *                  subset for quick iteration. Omit to capture all.
 *
 * Notes
 *  - We screenshot the demo content area (below the gallery header) as PNG, then
 *    re-encode to WebP via Chromium's canvas encoder so the asset stays small
 *    with no extra native dependency. Lazy-loaded in the modal.
 *  - Heavy demos (1M rows, streaming) get a longer settle; we capture whatever
 *    has rendered after the timeout rather than failing.
 *  - `node tools/check-demo-thumbs.mjs` flags any registered demo missing a
 *    thumbnail (run it in CI so thumbnails don't silently go stale).
 */
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'website', 'public', 'thumbs')
const REGISTRY = join(ROOT, 'website', 'src', 'lib', 'demos.ts')

const BASE = process.argv[2] && process.argv[2].startsWith('http')
  ? process.argv[2]
  : 'http://localhost:5174'
const FILTER = process.argv.find((a, i) => i >= 2 && !a.startsWith('http'))

// Playwright is a devDependency of the website package.
const reqWeb = createRequire(join(ROOT, 'website', 'package.json'))
let chromium
try {
  ;({ chromium } = reqWeb('playwright'))
} catch {
  ;({ chromium } = createRequire(import.meta.url)('playwright'))
}

async function demoIds() {
  const src = await readFile(REGISTRY, 'utf-8')
  const ids = [...src.matchAll(/demo\('([^']+)'/g)].map((m) => m[1])
  if (!FILTER) return ids
  if (/^\d+$/.test(FILTER)) return ids.slice(0, Number(FILTER))
  const set = new Set(FILTER.split(',').map((s) => s.trim()))
  return ids.filter((id) => set.has(id))
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const ids = await demoIds()
  process.stdout.write(`capture-demo-thumbs: ${ids.length} demos -> ${OUT_DIR}\n`)

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 })

  let ok = 0
  let failed = 0
  for (const id of ids) {
    const out = join(OUT_DIR, `${id}.webp`)
    try {
      await page.goto(`${BASE}/#/${id}`, { waitUntil: 'domcontentloaded' })
      // Wait for the demo to paint something substantial.
      await page
        .waitForSelector('main .sv-grid-container, main svg, main canvas, main table', { timeout: 18000 })
        .catch(() => {})
      await page.waitForTimeout(1400)

      const box = await page.evaluate(() => {
        const main = document.querySelector('main')
        const header = main?.querySelector('header')
        if (!main) return null
        const mb = main.getBoundingClientRect()
        const hb = header ? header.getBoundingClientRect() : { height: 0 }
        return { x: mb.x, y: mb.y, width: mb.width, height: mb.height, headerH: hb.height }
      })
      if (!box) throw new Error('no <main>')

      const pad = 8
      const top = box.y + (box.headerH || 0) + pad
      const clip = {
        x: Math.max(box.x + pad, 0),
        y: Math.max(top, 0),
        width: Math.min(box.width - pad * 2, 980),
        height: 460,
      }
      // Screenshot as PNG, then re-encode to WebP via Chromium's own encoder
      // (canvas.toDataURL) so we get small files without any extra native dep.
      const png = await page.screenshot({ clip, type: 'png' })
      const dataUrl = await page.evaluate(async (b64) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + b64
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        return c.toDataURL('image/webp', 0.74)
      }, png.toString('base64'))
      await writeFile(out, Buffer.from(dataUrl.split(',')[1], 'base64'))
      const sz = (await stat(out)).size
      ok += 1
      process.stdout.write(`  ok  ${id}  (${Math.round(sz / 1024)} KB)\n`)
    } catch (err) {
      failed += 1
      process.stdout.write(`  !!  ${id}  ${err.message}\n`)
    }
  }

  await browser.close()
  const total = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.webp')).length
  process.stdout.write(`done: ${ok} captured, ${failed} failed, ${total} files in thumbs/\n`)
}

main()
