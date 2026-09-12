import type { Ledger, SvgridSize } from './competitor-facts.mjs'
import type { Comparison } from '../../website/src/lib/comparisons'

export const COMPARISONS_DIR: string
export const LEDGER_FILE: string
export const SVGRID_SIZE_FILE: string
export function loadComparisons(dir?: string): Promise<Comparison[]>
export function loadLedger(file?: string): Promise<Ledger>
export function loadSvgridSize(file?: string): Promise<SvgridSize | null>
