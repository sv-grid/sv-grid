#!/usr/bin/env node
/**
 * Write examples/src/shared/released-demos.json: the demos that have shipped,
 * which the gallery leaves without a "new" badge. See tools/lib/released-demos.mjs.
 *
 *   node tools/snapshot-released-demos.mjs                  # at the newest grid-v* tag
 *   node tools/snapshot-released-demos.mjs --tag grid-v3.0.7
 *   node tools/snapshot-released-demos.mjs --current grid-v3.0.8
 *
 * `--current` lists every demo registered now. tools/release-packages.mjs does
 * the same when it bumps @svgrid/grid, so this is for a hand repair.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { latestGridTag, snapshotCurrent, snapshotFromTag, writeSnapshot } from './lib/released-demos.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? (args[i + 1] ?? '') : null
}

const current = flag('--current')
let snapshot
if (current !== null) {
  if (!current) {
    console.error('--current needs the release name, e.g. --current grid-v3.0.8')
    process.exit(1)
  }
  snapshot = snapshotCurrent(root, current)
} else {
  const tag = flag('--tag') || latestGridTag(root)
  if (!tag) {
    console.error('No grid-v* tag found. Pass --tag or --current.')
    process.exit(1)
  }
  snapshot = snapshotFromTag(root, tag)
}
const file = writeSnapshot(root, snapshot)
console.log(`${file}: ${snapshot.ids.length} demos released as of ${snapshot.release} (${snapshot.date})`)
