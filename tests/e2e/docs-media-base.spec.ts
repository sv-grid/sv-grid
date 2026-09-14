import { test, expect } from '@playwright/test'

/**
 * Docs media under a site base. The markdown writes its images and tutorial
 * figures root-absolute (`/docs-media/...`, `/tutorials/...`), which is
 * right at svgrid.com and was a 404 under the `/sv-grid/` base this suite
 * runs on: every docs image and every tutorial poster. The page prefixes the
 * base once the article is in the DOM; this loads a page that carries both
 * and checks nothing under those roots 404s and the image actually decoded.
 */
test('docs images and tutorial media resolve under the site base', async ({ page }) => {
  const missing: string[] = []
  page.on('response', (r) => {
    if (r.status() === 404 && /\/(docs-media|tutorials)\//.test(r.url())) missing.push(r.url())
  })
  await page.goto('/sv-grid/docs/help/pivot')
  const img = page.locator('article img[src*="grid-pivot"]').first()
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(img).toHaveAttribute('src', /^\/sv-grid\/docs-media\//)
  const video = page.locator('figure.docs-tutorial video').first()
  await expect(video).toHaveAttribute('poster', /^\/sv-grid\/tutorials\//)
  await page.waitForTimeout(500)
  expect(missing).toEqual([])
})
