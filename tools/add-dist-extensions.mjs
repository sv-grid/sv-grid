/**
 * Add explicit `.js` extensions to relative specifiers in a built `dist/`.
 *
 * The source is written for a bundler: `moduleResolution: bundler` lets
 * `headless.ts` say `from './core'`, and `svelte-package` copies that specifier
 * through untouched. Vite, Rollup, webpack and vitest all resolve it, so the
 * gap never showed up in a build or a test - but Node's ESM resolver does not
 * do extension search, so `node -e "import('@svgrid/grid/core')"` died with
 * ERR_MODULE_NOT_FOUND on `dist/core`. That subpath exists specifically to be
 * run without a DOM (SSR, a worker, a Node service), which is exactly the case
 * a bundler is not there to paper over.
 *
 * This rewrites only specifiers that do NOT already resolve to a real file, and
 * only when a `.js` (or `/index.js`) sibling exists to point at. `.svelte`
 * imports, `.css` imports, and bare package names are left alone. `.d.ts` files
 * get the same treatment, since TypeScript under node16 resolution reads the
 * JS-style specifier out of the declaration.
 *
 * Usage: node tools/add-dist-extensions.mjs [distDir=./dist]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const dist = process.argv[2] || './dist'

// `from './x'`, `import './x'`, `import('./x')`, `export * from './x'`.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.\.?\/[^'"]*)\2/g

const isFile = (p) => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** What this specifier should become, or null to leave it as it is. */
function rewrite(fromFile, spec) {
  const target = resolve(dirname(fromFile), spec)
  if (isFile(target)) return null // already points at something real
  if (existsSync(target + '.js')) return spec + '.js'
  if (existsSync(join(target, 'index.js'))) return spec + '/index.js'
  return null // not ours to guess at
}

let filesTouched = 0
let specifiersFixed = 0

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // A vitest/vite dep cache can end up under dist/; it is not ours to rewrite.
      if (entry.name !== 'node_modules') walk(full)
      continue
    }
    if (!/\.(js|d\.ts)$/.test(entry.name)) continue

    const source = readFileSync(full, 'utf8')
    let fixedHere = 0
    const next = source.replace(SPECIFIER, (match, lead, quote, spec) => {
      const replacement = rewrite(full, spec)
      if (!replacement) return match
      fixedHere += 1
      return `${lead}${quote}${replacement}${quote}`
    })
    if (fixedHere) {
      writeFileSync(full, next)
      filesTouched += 1
      specifiersFixed += fixedHere
    }
  }
}

walk(dist)
console.log(
  `add-dist-extensions: ${specifiersFixed} specifier(s) in ${filesTouched} file(s) under ${dist}`,
)
