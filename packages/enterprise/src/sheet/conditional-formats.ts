/**
 * Conditional formatting, Excel's: rules over cells that colour them by
 * what they hold. Highlight Cells Rules (greater than, between, text that
 * contains, duplicates), Top/Bottom Rules (top 10, above average), Data
 * Bars, Color Scales and Icon Sets, each over rectangles that move with
 * an insert or delete.
 *
 * Rules are evaluated over COMPUTED values (what a formula shows, not its
 * text), which is why the model lives here beside the workbook rather than
 * in the grid's own value-driven rules. The statistics a rule needs over
 * its range (min, max, mean, rank, counts) are computed once per repaint by
 * the shell and handed in, so a thousand cells cost one pass.
 *
 * Priority is array order, first rule first, as Excel's Manage Rules lists
 * them: the first rule that decides a property wins it, and a rule with
 * Stop If True stops the rules below it for the cells it matches.
 */
import { isError, type CellValue } from './ast'
import { toText } from './coerce'
import type { StructuralEdit } from './refs'
import { rectContains, shiftRects, subtractRect, rectsIntersect, type Rect } from './rects'
import type { CellFormatEntry } from './format-store'

export type CfStyle = Pick<CellFormatEntry, 'fill' | 'color' | 'bold' | 'italic' | 'underline' | 'strike' | 'numFmt'>

export type CfOperator =
  | 'greater' | 'less' | 'between' | 'notBetween'
  | 'equal' | 'notEqual' | 'greaterOrEqual' | 'lessOrEqual'
export type CfTextMatch = 'contains' | 'notContains' | 'beginsWith' | 'endsWith'
export type CfIconSet = 'arrows' | 'traffic' | 'flags' | 'symbols'
export type CfScaleColors = readonly [string, string] | readonly [string, string, string]

export type CfRule = { id: string; rects: ReadonlyArray<Rect>; stopIfTrue?: boolean } & (
  | { kind: 'cellIs'; operator: CfOperator; value1: string; value2?: string; style: CfStyle }
  | { kind: 'text'; match: CfTextMatch; value: string; style: CfStyle }
  | { kind: 'duplicates'; unique?: boolean; style: CfStyle }
  | { kind: 'topBottom'; top: boolean; rank: number; percent?: boolean; style: CfStyle }
  | { kind: 'average'; above: boolean; style: CfStyle }
  | { kind: 'dataBar'; color: string }
  | { kind: 'colorScale'; colors: CfScaleColors }
  | { kind: 'iconSet'; set: CfIconSet }
)

export type CfKind = CfRule['kind']
/** A rule that carries a style: what the small dialogs make. */
export type CfStyledRule = Extract<CfRule, { style: CfStyle }>
/** Omit that keeps a union a union, one member at a time. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never
/** Any rule without its id and rectangles: what a new rule is made from. */
export type CfRuleBody = DistributiveOmit<CfRule, 'id' | 'rects'>
/** A styled rule without its id and rectangles: what the dialog hands back. */
export type CfBody = DistributiveOmit<CfStyledRule, 'id' | 'rects'>
/** The small dialogs, one per ribbon entry. */
export type CfPreset =
  | 'greater' | 'less' | 'between' | 'equal' | 'text' | 'duplicates'
  | 'top10' | 'bottom10' | 'aboveAverage' | 'belowAverage'

/** What one rule knows about the numbers in its rectangles. */
export type CfStats = {
  /** Numbers, sorted ascending. */
  sorted: number[]
  min: number
  max: number
  mean: number
  /** How often each display text occurs, for Duplicate Values. */
  counts: Map<string, number>
}

/** What the rules say about one cell. */
export type CfResult = {
  style?: CfStyle
  /** A bar across the cell, 0..1 of its width. */
  dataBar?: { ratio: number; color: string }
  /** The icon set and which of its three icons: 0 = the top one. */
  icon?: { set: CfIconSet; index: 0 | 1 | 2 }
}

/** How a rule reads the sheet: the shell wires the workbook in. */
export type CfContext = {
  /** A formula or a literal, evaluated in the sheet. */
  evaluate(text: string): CellValue
}

// ---------------------------------------------------------------------------
// Excel's palettes
// ---------------------------------------------------------------------------

/** The six "with" styles of Excel's Highlight Cells dialogs. */
export const CF_PRESET_STYLES: ReadonlyArray<{ id: string; label: string; style: CfStyle }> = [
  { id: 'light-red', label: 'Light Red Fill with Dark Red Text', style: { fill: '#FFC7CE', color: '#9C0006' } },
  { id: 'yellow', label: 'Yellow Fill with Dark Yellow Text', style: { fill: '#FFEB9C', color: '#9C5700' } },
  { id: 'green', label: 'Green Fill with Dark Green Text', style: { fill: '#C6EFCE', color: '#006100' } },
  { id: 'red-fill', label: 'Light Red Fill', style: { fill: '#FFC7CE' } },
  { id: 'red-text', label: 'Red Text', style: { color: '#9C0006' } },
]

export const DATA_BAR_COLOR = '#638EC6'
export const COLOR_SCALES: Record<'green-yellow-red' | 'red-yellow-green' | 'green-white' | 'white-red', CfScaleColors> = {
  'green-yellow-red': ['#63BE7B', '#FFEB84', '#F8696B'],
  'red-yellow-green': ['#F8696B', '#FFEB84', '#63BE7B'],
  'green-white': ['#63BE7B', '#FCFCFF'],
  'white-red': ['#FCFCFF', '#F8696B'],
}

let nextId = 1
export function cfId(): string {
  nextId += 1
  return `cf${Date.now().toString(36)}${nextId}`
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * The numbers and the texts a rule's rectangles hold. One pass; the shell
 * caches the result per rule until the next repaint.
 */
export function ruleStats(
  rule: CfRule,
  valueAt: (r: number, c: number) => CellValue,
  displayAt: (r: number, c: number) => string,
): CfStats {
  const numbers: number[] = []
  const counts = new Map<string, number>()
  let sum = 0
  for (const [r1, c1, r2, c2] of rule.rects) {
    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) {
        const v = valueAt(r, c)
        if (typeof v === 'number' && Number.isFinite(v)) { numbers.push(v); sum += v }
        if (rule.kind === 'duplicates') {
          const shown = displayAt(r, c)
          if (shown !== '') counts.set(shown, (counts.get(shown) ?? 0) + 1)
        }
      }
    }
  }
  numbers.sort((a, b) => a - b)
  return {
    sorted: numbers,
    min: numbers[0] ?? 0,
    max: numbers[numbers.length - 1] ?? 0,
    mean: numbers.length ? sum / numbers.length : 0,
    counts,
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function numberOf(text: string, ctx: CfContext): number | null {
  const v = ctx.evaluate(text)
  if (isError(v) || typeof v === 'boolean') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function textOf(text: string, ctx: CfContext): string {
  const t = text.trim()
  if (!t.startsWith('=')) return t
  const v = ctx.evaluate(t)
  return isError(v) ? '' : toText(v)
}

function cellIs(value: number, operator: CfOperator, a: number | null, b: number | null): boolean {
  if (a === null) return false
  switch (operator) {
    case 'greater': return value > a
    case 'less': return value < a
    case 'greaterOrEqual': return value >= a
    case 'lessOrEqual': return value <= a
    case 'equal': return value === a
    case 'notEqual': return value !== a
    case 'between': return b !== null && value >= Math.min(a, b) && value <= Math.max(a, b)
    case 'notBetween': return b !== null && (value < Math.min(a, b) || value > Math.max(a, b))
  }
}

/** Whether a styling rule matches the cell. */
function matches(
  rule: CfRule,
  value: CellValue,
  display: string,
  stats: CfStats,
  ctx: CfContext,
): boolean {
  switch (rule.kind) {
    case 'cellIs': {
      const isEquality = rule.operator === 'equal' || rule.operator === 'notEqual'
      const a = numberOf(rule.value1, ctx)
      if (typeof value === 'number' && (a !== null || !isEquality)) {
        return cellIs(value, rule.operator, a, rule.value2 === undefined ? null : numberOf(rule.value2, ctx))
      }
      // Equal to / not equal to compare as text where either side is text,
      // as Excel does: 5 is not equal to 'Paid', and 'paid' is equal to it.
      if (!isEquality) return false
      const same = display !== '' && display.toLowerCase() === textOf(rule.value1, ctx).toLowerCase()
      return rule.operator === 'equal' ? same : display !== '' && !same
    }
    case 'text': {
      if (display === '') return false
      const hay = display.toLowerCase()
      const needle = textOf(rule.value, ctx).toLowerCase()
      if (needle === '') return false
      switch (rule.match) {
        case 'contains': return hay.includes(needle)
        case 'notContains': return !hay.includes(needle)
        case 'beginsWith': return hay.startsWith(needle)
        case 'endsWith': return hay.endsWith(needle)
        default: return false
      }
    }
    case 'duplicates': {
      if (display === '') return false
      const n = stats.counts.get(display) ?? 0
      return rule.unique ? n === 1 : n > 1
    }
    case 'topBottom': {
      if (typeof value !== 'number' || !stats.sorted.length) return false
      const count = rule.percent
        ? Math.max(1, Math.round((stats.sorted.length * rule.rank) / 100))
        : rule.rank
      if (count <= 0) return false
      // The cut is the count-th value from the top (or bottom); ties keep
      // every cell at that value in, as Excel's do.
      const sorted = stats.sorted
      const cut = rule.top
        ? sorted[Math.max(sorted.length - count, 0)]!
        : sorted[Math.min(count - 1, sorted.length - 1)]!
      return rule.top ? value >= cut : value <= cut
    }
    case 'average': {
      if (typeof value !== 'number' || !stats.sorted.length) return false
      return rule.above ? value > stats.mean : value < stats.mean
    }
    default:
      return false
  }
}

/**
 * A data bar's share of the cell, 0..1. Excel measures from zero when the
 * range is non-negative (10, 20, 40 draw a quarter, a half and the whole
 * width), so the smallest value keeps a bar; a range with negatives runs
 * from its minimum instead, since there is no negative axis here.
 */
function barRatio(value: number, stats: CfStats): number {
  const lo = Math.min(0, stats.min)
  const hi = Math.max(0, stats.max)
  if (hi === lo) return 0
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)))
}

/** Where a number sits in a range, 0..1; 0.5 for a flat range. */
function ratioOf(value: number, stats: CfStats): number {
  if (stats.max === stats.min) return 0.5
  return Math.min(1, Math.max(0, (value - stats.min) / (stats.max - stats.min)))
}

/** Linear interpolate two hex colours. */
function lerp(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return a
  const k = Math.min(1, Math.max(0, t))
  const ch = (i: number) => Math.round(pa[i]! + (pb[i]! - pa[i]!) * k).toString(16).padStart(2, '0')
  return `#${ch(0)}${ch(1)}${ch(2)}`
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The colour a scale gives a position 0..1. */
export function scaleColor(colors: CfScaleColors, t: number): string {
  if (colors.length === 2) return lerp(colors[0], colors[1], t)
  return t <= 0.5 ? lerp(colors[0], colors[1], t * 2) : lerp(colors[1], colors[2], (t - 0.5) * 2)
}

/** Which of an icon set's three icons a position 0..1 gets: Excel's thirds. */
export function iconIndex(t: number): 0 | 1 | 2 {
  return t >= 2 / 3 ? 0 : t >= 1 / 3 ? 1 : 2
}

/**
 * What the rules say about (r, c). Array order is priority; the first rule
 * that decides a property (the fill, the text colour, the bar, the icon)
 * keeps it; a matching rule with Stop If True ends the walk.
 */
export function evaluateCf(
  rules: ReadonlyArray<CfRule>,
  r: number,
  c: number,
  value: CellValue,
  display: string,
  statsFor: (rule: CfRule) => CfStats,
  ctx: CfContext,
): CfResult | null {
  let out: CfResult | null = null
  for (const rule of rules) {
    if (!rule.rects.some((rect) => rectContains(rect, r, c))) continue
    let hit = false
    if (rule.kind === 'dataBar') {
      if (typeof value === 'number' && !(out?.dataBar)) {
        const stats = statsFor(rule)
        out = { ...(out ?? {}), dataBar: { ratio: barRatio(value, stats), color: rule.color } }
        hit = true
      }
    } else if (rule.kind === 'colorScale') {
      const current: CfResult = out ?? {}
      if (typeof value === 'number' && current.style?.fill === undefined) {
        const stats = statsFor(rule)
        out = { ...current, style: { ...(current.style ?? {}), fill: scaleColor(rule.colors, ratioOf(value, stats)) } }
        hit = true
      }
    } else if (rule.kind === 'iconSet') {
      if (typeof value === 'number' && !(out?.icon)) {
        const stats = statsFor(rule)
        out = { ...(out ?? {}), icon: { set: rule.set, index: iconIndex(ratioOf(value, stats)) } }
        hit = true
      }
    } else if (hasStyle(rule) && matches(rule, value, display, statsFor(rule), ctx)) {
      const style: CfStyle = { ...(out?.style ?? {}) }
      const own: CfStyle = rule.style
      for (const key of Object.keys(own) as Array<keyof CfStyle>) {
        if (style[key] === undefined && own[key] !== undefined) (style as Record<string, unknown>)[key] = own[key]
      }
      out = { ...(out ?? {}), style }
      hit = true
    }
    if (hit && rule.stopIfTrue) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------

/** The rules after an insert or delete. */
export function shiftCf(rules: ReadonlyArray<CfRule>, edit: StructuralEdit): CfRule[] {
  return shiftRects(rules, edit)
}

/** The rules with the rectangles cut out of them: Clear Rules from Selected Cells. */
export function removeCf(rules: ReadonlyArray<CfRule>, rects: ReadonlyArray<Rect>): CfRule[] {
  const out: CfRule[] = []
  for (const rule of rules) {
    let kept: Rect[] = [...rule.rects]
    for (const hole of rects) kept = kept.flatMap((rect) => subtractRect(rect, hole))
    if (kept.length) out.push({ ...rule, rects: kept })
  }
  return out
}

/** The rules touching any of the rectangles. */
export function cfIn(rules: ReadonlyArray<CfRule>, rects: ReadonlyArray<Rect>): CfRule[] {
  return rules.filter((rule) => rule.rects.some((a) => rects.some((b) => rectsIntersect(a, b))))
}

const OPERATOR_WORDS: Record<CfOperator, string> = {
  greater: 'greater than', less: 'less than', between: 'between', notBetween: 'not between',
  equal: 'equal to', notEqual: 'not equal to', greaterOrEqual: 'greater than or equal to', lessOrEqual: 'less than or equal to',
}
const MATCH_WORDS: Record<CfTextMatch, string> = {
  contains: 'contains', notContains: 'does not contain', beginsWith: 'begins with', endsWith: 'ends with',
}

/** A rule in words, the way Excel's Manage Rules lists it. */
export function describeCf(rule: CfRule): string {
  switch (rule.kind) {
    case 'cellIs':
      return rule.operator === 'between' || rule.operator === 'notBetween'
        ? `Cell Value ${OPERATOR_WORDS[rule.operator]} ${rule.value1} and ${rule.value2 ?? ''}`
        : `Cell Value ${OPERATOR_WORDS[rule.operator]} ${rule.value1}`
    case 'text': return `Cell Value ${MATCH_WORDS[rule.match]} '${rule.value}'`
    case 'duplicates': return rule.unique ? 'Unique Values' : 'Duplicate Values'
    case 'topBottom': return `${rule.top ? 'Top' : 'Bottom'} ${rule.rank}${rule.percent ? '%' : ''}`
    case 'average': return rule.above ? 'Above Average' : 'Below Average'
    case 'dataBar': return 'Data Bar'
    case 'colorScale': return rule.colors.length === 3 ? 'Graded Color Scale' : 'Two-Color Scale'
    case 'iconSet': return 'Icon Set'
  }
}

/** Whether a rule carries a style the dialog can edit. */
export function hasStyle(rule: CfRule): rule is Extract<CfRule, { style: CfStyle }> {
  return 'style' in rule
}
