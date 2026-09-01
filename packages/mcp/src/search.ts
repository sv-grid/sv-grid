/**
 * Doc ranking, shared by the stdio server and the remote Worker so both answer
 * the same query the same way.
 *
 * Pure and dependency-free: it takes the docs it should rank rather than
 * importing them, because the Worker loads its corpus from static assets at
 * request time while the stdio server has it bundled.
 */

export type RankableDoc = {
  slug: string
  title: string
  section: string
  markdown: string
}

export type DocHit = {
  slug: string
  title: string
  section: string
  score: number
  excerpt: string
}

export function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    n += 1
    i = haystack.indexOf(needle, i + needle.length)
  }
  return n
}

/** Split a query into distinct lowercase terms, dropping one-character noise. */
export function queryTokens(query: string): string[] {
  const tokens = [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1))]
  return tokens.length ? tokens : [query.toLowerCase().trim()]
}

/** A window of text around the first needle that appears, for search results. */
export function excerptAround(markdown: string, needles: string[]): string {
  const lower = markdown.toLowerCase()
  let idx = -1
  for (const n of needles) {
    idx = lower.indexOf(n)
    if (idx >= 0) break
  }
  if (idx < 0) idx = 0
  const start = Math.max(0, idx - 60)
  const end = Math.min(markdown.length, idx + 180)
  return markdown.slice(start, end).replace(/\s+/g, ' ').trim()
}

/**
 * Rank docs for a query. Whole-phrase hits outrank term hits, and the slug is
 * weighted heavily: a page named after the topic is the reference page for it,
 * where a recipe that merely mentions it is not. Pages matching every term win
 * outright; partial matches are only returned when nothing covers the query.
 */
export function rankDocs<T extends RankableDoc>(
  docs: readonly T[],
  query: string,
  limit: number,
): { hits: DocHit[]; total: number; partial: boolean } {
  const phrase = query.toLowerCase()
  const tokens = queryTokens(query)

  const scored: { d: T; score: number; complete: boolean }[] = []
  for (const d of docs) {
    const title = d.title.toLowerCase()
    const markdown = d.markdown.toLowerCase()
    const headings = (d.markdown.match(/^#{1,6}\s+.*$/gm) ?? []).join('\n').toLowerCase()
    const slugWords = d.slug.toLowerCase().replace(/[/-]/g, ' ')

    let score = 0
    if (title.includes(phrase)) score += 100
    if (slugWords.includes(phrase)) score += 60
    if (headings.includes(phrase)) score += 30
    if (markdown.includes(phrase)) score += 20

    let matched = 0
    for (const t of tokens) {
      const inTitle = title.includes(t)
      const inHeading = headings.includes(t)
      const count = occurrences(markdown, t)
      if (inTitle || inHeading || count > 0) matched += 1
      if (inTitle) score += 25
      if (slugWords.includes(t)) score += 10
      if (inHeading) score += 8
      // Capped so a long page cannot outrank a precise one on bulk alone.
      score += Math.min(count, 5)
    }
    if (score > 0) scored.push({ d, score, complete: matched === tokens.length })
  }

  const complete = scored.filter((s) => s.complete)
  const pool = complete.length ? complete : scored
  const ranked = pool
    .sort((a, b) => b.score - a.score || a.d.slug.localeCompare(b.d.slug))
    .slice(0, limit)

  return {
    hits: ranked.map((s) => ({
      slug: s.d.slug,
      title: s.d.title,
      section: s.d.section,
      score: s.score,
      excerpt: excerptAround(s.d.markdown, [phrase, ...tokens]),
    })),
    total: pool.length,
    partial: complete.length === 0 && scored.length > 0,
  }
}
