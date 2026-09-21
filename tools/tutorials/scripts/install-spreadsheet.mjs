/**
 * Tutorial: install the spreadsheet shell and use it. Recorded on the stage:
 * terminal, editor, then the real SvSheet in the browser frame with formulas
 * typed into it. Code as docs/help/cells/spreadsheet-shell.md; the install
 * lines as docs/enterprise/getting-started.md.
 */
const SHEET_CODE = `<script>
  import { SvSheet, createWorkbook } from '@svgrid/enterprise'

  const wb = createWorkbook([
    {
      name: 'Budget',
      cells: [
        ['Line',    'Jan',   'Feb',   'Mar'],
        ['Rent',    '2400',  '2400',  '2400'],
        ['Payroll', '18500', '18500', '19200'],
        ['Cloud',   '1320',  '1410',  '1385'],
        ['Travel',  '640',   '910',   '720'],
        ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)'],
      ],
    },
  ])
</script>

<SvSheet workbook={wb} />
`

export default {
  id: 'install-spreadsheet',
  title: 'Install the SvGrid spreadsheet',
  description: 'Add an Excel-style spreadsheet to a Svelte app: install the enterprise package, pass a workbook to SvSheet, and type formulas into a ribbon-driven sheet.',
  stage: true,
  docsPage: 'docs/help/cells/spreadsheet-shell.md',
  anchor: '## What you get',
  tags: ['svelte spreadsheet', 'excel in the browser', 'svsheet', 'spreadsheet component', 'formulas'],
  gif: { beats: [3, 4] },
  poster: { beat: 4 },

  async setup(page, h) {
    await h.stage.show('terminal', { title: 'Terminal' })
  },

  beats: [
    {
      say: 'The spreadsheet ships in the enterprise package. Install it next to the grid; it runs unlicensed for evaluation.',
      lead: 900,
      async do(page, h) {
        await h.stage.term.run('npm install @svgrid/grid @svgrid/enterprise', {
          output: [{ text: 'added 4 packages in 2s', after: 1200 }],
        })
      },
      hold: 400,
    },
    {
      say: 'A workbook is plain data: sheets with a name and a cells matrix. Formulas are strings that start with an equals sign.',
      lead: 300,
      async do(page, h) {
        await h.stage.show('split', { file: 'src/App.svelte', code: '', url: 'localhost:5173' })
        await h.stage.editor.type(SHEET_CODE.split('\n').slice(0, 15).join('\n') + '\n', { cps: 75 })
      },
    },
    {
      say: 'Hand it to SvSheet. That is the whole API.',
      lead: 200,
      async do(page, h) {
        await h.stage.editor.type(SHEET_CODE.split('\n').slice(15).join('\n'), { cps: 75 })
        await h.stage.editor.cursor(false)
      },
      hold: 300,
    },
    {
      say: 'The result is the full surface: a ribbon, the name box and formula bar, lettered columns, sheet tabs and a status bar, with the totals already computed.',
      lead: 200,
      async do(page, h) {
        await h.stage.show('browser', { url: 'localhost:5173' })
        await h.stage.browser.mount('sheet-budget', { loadMs: 700 })
        await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 20_000 })
        await h.pause(700)
        await h.clickCell(5, /^\s*B\s*$/)
      },
      hold: 500,
    },
    {
      say: 'It behaves like a spreadsheet. Type a formula into a cell, press Enter, and the value appears while the formula bar keeps the source.',
      lead: 200,
      async do(page, h) {
        await h.clickCell(7, /^\s*A\s*$/)
        await h.type('Average', { delay: 70 })
        await h.press('Tab')
        await h.pause(300)
        await h.type('=AVERAGE(B2:B5)', { delay: 80 })
        await h.pause(400)
        await h.press('Enter')
        await h.pause(600)
        await h.clickCell(7, /^\s*B\s*$/)
      },
      hold: 700,
    },
    {
      say: 'Every Excel shortcut, fill handle, number formats, conditional formatting and xlsx import and export come with it. The docs list the whole surface.',
      lead: 300,
      async do(page, h) {
        await h.click(page.getByRole('tab', { name: /^formulas$/i }).first().or(page.locator('button, [role="tab"]').filter({ hasText: /^Formulas$/ }).first()))
        await h.pause(900)
        await h.park(undefined, undefined, { ms: 500 })
      },
      hold: 400,
    },
  ],

  async verify(page, h) {
    const text = await (await h.cell(7, /^\s*B\s*$/)).textContent()
    const value = Number(String(text).replace(/[^\d.]/g, ''))
    if (!(value > 5000 && value < 6000)) throw new Error(`B8 shows "${text}", expected the average 5715`)
    return `B8 = ${String(text).trim()}`
  },
}
