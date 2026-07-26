// Decide what to tweet today, in priority order:
//   1. release   - a new @svgrid/* version hit npm in the last RELEASE_WINDOW_H
//   2. blog       - a blog post went live today (frontmatter date === today)
//   3. highlight   - a curated feature highlight (even days)
//   4. ai          - an AI-generated original tweet (odd days)
//
// The blog topic also carries the post's own hero image (the first inline
// /blog-media (or /docs-media) image), resolved to a local file in the cloned
// website, so the tweet can use the real post image instead of a rendered card.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HIGHLIGHTS } from './highlights.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')
const PUBLIC_DIR = join(ROOT, 'website', 'public')

const RELEASE_WINDOW_H = Number(process.env.TWEET_RELEASE_WINDOW_H || 26)
const PACKAGES = ['@svgrid/grid', '@svgrid/enterprise']

const todayISO = () => new Date().toISOString().slice(0, 10)
const daysSinceEpoch = () => Math.floor(Date.now() / 86400000)

function frontmatterAndBody(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  const meta = {}
  let body = raw
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    }
    body = m[2]
  }
  return { meta, body }
}

// First inline image in the post body, resolved to a local file that exists.
// Returns { path, alt, mime } or null. Only /blog-media and /docs-media (served
// from website/public) are used, so the file is present in the cloned website.
function heroImage(body) {
  const re = /!\[([^\]]*)\]\((\/(?:blog-media|docs-media)\/[^)\s]+?\.(png|jpe?g))\)/i
  const m = body.match(re)
  if (!m) return null
  const rel = m[2]
  const diskPath = join(PUBLIC_DIR, rel.replace(/^\//, ''))
  if (!existsSync(diskPath)) return null
  const mime = /\.jpe?g$/i.test(rel) ? 'image/jpeg' : 'image/png'
  return { path: diskPath, url: rel, alt: m[1] || '', mime }
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
      if ((Date.now() - new Date(when).getTime()) / 3600000 <= RELEASE_WINDOW_H) {
        return { pkg, version: latest, publishedAt: when }
      }
    } catch { /* registry unreachable - skip */ }
  }
  return null
}

// ---- 2. blog ------------------------------------------------------------
function findTodaysBlogPost() {
  if (!existsSync(BLOG_DIR)) return null
  const today = todayISO()
  for (const f of readdirSync(BLOG_DIR).filter((x) => x.endsWith('.md'))) {
    const { meta, body } = frontmatterAndBody(readFileSync(join(BLOG_DIR, f), 'utf-8'))
    if (meta.date === today) {
      return {
        slug: f.replace(/\.md$/, ''),
        title: meta.title || f.replace(/\.md$/, ''),
        description: meta.description || '',
        category: meta.category || '',
        tags: meta.tags || '',
        image: heroImage(body), // { path, url, alt, mime } | null
      }
    }
  }
  return null
}

// ---- 3. highlight -------------------------------------------------------
const pickHighlight = () => HIGHLIGHTS[daysSinceEpoch() % HIGHLIGHTS.length]

// Main entry. `force` (env TWEET_FORCE) pins a type for testing:
//   release | blog | highlight | ai
export async function selectContent(force = process.env.TWEET_FORCE) {
  if (!['release', 'blog', 'highlight', 'ai'].includes(force)) force = undefined

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

  return daysSinceEpoch() % 2 === 0
    ? { type: 'highlight', ...pickHighlight() }
    : { type: 'ai' }
}
