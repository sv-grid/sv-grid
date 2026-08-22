#!/usr/bin/env node
/**
 * Prove a generated app actually works.
 *
 *   node tools/verify-generated-app.mjs [sample-id] [--keep]
 *
 * Emits a real app from a sample project, installs it against the LOCAL
 * packages, and runs the app's own `svelte-check`. Unit tests assert what the
 * emitter *writes*; only this says the result compiles.
 *
 * Why local matters: a generated app depends on a published `@svgrid/*`. Left to
 * resolve from npm, this script would type-check today's codegen against
 * yesterday's runtime, and any feature that has not shipped yet would look like a
 * bug in the app. Testing the pair that actually ship together surfaces a
 * mismatch here rather than in a user's project.
 *
 * It installs packed tarballs rather than linking the workspace folders.
 * A `file:` link resolves its own `svelte` from the monorepo root, so the app
 * ends up with two copies and every Snippet type mismatches ("Two different types
 * with this name exist"). A tarball installs as an ordinary dependency - one
 * `svelte`, node_modules skipped by svelte-check - which is also exactly what a
 * user gets. `pnpm pack` (never `npm pack`) rewrites the `workspace:^` ranges.
 *
 * Exit code is 0 only when svelte-check reports zero errors.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENTERPRISE = join(ROOT, 'packages', 'enterprise')
const GRID = join(ROOT, 'packages', 'grid')

const args = process.argv.slice(2)
const keep = args.includes('--keep')
const sampleId = args.find((a) => !a.startsWith('-')) ?? 'crm'

const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8', shell: process.platform === 'win32', stdio: 'pipe' })

console.log(`verify-generated-app: building the "${sampleId}" sample`)

// The Node bundle is what the CLI and MCP server use; rebuild so this checks the
// current source rather than a stale copy.
run('node', ['./scripts/build-node.mjs'], ENTERPRISE)
const studio = await import(pathToFileURL(join(ENTERPRISE, 'dist', 'node', 'studio.js')).href)

const sample = studio.getSampleApp(sampleId)
if (!sample) {
  console.error(`verify-generated-app: no sample "${sampleId}". Try: ${studio.sampleApps.map((s) => s.id).join(', ')}`)
  process.exit(1)
}

const project = sample.build()
const blocking = studio.validateProject(project).filter((i) => i.level === 'error')
if (blocking.length) {
  console.error('verify-generated-app: the project itself is invalid:')
  for (const i of blocking) console.error(`  - ${i.message}`)
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'svgrid-verify-'))
for (const file of studio.emitStudioAppBundle(project)) {
  const path = join(dir, file.path)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, file.contents)
}

// Pack the workspace packages and point the app at those tarballs. `overrides`
// as well as `dependencies`, so enterprise's own dependency on grid resolves to
// the local build too instead of quietly fetching the published one.
console.log('verify-generated-app: packing the local packages')
const packed = {}
for (const [name, path] of [['@svgrid/grid', GRID], ['@svgrid/enterprise', ENTERPRISE]]) {
  const out = run('pnpm', ['pack', '--pack-destination', dir], path).trim()
  const tarball = out.split('\n').pop().trim()
  packed[name] = `file:${resolve(dir, tarball)}`
}

const pkgPath = join(dir, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
for (const [name, spec] of Object.entries(packed)) {
  if (pkg.dependencies?.[name]) pkg.dependencies[name] = spec
}
pkg.overrides = { ...pkg.overrides, ...packed }
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`verify-generated-app: installing in ${dir}`)
try {
  run('npm', ['install', '--no-audit', '--no-fund'], dir)
} catch (err) {
  console.error('verify-generated-app: install failed\n' + (err.stdout ?? '') + (err.stderr ?? ''))
  process.exit(1)
}

console.log('verify-generated-app: type-checking the app')
let output = ''
try {
  output = run('npm', ['run', 'check'], dir)
} catch (err) {
  output = `${err.stdout ?? ''}${err.stderr ?? ''}`
}

// svelte-check's machine format ends with: <ts> COMPLETED <n> FILES <n> ERRORS ...
const summary = output.match(/COMPLETED (\d+) FILES (\d+) ERRORS (\d+) WARNINGS/)
const errors = summary ? Number(summary[2]) : NaN
if (!summary) {
  console.error('verify-generated-app: could not read a svelte-check summary\n' + output.slice(-3000))
  process.exit(1)
}

if (errors > 0) {
  console.error(`verify-generated-app: ${errors} error(s) in the generated app:\n`)
  for (const line of output.split('\n').filter((l) => l.includes(' ERROR '))) console.error('  ' + line.trim())
  console.error(`\nThe app is in ${dir}`)
  process.exit(1)
}

console.log(`verify-generated-app: OK - ${summary[1]} files, 0 errors, ${summary[3]} warnings`)
if (keep) console.log(`verify-generated-app: kept ${dir}`)
else rmSync(dir, { recursive: true, force: true })
