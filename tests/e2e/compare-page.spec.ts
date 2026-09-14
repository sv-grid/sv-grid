import { test, expect } from '@playwright/test'

/**
 * The comparison pages (/compare/ and /compare/<slug>/) after hydration.
 *
 * website/src/compare-page-parity.dom.test.ts proves the static and hydrated
 * bodies carry the same text from the same model; tools/competitor-facts.test.ts
 * proves the numbers in that model are ledger values. Neither opens a browser,
 * so neither can see that the live example mounts a real grid, that the hub
 * cards are links a keyboard can reach, or that the page text carries no dash
 * glyph after the site's markdown and template passes.
 */
// The suite's dev server serves the site under /sv-grid/ (playwright.config.ts).
// A dev server someone started by hand serves it at /; point the spec at it
// with SVGRID_E2E_BASE=/ rather than restarting their server.
const BASE = process.env.SVGRID_E2E_BASE ?? '/sv-grid/'
const HUB = `${BASE}compare`
const PAGE = `${BASE}compare/ag-grid`

test('the hub lists every comparison as a real link, grouped', async ({ page }) => {
  await page.goto(HUB)
  await expect(page.locator('h1')).toHaveText('SvGrid vs Other Svelte Data Grids')
  const cards = page.locator('.compare-hub .card > a')
  await expect(cards.first()).toBeVisible()
  const hrefs = await cards.evaluateAll((els) => els.map((a) => a.getAttribute('href') ?? ''))
  expect(hrefs.length).toBeGreaterThan(10)
  expect(new Set(hrefs).size).toBe(hrefs.length)
  for (const h of hrefs) {
    expect(h.startsWith(`${BASE}compare/`)).toBe(true)
    expect(h.slice(BASE.length)).toMatch(/^compare\/[a-z0-9-]+\/$/)
  }
  // Grouped by stack, priority pages first inside a group.
  const groups = await page.locator('.compare-hub h2').allTextContents()
  expect(groups).toContain('Built for Svelte')
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/[—–]/)
})

test('a comparison page renders the facts, the feature table, the benchmark and a live grid', async ({ page }) => {
  await page.goto(PAGE)
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toContainText('SvGrid vs AG Grid')

  // At a glance: a version read from npm, with the date it was read.
  const facts = page.locator('.compare-body section[data-key="facts"]')
  await expect(facts.locator('h2')).toHaveText('At a glance')
  await expect(facts.locator('tbody th', { hasText: 'Latest version' })).toBeVisible()
  const versionRow = facts.locator('tbody tr', { hasText: 'Latest version' })
  await expect(versionRow.locator('td').nth(1)).toHaveText(/^\d+\.\d+\.\d+/)
  await expect(versionRow.locator('td').nth(2)).toHaveText(/\d{1,2} \w{3} \d{4}/)

  // Feature by feature with its legend and a marked "better" cell.
  const features = page.locator('.compare-body section[data-key="features"]')
  await expect(features.locator('h2')).toHaveText('Feature by feature')
  await expect(features.locator('p').first()).toContainText('Paid tier: only in a paid edition')
  await expect(features.locator('td.better').first()).toBeVisible()

  // Benchmark rows come from the ledger, in milliseconds.
  const bench = page.locator('.compare-body section[data-key="benchmark"]')
  await expect(bench.locator('h2')).toHaveText('Measured performance')
  await expect(bench.locator('tbody tr', { hasText: 'Sort, text column' }).locator('td').first()).toHaveText(/\d+(\.\d+)? ms/)

  // The live example mounts a real grid next to the "Live example" section.
  const stage = page.locator('.compare-stage-slot .compare-stage')
  await expect(stage).toBeVisible()
  await expect(stage.locator('.sv-grid-table, table').first()).toBeVisible({ timeout: 20_000 })

  // Sources and the verified line, and a migration guide link.
  await expect(page.locator('.compare-body section[data-key="sources"] li').first()).toBeVisible()
  await expect(page.locator('.compare-body a[href$="/docs/help/migrating-from-ag-grid/"]').first()).toBeVisible()

  // House style: no dash glyph anywhere on the page.
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/[—–]/)
})
