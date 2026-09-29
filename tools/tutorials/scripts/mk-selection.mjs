/** Marketing cut: selection and bulk actions. YouTube only, 1920x1080. */
export default {
  id: 'mk-selection',
  kind: 'marketing',
  title: 'Select rows, act on them in bulk',
  description: 'Selection in SvGrid: row checkboxes, a floating bulk-action bar, spreadsheet range selection, and dragging a selected block to move or copy it.',
  tags: ['row selection', 'bulk actions', 'range selection', 'svelte data grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Selection', title: 'Pick rows. Do something with them.', subtitle: 'Checkboxes, a bulk bar, and spreadsheet ranges.' })
      },
      beats: [{ say: 'Selecting rows is only half the job. What the user does next is the other half.', lead: 200 }],
    },
    {
      demo: '430-selection-bar',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Tick a few rows and a bar floats over the grid with the actions you defined, and a live count of what is selected.',
          lead: 400,
          async do(page, h) {
            const boxes = page.locator('.sv-grid-body .sv-grid-checkbox')
            await h.click(boxes.nth(1))
            await h.pause(700)
            await h.click(boxes.nth(2))
            await h.pause(600)
            await h.click(boxes.nth(4))
            await h.pause(1000)
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '429-move-cells',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Cell selection works like a spreadsheet: drag a range, then grab its border and move the block somewhere else.',
          lead: 400,
          async do(page, h) {
            const a = await (await h.cell(1, 1)).boundingBox()
            const b = await (await h.cell(3, 3)).boundingBox()
            if (a && b) {
              await h.moveTo(a.x + a.width / 2, a.y + a.height / 2)
              await page.mouse.down()
              await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
              await page.mouse.up()
            }
            await h.pause(1400)
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
        await h.pause(700)
      },
      beats: [
        {
          say: 'And the corner handle fills a series across the range, the way a spreadsheet does.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(1, /source 1/i)
            await h.pause(200)
            await h.clickCell(1, /source 2/i, { modifiers: ['Shift'] })
            await h.pause(300)
            await h.dragFillHandle({ cells: 6 })
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
        await h.stage.show('end', { kicker: 'Selection API', title: 'Rows, cells, ranges, and select-all as a rule.', subtitle: 'Over server data, select-all means all rows except these, not a list of ids.', lines: ['selectionMode · enableCellSelection · selectionBar', 'svgrid.com/docs/help/rows/selection-bar'] })
      },
      beats: [{ say: 'Over server data, select-all becomes a rule rather than a list of ids, so it works past a million rows. More at svgrid.com.', lead: 200 }],
    },
  ],
}
