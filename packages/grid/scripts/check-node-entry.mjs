/**
 * Assert that `@svgrid/grid/core` is usable from plain Node.
 *
 * The headless entry exists to run the row pipeline where there is no DOM - a
 * service, a worker, a CLI, a unit test. Every one of those is a bare Node
 * process with no bundler in front of it, and Node's ESM resolver does not do
 * extension search. The source is written for `moduleResolution: bundler`
 * (`from './core'`), `svelte-package` copies those specifiers through, and
 * nothing else in the suite runs the built files outside a bundler - vitest,
 * Vite and SvelteKit all resolve extensionless paths - so `dist/` shipped for a
 * long time with an entry that died on `import` with ERR_MODULE_NOT_FOUND.
 * `tools/add-dist-extensions.mjs` fixes it at build time; this proves it.
 *
 * Two checks:
 *   1. No relative specifier in dist/ is left without a resolvable target.
 *   2. A real child `node` process imports the entry and runs the pipeline.
 *
 * `createSvGrid` is deliberately NOT exercised: it holds state in Svelte runes
 * and needs the compiler, so bare Node cannot run it by design.
 * `createSvGridCore` is the function this entry offers to Node.
 *
 *   node packages/grid/scripts/check-node-entry.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const distDir = resolve(new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

if (!existsSync(distDir)) {
  console.error(`check-node-entry: no dist at ${distDir} - run \`pnpm --filter @svgrid/grid build\` first.`)
  process.exit(1)
}

// ---- 1. Every relative specifier resolves the way Node resolves ------------

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.\.?\/[^'"]*)\1/g
const isFile = (p) => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

const unresolvable = []
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // A vite/vitest dep cache can land under dist/; it is not part of the package.
      if (entry.name !== 'node_modules') scan(full)
      continue
    }
    if (!entry.name.endsWith('.js')) continue
    const source = readFileSync(full, 'utf8')
    for (const [, , spec] of source.matchAll(SPECIFIER)) {
      // Node resolves a relative specifier as a literal path. No extension
      // search, no directory index.
      if (!isFile(resolve(dirname(full), spec))) {
        unresolvable.push(`${full.slice(distDir.length + 1)} -> ${spec}`)
      }
    }
  }
}
scan(distDir)

if (unresolvable.length) {
  console.error(
    `check-node-entry: ${unresolvable.length} relative specifier(s) in dist/ that Node cannot resolve:`,
  )
  for (const line of unresolvable.slice(0, 20)) console.error(`  ${line}`)
  if (unresolvable.length > 20) console.error(`  ... and ${unresolvable.length - 20} more`)
  console.error('\nIs tools/add-dist-extensions.mjs still wired into the build script?')
  process.exit(1)
}

// ---- 2. A real Node process imports the entry and runs the pipeline --------

const probe = join(distDir, '.node-entry-probe.mjs')
const entryUrl = pathToFileURL(join(distDir, 'headless.js')).href

writeFileSync(
  probe,
  `import {
  createSvGridCore, createCoreRowModel, createSortedRowModel,
  tableFeatures, rowSortingFeature,
} from ${JSON.stringify(entryUrl)}

const features = tableFeatures({ rowSortingFeature })
const table = createSvGridCore({
  _features: features,
  _rowModels: { coreRowModel: createCoreRowModel(), sortedRowModel: createSortedRowModel() },
  data: [{ n: 'a', v: 1 }, { n: 'b', v: 3 }, { n: 'c', v: 2 }],
  columns: [{ field: 'n' }, { field: 'v' }],
  state: { sorting: [{ id: 'v', desc: true }] },
  onSortingChange: () => {},
})
const order = table.getRowModel().rows.map((r) => r.original.n).join('')
if (order !== 'bca') {
  console.error('check-node-entry: pipeline ran but sorted wrong: ' + order)
  process.exit(1)
}
`,
)

try {
  execFileSync(process.execPath, [probe], { stdio: 'pipe' })
} catch (err) {
  console.error('check-node-entry: importing @svgrid/grid/core from plain Node failed.\n')
  console.error(String(err.stderr || err.message))
  process.exit(1)
} finally {
  rmSync(probe, { force: true })
}

console.log('check-node-entry: @svgrid/grid/core imports and runs the pipeline under plain Node.')
