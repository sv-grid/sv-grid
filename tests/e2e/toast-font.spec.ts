/**
 * E2E: toasts draw in the grid's font.
 *
 * SvToaster portals itself to <body>, outside any .sv-grid-root, so a toast
 * does not inherit the root's `font-family: var(--sg-font)`. In an app that
 * sets no body font the toast drew in the browser's serif default (Times).
 * Found filming the Base app `npm create @svgrid -- -t base` scaffolds
 * (@svgrid/enterprise 3.1.21): the "Done closes the task" automation's toast
 * was serif beside the sans-serif board.
 *
 * Like menu-font.spec.ts this loads the styles into a bare page: every demo
 * route runs the website's own font stack, which hides the bug. The toaster's
 * styles live in the component, so they are read from its <style> block.
 *
 * See packages/grid/src/SvToaster.svelte (.sv-toaster).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const SRC = readFileSync(
  fileURLToPath(new URL('../../packages/grid/src/SvToaster.svelte', import.meta.url)),
  'utf8',
)
// Every rule in the component is :global(...); unwrap them to plain CSS.
const CSS = (SRC.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(/:global\(([^)]*\)?)\)/g, '$1')

// A theme names its font on :root (themes/ember.css does); the page itself
// sets none, as a fresh `npm create vite` app does not.
const THEME = ':root { --sg-font: "Courier New", monospace; }'

// What SvToaster emits, portaled to <body>, beside a grid root.
const MARKUP = `
  <div class="sv-grid-root" style="font-family: var(--sg-font)"><span class="cell">cell</span></div>
  <div class="sv-toaster sv-toaster--bottom-right">
    <div class="sv-toast sv-toast--success"><span class="sv-toast__icon">✓</span>
      <div class="sv-toast__content"><div class="sv-toast__msg">Column adder popup is done</div></div>
      <button type="button" class="sv-toast__x">&times;</button>
    </div>
  </div>
`

test.describe('toast font (no page font)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(MARKUP)
    await page.addStyleTag({ content: CSS + THEME })
  })

  test('the styles were read from the component', () => {
    expect(CSS).toContain('.sv-toaster {')
  })

  for (const sel of ['.sv-toast__msg', '.sv-toast__x']) {
    test(`${sel} uses the grid font, not the page default`, async ({ page }) => {
      const [cell, toast] = await page.evaluate(
        (s) => [getComputedStyle(document.querySelector('.cell')!).fontFamily, getComputedStyle(document.querySelector(s)!).fontFamily],
        sel,
      )
      expect(cell).toContain('Courier New')
      expect(toast).toBe(cell)
    })
  }
})
