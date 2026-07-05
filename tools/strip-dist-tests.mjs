/**
 * Remove test artifacts from a built package `dist/` before publish.
 *
 * `svelte-package` copies every file under src/ into dist/, including
 * `*.test.ts` (compiled to `*.test.js` + `.d.ts`), `test-setup.*`, and
 * `test-fixtures/`. Those have no business in the published tarball - they
 * bloat installs and confuse tooling. This walks the dist dir and deletes them.
 *
 * Usage: node tools/strip-dist-tests.mjs [distDir=./dist]
 */
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] || './dist'

const isTestFile = (name) => /\.(test|spec)\./.test(name) || /^test-setup\./.test(name)

let removed = 0
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
      if (entry.name === 'test-fixtures' || entry.name === '__tests__') {
        rmSync(full, { recursive: true, force: true })
        removed += 1
        continue
      }
      walk(full)
    } else if (isTestFile(entry.name)) {
      rmSync(full, { force: true })
      removed += 1
    }
  }
}

walk(dist)
console.log(`strip-dist-tests: removed ${removed} test artifact(s) from ${dist}`)
