/**
 * E2E: the editing cell draws ONE border, and the same one for every editor.
 *
 * Each editor used to bring its own focus ring and they disagreed - the text
 * and number inputs a 2px accent-at-30% halo outside the cell, the dropdown
 * trigger a solid 2px outline inside it, the checkbox none at all - so the
 * border was single, double or missing depending on the column. The cell now
 * owns it: a 2px band straddling the cell's grid line, drawn by ::after so it
 * paints over the editor's opaque background.
 *
 * Real browser, because the rules have to out-specify the dropdown's and the
 * date picker's component-scoped `:focus` styles with both stylesheets loaded.
 */
import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/05-inline-editing'

// One column per editor kind that renders differently in-cell.
const COLUMNS = ['First name', 'Age', 'Department', 'Joined', 'Active']

test.describe('editing cell border', () => {
  test('is one 2px ring straddling the grid line, for every editor', async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()

    const headers = await page.$$eval('.sv-grid-column', (els) =>
      els.map((el) => (el.textContent ?? '').trim()),
    )

    for (const name of COLUMNS) {
      const index = headers.findIndex((h) => h.startsWith(name))
      expect(index, `column ${name}`).toBeGreaterThan(-1)

      const cell = page.locator('tbody.sv-grid-body tr').nth(2).locator('td').nth(index)
      await cell.scrollIntoViewIfNeeded()
      await cell.dblclick()
      await page.locator('.sv-grid-cell-editing').waitFor()

      const ring = await page.evaluate(() => {
        const cellEl = document.querySelector('.sv-grid-cell-editing')!
        const after = getComputedStyle(cellEl, '::after')
        const editor = cellEl.querySelector(
          'input, select, button, .sv-dtp__field, .sv-grid-dropdown-trigger, textarea',
        )
        const es = editor ? getComputedStyle(editor) : null
        return {
          width: after.borderTopWidth,
          style: after.borderTopStyle,
          // -1px on every side puts half the 2px band over the grid line.
          offset: [after.top, after.right, after.bottom, after.left],
          editorShadow: es?.boxShadow ?? 'none',
          editorOutline: es?.outlineStyle ?? 'none',
        }
      })

      expect(ring.width, name).toBe('2px')
      expect(ring.style, name).toBe('solid')
      expect(ring.offset, name).toEqual(['-1px', '-1px', '-1px', '-1px'])
      // No second ring from the editor itself.
      expect(ring.editorShadow, name).toBe('none')
      expect(ring.editorOutline, name).toBe('none')

      await page.keyboard.press('Escape')
      await page.locator('.sv-grid-cell-editing').waitFor({ state: 'detached' })
    }
  })
})
