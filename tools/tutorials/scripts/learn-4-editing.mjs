/**
 * Course lesson 4: editing rows, and refusing input that should not land.
 * Code and result are the runnable block from docs/help/editing/validation.md.
 *
 * Two traps an earlier take fell into, both of which made the video show
 * something other than what the narration claimed:
 *  - `Control+a` is not "select the cell's text". Focus is not in the editor
 *    input as far as that shortcut is concerned, so it selected the whole
 *    page, the typing went nowhere and the cell kept its old value.
 *  - Validation is shown as a HOVER tooltip (plus a visually-hidden span for
 *    assistive tech). Committing an invalid value and then standing still
 *    displays nothing; the pointer has to leave the cell and return.
 * The Age column is also clipped by the frame width, so the validation example
 * uses Email, which is fully visible.
 */
import { typeLines, reveal, SNIPPET_ROW } from '../lib/lesson.mjs'

const SNIPPET = 'help-editing-validation--1'

/** Replace the open editor's content by selecting it in the input itself. */
async function editorText(page, h, text, delay = 110) {
  const input = page.locator('.sv-grid-cell-editing input, .sv-grid-cell-editing textarea').first()
  await input.waitFor({ state: 'visible', timeout: 10_000 })
  await input.selectText()
  await h.type(text, { delay })
}

export default {
  id: 'learn-4-editing',
  kind: 'course',
  title: 'Learn SvGrid 4: editing rows, and validating them',
  description: 'Lesson four of the SvGrid course: make cells editable, pick an editor per column, and use validate with rejectInvalid so bad input never reaches your data.',
  docsPage: 'docs/help/editing/validation.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'inline editing', 'validation', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 4 },
  gif: { beats: [4, 5] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 4', title: 'Editing, and saying no.', subtitle: 'An editor per column, and input that never reaches your data.' })
      },
      beats: [
        { say: 'A table people can only read is half a feature. This lesson makes it editable, and then makes it refuse the edits that should not happen.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/App.svelte', code: '' })
      },
      beats: [
        {
          say: 'The same reactive rows as before. Three people, three fields.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, SNIPPET, 0, 11, 110)
          },
          hold: 250,
        },
        {
          say: 'Each column picks its editor. Text for a name, number for an age. The editor is chosen per column, so the user gets the right control instead of a text box for everything.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 11, 14)
          },
          hold: 250,
        },
        {
          say: 'Then validate. It runs as the cell is edited and returns a message when the value is wrong. Pair it with rejectInvalid and the edit is refused outright rather than written and cleaned up later.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 14, 40, 70)
          },
          hold: 300,
        },
        {
          say: 'Double-click a cell to edit it, type, and press Enter to commit. That is the whole gesture, and it is the one spreadsheet users already know.',
          lead: 300,
          async do(page, h) {
            await reveal(h, SNIPPET)
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(900)
            await h.dblclickCell(0, /name/i)
            await editorText(page, h, 'Ada King')
            await h.pause(500)
            await h.press('Enter')
            await h.pause(1100)
            const now = ((await (await h.cell(0, /name/i)).textContent()) ?? '').trim()
            if (now !== 'Ada King') throw new Error(`name cell reads "${now}" after the edit`)
            h.log(`edit committed: ${now}`)
          },
          hold: 300,
        },
        {
          say: 'Now an email that is not one. Validate runs as you type, and hovering the cell tells the user what is wrong. Press Enter and rejectInvalid refuses the commit outright: the value is still the old one. Your row object is never touched by something you would have to clean up later.',
          lead: 300,
          async do(page, h) {
            const cell = await h.cell(0, /email/i)
            const before = ((await cell.textContent()) ?? '').trim()
            await h.dblclickCell(0, /email/i)
            await editorText(page, h, 'ada@example', 130)
            await h.pause(700)
            // Show the reason BEFORE committing. The message is a hover
            // tooltip, and Enter moves the editor down a row, so hovering
            // afterwards lands on a different (valid) cell and shows nothing.
            // The pointer also has to leave and return for pointerenter.
            await h.park(undefined, undefined, { ms: 450 })
            await h.pause(300)
            await h.hover(cell)
            await page.waitForSelector('.sv-grid-tooltip', { timeout: 15_000 })
            const tip = ((await page.locator('.sv-grid-tooltip').first().textContent()) ?? '').trim()
            if (!/email/i.test(tip)) throw new Error(`validation tooltip read "${tip}"`)
            h.log(`validation tooltip: ${tip}`)
            await h.pause(1400)
            await h.press('Enter')
            await h.pause(900)
            await h.press('Escape')
            await h.pause(700)
            const after = ((await (await h.cell(0, /email/i)).textContent()) ?? '').trim()
            if (after !== before) throw new Error(`rejected edit still landed: "${before}" -> "${after}"`)
            h.log(`value unchanged: ${after}`)
          },
          hold: 400,
        },
        {
          say: 'Undo with control zed, save in batches through the grid API, or hand every commit to your server. The editing pages in the docs cover each of those. Lesson five is selection, and doing something with the rows the user picked.',
          lead: 300,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 600 })
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const rows = await page.locator(SNIPPET_ROW).count()
        if (rows < 3) throw new Error(`the snippet rendered ${rows} rows`)
        return `${rows} editable rows`
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 4 complete', title: 'Next: selection and bulk actions.', subtitle: 'Checkboxes, a floating action bar, and reading what was picked.', lines: ['svgrid.com/docs/help/editing/validation'] })
      },
      beats: [
        { say: 'The file is on the page below and you can edit it there too. See you in lesson five.', lead: 300 },
      ],
    },
  ],
}
