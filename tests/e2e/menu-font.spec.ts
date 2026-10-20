/**
 * E2E: the grid's menus and tooltips draw in the grid's font.
 *
 * GridMenus renders after .sv-grid-root, as its sibling, so a menu does not
 * inherit the root's `font-family: var(--sg-font)`. In an app that sets no
 * body font the filter menu drew in the browser's serif default (Times) while
 * the cells beside it used the theme font. Found filming a bare Vite + Svelte 5
 * app on @svgrid/grid 3.0.17 with the Ember theme.
 *
 * Like selection-checkbox.spec.ts this loads the stylesheet into a bare page:
 * every demo route runs the website's own font stack, which hides the bug.
 *
 * See packages/grid/src/SvGrid.css (.sv-grid-menu, .sv-grid-tooltip).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const CSS = readFileSync(
  fileURLToPath(new URL('../../packages/grid/src/SvGrid.css', import.meta.url)),
  'utf8',
)

// A theme names its font on :root (themes/ember.css does); the page itself
// sets none, as a fresh `npm create vite` app does not.
const THEME = ':root { --sg-font: "Courier New", monospace; }'

// What SvGrid.svelte emits: the root, then GridMenus as its sibling.
const MARKUP = `
  <div class="sv-grid-root"><span class="cell">cell</span></div>
  <div class="sv-grid-menu sv-grid-filter-menu"><span class="label">Filter condition</span></div>
  <div class="sv-grid-tooltip">A note</div>
`

test.describe('menu and tooltip font (no page font)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(MARKUP)
    await page.addStyleTag({ content: CSS + THEME })
  })

  for (const sel of ['.sv-grid-menu .label', '.sv-grid-tooltip']) {
    test(`${sel} uses the grid font, not the page default`, async ({ page }) => {
      const [cell, overlay] = await page.evaluate(
        (s) => [getComputedStyle(document.querySelector('.cell')!).fontFamily, getComputedStyle(document.querySelector(s)!).fontFamily],
        sel,
      )
      expect(cell).toContain('Courier New')
      expect(overlay).toBe(cell)
    })
  }
})
