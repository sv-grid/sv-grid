/**
 * A comparison page (/compare/<slug>/) as one model with three renderers.
 *
 * The page is read three ways: as static HTML by crawlers that never run
 * JavaScript (tools/prerender-site.mjs), as the hydrated DOM Google indexes
 * (website/src/components/CompareBody.svelte) and as markdown by models and
 * the MCP server (llms-full.txt, docs.json, @svgrid/mcp). Before this module
 * the first two were built by hand in different files with different
 * headings and section orders, and the third did not exist.
 *
 * `comparePageModel` joins the authored JSON (docs/_data/comparisons) with the
 * measured facts (tools/lib/competitor-facts.mjs) into plain values;
 * `renderCompareHtml` and `renderCompareMarkdown` draw it here and
 * CompareBody.svelte draws it in the browser. website/src/compare-page-parity.dom.test.ts
 * renders the static and hydrated versions from the same model and diffs them.
 *
 * Same pattern as tools/lib/demo-page.mjs.
 */
import { shortCompetitor, compareFaq } from './compare-meta.mjs'
import { factsForComparison, benchmarkForComparison, formatDate } from './competitor-facts.mjs'

/** Section order. Both renderers iterate this list, never their own. */
export const COMPARE_ORDER = Object.freeze([
  'verdict', 'facts', 'intro', 'alternative', 'common', 'svgridWins', 'competitorWins', 'features', 'benchmark',
  'chooseSvgrid', 'chooseCompetitor', 'migration', 'live', 'bottom', 'faq', 'related', 'sources',
])

/** Section headings, shared so the text is identical everywhere. */
export const COMPARE_HEADINGS = Object.freeze({
  verdict: 'Verdict',
  facts: 'At a glance',
  intro: 'Overview',
  /** @param {string} short */
  alternative: (short) => `Looking for a ${short} alternative for Svelte?`,
  common: 'What they have in common',
  svgridWins: 'Where SvGrid is stronger',
  /** @param {string} competitor */
  competitorWins: (competitor) => `Where ${competitor} is stronger`,
  features: 'Feature by feature',
  benchmark: 'Measured performance',
  chooseSvgrid: 'When to choose SvGrid',
  /** @param {string} competitor */
  chooseCompetitor: (competitor) => `When to choose ${competitor}`,
  migration: 'Migration effort',
  live: 'Live example',
  bottom: 'The bottom line',
  faq: 'Frequently asked questions',
  related: 'Related comparisons and docs',
  sources: 'Sources and last verified',
})

/** How a feature status reads in a cell. */
export const STATUS_LABEL = Object.freeze({
  yes: 'Yes',
  partial: 'Partial',
  paid: 'Paid tier',
  no: 'No',
  na: 'n/a',
})

export const FEATURE_LEGEND =
  'Yes: shipped in the package. Partial: needs extra work or a companion package. Paid tier: only in a paid edition. No: not available. n/a: does not apply.'

/** Facts table column headings. */
export const FACT_COLUMNS = Object.freeze({ fact: 'Fact', checked: 'Checked' })

const RANK = { yes: 3, partial: 2, paid: 1, no: 0 }

/**
 * Which side a feature row favours. `na` on either side means the row is
 * informational (a framework list, a price) and no side is marked.
 * @param {{ svgrid: { status: string }, competitor: { status: string } }} row
 * @returns {'svgrid' | 'competitor' | 'even'}
 */
export function betterSide(row) {
  const a = RANK[row.svgrid.status], b = RANK[row.competitor.status]
  if (a === undefined || b === undefined || a === b) return 'even'
  return a > b ? 'svgrid' : 'competitor'
}

/** Cell text: "Yes - Built in", "Paid tier - Set filter is Enterprise only". */
export function cellText(cell) {
  const label = STATUS_LABEL[cell.status] ?? cell.status
  return cell.note ? `${label} - ${cell.note}` : label
}

/** Heading id, the same shape website/src/lib/search/engine.ts derives for docs headings. */
export function headingId(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
}

/**
 * @typedef {{ slug: string, title: string }} Link
 * @typedef {{
 *   slug: string, competitor: string, short: string, npm: string, url: string, tagline: string,
 *   oneLineVerdict: string, published: string, verified: string,
 *   migration: { slug: string, effort: string, youLose: string[] } | null,
 *   facts: import('./competitor-facts.mjs').Facts,
 *   intro: string[], alternativeIntro: string, similarities: string[],
 *   svgridAdvantages: string[], competitorAdvantages: string[],
 *   features: Array<{ feature: string, svgrid: string, competitor: string, better: 'svgrid' | 'competitor' | 'even' }>,
 *   benchmark: import('./competitor-facts.mjs').BenchmarkFacts | null,
 *   whenToChooseSvGrid: string[], whenToChooseCompetitor: string[],
 *   live: { id: string, title: string } | null,
 *   bottomLine: string, faq: Array<{ question: string, answer: string }>,
 *   related: Link[], docs: Link[], posts: Link[],
 *   sources: Array<{ id: string, url: string, evidences: string, verified: string }>,
 * }} ComparePageModel
 */

/**
 * Build the page model. Every field is a plain value so the model can cross
 * the node / browser boundary and be compared in a test.
 *
 * @param {import('../../website/src/lib/comparisons').Comparison} cmp
 * @param {{
 *   ledger: import('./competitor-facts.mjs').Ledger,
 *   size: import('./competitor-facts.mjs').SvgridSize | null,
 *   demoTitle: (id: string) => string | null,
 *   docTitle: (slug: string) => string | null,
 *   postTitle?: (slug: string) => string | null,
 *   comparisons: Array<{ slug: string, competitor: string }>,
 * }} ctx
 * @returns {ComparePageModel}
 */
export function comparePageModel(cmp, { ledger, size, demoTitle, docTitle, postTitle = () => null, comparisons }) {
  const short = shortCompetitor(cmp.competitor)
  const liveId = (cmp.demos ?? []).find((id) => demoTitle(id))
  const links = (slugs, title) =>
    (slugs ?? []).map((slug) => ({ slug, title: title(slug) })).filter((l) => typeof l.title === 'string' && l.title !== '')
  return {
    slug: cmp.slug,
    competitor: cmp.competitor,
    short,
    npm: cmp.npm ?? '',
    url: cmp.url ?? '',
    tagline: cmp.tagline ?? '',
    oneLineVerdict: cmp.oneLineVerdict ?? '',
    published: cmp.published ?? '',
    verified: cmp.verified ?? '',
    migration: cmp.migration?.slug
      ? { slug: cmp.migration.slug, effort: cmp.migration.effort ?? '', youLose: cmp.migration.youLose ?? [] }
      : null,
    facts: factsForComparison(cmp, ledger, size),
    intro: cmp.intro ?? [],
    alternativeIntro: cmp.alternativeIntro ?? '',
    similarities: cmp.similarities ?? [],
    svgridAdvantages: cmp.svgridAdvantages ?? [],
    competitorAdvantages: cmp.competitorAdvantages ?? [],
    features: (cmp.features ?? []).map((r) => ({
      feature: r.feature,
      svgrid: cellText(r.svgrid),
      competitor: cellText(r.competitor),
      better: betterSide(r),
    })),
    benchmark: benchmarkForComparison(cmp, ledger),
    whenToChooseSvGrid: cmp.whenToChooseSvGrid ?? [],
    whenToChooseCompetitor: cmp.whenToChooseCompetitor ?? [],
    live: liveId ? { id: liveId, title: /** @type {string} */ (demoTitle(liveId)) } : null,
    bottomLine: cmp.bottomLine ?? '',
    faq: compareFaq(cmp),
    related: (cmp.related ?? [])
      .map((slug) => comparisons.find((c) => c.slug === slug))
      .filter(Boolean)
      .map((c) => ({ slug: c.slug, title: `SvGrid vs ${c.competitor}` })),
    docs: links(cmp.docs, docTitle),
    posts: links(cmp.posts, postTitle),
    sources: (cmp.sources ?? []).map((s) => ({ id: s.id, url: s.url, evidences: s.evidences, verified: s.verified })),
  }
}

/**
 * Which sections of a model have content, in render order.
 * @param {ComparePageModel} m
 * @returns {string[]}
 */
export function compareSections(m) {
  /** @type {Record<string, boolean>} */
  const present = {
    verdict: m.oneLineVerdict !== '',
    facts: m.facts.rows.length > 0,
    intro: m.intro.length > 0,
    alternative: m.alternativeIntro !== '',
    common: m.similarities.length > 0,
    svgridWins: m.svgridAdvantages.length > 0,
    competitorWins: m.competitorAdvantages.length > 0,
    features: m.features.length > 0,
    benchmark: m.benchmark !== null && m.benchmark.rows.length > 0,
    chooseSvgrid: m.whenToChooseSvGrid.length > 0,
    chooseCompetitor: m.whenToChooseCompetitor.length > 0,
    migration: m.migration !== null,
    live: m.live !== null,
    bottom: m.bottomLine !== '',
    faq: m.faq.length > 0,
    related: m.related.length + m.docs.length + m.posts.length > 0,
    sources: m.sources.length > 0 || m.verified !== '',
  }
  return COMPARE_ORDER.filter((k) => present[k])
}

/** The heading text for a section of a model. */
export function compareHeading(key, m) {
  const h = COMPARE_HEADINGS[key]
  if (typeof h === 'function') return key === 'alternative' ? h(m.short) : h(m.competitor)
  return h
}

/** The one line under the sources list. Empty when the page was never verified. */
export function verifiedLine(m) {
  if (!m.verified || m.verified.startsWith('1970')) return ''
  return `Every claim on this page was last checked on ${formatDate(m.verified)}. Versions, licences and download counts come from the npm registry; feature and pricing statements from the pages listed below.`
}

/** Migration section lines, shared by the renderers. */
export function migrationLines(m) {
  if (!m.migration) return { effort: '', guide: '' }
  return {
    effort: m.migration.effort ? `Estimated effort: ${m.migration.effort}.` : '',
    guide: `Migration guide: moving from ${m.competitor} to SvGrid`,
  }
}

/** What the live section says. */
export function liveLine(m) {
  return m.live ? `${m.live.title}: open it in the gallery for the source and the full-size version.` : ''
}

/** A source list entry. */
export function sourceLine(s) {
  return `${s.evidences} (checked ${formatDate(s.verified)})`
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Static HTML for the sections, for the prerendered page.
 *
 * @param {ComparePageModel} m
 * @param {{ href: (kind: 'docs' | 'demos' | 'compare' | 'blog', slug: string) => string, escape?: (s: string) => string }} opts
 */
export function renderCompareHtml(m, { href, escape = escapeHtml }) {
  if (typeof href !== 'function') throw new Error('renderCompareHtml: href(kind, slug) is required')
  const h2 = (key) => {
    const text = compareHeading(key, m)
    return `<h2 id="${escape(headingId(text))}">${escape(text)}</h2>`
  }
  const ul = (items) => `<ul>${items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>`
  let html = ''
  for (const key of compareSections(m)) {
    if (key === 'verdict') {
      html += `<section>${h2(key)}<p>${escape(m.oneLineVerdict)}</p>`
      if (m.migration) html += `<p><a href="${escape(href('docs', `help/${m.migration.slug}`))}">${escape(migrationLines(m).guide)}</a></p>`
      html += `</section>`
    } else if (key === 'facts') {
      html += `<section>${h2(key)}<table><thead><tr><th scope="col">${escape(FACT_COLUMNS.fact)}</th><th scope="col">SvGrid</th><th scope="col">${escape(m.competitor)}</th><th scope="col">${escape(FACT_COLUMNS.checked)}</th></tr></thead><tbody>`
      for (const r of m.facts.rows) {
        html += `<tr><th scope="row">${escape(r.label)}</th><td>${escape(r.svgrid)}</td><td>${escape(r.competitor)}</td><td>${escape(formatDate(r.checked))}</td></tr>`
      }
      html += `</tbody></table>`
      for (const f of m.facts.footnotes) html += `<p>${escape(f)}</p>`
      html += `</section>`
    } else if (key === 'intro') {
      html += `<section>${h2(key)}${m.intro.map((p) => `<p>${escape(p)}</p>`).join('')}</section>`
    } else if (key === 'alternative') {
      html += `<section>${h2(key)}<p>${escape(m.alternativeIntro)}</p></section>`
    } else if (key === 'common') {
      html += `<section>${h2(key)}${ul(m.similarities)}</section>`
    } else if (key === 'svgridWins') {
      html += `<section>${h2(key)}${ul(m.svgridAdvantages)}</section>`
    } else if (key === 'competitorWins') {
      html += `<section>${h2(key)}${ul(m.competitorAdvantages)}</section>`
    } else if (key === 'features') {
      html += `<section>${h2(key)}<p>${escape(FEATURE_LEGEND)}</p>`
      html += `<table><thead><tr><th scope="col">Feature</th><th scope="col">SvGrid</th><th scope="col">${escape(m.competitor)}</th></tr></thead><tbody>`
      for (const r of m.features) {
        const cls = (side) => (r.better === side ? ' class="better"' : '')
        html += `<tr><th scope="row">${escape(r.feature)}</th><td${cls('svgrid')}>${escape(r.svgrid)}</td><td${cls('competitor')}>${escape(r.competitor)}</td></tr>`
      }
      html += `</tbody></table></section>`
    } else if (key === 'benchmark' && m.benchmark) {
      html += `<section>${h2(key)}<p>${escape(m.benchmark.intro)}</p>`
      html += `<table><thead><tr><th scope="col">Operation</th><th scope="col">SvGrid</th><th scope="col">${escape(m.competitor)}</th></tr></thead><tbody>`
      for (const r of m.benchmark.rows) html += `<tr><th scope="row">${escape(r.label)}</th><td>${escape(r.svgrid)}</td><td>${escape(r.competitor)}</td></tr>`
      html += `</tbody></table>`
      for (const n of m.benchmark.notes) html += `<p>${escape(n)}</p>`
      html += `</section>`
    } else if (key === 'chooseSvgrid') {
      html += `<section>${h2(key)}${ul(m.whenToChooseSvGrid)}</section>`
    } else if (key === 'chooseCompetitor') {
      html += `<section>${h2(key)}${ul(m.whenToChooseCompetitor)}</section>`
    } else if (key === 'migration' && m.migration) {
      const lines = migrationLines(m)
      html += `<section>${h2(key)}`
      if (lines.effort) html += `<p>${escape(lines.effort)}</p>`
      if (m.migration.youLose.length) html += `<p>What you give up:</p>${ul(m.migration.youLose)}`
      html += `<p><a href="${escape(href('docs', `help/${m.migration.slug}`))}">${escape(lines.guide)}</a></p></section>`
    } else if (key === 'live' && m.live) {
      html += `<section>${h2(key)}<p><a href="${escape(href('demos', m.live.id))}">${escape(liveLine(m))}</a></p></section>`
    } else if (key === 'bottom') {
      html += `<section>${h2(key)}<p>${escape(m.bottomLine)}</p></section>`
    } else if (key === 'faq') {
      html += `<section>${h2(key)}${m.faq.map((f) => `<h3>${escape(f.question)}</h3><p>${escape(f.answer)}</p>`).join('')}</section>`
    } else if (key === 'related') {
      html += `<section>${h2(key)}<ul>`
      for (const r of m.related) html += `<li><a href="${escape(href('compare', r.slug))}">${escape(r.title)}</a></li>`
      for (const d of m.docs) html += `<li><a href="${escape(href('docs', d.slug))}">${escape(d.title)}</a></li>`
      for (const p of m.posts) html += `<li><a href="${escape(href('blog', p.slug))}">${escape(p.title)}</a></li>`
      html += `</ul></section>`
    } else if (key === 'sources') {
      html += `<section>${h2(key)}`
      const line = verifiedLine(m)
      if (line) html += `<p>${escape(line)}</p>`
      if (m.sources.length) {
        html += `<ul>${m.sources.map((s) => `<li><a href="${escape(s.url)}" rel="nofollow noopener">${escape(s.id)}</a>: ${escape(sourceLine(s))}</li>`).join('')}</ul>`
      }
      html += `</section>`
    }
  }
  return html
}

/** Markdown table cell: pipes escaped, newlines collapsed. */
function mdCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

/**
 * Markdown for the corpus (llms-full.txt, docs.json, the MCP server). Says
 * what the page says, in the same order, with the canonical URL up top so a
 * model can cite it.
 *
 * @param {ComparePageModel} m
 * @param {{ site: string }} opts
 */
export function renderCompareMarkdown(m, { site }) {
  const canon = `${site}/compare/${m.slug}/`
  const out = []
  out.push(`# SvGrid vs ${m.competitor}`)
  out.push('')
  out.push(`Canonical URL: ${canon}`)
  if (m.verified && !m.verified.startsWith('1970')) out.push(`Facts verified: ${m.verified}`)
  if (m.npm) out.push(`Competitor package: ${m.npm}`)
  if (m.url) out.push(`Competitor site: ${m.url}`)
  out.push('')
  if (m.tagline) { out.push(m.tagline); out.push('') }
  const h2 = (key) => { out.push(`## ${compareHeading(key, m)}`); out.push('') }
  const ul = (items) => { for (const i of items) out.push(`- ${i}`); out.push('') }
  for (const key of compareSections(m)) {
    if (key === 'verdict') {
      h2(key)
      out.push(m.oneLineVerdict)
      out.push('')
      if (m.migration) { out.push(`${migrationLines(m).guide}: ${site}/docs/help/${m.migration.slug}/`); out.push('') }
    } else if (key === 'facts') {
      h2(key)
      out.push(`| ${FACT_COLUMNS.fact} | SvGrid | ${mdCell(m.competitor)} | ${FACT_COLUMNS.checked} |`)
      out.push('| --- | --- | --- | --- |')
      for (const r of m.facts.rows) out.push(`| ${mdCell(r.label)} | ${mdCell(r.svgrid)} | ${mdCell(r.competitor)} | ${formatDate(r.checked)} |`)
      out.push('')
      for (const f of m.facts.footnotes) { out.push(f); out.push('') }
    } else if (key === 'intro') {
      h2(key)
      for (const p of m.intro) { out.push(p); out.push('') }
    } else if (key === 'alternative') {
      h2(key); out.push(m.alternativeIntro); out.push('')
    } else if (key === 'common') {
      h2(key); ul(m.similarities)
    } else if (key === 'svgridWins') {
      h2(key); ul(m.svgridAdvantages)
    } else if (key === 'competitorWins') {
      h2(key); ul(m.competitorAdvantages)
    } else if (key === 'features') {
      h2(key)
      out.push(FEATURE_LEGEND)
      out.push('')
      out.push(`| Feature | SvGrid | ${mdCell(m.competitor)} |`)
      out.push('| --- | --- | --- |')
      for (const r of m.features) out.push(`| ${mdCell(r.feature)} | ${mdCell(r.svgrid)} | ${mdCell(r.competitor)} |`)
      out.push('')
    } else if (key === 'benchmark' && m.benchmark) {
      h2(key)
      out.push(m.benchmark.intro)
      out.push('')
      out.push(`| Operation | SvGrid | ${mdCell(m.competitor)} |`)
      out.push('| --- | --- | --- |')
      for (const r of m.benchmark.rows) out.push(`| ${mdCell(r.label)} | ${mdCell(r.svgrid)} | ${mdCell(r.competitor)} |`)
      out.push('')
      for (const n of m.benchmark.notes) { out.push(n); out.push('') }
    } else if (key === 'chooseSvgrid') {
      h2(key); ul(m.whenToChooseSvGrid)
    } else if (key === 'chooseCompetitor') {
      h2(key); ul(m.whenToChooseCompetitor)
    } else if (key === 'migration' && m.migration) {
      h2(key)
      const lines = migrationLines(m)
      if (lines.effort) { out.push(lines.effort); out.push('') }
      if (m.migration.youLose.length) { out.push('What you give up:'); out.push(''); ul(m.migration.youLose) }
      out.push(`${lines.guide}: ${site}/docs/help/${m.migration.slug}/`)
      out.push('')
    } else if (key === 'live' && m.live) {
      h2(key); out.push(`${liveLine(m)} ${site}/demos/${m.live.id}/`); out.push('')
    } else if (key === 'bottom') {
      h2(key); out.push(m.bottomLine); out.push('')
    } else if (key === 'faq') {
      h2(key)
      for (const f of m.faq) { out.push(`### ${f.question}`); out.push(''); out.push(f.answer); out.push('') }
    } else if (key === 'related') {
      h2(key)
      for (const r of m.related) out.push(`- [${r.title}](${site}/compare/${r.slug}/)`)
      for (const d of m.docs) out.push(`- [${d.title}](${site}/docs/${d.slug}/)`)
      for (const p of m.posts) out.push(`- [${p.title}](${site}/blog/${p.slug}/)`)
      out.push('')
    } else if (key === 'sources') {
      h2(key)
      const line = verifiedLine(m)
      if (line) { out.push(line); out.push('') }
      for (const s of m.sources) out.push(`- ${s.id}: ${sourceLine(s)} ${s.url}`)
      if (m.sources.length) out.push('')
    }
  }
  return out.join('\n').trim() + '\n'
}

// ---- Hub ------------------------------------------------------------------

/** Hub groups, in display order. The grouping is by the reader's stack. */
export const COMPARE_GROUPS = Object.freeze([
  { id: 'svelte-native', title: 'Built for Svelte', blurb: 'Grids and tables written for Svelte. These are the closest calls, so they get the deepest pages.' },
  { id: 'headless', title: 'Headless engines', blurb: 'Bring-your-own-markup libraries with a Svelte adapter. SvGrid has the same kind of core underneath its component.' },
  { id: 'commercial', title: 'Commercial grids from other ecosystems', blurb: 'Vendor grids built for React, Angular, Vue or plain JavaScript and used in Svelte through a wrapper.' },
  { id: 'oss', title: 'Open-source grids from other ecosystems', blurb: 'Free grids built for another framework or for plain JavaScript.' },
])

/**
 * The one-line facts under a hub card, from the ledger only.
 * @param {{ npm?: string, verified?: string }} cmp
 * @param {import('./competitor-facts.mjs').Ledger} ledger
 */
export function hubFactsLine(cmp, ledger) {
  const reg = cmp.npm ? ledger.registry[cmp.npm] : undefined
  if (!reg) return ''
  const parts = [`${cmp.npm} ${reg.version}`]
  if (reg.license) parts.push(reg.license.length > 24 ? 'commercial licence' : reg.license)
  if (reg.downloadsLastMonth) parts.push(`${formatDownloadsShort(reg.downloadsLastMonth)} npm downloads a month`)
  return `${parts.join(', ')} (checked ${formatDate(reg.verified)})`
}

function formatDownloadsShort(n) {
  const v = Number(n)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`
  return String(Math.round(v))
}

/**
 * @typedef {{ groups: Array<{ id: string, title: string, blurb: string, items: Array<{ slug: string, competitor: string, tagline: string, facts: string }> }> }} CompareHubModel
 */

/**
 * @param {Array<import('../../website/src/lib/comparisons').Comparison>} comparisons
 * @param {{ ledger: import('./competitor-facts.mjs').Ledger }} ctx
 * @returns {CompareHubModel}
 */
export function compareHubModel(comparisons, { ledger }) {
  const tierRank = (c) => (c.tier === 'priority' ? 0 : 1)
  const groups = COMPARE_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    blurb: g.blurb,
    items: comparisons
      .filter((c) => c.group === g.id)
      .sort((a, b) => tierRank(a) - tierRank(b) || a.competitor.localeCompare(b.competitor))
      .map((c) => ({ slug: c.slug, competitor: c.competitor, tagline: c.tagline, facts: hubFactsLine(c, ledger) })),
  })).filter((g) => g.items.length > 0)
  return { groups }
}

/**
 * Static HTML for the hub's groups: one section per group, one list item per
 * comparison, the same text CompareHub in Compare.svelte draws.
 * @param {CompareHubModel} hub
 * @param {{ href: (kind: 'compare', slug: string) => string, escape?: (s: string) => string }} opts
 */
export function renderCompareHubHtml(hub, { href, escape = escapeHtml }) {
  let html = ''
  for (const g of hub.groups) {
    html += `<section><h2 id="${escape(headingId(g.title))}">${escape(g.title)}</h2><p>${escape(g.blurb)}</p><ul>`
    for (const c of g.items) {
      // The spaces between the siblings match the whitespace Svelte keeps
      // between them in CompareHub.svelte, so the two list items read alike.
      html += `<li><a href="${escape(href('compare', c.slug))}">SvGrid vs ${escape(c.competitor)}</a> <p>${escape(c.tagline)}</p>`
      if (c.facts) html += ` <p>${escape(c.facts)}</p>`
      html += `</li>`
    }
    html += `</ul></section>`
  }
  return html
}
