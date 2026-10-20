/**
 * Assert that `<SvSheet>` server-renders.
 *
 * `packages/grid/scripts/check-ssr.mjs` covers `<SvGrid>` only, so the sheet
 * shipped a cell renderer that called `document.createElement` while SvelteKit
 * rendered the page on the server: every request to a page with a sheet was a
 * 500. Same approach as the grid's check: compile with `generate: 'server'`,
 * render, assert on the HTML string.
 *
 * Needs the grid's dist (`pnpm --filter @svgrid/grid build`), which the CI
 * build step produces before this runs.
 *
 *   node packages/enterprise/scripts/check-ssr.mjs
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
    'import SvSheet from ' + JSON.stringify(src + 'SvSheet.svelte'),
    'export function sheet(props) {',
    '  return render(SvSheet, { props }).body || String("")',
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
const check = (label, run) => {
  let ok = false
  let detail = ''
  try {
    ok = run()
  } catch (e) {
    detail = ` (${e instanceof Error ? e.message : e})`
  }
  if (!ok) failures.push(label + detail)
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail}`)
}

// Long numbers in narrow columns are what reach the hash-measuring path.
const data = [{ name: 'Sheet1', cells: [['Item', 'Amount'], ['Rent', '1250.5'], ['Total', '=B2*123456789']] }]
check('a blank sheet renders', () => mod.sheet({}).length > 0)
check('a seeded sheet renders its cells', () => {
  const html = mod.sheet({ data, columnWidth: 40 })
  return html.includes('Rent') && html.includes('Item')
})

rmSync(outDir, { recursive: true, force: true })

if (failures.length) {
  console.error(`\n${failures.length} SSR check(s) failed.`)
  process.exit(1)
}
console.log('\n<SvSheet> server-renders.')
