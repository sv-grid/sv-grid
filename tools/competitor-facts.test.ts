/**
 * Every number on a comparison page or in a comparison guide is measured,
 * dated and rendered from docs/_data; none is typed. This pins that:
 *
 *   - docs/_data/comparisons/*.json validate: shape, status vocabulary, dates,
 *     sources referenced by feature cells exist, no dash glyphs.
 *   - The registry ledger covers every package a comparison names and is
 *     fresh (tools/verify-competitors.mjs); a comparison's own `verified`
 *     date is within a year (priority pages fail, standard pages warn until
 *     they are brought up to the same standard).
 *   - `publishBundle` pages have a bundle measured at the ledger's version.
 *   - Prose in the JSON states no size, price, download count, semver or
 *     demo count that the ledger does not render (tools/lib/competitor-facts.mjs
 *     factTokens), pricing statements excepted because they carry a date.
 *   - The guides' generated facts blocks are current (tools/sync-guide-facts.mjs)
 *     and no size, price, download count, "SvGrid vN" or benchmark timing is
 *     typed outside those blocks.
 *
 * Run: `pnpm vitest run tools/competitor-facts.test.ts`
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { loadComparisons, loadLedger, loadSvgridSize } from './lib/compare-data.mjs'
import { factTokens, daysBetween, SVGRID_PRICING } from './lib/competitor-facts.mjs'
import { guideFactsBlock, guideFactsSlugs, guideFactsPackages, syncGuideFacts, benchmarkBlock, syncBenchmarkBlock, stripGeneratedBlocks, comparisonForGuide } from './lib/guide-facts.mjs'
import type { Comparison } from '../website/src/lib/comparisons'

const ROOT = process.cwd()
const HELP = join(ROOT, 'docs', 'help')
const DASH = /[—–]/
const TODAY = new Date().toISOString().slice(0, 10)
const REGISTRY_MAX_AGE_DAYS = 120
const VERIFIED_MAX_AGE_DAYS = 365
const ISO = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = new Set(['yes', 'partial', 'paid', 'no', 'na'])
const GROUPS = new Set(['svelte-native', 'headless', 'commercial', 'oss'])

/** Priority pages carry the full required-field set (sources on every paid/no
 *  cell, five FAQ, fourteen rows...); every page, whatever its tier, must be
 *  verified within the window. */
const isStrict = (c: Comparison) => c.tier === 'priority'
const isDated = () => true

/** Number-shaped claims that must come from the ledger. */
const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'size', re: /~?\d+(?:\.\d+)?\s?(?:KB|kB|MB|kb)\b/g },
  { name: 'price', re: /~?\$\d[\d,]*(?:\.\d+)?\+?/g },
  { name: 'downloads', re: /\d[\d,.]*\s?[kKmM]?\+?\s*(?:downloads|installs|dl\/month)\b/gi },
  { name: 'downloads-in-words', re: /\b(?:millions?|thousands?|billions?)\s+of\s+(?:downloads|installs|users|developers)\b/gi },
  { name: 'semver', re: /\bv?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?\b/g },
  { name: 'stale-version-claim', re: /\bSvGrid (?:v\d|is (?:still )?pre-1\.0)|\bpre-1\.0\b/g },
  { name: 'demo-count', re: /\b\d{2,}\+?\s+(?:production-quality\s+)?(?:examples|demos|doc pages|docs pages)\b/gi },
]

/** The fields of a comparison whose text is prose (guarded). */
function proseOf(c: Comparison): Array<{ at: string; text: string }> {
  const out: Array<{ at: string; text: string }> = []
  const push = (at: string, v: unknown) => { if (typeof v === 'string' && v) out.push({ at, text: v }) }
  push('tagline', c.tagline); push('oneLineVerdict', c.oneLineVerdict); push('alternativeIntro', c.alternativeIntro)
  push('bottomLine', c.bottomLine); push('seoDescription', c.seoDescription); push('seoTitle', c.seoTitle)
  for (const k of ['intro', 'similarities', 'svgridAdvantages', 'competitorAdvantages', 'whenToChooseSvGrid', 'whenToChooseCompetitor'] as const) {
    (c[k] ?? []).forEach((s, i) => push(`${k}[${i}]`, s))
  }
  c.migration?.youLose?.forEach((s, i) => push(`migration.youLose[${i}]`, s))
  push('migration.effort', c.migration?.effort)
  c.faq.forEach((f, i) => { push(`faq[${i}].question`, f.question); push(`faq[${i}].answer`, f.answer) })
  c.features.forEach((r, i) => { push(`features[${i}].feature`, r.feature); push(`features[${i}].svgrid.note`, r.svgrid.note); push(`features[${i}].competitor.note`, r.competitor.note) })
  return out
}

/** Tokens a dated statement contributes: the numbers inside a pricing summary or a source line. */
function datedTokens(c: Comparison): string[] {
  const out: string[] = []
  const grab = (text: string | undefined) => {
    for (const { re } of PATTERNS) for (const m of String(text ?? '').matchAll(re)) out.push(norm(m[0]))
  }
  grab(c.pricing?.summary)
  for (const s of c.sources ?? []) grab(s.evidences)
  return out
}

const norm = (s: string) => s.replace(/^~/, '').replace(/\+$/, '').replace(/\s+/g, ' ').trim()

function offenders(text: string, allowed: Set<string>): string[] {
  const out: string[] = []
  for (const { name, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const tok = norm(m[0])
      if (name === 'stale-version-claim' || name === 'downloads-in-words' || name === 'demo-count') { out.push(`${name}: "${m[0]}"`); continue }
      if (!allowed.has(tok)) out.push(`${name}: "${m[0]}"`)
    }
  }
  return out
}

const data = await (async () => {
  const comparisons = await loadComparisons()
  const ledger = await loadLedger()
  const size = await loadSvgridSize()
  const tokens = factTokens({ ledger, size })
  // A price the ledger renders in words: "$599" and "$599 per developer per year" both.
  tokens.add(`$${SVGRID_PRICING.grid}`); tokens.add(`$${SVGRID_PRICING.suite}`)
  return { comparisons, ledger, size, tokens }
})()

describe('comparison data files', () => {
  it('validate against the shape the renderers read', async () => {
    const problems: string[] = []
    const slugs = new Set(data.comparisons.map((c) => c.slug))
    const migrationSlugs = new Set<string>()
    for (const c of data.comparisons) {
      const at = c.slug
      const raw = await readFile(join(ROOT, 'docs', '_data', 'comparisons', `${c.slug}.json`), 'utf-8')
      if (DASH.test(raw)) problems.push(`${at}: contains an em/en dash`)
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(c.slug)) problems.push(`${at}: bad slug`)
      if (!c.competitor) problems.push(`${at}: no competitor`)
      if (!Array.isArray(c.aliases) || !c.aliases.length) problems.push(`${at}: no aliases`)
      if (!Array.isArray(c.framework) || !c.framework.length) problems.push(`${at}: no framework`)
      if (!GROUPS.has(c.group)) problems.push(`${at}: group "${c.group}"`)
      if (!['priority', 'standard'].includes(c.tier)) problems.push(`${at}: tier "${c.tier}"`)
      if (!ISO.test(c.published)) problems.push(`${at}: published "${c.published}"`)
      if (!ISO.test(c.verified)) problems.push(`${at}: verified "${c.verified}"`)
      if (!c.tagline || !c.oneLineVerdict || !c.bottomLine) problems.push(`${at}: tagline, oneLineVerdict and bottomLine are required`)
      if (!c.intro?.length) problems.push(`${at}: no intro`)
      if (!c.features?.length) problems.push(`${at}: no feature rows`)
      if (!c.faq?.length || c.faq.length < 3) problems.push(`${at}: fewer than 3 FAQ entries`)
      if (isStrict(c) && c.faq.length < 5) problems.push(`${at}: priority page needs 5 FAQ entries`)
      if (isStrict(c) && c.features.length < 14) problems.push(`${at}: priority page needs 14 feature rows`)
      if (isStrict(c) && (c.sources?.length ?? 0) < 3) problems.push(`${at}: priority page needs 3 sources`)
      if (isStrict(c) && !c.pricing?.summary) problems.push(`${at}: priority page needs a pricing statement`)
      if (isStrict(c) && (c.migration?.youLose?.length ?? 0) < 2) problems.push(`${at}: priority page needs 2 "what you give up" lines`)
      if (isStrict(c) && !c.demos?.length) problems.push(`${at}: priority page needs a demo`)
      if (isStrict(c) && (c.related?.length ?? 0) < 2) problems.push(`${at}: priority page needs 2 related comparisons`)
      if (c.seoTitle && c.seoTitle.length > 65) problems.push(`${at}: seoTitle over 65 chars`)
      if (c.seoDescription && c.seoDescription.length > 155) problems.push(`${at}: seoDescription over 155 chars`)
      const sourceIds = new Set((c.sources ?? []).map((s) => s.id))
      for (const s of c.sources ?? []) {
        if (!s.id || !/^https:\/\//.test(s.url) || !s.evidences || !ISO.test(s.verified)) problems.push(`${at}: source "${s.id}" needs id, https url, evidences, verified`)
      }
      c.features.forEach((r, i) => {
        for (const side of ['svgrid', 'competitor'] as const) {
          const cell = r[side]
          if (!cell || !STATUSES.has(cell.status)) problems.push(`${at}: features[${i}].${side}.status "${cell?.status}"`)
          if (cell?.source && !sourceIds.has(cell.source)) problems.push(`${at}: features[${i}].${side}.source "${cell.source}" is not a source id`)
          if (isStrict(c) && side === 'competitor' && (cell?.status === 'paid' || cell?.status === 'no') && !cell.source) {
            problems.push(`${at}: features[${i}] "${r.feature}": a paid/no cell on the competitor needs a source`)
          }
        }
      })
      if (!c.migration?.slug) problems.push(`${at}: no migration slug`)
      else {
        migrationSlugs.add(c.migration.slug)
        try { await readFile(join(HELP, `${c.migration.slug}.md`)) } catch { problems.push(`${at}: migration guide ${c.migration.slug}.md does not exist`) }
      }
      if (c.pricing) {
        if (!/^https:\/\//.test(c.pricing.url)) problems.push(`${at}: pricing.url must be https`)
        if (!ISO.test(c.pricing.verified)) problems.push(`${at}: pricing.verified "${c.pricing.verified}"`)
        if (c.pricing.summary && c.pricing.verified.startsWith('1970')) problems.push(`${at}: pricing.summary without a verified date`)
      }
      for (const id of c.demos ?? []) {
        try { await readFile(join(ROOT, 'examples', 'src', 'demos', `${id}.svelte`)) } catch { problems.push(`${at}: demo "${id}" does not exist`) }
      }
      for (const slug of c.docs ?? []) {
        try { await readFile(join(ROOT, 'docs', `${slug}.md`)) } catch { problems.push(`${at}: doc "${slug}" does not exist`) }
      }
      for (const r of c.related ?? []) {
        if (!slugs.has(r)) problems.push(`${at}: related "${r}" is not a comparison`)
        if (r === c.slug) problems.push(`${at}: related to itself`)
      }
    }
    expect(migrationSlugs.size).toBe(data.comparisons.length)
    expect(problems).toEqual([])
  })

  it('carry a fresh ledger entry for every package and a recent verified date', () => {
    const problems: string[] = []
    const warnings: string[] = []
    for (const c of data.comparisons) {
      if (c.npm) {
        const reg = data.ledger.registry[c.npm]
        if (!reg) { problems.push(`${c.slug}: ${c.npm} is not in the ledger (pnpm competitors:verify)`); continue }
        const age = daysBetween(reg.verified, TODAY)
        if (!(age <= REGISTRY_MAX_AGE_DAYS)) problems.push(`${c.slug}: ${c.npm} verified ${reg.verified}, ${age} days ago`)
        if (c.publishBundle) {
          const b = data.ledger.bundles[c.npm]
          if (!b) problems.push(`${c.slug}: publishBundle without a measured bundle`)
          else if (b.version !== reg.version) problems.push(`${c.slug}: bundle measured at ${b.version}, ledger says ${reg.version} (pnpm competitors:measure)`)
        }
      }
      const age = daysBetween(c.verified, TODAY)
      const msg = `${c.slug}: verified ${c.verified}, ${Number.isFinite(age) ? age : '?'} days ago (limit ${VERIFIED_MAX_AGE_DAYS})`
      if (!(age <= VERIFIED_MAX_AGE_DAYS)) (isDated() ? problems : warnings).push(msg)
      if (!c.pricing?.summary) problems.push(`${c.slug}: no pricing statement`)
      if (c.pricing?.summary && !(daysBetween(c.pricing.verified, TODAY) <= VERIFIED_MAX_AGE_DAYS)) (isDated() ? problems : warnings).push(`${c.slug}: pricing verified ${c.pricing.verified}`)
      if (!(c.sources?.length)) problems.push(`${c.slug}: no sources`)
      if (!(c.related?.length)) problems.push(`${c.slug}: no related comparisons`)
      if (!(c.demos?.length)) problems.push(`${c.slug}: no demo`)
      for (const s of c.sources ?? []) {
        if (!(daysBetween(s.verified, TODAY) <= VERIFIED_MAX_AGE_DAYS)) (isDated() ? problems : warnings).push(`${c.slug}: source ${s.id} verified ${s.verified}`)
      }
    }
    const own = data.ledger.registry['@svgrid/grid']
    if (!own) problems.push('@svgrid/grid is not in the ledger')
    if (!data.size) problems.push('docs/_data/svgrid-size.json is missing (pnpm size:json)')
    if (warnings.length) console.warn(`competitor-facts: ${warnings.length} standard-tier page(s) past the verification window:\n  ${warnings.join('\n  ')}`)
    expect(problems).toEqual([])
  })

  it('type no size, price, download count, semver or demo count in prose', () => {
    const problems: string[] = []
    for (const c of data.comparisons) {
      const allowed = new Set([...data.tokens, ...datedTokens(c)])
      for (const { at, text } of proseOf(c)) {
        for (const o of offenders(text, allowed)) problems.push(`${c.slug} ${at}: ${o}`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe('comparison guides', () => {
  it('carry a current generated facts block and no typed numbers outside it', async () => {
    const files = (await readdir(HELP)).filter((f) => f === 'comparison.md' || /^migrating-from-.*\.md$/.test(f))
    expect(files.length).toBeGreaterThan(15)
    const problems: string[] = []
    // The guides may quote SvGrid's own prices; everything else with a number
    // of these kinds belongs in the generated block.
    const allowed = new Set([`$${SVGRID_PRICING.grid}`, `$${SVGRID_PRICING.suite}`])
    for (const f of files) {
      const md = (await readFile(join(HELP, f), 'utf-8')).replace(/\r\n/g, '\n')
      const fileSlug = f.replace(/\.md$/, '')
      const slugs = guideFactsSlugs(md)
      if (!slugs || !slugs.length) {
        const c = comparisonForGuide(fileSlug, data.comparisons)
        problems.push(`${f}: no facts block${c ? ` (node tools/sync-guide-facts.mjs)` : ' and no comparison names this guide: add <!-- facts:start <slug> -->'}`)
        continue
      }
      let expected = syncGuideFacts(md, guideFactsBlock(slugs, data, guideFactsPackages(md)))
      if (fileSlug === 'comparison') expected = syncBenchmarkBlock(expected, benchmarkBlock(data.ledger))
      if (expected !== md) problems.push(`${f}: facts block is stale (node tools/sync-guide-facts.mjs)`)
      const prose = stripGeneratedBlocks(md)
      for (const o of offenders(prose, allowed)) {
        // Semver in a guide is usually an install line or a product line name,
        // which the block cannot carry; only the claim kinds the block does
        // carry are held to it.
        if (o.startsWith('semver:')) continue
        problems.push(`${f}: ${o}`)
      }
      if (fileSlug === 'comparison') {
        for (const m of prose.matchAll(/\b\d+(?:\.\d+)?\s?ms\b/g)) problems.push(`${f}: timing "${m[0]}" outside the bench block`)
      }
    }
    expect(problems).toEqual([])
  })
})
