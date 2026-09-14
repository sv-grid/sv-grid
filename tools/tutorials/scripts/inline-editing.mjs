/**
 * Tutorial: inline editing. Recorded on demo 05-inline-editing.
 * See tools/tutorials/README.md for the script shape and the `h` helpers.
 */
export default {
  id: 'inline-editing',
  title: 'Inline editing in SvGrid',
  description: 'Turn on inline editing with one prop, edit cells with text, dropdown and date editors, and track pending changes before you save.',
  demo: '05-inline-editing',
  docsPage: 'docs/help/editing/overview.md',
  tags: ['inline editing', 'cell editor', 'svelte data grid', 'editable table'],
  gif: { beats: [0, 1] },

  async setup(page, h) {
    await h.gridReady(5)
    await h.focusGrid()
    await h.pause(600)
  },

  beats: [
    {
      say: 'Inline editing in SvGrid is one prop. Set enableInlineEditing and double-click any cell to start.',
      lead: 1600,
      async do(page, h) {
        await h.dblclickCell(1, /first name/i)
      },
    },
    {
      say: 'Type a new value and press Enter to commit it.',
      lead: 300,
      async do(page, h) {
        await h.type('Margaret', { delay: 120 })
        await h.pause(400)
        await h.press('Enter')
      },
      hold: 500,
    },
    {
      say: 'Columns pick their own editor. Department is a list, so double-clicking it opens a dropdown, and one click picks the value.',
      lead: 900,
      async do(page, h) {
        await h.dblclickCell(2, /department/i)
        await page.waitForSelector('.sv-grid-dropdown-option', { timeout: 10_000 })
        await h.pause(900)
        await h.click(page.locator('.sv-grid-dropdown-option', { hasText: /sales/i }).first())
      },
      hold: 500,
    },
    {
      say: 'Every change is tracked. The pending edits card counts what is not saved yet, and Save changes commits the batch.',
      lead: 1200,
      async do(page, h) {
        await h.hover(page.getByRole('button', { name: /save changes/i }))
      },
      hold: 400,
    },
  ],

  async verify(page, h) {
    const pending = await h.kpi(/pending edits/i)
    if (pending < 1) throw new Error(`no edit registered (pending edits = ${pending})`)
    return `${pending} pending edit(s)`
  },
}
