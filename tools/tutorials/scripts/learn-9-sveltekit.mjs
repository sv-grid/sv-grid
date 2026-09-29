/**
 * Course lesson 9: SvGrid in a SvelteKit app.
 *
 * The load function and the page are copied verbatim from
 * docs/getting-started/sveltekit.md. They are not runnable doc snippets,
 * because a `+page.server.ts` importing `$lib/db` cannot execute in the
 * browser; keep them in step with that page by hand. The running proof is a
 * real demo over the network.
 */
import { firstRow } from '../lib/lesson.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

/**
 * These two files are hand-copied from the docs page rather than extracted as
 * runnable snippets (a `+page.server.ts` importing `$lib/db` cannot run in a
 * browser), so nothing else would notice them drifting apart. This does: the
 * distinctive lines of each must still be on that page.
 */
function assertMatchesDocs() {
  const doc = readFileSync(resolve('docs/getting-started/sveltekit.md'), 'utf8')
  const needles = [
    'export const load: PageServerLoad',
    'listPeople()',
    "import type { Person } from '$lib/db'",
    '<SvGrid data={data.rows} {columns} sortable',
  ]
  const missing = needles.filter((n) => !doc.includes(n))
  if (missing.length) {
    throw new Error(`lesson 9 has drifted from docs/getting-started/sveltekit.md: ${missing.join(' | ')}`)
  }
  return `${needles.length} lines still match the docs page`
}

export default {
  id: 'learn-9-sveltekit',
  kind: 'course',
  title: 'Learn SvGrid 9: SvelteKit end to end',
  description: 'Lesson nine of the SvGrid course: query in a load function, hand the rows to the page, and get real server-rendered HTML instead of an empty shell.',
  docsPage: 'docs/getting-started/sveltekit.md',
  tags: ['sveltekit data grid', 'learn svgrid', 'ssr', 'page.server.ts', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 4 },
  gif: { beats: [4, 5] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 9', title: 'SvelteKit, end to end.', subtitle: 'Load on the server, render on the page, ship real HTML.' })
      },
      beats: [
        { say: 'SvelteKit gives you a place to put the query that is already on the server. The grid does not need to know about any of it: it takes an array.', lead: 300 },
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
          say: 'There is a SvelteKit template, so the whole app is two commands. If you have a project already, installing the package is enough.',
          lead: 400,
          async do(page, h) {
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
          hold: 450,
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
          say: 'The load function runs on the server. Your database credentials are already there, so the query belongs there too, and the browser never sees it.',
          lead: 400,
          async do(page, h) {
            await h.stage.editor.type(SERVER_LOAD, { cps: 80 })
            await h.stage.editor.cursor(false)
          },
          hold: 400,
        },
        {
          say: 'The page takes what that returned and hands it straight to the grid. Type the columns against your row type, as in lesson two, and the compiler checks the field names for you.',
          lead: 300,
          async do(page, h) {
            await h.stage.editor.open('src/routes/people/+page.svelte', '')
            await h.pause(400)
            await h.stage.editor.type(PAGE, { cps: 90 })
            await h.stage.editor.cursor(false)
          },
          hold: 500,
        },
      ],
      verify: assertMatchesDocs,
    },
    {
      demo: '497-live-rest-dummyjson',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4, 90_000)
        await h.focusGrid()
        await h.pause(1000)
      },
      beats: [
        {
          say: 'Here is a grid over a real endpoint, which is what your page becomes once the load function points at a database instead of a demo API.',
          lead: 400,
          async do(page, h) {
            const before = await firstRow(page)
            const next = page.locator('main button', { hasText: /next/i }).first()
            await next.waitFor({ state: 'visible', timeout: 15_000 })
            await h.click(next)
            await h.pause(1800)
            const after = await firstRow(page)
            if (after === before) throw new Error('the next page never arrived from the API')
            await h.click(next)
            await h.pause(1600)
            h.log('two pages fetched over the network')
          },
          hold: 400,
        },
        {
          say: 'The part worth knowing: the server HTML contains a viewport of real rows, not an empty container waiting for hydration. A crawler sees data, and a reader sees the table before the JavaScript arrives.',
          lead: 300,
          async do(page, h) {
            await h.easedScroll(0.3, 2200)
          },
          hold: 400,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 9 complete', title: 'Next: going to production.', subtitle: 'Virtualization, accessibility, CSP, and the one TypeScript trap.', lines: ['svgrid.com/docs/getting-started/sveltekit'] })
      },
      beats: [
        { say: 'URL-driven sorting and form actions for edits are on the page below. One lesson to go.', lead: 300 },
      ],
    },
  ],
}
