#!/usr/bin/env node
/**
 * Validate community demos before a maintainer looks at them. Run by
 * .github/workflows/community-demo-guard.yml on pull requests from outside
 * the team, and by hand:
 *
 *   node tools/check-community-demo.mjs examples/src/demos/community/my-demo.svelte
 *   node tools/check-community-demo.mjs --compile <file>   # also run the Svelte compiler
 *
 * In CI the file list arrives as FILES, a JSON array of { name, added } from
 * the guard's classify step. With --compile the `svelte` package must be
 * resolvable (the workflow installs it into a scratch dir and sets NODE_PATH).
 *
 * Checks, per file:
 *   - the leading header comment has title and author, and a new demo keeps
 *     discussion: 0 (a maintainer assigns the number after merge);
 *   - imports come only from @svgrid/grid, @svgrid/enterprise or svelte;
 *     no relative imports, so the demo runs in the playground as one file;
 *   - no em-dash characters, per the repo rule;
 *   - with --compile, the Svelte 5 compiler accepts the file in runes mode.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const COMPILE = args.includes('--compile')

let files = args.filter((a) => !a.startsWith('--')).map((name) => ({ name, added: false }))
if (files.length === 0 && process.env.FILES) files = JSON.parse(process.env.FILES)
if (files.length === 0) {
  console.error('usage: node tools/check-community-demo.mjs [--compile] <file.svelte> ...')
  process.exit(2)
}

const ALLOWED_IMPORTS = ['@svgrid/grid', '@svgrid/enterprise', 'svelte']
const IMPORT_RE = /(?:^|\n)\s*import\s[^'"]*?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function parseHeader(src) {
  const meta = {}
  const block = src.match(/^\s*<!--([\s\S]*?)-->/)
  if (!block) return null
  for (const line of block[1].split('\n')) {
    const kv = line.match(/^\s*([a-zA-Z]+)\s*:\s*(.*?)\s*$/)
    if (kv) meta[kv[1].toLowerCase()] = kv[2]
  }
  return meta
}

function checkFile({ name, added }) {
  const problems = []
  const src = readFileSync(join(ROOT, name), 'utf8')

  const meta = parseHeader(src)
  if (!meta) {
    problems.push('missing the leading <!-- title / author / tags / discussion --> header')
  } else {
    if (!meta.title) problems.push('header needs a title')
    if (!meta.author) problems.push('header needs an author')
    if (added && meta.discussion !== undefined && meta.discussion !== '0') {
      problems.push('a new demo keeps discussion: 0; a maintainer sets the number after merge')
    }
  }

  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2]
    const ok = ALLOWED_IMPORTS.some((p) => spec === p || spec.startsWith(p + '/'))
    if (!ok) problems.push(`import from "${spec}" is not allowed; use only ${ALLOWED_IMPORTS.join(', ')}`)
  }

  if (src.includes('\u2014')) problems.push('contains an em-dash character; use a plain hyphen')

  if (COMPILE && problems.length === 0) {
    try {
      const require = createRequire(import.meta.url)
      const { compile } = require('svelte/compiler')
      const result = compile(src, { filename: basename(name), generate: 'client', runes: true })
      for (const w of result.warnings || []) {
        console.log(`  warning: ${w.message}`)
      }
    } catch (err) {
      problems.push(`does not compile: ${err.message.split('\n')[0]}`)
    }
  }

  return problems
}

let failed = false
for (const f of files) {
  const problems = checkFile(f)
  if (problems.length) {
    failed = true
    console.log(`FAIL ${f.name}`)
    for (const p of problems) console.log(`  - ${p}`)
  } else {
    console.log(`ok   ${f.name}`)
  }
}
process.exit(failed ? 1 : 0)
