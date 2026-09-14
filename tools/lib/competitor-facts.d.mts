export type RegistryFact = {
  version: string
  license: string
  lastPublished: string
  peerSvelte: string | null
  downloadsLastMonth: number
  downloadsWindow: { start: string; end: string }
  verified: string
  sources: string[]
}
export type BundleFact = {
  version: string
  jsGzipKb: number
  cssGzipKb: number
  minKb: number
  lazyGzipKb: number
  entry: string
  external: string[]
  measuredAt: string
}
export type BenchmarkLedger = {
  rig: Record<string, string>
  measuredAt: string
  rows: number
  cases: string[]
  grids: { id: string; label: string; npm: string; version: string; results: Record<string, number> }[]
}
export type Ledger = {
  registry: Record<string, RegistryFact>
  bundles: Record<string, BundleFact>
  benchmarks: BenchmarkLedger | null
}
export type SvgridSize = {
  measuredAt: string
  version: string
  entries: Record<string, { baseGzipKb: number; cssGzipKb: number; lazyGzipKb: number }>
}
export type FactRow = { label: string; svgrid: string; competitor: string; checked: string }
export type Facts = { rows: FactRow[]; footnotes: string[]; verified: string }

export const SVGRID_PRICING: {
  readonly singleApp: number
  readonly multiApp: number
  readonly unit: string
  readonly url: string
  readonly summary: string
}
export const SVGRID_SIZE_ENTRY: string
export function frameworkList(framework: string[]): string
export function licenseLabel(license: string | null | undefined): string
export function formatKb(kb: number | string): string
export function bundleText(jsKb: number | string, cssKb: number | string): string
export function formatDownloads(n: number | string): string
export function formatDate(iso: string | null | undefined): string
export function daysBetween(a: string, b: string): number
export function svelteSupportLabel(reg: RegistryFact | undefined, framework: string[]): string
export function factsForComparison(
  cmp: { npm?: string; framework: string[]; verified: string; publishBundle?: boolean; pricing?: { summary: string; verified: string } },
  ledger: Ledger,
  size: SvgridSize | null,
): Facts
export type BenchmarkFacts = { measuredAt: string; intro: string; rows: { label: string; svgrid: string; competitor: string }[]; notes: string[] }
export const BENCHMARK_CASES: readonly (readonly [string, string])[]
export function benchmarkForComparison(cmp: { npm?: string }, ledger: Ledger): BenchmarkFacts | null
export function factTokens(input: { ledger: Ledger; size: SvgridSize | null }): Set<string>
