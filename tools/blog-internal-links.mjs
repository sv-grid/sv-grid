#!/usr/bin/env node
/**
 * Internal-linking pass for the blog: give every post a "Related reading" block
 * that links to its most-related siblings. Internal links distribute ranking
 * power and let search + AI engines see the topic clusters that 166 orphaned
 * posts currently hide (before this ran, 1 of 166 posts linked to another).
 *
 *   node tools/blog-internal-links.mjs            # write the blocks
 *   node tools/blog-internal-links.mjs --dry-run  # show what would change
 *   node tools/blog-internal-links.mjs --limit 5  # sample: only process N files (with --dry-run)
 *
 * How it picks related posts:
 *   score = 3 * (shared tags) + 1 * (same category)
 *   ties broken by newest date, then title. Top 5 win.
 *
 * Only PUBLISHED posts (date <= today) are used as link TARGETS, so we never
 * link to a post the drip has not released yet. The block itself is added to
 * every post (published or queued) so links work the moment a queued post goes
 * live; just re-run periodically to refresh as the queue publishes.
 *
 * Idempotent: the block lives between HTML comment markers and is fully
 * replaced on each run, so hand-written body text is never touched.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(HERE, '..', 'website', 'src', 'content', 'blog')

const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity

const START = '<!-- related:start -->'
const END = '<!-- related:end -->'
const RELATED_COUNT = 5
const TODAY = new Date().toISOString().slice(0, 10)

function parseFrontmatter(raw) {
  // Tolerate a leading UTF-8 BOM and CRLF line endings (Windows checkouts add
  // both; without this the ^--- anchor fails and every field parses as empty).
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const meta = {}
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return meta
}

function tagsOf(meta) {
  return (meta.tags || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

if (!existsSync(BLOG_DIR)) {
  console.error(`Blog dir not found: ${BLOG_DIR}\nCheck out the private website submodule first.`)
  process.exit(1)
}

// Load every post.
const posts = readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((file) => {
    const path = join(BLOG_DIR, file)
    const raw = readFileSync(path, 'utf-8')
    const meta = parseFrontmatter(raw)
    return {
      file,
      path,
      raw,
      slug: file.replace(/\.md$/, ''),
      title: meta.title || file.replace(/\.md$/, ''),
      category: (meta.category || '').toLowerCase(),
      tags: tagsOf(meta),
      date: meta.date || '1970-01-01',
      published: (meta.date || '9999-12-31') <= TODAY,
    }
  })

const targets = posts.filter((p) => p.published)

function related(post) {
  return targets
    .filter((c) => c.slug !== post.slug)
    .map((c) => {
      const shared = c.tags.filter((t) => post.tags.includes(t)).length
      const score = 3 * shared + (c.category && c.category === post.category ? 1 : 0)
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.c.date < b.c.date ? 1 : -1) || a.c.title.localeCompare(b.c.title))
    .slice(0, RELATED_COUNT)
    .map((x) => x.c)
}

function buildBlock(list) {
  const items = list.map((p) => `- [${p.title}](/blog/${p.slug})`).join('\n')
  return `${START}\n\n## Related reading\n\n${items}\n\n${END}`
}

// Replace an existing block, else append to the end.
function applyBlock(raw, block) {
  const re = new RegExp(`${START}[\\s\\S]*?${END}`)
  if (re.test(raw)) return raw.replace(re, block)
  return raw.replace(/\s*$/, '') + '\n\n' + block + '\n'
}

let changed = 0
let skippedNoRelated = 0
const samples = []

let processed = 0
for (const post of posts) {
  if (processed >= LIMIT) break
  processed++

  const list = related(post)
  if (list.length === 0) {
    skippedNoRelated++
    continue
  }
  const block = buildBlock(list)
  const next = applyBlock(post.raw, block)
  if (next === post.raw) continue
  changed++

  if (DRY_RUN) {
    if (samples.length < 4) {
      samples.push(`\n----- ${post.slug} (${post.tags.slice(0, 3).join(', ') || 'no tags'}) -----\n${block}`)
    }
  } else {
    writeFileSync(post.path, next)
  }
}

console.log(`Posts: ${posts.length} total, ${targets.length} published (link targets).`)
console.log(`${DRY_RUN ? 'Would update' : 'Updated'}: ${changed}. No related found: ${skippedNoRelated}.`)
if (DRY_RUN) {
  console.log('\n=== SAMPLE BLOCKS ===')
  console.log(samples.join('\n'))
  console.log('\n(dry run - nothing written)')
}
