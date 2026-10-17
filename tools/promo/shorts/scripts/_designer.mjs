/**
 * Shared steps for the Studio designer shorts. The designer is filmed as a
 * visitor without a license key gets it: the evaluation card and the New-app
 * wizard open on load, and `prepare` closes both with their own buttons before
 * the first frame. Every edit auto-saves into the project, which render.mjs
 * restores from st3-designer-pristine at the start of each render.
 */
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'), 'tutorials-out', 'app', 'st3-designer')
export const projectFile = (rel) => readFileSync(join(PROJECT, rel), 'utf8')

/** Base clip options: the designer at 1280 wide, rendered at 2x so a crop stays sharp. */
export const designerClip = (extra) => ({ app: 'designer', path: '/', viewport: 1280, scale: 2, waitFor: '.sv-studio__tree-btn', ...extra })

/** Close the evaluation card and the New-app wizard, then open a page from the tree. */
export const openPage = (route) => async (page) => {
  await page.getByRole('button', { name: 'Dismiss' }).first().click({ timeout: 5000 }).catch(() => {})
  await page.locator('.sv-wiz__x').click({ timeout: 5000 }).catch(() => {})
  if (route) await page.locator('.sv-studio__tree-btn', { hasText: route }).first().click()
  await page.waitForTimeout(400)
}

/** Scroll so `locator` sits `offset` px below the top of the window. The designer's
 *  panels grow with their content, so it is the page that scrolls, not the panel. */
export const reveal = (locator, offset = 8) => locator.evaluate((el, off) => {
  window.scrollBy(0, el.getBoundingClientRect().top - off)
}, offset)

/** The inspector's own "Maximize panel" button (third panel: Pages, Canvas, Inspector). */
export const maximizeInspector = async (page) => {
  await page.getByRole('button', { name: 'Maximize panel' }).nth(2).click()
  await page.waitForTimeout(400)
}

/** The inspector section for this page's entity fields, and its server rules. */
export const fieldsSection = (page) => page.locator('details.sv-studio__section', { has: page.locator(':scope > div > ul.sv-studio__fields') }).first()
export const rulesSection = (page) => page.locator('details.sv-studio__section', { has: page.locator(':scope > summary', { hasText: 'Server rules (triggers)' }) }).first()
