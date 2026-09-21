/**
 * E2E: the six Headless demos import from `@svgrid/grid/core`, not the barrel.
 *
 * The claim on the headless landing page is that a reader can copy the demo
 * source and pay for the engine alone. That was not true while the demos
 * imported `@svgrid/grid`, and the switch to the subpath is only proven by
 * the site actually resolving it: `test:types` and vitest resolve the
 * subpath through package.json exports to dist and pass even when the Vite
 * alias is missing and the dev server 500s. So this mounts each demo in the
 * real site and checks that rows render.
 */
import { expect, test } from '@playwright/test'

const DEMOS: Array<[id: string, rowSelector: string]> = [
  ['186-headless-table', 'tbody tr'],
  ['187-headless-virtual', '.hv-row'],
  ['188-headless-styled', 'tbody tr'],
  ['189-headless-shared-state', 'tbody tr'],
  ['190-headless-row-models', 'tbody tr'],
  ['191-headless-server-side', 'tbody tr'],
]

for (const [id, rowSelector] of DEMOS) {
  test(`${id} renders rows from the /core entry`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto(`/sv-grid/#/demos/${id}`)
    const rows = page.locator(rowSelector)
    await expect(rows.first()).toBeVisible({ timeout: 30_000 })
    expect(await rows.count()).toBeGreaterThan(1)
    expect(errors.filter((e) => /@svgrid\/grid\/core|Failed to resolve|500/.test(e))).toEqual([])
  })
}
