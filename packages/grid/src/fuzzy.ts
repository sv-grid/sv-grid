/**
 * fuzzy - a tiny subsequence fuzzy matcher for command palettes / quick filters.
 * `fuzzyScore(text, query)` returns a score (higher = better) when every query
 * character appears in order in `text`, or `null` when it doesn't. Contiguous
 * runs, word-boundary starts and early matches score higher. Case-insensitive,
 * pure, dependency-free.
 */
const BOUNDARY = /[\s\-_/.]/

export function fuzzyScore(text: string, query: string): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const t = text.toLowerCase()
  let from = 0
  let score = 0
  let run = 0
  let prev = -2
  for (const ch of q) {
    const idx = t.indexOf(ch, from)
    if (idx < 0) return null
    if (idx === prev + 1) {
      run += 1
      score += 5 + run * 2 // contiguous run
    } else {
      run = 0
      score += 1
    }
    if (idx === 0 || BOUNDARY.test(t[idx - 1] ?? '')) score += 8 // word start
    score += Math.max(0, 3 - Math.floor(idx / 4)) // earliness
    prev = idx
    from = idx + 1
  }
  return score
}

/** Whether `query` fuzzy-matches `text`. */
export function fuzzyMatch(text: string, query: string): boolean {
  return fuzzyScore(text, query) !== null
}
