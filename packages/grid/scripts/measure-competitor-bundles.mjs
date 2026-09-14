/**
 * Measure the competitor grids the comparison pages publish a bundle size for,
 * the way packages/grid/scripts/measure-size.mjs measures SvGrid: each package
 * built alone with Vite in library mode, minified, gzip level 9, the package's
 * peer dependencies external (a peer is what the host app already ships), and
 * base JS split from the chunks only reached through `import()`. Results go to
 * the `bundles` block of docs/_data/competitors.json with the version and the
 * date, and the pages render them from there.
 *
 *   pnpm competitors:measure               measure what is installed
 *   pnpm competitors:measure --install     install the packages first
 *   pnpm competitors:measure --only <pkg>  one package
 *
 * Only open-source packages are measured and published. A vendor whose
 * licence restricts use for competitive claims (NEVER_PUBLISH) is refused
 * even when someone has it installed locally.
 *
 * Svelte packages live in examples/ (they are also benchmark adapters there);
 * everything else installs into tools/bench/competitors/, an isolated
 * package outside the workspace so a React grid never enters the monorepo's
 * dependency graph.
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { loadLedger, LEDGER_FILE } from '../../../tools/lib/compare-data.mjs'

// Lives beside measure-size.mjs because vite and the svelte plugin resolve
// from this package; the entry table and the ledger are the only differences.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const EXAMPLES = join(ROOT, 'examples')
const ISOLATED = join(ROOT, 'tools', 'bench', 'competitors')

const OSS_LICENSES = /^(MIT|Apache-2\.0|BSD-[23]-Clause|ISC|0BSD|MPL-2\.0)$/i
/** Vendors whose licences restrict publishing comparative measurements. */
const NEVER_PUBLISH = [/^handsontable/, /^@progress\//, /^devextreme/, /^@syncfusion\//, /^jqwidgets/, /^smart-webcomponents/]

/**
 * What to build for each package. `entry` is the module the app imports;
 * `css` is a stylesheet the package ships separately (measured as-is);
 * `where` says which install location holds it.
 */
const ENTRIES = {
  'ag-grid-community': {
    where: 'examples',
    entry: `import { createGrid, ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'\nModuleRegistry.registerModules([AllCommunityModule])\nexport { createGrid, themeQuartz }`,
    label: 'createGrid + AllCommunityModule + themeQuartz',
  },
  '@tanstack/svelte-table': {
    where: 'examples',
    entry: `export * from '@tanstack/svelte-table'`,
    label: 'whole package',
  },
  'wx-svelte-grid': {
    where: 'examples',
    entry: `export { Grid } from 'wx-svelte-grid'`,
    label: 'Grid component',
    svelte: true,
  },
  'svelte-headless-table': {
    where: 'isolated',
    entry: `export * from 'svelte-headless-table'`,
    label: 'whole package',
  },
  '@humanspeak/svelte-headless-table': {
    where: 'isolated',
    entry: `export * from '@humanspeak/svelte-headless-table'`,
    label: 'whole package',
  },
  '@vincjo/datatables': {
    where: 'isolated',
    entry: `export * from '@vincjo/datatables'`,
    label: 'whole package',
  },
  '@mui/x-data-grid': {
    where: 'isolated',
    entry: `export { DataGrid } from '@mui/x-data-grid'`,
    label: 'DataGrid component',
  },
  'react-data-grid': {
    where: 'isolated',
    entry: `export { DataGrid } from 'react-data-grid'`,
    label: 'DataGrid component',
    css: 'react-data-grid/lib/styles.css',
  },
  '@glideapps/glide-data-grid': {
    where: 'isolated',
    entry: `export { DataEditor } from '@glideapps/glide-data-grid'`,
    label: 'DataEditor component',
    css: '@glideapps/glide-data-grid/dist/index.css',
  },
  'tabulator-tables': {
    where: 'isolated',
    entry: `export { TabulatorFull } from 'tabulator-tables'`,
    label: 'TabulatorFull',
    css: 'tabulator-tables/dist/css/tabulator.min.css',
  },
  gridjs: {
    where: 'isolated',
    entry: `export { Grid } from 'gridjs'`,
    label: 'Grid',
    css: 'gridjs/dist/theme/mermaid.min.css',
  },
}

const args = process.argv.slice(2)
const INSTALL = args.includes('--install')
const onlyAt = args.indexOf('--only')
const ONLY = onlyAt !== -1 ? args[onlyAt + 1] : null

const ledger = await loadLedger()
const wanted = Object.keys(ENTRIES).filter((p) => (ONLY ? p === ONLY : true))
if (ONLY && !wanted.length) {
  console.error(`--only ${ONLY}: no entry for that package; add one to ENTRIES`)
  process.exit(1)
}

// ---- install ---------------------------------------------------------------
if (INSTALL) {
  const isolatedPkgs = wanted.filter((p) => ENTRIES[p].where === 'isolated')
  if (isolatedPkgs.length) {
    mkdirSync(ISOLATED, { recursive: true })
    const manifest = join(ISOLATED, 'package.json')
    if (!existsSync(manifest)) {
      writeFileSync(manifest, JSON.stringify({ name: 'svgrid-competitor-bundles', private: true, description: 'Install target for packages/grid/scripts/measure-competitor-bundles.mjs. Not a workspace package.' }, null, 2) + '\n')
    }
    // Latest of each: the ledger's `bundles[pkg].version` records what was
    // actually measured and the page only shows it when it matches the
    // registry's latest.
    execSync(`pnpm add --ignore-workspace --save-exact ${isolatedPkgs.map((p) => `${p}@latest`).join(' ')}`, { cwd: ISOLATED, stdio: 'inherit' })
  }
  // The Svelte packages are benchmark adapters as well, so they are ordinary
  // examples/ dependencies: bump them in examples/package.json and run pnpm
  // install, the way any dependency moves.
}

// ---- measure ---------------------------------------------------------------
const kb = (n) => Number((n / 1024).toFixed(1))
const bundles = { ...ledger.bundles }
let failed = 0

for (const pkg of wanted) {
  const spec = ENTRIES[pkg]
  const base = spec.where === 'examples' ? EXAMPLES : ISOLATED
  const req = createRequire(join(base, 'package.json'))
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(dirname(req.resolve(`${pkg}/package.json`).replace(/\\/g, '/')), 'package.json'), 'utf-8'))
  } catch {
    // Packages whose exports map hides package.json: walk node_modules directly.
    const direct = join(base, 'node_modules', ...pkg.split('/'), 'package.json')
    if (!existsSync(direct)) { console.error(`${pkg}: not installed in ${spec.where} (run with --install)`); failed += 1; continue }
    manifest = JSON.parse(readFileSync(direct, 'utf-8'))
  }
  const license = typeof manifest.license === 'string' ? manifest.license : manifest.license?.type ?? ''
  if (NEVER_PUBLISH.some((re) => re.test(pkg))) { console.error(`${pkg}: licence restricts publishing measurements; refusing`); failed += 1; continue }
  if (!OSS_LICENSES.test(license)) { console.error(`${pkg}: licence "${license}" is not on the open-source allow-list; refusing`); failed += 1; continue }
  // Peers are external: they are what the host app already ships. Svelte is
  // external for any Svelte package whether or not it is declared as a peer
  // (wx-svelte-grid declares none), because SvGrid is measured that way and
  // a comparison that counts the Svelte runtime on one side is not one.
  const external = Object.keys(manifest.peerDependencies ?? {})
  const usesSvelte = !!manifest.svelte || 'svelte' in (manifest.dependencies ?? {}) || 'svelte' in (manifest.devDependencies ?? {}) || spec.svelte
  if (usesSvelte && !external.includes('svelte')) external.push('svelte')

  // The entry has to live inside the install location: bare imports resolve
  // from the importing file, and a temp dir has no node_modules above it.
  const entry = join(base, `.competitor-entry-${pkg.replace(/[^a-z0-9]+/gi, '-')}.mjs`)
  writeFileSync(entry, spec.entry)
  let result
  try {
    result = await build({
      configFile: false,
      root: base,
      logLevel: 'error',
      plugins: [svelte({ emitCss: false })],
      resolve: { conditions: ['browser', 'svelte', 'import', 'module', 'default'] },
      build: {
        write: false,
        lib: { entry, formats: ['es'], fileName: () => 'out.js' },
        minify: true,
        sourcemap: false,
        cssCodeSplit: false,
        rollupOptions: { external: [...external, ...external.map((e) => new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/`))] },
      },
    })
  } catch (err) {
    console.error(`${pkg}: build failed: ${err.message}`)
    failed += 1
    continue
  } finally {
    rmSync(entry, { force: true })
  }
  const outputs = result[0]?.output ?? result.output ?? []
  const chunks = new Map(outputs.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]))
  const reach = new Set()
  const walk = (name) => {
    if (!name || reach.has(name)) return
    reach.add(name)
    for (const dep of chunks.get(name)?.imports ?? []) walk(dep)
  }
  walk(outputs.find((o) => o.type === 'chunk' && o.isEntry)?.fileName)
  let baseJs = 0, lazyJs = 0, css = 0, minified = 0
  for (const o of outputs) {
    const content = o.type === 'chunk' ? o.code : o.source
    const gz = gzipSync(content, { level: 9 }).length
    if (o.fileName.endsWith('.css')) css += gz
    else if (reach.has(o.fileName)) { baseJs += gz; minified += Buffer.byteLength(content) }
    else lazyJs += gz
  }
  if (spec.css) {
    try {
      const cssPath = join(base, 'node_modules', ...spec.css.split('/'))
      css += gzipSync(readFileSync(cssPath), { level: 9 }).length
    } catch {
      console.error(`${pkg}: stylesheet ${spec.css} not found; CSS not counted`)
    }
  }
  bundles[pkg] = {
    version: manifest.version,
    jsGzipKb: kb(baseJs),
    cssGzipKb: kb(css),
    minKb: kb(minified),
    lazyGzipKb: kb(lazyJs),
    entry: spec.label,
    external,
    measuredAt: new Date().toISOString().slice(0, 10),
  }
  console.log(`${pkg.padEnd(36)} ${manifest.version.padEnd(10)} js ${String(kb(baseJs)).padStart(7)} KB  css ${String(kb(css)).padStart(6)} KB  lazy ${String(kb(lazyJs)).padStart(6)} KB  external: ${external.join(', ') || 'none'}`)
}

const out = {
  readme: (await readFile(LEDGER_FILE, 'utf-8').then((s) => JSON.parse(s).readme).catch(() => '')),
  registry: ledger.registry,
  bundles: Object.fromEntries(Object.keys(bundles).sort().map((k) => [k, bundles[k]])),
  ...(ledger.benchmarks ? { benchmarks: ledger.benchmarks } : {}),
}
await writeFile(LEDGER_FILE, JSON.stringify(out, null, 2) + '\n', 'utf-8')
console.log(`wrote ${LEDGER_FILE} (${Object.keys(out.bundles).length} bundles${failed ? `, ${failed} failed` : ''})`)
if (failed) process.exit(1)
