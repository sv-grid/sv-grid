/**
 * Tutorial: install SvGrid and render the first grid. Recorded on the stage
 * (examples/stage.html): a terminal, an editor and a browser frame around the
 * real SvGrid. The code typed is docs/getting-started/2-first-grid.md verbatim,
 * the terminal output is what `npm create @svgrid@latest` prints
 * (packages/create-sv-grid/index.mjs).
 */
const FIRST_GRID = `<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { firstName: string; age: number; status: string }

  const rows: Person[] = [
    { firstName: 'Ada',   age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ]

  const columns: GridColumns<Person> = [
    { field: 'firstName', header: 'First name' },
    { field: 'age',       header: 'Age' },
    { field: 'status',    header: 'Status' },
  ]
</script>

<SvGrid data={rows} columns={columns} />
`

export default {
  id: 'install-svgrid',
  title: 'Install SvGrid',
  description: 'Add the Svelte 5 data grid to a project: one npm package, one import, a data array and a columns array, and a styled table renders.',
  stage: true,
  docsPage: 'docs/getting-started/1-install.md',
  anchor: '## Requirements',
  tags: ['install svgrid', 'svelte data grid', 'npm install', 'getting started', 'first grid'],
  gif: { beats: [3, 4] },
  poster: { beat: 4 },

  async setup(page, h) {
    await h.stage.show('terminal', { title: 'Terminal' })
  },

  beats: [
    {
      say: 'SvGrid is one npm package. In an existing Svelte 5 project, install it and you are done with setup.',
      lead: 900,
      async do(page, h) {
        await h.stage.term.run('npm install @svgrid/grid', {
          output: [{ text: 'added 2 packages in 1s', after: 1100 }],
        })
      },
      hold: 400,
    },
    {
      say: 'Starting from scratch? The create command scaffolds a working project with the grid already wired.',
      lead: 300,
      async do(page, h) {
        await h.stage.term.run('npm create @svgrid@latest my-app -- --template minimal', {
          typeMs: 40,
          output: [
            { text: '', after: 900 },
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
    {
      say: 'Either way, a grid is a component, a data array and a columns array. Import SvGrid and describe the rows.',
      lead: 300,
      async do(page, h) {
        await h.stage.show('split', { file: 'src/App.svelte', code: '', url: 'localhost:5173' })
        await h.stage.editor.type(FIRST_GRID.split('\n').slice(0, 10).join('\n') + '\n', { cps: 70 })
      },
    },
    {
      say: 'Columns map a field to a header. Then render the component with both.',
      lead: 200,
      async do(page, h) {
        await h.stage.editor.type(FIRST_GRID.split('\n').slice(10).join('\n'), { cps: 70 })
        await h.stage.editor.cursor(false)
      },
      hold: 300,
    },
    {
      say: 'Save, and the dev server shows a styled table with keyboard navigation, selection and a focus ring, all out of the box.',
      lead: 200,
      async do(page, h) {
        await h.stage.browser.mount('first-grid', { loadMs: 700 })
        await h.pause(900)
        await h.click(page.locator('.sv-grid-body [role="row"]').nth(1).locator('[role="gridcell"]').first())
        await h.pause(500)
        await h.press('ArrowDown')
        await h.pause(400)
        await h.press('ArrowRight')
      },
      hold: 600,
    },
    {
      say: 'Sorting, filtering, editing and the rest are features you switch on next. The docs at svgrid.com take it from here.',
      lead: 300,
      async do(page, h) {
        await h.park(undefined, undefined, { ms: 500 })
      },
      hold: 400,
    },
  ],

  async verify(page) {
    const rows = await page.locator('.sv-grid-body [role="row"]').count()
    if (rows < 3) throw new Error(`the first grid shows ${rows} rows`)
    return `${rows} rows rendered from the typed file`
  },
}
