/**
 * The numbers a comparison page may state, and where each one comes from.
 *
 * Nothing on /compare/<slug>/ or in the comparison guides is allowed to type
 * a version, a download count or a bundle size by hand: those drifted apart
 * across the site (three different AG Grid Community sizes, a "SvGrid v1.0")
 * because nobody could tell a measured number from a remembered one. Every
 * number now comes from docs/_data/competitors.json (written by
 * tools/verify-competitors.mjs and packages/grid/scripts/measure-competitor-bundles.mjs) or
 * docs/_data/svgrid-size.json (written by measure-size.mjs --json), each
 * carrying the date it was read, and `factTokens` lists every string those
 * numbers can render as so tools/competitor-facts.test.ts can prove a page
 * states nothing else.
 *
 * Dependency-free: Vite bundles this into the site as well.
 */

/**
 * @typedef {{
 *   version: string, license: string, lastPublished: string, peerSvelte: string | null,
 *   downloadsLastMonth: number, downloadsWindow: { start: string, end: string },
 *   verified: string, sources: string[]
 * }} RegistryFact
 * @typedef {{
 *   version: string, jsGzipKb: number, cssGzipKb: number, minKb: number, lazyGzipKb: number,
 *   entry: string, external: string[], measuredAt: string
 * }} BundleFact
 * @typedef {{ registry: Record<string, RegistryFact>, bundles: Record<string, BundleFact>, benchmarks: BenchmarkLedger | null }} Ledger
 * @typedef {{ rig: Record<string, string>, measuredAt: string, rows: number, cases: string[], grids: Array<{ id: string, label: string, npm: string, version: string, results: Record<string, number> }> }} BenchmarkLedger
 * @typedef {{ measuredAt: string, version: string, entries: Record<string, { baseGzipKb: number, cssGzipKb: number, lazyGzipKb: number }> }} SvgridSize
 */

/** SvGrid's own prices, mirrored by website/src/routes/Pricing.svelte and seo.ts.
 *  Both editions cover unlimited apps; the line between them is the feature
 *  set. `grid` is the enterprise grid, `suite` adds the spreadsheet and Studio. */
export const SVGRID_PRICING = Object.freeze({
  grid: 599,
  suite: 999,
  unit: 'per developer per year',
  url: 'https://svgrid.com/pricing/',
  summary: 'MIT core; @svgrid/enterprise from $599 per developer per year',
})

/** Framework ids in the comparison JSON, as they read on the page. */
const FRAMEWORK_LABELS = {
  javascript: 'JavaScript', react: 'React', angular: 'Angular', vue: 'Vue', svelte: 'Svelte', solid: 'Solid',
  qwik: 'Qwik', lit: 'Lit', jquery: 'jQuery', blazor: 'Blazor', 'web components': 'Web Components',
}

/** ['javascript', 'react'] -> 'JavaScript, React'. */
export function frameworkList(framework) {
  return (framework ?? []).map((f) => FRAMEWORK_LABELS[f] ?? f).join(', ')
}

/** The entry of svgrid-size.json that stands for "the grid" on a comparison page. */
export const SVGRID_SIZE_ENTRY = 'full'

/** 'MIT' stays 'MIT'; 'SEE LICENSE IN LICENSE.txt' becomes 'Commercial (see licence file)'. */
export function licenseLabel(license) {
  const s = String(license ?? '').trim()
  if (!s) return ''
  if (/^SEE LICEN[CS]E/i.test(s)) return 'Commercial (see licence file)'
  if (/^\(?(.+)\)?$/.test(s) && s.includes(' OR ')) return s.replace(/^\(|\)$/g, '').replace(/ OR /g, ' or ')
  return s
}

/** "84.4 KB JS + 9.5 KB CSS", or "317.5 KB JS, no separate stylesheet" for a
 *  package whose styles ship inside the script (AG Grid's theming API) or
 *  that has none (a headless engine). */
export function bundleText(jsKb, cssKb) {
  return `${formatKb(jsKb)} JS${Number(cssKb) > 0 ? ` + ${formatKb(cssKb)} CSS` : ', no separate stylesheet'}`
}

/** 77.9 -> "77.9 KB"; 0 -> "0 KB". One decimal, like measure-size.mjs prints. */
export function formatKb(kb) {
  const n = Number(kb)
  if (!Number.isFinite(n)) return ''
  return `${n.toFixed(1)} KB`
}

/**
 * Downloads rounded to three significant figures with thousands separators:
 * 16,912 -> "16,900", 1,234,567 -> "1,230,000". The third figure is what the
 * registry API reports today; anything finer reads as precision it never had.
 */
export function formatDownloads(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return ''
  if (v < 1000) return String(Math.round(v))
  const digits = Math.floor(Math.log10(v)) + 1
  const factor = 10 ** (digits - 3)
  const rounded = Math.round(v / factor) * factor
  return rounded.toLocaleString('en-US')
}

/** "2026-09-12" -> "12 Sep 2026". Dates stay ISO in the data; this is the page
 *  form. The 1970 placeholder a fresh entry carries until it is verified
 *  renders as nothing rather than as a date nobody checked anything on. */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m || Number(m[1]) < 2000) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`
}

/** Days between two ISO dates (b - a). */
export function daysBetween(a, b) {
  const da = Date.parse(String(a)), db = Date.parse(String(b))
  if (!Number.isFinite(da) || !Number.isFinite(db)) return NaN
  return Math.round((db - da) / 86_400_000)
}

/**
 * What the registry says about Svelte support, in page words. Derived from
 * the peer range so it cannot contradict the package.
 * @param {RegistryFact | undefined} reg
 * @param {string[]} framework
 */
export function svelteSupportLabel(reg, framework) {
  if (reg?.peerSvelte) {
    const covers5 = /(\^|>=|~)?\s*5|\|\|\s*\^?5|\b5\.\d/.test(reg.peerSvelte)
    return `${covers5 ? 'Yes' : 'Svelte 4 range'} (peer svelte ${reg.peerSvelte})`
  }
  if (framework.includes('svelte')) return 'Svelte package, no peer range declared'
  if (framework.includes('web components')) return 'Custom element, works in Svelte with a wrapper'
  return `No Svelte package (${frameworkList(framework)})`
}

/**
 * @typedef {{ label: string, svgrid: string, competitor: string, checked: string }} FactRow
 * @typedef {{ rows: FactRow[], footnotes: string[], verified: string }} Facts
 */

/**
 * The "At a glance" rows for one comparison, only those with data behind
 * them. A competitor with no npm package (a UI kit's table) gets the rows
 * that do not need one.
 *
 * @param {import('../../website/src/lib/comparisons').Comparison} cmp
 * @param {Ledger} ledger
 * @param {SvgridSize | null} size
 * @returns {Facts}
 */
export function factsForComparison(cmp, ledger, size) {
  const own = ledger.registry['@svgrid/grid']
  const reg = cmp.npm ? ledger.registry[cmp.npm] : undefined
  /** @type {FactRow[]} */
  const rows = []
  const footnotes = []
  const both = (a, b) => a && b
  if (both(own?.version, reg?.version)) {
    rows.push({ label: 'Latest version', svgrid: own.version, competitor: reg.version, checked: reg.verified })
  }
  if (both(own?.license, reg?.license)) {
    rows.push({ label: 'Licence field on npm', svgrid: licenseLabel(own.license), competitor: licenseLabel(reg.license), checked: reg.verified })
  }
  if (both(own?.lastPublished, reg?.lastPublished)) {
    rows.push({ label: 'Last published', svgrid: formatDate(own.lastPublished), competitor: formatDate(reg.lastPublished), checked: reg.verified })
  }
  if (reg) {
    rows.push({ label: 'Svelte 5 support', svgrid: 'Native (Svelte 5 runes)', competitor: svelteSupportLabel(reg, cmp.framework), checked: reg.verified })
  }
  if (both(own?.downloadsWindow, reg?.downloadsWindow)) {
    rows.push({
      label: `npm downloads, 30 days to ${formatDate(reg.downloadsWindow.end)}`,
      svgrid: formatDownloads(own.downloadsLastMonth),
      competitor: formatDownloads(reg.downloadsLastMonth),
      checked: reg.verified,
    })
  }
  const bundle = cmp.publishBundle && cmp.npm ? ledger.bundles[cmp.npm] : undefined
  const ownSize = size?.entries?.[SVGRID_SIZE_ENTRY]
  if (bundle && ownSize && reg && bundle.version === reg.version) {
    const ext = bundle.external.length ? `, ${bundle.external.join(' + ')} external` : ''
    rows.push({
      label: 'Bundle, minified + gzip',
      svgrid: bundleText(ownSize.baseGzipKb, ownSize.cssGzipKb),
      competitor: `${bundleText(bundle.jsGzipKb, bundle.cssGzipKb)}${ext}`,
      checked: bundle.measuredAt,
    })
    footnotes.push(
      `Bundle sizes: each package built alone with Vite in library mode, minified, gzip level 9, Svelte kept external where a package uses it (it is a peer dependency). ` +
        `SvGrid ${size.version} measured ${formatDate(size.measuredAt)} with packages/grid/scripts/measure-size.mjs; ` +
        `${cmp.npm} ${bundle.version} entry \`${bundle.entry}\` measured ${formatDate(bundle.measuredAt)} with packages/grid/scripts/measure-competitor-bundles.mjs.`,
    )
  }
  rows.push({ label: 'Frameworks', svgrid: 'Svelte 5', competitor: frameworkList(cmp.framework), checked: cmp.verified })
  if (cmp.pricing?.summary) {
    rows.push({ label: 'Pricing', svgrid: SVGRID_PRICING.summary, competitor: cmp.pricing.summary, checked: cmp.pricing.verified })
  }
  return { rows, footnotes, verified: cmp.verified }
}

/** The benchmark operations a comparison page shows, in order. */
export const BENCHMARK_CASES = Object.freeze([
  ['mount', 'Mount'],
  ['sortText', 'Sort, text column'],
  ['sortNumber', 'Sort, numeric column'],
  ['filter', 'Filter, one column (indicative only)'],
  ['scrollP95', 'Scroll, p95 frame'],
])

/**
 * @typedef {{ measuredAt: string, intro: string, rows: Array<{ label: string, svgrid: string, competitor: string }>, notes: string[] }} BenchmarkFacts
 */

/**
 * The benchmark rows for one comparison, when the ledger measured both
 * SvGrid and the competitor in the same run; otherwise null.
 *
 * @param {{ npm?: string }} cmp
 * @param {Ledger} ledger
 * @returns {BenchmarkFacts | null}
 */
export function benchmarkForComparison(cmp, ledger) {
  const b = ledger.benchmarks
  if (!b || !Array.isArray(b.grids) || !cmp.npm) return null
  const own = b.grids.find((g) => g.npm === '@svgrid/grid')
  const theirs = b.grids.find((g) => g.npm === cmp.npm)
  if (!own || !theirs) return null
  const ms = (v) => (Number.isFinite(v) ? `${v} ms` : 'n/a')
  const rows = BENCHMARK_CASES
    .filter(([key]) => Number.isFinite(own.results?.[key]) || Number.isFinite(theirs.results?.[key]))
    .map(([key, label]) => ({ label, svgrid: ms(own.results?.[key]), competitor: ms(theirs.results?.[key]) }))
  if (Number.isFinite(own.results?.domRows) && Number.isFinite(theirs.results?.domRows)) {
    rows.push({ label: 'Rows kept in the DOM (virtualization on)', svgrid: String(own.results.domRows), competitor: String(theirs.results.domRows) })
  }
  const intro =
    `Measured ${formatDate(b.measuredAt)} with the harness in the repository (pnpm bench:compare): ` +
    `${Number(b.rows).toLocaleString('en-US')} rows, ${b.rig?.statistic ?? 'fastest sample per operation'}, ` +
    `${b.rig?.browser ?? 'Chromium'}, on ${b.rig?.machine ?? 'a developer workstation'}. ` +
    `Versions: @svgrid/grid ${own.version}, ${theirs.npm} ${theirs.version}. Lower is better.`
  const notes = [
    'The filter row is not like for like: each grid is driven through its own single-column filter API, and the amount of work differs. The comparison guide explains the method, what is left out and why.',
  ]
  if (theirs.label && /TanStack/.test(theirs.label)) {
    notes.push('TanStack Table renders nothing, so its adapter draws the row model through a minimal fixed-height windowed table with no virtualizer library, filter UI or editors; the numbers are the engine plus that DOM.')
  }
  return { measuredAt: b.measuredAt, intro, rows, notes }
}

/**
 * Every string the renderer may print for a number: versions, download
 * figures, sizes, prices and dates, from the ledger, the size file and the
 * SvGrid price list. A page that states a number outside this set typed it.
 *
 * @param {{ ledger: Ledger, size: SvgridSize | null }} input
 * @returns {Set<string>}
 */
export function factTokens({ ledger, size }) {
  const out = new Set()
  const add = (v) => { if (v !== undefined && v !== null && String(v) !== '') out.add(String(v)) }
  for (const reg of Object.values(ledger.registry)) {
    add(reg.version)
    add(formatDownloads(reg.downloadsLastMonth))
    add(String(reg.downloadsLastMonth))
    add(reg.lastPublished); add(formatDate(reg.lastPublished))
    add(reg.verified); add(formatDate(reg.verified))
    add(reg.downloadsWindow?.start); add(reg.downloadsWindow?.end)
    add(formatDate(reg.downloadsWindow?.start)); add(formatDate(reg.downloadsWindow?.end))
    add(reg.peerSvelte)
  }
  for (const b of Object.values(ledger.bundles)) {
    add(b.version)
    add(formatKb(b.jsGzipKb)); add(formatKb(b.cssGzipKb)); add(formatKb(b.minKb)); add(formatKb(b.lazyGzipKb))
    add(b.measuredAt); add(formatDate(b.measuredAt))
  }
  if (ledger.benchmarks) {
    add(ledger.benchmarks.measuredAt); add(formatDate(ledger.benchmarks.measuredAt))
    add(String(ledger.benchmarks.rows)); add(Number(ledger.benchmarks.rows).toLocaleString('en-US'))
    for (const g of ledger.benchmarks.grids ?? []) {
      add(g.version)
      for (const v of Object.values(g.results ?? {})) { add(String(v)); add(`${v} ms`) }
    }
    for (const v of Object.values(ledger.benchmarks.rig ?? {})) add(v)
  }
  if (size) {
    add(size.version); add(size.measuredAt); add(formatDate(size.measuredAt))
    for (const e of Object.values(size.entries ?? {})) {
      add(formatKb(e.baseGzipKb)); add(formatKb(e.cssGzipKb)); add(formatKb(e.lazyGzipKb))
    }
  }
  add(`$${SVGRID_PRICING.grid}`); add(`$${SVGRID_PRICING.suite}`)
  add(String(SVGRID_PRICING.grid)); add(String(SVGRID_PRICING.suite))
  return out
}
