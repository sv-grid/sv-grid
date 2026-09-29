/**
 * Course lesson 1: install SvGrid and render the first grid.
 *
 * The code the viewer sees is the runnable block from
 * docs/getting-started/2-first-grid.md, fetched at record time from the file
 * tools/build-doc-snippets.mjs extracted, and the result beside it is that
 * same file compiled. Nothing here is staged: if the doc changes, the video
 * changes with it.
 */
import { activeCell } from '../lib/lesson.mjs'

const SNIPPET = 'getting-started-2-first-grid--0'

/** Type a line range of the snippet's own source into the editor scene. */
const typeLines = async (h, from, to, cps = 95) => {
  const src = await h.stage.browser.source(SNIPPET)
  const lines = src.split('\n')
  const chunk = lines.slice(from, to).join('\n') + '\n'
  await h.stage.editor.type(chunk, { cps })
}

export default {
  id: 'learn-1-first-grid',
  kind: 'course',
  title: 'Learn SvGrid 1: install and your first grid',
  description: 'Lesson one of the SvGrid course: install the package, write a twenty-line component, and get a styled, keyboard-navigable table.',
  docsPage: 'docs/getting-started/2-first-grid.md',
  anchor: '## What you got out of the box',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'svelte 5 table', 'getting started', 'svelte tutorial'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 6 },
  gif: { beats: [5, 6] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 1', title: 'Install, and your first grid.', subtitle: 'One package, twenty lines, a table you can use.' })
      },
      beats: [
        {
          say: 'Welcome to lesson one. By the end of it you will have a working data grid in a Svelte 5 project, and you will understand every line that put it there.',
          lead: 300,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('terminal', { title: 'Terminal' })
      },
      beats: [
        {
          say: 'SvGrid is a single npm package. There is no CLI step and nothing to copy into your project: you install it and import from it.',
          lead: 400,
          async do(page, h) {
            await h.stage.term.run('npm install @svgrid/grid', {
              output: [{ text: 'added 2 packages in 1s', after: 1100 }],
            })
          },
          hold: 400,
        },
        {
          say: 'It needs Svelte 5, because the grid is built on runes. If you are starting from nothing, the create command scaffolds a project with the grid already wired up.',
          lead: 300,
          async do(page, h) {
            await h.stage.term.run('npm create @svgrid@latest my-app -- --template minimal', {
              typeMs: 38,
              output: [
                { text: '', after: 800 },
                { text: 'Scaffolded my-app (minimal) into ./my-app', cls: 'ok' },
                '',
                { text: 'Next steps', cls: 'bold' },
                '  cd my-app',
                '  npm install',
                '  npm run dev',
              ],
            })
          },
          hold: 500,
        },
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
          say: 'Now the component. Import SvGrid, and import the GridColumns type as well. That type is what makes the column list check itself against your rows.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, 0, 5)
          },
          hold: 300,
        },
        {
          say: 'Your data is a plain array of plain objects. No store, no wrapper, no adapter. If you already have rows in your app, they are already in the right shape.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, 5, 11)
          },
          hold: 300,
        },
        {
          say: 'Columns are the other half. Each one maps a field on your row to a header the user reads. Because the array is typed as GridColumns of Person, a typo in a field name is a compile error, not a blank column.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, 11, 18)
          },
          hold: 300,
        },
        {
          say: 'Then render the component with both. That is the whole API for a basic grid: data in, columns in.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, 18, 40, 70)
            await h.stage.editor.cursor(false)
          },
          hold: 400,
        },
        {
          say: 'Save, and the dev server shows this. A real table element, with a header row and your three rows in it.',
          lead: 300,
          async do(page, h) {
            const src = await h.stage.browser.source(SNIPPET)
            await h.stage.show('split', { file: 'src/App.svelte', code: src, url: 'localhost:5173' })
            await h.stage.editor.cursor(false)
            await h.stage.browser.snippet(SNIPPET, { loadMs: 700 })
            await page.waitForSelector('.br-page-snippet .sv-grid-body [role="row"]', { timeout: 30_000 })
            await h.pause(1200)
          },
          hold: 400,
        },
        {
          say: 'You did not ask for any of this, but you got it: click a cell and it takes focus, arrow keys move between cells, Home and End jump to the ends of a row. That is the ARIA grid pattern, on by default.',
          lead: 300,
          async do(page, h) {
            const cell = page.locator('.br-page-snippet .sv-grid-body [role="gridcell"]').first()
            await h.click(cell)
            await h.pause(700)
            const start = await activeCell(page)
            for (const key of ['ArrowDown', 'ArrowRight', 'ArrowDown']) {
              await h.press(key)
              await h.pause(450)
            }
            const moved = await activeCell(page)
            if (!start || moved === start) throw new Error(`arrow keys did not move the active cell (${start} -> ${moved})`)
            await h.press('End')
            await h.pause(800)
            const end = await activeCell(page)
            if (end === moved) throw new Error('End did not jump to the end of the row')
            await h.press('Home')
            await h.pause(600)
            const home = await activeCell(page)
            if (home === end) throw new Error('Home did not jump back to the start of the row')
            h.log(`keyboard: ${start} -> ${moved} -> End ${end} -> Home ${home}`)
          },
          hold: 400,
        },
        {
          say: 'What you do not have yet is sorting, filtering or paging. Those are switched on deliberately, so a grid you never configured stays small in your bundle. Lesson two puts your own data in, and lesson three turns those features on.',
          lead: 300,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 600 })
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const rows = await page.locator('.br-page-snippet .sv-grid-body [role="row"]').count()
        if (rows < 3) throw new Error(`the snippet rendered ${rows} rows, expected 3`)
        return `${rows} rows from the doc snippet`
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 1 complete', title: 'Next: your data, your columns.', subtitle: 'Row types, headers, widths, alignment and formats.', lines: ['npm install @svgrid/grid', 'svgrid.com/docs/getting-started/2-first-grid'] })
      },
      beats: [
        {
          say: 'The code from this lesson is on the page linked below, and it runs there too. See you in lesson two.',
          lead: 300,
        },
      ],
    },
  ],
}
