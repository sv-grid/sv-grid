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

/** A single gradient stop along the normalized 0..1 domain. */
export type ColorScaleStop = { offset: number; color: string }

/**
 * How `minValue`/`maxValue` (and the derived column extremes) are read:
 * - `absolute` (default): literal data values.
 * - `percent`: 0..100 positions along the column's own min..max span, so you
 *   can say "tint the top 20%" without knowing the numbers up front.
 */
export type ScaleBounds = 'absolute' | 'percent'

export type ColorScaleFormat = {
  type: 'colorScale'
  /** 2-stop (min/max) or 3-stop (min/mid/max) gradient. Hex colors. */
  min?: string
  mid?: string
  max?: string
  /**
   * N-stop gradient along the normalized domain (offsets 0..1). When present
   * this overrides `min`/`mid`/`max`, enabling banded / traffic-light scales.
   */
  stops?: ReadonlyArray<ColorScaleStop>
  /**
   * `hue` (default): interpolate between stop colors into an opaque fill.
   * `alpha`: keep a single `base` color and interpolate its *opacity*, so the
   * tint composites over zebra striping, selection, and pinned backgrounds
   * instead of painting over them - Adaptable's "live heat map" look.
   */
  mode?: 'hue' | 'alpha'
  /** Base color for `alpha` mode. Default `#2563eb`. */
  base?: string
  /** [min, max] opacity for `alpha` mode. Default [0.05, 0.85]. */
  alphaBounds?: readonly [number, number]
  /** Fix the scale; otherwise derived from the column's data. */
  minValue?: number
  maxValue?: number
  /** Interpret `minValue`/`maxValue` as absolute values or 0..100 percents. */
  bounds?: ScaleBounds
  /**
   * Diverging scale pinned at 0: negatives and positives shade outward from a
   * neutral midpoint, symmetric around zero. Ideal for P&L / price deltas.
   */
  zeroCentred?: boolean
  /** Flip the ramp so the lowest values attract the most attention. */
  reverse?: boolean
  /**
   * Tint by this cell's value as a proportion of another column's value on the
   * SAME row (a field key on the row object), instead of the column extremes.
   * Column comparison - e.g. filled vs target, open vs total.
   */
  compareColumn?: string
  /** Attach a tooltip showing the raw value or its % position on the ramp. */
  tooltip?: 'value' | 'percent'
}

export type DataBarFormat = {
  type: 'dataBar'
  color: string
  negativeColor?: string
  minValue?: number
  maxValue?: number
  /** Interpret `minValue`/`maxValue` as absolute values or 0..100 percents. */
  bounds?: ScaleBounds
  /**
   * Size the bar by this cell's value as a proportion of another column's
   * value on the same row (a field key), instead of the column extremes.
   */
  compareColumn?: string
  /** Fill the bar with a left-to-right gradient rather than a flat color. */
  gradient?: boolean
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
  dataBar?: { percent: number; color: string; fromRight: boolean; gradient?: boolean }
  icon?: string
  iconOnly?: boolean
  /** Tooltip text (value / percentile), when a format requests one. */
  title?: string
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

/** Build an `rgba()` string from a hex color + opacity. Falls back to the hex. */
export function rgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp01(alpha).toFixed(3)})`
}

/** Color of an N-stop ramp at normalized position `t`. Stops sorted by offset. */
function stopsColorAt(stops: ReadonlyArray<ColorScaleStop>, t: number): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  if (sorted.length === 0) return '#000000'
  if (t <= sorted[0]!.offset) return sorted[0]!.color
  const last = sorted[sorted.length - 1]!
  if (t >= last.offset) return last.color
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (t >= a.offset && t <= b.offset) {
      const span = b.offset - a.offset || 1
      return lerpColor(a.color, b.color, (t - a.offset) / span)
    }
  }
  return last.color
}

/** The interpolated color for a color-scale at normalized position `t`. */
function colorScaleAt(fmt: ColorScaleFormat, t: number): string {
  if (fmt.stops && fmt.stops.length >= 2) return stopsColorAt(fmt.stops, t)
  const min = fmt.min ?? '#ffffff'
  const max = fmt.max ?? '#000000'
  if (fmt.mid) {
    return t <= 0.5
      ? lerpColor(min, fmt.mid, t / 0.5)
      : lerpColor(fmt.mid, max, (t - 0.5) / 0.5)
  }
  return lerpColor(min, max, t)
}

/**
 * Normalized position (0..1) of `n` within a format's domain, honoring
 * absolute/percent bounds, zero-centred diverging scales, cross-column
 * comparison, and reverse. Returns null when the domain can't be resolved
 * (e.g. compareColumn missing / zero on the row).
 */
function domainT(
  fmt: ColorScaleFormat | DataBarFormat,
  n: number,
  row: unknown,
  stat: ColumnStat | null,
): number | null {
  let t: number

  if (fmt.compareColumn) {
    const other = Number((row as Record<string, unknown> | null)?.[fmt.compareColumn])
    if (!Number.isFinite(other) || other === 0) return null
    t = clamp01(n / other)
  } else if (fmt.type === 'colorScale' && fmt.zeroCentred) {
    const dMin = fmt.minValue ?? stat?.min ?? n
    const dMax = fmt.maxValue ?? stat?.max ?? n
    const bound = Math.max(Math.abs(dMin), Math.abs(dMax)) || 1
    t = clamp01(0.5 + n / bound / 2)
  } else {
    const dMin = stat?.min ?? n
    const dMax = stat?.max ?? n
    let lo: number
    let hi: number
    if (fmt.bounds === 'percent') {
      const span = dMax - dMin
      lo = dMin + ((fmt.minValue ?? 0) / 100) * span
      hi = dMin + ((fmt.maxValue ?? 100) / 100) * span
    } else {
      lo = fmt.minValue ?? dMin
      hi = fmt.maxValue ?? dMax
    }
    t = hi === lo ? 0.5 : clamp01((n - lo) / (hi - lo))
  }

  if (fmt.type === 'colorScale' && fmt.reverse) t = 1 - t
  return t
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
      const t = domainT(fmt, n, row, stat)
      if (t == null) continue
      if (fmt.mode === 'alpha') {
        const [alo, ahi] = fmt.alphaBounds ?? [0.05, 0.85]
        out.background = rgba(fmt.base ?? '#2563eb', alo + (ahi - alo) * t)
        // Translucent tint composites over the row bg; leave text color alone.
      } else {
        out.background = colorScaleAt(fmt, t)
        // The scale fills the whole cell, so keep the text legible against it.
        const c = contrastText(out.background)
        if (c) out.color = c
      }
      if (fmt.tooltip === 'value') out.title = String(value)
      else if (fmt.tooltip === 'percent') out.title = `${Math.round(t * 100)}%`
    } else if (fmt.type === 'dataBar') {
      let percent: number
      if (fmt.compareColumn) {
        const t = domainT(fmt, n, row, stat)
        if (t == null) continue
        percent = t * 100
      } else if (fmt.bounds === 'percent') {
        const t = domainT(fmt, n, row, stat)
        if (t == null) continue
        percent = t * 100
      } else {
        const lo = fmt.minValue ?? Math.min(0, stat?.min ?? 0)
        const hi = fmt.maxValue ?? stat?.max ?? n
        const span = hi - lo || 1
        percent = clamp01((n - lo) / span) * 100
      }
      const negative = n < 0
      out.dataBar = {
        percent,
        color: negative ? (fmt.negativeColor ?? '#ef4444') : fmt.color,
        fromRight: false,
        gradient: fmt.gradient,
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

/**
 * Whether any format needs a numeric min/max precomputed. Color-scale and
 * data-bar formats do, EXCEPT when they derive their range from another column
 * on the same row (`compareColumn`) - those read the row, not column stats.
 */
export function formatNeedsStats(f: ConditionalFormat<any>): boolean {
  return (
    (f.type === 'colorScale' || f.type === 'dataBar') &&
    !('compareColumn' in f && f.compareColumn)
  )
}

export function formatsNeedingStats(
  formats: ReadonlyArray<ConditionalFormat<any>>,
): boolean {
  return formats.some(formatNeedsStats)
}
