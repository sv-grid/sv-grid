#!/usr/bin/env node
/**
 * Assign real author bylines across the blog. Replaces the placeholder
 * "SvGrid Team" with one of three real authors, balanced deterministically by
 * slug so the assignment is stable across runs. The flagship company/story
 * posts go to Boyko Markov (founder voice); everything else is distributed
 * evenly across all three.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(HERE, '..', 'website', 'src', 'content', 'blog')

const AUTHORS = ['Boyko Markov', 'Victor Vidolov', 'Kamelia M']

// Marquee company / founder posts - authored by Boyko Markov for authenticity.
const FOUNDER = new Set([
  'introducing-svgrid',
  'jqwidgets-story-since-2011',
  'why-the-world-needed-another-grid',
  'smart-ui-gold-award-2025',
  'whats-new-@svgrid/enterprise',
  'svelte-5-is-here',
  'the-idea-a-native-svelte-grid',
])

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

async function main() {
  const files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith('.md'))
  const counts = { 'Boyko Markov': 0, 'Victor Vidolov': 0, 'Kamelia M': 0 }
  let updated = 0
  for (const f of files) {
    const slug = f.replace(/\.md$/, '')
    const author = FOUNDER.has(slug) ? 'Boyko Markov' : AUTHORS[hash(slug) % AUTHORS.length]
    counts[author] += 1
    const path = join(BLOG_DIR, f)
    const raw = await readFile(path, 'utf-8')
    const next = raw.replace(/^author:.*$/m, `author: ${author}`)
    if (next !== raw) { await writeFile(path, next); updated += 1 }
  }
  process.stdout.write(`assigned authors to ${files.length} posts (${updated} updated)\n`)
  for (const [name, n] of Object.entries(counts)) process.stdout.write(`  ${name}: ${n}\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
