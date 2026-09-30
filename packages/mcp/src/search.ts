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
/**
 * Words too common to identify anything, dropped before matching.
 *
 * People phrase queries as questions - "how do I sort a column" - and every
 * one of those filler words matched something. In the API search it was worse
 * than noise: a single `a` matched 210 of 240 names, so the results came back
 * led by `SvGridBoard` and `createSvGrid` for a query about pinning.
 */
export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how',
  'i', 'in', 'is', 'it', 'my', 'of', 'on', 'or', 'the', 'to', 'use', 'want', 'what', 'when',
  'where', 'which', 'with', 'you',
])

/** Terms worth matching on: longer than one character, and not filler. */
export function meaningfulTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !STOP_WORDS.has(t)),
    ),
  ]
}

export function queryTokens(query: string): string[] {
  const tokens = [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1))]
  // Drop filler only when something specific survives - "do" is filler in "how
  // do I sort", but a query that is ALL filler still has to match on something
  // rather than silently matching everything.
  const specific = tokens.filter((t) => !STOP_WORDS.has(t))
  if (specific.length) return specific
  return tokens.length ? tokens : [query.toLowerCase().trim()]
}

/**
 * Reduce a term to a stem that still matches its other forms as a substring.
 *
 * Terms match by substring, so "virtual" already finds "virtualization", but the
 * reverse fails: "virtual scrolling rows" dropped the virtualization page, which
 * says "scroll" and "row" and never "scrolling" or "rows". Stripping the common
 * inflections fixes that direction. Deliberately crude - it only ever shortens
 * a term, so it can widen a match but never lose one the full word had. Used
 * only as a fallback presence check; ranking still scores the exact term.
 */
export function stem(term: string): string {
  // Longer minimums on the verb endings keep "string" from becoming "str".
  for (const [suffix, min] of [['ing', 4], ['ed', 4], ['ies', 3], ['s', 3]] as const) {
    if (!term.endsWith(suffix)) continue
    let base = term.slice(0, -suffix.length)
    if (base.length < min) continue
    // "pinning" -> "pinn" -> "pin", "pinned" -> "pin". "queries" -> "quer"
    // matches "query" too.
    if (suffix !== 's' && suffix !== 'ies' && base.at(-1) === base.at(-2)) base = base.slice(0, -1)
    return base
  }
  return term
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
      // The stem only decides whether the term is present at all. Scoring it
      // like the exact form reorders pages that already matched: "column
      // filtering" put "Custom column filters" above the filtering overview.
      else if (markdown.includes(stem(t))) {
        matched += 1
        score += 1
      }
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
      excerpt: excerptAround(s.d.markdown, [phrase, ...tokens, ...tokens.map(stem)]),
    })),
    total: pool.length,
    partial: complete.length === 0 && scored.length > 0,
  }
}
