/**
 * demo-doc-match - propose a doc page for every gallery demo that has none.
 *
 * Scores each (demo, doc page) pair on shared vocabulary, drawn from the demo's
 * id/title/description/category and the page's path, title and headings. It
 * PROPOSES only - the output is reviewed and applied by demo-doc-embed.mjs, so
 * a bad match costs a read rather than a wrong link in the docs.
 */
import { loadRegistry, loadDocs, coverage } from './demo-doc-coverage.mjs'

/** Words that appear in nearly every demo and page, so they carry no signal. */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'from',
  'is', 'are', 'it', 'its', 'that', 'this', 'as', 'by', 'at', 'be', 'you',
  'your', 'can', 'not', 'but', 'so', 'one', 'all', 'each', 'per', 'own',
  'grid', 'svgrid', 'demo', 'demos', 'svelte', 'data', 'sv', 'help', 'docs',
  'md', 'index', 'use', 'using', 'when', 'what', 'how', 'why', 'new', 'set',
])

const tokens = (s) =>
  String(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))

/** Category -> doc subtrees that category's demos belong under. */
const CATEGORY_HINTS = {
  'Headless Editors': ['help/ui-components/', 'help/headless/'],
  Charts: ['help/charts', 'help/analytics'],
  Layout: ['help/ui-components/'],
  Scheduler: ['help/rows/scheduler'],
  Kanban: ['help/rows/kanban'],
  'Pivot Grid': ['help/pivot', 'help/grouping'],
  'Data Export & Import': ['help/export', 'help/import'],
  Spreadsheet: ['help/spreadsheet', 'recipes/'],
  Blocks: ['help/ui-components/', 'help/blocks'],
  'Server-Side Data': ['help/server/'],
  'Industry Templates': ['recipes/'],
  Alerts: ['help/alerts'],
  'Rows & Cells': ['help/rows/', 'help/cells/'],
  Recipes: ['recipes/'],
  Selection: ['help/selection', 'help/rows/'],
  'Selection & Clipboard': ['help/selection', 'help/clipboard'],
  Inputs: ['help/ui-components/'],
  Editing: ['help/editing/'],
  'Tree & Hierarchy': ['help/rows/tree', 'help/rows/'],
  'Real-time & Streaming': ['help/realtime', 'help/rows/'],
  Integrations: ['help/integrations', 'help/'],
  'Buttons & Toggles': ['help/ui-components/'],
  'Range & Feedback': ['help/ui-components/'],
  'Filtering & Search': ['help/filtering/'],
  'Sorting & Grouping': ['help/grouping', 'help/sorting'],
  Columns: ['help/columns/'],
  'Keyboard & Accessibility': ['help/accessibility', 'help/keyboard'],
  AI: ['help/ai'],
  'Themes & Styling': ['help/theming', 'help/themes'],
  'Getting Started': ['getting-started/'],
}

/** Page vocabulary: path segments, H1, and H2 headings. */
export function pageProfile(path, text) {
  const h1 = /^#\s+(.+)$/m.exec(text)?.[1] ?? ''
  const h2 = [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]).join(' ')
  const slug = path.replace(/^docs\//, '').replace(/\.md$/, '')
  return {
    path,
    slug,
    // Path is weighted heaviest: a page's location is the most reliable
    // statement of what it is about.
    strong: new Set(tokens(slug.replace(/\//g, ' ')).concat(tokens(h1))),
    weak: new Set(tokens(h2)),
    embeds: (text.match(/data-docs-demo/g) ?? []).length,
  }
}

/**
 * Inverse document frequency over the demo registry.
 *
 * Without this, "headless" (23 demos), "server" and "chart" score as highly as
 * "otp" or "waterfall", and the matcher confidently proposes a number input for
 * the virtualization page because both say "headless". A token shared by a
 * quarter of the gallery carries almost no information about which demo belongs
 * where; a token used once carries almost all of it.
 */
export function buildIdf(registry) {
  const df = new Map()
  for (const d of registry) {
    for (const w of new Set(tokens(d.id).concat(tokens(d.title), tokens(d.description)))) {
      df.set(w, (df.get(w) ?? 0) + 1)
    }
  }
  const n = registry.length
  // Clamped to [0.15, 1] so a common word is discounted, never inverted, and a
  // unique word does not run away with the score.
  return (w) => {
    const seen = df.get(w) ?? 1
    return Math.min(1, Math.max(0.15, Math.log(n / seen) / Math.log(n / 2)))
  }
}

/** Default weighting, used when a caller does not supply a corpus-built one. */
let idf = () => 1
export function useIdf(fn) {
  idf = fn
}

export function scorePair(demo, page) {
  const dStrong = new Set(tokens(demo.id).concat(tokens(demo.title)))
  const dWeak = new Set(tokens(demo.description))

  let score = 0
  let bestToken = 0
  for (const w of dStrong) {
    const weight = idf(w)
    if (page.strong.has(w)) {
      score += 6 * weight
      bestToken = Math.max(bestToken, weight)
    } else if (page.weak.has(w)) {
      score += 3 * weight
      bestToken = Math.max(bestToken, weight)
    }
  }
  for (const w of dWeak) {
    if (page.strong.has(w)) score += 1 * idf(w)
  }
  // A match built only from filler words is not a match. Requiring one
  // reasonably distinctive shared token is what stops "both mention headless"
  // from being enough on its own.
  if (bestToken < 0.4) score -= 6

  const hints = CATEGORY_HINTS[demo.category] ?? []
  // A subtree hint is a strong prior but never sufficient on its own: it breaks
  // ties inside the right section rather than picking a page by itself.
  if (hints.some((h) => page.slug.startsWith(h))) score += 5
  // Spread the load. A page that already carries several examples is a worse
  // home than an equally-relevant page with none.
  score -= page.embeds * 1.5
  return score
}

export function propose(registry, docs, { min = 8 } = {}) {
  const pages = docs.map(([p, t]) => pageProfile(p, t))
  return registry.map((demo) => {
    const ranked = pages
      .map((page) => ({ page, score: scorePair(demo, page) }))
      .sort((a, b) => b.score - a.score)
    const best = ranked[0]
    return {
      demo,
      page: best && best.score >= min ? best.page.path : null,
      score: best?.score ?? 0,
      runnerUp: ranked[1] ? { path: ranked[1].page.path, score: ranked[1].score } : null,
    }
  })
}

if (process.argv[1]?.endsWith('demo-doc-match.mjs')) {
  const registry = loadRegistry()
  useIdf(buildIdf(registry))
  const docs = loadDocs()
  const { orphans } = coverage(registry, docs)
  const only = process.argv.includes('--orphans') ? orphans : registry
  const results = propose(only, docs)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results.map((r) => ({
      id: r.demo.id, title: r.demo.title, category: r.demo.category,
      page: r.page, score: Math.round(r.score),
    })), null, 2))
  } else {
    const matched = results.filter((r) => r.page)
    console.log(`${only.length} demos | matched ${matched.length} | unmatched ${only.length - matched.length}\n`)
    for (const r of results.sort((a, b) => b.score - a.score)) {
      console.log(
        `${String(Math.round(r.score)).padStart(3)}  ${r.demo.id.padEnd(34)} -> ${r.page ?? '(none)'}`,
      )
    }
  }
}
