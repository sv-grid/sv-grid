import type { Ledger, SvgridSize } from './competitor-facts.mjs'

export const FACTS_START_RE: RegExp
export const FACTS_END: string
export const BENCH_START: string
export const BENCH_END: string
export function comparisonForGuide<T extends { migration?: { slug: string } }>(fileSlug: string, comparisons: T[]): T | null
export function guideFactsBlock(slugs: string[], ctx: { comparisons: unknown[]; ledger: Ledger; size: SvgridSize | null }, packages?: string[]): string
export function syncGuideFacts(markdown: string, block: string): string
export function guideFactsSlugs(markdown: string): string[] | null
export function guideFactsPackages(markdown: string): string[]
export function benchmarkBlock(ledger: Ledger): string | null
export function syncBenchmarkBlock(markdown: string, block: string | null): string
export function stripGeneratedBlocks(markdown: string): string
