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
  //
  // 78.5 -> 78.9 for the row-pipeline rewrite. `createSortedRowModel` now
  // resolves each sort clause once and precomputes a key array instead of
  // resolving the column inside the comparator (that was 1,528,947 array scans
  // for a single-clause 100k sort), plus a distinct-value ranking path so text
  // columns collate O(distinct log distinct) times rather than O(n log n).
  // `applyGroupAggregate` became a single pass. Measured payoff: single-column
  // sort 351 ms -> 35 ms, three-column 569 ms -> 49 ms, grouping 229 ms ->
  // 106 ms, and a latent RangeError crash on large groups gone. All of it is
  // engine code on the static path, so it lands in base. 0.1 KB measured, and
  // the budget goes to 78.9 to keep the usual 0.3 KB of headroom rather than
  // sitting flush against the measurement again.
  //
  // 78.9 -> 79.3 for the sort / filter / group round. A stride sample decides
  // whether text sorting should rank distinct values before paying to collect
  // them; grouping tracks each bucket's raw value so deeper levels stop
  // re-scanning a column an ancestor already fixed; the Excel filter's fold
  // takes an ASCII fast path. Measured: text sort 117 -> 63 ms, grouping
  // 57 -> 49 ms, the compiled filter 21 -> 3 ms on ASCII. 0.1 KB measured,
  // budget set 0.3 KB above it to keep the usual headroom.
  //
  // 79.3 -> 79.6 for the three symbol keys that hold a row's private fields.
  // They replaced plain `_ctx` / `_values` / `_cells` properties, which were
  // enumerable and therefore serialised: `JSON.stringify(oneRow)` reached
  // `options.data` through the context pointer and grew with the dataset
  // (981 chars at 3 rows, 67,719 at 3,000), making stringifying a row model
  // quadratic. Symbols are skipped by JSON, `Object.keys` and `for...in` while
  // still being copied by object spread, which the grouping and tree row models
  // depend on. Pinned by core.row-shape.test.ts.
  //
  // 79.6 -> 80.0 for the `columnResize` / `rowResize` props. Measured 79.4
  // without either, 79.7 with both, so 0.3 KB. The row-resize ACTION is not in
  // that number - importing it statically cost a further 1.1 KB and put the
  // base over on its own, so SvGrid pulls it through `import()` and it lands in
  // the lazy chunks (84.2 -> 85.5 KB); a grid that never sets `rowResize` never
  // fetches it.
  //
  // 80.0 -> 79.4, BELOW where this all started, when `columnResize` flipped to
  // off-by-default and the column drag moved out to a `columnResize` action of
  // its own. The handles are injected by that action instead of rendered by
  // SvGrid, so the markup, the keyboard handler, the pointer/rAF drag and five
  // pieces of controller state all left the base graph together: 79.7 -> 79.1,
  // with the lazy chunks going 85.5 -> 86.9. Ratcheted to 0.3 KB above the new
  // measurement rather than left slack at 80.0 - a budget that no longer
  // tracks the code stops catching the next static import.
  'full render component (SvGrid)': 79.4,
  'headless core (createGrid)': 3.0,
  // 5.0 -> 5.3 for the specialised single-clause sort comparators. Most sorts
  // are one column, and that comparator runs O(n log n) times - 1.66M calls for
  // 100k rows - so hoisting the clause lookup out of it and inlining the
  // numeric subtraction is worth the four extra closures: a single-column sort
  // went 32 ms -> 27 ms and a text sort 62 ms -> 59 ms. The budget keeps the
  // usual ~0.3 KB of headroom above the measurement.
  'headless subpath (@svgrid/grid/core)': 5.3,
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
