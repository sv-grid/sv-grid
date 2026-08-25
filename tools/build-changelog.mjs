#!/usr/bin/env node
/**
 * Regenerate packages/grid/CHANGELOG.md from git history.
 *
 * The changelog had been hand-written up to 1.2.3 and then abandoned while the
 * package went on to 2.6.x across ~100 release tags, so the two disagreed with
 * each other and with npm. Rather than invent prose for a hundred releases,
 * this derives each release's entry from the commit subjects in its tag range.
 *
 * The hand-written entries are BETTER than anything generated (they explain
 * cause and consequence), so everything at or below the newest hand-written
 * version is preserved verbatim and only the undocumented releases above it are
 * generated.
 *
 *   node tools/build-changelog.mjs          # write
 *   node tools/build-changelog.mjs --check  # fail if out of date (CI)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'packages', 'grid', 'CHANGELOG.md')
const TAG_PREFIX = 'grid-v'
const CHECK = process.argv.includes('--check')

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

/** Commit subjects that carry no information for a reader of the changelog. */
const NOISE = [
  /^release:/i,
  /^Merge (branch|pull request|remote)/i,
  /^Point the website submodule/i,
  /^(Update|Regenerate) (the )?(website|docs index)/i,
  /^up$/i,
  /^wip\b/i,
  /^bump\b/i,
  /^\W*$/,
]
const isNoise = (subject) => NOISE.some((re) => re.test(subject.trim()))

const parseVer = (v) => v.split('.').map((n) => Number.parseInt(n, 10))
const cmpVer = (a, b) => {
  const [x, y] = [parseVer(a), parseVer(b)]
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

function releases() {
  const tags = git(['tag', '--list', `${TAG_PREFIX}*`])
    .split('\n')
    .filter(Boolean)
    .map((t) => ({ tag: t, version: t.slice(TAG_PREFIX.length) }))
    .filter((r) => /^\d+\.\d+\.\d+$/.test(r.version))
    .sort((a, b) => cmpVer(a.version, b.version))

  return tags.map((r, i) => {
    const prev = tags[i - 1]
    const range = prev ? `${prev.tag}..${r.tag}` : r.tag
    let subjects = []
    try {
      subjects = git(['log', '--no-merges', '--format=%s', range]).split('\n').filter(Boolean)
    } catch {
      // A tag that is not reachable from this clone (created on another branch)
      // simply yields no entries rather than aborting the whole build.
    }
    let date = ''
    try {
      date = git(['log', '-1', '--format=%cs', r.tag])
    } catch { /* unreachable tag */ }
    return { ...r, date, changes: subjects.filter((s) => !isNoise(s)) }
  })
}

// Marks where the generated section ends and the hand-written one begins.
// Without it, a second run would read its own output back, move the cutoff to
// the newest generated version, and produce a different file every time.
const SENTINEL = '<!-- build-changelog: hand-written entries below this line -->'

/** Newest version documented by hand, plus that section's raw text. */
function existing() {
  let text = ''
  try {
    text = readFileSync(OUT, 'utf8')
  } catch {
    return { cutoff: null, text: '' }
  }

  // On every run after the first, the hand-written block is exactly what
  // follows the sentinel.
  const marked = text.indexOf(SENTINEL)
  if (marked !== -1) text = text.slice(marked + SENTINEL.length)

  const versions = [...text.matchAll(/^## \[?(\d+\.\d+\.\d+)/gm)].map((m) => m[1])
  if (!versions.length) return { cutoff: null, text: '' }
  const newest = versions.slice().sort(cmpVer)[versions.length - 1]
  const idx = text.search(new RegExp(`^## \\[?${newest.replace(/\./g, '\\.')}`, 'm'))
  return { cutoff: newest, text: text.slice(idx) }
}

function build() {
  const { cutoff, text: handWritten } = existing()
  const all = releases()
  const generated = all
    .filter((r) => !cutoff || cmpVer(r.version, cutoff) > 0)
    .filter((r) => r.changes.length)
    .sort((a, b) => cmpVer(b.version, a.version))

  const head = [
    '# @svgrid/grid changelog',
    '',
    'Releases above ' + (cutoff ? `${cutoff} ` : '') +
      'are generated from the commit subjects in each release tag range',
    '(`node tools/build-changelog.mjs`), so they describe what changed rather than',
    'reading as polished release notes.' +
      (cutoff ? ` Entries from ${cutoff} down are hand-written.` : ''),
    '',
  ].join('\n')

  const body = generated
    .map((r) => {
      const lines = [`## ${r.version}`, '', r.date ? `_${r.date}_` : '', '']
        .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
      for (const c of r.changes) lines.push(`- ${c}`)
      return lines.join('\n')
    })
    .join('\n\n')

  return `${head}\n${body}\n\n${SENTINEL}\n\n${handWritten}`.replace(/\n{4,}/g, '\n\n\n')
}

const next = build()
if (CHECK) {
  const current = (() => { try { return readFileSync(OUT, 'utf8') } catch { return '' } })()
  if (current.trim() !== next.trim()) {
    console.error('CHANGELOG.md is out of date - run `node tools/build-changelog.mjs`')
    process.exit(1)
  }
  console.log('CHANGELOG.md is up to date')
} else {
  writeFileSync(OUT, next)
  const count = (next.match(/^## \d+\.\d+\.\d+/gm) || []).length
  console.log(`build-changelog: ${OUT.replace(ROOT, '.')} -> ${count} releases`)
}
