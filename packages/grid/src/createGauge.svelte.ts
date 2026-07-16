/**
 * createGauge - the HEADLESS core behind <SvGauge>. A gauge is a display control,
 * so this core is light: value in, computed arc/needle geometry out, plus a
 * `rootProps()` with `role="meter"` + `aria-valuenow/min/max`. The styled
 * <SvGauge> (or your own SVG) reads the geometry and draws it.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createGauge } from '@svgrid/grid'
 *   const g = createGauge({ value: () => value })
 * </script>
 * <div {...g.rootProps()}>
 *   <svg viewBox={`0 0 ${g.cx * 2} ${g.cy * 2}`}>
 *     <path d={g.arcPath(0, g.clamped, g.r)} />
 *   </svg>
 * </div>
 * ```
 */
export type GaugePoint = { x: number; y: number }

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type GaugeConfig = {
  value: () => number
  min?: () => number
  max?: () => number
  /** Sweep angle in degrees (default 270, a classic dashboard gauge). */
  sweep?: () => number
  size?: () => number
  thickness?: () => number
  ariaLabel?: () => string | undefined
}

export function createGauge(config: GaugeConfig) {
  const min = () => config.min?.() ?? 0
  const max = () => config.max?.() ?? 100
  const sweep = () => config.sweep?.() ?? 270
  const size = () => config.size?.() ?? 180
  const thickness = () => config.thickness?.() ?? 14

  const clamped = $derived(Math.min(max(), Math.max(min(), config.value())))
  const startAngle = $derived(90 + (360 - sweep()) / 2) // symmetric around the bottom
  const cx = $derived(size() / 2)
  const cy = $derived(size() / 2)
  const r = $derived(size() / 2 - thickness() / 2 - 2)

  const frac = (v: number) => (v - min()) / (max() - min())
  const angleOf = (v: number) => startAngle + frac(v) * sweep()
  function polar(angleDeg: number, radius: number): GaugePoint {
    const a = (angleDeg * Math.PI) / 180
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
  }
  function arcPath(v0: number, v1: number, radius: number): string {
    const a0 = angleOf(v0)
    const a1 = angleOf(v1)
    const p0 = polar(a0, radius)
    const p1 = polar(a1, radius)
    const large = a1 - a0 > 180 ? 1 : 0
    return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`
  }
  const needleEnd = $derived(polar(angleOf(clamped), r - thickness() / 2))

  return {
    /** Value clamped into [min, max]. */
    get clamped() { return clamped },
    get startAngle() { return startAngle },
    get cx() { return cx },
    get cy() { return cy },
    get r() { return r },
    /** Needle tip point (for `<line x2 y2>`). */
    get needleEnd() { return needleEnd },
    frac,
    angleOf,
    polar,
    arcPath,
    /** Spread onto the gauge root element. */
    rootProps: () => ({
      role: 'meter' as const,
      'aria-valuenow': clamped,
      'aria-valuemin': min(),
      'aria-valuemax': max(),
      'aria-label': config.ariaLabel?.() ?? 'Gauge',
    }),
  }
}

export type Gauge = ReturnType<typeof createGauge>
