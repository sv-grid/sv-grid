/**
 * "Is your SvelteKit table really server-rendered?" - the A2 video's argument
 * as a carousel. Targets "sveltekit data grid", "sveltekit ssr table".
 *
 * Every screenshot is the `sveltekit` template from create-sv-grid
 * (`npm create @svgrid@latest -- --template sveltekit --theme ember --dark`),
 * production build, and the code is excerpted from that app's own files
 * (src/routes/people/+page.server.ts and +page.svelte): long lines wrapped,
 * props unrelated to sorting left out.
 *
 * The JavaScript-off slides assert what they claim on every render: rows in
 * the page with scripting disabled, and those rows ordered by the URL.
 */

const login = async (page) => {
  // /people is in the template's PROTECTED list. With scripting off the form
  // is a native POST; start waiting for the navigation before the click.
  if (!/\/login/.test(page.url())) return
  await page.waitForSelector('#email', { timeout: 30_000 })
  await page.fill('#email', 'admin@example.com')
  await page.fill('#password', 'password')
  await Promise.all([page.waitForURL(/\/people/, { timeout: 30_000 }), page.click('button[type="submit"]')])
}

/** Distinct rows the grid rendered (data-svgrid-row sits on every cell). */
const rowIndexes = (page) =>
  page.evaluate(() => new Set([...document.querySelectorAll('[data-svgrid-row]')].map((e) => e.getAttribute('data-svgrid-row'))).size)

function people({ query = '', js = true } = {}) {
  return {
    server: 'kit',
    path: `/people${query}`,
    js,
    viewport: { width: 720, height: 760 },
    async setup(page) {
      await login(page)
      if (query && !page.url().includes(query)) await page.goto(`http://localhost:4311/people${query}`, { waitUntil: 'networkidle' })
    },
    waitFor: '[data-svgrid-row]',
    async assert(page) {
      const rows = await rowIndexes(page)
      if (rows < 3) throw new Error(`/people${query} (js ${js ? 'on' : 'off'}) rendered ${rows} rows`)
      if (query.includes('sort=year') && query.includes('dir=desc')) {
        // The Year column, top to bottom, must not increase.
        const years = await page.evaluate(() => {
          const heads = [...document.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent.trim())
          const col = heads.findIndex((t) => t.startsWith('Year'))
          const byRow = new Map()
          for (const cell of document.querySelectorAll('[data-svgrid-row]')) {
            const r = cell.getAttribute('data-svgrid-row')
            byRow.set(r, [...(byRow.get(r) ?? []), cell.textContent.trim()])
          }
          return [...byRow.values()].map((cells) => Number(cells[col]))
        })
        if (years.some((y, i) => i && y > years[i - 1])) throw new Error(`?sort=year&dir=desc rendered years ${years.join(', ')}`)
      }
    },
    selector: '.sv-grid-root',
    trim: true,
  }
}

export default {
  id: 'sveltekit-ssr',
  caption:
    'How to check a SvelteKit data grid really renders on the server: load the rows in +page.server.ts, keep the sort in the URL, then turn JavaScript off. If the rows are still there, it is SSR. Code is the create-sv-grid SvelteKit template. Guide: svgrid.com/docs/getting-started/sveltekit',
  hashtags: ['sveltekit', 'svelte', 'sveltejs', 'ssr', 'webdev', 'javascript', 'typescript', 'fullstack'],
  slides: [
    {
      kind: 'title',
      title: 'Is your SvelteKit table ==really== server-rendered?',
      body: 'There is a ten-second test. Turn JavaScript off and reload.',
      shot: people(),
    },
    {
      kind: 'code',
      title: 'Load the rows on the server.',
      file: 'routes/people/+page.server.ts',
      code: [
        'export const load: PageServerLoad = ({ url, locals }) => {',
        "  const sortBy = (url.searchParams.get('sort')",
        "    ?? 'name') as keyof Person",
        "  const desc = url.searchParams.get('dir') === 'desc'",
        '  return {',
        '    rows: listPeople(sortBy, desc),',
        '    sortBy,',
        '    desc,',
        "    canEdit: locals.user?.role === 'admin',",
        '  }',
        '}',
      ].join('\n'),
      after: 'The sort comes from the URL, so the server can apply it before any HTML is sent.',
    },
    {
      kind: 'code',
      title: 'Let the grid show the sort, not do it.',
      file: 'routes/people/+page.svelte',
      code: [
        '<SvGrid',
        '  data={data.rows}',
        '  {columns}',
        '  sortable',
        '  externalSort',
        '  initialSorting={[{ id: data.sortBy, desc: data.desc }]}',
        '  {onSortingChange}',
        '/>',
      ].join('\n'),
      after: '`externalSort` keeps the header arrows and clicks, and stops the grid re-sorting rows the server already ordered.',
    },
    {
      kind: 'code',
      title: 'A header click writes the URL.',
      code: [
        'function onSortingChange(sorting) {',
        '  const next = new URL(page.url)',
        '  if (sorting.length === 0) {',
        "    next.searchParams.delete('sort')",
        "    next.searchParams.delete('dir')",
        '  } else {',
        "    next.searchParams.set('sort', sorting[0]!.id)",
        "    next.searchParams.set('dir',",
        "      sorting[0]!.desc ? 'desc' : 'asc')",
        '  }',
        '  goto(next, { keepFocus: true, noScroll: true })',
        '}',
      ].join('\n'),
      after: 'SvelteKit 3 removed `keepFocus` and `noScroll`: there it is `goto(next, { reset: false })`.',
    },
    {
      kind: 'shot',
      title: 'JavaScript off. Rows still there.',
      body: 'That is the HTML the server sent. No script ran.',
      shotLabel: 'JavaScript: off',
      shot: people({ js: false }),
    },
    {
      kind: 'shot',
      title: 'And the sort survives a reload.',
      body: 'Same page, still no JavaScript, with the sort in the address.',
      shotLabel: '?sort=year&dir=desc',
      shot: people({ js: false, query: '?sort=year&dir=desc' }),
    },
    {
      kind: 'end',
      title: 'svgrid.com/docs',
      lines: ['Getting started: SvelteKit', '`npm create @svgrid@latest -- --template sveltekit`'],
    },
  ],
}
