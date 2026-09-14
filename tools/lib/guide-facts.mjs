/**
 * The generated facts block in a comparison guide.
 *
 * docs/help/comparison.md and the docs/help/migrating-from-*.md guides used
 * to type their numbers by hand, and the numbers disagreed with each other
 * and with the compare pages (three different AG Grid Community sizes, two
 * SvGrid sizes, a "SvGrid v1.0"). Each guide now carries one block between
 *
 *   <!-- facts:start <compare-slug>[,<compare-slug>] -->
 *   ...
 *   <!-- facts:end -->
 *
 * that tools/sync-guide-facts.mjs rewrites from docs/_data (the comparison
 * JSON, the registry ledger, SvGrid's measured size), and
 * tools/competitor-facts.test.ts fails when a block is stale or a number of
 * the same kinds appears anywhere else in the guide. comparison.md also
 * carries a `<!-- bench:start -->` block for the benchmark table.
 *
 * Dependency-free so the test, the sync script and the prerenderer share it.
 */
import { formatDate, formatDownloads, bundleText, licenseLabel, SVGRID_PRICING, SVGRID_SIZE_ENTRY } from './competitor-facts.mjs'

/** `<!-- facts:start <slug>[,<slug>] [pkg:<npm>[,<npm>]] -->`: the comparison
 *  slugs the block covers, plus registry packages to list that no comparison
 *  names (a maintained fork, an engine package). */
export const FACTS_START_RE = /<!-- facts:start(?:\s+([a-z0-9,-]+))?(?:\s+pkg:(\S+))? -->/
export const FACTS_END = '<!-- facts:end -->'
export const BENCH_START = '<!-- bench:start -->'
export const BENCH_END = '<!-- bench:end -->'

/** The comparison a migration guide belongs to, by its migration.slug. */
export function comparisonForGuide(fileSlug, comparisons) {
  return comparisons.find((c) => c.migration?.slug === fileSlug) ?? null
}

/** The package line for one registry entry: "`pkg` 1.2.3, MIT, last published 5 Aug 2026, 12,400,000 npm downloads in the 30 days to 10 Sep 2026". */
function packageLine(name, reg, { window = true } = {}) {
  const parts = [`\`${name}\` ${reg.version}`, licenseLabel(reg.license) || 'licence not declared']
  if (reg.lastPublished) parts.push(`last published ${formatDate(reg.lastPublished)}`)
  if (reg.downloadsWindow?.end) {
    parts.push(`${formatDownloads(reg.downloadsLastMonth)} npm downloads${window ? ` in the 30 days to ${formatDate(reg.downloadsWindow.end)}` : ' in the same window'}`)
  }
  return parts.join(', ')
}

/**
 * The facts block for a guide, markers included. `slugs` are comparison
 * slugs; the block lists each competitor's package, SvGrid's package, the
 * measured bundles where they exist, each competitor's pricing statement
 * and SvGrid's, and links the compare pages.
 *
 * @param {string[]} slugs
 * @param {{ comparisons: any[], ledger: import('./competitor-facts.mjs').Ledger, size: import('./competitor-facts.mjs').SvgridSize | null }} ctx
 * @param {string[]} [packages]  Extra npm packages to list from the ledger.
 * @returns {string}
 */
export function guideFactsBlock(slugs, { comparisons, ledger, size }, packages = []) {
  const cmps = slugs.map((s) => comparisons.find((c) => c.slug === s)).filter(Boolean)
  if (!cmps.length) throw new Error(`guideFactsBlock: no comparison for ${slugs.join(', ')}`)
  const own = ledger.registry['@svgrid/grid']
  const checked = [...cmps.map((c) => c.verified), own?.verified].filter((d) => d && !String(d).startsWith('1970')).sort().pop()
  const lines = []
  lines.push(`<!-- facts:start ${cmps.map((c) => c.slug).join(',')}${packages.length ? ` pkg:${packages.join(',')}` : ''} -->`)
  const sentences = []
  // The download window is spelled out once; later packages say "the same window".
  let first = true
  for (const c of cmps) {
    const reg = c.npm ? ledger.registry[c.npm] : null
    if (!reg) continue
    sentences.push(packageLine(c.npm, reg, { window: first }) + '.')
    first = false
  }
  for (const name of packages) {
    const reg = ledger.registry[name]
    if (!reg) throw new Error(`guideFactsBlock: ${name} is not in the ledger (pnpm competitors:verify)`)
    sentences.push(packageLine(name, reg, { window: first }) + '.')
    first = false
  }
  if (own) sentences.push(packageLine('@svgrid/grid', own, { window: first }) + '.')
  const ownSize = size?.entries?.[SVGRID_SIZE_ENTRY]
  const bundles = cmps
    .filter((c) => c.publishBundle && c.npm && ledger.bundles[c.npm] && ledger.registry[c.npm] && ledger.bundles[c.npm].version === ledger.registry[c.npm].version)
    .map((c) => {
      const b = ledger.bundles[c.npm]
      const ext = b.external.length ? `, ${b.external.join(' + ')} external` : ''
      return `\`${c.npm}\` ${b.version} ${bundleText(b.jsGzipKb, b.cssGzipKb)}${ext} (measured ${formatDate(b.measuredAt)})`
    })
  if (ownSize) {
    const parts = [`SvGrid ${size.version} ${bundleText(ownSize.baseGzipKb, ownSize.cssGzipKb)} (measured ${formatDate(size.measuredAt)})`, ...bundles]
    sentences.push(`Bundle, minified and gzipped, each package built alone with Svelte external: ${parts.join('; ')}.`)
  }
  for (const c of cmps) {
    if (c.pricing?.summary && c.pricing.verified && !String(c.pricing.verified).startsWith('1970')) {
      sentences.push(`${shortName(c)} pricing, as its site states it: ${c.pricing.summary.replace(/\.$/, '')} (${c.pricing.url}, read ${formatDate(c.pricing.verified)}).`)
    }
  }
  sentences.push(`SvGrid: ${SVGRID_PRICING.summary}.`)
  const links = cmps.map((c) => `[SvGrid vs ${c.competitor}](https://svgrid.com/compare/${c.slug}/)`)
  sentences.push(`Side by side, with sources: ${links.join(', ')}.`)
  lines.push(`> **Facts, checked ${checked ? formatDate(checked) : 'never'}.** ${sentences.join(' ')}`)
  lines.push(FACTS_END)
  return lines.join('\n')
}

function shortName(c) {
  return String(c.competitor).replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/**
 * Replace the facts block in a guide, or insert one after the intro when
 * the guide has none. Returns the new markdown and the slugs the block names.
 *
 * Insertion point: after the first blockquote that follows the H1 when there
 * is one (the "Estimated effort" note the guides open with), else after the
 * first paragraph.
 *
 * @param {string} markdown
 * @param {string} block
 */
export function syncGuideFacts(markdown, block) {
  const start = markdown.search(FACTS_START_RE)
  if (start !== -1) {
    const end = markdown.indexOf(FACTS_END, start)
    if (end === -1) throw new Error('facts:start without facts:end')
    return markdown.slice(0, start) + block + markdown.slice(end + FACTS_END.length)
  }
  const lines = markdown.split('\n')
  let i = lines.findIndex((l) => /^# /.test(l))
  if (i === -1) return block + '\n\n' + markdown
  i += 1
  // Skip blank lines, then the first paragraph or blockquote.
  while (i < lines.length && lines[i].trim() === '') i += 1
  while (i < lines.length && lines[i].trim() !== '') i += 1
  // A blockquote right after the intro belongs with it.
  let j = i
  while (j < lines.length && lines[j].trim() === '') j += 1
  if (j < lines.length && lines[j].startsWith('>')) {
    while (j < lines.length && lines[j].trim() !== '') j += 1
    i = j
  }
  lines.splice(i, 0, '', block)
  return lines.join('\n')
}

/** The slugs a guide's facts block names, or null when it has none. */
export function guideFactsSlugs(markdown) {
  const m = FACTS_START_RE.exec(markdown)
  if (!m) return null
  return (m[1] ?? '').split(',').filter(Boolean)
}

/** The extra npm packages a guide's facts block names (`pkg:`), or []. */
export function guideFactsPackages(markdown) {
  const m = FACTS_START_RE.exec(markdown)
  return m?.[2] ? m[2].split(',').filter(Boolean) : []
}

/**
 * The benchmark section body for comparison.md, markers included, from the
 * ledger's `benchmarks` block. Null when nothing was measured.
 * @param {import('./competitor-facts.mjs').Ledger} ledger
 */
export function benchmarkBlock(ledger) {
  const b = ledger.benchmarks
  if (!b || !b.grids?.length) return null
  const lines = [BENCH_START]
  const rig = [b.rig?.container, b.rig?.statistic, b.rig?.browser, b.rig?.machine].filter(Boolean).join('; ')
  lines.push(`Measured ${formatDate(b.measuredAt)} with \`pnpm bench:compare\` (tests/perf/compare.spec.ts, recorded by tools/record-benchmarks.mjs): ${Number(b.rows).toLocaleString('en-US')} rows x 9 columns${rig ? `; ${rig}` : ''}. Lower is better.`)
  lines.push('')
  lines.push(`| Operation | ${b.grids.map((g) => g.label).join(' | ')} |`)
  lines.push(`| --- | ${b.grids.map(() => '---').join(' | ')} |`)
  const CASES = [
    ['mount', 'Mount'],
    ['sortText', 'Sort, text column'],
    ['sortNumber', 'Sort, numeric column'],
    ['filter', 'Filter, one column (indicative only, see below)'],
    ['scrollP95', 'Scroll, p95 frame'],
  ]
  for (const [key, label] of CASES) {
    if (!b.grids.some((g) => Number.isFinite(g.results?.[key]))) continue
    lines.push(`| ${label} | ${b.grids.map((g) => (Number.isFinite(g.results?.[key]) ? `${g.results[key]} ms` : 'n/a')).join(' | ')} |`)
  }
  if (b.grids.some((g) => Number.isFinite(g.results?.scrollDropped))) {
    lines.push(`| Frames dropped while scrolling, of 180 | ${b.grids.map((g) => (Number.isFinite(g.results?.scrollDropped) ? String(g.results.scrollDropped) : 'n/a')).join(' | ')} |`)
  }
  if (b.grids.some((g) => Number.isFinite(g.results?.domRows))) {
    lines.push(`| Rows kept in the DOM (virtualization on) | ${b.grids.map((g) => (Number.isFinite(g.results?.domRows) ? String(g.results.domRows) : 'n/a')).join(' | ')} |`)
  }
  lines.push('')
  lines.push(`Versions: ${b.grids.map((g) => `\`${g.npm}\` ${g.version}`).join(', ')}.`)
  lines.push(BENCH_END)
  return lines.join('\n')
}

/** Replace the benchmark block in a guide; no block, no change. */
export function syncBenchmarkBlock(markdown, block) {
  const start = markdown.indexOf(BENCH_START)
  if (start === -1 || !block) return markdown
  const end = markdown.indexOf(BENCH_END, start)
  if (end === -1) throw new Error('bench:start without bench:end')
  return markdown.slice(0, start) + block + markdown.slice(end + BENCH_END.length)
}

/** A guide with its generated blocks removed, for the typed-number guard. */
export function stripGeneratedBlocks(markdown) {
  return markdown
    .replace(new RegExp(`${FACTS_START_RE.source}[\\s\\S]*?${FACTS_END.replace(/[-]/g, '\\-')}`, 'g'), '')
    .replace(new RegExp(`${BENCH_START.replace(/[-]/g, '\\-')}[\\s\\S]*?${BENCH_END.replace(/[-]/g, '\\-')}`, 'g'), '')
}
