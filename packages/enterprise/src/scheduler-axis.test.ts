import { describe, expect, it } from 'vitest'
import { buildAxis, resolveZoom, timeToX, xToTime, zoomPresets } from './scheduler-axis'

const day = (d: number, h = 0) => new Date(2026, 0, d, h, 0, 0, 0)

describe('buildAxis - linear (no collapse)', () => {
  it('maps a full day linearly at pxPerMinute', () => {
    const axis = buildAxis(day(5), day(6), { pxPerMinute: 1 }) // 1px/min => 1440px
    expect(axis.totalPx).toBe(1440)
    expect(timeToX(day(5, 12), axis)).toBe(720) // noon = halfway
  })

  it('timeToX / xToTime round-trip within a working span', () => {
    const axis = buildAxis(day(5), day(6), { pxPerMinute: 1 })
    const t = day(5, 9)
    expect(xToTime(timeToX(t, axis), axis).getTime()).toBe(t.getTime())
  })
})

describe('buildAxis - business hours collapse', () => {
  it('collapses nights to a fixed gap so working hours dominate', () => {
    const axis = buildAxis(day(5), day(7), {
      pxPerMinute: 1,
      businessHours: { start: 9, end: 17 }, // 8h = 480px working
      collapseNonWorking: true,
      collapsedGapPx: 10,
    })
    const working = axis.segments.filter((s) => s.kind === 'working')
    const collapsed = axis.segments.filter((s) => s.kind === 'collapsed')
    expect(working).toHaveLength(2) // two work days
    expect(working[0]!.px).toBe(480)
    // Gaps: before day5 9am, night between, after day6 5pm - each a collapsed 10px.
    expect(collapsed.every((s) => s.px === 10)).toBe(true)
    expect(axis.totalPx).toBe(480 * 2 + 10 * collapsed.length)
  })

  it('omits gaps entirely when collapsedGapPx is 0', () => {
    const axis = buildAxis(day(5), day(6), {
      pxPerMinute: 1,
      businessHours: { start: 9, end: 17 },
      collapseNonWorking: true,
      collapsedGapPx: 0,
    })
    expect(axis.totalPx).toBe(480) // just the working span
  })
})

describe('buildAxis - weekend collapse', () => {
  it('collapses whole non-working days', () => {
    // Jan 2026: 3rd = Sat, 4th = Sun. Range Fri Jan 2 -> Mon Jan 5.
    const axis = buildAxis(day(2), day(5), {
      pxPerMinute: 1,
      nonWorkingDays: [0, 6],
      collapseWeekends: true,
      collapsedGapPx: 8,
    })
    const collapsed = axis.segments.filter((s) => s.kind === 'collapsed')
    // Sat + Sun are contiguous non-working, so they coalesce to ONE 8px gap.
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]!.px).toBe(8)
    expect(collapsed[0]!.start.getDate()).toBe(3) // Sat
    expect(collapsed[0]!.end.getDate()).toBe(5) // through to Mon 00:00
    // Fri (full day) + Mon-partial working stays full width.
    const working = axis.segments.filter((s) => s.kind === 'working')
    expect(working.reduce((sum, s) => sum + s.px, 0)).toBe(1440) // Fri = 1440px working (24h, no business hours)
  })
})

describe('buildAxis - piecewise mapping across a collapsed gap', () => {
  it('maps times on either side of a gap to the right x', () => {
    const axis = buildAxis(day(5), day(7), {
      pxPerMinute: 1,
      businessHours: { start: 9, end: 17 },
      collapseNonWorking: true,
      collapsedGapPx: 10,
    })
    // End of day 5 work (17:00) sits at leading-gap + 480 working px.
    const lead = axis.segments[0]!.px // leading collapsed gap (00:00-09:00)
    expect(timeToX(day(5, 17), axis)).toBe(lead + 480)
    // Start of day 6 work (09:00) sits one more gap past that.
    expect(timeToX(day(6, 9), axis)).toBe(lead + 480 + 10)
  })

  it('round-trips a working-time point through x and back', () => {
    const axis = buildAxis(day(5), day(7), {
      pxPerMinute: 1,
      businessHours: { start: 9, end: 17 },
      collapseNonWorking: true,
      collapsedGapPx: 10,
    })
    const t = day(6, 13)
    expect(xToTime(timeToX(t, axis), axis).getTime()).toBe(t.getTime())
  })
})

describe('resolveZoom', () => {
  it('passes a ZoomLevel through and computes pxPerMinute', () => {
    const level = zoomPresets.find((z) => z.id === 'hour')!
    const r = resolveZoom(level)
    expect(r.level.id).toBe('hour')
    expect(r.pxPerMinute).toBeCloseTo(level.pxPerTick / level.tickMinutes)
  })
  it('treats a number as a clamped ladder index', () => {
    expect(resolveZoom(0).level).toBe(zoomPresets[0])
    expect(resolveZoom(999).level).toBe(zoomPresets[zoomPresets.length - 1])
    expect(resolveZoom(-5).level).toBe(zoomPresets[0])
  })
})
