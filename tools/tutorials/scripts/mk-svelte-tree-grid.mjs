/**
 * C4 and C6 from the plan, merged: "A tree grid in Svelte."
 *
 * Targets "svelte orgchart" (pos 78), "svelte tree table" and "svelte tree
 * view". The plan listed an org-chart video separately, but there is NO
 * node-and-line org chart in the product: the chart type union is sankey,
 * sunburst and treemap only, and `tree` in the chart API table is a spec FIELD
 * for hierarchies, not a type. Demo 28 is a tree GRID. Titling a video "org
 * chart" would promise a diagram we do not draw, so the two ideas are one
 * video about hierarchies held in flat rows, which is what actually ships.
 *
 * The sunburst at the end is the honest answer to "can I see it as a picture".
 */
import { typeLines, reveal } from '../lib/lesson.mjs'

const TREE = 'help-rows-tree-rows--11'
const ROW = '.br-page-snippet .sv-grid-body [role="row"]'

export default {
  id: 'mk-svelte-tree-grid',
  kind: 'marketing',
  title: 'A tree grid in Svelte: hierarchies from flat rows',
  description: 'Org charts, work breakdowns and permission trees from a flat array: name a parent field and the grid nests the rows, with totals, checkboxes and lazy loading.',
  tags: ['svelte tree grid', 'svelte tree table', 'svelte orgchart', 'svelte tree view', 'hierarchy', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 3 },
  gif: { beats: [3, 4] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'Svelte 5 native',
          title: 'Hierarchies, from flat rows.',
          subtitle: 'Name the parent field. The grid does the nesting.',
        })
      },
      beats: [
        { say: 'Org charts, work breakdowns, folder trees, permission matrices. They all arrive from the database the same way: a flat list of rows where one column points at another row. Turning that into something a person can read is usually where the custom component gets written. It does not need to be.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/Team.svelte', code: '' })
      },
      beats: [
        {
          say: 'Here is the whole thing. Rows with an id and a parent id, exactly as they came out of the query, and one prop that says which field is which. No pre-nesting, no building a tree of children arrays before you render, no recursive component.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, TREE, 0, 50, 90)
            await h.stage.editor.cursor(false)
          },
          hold: 300,
        },
        {
          say: 'The grid works out the depth of every row, draws the expanders, and keeps it a grid: the columns still sort, the cells still edit, and a child row is a row like any other.',
          lead: 300,
          async do(page, h) {
            await reveal(h, TREE, { file: 'src/Team.svelte', focus: 'treeData' })
            await page.waitForSelector(ROW, { timeout: 30_000 })
            const rows = () => page.locator(ROW).count()
            const roots = await rows()
            if (roots < 1) throw new Error(`the tree snippet rendered ${roots} rows`)
            // Roots arrive collapsed, so open one: two rows on screen does not
            // show a hierarchy, and the point of the beat is the nesting.
            const toggle = page.locator(`${ROW} .sv-grid-tree-toggle`).first()
            if (await toggle.count()) {
              await h.click(toggle)
              await h.pause(1500)
              const opened = await rows()
              if (opened <= roots) throw new Error(`opening a root added no children (${roots} -> ${opened})`)
              h.log(`nested from a flat array: ${roots} roots -> ${opened} rows`)
            } else {
              h.log(`${roots} rows nested from a flat array`)
            }
            await h.pause(2200)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '28-org-chart-tree',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Five levels of an employee hierarchy, chief executive down to individual contributors. Arrow keys walk it: right opens a branch, left closes it, and the count at the bottom tracks what is on screen against the whole tree. This is a grid rather than a diagram of boxes and lines, and that is deliberate. A hierarchy you need to read numbers out of wants columns: headcount, reports, tenure, budget, each one sortable, each one addable. A diagram is the right answer when the shape is the message and the wrong one the moment somebody asks which director has the most reports.',
          lead: 350,
          async do(page, h) {
            // The demo's own footer documents the keyboard: "Right expands,
            // Left collapses (while focus is on a name cell)", and prints a
            // live "N visible of M total". Both beat guessing at a chevron's
            // markup, and the counter is a far better assertion than a DOM
            // row count, which virtualization would flatten anyway.
            const counter = page.getByText(/\d+ visible of \d+ total/).first()
            await counter.waitFor({ state: 'visible', timeout: 15_000 })
            const before = ((await counter.textContent()) ?? '').trim()
            await h.clickCell(2, 0)
            await h.pause(700)
            await h.press('ArrowRight')
            await h.pause(1500)
            const after = ((await counter.textContent()) ?? '').trim()
            if (after === before) throw new Error(`expanding changed nothing (${before})`)
            h.log(`expanded a branch: ${before} -> ${after}`)
            await h.pause(1600)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '102-tree-checkbox-cascade',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(3)
        await h.pause(900)
      },
      beats: [
        {
          say: 'The same structure carries behaviour down it. This is a permissions matrix: tick a workspace and every resource under it follows. Now untick one child, and watch the parent. It does not clear and it does not stay ticked; it goes to the indeterminate state, because neither of the other two would be true. That tri-state is the detail people get wrong when they build this by hand, and it is the one that matters, because a checkbox that says yes when the answer is some is a permissions bug waiting to be found by an auditor rather than by you.',
          lead: 350,
          async do(page, h) {
            // The demo draws its own `input.cbx` with a real `indeterminate`
            // PROPERTY (not an attribute), so count in the page rather than
            // with a selector, and assert the tri-state the narration claims.
            const counts = () =>
              page.evaluate(() => {
                const all = [...document.querySelectorAll('input.cbx')]
                return {
                  checked: all.filter((b) => b.checked).length,
                  mixed: all.filter((b) => b.indeterminate).length,
                }
              })
            await page.waitForSelector('input.cbx', { timeout: 15_000 })
            const before = await counts()
            await h.click(page.locator('input.cbx').first())
            await h.pause(1600)
            const ticked = await counts()
            if (ticked.checked <= before.checked) {
              throw new Error(`ticking the parent cascaded nothing (${before.checked} -> ${ticked.checked})`)
            }
            h.log(`cascade: ${before.checked} ticked -> ${ticked.checked} ticked`)
            // Untick one descendant: the ancestors must go indeterminate.
            await h.click(page.locator('input.cbx').nth(2))
            await h.pause(1500)
            const mixed = await counts()
            if (!mixed.mixed) throw new Error('unticking a child produced no indeterminate ancestor')
            h.log(`tri-state: ${mixed.mixed} indeterminate, ${mixed.checked} ticked`)
            await h.pause(1600)
          },
          hold: 400,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 2,
      async setup(page, h) {
        await h.stage.show('end', {
          kicker: 'MIT on npm',
          title: 'npm i @svgrid/grid',
          subtitle: 'One prop turns a flat array into a tree grid. Lazy children, totals per branch, and the same editing as any row.',
          lines: ['svgrid.com/docs/help/rows/tree-rows'],
        })
      },
      beats: [
        { say: 'If the tree is too big to send at once, the same prop works against a server: the grid asks for a branch when someone opens it, and nothing else travels. If you want the hierarchy as a picture rather than a table, the sunburst and the treemap chart types take the same shape of data. The docs page below has the flat array and the one prop from the start of this.', lead: 350 },
      ],
    },
  ],
}
