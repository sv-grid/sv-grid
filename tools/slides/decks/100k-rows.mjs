/**
 * "100,000 rows in a Svelte grid" - virtualization, with the DOM counted.
 * Targets "svelte virtual table", "svelte large dataset table".
 *
 * Every number on a slide is measured during the render, on demo
 * 06-large-dataset switched to its 100k x 100 preset: the row the grid is
 * scrolled to, and how many rows and cells are actually in the DOM. Nothing
 * is typed except the preset's own size, which the demo prints and the shot
 * asserts. No timing claims: those depend on the machine.
 *
 * Code: `<SvGrid data={rows} {columns} />` is all it takes because row and
 * column virtualization are both on by default (SvGrid.types.ts). The tuning
 * slide quotes the demo's own props; the `$state.raw` slide is the pattern
 * the demo uses for its rows.
 */
const facts = {}

const ROW_PX = 32 // the demo's rowHeight

function bigGrid({ row = 0, left = 0, record }) {
  return {
    server: 'gallery',
    path: '/#/06-large-dataset',
    viewport: { width: 900, height: 980 },
    waitFor: '[data-svgrid-row]',
    async setup(page) {
      await page.getByRole('button', { name: '100k × 100' }).click()
      await page.waitForFunction(() => /^100,000 rows/.test(document.querySelector('.ds-meta')?.textContent?.trim() ?? ''), null, { timeout: 180_000 })
      await page.waitForSelector('[data-svgrid-row]', { timeout: 60_000 })
      await page.evaluate(([top, x]) => {
        const c = document.querySelector('.sv-grid-container')
        c.scrollTop = top
        c.scrollLeft = x
      }, [row * ROW_PX, left])
      await page.waitForTimeout(1200)
    },
    async assert(page) {
      const m = await page.evaluate(() => {
        const cells = [...document.querySelectorAll('[data-svgrid-row]')]
        const rows = new Map()
        for (const c of cells) {
          const r = Number(c.getAttribute('data-svgrid-row'))
          rows.set(r, (rows.get(r) ?? 0) + 1)
        }
        const meta = document.querySelector('.ds-meta')?.textContent?.trim() ?? ''
        // The first row on screen, not the first in the DOM: overscan keeps
        // 8 rendered rows above the viewport, out of sight.
        const thead = document.querySelector('.sv-grid-root thead, .sv-grid-root [role="rowgroup"]')?.getBoundingClientRect()
        const box = document.querySelector('.sv-grid-container').getBoundingClientRect()
        const under = document.elementFromPoint(box.left + box.width / 2, (thead?.bottom ?? box.top) + 6)
        const onScreen = Number(under?.closest('[data-svgrid-row]')?.getAttribute('data-svgrid-row') ?? under?.closest('[role="row"]')?.querySelector('[data-svgrid-row]')?.getAttribute('data-svgrid-row'))
        return { meta, cells: cells.length, rows: rows.size, first: onScreen, perRow: Math.max(...rows.values()) }
      })
      if (!/^100,000 rows · 100 columns/.test(m.meta)) throw new Error(`the demo says "${m.meta}", not 100,000 rows x 100 columns`)
      if (!Number.isFinite(m.first)) throw new Error('could not find the first row on screen')
      if (row && Math.abs(m.first - row) > 50) throw new Error(`asked for row ${row}, first row on screen is ${m.first}`)
      if (m.rows > 200) throw new Error(`${m.rows} rows in the DOM: virtualization is not doing its job`)
      facts[record] = m
    },
    selector: '.demo-page > main',
  }
}

const fmt = (n) => n.toLocaleString('en-US')

export default {
  id: '100k-rows',
  facts,
  caption:
    '100,000 rows by 100 columns in one Svelte 5 component, and the browser only ever holds the rows and columns you can see. Row and column virtualization are on by default in SvGrid. Bonus: keep big arrays in $state.raw so Svelte does not proxy every row. Try it: svgrid.com/demos/06-large-dataset',
  hashtags: ['svelte', 'sveltejs', 'svelte5', 'webdev', 'javascript', 'performance', 'frontend', 'datagrid'],
  slides: [
    {
      kind: 'title',
      title: '==100,000== rows. 100 columns. One Svelte component.',
      body: (f) => `Scrolled to row ${fmt(f.deep.first + 1)} of 100,000.`,
      shot: bigGrid({ row: 73_400, record: 'deep' }),
    },
    {
      kind: 'code',
      title: 'The code for that.',
      code: '<SvGrid data={rows} {columns} />',
      after: '`rows.length` is 100,000 and there are 100 columns. Row and column virtualization are both on by default, so there is no prop to remember.',
    },
    {
      kind: 'shot',
      title: (f) => `The DOM holds ==${f.deep.rows}== rows.`,
      body: (f) =>
        `Of 100,000. That is ${fmt(f.deep.cells)} cells on the page, not 10,000,000. Only the rows in view are rendered, plus 8 above and below so a fast scroll never shows a gap.`,
    },
    {
      kind: 'shot',
      title: 'Columns work the same way.',
      body: (f) => `Scrolled sideways: ${f.wide.perRow} cells per row are rendered, out of 100 columns.`,
      shot: bigGrid({ row: 41_200, left: 9_000, record: 'wide' }),
    },
    {
      kind: 'code',
      title: 'Svelte 5 tip: `$state.raw` for big arrays.',
      code: [
        '// Deep: each row becomes a proxy once read',
        'let rows = $state<Row[]>([])',
        '',
        '// Reactive when you assign a new array:',
        'let rows = $state.raw<Row[]>([])',
        'rows = await loadRows() // replace, do not push',
      ].join('\n'),
      after: '`$state` is deeply reactive: a row object is wrapped in a proxy when it is read, and a sort reads every row. A grid only needs to know when the array changes. This demo keeps its rows in `$state.raw`.',
    },
    {
      kind: 'code',
      title: 'Tune it if you need to.',
      code: ['rowHeight={32}', 'overscan={8}', 'columnOverscan={3}'].join('\n'),
      after: '`overscan` is rows kept beyond the viewport: raise it for very tall rows, lower it to trim DOM work. These are the demo\'s own values.',
    },
    {
      kind: 'end',
      title: 'svgrid.com/demos',
      lines: ['Demo: 100k rows · 100 columns', '`npm install @svgrid/grid`'],
    },
  ],
}
