/**
 * Conditional formatting engine. Excel-style declarative rules that color a
 * cell by its value - color scales, in-cell data bars, icon sets, and plain
 * predicate rules. This goes beyond `cellClass(ctx)` (which can only toggle
 * static classes) because color scales and data bars need a value computed
 * against the column's min/max range.
 *
 * Everything here is pure: `resolveCellFormat` takes a value + the column's
 * numeric range and returns the visual primitives, so the `<SvGrid>` render
 * component just paints the result and the logic is unit-testable.
 */

export type ColorScaleFormat = {
  type: 'colorScale'
  /** 2-stop (min/max) or 3-stop (min/mid/max) gradient. Hex colors. */
  min: string
  mid?: string
  max: string
  /** Fix the scale; otherwise derived from the column's data. */
  minValue?: number
  maxValue?: number
}

export type DataBarFormat = {
  type: 'dataBar'
  color: string
  negativeColor?: string
  minValue?: number
  maxValue?: number
  /** Show the cell's text on top of the bar. Default true. */
  showValue?: boolean
}

export type IconSetName = 'arrows' | 'traffic' | 'triangles'

export type IconSetFormat = {
  type: 'iconSet'
  set?: IconSetName
  /** Ascending breakpoints. n thresholds => n+1 buckets/icons. */
  thresholds: number[]
  /** Hide the numeric text, show only the icon. Default false. */
  iconOnly?: boolean
}

export type RuleFormat<TData = unknown> = {
  type: 'rule'
  /** Apply the styles below when this returns true. */
  when: (ctx: { value: unknown; row: TData }) => boolean
  background?: string
  color?: string
  fontWeight?: string | number
}

export type ConditionalFormatSpec<TData = unknown> =
  | ColorScaleFormat
  | DataBarFormat
  | IconSetFormat
  | RuleFormat<TData>

/** A format scoped to specific columns (omit `columns` to apply to all). */
export type ConditionalFormat<TData = unknown> = ConditionalFormatSpec<TData> & {
  columns?: ReadonlyArray<string>
}

export type ResolvedCellFormat = {
  background?: string
  color?: string
  fontWeight?: string | number
  dataBar?: { percent: number; color: string; fromRight: boolean }
  icon?: string
  iconOnly?: boolean
}

export type ColumnStat = { min: number; max: number }

const ICON_SETS: Record<IconSetName, string[]> = {
  // ordered low -> high; bucket i picks icon i
  arrows: ['↓', '→', '↑'],
  traffic: ['🔴', '🟡', '🟢'],
  triangles: ['▼', '◆', '▲'],
}

/** Min/max of a column's finite numeric values, or null if none. */
export function computeColumnStat(values: Iterable<unknown>): ColumnStat | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let any = false
  for (const v of values) {
    if (v == null || v === '') continue
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    any = true
    if (n < min) min = n
    if (n > max) max = n
  }
  return any ? { min, max } : null
}

/** Which icon a value lands on, given ascending thresholds. */
function pickIcon(set: string[], thresholds: number[], n: number): string {
  let bucket = 0
  for (let i = 0; i < thresholds.length; i += 1) {
    if (n >= thresholds[i]!) bucket = i + 1
  }
  // Map the bucket onto the available icons (clamp + spread).
  const idx = Math.min(set.length - 1, Math.max(0, bucket))
  return set[idx] ?? set[set.length - 1]!
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const int = parseInt(m[1]!, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function toHex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((c) => Math.round(clamp01(c / 255) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * Pick a readable text color (near-black or white) for a given hex
 * background, using WCAG relative luminance. Lets a color-scale fill or a
 * tinted rule keep its text legible without the caller hand-picking a color.
 * Returns null when the background isn't a parseable hex (e.g. a CSS var),
 * so the caller can leave the default text color in place.
 */
export function contrastText(bg: string): string | null {
  const rgb = parseHex(bg)
  if (!rgb) return null
  const lin = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  const L = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
  return L > 0.45 ? '#1e293b' : '#ffffff'
}

/** Linear interpolate two hex colors. Falls back to `a` if parsing fails. */
export function lerpColor(a: string, b: string, t: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return a
  const k = clamp01(t)
  return toHex([
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  ])
}

function colorScaleAt(fmt: ColorScaleFormat, t: number): string {
  if (fmt.mid) {
    return t <= 0.5
      ? lerpColor(fmt.min, fmt.mid, t / 0.5)
      : lerpColor(fmt.mid, fmt.max, (t - 0.5) / 0.5)
  }
  return lerpColor(fmt.min, fmt.max, t)
}

/**
 * Resolve every format that applies to one cell into a single set of visual
 * primitives. Later-listed formats override earlier ones for the same
 * property, so order your `conditionalFormats` from general to specific.
 */
export function resolveCellFormat<TData = unknown>(
  value: unknown,
  row: TData,
  columnId: string,
  formats: ReadonlyArray<ConditionalFormat<TData>>,
  stat: ColumnStat | null,
): ResolvedCellFormat {
  const out: ResolvedCellFormat = {}
  for (const fmt of formats) {
    if (fmt.columns && !fmt.columns.includes(columnId)) continue
    const n = Number(value)

    if (fmt.type === 'rule') {
      if (fmt.when({ value, row })) {
        if (fmt.background) {
          out.background = fmt.background
          // Auto-pick legible text on the tint unless the rule sets its own.
          if (!fmt.color) {
            const c = contrastText(fmt.background)
            if (c) out.color = c
          }
        }
        if (fmt.color) out.color = fmt.color
        if (fmt.fontWeight != null) out.fontWeight = fmt.fontWeight
      }
      continue
    }

    if (value == null || value === '' || !Number.isFinite(n)) continue

    if (fmt.type === 'colorScale') {
      const lo = fmt.minValue ?? stat?.min ?? n
      const hi = fmt.maxValue ?? stat?.max ?? n
      const t = hi === lo ? 0.5 : clamp01((n - lo) / (hi - lo))
      out.background = colorScaleAt(fmt, t)
      // The scale fills the whole cell, so keep the text legible against it.
      const c = contrastText(out.background)
      if (c) out.color = c
    } else if (fmt.type === 'dataBar') {
      const lo = fmt.minValue ?? Math.min(0, stat?.min ?? 0)
      const hi = fmt.maxValue ?? stat?.max ?? n
      const span = hi - lo || 1
      const percent = clamp01((n - lo) / span) * 100
      const negative = n < 0
      out.dataBar = {
        percent,
        color: negative ? (fmt.negativeColor ?? '#ef4444') : fmt.color,
        fromRight: false,
      }
      if (fmt.showValue === false) out.color = 'transparent'
    } else if (fmt.type === 'iconSet') {
      const set = ICON_SETS[fmt.set ?? 'arrows']
      out.icon = pickIcon(set, fmt.thresholds, n)
      if (fmt.iconOnly) out.iconOnly = true
    }
  }
  return out
}

/** Column ids that need a numeric min/max precomputed (colorScale/dataBar). */
export function formatsNeedingStats(
  formats: ReadonlyArray<ConditionalFormat<any>>,
): boolean {
  return formats.some((f) => f.type === 'colorScale' || f.type === 'dataBar')
}
