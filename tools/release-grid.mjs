#!/usr/bin/env node
/**
 * Decide whether @svgrid/grid needs a new release, and if so bump its patch
 * (build) number. Designed to run daily from CI (.github/workflows/publish-npm.yml)
 * so the package only re-publishes when its source actually changed - no empty
 * version churn for the enterprise consumers who depend on it.
 *
 * How "changed since last publish" is decided:
 *   - Each publish creates a git tag `grid-v<version>` (the workflow does this).
 *   - We find the highest such tag = the commit that was last published.
 *   - If `git diff <tag>..HEAD` touches packages/grid/src or its package.json,
 *     there are changes worth shipping; otherwise we skip.
 *
 * First run (no `grid-v*` tag yet): we don't publish. The package is already on
 * npm at its current version, so we just emit changed=false and let the workflow
 * lay down the baseline tag `grid-v<current>` at HEAD.
 *
 * Output (for the workflow) is written as key=value lines to $GITHUB_OUTPUT when
 * set, and always echoed to stdout:
 *   changed=true|false   - whether a new version should be published
 *   version=X.Y.Z        - the version to publish (new, bumped) or the baseline
 *
 * Flags:
 *   --check   report only; do NOT write the bumped version into package.json
 *
 * Usage:
 *   node tools/release-grid.mjs           # CI: detect + bump package.json
 *   node tools/release-grid.mjs --check   # local: detect only, no writes
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PKG_DIR = join(ROOT, 'packages', 'grid')
const PKG_JSON = join(PKG_DIR, 'package.json')
const TAG_PREFIX = 'grid-v'
// Paths whose changes warrant a republish. dist/ is built, not committed, so we
// watch the source and the manifest only.
const WATCH = ['packages/grid/src', 'packages/grid/package.json']

const CHECK_ONLY = process.argv.includes('--check')
// --force: bump + publish regardless of whether anything changed. Used by the
// workflow's TEST schedule so a run always produces a publish. Not for normal
// releases (it would churn empty versions).
const FORCE = process.argv.includes('--force')

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8' }).trim()
}

// Parse "1.2.3" -> [1,2,3]; ignores any leading prefix.
function parseVer(s) {
  const m = String(s).match(/(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}
const cmpVer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
const fmtVer = (v) => v.join('.')
const bumpPatch = (v) => [v[0], v[1], v[2] + 1]

function emit(changed, version) {
  const out = `changed=${changed}\nversion=${version}\n`
  process.stdout.write(out)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out)
}

function highestReleaseTag() {
  let tags = []
  try {
    tags = git(['tag', '--list', `${TAG_PREFIX}*`]).split('\n').filter(Boolean)
  } catch {
    tags = []
  }
  let best = null
  for (const t of tags) {
    const v = parseVer(t.slice(TAG_PREFIX.length))
    if (v && (!best || cmpVer(v, best.ver) > 0)) best = { tag: t, ver: v }
  }
  return best
}

function changedSince(tag) {
  // --quiet exits 1 when there ARE differences, 0 when there are none.
  try {
    execFileSync('git', ['diff', '--quiet', `${tag}..HEAD`, '--', ...WATCH], { cwd: ROOT })
    return false // exit 0 -> no differences
  } catch {
    return true // non-zero -> differences exist
  }
}

function main() {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf-8'))
  const current = parseVer(pkg.version)
  if (!current) {
    console.error(`Could not parse version from ${PKG_JSON}: ${pkg.version}`)
    process.exit(1)
  }

  const last = highestReleaseTag()

  if (!FORCE) {
    // First run: no release tag exists. The package is already on npm at its
    // current version, so establish a baseline (the workflow tags HEAD) and skip.
    if (!last) {
      console.error(`No ${TAG_PREFIX}* tag found - establishing baseline at v${fmtVer(current)} (no publish).`)
      emit(false, fmtVer(current))
      return
    }

    if (!changedSince(last.tag)) {
      console.error(`No changes in ${WATCH.join(', ')} since ${last.tag} - skipping publish.`)
      emit(false, fmtVer(current))
      return
    }
  }

  // Bump from whichever is higher: the last released tag or the working version
  // (guards against a manual bump that already moved package.json forward).
  const base = last && cmpVer(current, last.ver) <= 0 ? last.ver : current
  const next = bumpPatch(base)
  const nextStr = fmtVer(next)

  if (!CHECK_ONLY) {
    pkg.version = nextStr
    writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + '\n')
  }
  const reason = FORCE ? 'Forced' : `Changes since ${last.tag}`
  console.error(`${reason}: bumping ${fmtVer(current)} -> ${nextStr}${CHECK_ONLY ? ' (check only, not written)' : ''}.`)
  emit(true, nextStr)
}

main()
