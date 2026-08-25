#!/usr/bin/env node
/*
 * tools/publish.mjs - ordered, idempotent publish of the @svgrid packages.
 *
 * AUTH - this script never handles your npm credentials. Authenticate ONCE on
 * this machine before running, in your own terminal:
 *
 *   npm login                       # interactive session token, or
 *   # put an npm "Automation" access token in your USER ~/.npmrc:
 *   #   //registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxx
 *   # (Automation tokens skip the 2FA one-time-password prompt.)
 *
 * Never put a token in the repo. The script only reads whatever auth npm/pnpm
 * already have configured for your user.
 *
 * USAGE:
 *   node tools/publish.mjs               publish every bumped package, in order
 *   node tools/publish.mjs --dry-run     show what would publish; publish nothing
 *   node tools/publish.mjs --otp=123456  pass a 2FA code (else npm prompts you)
 *   node tools/publish.mjs --no-git-checks   skip the clean-tree guard
 *
 * Re-runs are safe: any package whose exact version is already on the registry
 * is skipped, so a failed mid-run can just be run again.
 */
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const noGit = args.includes('--no-git-checks')
const otpArg = args.find((a) => a.startsWith('--otp='))

// Dependency-first order: everything that peer-depends on grid comes after it,
// and the CLIs (which reference the others) come last.
const ORDER = ['grid', 'enterprise', 'grid-wc', 'mcp', 'studio', 'svgrid-ui', 'create-sv-grid', 'create-studio', 'migrate', 'svgrid-sv']

const sh = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { encoding: 'utf8', shell: true, ...opts })

function pkgInfo(dir) {
  const p = JSON.parse(readFileSync(join(ROOT, 'packages', dir, 'package.json'), 'utf8'))
  return { dir, name: p.name, version: p.version, private: !!p.private }
}

// True only when this exact name@version already exists on the registry.
function isPublished(name, version) {
  const r = sh('npm', ['view', `${name}@${version}`, 'version'])
  return r.status === 0 && r.stdout.trim() === version
}

// --- preflight: authentication ---------------------------------------------
const who = sh('npm', ['whoami'])
if (who.status !== 0) {
  console.error('Not logged in to npm.')
  console.error('Run `npm login`, or add an automation token to your user ~/.npmrc, then retry.')
  process.exit(1)
}
console.log(`npm user: ${who.stdout.trim()}`)

// --- preflight: clean working tree -----------------------------------------
if (!noGit && !dryRun) {
  const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
  if (status) {
    console.error('Working tree is not clean - commit your changes first (or pass --no-git-checks).')
    console.error(status)
    process.exit(1)
  }
}

// --- publish loop -----------------------------------------------------------
const published = []
const skipped = []
for (const dir of ORDER) {
  const { name, version, private: priv } = pkgInfo(dir)
  if (priv) { console.log(`- skip ${name} (private)`); skipped.push(name); continue }
  if (isPublished(name, version)) { console.log(`- skip ${name}@${version} (already on registry)`); skipped.push(name); continue }

  console.log(`\n>>> ${dryRun ? '[dry-run] would publish' : 'publishing'} ${name}@${version}`)
  if (dryRun) { published.push(`${name}@${version}`); continue }

  // --no-git-checks here because we already guarded the tree above; pnpm runs
  // this package's prepublishOnly/prepack build hook before packing.
  // --provenance needs an OIDC token, which only exists inside a supported CI
  // runner with `id-token: write`. Passing it from a laptop makes npm error out,
  // so gate it on the runner rather than always sending it.
  const publishArgs = ['publish', '--access', 'public', '--no-git-checks']
  if (process.env.GITHUB_ACTIONS === 'true') publishArgs.push('--provenance')
  if (otpArg) publishArgs.push(otpArg)
  const r = sh('pnpm', publishArgs, { cwd: join(ROOT, 'packages', dir), stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`\nPublish failed for ${name}@${version}. Fix the issue and re-run - already-published packages will be skipped.`)
    process.exit(r.status || 1)
  }
  published.push(`${name}@${version}`)
}

console.log(`\nDone. ${dryRun ? 'Would publish' : 'Published'}: ${published.length ? published.join(', ') : '(none)'}`)
if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`)
