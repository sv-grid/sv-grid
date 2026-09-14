import type { Ledger, SvgridSize, Facts, BenchmarkFacts } from './competitor-facts.mjs'

export type CompareLink = { slug: string; title: string }
export type CompareFeatureRow = { feature: string; svgrid: string; competitor: string; better: 'svgrid' | 'competitor' | 'even' }
export type ComparePageModel = {
  slug: string
  competitor: string
  short: string
  npm: string
  url: string
  tagline: string
  oneLineVerdict: string
  published: string
  verified: string
  migration: { slug: string; effort: string; youLose: string[] } | null
  facts: Facts
  intro: string[]
  alternativeIntro: string
  similarities: string[]
  svgridAdvantages: string[]
  competitorAdvantages: string[]
  features: CompareFeatureRow[]
  benchmark: BenchmarkFacts | null
  whenToChooseSvGrid: string[]
  whenToChooseCompetitor: string[]
  live: { id: string; title: string } | null
  bottomLine: string
  faq: { question: string; answer: string }[]
  related: CompareLink[]
  docs: CompareLink[]
  posts: CompareLink[]
  sources: { id: string; url: string; evidences: string; verified: string }[]
}
export type CompareHref = (kind: 'docs' | 'demos' | 'compare' | 'blog', slug: string) => string
export type CompareHubItem = { slug: string; competitor: string; tagline: string; facts: string }
export type CompareHubModel = { groups: { id: string; title: string; blurb: string; items: CompareHubItem[] }[] }

export const COMPARE_ORDER: readonly string[]
export const COMPARE_HEADINGS: {
  readonly verdict: string
  readonly facts: string
  readonly intro: string
  readonly alternative: (short: string) => string
  readonly common: string
  readonly svgridWins: string
  readonly competitorWins: (competitor: string) => string
  readonly features: string
  readonly benchmark: string
  readonly chooseSvgrid: string
  readonly chooseCompetitor: (competitor: string) => string
  readonly migration: string
  readonly live: string
  readonly bottom: string
  readonly faq: string
  readonly related: string
  readonly sources: string
}
export const STATUS_LABEL: Readonly<Record<'yes' | 'partial' | 'paid' | 'no' | 'na', string>>
export const FEATURE_LEGEND: string
export const FACT_COLUMNS: { readonly fact: string; readonly checked: string }
export const COMPARE_GROUPS: readonly { id: string; title: string; blurb: string }[]

export function betterSide(row: { svgrid: { status: string }; competitor: { status: string } }): 'svgrid' | 'competitor' | 'even'
export function cellText(cell: { status: string; note?: string }): string
export function headingId(text: string): string
export function comparePageModel(
  cmp: import('../../website/src/lib/comparisons').Comparison,
  ctx: {
    ledger: Ledger
    size: SvgridSize | null
    demoTitle: (id: string) => string | null
    docTitle: (slug: string) => string | null
    postTitle?: (slug: string) => string | null
    comparisons: { slug: string; competitor: string }[]
  },
): ComparePageModel
export function compareSections(model: ComparePageModel): string[]
export function compareHeading(key: string, model: ComparePageModel): string
export function verifiedLine(model: ComparePageModel): string
export function migrationLines(model: ComparePageModel): { effort: string; guide: string }
export function liveLine(model: ComparePageModel): string
export function sourceLine(source: { evidences: string; verified: string }): string
export function renderCompareHtml(model: ComparePageModel, opts: { href: CompareHref; escape?: (s: string) => string }): string
export function renderCompareMarkdown(model: ComparePageModel, opts: { site: string }): string
export function hubFactsLine(cmp: { npm?: string; verified?: string }, ledger: Ledger): string
export function compareHubModel(comparisons: import('../../website/src/lib/comparisons').Comparison[], ctx: { ledger: Ledger }): CompareHubModel
export function renderCompareHubHtml(hub: CompareHubModel, opts: { href: (kind: 'compare', slug: string) => string; escape?: (s: string) => string }): string
