/** Marketing cut: spreadsheet habits on the plain grid. YouTube only, 1920x1080. */
export default {
  id: 'mk-excel-on-a-grid',
  kind: 'marketing',
  title: 'Excel habits on a data grid',
  description: 'The gestures spreadsheet users bring with them, on SvGrid: the filter menu with a value list, the fill handle, and Excel keyboard shortcuts.',
  tags: ['excel filter', 'fill handle', 'keyboard shortcuts', 'svelte data grid', 'spreadsheet like grid', 'svelte 5'],
  poster: { beat: 2 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Spreadsheet muscle memory', title: 'Excel habits, on a data grid.', subtitle: 'Filters, the fill handle and the shortcuts, on plain grid data.' })
      },
      beats: [{ say: 'Your users learned spreadsheets first. SvGrid meets them where they are.', lead: 200 }],
    },
    {
      demo: '03-excel-filters',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Every column gets the filter menu they know: a value list with counts, a search box and conditions.',
          lead: 500,
          async do(page, h) {
            await h.clickHeaderFilter(/department/i)
            await page.waitForSelector('[role="listbox"][aria-label="Filter values"] [role="option"]', { timeout: 10_000 })
            await h.pause(700)
            const options = page.locator('[role="listbox"][aria-label="Filter values"] [role="option"]')
            await h.click(options.nth(1))
            await h.pause(600)
            await h.click(options.nth(3))
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '95-fill-handle',
      zoom: 1.3,
      hideIntro: 'hover the bottom-right corner',
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'The fill handle continues a series: numbers, dates and weekdays, or repeats a single value.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(1, /source 1/i)
            await h.pause(200)
            await h.clickCell(1, /source 2/i, { modifiers: ['Shift'] })
            await h.pause(300)
            await h.dragFillHandle({ cells: 6 })
            await h.pause(500)
            await h.clickCell(4, /source 1/i)
            await h.pause(200)
            await h.clickCell(4, /source 2/i, { modifiers: ['Shift'] })
            await h.pause(300)
            await h.dragFillHandle({ cells: 5 })
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '452-excel-shortcuts',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Turn on sheet mode and the keyboard follows: Control plus an arrow jumps to the edge of the data, Shift extends the selection.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(1, 1)
            await h.pause(500)
            await h.press('Control+ArrowDown')
            await h.pause(900)
            await h.press('Control+Shift+ArrowRight')
            await h.pause(900)
            await h.press('Control+Shift+ArrowUp')
          },
          hold: 700,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'On grid data', title: 'Spreadsheet gestures. No spreadsheet.', subtitle: 'Cut, copy, paste, fill, move, undo. All on the plain SvGrid.', lines: ['npm install @svgrid/grid', 'svgrid.com/demos'] })
      },
      beats: [{ say: 'Paste special, find and replace, move a range, undo. All of it on the grid you already have. Demos at svgrid.com.', lead: 200 }],
    },
  ],
}
