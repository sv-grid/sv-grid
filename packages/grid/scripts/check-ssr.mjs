/**
 * Assert that `<SvGrid>` actually server-renders its rows.
 *
 * This lives here rather than in vitest because the grid's vitest config pins
 * `conditions: ['browser']` so component tests can `mount()`. That makes
 * `svelte/server`'s `render()` unusable there, and a jsdom approximation would
 * not exercise the real server compile anyway. This builds the component with
 * `generate: 'server'` - the same path SvelteKit takes for a `+page.server.ts`
 * load - and asserts on the HTML string.
 *
 * Why it exists: both virtualizers learn their row/column `count` from an
 * `$effect`, and effects never run during SSR. The server therefore used to
 * emit a grid shell with an empty `<tbody>` - invisible to crawlers and to
 * no-JS clients - while the README and the production guide claimed the markup
 * arrived "already filled with data". Nothing tested SSR, so it went unnoticed.
 * Demo 19 looked like proof but snapshots the CLIENT-rendered DOM into a
 * script-blocked iframe, so it could never have caught it.
 *
 *   node packages/grid/scripts/check-ssr.mjs
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const src = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const outDir = join(here, '.ssr-check-out')
const entry = join(here, '.ssr-check-entry.js')

writeFileSync(
  entry,
  [
    "import { render } from 'svelte/server'",
    'import SvGrid from ' + JSON.stringify(src + 'SvGrid.svelte'),
    'export function ssr(data, props) {',
    '  return render(SvGrid, { props: { data, columns: [',
    "    { field: 'name', header: 'Name' }, { field: 'year', header: 'Year' }",
    '  ], ...(props || {}) } }).body || String("")',
    '}',
  ].join('\n'),
)

let mod
try {
  await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [svelte({ compilerOptions: { generate: 'server' } })],
    build: {
      write: true, outDir, emptyOutDir: true, ssr: entry, minify: false,
      rollupOptions: { output: { entryFileNames: 'ssr.js' } },
    },
    ssr: { noExternal: true },
  })
  mod = await import(pathToFileURL(join(outDir, 'ssr.js')).href)
} finally {
  rmSync(entry, { force: true })
}

const failures = []
const check = (label, condition) => {
  if (!condition) failures.push(label)
  console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}`)
}

const two = [
  { name: 'Ada Lovelace', year: 1843 },
  { name: 'Grace Hopper', year: 1952 },
]
const html = mod.ssr(two)
check('row values appear in the server HTML', html.includes('Ada Lovelace') && html.includes('Grace Hopper'))
check('cell values appear (not just names)', html.includes('1843'))
check('real row elements render', /data-svgrid-row=/.test(html))
check('the empty-state row is NOT what rendered', !html.includes('sv-grid-empty-row'))
check('header labels render', html.includes('Name') && html.includes('Year'))

const many = Array.from({ length: 5000 }, (_, i) => ({ name: 'Person ' + i, year: i }))
const bigHtml = mod.ssr(many, { containerHeight: 400 })
const cells = (bigHtml.match(/data-svgrid-row=/g) ?? []).length
check('a large grid still renders its first rows', bigHtml.includes('Person 0'))
check('virtualization survives SSR (not every row serialised)', cells > 0 && cells < many.length)

check('the empty state still renders for no rows', mod.ssr([]).includes('sv-grid-empty-row'))
check('feature props do not break SSR', (() => {
  try {
    mod.ssr(two, { sortable: true, filterable: true, editable: true, showPagination: true })
    return true
  } catch {
    return false
  }
})())

rmSync(outDir, { recursive: true, force: true })

if (failures.length) {
  console.error('\n<SvGrid> is not server-rendering correctly:')
  for (const f of failures) console.error('  - ' + f)
  console.error(
    '\nUsual cause: something the render path needs is only set from an $effect.\n' +
      'Effects do not run during SSR, so anything initialised that way is absent\n' +
      'on the server. See buildPreMeasureItems in src/virtualization/virtualizer.ts.',
  )
  process.exit(1)
}
console.log('\nSSR OK - <SvGrid> renders rows on the server.')
