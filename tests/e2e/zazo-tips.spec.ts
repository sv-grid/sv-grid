/**
 * E2E: every tip Zazo gives points at something that is on the page.
 *
 * A tip (examples/src/zazo/zazo-tips.json, one per demo) names a target in
 * its demo, like the "Expand all" button or the Qty header. A rewrite of the
 * demo can drop that element without anything else noticing, and he would
 * then ring nothing. This opens demos and resolves each target the way he
 * does.
 *
 * Every demo is ~440 page loads, too many for each CI run, so CI checks a
 * fixed sample (every 12th demo). After changing demos or tips, run them all:
 *   ZAZO_TIPS=all npx playwright test tests/e2e/zazo-tips.spec.ts --project=chromium
 */
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Tip, TipTarget } from '../../examples/src/zazo/zazo-tips'

const TIPS: Record<string, Tip> = JSON.parse(readFileSync(new URL('../../examples/src/zazo/zazo-tips.json', import.meta.url), 'utf8'))
const all = Object.entries(TIPS)
const picked = process.env.ZAZO_TIPS === 'all' ? all : all.filter((_, i) => i % 12 === 0)

test.describe('Zazo tips', () => {
  for (const [id, tip] of picked) {
    test(`tip target exists: ${id}`, async ({ page }, info) => {
      // The page is the same on a phone; once is enough.
      test.skip(info.project.name !== 'chromium', 'desktop only')
      // Demos of a release still to come (tools/lib/releases.mjs) are routed
      // only once its date has passed.
      await page.addInitScript(() => { (globalThis as { __SVGRID_TODAY__?: string }).__SVGRID_TODAY__ = '2099-01-01' })
      await page.goto(`/sv-grid/#/demos/${id}`)
      await page.locator('.demo-stage').first().waitFor()
      // The same lookup as findTipTarget, inside the page.
      const find = (t: TipTarget) =>
        page.evaluate((t) => {
          const stage = document.querySelector('.demo-stage') ?? document
          const label = (e: Element) => `${e.getAttribute('aria-label') ?? ''} ${(e as HTMLInputElement).placeholder ?? ''} ${e.textContent ?? ''}`
          const all = [...stage.querySelectorAll(t.sel)].filter((e) => {
            const r = e.getBoundingClientRect()
            return r.width > 0 && r.height > 0
          })
          const hits = t.text ? all.filter((e) => label(e).includes(t.text!)) : all
          return !!hits[t.nth ?? 0]
        }, t)
      await expect.poll(() => find(tip.target), { timeout: 20_000, message: `${id}: nothing matches ${JSON.stringify(tip.target)}` }).toBe(true)
    })
  }
})
