/**
 * Which demos have shipped in a release, for the gallery's "new" badge.
 *
 * A demo is new until the release after it lands, and not a day longer: the
 * badge says "this came in since the version you have", which a fixed window
 * of days cannot say. The list lives in examples/src/shared/released-demos.json
 * and the gallery badges every demo NOT on it.
 *
 * Two ways to build it:
 *  - from a release tag: the demo files that were in the tree at that tag.
 *    Exact for any past release, and how the file was first written.
 *  - from the working tree: every demo registered now. The release script
 *    calls this when it bumps @svgrid/grid, because everything registered at
 *    that moment is what the release ships.
 *
 * Either way, a demo held back by a release date (tools/lib/releases.mjs) is
 * left off: it is not public yet, so when its date comes it is new.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pendingDemoIds } from './releases.mjs'

export const RELEASED_DEMOS_FILE = 'examples/src/shared/released-demos.json'

const REGISTRY = 'examples/src/shared/registry.ts'
const COMMUNITY_DIR = 'examples/src/demos/community'

/** `RENAMED_DEMOS` from the website registry, when the submodule is there. */
function renames(root) {
  const file = join(root, 'website', 'src', 'lib', 'demos.ts')
  if (!existsSync(file)) return {}
  const block = /RENAMED_DEMOS[^=]*=\s*\{([\s\S]*?)\}/.exec(readFileSync(file, 'utf-8'))
  const out = {}
  if (!block) return out
  for (const m of block[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) out[m[1]] = m[2]
  return out
}

/** Every `demo('id', ...)` in the examples registry source. */
function registryIds(source) {
  return [...source.matchAll(/\bdemo\(\s*'([^']+)'/g)].map((m) => m[1])
}

/** Gallery ids of community demo files: `community-<slug>`. */
function communityIds(fileNames) {
  return fileNames.filter((f) => f.endsWith('.svelte')).map((f) => `community-${f.replace(/^.*\//, '').slice(0, -'.svelte'.length)}`)
}

function finish(root, ids, release, date) {
  const renamed = renames(root)
  const pending = pendingDemoIds(date)
  const out = new Set()
  for (const id of ids) {
    const current = renamed[id] ?? id
    if (!pending.has(current)) out.add(current)
  }
  return { release, date, ids: [...out].sort() }
}

/**
 * The demos registered at a release tag, read from the registry as it was at
 * that commit - the same source `snapshotCurrent` reads, so a snapshot taken
 * by the release run and one rebuilt from its tag agree.
 */
export function snapshotFromTag(root, tag) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf-8' })
  const date = git('log', '-1', '--format=%cs', tag).trim()
  const registry = git('show', `${tag}:${REGISTRY}`)
  const community = git('ls-tree', '--name-only', tag, '--', `${COMMUNITY_DIR}/`).split('\n').filter(Boolean)
  return finish(root, [...registryIds(registry), ...communityIds(community)], tag, date)
}

/** Every demo registered in the working tree: what a release cut now ships. */
export function snapshotCurrent(root, release, date = new Date().toISOString().slice(0, 10)) {
  const registry = readFileSync(join(root, REGISTRY), 'utf-8')
  const communityDir = join(root, COMMUNITY_DIR)
  const community = existsSync(communityDir) ? readdirSync(communityDir) : []
  return finish(root, [...registryIds(registry), ...communityIds(community)], release, date)
}

export function writeSnapshot(root, snapshot) {
  writeFileSync(join(root, RELEASED_DEMOS_FILE), JSON.stringify(snapshot, null, 2) + '\n')
  return RELEASED_DEMOS_FILE
}

/** The newest `grid-v*` tag, by version. */
export function latestGridTag(root) {
  const tags = execFileSync('git', ['tag', '-l', 'grid-v*', '--sort=-v:refname'], { cwd: root, encoding: 'utf-8' })
  return tags.split('\n').find(Boolean) ?? null
}
