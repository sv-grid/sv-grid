#!/usr/bin/env node
/**
 * Generate website/public/changelog.json from docs/changelog.md.
 *
 * docs/changelog.md has promised this file for a long time - "For
 * machine-readable releases, fetch /changelog.json - same content, parseable
 * shape" - and nothing produced it. The URL 404'd, and the claim had since
 * propagated into llms-full.txt, so models were being pointed at it too.
 *
 * Note this is a DIFFERENT changelog from packages/grid/CHANGELOG.md, which
 * tools/build-changelog.mjs derives from git tags. That one is per-release
 * commit subjects; this one is the hand-written user-facing log, which is what
 * the docs link to.
 *
 *   node tools/build-changelog-json.mjs          # write
 *   node tools/build-changelog-json.mjs --check  # fail if out of date (CI)
 *
 * Shape:
 *   { "releases": [ { version, date, groups: [ { name, changes: [
 *       { section, title, text } ] } ] } ] }
 *
 * `section` is null for releases that list bullets straight under the group
 * (1.0.0 does); `title` is the leading bold lead-in when an entry has one,
 * which is what a consumer wants for a headline. `text` keeps the markdown.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Anchored to this file, never to cwd: the website's `prebuild` runs the tools
// from `website/`, where a relative 'docs' resolves to website/docs. That
// exact bug took the deploy down once already.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'docs', 'changelog.md')
const OUT = join(ROOT, 'website', 'public', 'changelog.json')

/** `## [1.0.0] - 2026-06-16` or `## [Unreleased]`. Anything else at `##` (the
 *  trailing "How we version" section) is prose, not a release. */
const RELEASE = /^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/

/** The bold lead-in most entries open with: `- **Thing happened.** rest`. */
function titleOf(text) {
  const m = /^\*\*(.+?)\*\*/.exec(text)
  return m ? m[1].replace(/[.:]\s*$/, '') : null
}

export function parseChangelog(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const releases = []
  let release = null
  let group = null
  let section = null
  let buffer = null

  const flush = () => {
    if (!buffer || !group) {
      buffer = null
      return
    }
    const text = buffer.join(' ').replace(/\s+/g, ' ').trim()
    if (text) group.changes.push({ section, title: titleOf(text), text })
    buffer = null
  }

  for (const line of lines) {
    const rel = RELEASE.exec(line)
    if (rel) {
      flush()
      release = { version: rel[1], date: rel[2] ?? null, groups: [] }
      releases.push(release)
      group = null
      section = null
      continue
    }
    // A non-release `##` ends the release list (the "How we version" tail).
    if (/^## /.test(line)) {
      flush()
      release = null
      group = null
      section = null
      continue
    }
    if (!release) continue

    const g = /^### (.+?)\s*$/.exec(line)
    if (g) {
      flush()
      group = { name: g[1], changes: [] }
      release.groups.push(group)
      section = null
      continue
    }
    const s = /^#### (.+?)\s*$/.exec(line)
    if (s) {
      flush()
      section = s[1]
      continue
    }
    const bullet = /^- (.*)$/.exec(line)
    if (bullet) {
      flush()
      buffer = [bullet[1]]
      continue
    }
    // Continuation of the current bullet: indented, and not a blank line.
    if (buffer && /^\s+\S/.test(line)) {
      buffer.push(line.trim())
      continue
    }
    flush()
  }
  flush()
  return { releases }
}

const output = JSON.stringify(parseChangelog(readFileSync(SRC, 'utf-8')), null, 2) + '\n'

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf-8') : ''
  if (current.replace(/\r\n/g, '\n') !== output) {
    console.error('build-changelog-json: changelog.json is STALE. Run: node tools/build-changelog-json.mjs')
    process.exit(1)
  }
  console.log('build-changelog-json: changelog.json is current')
} else {
  writeFileSync(OUT, output)
  const { releases } = parseChangelog(readFileSync(SRC, 'utf-8'))
  const entries = releases.reduce(
    (n, r) => n + r.groups.reduce((m, g) => m + g.changes.length, 0),
    0,
  )
  console.log(
    `build-changelog-json: ${releases.length} releases, ${entries} entries -> website/public/changelog.json`,
  )
}
