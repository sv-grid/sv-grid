/**
 * Tiny client-side docs search. Builds an inverted-index-lite over every
 * page's title, headings, and body at module load - cheap enough since
 * the docs corpus fits in a few hundred KB - then ranks matches by where
 * the query hits (title > heading > body) and how dense the hits are.
 *
 * No fuzzy matching or stemming - they're surprisingly easy to skip when
 * you have ~80 pages and a focused vocabulary. If the result set ever
 * needs to fight for relevance, swap in MiniSearch and keep the same
 * public API.
 */

import { docs, type DocPage } from './docs'

export type DocSearchHit = {
  page: DocPage
  /** Higher = better match. Used to sort results before display. */
  score: number
  /** A short context snippet around the first match, with HTML <mark>
   *  highlights for the query terms. Empty when the match is title-only. */
  snippet: string
  /** Heading id to jump to (no leading "#"), or '' for the top of the page. */
  anchor: string
}

type IndexedPage = {
  page: DocPage
  titleLower: string
  /** Heading text + its slug-id, in document order. */
  headings: Array<{ text: string; textLower: string; id: string }>
  bodyLower: string
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildIndex(): IndexedPage[] {
  return docs.map((page) => {
    const headings: IndexedPage['headings'] = []
    const headingRe = /^(#{1,6})\s+(.+?)\s*$/gm
    let m: RegExpExecArray | null
    while ((m = headingRe.exec(page.markdown)) !== null) {
      const raw = (m[2] ?? '').trim()
      const plain = raw.replace(/`/g, '')
      const id = slugifyHeading(plain.replace(/^(\d+)\.\s+/, '$1-'))
      headings.push({ text: plain, textLower: plain.toLowerCase(), id })
    }
    return {
      page,
      titleLower: page.title.toLowerCase(),
      headings,
      // Strip code fences + leading hashes; lowercase for matching.
      bodyLower: page.markdown.toLowerCase(),
    }
  })
}

const INDEX = buildIndex()

/**
 * Run `query` against the index and return up to `limit` hits ranked by
 * relevance. An empty query returns an empty array (callers usually want
 * "show recent" or "show all" UX instead).
 */
export function searchDocs(query: string, limit = 12): DocSearchHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  // Tokenise on whitespace; the smallest helpful query is a single term.
  const terms = q.split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const out: DocSearchHit[] = []

  for (const entry of INDEX) {
    let score = 0
    let bestSnippet = ''
    let bestAnchor = ''

    // Title hits weigh the most.
    for (const t of terms) {
      if (entry.titleLower.includes(t)) score += 25
    }
    // Exact full-query in title is the strongest possible signal.
    if (entry.titleLower.includes(q)) score += 30

    // Heading hits next.
    for (const h of entry.headings) {
      for (const t of terms) {
        if (h.textLower.includes(t)) {
          score += 8
          if (!bestAnchor) bestAnchor = h.id
        }
      }
      if (h.textLower.includes(q)) {
        score += 15
        bestAnchor = h.id
      }
    }

    // Body hits.
    let bodyHitCount = 0
    for (const t of terms) {
      const ix = entry.bodyLower.indexOf(t)
      if (ix >= 0) {
        bodyHitCount += 1
        if (!bestSnippet) bestSnippet = makeSnippet(entry.page.markdown, ix, terms)
      }
    }
    if (entry.bodyLower.includes(q)) score += 5
    score += bodyHitCount * 2

    // Multi-term bonus: every term hit *somewhere* multiplies relevance.
    const termsHit = terms.filter(
      (t) =>
        entry.titleLower.includes(t) ||
        entry.bodyLower.includes(t) ||
        entry.headings.some((h) => h.textLower.includes(t)),
    ).length
    if (termsHit === terms.length && terms.length > 1) score += 10

    if (score > 0) {
      out.push({ page: entry.page, score, snippet: bestSnippet, anchor: bestAnchor })
    }
  }

  out.sort((a, b) => b.score - a.score)
  return out.slice(0, limit)
}

/** Cut ~80 chars around `ix`, escape it for safe HTML, and wrap each query
 *  term in `<mark>` so the UI can highlight matches. */
function makeSnippet(text: string, ix: number, terms: string[]): string {
  const start = Math.max(0, ix - 40)
  const end = Math.min(text.length, ix + 80)
  let raw = text.slice(start, end)
  // Strip markdown noise (just hashes and fences) so the snippet reads cleanly.
  raw = raw.replace(/^#+\s+/gm, '').replace(/`{1,3}/g, '').replace(/\n+/g, ' ').trim()
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  let highlighted = escaped
  // Highlight the longest terms first so partial overlaps don't double-wrap.
  const sortedTerms = [...new Set(terms)].sort((a, b) => b.length - a.length)
  for (const t of sortedTerms) {
    if (!t) continue
    const re = new RegExp(escapeRegex(t), 'gi')
    highlighted = highlighted.replace(re, (m) => `<mark>${m}</mark>`)
  }
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''
  return `${prefix}${highlighted}${suffix}`
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
