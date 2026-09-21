/**
 * Marketing cut: the spreadsheet shell. Title card, four sheet demos, end
 * card. YouTube only, 1920x1080.
 */
export default {
  id: 'spreadsheet-in-the-browser',
  kind: 'marketing',
  title: 'A spreadsheet in your Svelte app',
  description: 'The SvGrid spreadsheet shell: an Excel-style ribbon, a formula engine across sheets, conditional formatting, charts anchored to ranges, and xlsx in and out.',
  tags: ['svelte spreadsheet', 'excel in the browser', 'spreadsheet component', 'formulas', 'xlsx', 'svelte 5'],
  gif: { beats: [1, 2] },
  poster: { beat: 2 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'SvGrid enterprise', title: 'A spreadsheet, as a Svelte component.', subtitle: 'The ribbon, the formula bar, the engine. One tag.' })
      },
      beats: [
        { say: 'Sometimes a grid is not enough and what people want is a spreadsheet. SvGrid ships one.', lead: 200 },
      ],
    },
    {
      demo: '27-spreadsheet-ribbon',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'SvSheet is the whole surface: a six-tab ribbon, the name box and formula bar, lettered columns and sheet tabs, with every Excel shortcut wired in.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(2, /^\s*B\s*$/)
            await h.pause(600)
            await h.click(page.locator('[role="tab"]', { hasText: /^Formulas$/ }).first())
            await h.pause(900)
            await h.click(page.locator('[role="tab"]', { hasText: /^Home$/ }).first())
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '456-sales-report-workbook',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'One formula engine spans the workbook. Orders looks prices up from Products, and Summary adds it all up across sheets.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('[role="tab"]', { hasText: /^Orders$/ }).first())
            await h.pause(900)
            await h.clickCell(1, /^\s*D\s*$/)
            await h.pause(900)
            await h.click(page.locator('[role="tab"]', { hasText: /^Summary$/ }).first())
            await h.pause(600)
            // C5: North revenue, a SUMIF over the Orders sheet, so the formula bar shows the cross-sheet reference.
            await h.clickCell(4, 2)
          },
          hold: 600,
        },
      ],
    },
    {
      demo: '462-regional-scorecard-cf',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Conditional formatting is part of the document: data bars, colour scales and top-N rules over computed values, edited from the ribbon.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(2, /^\s*C\s*$/)
            await h.pause(500)
            await h.type('9800', { delay: 90 })
            await h.press('Enter')
            await h.pause(900)
            await h.clickCell(13, 1)
          },
          hold: 600,
        },
      ],
    },
    {
      demo: '485-sheet-charts-objects',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'Charts anchor to ranges the way Excel anchors them. Change a number and the chart redraws; save, and it lands in the xlsx as a real chart.',
          lead: 400,
          async do(page, h) {
            await h.clickCell(1, /^\s*B\s*$/)
            await h.pause(400)
            await h.type('980', { delay: 90 })
            await h.press('Enter')
            await h.pause(1100)
            await h.park(undefined, undefined, { ms: 500 })
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
        await h.stage.show('end', { kicker: 'SvGrid enterprise', title: 'Excel skills, Svelte app.', subtitle: 'Import a workbook, or start from a cells matrix.', lines: ['npm install @svgrid/grid @svgrid/enterprise', 'svgrid.com/docs/help/cells/spreadsheet-shell'] })
      },
      beats: [
        { say: 'Formulas, formats, charts and files, in a component your users already know how to use. Details at svgrid.com.', lead: 200 },
      ],
    },
  ],
}
