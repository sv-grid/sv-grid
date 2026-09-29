/** Marketing cut: export and print. YouTube only, 1920x1080. */
export default {
  id: 'mk-export',
  kind: 'marketing',
  title: 'Export a Svelte grid to Excel, PDF and print',
  description: 'Export the grid the user is looking at: XLSX with live formulas, PDF, CSV, a printable view, and a password-protected workbook, all from the same API.',
  tags: ['svelte excel export', 'xlsx', 'pdf export', 'print', 'svelte data grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Export and print', title: 'The file they were going to ask for anyway.', subtitle: 'Excel, PDF, CSV and a print view, from the grid on screen.' })
      },
      beats: [{ say: 'Every internal tool gets the same request: can I have this in Excel. Here is the answer.', lead: 200 }],
    },
    {
      demo: '21-export-and-print',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'One call exports what the grid is showing. Sort or filter first and the file follows, because it reads the view, not the raw array.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('main button', { hasText: /Excel \(xlsx\)/i }).first())
            await h.pause(1400)
            await h.click(page.locator('main button', { hasText: /Export PDF/i }).first())
            await h.pause(1400)
          },
          hold: 400,
        },
        {
          say: 'Currency, dates and percentages land formatted, not as raw numbers, and print opens the same view ready for paper.',
          lead: 300,
          async do(page, h) {
            await h.click(page.locator('main button', { hasText: /Export CSV/i }).first())
            await h.pause(1200)
            await h.park(undefined, undefined, { ms: 500 })
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '101-formulas-in-xlsx',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'A total column can go out as a live SUM, so the workbook recalculates in Excel instead of freezing your numbers.',
          lead: 400,
          async do(page, h) {
            const btn = page.locator('main button', { hasText: /export|xlsx/i }).first()
            if (await btn.count()) await h.click(btn)
            await h.pause(1500)
          },
          hold: 500,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'CSV is free', title: 'CSV in the MIT core. Excel and PDF in the pack.', subtitle: 'Password-protected workbooks, styles, multiple sheets, and print templates.', lines: ['api.exportData({ format: "xlsx" })', 'svgrid.com/docs/help/export'] })
      },
      beats: [{ say: 'CSV ships in the free core; Excel, PDF and protected workbooks come with the enterprise pack. Export at svgrid.com.', lead: 200 }],
    },
  ],
}
