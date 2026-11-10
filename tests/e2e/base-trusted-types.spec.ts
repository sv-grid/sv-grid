/**
 * E2E: a base with a field of every type (fixtures/base-every-field.svelte) on a page
 * that enforces Trusted Types: `require-trusted-types-for 'script'`, and only the
 * policies SECURITY.md names in `trusted-types`. The grid, the rich text editor and
 * the expanded record render, and the browser reports no violation.
 */
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const FIXTURE = fileURLToPath(new URL('./fixtures/base-every-field.ts', import.meta.url)).replace(/\\/g, '/').replace(/^\//, '')
// What SECURITY.md tells a CSP to allow: SvGrid's own policy, and the one Svelte makes for its templates.
const CSP = "require-trusted-types-for 'script'; trusted-types svgrid svelte-trusted-html"

async function open(page: Page, problems: string[]) {
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' || /trusted/i.test(m.text())) problems.push(`console ${m.type()}: ${m.text()}`)
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      ;((window as unknown as { __violations: string[] }).__violations ??= []).push(`${e.violatedDirective} ${e.sourceFile}:${e.lineNumber} ${e.sample}`)
    })
  })
  // The fixture is mounted by hand: a dev server's reload would take it away mid-test.
  await page.routeWebSocket(/token=/, () => {})
  await page.route('**/sv-grid/__trusted-types.html', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/html', 'content-security-policy': CSP },
      body: `<!doctype html><html><head><meta charset="utf-8"><title>Trusted Types</title></head><body>
<script type="module">import(${JSON.stringify(`/sv-grid/@fs/${FIXTURE}`)}).then((m) => m.show(), (e) => { document.title = 'failed: ' + e.message })</script></body></html>`,
    }),
  )
  await page.setViewportSize({ width: 5600, height: 800 })
  await page.goto('/sv-grid/__trusted-types.html', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-table tbody .sv-grid-row').first().waitFor()
}

const violations = (page: Page) => page.evaluate(() => (window as unknown as { __violations?: string[] }).__violations ?? [])
const cell = (page: Page, field: string) => page.locator('.sv-grid-table tbody .sv-grid-row').first().locator(`[data-col-id="${field}"]`)

test.describe('SvGrid Base under Trusted Types', () => {
  test('every field type renders, the rich text editor opens, and so does the record', async ({ page }) => {
    const problems: string[] = []
    await open(page, problems)
    // The page enforces it: a plain string into an HTML sink throws here. That one report is the probe's own.
    expect(await page.evaluate(() => {
      try {
        document.createElement('div').innerHTML = '<b>x</b>'
        return 'accepted'
      } catch {
        return 'refused'
      }
    })).toBe('refused')
    await expect.poll(() => violations(page)).toHaveLength(1)
    expect(problems.filter((p) => !/requires 'TrustedHTML' assignment/.test(p))).toEqual([])
    await page.evaluate(() => ((window as unknown as { __violations: string[] }).__violations = []))
    problems.length = 0

    // Rich text is drawn as markup, through the `svgrid` policy.
    await expect(cell(page, 'rich').locator('strong')).toHaveText('Bold')
    for (const [field, text] of [['name', 'Alpha 1'], ['notes', 'line one'], ['stage', 'P1'], ['email', 'ann@example.com'], ['site', 'example.com/a'], ['calc', '6']] as const) {
      await expect(cell(page, field)).toContainText(text)
    }
    await expect(cell(page, 'trend').locator('svg')).toHaveCount(1)
    await expect(cell(page, 'files')).toContainText('brief.pdf')

    // The editor of a rich text cell writes its value into a contenteditable.
    const box = (await cell(page, 'rich').boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.press('Enter')
    await expect(page.locator('[contenteditable="true"] strong').first()).toHaveText('Bold')
    await page.keyboard.press('Escape')

    // The expanded record draws each field again, rich text among them.
    const name = (await cell(page, 'name').boundingBox())!
    await page.mouse.click(name.x + 20, name.y + name.height / 2, { button: 'right' })
    await page.getByRole('menuitem', { name: 'Expand record' }).click()
    await page.locator('[data-frv-field]').first().waitFor()
    await expect(page.locator('[data-frv-field="rich"] strong')).toHaveText('Bold')

    expect(await violations(page)).toEqual([])
    expect(problems).toEqual([])
  })
})
