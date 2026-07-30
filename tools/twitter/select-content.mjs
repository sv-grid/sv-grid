// Decide what to tweet today, in priority order:
//   1. release    - a MAJOR or MINOR @svgrid/* release (1st/2nd version number
//                   bumped) in the last RELEASE_WINDOW_H. Patch-only releases
//                   (3rd number) are IGNORED and never tweeted.
//   2. blog       - the blog post that went live today (frontmatter date === today)
//   3. highlight   - a curated feature highlight (even days)
//   4. ai          - an AI-generated original tweet (odd days)
//
// A fresh blog post ships almost every day, so the daily tweet is normally ABOUT
// that day's post: its own hero image + AI copy that talks about the post itself.
// A meaningful (major/minor) release takes over the tweet for that day; a patch
// release is skipped so it never crowds out the blog.
//
// The blog topic also carries the post's own hero image (the first inline
// /blog-media (or /docs-media) image), resolved to a local file in the cloned
// website, so the tweet can use the real post image instead of a rendered card.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HIGHLIGHTS } from './highlights.mjs'
import { PRODUCT_TIPS } from './tips-data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')
const PUBLIC_DIR = join(ROOT, 'website', 'public')

const RELEASE_WINDOW_H = Number(process.env.TWEET_RELEASE_WINDOW_H || 26)
const PACKAGES = ['@svgrid/grid', '@svgrid/enterprise']

const todayISO = () => new Date().toISOString().slice(0, 10)
const daysSinceEpoch = () => Math.floor(Date.now() / 86400000)

function frontmatterAndBody(rawInput) {
  const raw = rawInput.replace(/\r\n/g, '\n') // tolerate CRLF (Windows checkouts)
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
// Parse the numeric x.y.z core of a semver string (ignores any prerelease tag).
const parseVer = (v) => {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/)
  return m ? [+m[1], +m[2], +m[3]] : null
}
const cmpVer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// Classify `latest` against the highest earlier published version:
//   'major' if the 1st number changed, 'minor' if the 2nd, else 'patch'.
// A brand-new package (no earlier version) counts as 'minor' so it gets posted.
function classifyBump(latest, versions) {
  const L = parseVer(latest)
  if (!L) return 'patch'
  let prev = null
  for (const v of versions) {
    const p = parseVer(v)
    if (p && cmpVer(p, L) < 0 && (!prev || cmpVer(p, prev) > 0)) prev = p
  }
  if (!prev) return 'minor'
  if (L[0] !== prev[0]) return 'major'
  if (L[1] !== prev[1]) return 'minor'
  return 'patch'
}

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
        const bump = classifyBump(latest, Object.keys(data.versions || {}))
        return { pkg, version: latest, publishedAt: when, bump }
      }
    } catch { /* registry unreachable - skip */ }
  }
  return null
}

// A short plain-text excerpt of the post's opening, so the tweet copy can talk
// about what the post actually says (not just its title). Drops the frontmatter
// leftovers, images, headings and markdown syntax, then keeps the first ~600
// chars of real prose.
function bodyExcerpt(body, limit = 600) {
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/[*_`>#]/g, ' ') // stray markdown
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  return cut.slice(0, cut.lastIndexOf(' ')) + '...'
}

function toPost(f, meta, body) {
  return {
    slug: f.replace(/\.md$/, ''),
    title: meta.title || f.replace(/\.md$/, ''),
    description: meta.description || '',
    excerpt: bodyExcerpt(body),
    category: meta.category || '',
    tags: meta.tags || '',
    image: heroImage(body), // { path, url, alt, mime } | null
  }
}

// ---- 2. blog ------------------------------------------------------------
// Return the post whose frontmatter date === today. Some days have more than one
// post; prefer one that ships a hero image (nicer tweet), else the first found.
function findTodaysBlogPost() {
  if (!existsSync(BLOG_DIR)) return null
  const today = todayISO()
  const matches = []
  for (const f of readdirSync(BLOG_DIR).filter((x) => x.endsWith('.md'))) {
    const { meta, body } = frontmatterAndBody(readFileSync(join(BLOG_DIR, f), 'utf-8'))
    if (meta.date === today) matches.push(toPost(f, meta, body))
  }
  if (!matches.length) return null
  return matches.find((p) => p.image) || matches[0]
}

// ---- 3. highlight -------------------------------------------------------
const pickHighlight = () => HIGHLIGHTS[daysSinceEpoch() % HIGHLIGHTS.length]

// ---- tip ----------------------------------------------------------------
// The second daily tweet: one product tip, rotated day by day through the whole
// pool (grid + UI components + Studio) so it cycles across all three areas.
const pickTip = () => PRODUCT_TIPS[daysSinceEpoch() % PRODUCT_TIPS.length]

// Main entry. `force` (env TWEET_FORCE) pins a type:
//   release | blog | highlight | ai | tip
// 'tip' is how the separate daily-tip workflow selects the product-tip tweet;
// the main daily tweet never auto-selects it.
export async function selectContent(force = process.env.TWEET_FORCE) {
  if (!['release', 'blog', 'highlight', 'ai', 'tip'].includes(force)) force = undefined

  if (force === 'tip') return { type: 'tip', ...pickTip() }

  // A MAJOR or MINOR release (1st or 2nd version number bumped) is newsworthy and
  // always gets the tweet, even over today's blog post. A PATCH-only release
  // (3rd number) is skipped entirely, so it never crowds out the blog. Forcing
  // 'release' posts the latest regardless of bump (for manual preview/testing).
  if (!force || force === 'release') {
    const release = await findRecentRelease()
    if (release && (force === 'release' || release.bump !== 'patch')) {
      return { type: 'release', ...release }
    }
    if (force === 'release') return null
  }
  // Blog next: we publish a post almost every day and the daily tweet is normally
  // about that post. Highlight/ai only cover the rare postless, releaseless day.
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
