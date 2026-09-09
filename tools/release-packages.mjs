#!/usr/bin/env node
/**
 * Decide which @svgrid packages need a new release, and bump the patch (build)
 * number of each one that does. Runs from CI (.github/workflows/publish-npm.yml)
 * after the Test workflow goes green on main, so a package republishes only when
 * its own shipped files changed - no empty version churn.
 *
 * Supersedes tools/release-grid.mjs, which did this for @svgrid/grid alone.
 * The `grid-v*` tags it laid down are still the grid's history; every other
 * package gets the same treatment under its own `<dir>-v*` prefix.
 *
 * How "changed since last publish" is decided:
 *   - Each publish creates a git tag `<dir>-v<version>` (the workflow does this).
 *   - We find the highest such tag = the commit that package was last published at.
 *   - If `git diff <tag>..HEAD` touches any of that package's WATCH paths, there
 *     are changes worth shipping; otherwise we skip it.
 *
 * WATCH lists only the files that end up in the tarball (its `files` field plus
 * the scripts that generate `dist/`). Tests, docs and demos do not trigger a
 * release on their own.
 *
 * BUNDLES is the cascade: @svgrid/grid-wc compiles @svgrid/grid and
 * @svgrid/enterprise *into* its bundle (packages/grid-wc/vite.config.js keeps
 * them non-external), so a grid change leaves the published web component stale
 * even though grid-wc's own files did not move. Peer/dependency ranges are
 * `^x.y.z` and a patch satisfies them, so nothing else needs a cascade.
 *
 * First run for a package (no `<dir>-v*` tag yet): we don't publish. It is
 * already on npm at its current version, so we report it under `baseline=` and
 * the workflow tags HEAD to start the history.
 *
 * Output (for the workflow) goes to $GITHUB_OUTPUT when set, and always to stdout:
 *   any=true|false        - whether anything should be published
 *   packages=a,b,c        - directory names to publish, in dependency order
 *   tags=a-v1.2.3 b-v...  - the tags to create after a successful publish
 *   baseline=c-v1.0.0     - baseline tags to lay down (never-released packages)
 *
 * Flags:
 *   --check          report only; do NOT write bumped versions into package.json
 *   --force          bump + publish every package regardless of changes
 *   --only a,b       restrict to these package directories
 *
 * Usage:
 *   node tools/release-packages.mjs            # CI: detect + bump
 *   node tools/release-packages.mjs --check    # local: detect only, no writes
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

// Dependency-first, and deliberately the same order as ORDER in tools/publish.mjs
// (which does the actual publishing). Keep the two lists in sync when a package
// is added: a package listed here but missing there is detected and never shipped.
const PACKAGES = [
  {
    dir: 'grid',
    watch: ['packages/grid/src', 'packages/grid/themes', 'packages/grid/scripts', 'packages/grid/package.json'],
  },
  {
    dir: 'enterprise',
    watch: ['packages/enterprise/src', 'packages/enterprise/scripts', 'packages/enterprise/package.json'],
  },
  {
    dir: 'grid-wc',
    watch: ['packages/grid-wc/src', 'packages/grid-wc/scripts', 'packages/grid-wc/package.json'],
    bundles: ['grid', 'enterprise'],
  },
  {
    dir: 'mcp',
    watch: ['packages/mcp/src', 'packages/mcp/scripts', 'packages/mcp/server.json', 'packages/mcp/package.json'],
  },
  {
    dir: 'studio',
    watch: ['packages/studio/src', 'packages/studio/package.json'],
  },
  {
    dir: 'svgrid-ui',
    watch: ['packages/svgrid-ui/index.mjs', 'packages/svgrid-ui/recipes', 'packages/svgrid-ui/package.json'],
  },
  {
    dir: 'create-sv-grid',
    watch: ['packages/create-sv-grid/index.mjs', 'packages/create-sv-grid/templates', 'packages/create-sv-grid/package.json'],
  },
  {
    dir: 'create-studio',
    watch: ['packages/create-studio/index.mjs', 'packages/create-studio/templates', 'packages/create-studio/package.json'],
  },
  {
    dir: 'migrate',
    watch: [
      'packages/migrate/index.mjs',
      'packages/migrate/tanstack.mjs',
      'packages/migrate/transform.mjs',
      'packages/migrate/scan.mjs',
      'packages/migrate/package.json',
    ],
  },
  {
    dir: 'svgrid-sv',
    watch: ['packages/svgrid-sv/index.mjs', 'packages/svgrid-sv/package.json'],
  },
]

const argv = process.argv.slice(2)
const CHECK_ONLY = argv.includes('--check')
const FORCE = argv.includes('--force')
const onlyArg = argv.find((a) => a.startsWith('--only'))
const ONLY = onlyArg
  ? new Set(
      (onlyArg.includes('=') ? onlyArg.split('=')[1] : argv[argv.indexOf(onlyArg) + 1] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null

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

const manifestPath = (dir) => join(ROOT, 'packages', dir, 'package.json')

function highestReleaseTag(prefix) {
  let tags = []
  try {
    tags = git(['tag', '--list', `${prefix}*`]).split('\n').filter(Boolean)
  } catch {
    tags = []
  }
  let best = null
  for (const t of tags) {
    // `--list grid-v*` never matches `grid-wc-v1.0.0`, but be explicit anyway:
    // only the exact prefix followed by a version counts.
    const rest = t.slice(prefix.length)
    if (!/^\d+\.\d+\.\d+$/.test(rest)) continue
    const v = parseVer(rest)
    if (v && (!best || cmpVer(v, best.ver) > 0)) best = { tag: t, ver: v }
  }
  return best
}

function changedSince(tag, watch) {
  // --quiet exits 1 when there ARE differences, 0 when there are none.
  try {
    execFileSync('git', ['diff', '--quiet', `${tag}..HEAD`, '--', ...watch], { cwd: ROOT })
    return false // exit 0 -> no differences
  } catch {
    return true // non-zero -> differences exist
  }
}

function emit(lines) {
  const out = lines.map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  process.stdout.write(out)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out)
}

function main() {
  const selected = PACKAGES.filter((p) => !ONLY || ONLY.has(p.dir))
  if (ONLY) {
    const unknown = [...ONLY].filter((d) => !PACKAGES.some((p) => p.dir === d))
    if (unknown.length) {
      console.error(`Unknown package directory: ${unknown.join(', ')}`)
      process.exit(1)
    }
  }

  const publish = [] // { dir, name, from, to, tag, reason }
  const baseline = [] // tags to lay down for never-released packages
  const bumped = new Set() // dirs decided to publish, for the BUNDLES cascade

  for (const pkg of selected) {
    const file = manifestPath(pkg.dir)
    const manifest = JSON.parse(readFileSync(file, 'utf-8'))
    const current = parseVer(manifest.version)
    if (!current) {
      console.error(`Could not parse version from ${file}: ${manifest.version}`)
      process.exit(1)
    }
    if (manifest.private) {
      console.error(`- ${manifest.name}: private, never published.`)
      continue
    }

    const prefix = `${pkg.dir}-v`
    const last = highestReleaseTag(prefix)
    let reason = 'forced'

    if (!FORCE) {
      if (!last) {
        // Already on npm at this version; start the history instead of publishing.
        console.error(`- ${manifest.name}: no ${prefix}* tag - baseline at v${fmtVer(current)} (no publish).`)
        baseline.push(`${prefix}${fmtVer(current)}`)
        continue
      }
      const own = changedSince(last.tag, pkg.watch)
      const cascade = (pkg.bundles ?? []).filter((d) => bumped.has(d))
      if (!own && !cascade.length) {
        console.error(`- ${manifest.name}: unchanged since ${last.tag} - skipping.`)
        continue
      }
      reason = own ? `changed since ${last.tag}` : `bundles ${cascade.join(' + ')}, which changed`
    }

    // Bump from whichever is higher: the last released tag or the working version
    // (guards against a manual bump that already moved package.json forward).
    const base = last && cmpVer(current, last.ver) <= 0 ? last.ver : current
    const next = bumpPatch(base)
    const nextStr = fmtVer(next)

    if (!CHECK_ONLY) {
      manifest.version = nextStr
      writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
    }
    console.error(
      `- ${manifest.name}: ${reason}: ${fmtVer(current)} -> ${nextStr}${CHECK_ONLY ? ' (check only, not written)' : ''}.`,
    )
    bumped.add(pkg.dir)
    publish.push({ dir: pkg.dir, name: manifest.name, to: nextStr, tag: `${prefix}${nextStr}` })
  }

  emit([
    ['any', publish.length > 0],
    ['packages', publish.map((p) => p.dir).join(',')],
    // JSON so a workflow step can test exact membership. `contains(packages, 'grid')`
    // is also true for a run that only ships grid-wc.
    ['packages_json', JSON.stringify(publish.map((p) => p.dir))],
    ['tags', publish.map((p) => p.tag).join(' ')],
    ['baseline', baseline.join(' ')],
    ['summary', publish.map((p) => `${p.name}@${p.to}`).join(', ')],
  ])
}

main()
