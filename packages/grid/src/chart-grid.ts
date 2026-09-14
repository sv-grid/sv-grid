/**
 * Grid layouts: heatmap and the calendar heatmap.
 */
import type { ChartAxisTick, ChartCategoryTick, ChartCalendarCell, ChartHeatmapCell, ChartGeometry, LayoutCtx } from './chart-types'
import { round, formatChartValue, resolveColorScale, sampleGradient, pickContrastText, thinCategoryTicks } from './chart-scale'

// ---- Calendar heatmap --------------------------------------------
// GitHub-style year-of-days view: 7 rows (Sun..Sat) x N weeks. Each
// cell is a small square shaded by `calendarValues[i].value` via the
// sequential color scale. Days with no value render blank (border only)
// so missing data is visually obvious.
/** @internal Lay out the calendar family. Called by buildChart. */
export function layoutCalendar(ctx: LayoutCtx): ChartGeometry {
  const { spec, width, height, theme, empty, frame } = ctx
  const values = spec.calendarValues ?? []
  if (!values.length && !spec.calendarStart) return { ...empty }
  // Build a value lookup + figure out the date range.
  const valueByDate = new Map<string, number>()
  let vMin = Infinity, vMax = -Infinity
  for (const v of values) {
    valueByDate.set(v.date, v.value)
    if (Number.isFinite(v.value)) {
      if (v.value < vMin) vMin = v.value
      if (v.value > vMax) vMax = v.value
    }
  }
  if (vMin === Infinity) { vMin = 0; vMax = 1 }
  if (vMin === vMax) vMax = vMin + 1
  const stops = resolveColorScale(spec.colorScale, vMin, vMax, theme)
  const colorAt = (v: number) => sampleGradient(stops, (v - vMin) / (vMax - vMin))
  // Determine date range. If calendarStart/End set, use them, otherwise
  // span the data + round to whole weeks (Sun..Sat).
  const sorted = values.map((v) => v.date).sort()
  const startStr = spec.calendarStart ?? sorted[0] ?? '2026-01-01'
  const endStr   = spec.calendarEnd   ?? sorted[sorted.length - 1] ?? startStr
  const start = new Date(startStr + 'T00:00:00Z')
  const end   = new Date(endStr + 'T00:00:00Z')
  // Roll start back to its Sunday, end forward to its Saturday.
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()))
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const weeks = Math.ceil(totalDays / 7)
  const padL = 36, padR = 80, padT = 26 + frame.top, padB = 16 + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  // Cell size: fit weeks across width, 7 rows down height.
  const cellW = Math.floor(plotW / weeks)
  const cellH = Math.floor(plotH / 7)
  const cellSize = Math.max(6, Math.min(cellW, cellH))
  const plot = { x: padL, y: padT, w: cellSize * weeks, h: cellSize * 7 }
  const cells: ChartCalendarCell[] = []
  let lastMonth = -1
  const monthTicks: ChartCategoryTick[] = []
  for (let i = 0; i < totalDays; i += 1) {
    const day = new Date(start.getTime() + i * 86_400_000)
    const col = Math.floor(i / 7)
    const row = i % 7
    const date = day.toISOString().slice(0, 10)
    const has = valueByDate.has(date)
    const v = valueByDate.get(date) ?? 0
    cells.push({
      x: padL + col * cellSize,
      y: padT + row * cellSize,
      size: cellSize,
      date, value: v,
      defined: has,
      color: has ? colorAt(v) : 'transparent',
    })
    // A month label only for a month inside the range: the end is rolled
    // forward to its Saturday, and a December that ends on a Thursday used
    // to pick up a "Jan" for the two padding days of the next year.
    if (day.getUTCDate() === 1 && day.getUTCMonth() !== lastMonth && date >= startStr && date <= endStr) {
      lastMonth = day.getUTCMonth()
      monthTicks.push({
        label: day.toLocaleDateString(undefined, { month: 'short' }),
        x: padL + col * cellSize,
      })
    }
  }
  const legend = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4
    const value = legendValue(vMin, vMax, t)
    return { value, color: colorAt(value), label: formatChartValue(value, spec.valueFormat, spec) }
  })
  return {
    ...empty,
    plot,
    calendarCells: cells,
    calendarMonthTicks: monthTicks,
    calendarLegend: legend,
  }
}

// ---- Heatmap ------------------------------------------------------
// Each series is one row, series.values are the cells across categories.
// Color comes from a sequential/diverging/custom palette mapped to the
// global value range. Cell text contrasts black/white against the cell.
/**
 * A legend step between the extremes, rounded to the precision the range
 * earns: whole numbers when the steps are a unit or more apart, so a count
 * legend reads "20, 94, 167" rather than "20, 93.5, 167", and enough
 * decimals to tell the steps apart when they are not.
 */
function legendValue(vMin: number, vMax: number, t: number): number {
  const raw = vMin + (vMax - vMin) * t
  const step = Math.abs(vMax - vMin) / 4
  if (!(step > 0)) return raw
  const decimals = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)) + 1)
  return Number(raw.toFixed(decimals))
}

/** @internal Lay out the heatmap family. Called by buildChart. */
export function layoutHeatmap(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, width, height, theme, empty, frame } = ctx
  if (!series.length || !spec.categories.length) return { ...empty, plot: { x: 0, y: 0, w: width, h: height } }
  // Layout: left gutter for row labels, bottom for column labels.
  const maxRowLabel = series.reduce((m, s) => Math.max(m, s.label.length), 0)
  const padL = 12 + Math.min(180, Math.max(60, maxRowLabel * 7))
  const padR = 64   // room for the right-side legend bar
  const padT = 12 + frame.top
  const padB = 32 + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }
  const cellW = plotW / spec.categories.length
  const cellH = plotH / series.length
  // Resolve value range across the whole matrix.
  let vMin = Infinity, vMax = -Infinity
  for (const s of series) for (const v of s.values) {
    if (!Number.isFinite(v)) continue
    if (v < vMin) vMin = v
    if (v > vMax) vMax = v
  }
  if (vMin === Infinity) { vMin = 0; vMax = 1 }
  if (vMin === vMax) vMax = vMin + 1
  // Pick the palette stops.
  const stops = resolveColorScale(spec.colorScale, vMin, vMax, theme)
  const colorAt = (v: number) => sampleGradient(stops, (v - vMin) / (vMax - vMin))
  const heatmapCells: ChartHeatmapCell[] = []
  series.forEach((s, ri) => {
    s.values.forEach((v, ci) => {
      if (!Number.isFinite(v)) return
      const color = colorAt(v)
      heatmapCells.push({
        x: round(padL + cellW * ci),
        y: round(padT + cellH * ri),
        w: round(cellW),
        h: round(cellH),
        color,
        textColor: pickContrastText(color),
        value: v,
        rowLabel: s.label,
        colLabel: spec.categories[ci] ?? '',
      })
    })
  })
  const heatmapRowTicks: ChartAxisTick[] = series.map((s, i) => ({
    value: i,
    y: round(padT + cellH * i + cellH / 2),
    label: s.label,
  }))
  // Column labels thin out the way a bar chart's do: twenty-four hours at
  // 33px a cell wrote "00:0001:0002:00" across the foot of the matrix.
  const heatmapColTicks: ChartCategoryTick[] = thinCategoryTicks(spec.categories, (i) => round(padL + cellW * i + cellW / 2), cellW, false)
  // Legend: sample 5 stops across the range.
  const heatmapLegend = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4
    const value = legendValue(vMin, vMax, t)
    return { value, color: colorAt(value), label: formatChartValue(value, spec.valueFormat, spec) }
  })
  return {
    ...empty,
    plot,
    heatmapCells,
    heatmapRowTicks,
    heatmapColTicks,
    heatmapLegend,
  }
}
