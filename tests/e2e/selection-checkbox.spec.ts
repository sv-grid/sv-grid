/**
 * E2E: the row-selection checkbox glyphs.
 *
 * `.sv-grid-checkbox` is a <button>, and its tick / indeterminate dash are
 * drawn as a `::after` box rather than a glyph from a font. The UA stylesheet
 * gives every <button> `padding: 1px 6px` on top of `box-sizing: border-box`,
 * so unless SvGrid.css resets it, 12px of the 16px box goes to padding, the
 * glyph shrinks to fit the 2px that is left, and the tick renders as a bare
 * slanted line while the dash collapses to a dot.
 *
 * This one loads the stylesheet into a bare page instead of visiting a demo
 * route. The site and the admin-dashboard template both run Tailwind, whose
 * preflight zeroes button padding for them - which is exactly why the bug
 * only ever showed up in a scaffolded app with no reset of its own. Measuring
 * the shipped CSS on its own is the only way this stays honest.
 *
 * See packages/grid/src/SvGrid.css (.sv-grid-checkbox).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const CSS = readFileSync(
  fileURLToPath(new URL('../../packages/grid/src/SvGrid.css', import.meta.url)),
  'utf8',
)

// The markup SvGrid.svelte emits for the selection column.
const MARKUP = `
  <button class="sv-grid-checkbox" role="checkbox" aria-checked="false" aria-label="unchecked"></button>
  <button class="sv-grid-checkbox" role="checkbox" aria-checked="true"  aria-label="checked"></button>
  <button class="sv-grid-checkbox" role="checkbox" aria-checked="mixed" aria-label="indeterminate"></button>
`

test.describe('row-selection checkbox glyphs (no page reset)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(MARKUP)
    await page.addStyleTag({ content: CSS })
  })

  test('the button resets the UA padding that would crush the glyph', async ({ page }) => {
    const padding = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.sv-grid-checkbox')!)
      return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]
    })
    expect(padding).toEqual(['0px', '0px', '0px', '0px'])
  })

  test('the checked tick is laid out at its authored 5x9', async ({ page }) => {
    const box = await page.evaluate(() => {
      const after = getComputedStyle(document.querySelector('[aria-checked="true"]')!, '::after')
      return { width: after.width, height: after.height }
    })
    expect(box).toEqual({ width: '5px', height: '9px' })
  })

  test('the indeterminate dash is a bar, not a dot', async ({ page }) => {
    const box = await page.evaluate(() => {
      const after = getComputedStyle(document.querySelector('[aria-checked="mixed"]')!, '::after')
      return { width: after.width, height: after.height }
    })
    expect(box).toEqual({ width: '8px', height: '2px' })
  })

  test('the unchecked box draws no glyph', async ({ page }) => {
    const content = await page.evaluate(
      () => getComputedStyle(document.querySelector('[aria-checked="false"]')!, '::after').content,
    )
    expect(content).toBe('none')
  })
})
