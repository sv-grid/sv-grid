/**
 * E2E: the demo gallery sidebar works from the keyboard
 * (examples/src/shared/nav-keys.ts, wired in website/src/routes/Demos.svelte).
 *
 *   ArrowDown / ArrowUp move between items, ArrowLeft goes to the group head
 *   and then closes it, ArrowRight opens it and steps in, Enter runs the
 *   focused demo and keeps focus in the sidebar. In the search box, Enter runs
 *   the top result (even when pressed before the results land) and ArrowDown
 *   steps into the list.
 */
import { expect, test, type Page } from '@playwright/test'

const nav = (page: Page) => page.locator('nav[aria-label="Examples"]')
const focused = (page: Page) =>
  page.evaluate(() => ({
    text: (document.activeElement?.textContent ?? '').trim(),
    expanded: document.activeElement?.getAttribute('aria-expanded'),
    id: document.activeElement?.getAttribute('data-demo-id'),
  }))

test.describe('demo sidebar keyboard', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'desktop only')
    await page.goto('/sv-grid/demos/01-quick-start')
    await page.locator('.demo-stage').first().waitFor()
  })

  test('arrow keys walk the tree and Enter runs a demo', async ({ page }) => {
    await nav(page).locator('[data-demo-id="01-quick-start"]').focus()

    await page.keyboard.press('ArrowDown')
    const next = await focused(page)
    expect(next.id).toBeTruthy()
    expect(next.id).not.toBe('01-quick-start')

    await page.keyboard.press('ArrowUp')
    expect((await focused(page)).id).toBe('01-quick-start')

    await page.keyboard.press('ArrowLeft')
    expect((await focused(page)).expanded).toBe('true')
    await page.keyboard.press('ArrowLeft')
    expect((await focused(page)).expanded).toBe('false')
    await page.keyboard.press('ArrowRight')
    expect((await focused(page)).expanded).toBe('true')

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    const target = (await focused(page)).id
    expect(target).toBeTruthy()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/demos/${target}/?$`))
    expect((await focused(page)).id).toBe(target)
  })

  test('Enter in the search box runs the top result, ArrowDown steps into the list', async ({ page }) => {
    const search = page.locator('.list-search')
    await search.fill('pin columns')
    await search.press('Enter')
    await expect(page).not.toHaveURL(/\/demos\/01-quick-start/)

    await search.fill('sparkline')
    await search.press('ArrowDown')
    await expect.poll(async () => (await focused(page)).id).toBeTruthy()
  })
})
