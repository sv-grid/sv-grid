/**
 * Recapture the DESIGNER screenshots used in the Studio docs, from the live
 * /studio route (which renders the current SvStudioDesigner with the Acme CRM
 * starter). Keeps docs/enterprise/studio/*.md images up to date with the real UI.
 *
 * Usage:
 *   1. Build + serve the website:  (cd website && npm run build && npm run preview)  # :4173
 *      or the dev server:          (cd website && npm run dev)                        # :5173
 *   2. node tools/capture-studio-shots.mjs [baseUrl]
 *      baseUrl default http://localhost:4173
 *
 * Notes
 *  - Pre-sets `sv-studio:onboarded` so the onboarding tour doesn't cover the shot,
 *    and clears the saved draft so the CRM starter seeds fresh.
 *  - Removes the enterprise eval watermark/nag before each shot, and parks the
 *    mouse in the corner so no hover tooltip lingers.
 *  - Modals render as SIBLINGS of .sv-studio-shell, so those are full-viewport shots.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { stat } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'website', 'public', 'docs-media')
const BASE = process.argv[2] || 'http://localhost:4173'

const reqWeb = createRequire(join(ROOT, 'website', 'package.json'))
const { chromium } = reqWeb('playwright')

const DENAG = () =>
  document
    .querySelectorAll('[data-svgrid-enterprise-watermark],[data-svgrid-enterprise-upgrade]')
    .forEach((el) => el.remove())

async function report(out) {
  const sz = (await stat(join(OUT, out))).size
  process.stdout.write(`  ok  ${out}  (${Math.round(sz / 1024)} KB)\n`)
}

async function prep(page) {
  await page.evaluate(DENAG)
  await page.mouse.move(2, 2)
  await page.waitForTimeout(250)
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 }, deviceScaleFactor: 2 })

  // Suppress the first-run tour + clear any saved draft so the CRM starter is fresh.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    try {
      localStorage.setItem('sv-studio:onboarded', '1')
      localStorage.removeItem('svgrid-studio-draft')
    } catch {
      /* storage blocked */
    }
  })

  await page.goto(`${BASE}/#/studio`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.sv-studio-shell', { timeout: 40000 })
  // Hide the website's top nav so the designer fills the frame (full-viewport modal
  // shots would otherwise show the site header above the designer).
  await page.evaluate(() => document.querySelectorAll('header.sticky').forEach((h) => (h.style.display = 'none')))
  // Let the preview grid + charts settle.
  await page.waitForSelector('.sv-studio-shell .sv-grid-table, .sv-studio-shell table', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2500)

  // 1. The designer, default view (Acme CRM Overview: grid + inspector).
  await prep(page)
  await page.locator('.sv-studio-shell').screenshot({ path: join(OUT, 'studio-app-designer.png') })
  await report('studio-app-designer.png')

  // Close any open modal by clicking its backdrop (top-left corner), then wait for it
  // to detach - Escape doesn't always land when focus isn't inside the dialog.
  const closeModal = async (sel) => {
    await page.locator('.sv-studio__modal-wrap').click({ position: { x: 6, y: 6 } }).catch(() => {})
    await page.waitForSelector(sel, { state: 'detached', timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(300)
  }

  // 2. Sample apps gallery (a modal, so full viewport).
  await page.click('[data-tour="samples"]')
  await page.waitForSelector('.sv-studio__gallery', { timeout: 10000 })
  await page.waitForTimeout(700)
  await prep(page)
  await page.screenshot({ path: join(OUT, 'studio-sample-gallery.png'), clip: { x: 0, y: 0, width: 1680, height: 950 } })
  await report('studio-sample-gallery.png')
  await closeModal('.sv-studio__gallery')

  // 3. Data model dialog (the binding hub - a newer feature).
  await page.click('[title="See how your entities relate"]')
  await page.waitForSelector('.sv-studio__modal', { timeout: 10000 })
  await page.waitForTimeout(600)
  await prep(page)
  await page.screenshot({ path: join(OUT, 'studio-data-model.png'), clip: { x: 0, y: 0, width: 1680, height: 950 } })
  await report('studio-data-model.png')
  await closeModal('.sv-studio__modal')

  // 4. A dashboard-heavy screen for the "sample loaded" shot (Forecast = deals
  //    dashboard: KPI tiles + charts). Click the center screen-nav's Forecast item.
  const forecast = page.locator('.sv-studio-shell').getByText('Forecast', { exact: true }).first()
  if (await forecast.count()) {
    await forecast.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }
  await prep(page)
  await page.locator('.sv-studio-shell').screenshot({ path: join(OUT, 'studio-sample-loaded.png') })
  await report('studio-sample-loaded.png')

  await browser.close()
  process.stdout.write('done\n')
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + '\n')
  process.exit(1)
})
