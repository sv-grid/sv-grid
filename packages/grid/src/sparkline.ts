/**
 * Sparkline geometry. Pure functions that turn an array of numbers into the
 * SVG primitives a tiny in-cell chart needs - no DOM, so it is trivially
 * unit-testable and the `<SvGrid>` render component just paints the result.
 *
 * Four chart types, mirroring the de-facto enterprise-grid set:
 *   - `line`     a single polyline
 *   - `area`     a polyline plus a filled area down to the baseline
 *   - `bar`      one column per value, scaled from the dataset min..max
 *   - `winloss`  fixed-height up/down bars (sign only), e.g. W/L streaks
 */
export type SparklineType = 'line' | 'area' | 'bar' | 'winloss'

export type SparklineConfig = {
  type?: SparklineType
  /** Stroke (line/area) or positive fill (bar/winloss). */
  color?: string
  /** Fill for negative bars / losses. Defaults to a red. */
  negativeColor?: string
  width?: number
  height?: number
  /** Fix the value scale instead of deriving it from the row's own data. */
  min?: number
  max?: number
  lineWidth?: number
  /** Draw a dot on the last point (line/area). Default true. */
  lastPoint?: boolean
}

export type SparklineBar = {
  x: number
  y: number
  w: number
  h: number
  negative: boolean
}

export type SparklineGeometry = {
  width: number
  height: number
  type: SparklineType
  color: string
  negativeColor: string
  lineWidth: number
  /** `line` / `area`: the polyline through every point. */
  linePath: string
  /** `area`: closed path filled down to the baseline. */
  areaPath: string
  /** `bar` / `winloss`: one rect per value. */
  bars: SparklineBar[]
  /** `line` / `area`: the final point, for the end-cap dot. */
  lastPoint: { x: number; y: number } | null
}

const DEFAULTS = {
  width: 88,
  height: 22,
  color: 'var(--sg-accent, #2563eb)',
  negativeColor: '#ef4444',
  lineWidth: 1.5,
}

/** Coerce loose cell values (arrays, comma strings) into a number array. */
export function toSparklineValues(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,\s]+/)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n))
  }
  return []
}

export function buildSparkline(
  values: number[],
  cfg: SparklineConfig = {},
): SparklineGeometry | null {
  if (!values.length) return null

  const width = cfg.width ?? DEFAULTS.width
  const height = cfg.height ?? DEFAULTS.height
  const type = cfg.type ?? 'line'
  const color = cfg.color ?? DEFAULTS.color
  const negativeColor = cfg.negativeColor ?? DEFAULTS.negativeColor
  const lineWidth = cfg.lineWidth ?? DEFAULTS.lineWidth
  const pad = Math.ceil(lineWidth) + 1
  const innerW = Math.max(1, width - pad * 2)
  const innerH = Math.max(1, height - pad * 2)

  const base: Omit<
    SparklineGeometry,
    'linePath' | 'areaPath' | 'bars' | 'lastPoint'
  > = { width, height, type, color, negativeColor, lineWidth }

  if (type === 'winloss') {
    const n = values.length
    const gap = n > 1 ? Math.min(2, innerW / n / 3) : 0
    const slot = innerW / n
    const barW = Math.max(1, slot - gap)
    const mid = height / 2
    const h = innerH / 2
    const bars: SparklineBar[] = values.map((v, i) => {
      const x = pad + i * slot + (slot - barW) / 2
      if (v > 0) return { x, y: mid - h, w: barW, h, negative: false }
      if (v < 0) return { x, y: mid, w: barW, h, negative: true }
      return { x, y: mid - 1, w: barW, h: 2, negative: false }
    })
    return { ...base, linePath: '', areaPath: '', bars, lastPoint: null }
  }

  const min = cfg.min ?? Math.min(...values)
  const max = cfg.max ?? Math.max(...values)
  const span = max - min || 1

  if (type === 'bar') {
    const n = values.length
    const gap = n > 1 ? Math.min(2, innerW / n / 3) : 0
    const slot = innerW / n
    const barW = Math.max(1, slot - gap)
    // Bars grow from a zero baseline when the data spans zero, else from min.
    const baseVal = min < 0 && max > 0 ? 0 : min
    const baseY = pad + innerH - ((baseVal - min) / span) * innerH
    const bars: SparklineBar[] = values.map((v, i) => {
      const x = pad + i * slot + (slot - barW) / 2
      const vy = pad + innerH - ((v - min) / span) * innerH
      const top = Math.min(vy, baseY)
      const h = Math.max(1, Math.abs(vy - baseY))
      return { x, y: top, w: barW, h, negative: v < baseVal }
    })
    return { ...base, linePath: '', areaPath: '', bars, lastPoint: null }
  }

  // line / area
  const n = values.length
  const stepX = n > 1 ? innerW / (n - 1) : 0
  const pts = values.map((v, i) => ({
    // A single point has no span to walk, so centre it rather than pinning it
    // to the left edge.
    x: n === 1 ? pad + innerW / 2 : pad + i * stepX,
    y: pad + innerH - ((v - min) / span) * innerH,
  }))
  const linePath =
    n === 1
      ? // One point produces only a moveto, which draws nothing. Emit a tiny
        // horizontal segment so a single value still renders a visible mark.
        `M${round(pts[0]!.x - 1)},${round(pts[0]!.y)} L${round(pts[0]!.x + 1)},${round(pts[0]!.y)}`
      : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)},${round(p.y)}`).join(' ')
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const baseY = pad + innerH
  const areaPath =
    type === 'area'
      ? `${linePath} L${round(last.x)},${round(baseY)} L${round(first.x)},${round(baseY)} Z`
      : ''
  return {
    ...base,
    linePath,
    areaPath,
    bars: [],
    lastPoint: cfg.lastPoint === false ? null : { x: last.x, y: last.y },
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
