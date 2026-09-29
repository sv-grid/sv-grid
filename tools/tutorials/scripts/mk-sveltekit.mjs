/**
 * Marketing cut: SvGrid in a SvelteKit app. The terminal and the code come
 * from docs/getting-started/sveltekit.md verbatim; the result segment is a
 * real demo over network data rather than a staged screenshot.
 * YouTube only, 1920x1080.
 */
const SERVER_LOAD = `// src/routes/people/+page.server.ts
import type { PageServerLoad } from './$types'
import { listPeople } from '$lib/db'

export const load: PageServerLoad = () => {
  return { rows: listPeople() }
}
`

const PAGE = `<!-- src/routes/people/+page.svelte -->
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { Person } from '$lib/db'

  let { data } = $props()

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name' },
    { field: 'role', header: 'Role' },
    { field: 'year', header: 'Year' },
  ]
</script>

<SvGrid data={data.rows} {columns} sortable containerHeight={320} />
`

export default {
  id: 'mk-sveltekit',
  kind: 'marketing',
  title: 'A data grid in a SvelteKit app',
  description: 'Add SvGrid to SvelteKit: rows from a +page.server.ts load, the grid in the page, and real server-rendered HTML rather than an empty shell.',
  tags: ['sveltekit data grid', 'svelte 5', 'ssr table', 'page.server.ts', 'svelte data grid'],
  poster: { beat: 3 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'SvelteKit', title: 'Rows from the server. Grid on the page.', subtitle: 'A load function, a component, and real HTML in the response.' })
      },
      beats: [{ say: 'In SvelteKit the data comes from a load function. SvGrid takes it as a plain array.', lead: 200 }],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('terminal', { title: 'Terminal' })
      },
      beats: [
        {
          say: 'Add the package to an existing project, or scaffold the whole SvelteKit app from the template.',
          lead: 300,
          async do(page, h) {
            await h.stage.term.run('npm install @svgrid/grid', {
              output: [{ text: 'added 2 packages in 1s', after: 900 }],
            })
            await h.pause(500)
            await h.stage.term.run('npm create @svgrid@latest people -- --template sveltekit', {
              typeMs: 38,
              output: [
                { text: '', after: 800 },
                { text: 'Scaffolded people (sveltekit) into ./people', cls: 'ok' },
                '',
                { text: 'Next steps', cls: 'bold' },
                '  cd people',
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
        await h.stage.show('editor', { file: 'src/routes/people/+page.server.ts', code: '' })
      },
      beats: [
        {
          say: 'Query in the load function, on the server, where your database credentials already are.',
          lead: 300,
          async do(page, h) {
            await h.stage.editor.type(SERVER_LOAD, { cps: 80 })
            await h.stage.editor.cursor(false)
          },
          hold: 400,
        },
        {
          say: 'Then the page takes the rows straight from data and hands them to the grid. Type the columns against your row type and every field is checked.',
          lead: 300,
          async do(page, h) {
            await h.stage.editor.open('src/routes/people/+page.svelte', '')
            await h.pause(300)
            await h.stage.editor.type(PAGE, { cps: 90 })
            await h.stage.editor.cursor(false)
          },
          hold: 600,
        },
      ],
    },
    {
      demo: '09-server-side',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'For a table too big to send at once, move sort, filter and paging to the server and the grid requests one page at a time.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('[role="columnheader"]').nth(1))
            await h.pause(1500)
            const next = page.locator('main button', { hasText: /next/i }).first()
            if (await next.count()) {
              await h.click(next)
              await h.pause(1400)
            }
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
        await h.stage.show('end', { kicker: 'It server-renders', title: 'Real rows in the HTML response.', subtitle: 'A viewport of rows before hydration, URL-driven sort, and form actions for edits.', lines: ['npm create @svgrid@latest -- --template sveltekit', 'svgrid.com/docs/getting-started/sveltekit'] })
      },
      beats: [{ say: 'The server HTML carries a viewport of real rows, so the page is useful before hydration. The SvelteKit guide is at svgrid.com.', lead: 200 }],
    },
  ],
}
