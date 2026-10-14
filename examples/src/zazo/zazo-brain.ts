/**
 * What Zazo makes of what someone types or says to him. No model and no
 * network: a handful of intents he can act on (explain the open demo, show
 * how to install, show the source, licensing), and everything else becomes
 * a demo search, which is what most questions in a demo gallery are.
 */

export type Intent =
  | { kind: 'greet' }
  | { kind: 'thanks' }
  | { kind: 'bye' }
  | { kind: 'who' }
  | { kind: 'about' }
  | { kind: 'start' }
  | { kind: 'code' }
  | { kind: 'license' }
  /** "open the pivot demo": go straight to the best match. */
  | { kind: 'open'; query: string }
  /** Anything else: look for demos (and docs, where the host has them). */
  | { kind: 'search'; query: string }

const clean = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()

// Words that carry the request, not the topic.
const FILLER = new Set(
  ('a an the some any me my i you your we our it this that please can could would will do does ' +
    'is are there have has want need like show find open load go to take see look looking for ' +
    'with of in on about how what which where demo demos example examples sample samples ' +
    'svgrid sv-grid hi hello hey yo hiya zazo').split(' '),
)

/** The topic words of a request: "show me a demo with tree data" -> "tree data". */
export function searchTerms(text: string): string {
  const words = clean(text).split(' ').filter(Boolean)
  const kept = words.filter((w) => !FILLER.has(w))
  // "grid" alone says nothing in a grid gallery, but "tree grid" does.
  const topical = kept.filter((w) => w !== 'grid' && w !== 'table')
  return (topical.length ? kept : []).join(' ')
}

export type Faq = { question: string; answer: string }

// Too common in questions to say what one is about.
const QUESTION_WORDS = new Set('why when who whose does did done get gets got use uses used make makes work works way much many also just only out up into than then there their them they its'.split(' '))
/** A word's rough stem, so "rows" meets "row" and "sorted" meets "sort". */
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '')
const topicWords = (text: string) =>
  new Set(searchTerms(text).split(' ').filter((w) => w.length > 2 && !QUESTION_WORDS.has(w)).map(stem))

/**
 * The open demo's FAQ entry a question is asking, or null. It has to share
 * at least two topic words with the entry's question (or its one word, for a
 * one-word question), and cover at least half of what was asked.
 */
export function matchFaq(text: string, faq: readonly Faq[]): Faq | null {
  const asked = topicWords(text)
  if (!asked.size) return null
  let best: Faq | null = null
  let bestScore = 0
  for (const entry of faq) {
    const words = topicWords(entry.question)
    let shared = 0
    for (const w of asked) if (words.has(w)) shared++
    if (shared < Math.min(2, asked.size) || shared / asked.size < 0.5) continue
    const score = shared / asked.size + shared / Math.max(words.size, 1)
    if (score > bestScore) { best = entry; bestScore = score }
  }
  return best
}

export function understand(text: string): Intent {
  const t = clean(text)
  const words = t.split(' ').filter(Boolean)
  if (!words.length) return { kind: 'greet' }

  if (words.length <= 3 && /^(hi|hello|hey|yo|hiya|good (morning|afternoon|evening))\b/.test(t)) return { kind: 'greet' }
  if (/\b(thanks|thank you|thx|cheers)\b/.test(t)) return { kind: 'thanks' }
  if (/^(bye|goodbye|see you|close|go away|hide|stop)\b/.test(t)) return { kind: 'bye' }
  if (/\b(who are you|your name|what are you)\b/.test(t)) return { kind: 'who' }
  if (/\b(price|pricing|cost|costs|license|licence|licensing|free|paid|buy|enterprise)\b/.test(t)) return { kind: 'license' }
  if (/\b(source|code)\b/.test(t) && /\b(this|the|show|see)\b/.test(t)) return { kind: 'code' }
  if (
    /\b(install|installation|get started|getting started|set up|setup|npm|pnpm|yarn)\b/.test(t) ||
    /\b(add|use|put) (it|this|svgrid|the grid|a grid)\b/.test(t) ||
    /\bmy (app|project|code|site)\b/.test(t)
  )
    return { kind: 'start' }
  if (
    /\b(what am i looking at|what is this|what's this|what does (this|it) (do|show)|explain|tell me about (this|it))\b/.test(t) ||
    /\b(this|current) (demo|example|one|page)\b/.test(t)
  )
    return { kind: 'about' }

  const query = searchTerms(t)
  if (/^(open|load|go to|take me to|show me|switch to)\b/.test(t) && query) return { kind: 'open', query }
  return { kind: 'search', query: query || t }
}
