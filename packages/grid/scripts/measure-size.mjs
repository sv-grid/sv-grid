/**
 * Measure the real gzipped cost of the two things the homepage/README claim:
 *   - "full render component" = <SvGrid> and everything it pulls in
 *   - "headless core"         = createGrid/createSvGrid engine, no rendering
 *
 * Each is bundled in ISOLATION with Svelte kept external (it's a peer dep, so it
 * does NOT count toward what SvGrid adds to a consumer's bundle), minified, then
 * gzipped. This mirrors what a real app that imports only that symbol ships.
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { gzipSync } from 'node:zlib'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkgSrc = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const ENTRIES = {
  'full render component (SvGrid)': `export { default } from ${JSON.stringify(pkgSrc + 'SvGrid.svelte')}`,
  'headless core (createGrid)': `export { createGrid, createSvGrid } from ${JSON.stringify(pkgSrc + 'createGrid.svelte.ts')}`,
  // The whole published '@svgrid/grid/core' subpath, not just createGrid - this
  // is the number a consumer actually pays for `import ... from '@svgrid/grid/core'`.
  "headless subpath (@svgrid/grid/core)": `export * from ${JSON.stringify(pkgSrc + 'headless.ts')}`,
}

/**
 * Base-JS ceilings, in KB gzip. `--check` fails when an entry exceeds its
 * budget, so a stray static import cannot silently undo a lazy boundary.
 *
 * That has happened: GridFooter once statically imported SvGridDropdown, which
 * dragged 5.9 KB into base AND defeated SvGrid.svelte's own `import()` of the
 * same component. Nothing caught it.
 *
 * Budgets are a small margin above the measured number - tighten them when a
 * change legitimately lowers the floor, and never raise one without saying why
 * in the commit.
 */
const BUDGET_KB = {
  // 77.3 -> 77.9 when #69 and #66 landed: the deferred drop-indicator clear
  // (a frame handle + its cancel paths) and the touch-drag entry point, which
  // has to watch the gesture itself while its module is being fetched. The
  // touch implementation proper is a lazy chunk (`row-drag-touch`), so this is
  // the irreducible base half of two bug fixes, not drift.
  //
  // 78.1 -> 78.2 with the per-column `summary` aggregator: createSummaries now
  // dispatches through applyGroupAggregate for a column that declares its own
  // summary, and the `summary` shortcut prop carries a derived + a ctx getter.
  // createSummaries is on the static path, so both land in base. The budget
  // goes to 78.5 to restore the ~0.3 KB of headroom this file has always kept -
  // it had been ratcheted flush against the measurement, so a one-byte feature
  // failed CI. The dev-only config checks from the same batch cost base nothing:
  // `DEV` folds to false in a production build and Rollup drops the block.
  'full render component (SvGrid)': 78.5,
  'headless core (createGrid)': 3.0,
  'headless subpath (@svgrid/grid/core)': 5.0,
}

const CHECK = process.argv.includes('--check')
const failures = []

const kb = (n) => (n / 1024).toFixed(1) + ' KB'

for (const [label, code] of Object.entries(ENTRIES)) {
  const dir = mkdtempSync(join(tmpdir(), 'svgrid-size-'))
  const entry = join(dir, 'entry.js')
  writeFileSync(entry, code)

  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [svelte({ emitCss: false })],
    build: {
      write: false,
      lib: { entry, formats: ['es'], fileName: () => 'out.js' },
      minify: true,
      sourcemap: false,
      cssCodeSplit: false,
      rollupOptions: { external: ['svelte', /^svelte\//] },
    },
  })

  const outputs = result[0]?.output ?? result.output ?? []
  const chunks = new Map(outputs.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]))
  // A chunk is "base" if it's reachable from the entry via STATIC imports only
  // (it loads synchronously with the entry); "lazy" if reached only via import().
  const base = new Set()
  const walk = (name) => {
    if (!name || base.has(name)) return
    base.add(name)
    for (const dep of chunks.get(name)?.imports ?? []) walk(dep)
  }
  walk(outputs.find((o) => o.type === 'chunk' && o.isEntry)?.fileName)

  let baseJs = 0, lazyJs = 0, css = 0
  for (const o of outputs) {
    const content = o.type === 'chunk' ? o.code : o.source
    const bytes = Buffer.byteLength(content)
    const gz = gzipSync(content, { level: 9 }).length
    const kind = o.fileName.endsWith('.css') ? 'css' : base.has(o.fileName) ? 'base' : 'lazy'
    if (kind === 'css') css += gz
    else if (kind === 'base') baseJs += gz
    else lazyJs += gz
    if (!CHECK) {
      console.log(`   ${kind.padEnd(6)} ${o.fileName.padEnd(28)} raw ${kb(bytes).padStart(9)}   gzip ${kb(gz).padStart(9)}`)
    }
  }
  const entryJs = baseJs
  const budget = BUDGET_KB[label]
  const overBudget = budget != null && entryJs / 1024 > budget
  if (overBudget) {
    failures.push(`${label}: base JS ${kb(entryJs)} exceeds the ${budget} KB budget`)
  }
  console.log(
    `=> ${label}: base JS gzip ${kb(entryJs)}` +
      (budget != null ? ` (budget ${budget} KB${overBudget ? ' - OVER' : ''})` : '') +
      (css ? ` + CSS ${kb(css)}` : '') +
      (lazyJs ? `   |  lazy chunks (loaded on demand) ${kb(lazyJs)}` : '') +
      '\n',
  )
}

if (CHECK) {
  if (failures.length) {
    console.error('\nSize budget exceeded:')
    for (const f of failures) console.error('  - ' + f)
    console.error(
      '\nSomething moved into the base graph. Usual cause: a static import of a\n' +
        'module that is supposed to load via import(). Check the newest imports in\n' +
        'SvGrid.svelte and anything it reaches.',
    )
    process.exit(1)
  }
  console.log('All entries within budget.')
}
