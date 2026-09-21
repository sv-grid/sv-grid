/** Marketing cut: inline editing across editor types. YouTube only, 1920x1080. */
export default {
  id: 'mk-inline-editing',
  kind: 'marketing',
  title: 'Edit in place, every field type',
  description: 'Inline editing on SvGrid: text, dropdown and date editors, a validate hook per column, and editors whose options depend on other cells.',
  tags: ['inline editing', 'cell editor', 'validation', 'cascading dropdown', 'svelte data grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Inline editing', title: 'Edit in place. Every field type.', subtitle: 'One prop turns it on. Each column picks the editor it needs.' })
      },
      beats: [{ say: 'Editing is one prop, and every column brings the right editor with it.', lead: 200 }],
    },
    {
      demo: '05-inline-editing',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Text, dropdowns and dates, in place: double-click, type or pick, press Enter. Pending edits are counted until you save.',
          lead: 400,
          async do(page, h) {
            await h.dblclickCell(1, /first name/i)
            await h.type('Margaret', { delay: 80 })
            await h.press('Enter')
            await h.pause(600)
            await h.dblclickCell(2, /department/i)
            await page.waitForSelector('.sv-grid-dropdown-option', { timeout: 10_000 })
            await h.pause(500)
            await h.click(page.locator('.sv-grid-dropdown-option', { hasText: /design/i }).first())
            await h.pause(600)
            await h.dblclickCell(3, /joined/i)
            await page.waitForSelector('.sv-cal', { timeout: 10_000 }).catch(() => {})
            await h.pause(1200)
            await h.press('Escape')
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '206-cell-validation',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'A validate hook per column rejects bad input with a message before it ever reaches your data.',
          lead: 400,
          async do(page, h) {
            await h.dblclickCell(1, /salary/i)
            await h.press('Control+A')
            await h.type('999999', { delay: 80 })
            await h.press('Enter')
            await h.pause(1600)
            await h.press('Escape')
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '18-cascade-editing',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Editors can depend on each other. Pick a region, and the country list narrows to match.',
          lead: 400,
          async do(page, h) {
            await h.dblclickCell(1, /region/i)
            await page.waitForSelector('.sv-grid-dropdown-option', { timeout: 10_000 })
            await h.pause(600)
            await h.click(page.locator('.sv-grid-dropdown-option').nth(1))
            await h.pause(700)
            await h.dblclickCell(1, /country/i)
            await page.waitForSelector('.sv-grid-dropdown-option', { timeout: 10_000 })
            await h.pause(1200)
            await h.click(page.locator('.sv-grid-dropdown-option').first())
          },
          hold: 600,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Inline editing', title: 'Undo, validation, batch saves.', subtitle: 'On the grid you already render. No form library required.', lines: ['<SvGrid enableInlineEditing />', 'svgrid.com/docs/help/editing/overview'] })
      },
      beats: [{ say: 'Undo, cascading options, validation and batch saves, with one prop. Docs at svgrid.com.', lead: 200 }],
    },
  ],
}
