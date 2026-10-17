/**
 * E2E: every page block (SvGrid UI > Blocks) loads clean and fits a phone.
 *
 * A block is copied into someone's app as-is, so a runtime error or a layout
 * that overflows at 375 px ships straight to their users. For each block this
 * opens the gallery page and checks:
 *   - no uncaught exception and no console error while it mounts;
 *   - on desktop (1280 px) it paints something taller than a stub;
 *   - on a phone (375 px) nothing inside the demo sticks out past the stage
 *     unless a scroller can reach it, the page does not scroll sideways, and
 *     the block does not run past the bottom of the stage.
 *
 * ~175 blocks x 2 viewports is too many page loads for each CI run, so CI
 * checks every 4th block. After adding or changing blocks, run them all:
 *   UI_BLOCKS=all npx playwright test tests/e2e/ui-blocks.spec.ts --project=chromium
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const REGISTRY = readFileSync(new URL('../../website/src/lib/demos.ts', import.meta.url), 'utf8')
const BLOCKS = [...REGISTRY.matchAll(/demo\('([^']+)'[^\n]*?'Blocks'/g)].map((m) => m[1]!)
const picked = process.env.UI_BLOCKS === 'all' ? BLOCKS : BLOCKS.filter((_, i) => i % 4 === 0)

/** Record page errors and console errors from the moment the page opens. */
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    // The gallery shell fetches GitHub stars and thumbnails; a network miss
    // there is not the block's doing.
    if (/Failed to load resource|api\.github\.com|net::ERR_/.test(text)) return
    errors.push(`console: ${text}`)
  })
  return errors
}

async function openBlock(page: Page, id: string) {
  await page.goto(`/sv-grid/#/demos/${id}`)
  const stage = page.locator('.demo-stage').first()
  await stage.waitFor()
  // Painted, not just mounted: the block's root has real height.
  await expect
    .poll(() => stage.evaluate((el) => (el.firstElementChild as HTMLElement | null)?.getBoundingClientRect().height ?? 0), { timeout: 20_000 })
    .toBeGreaterThan(120)
  await page.waitForTimeout(400)
}

/** Elements that escape the stage's right edge with no scroller to reach them. */
function escaping(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.demo-stage')!
    const right = stage.getBoundingClientRect().right
    const canPan = (el: Element) => {
      const ox = getComputedStyle(el).overflowX
      return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1
    }
    const out: string[] = []
    for (const el of stage.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (b.width < 2 || b.height < 2 || b.right <= right + 1) continue
      let ok = canPan(stage)
      for (let p = el.parentElement; !ok && p && p !== stage; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX
        if (canPan(p)) ok = true
        else if ((ox === 'hidden' || ox === 'clip') && p.getBoundingClientRect().right <= right + 1) ok = true
      }
      if (ok) continue
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
      out.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} (+${Math.round(b.right - right)}px)`)
    }
    // A block taller than the stage would paint over the section below it.
    const kids = [...stage.children].map((c) => c.getBoundingClientRect().bottom)
    const spill = Math.round(Math.max(0, ...kids) - stage.getBoundingClientRect().bottom)
    return {
      spill,
      escaping: [...new Set(out)].slice(0, 5),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

test.describe('UI blocks', () => {
  test('the registry has blocks', () => {
    expect(BLOCKS.length).toBeGreaterThan(0)
  })

  for (const id of picked) {
    test(`${id}: loads clean on desktop`, async ({ page }, info) => {
      test.skip(info.project.name !== 'chromium', 'desktop only')
      await page.setViewportSize({ width: 1280, height: 800 })
      const errors = collectErrors(page)
      await openBlock(page, id)
      expect(errors).toEqual([])
    })

    test(`${id}: fits a 375 px phone`, async ({ page }, info) => {
      test.skip(info.project.name !== 'chromium', 'desktop project drives the phone viewport')
      await page.setViewportSize({ width: 375, height: 812 })
      const errors = collectErrors(page)
      await openBlock(page, id)
      const r = await escaping(page)
      expect(r.escaping, `off-screen with no way to scroll to it:\n  ${r.escaping.join('\n  ')}`).toEqual([])
      expect(r.pageOverflow, `page scrolls sideways by ${r.pageOverflow}px`).toBeLessThanOrEqual(0)
      expect(r.spill, `the block runs ${r.spill}px past the bottom of the stage`).toBeLessThanOrEqual(1)
      expect(errors).toEqual([])
    })
  }
})
