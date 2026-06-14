#!/usr/bin/env node
/**
 * Drip-publish the blog: assign one publish date per day to the backlog.
 *
 * A post is "live" only once its frontmatter `date` has arrived (the gate lives
 * in website/src/lib/blog.ts and tools/prerender-site.mjs). This script takes
 * every not-yet-published, non-pinned post and assigns sequential dates - one
 * per day - so exactly one new post goes live each day. Cornerstone posts are
 * scheduled first; the rest follow alphabetically by slug.
 *
 * Already-published posts (date before today) and pinned posts are left alone.
 *
 * Usage:
 *   node tools/schedule-blog.mjs            # start tomorrow, 1 post/day
 *   node tools/schedule-blog.mjs 2026-07-01 # start on a specific date
 *   node tools/schedule-blog.mjs 2026-07-01 2  # 2 posts/day
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(HERE, '..', 'website', 'src', 'content', 'blog')

// Highest-value posts publish first (best ranking / AI-citation potential).
const CORNERSTONES = [
  'best-svelte-data-grids-2026',
  'ag-grid-alternatives-for-svelte',
  'what-is-a-headless-data-grid',
  'virtual-scrolling-explained',
  'data-grid-vs-data-table',
  'client-side-vs-server-side-data',
  'accessible-data-table-wcag',
  'build-vs-buy-svelte-data-table',
  'svgrid-cheat-sheet',
  'prompts-to-build-svelte-data-grid',
  'svelte-data-grid-sveltekit-supabase',
  'svelte-data-grid-tanstack-query',
  'building-admin-dashboard-svelte',
  'migrating-from-ag-grid-to-svgrid',
  'migrating-from-tanstack-table-to-svgrid',
]

const todayISO = () => new Date().toISOString().slice(0, 10)
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  const meta = {}
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return meta
}

async function main() {
  const today = todayISO()
  const start = process.argv[2] || addDays(today, 1) // default: tomorrow
  const perDay = Math.max(1, Number(process.argv[3] || 1))

  const files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith('.md'))
  const posts = []
  for (const f of files) {
    const raw = await readFile(join(BLOG_DIR, f), 'utf-8')
    const meta = frontmatter(raw)
    posts.push({ file: f, slug: f.replace(/\.md$/, ''), date: meta.date ?? '1970-01-01', pinned: meta.pinned === 'true' })
  }

  // Queue: strictly-future, non-pinned posts. Posts dated today or earlier are
  // already live and are left untouched, so re-running never un-publishes them.
  const queue = posts.filter((p) => p.date > today && !p.pinned)
  const rank = (p) => {
    const i = CORNERSTONES.indexOf(p.slug)
    return i === -1 ? CORNERSTONES.length : i
  }
  queue.sort((a, b) => rank(a) - rank(b) || a.slug.localeCompare(b.slug))

  let updated = 0
  for (let i = 0; i < queue.length; i++) {
    const date = addDays(start, Math.floor(i / perDay))
    const path = join(BLOG_DIR, queue[i].file)
    const raw = await readFile(path, 'utf-8')
    const next = raw.replace(/^date:.*$/m, `date: ${date}`)
    if (next !== raw) {
      await writeFile(path, next)
      updated += 1
    }
    process.stdout.write(`${date}  ${queue[i].slug}\n`)
  }
  process.stdout.write(`\nscheduled ${queue.length} posts (${updated} updated), ${perDay}/day, starting ${start}\n`)
  process.stdout.write(`already-live posts (dated before ${today}) and pinned posts were left unchanged.\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
