/**
 * demo-doc-suggest - page-first counterpart to demo-doc-match.
 *
 * For every doc page that could carry examples, rank the demo gallery by
 * relevance and propose the top few. Written for the second pass: the first
 * pass gave every demo a home, this one gives every PAGE an example, which is
 * the half a reader actually feels (a concept page with no runnable example is
 * where they leave to go hunting in the gallery).
 *
 *   node tools/demo-doc-suggest.mjs --per 3 --min 12          # review
 *   node tools/demo-doc-suggest.mjs --per 3 --min 12 --json   # feed the embedder
 */
import { loadRegistry, loadDocs } from './demo-doc-coverage.mjs'
import { pageProfile, scorePair, buildIdf, useIdf } from './demo-doc-match.mjs'

/**
 * Pages where an interactive grid is never the right thing: generated API
 * reference (rewritten by build-reference.mjs, so an edit here is lost),
 * legal/compliance text, brand assets, and the changelog.
 */
const EXCLUDE = [
  /^docs\/reference\/auto\//,
  /^docs\/reference\//,
  /^docs\/compliance\//,
  /^docs\/legal\//,
  /^docs\/brand\//,
  /^docs\/changelog\.md$/,
  // Studio documents a separate product (the app builder); the grid gallery
  // is not its example set.
  /^docs\/enterprise\/studio\//,
]

export const isEmbeddable = (path) => !EXCLUDE.some((re) => re.test(path))

/**
 * Doc subtree a demo category belongs to. Used only to qualify borderline
 * scores, so it is deliberately coarse - it answers "could this demo plausibly
 * live on this part of the site", not "is this the best page".
 */
const SECTION = {
  // Not help/headless/* - that subtree is the grid's headless CORE (row models,
  // virtualization), a different sense of the word from a headless editor.
  'Headless Editors': [/^docs\/help\/ui-components\//],
  Inputs: [/^docs\/help\/ui-components\//],
  'Buttons & Toggles': [/^docs\/help\/ui-components\//],
  'Range & Feedback': [/^docs\/help\/ui-components\//],
  Selection: [/^docs\/help\/ui-components\//],
  Layout: [/^docs\/help\/ui-components\//],
  Blocks: [/^docs\/help\/ui-components\//],
  Charts: [/^docs\/help\/charts/, /^docs\/help\/cells\/sparklines/, /^docs\/help\/ui-components\/sv-(grid-chart|sparkline|gauge)/],
  Kanban: [/^docs\/help\/rows\//],
  Scheduler: [/^docs\/help\/(rows\/scheduler|scheduling)/],
  'Pivot Grid': [/^docs\/help\/(pivot|grouping)/],
  'Data Export & Import': [/^docs\/help\/(export|import)/, /^docs\/recipes\//],
  Spreadsheet: [/^docs\/help\/spreadsheet/, /^docs\/recipes\//],
  'Server-Side Data': [/^docs\/help\/(server|headless)\//, /^docs\/help\/server-side-data/],
  'Filtering & Search': [/^docs\/help\/filtering\//],
  'Sorting & Grouping': [/^docs\/help\/(grouping|rows\/row-sorting)/],
  Columns: [/^docs\/help\/columns\//],
  Editing: [/^docs\/help\/editing\//],
  'Rows & Cells': [/^docs\/help\/(rows|cells)\//],
  'Selection & Clipboard': [/^docs\/help\/(cells|rows)\//],
  'Tree & Hierarchy': [/^docs\/help\/rows\//],
  'Real-time & Streaming': [/^docs\/help\/(real-time|rows)\//],
  Alerts: [/^docs\/help\/alerts/],
  AI: [/^docs\/help\/ai/],
  'Keyboard & Accessibility': [/^docs\/help\/accessibility/],
  'Themes & Styling': [/^docs\/help\/(tokens|tailwind|shadcn)/],
  'Industry Templates': [/^docs\/recipes\//],
  Recipes: [/^docs\/recipes\//],
  Integrations: [/^docs\/help\/(migrating|web-components|i18n)/, /^docs\/recipes\//],
  'Getting Started': [/^docs\/getting-started/],
}

const inSection = (demo, page) => (SECTION[demo.category] ?? []).some((re) => re.test(page.path))

/**
 * `sv-otp-input.md` is about SvOtpInput and nothing else. Being in the right
 * section is not enough for those pages - without this, all 98 component pages
 * fill up with adjacent-component demos, which is noise dressed as coverage.
 * A borderline pick must actually name the component.
 */
function componentMatches(demo, page) {
  const m = /^docs\/help\/ui-components\/sv-([a-z0-9-]+)\.md$/.exec(page.path)
  if (!m) return true
  const bare = m[1].replace(/-/g, '')
  const hay = `${demo.id} ${demo.title}`.toLowerCase().replace(/[^a-z0-9]/g, '')
  return hay.includes(bare)
}

export function suggest({ per = 3, min = 12, confident = 10 } = {}) {
  const registry = loadRegistry()
  // Weight tokens by how rare they are across the gallery before scoring.
  useIdf(buildIdf(registry))
  const docs = loadDocs().filter(([p]) => isEmbeddable(p))

  const out = []
  for (const [path, text] of docs) {
    const page = pageProfile(path, text)
    const have = (text.match(/data-docs-demo/g) ?? []).length
    const want = per - have
    if (want <= 0) continue

    const picks = registry
      // Never propose a demo the page already mentions in any form.
      .filter((d) => !text.includes(d.id))
      .map((d) => ({ demo: d, score: scorePair(d, page) }))
      .sort((a, b) => b.score - a.score)
      // Two bands. A high score stands on its own. A borderline one also has to
      // sit in the right part of the tree - that is what separates
      // "03-excel-filters on the floating-filters page" (good, scores 7) from
      // "19-ssr on the advanced-filter page" (noise, also scores 7).
      .filter(
        (r) =>
          r.score >= confident ||
          (r.score >= min && inSection(r.demo, page) && componentMatches(r.demo, page)),
      )
      .slice(0, want)

    if (picks.length) out.push({ path, have, picks })
  }
  return out
}

if (process.argv[1]?.endsWith('demo-doc-suggest.mjs')) {
  const arg = (n, d) => {
    const i = process.argv.indexOf(`--${n}`)
    return i === -1 ? d : Number(process.argv[i + 1])
  }
  const results = suggest({ per: arg('per', 3), min: arg('min', 12), confident: arg('confident', 10) })
  const total = results.reduce((n, r) => n + r.picks.length, 0)

  if (process.argv.includes('--json')) {
    const map = {}
    for (const r of results) map[r.path] = r.picks.map((p) => p.demo.id)
    console.log(JSON.stringify(map, null, 2))
  } else {
    for (const r of results) {
      console.log(`${r.path}  (has ${r.have})`)
      for (const p of r.picks) {
        console.log(`   ${String(Math.round(p.score)).padStart(3)}  ${p.demo.id}`)
      }
    }
    console.log(`\n${total} suggestions across ${results.length} pages`)
  }
}
