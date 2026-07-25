// Decide what to tweet today. Returns a "topic" object the composer turns into
// tweet text + a card. Selection is priority-based so the most timely thing
// wins, then falls back to an evergreen rotation:
//
//   1. release   - a new @svgrid/* version hit npm in the last RELEASE_WINDOW_H
//   2. blog       - a blog post went live today (frontmatter date === today)
//   3. highlight   - a curated feature/demo highlight (even days)
//   4. ai          - an AI-generated original tweet (odd days)
//
// Everything is deterministic given the date, so the same day never produces
// two different picks, and the highlight rotation advances one step per day.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HIGHLIGHTS } from './highlights.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')

const RELEASE_WINDOW_H = Number(process.env.TWEET_RELEASE_WINDOW_H || 26)
const PACKAGES = ['@svgrid/grid', '@svgrid/enterprise']

const todayISO = () => new Date().toISOString().slice(0, 10)
const daysSinceEpoch = () => Math.floor(Date.now() / 86400000)

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

// ---- 1. release ---------------------------------------------------------
async function findRecentRelease() {
  for (const pkg of PACKAGES) {
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`)
      if (!res.ok) continue
      const data = await res.json()
      const latest = data['dist-tags']?.latest
      const when = latest && data.time?.[latest]
      if (!latest || !when) continue
      const ageH = (Date.now() - new Date(when).getTime()) / 3600000
      if (ageH <= RELEASE_WINDOW_H) {
        return { pkg, version: latest, publishedAt: when }
      }
    } catch {
      // Registry unreachable - just skip the release check.
    }
  }
  return null
}

// ---- 2. blog ------------------------------------------------------------
function findTodaysBlogPost() {
  if (!existsSync(BLOG_DIR)) return null
  const today = todayISO()
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))
  for (const f of files) {
    const raw = readFileSync(join(BLOG_DIR, f), 'utf-8')
    const meta = frontmatter(raw)
    if (meta.date === today) {
      return {
        slug: f.replace(/\.md$/, ''),
        title: meta.title || f.replace(/\.md$/, ''),
        description: meta.description || '',
        category: meta.category || '',
        tags: meta.tags || '',
      }
    }
  }
  return null
}

// ---- 3. highlight -------------------------------------------------------
function pickHighlight() {
  const idx = daysSinceEpoch() % HIGHLIGHTS.length
  return HIGHLIGHTS[idx]
}

// Main entry. `force` (env TWEET_FORCE) can pin a type for testing:
//   'release' | 'blog' | 'highlight' | 'ai'
export async function selectContent(force = process.env.TWEET_FORCE) {
  if (force !== 'release' && force !== 'blog' && force !== 'highlight' && force !== 'ai') {
    force = undefined
  }

  if (!force || force === 'release') {
    const release = await findRecentRelease()
    if (release) return { type: 'release', ...release }
    if (force === 'release') return null
  }

  if (!force || force === 'blog') {
    const post = findTodaysBlogPost()
    if (post) return { type: 'blog', ...post }
    if (force === 'blog') return null
  }

  if (force === 'highlight') return { type: 'highlight', ...pickHighlight() }
  if (force === 'ai') return { type: 'ai' }

  // Evergreen rotation: alternate highlight (even days) and AI (odd days).
  return daysSinceEpoch() % 2 === 0
    ? { type: 'highlight', ...pickHighlight() }
    : { type: 'ai' }
}
