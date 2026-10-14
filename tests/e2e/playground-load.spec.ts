/**
 * E2E: the playground opens a demo and renders it.
 *
 * Every demo's "Edit" button lands here, and no other spec opened it. The
 * 2026-10 break (a vitest file in the runner's glob) showed only in the
 * production build, so website/src/lib/shared-glob.test.ts guards that one;
 * this catches the route failing to load or compile on the dev server.
 */
import { expect, test } from '@playwright/test'

test('the playground compiles and mounts the quick-start demo', async ({ page }) => {
  // A cold dev server compiles the playground route and the in-browser
  // Svelte compiler on first request.
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/sv-grid/playground/01-quick-start/')
  await expect(page.getByText("Couldn't load this page")).toHaveCount(0)
  // The preview grid: its header cells come from the compiled demo.
  await expect(page.getByRole('columnheader', { name: 'Company' })).toBeVisible({ timeout: 60_000 })
  expect(errors).toEqual([])
})
