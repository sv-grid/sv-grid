import { describe, expect, it } from 'vitest'
import { criticalPath, slackDays } from './gantt-critical-path'
import { makeCalendar } from './gantt-model'
import type { SchedulerDependency } from '../scheduler-dependencies'
import type { EventTimes } from '../scheduler-dependencies'

const MS_DAY = 86_400_000
const day = (n: number) => new Date(2026, 8, n)
/** A task running `[from, from + days)`, in whole days. */
const span = (from: number, days: number): EventTimes => ({ start: day(from), end: day(from + days) })
const times = (rows: Record<string, EventTimes>) => new Map(Object.entries(rows))
const link = (id: string, from: string, to: string, extra: Partial<SchedulerDependency> = {}): SchedulerDependency =>
  ({ id, from, to, ...extra })

describe('criticalPath - a simple chain', () => {
  // a(2d) -> b(3d) -> c(1d), each starting the moment the last one ends.
  const t = times({ a: span(1, 2), b: span(3, 3), c: span(6, 1) })
  const deps = [link('1', 'a', 'b'), link('2', 'b', 'c')]

  it('puts the whole chain on the critical path', () => {
    const r = criticalPath(t, deps)
    expect([...r.critical].sort()).toEqual(['a', 'b', 'c'])
  })

  it('finishes when the last task does', () => {
    expect(criticalPath(t, deps).finish.getTime()).toBe(day(7).getTime())
  })

  it('gives every task on it zero slack', () => {
    const r = criticalPath(t, deps)
    for (const k of ['a', 'b', 'c']) expect(r.slackMs.get(k)).toBe(0)
  })
})

describe('criticalPath - a diamond', () => {
  // a -> b(5d) and a -> c(2d), both feeding d. The LONG branch is critical.
  const t = times({
    a: span(1, 1),
    b: span(2, 5),
    c: span(2, 2),
    d: span(7, 1),
  })
  const deps = [
    link('1', 'a', 'b'),
    link('2', 'a', 'c'),
    link('3', 'b', 'd'),
    link('4', 'c', 'd'),
  ]

  it('follows the longer branch', () => {
    const r = criticalPath(t, deps)
    expect(r.critical.has('b')).toBe(true)
    expect(r.critical.has('c')).toBe(false)
    expect([...r.critical].sort()).toEqual(['a', 'b', 'd'])
  })

  it('gives the short branch the slack the long one costs it', () => {
    // c is 2 days where b is 5, so c can slip 3 days and change nothing.
    expect(slackDays(criticalPath(t, deps), 'c')).toBe(3)
    expect(slackDays(criticalPath(t, deps), 'b')).toBe(0)
  })

  it('moves the path when a lag makes the short branch the long one', () => {
    // Four days of lag on a -> c turns the 2-day branch into the binding one.
    const withLag = [
      link('1', 'a', 'b'),
      link('2', 'a', 'c', { lag: 6 * 24 * 60 }),
      link('3', 'b', 'd'),
      link('4', 'c', 'd'),
    ]
    const r = criticalPath(t, withLag)
    expect(r.critical.has('c')).toBe(true)
    expect(r.critical.has('b')).toBe(false)
  })
})

describe('criticalPath - what is NOT on a path', () => {
  it('never marks an unlinked task critical, however late it runs', () => {
    // `solo` ends exactly when the project does, but depends on nothing and
    // nothing depends on it. Calling it critical would point at a task the
    // schedule does not actually turn on.
    const t = times({ a: span(1, 2), b: span(3, 2), solo: span(1, 4) })
    const r = criticalPath(t, [link('1', 'a', 'b')])
    expect(r.finish.getTime()).toBe(day(5).getTime())
    expect(r.critical.has('solo')).toBe(false)
    expect([...r.critical].sort()).toEqual(['a', 'b'])
  })

  it('still reports an unlinked task\'s room before the finish', () => {
    const t = times({ a: span(1, 2), b: span(3, 5), solo: span(1, 1) })
    const r = criticalPath(t, [link('1', 'a', 'b')])
    // The project runs to the 8th; solo ends on the 2nd, so it has room.
    expect(r.slackMs.get('solo')!).toBeGreaterThan(0)
  })

  it('ignores a cycle rather than looping or flagging it', () => {
    const t = times({ a: span(1, 2), b: span(3, 2) })
    const r = criticalPath(t, [link('1', 'a', 'b'), link('2', 'b', 'a')])
    expect(r.critical.size).toBe(0)
    expect(r.finish.getTime()).toBe(day(5).getTime())
  })

  it('skips a link whose end is not in the task map', () => {
    const t = times({ a: span(1, 2) })
    const r = criticalPath(t, [link('1', 'a', 'ghost')])
    expect(r.critical.has('a')).toBe(false)
    expect(r.slackMs.get('a')).toBe(0)
  })

  it('handles an empty plan', () => {
    const r = criticalPath(new Map(), [])
    expect(r.critical.size).toBe(0)
    expect(r.slackMs.size).toBe(0)
  })
})

describe('criticalPath - the link types', () => {
  it('reads a start-to-start link', () => {
    // b may not start before a does; both are 2 days and start together, so
    // neither has room.
    const t = times({ a: span(1, 2), b: span(1, 2) })
    const r = criticalPath(t, [link('1', 'a', 'b', { type: 'SS' })])
    expect(r.critical.has('a')).toBe(true)
    expect(r.critical.has('b')).toBe(true)
  })

  it('reads a finish-to-finish link', () => {
    // b may not finish before a does. a is short and ends early, so it can
    // slip right up to b's finish.
    const t = times({ a: span(1, 1), b: span(1, 4) })
    const r = criticalPath(t, [link('1', 'a', 'b', { type: 'FF' })])
    expect(r.critical.has('b')).toBe(true)
    expect(slackDays(r, 'a')).toBe(3)
  })

  it('reads a start-to-finish link', () => {
    // SF says the successor may not FINISH before the predecessor STARTS. `a`
    // starts on the 10th, so 3-day `b` cannot be earliest before the 7th,
    // however early its own dates put it.
    const t = times({ a: span(10, 2), b: span(1, 3) })
    const r = criticalPath(t, [link('1', 'a', 'b', { type: 'SF' })])
    expect(r.earliest.get('b')!.end.getTime()).toBe(day(10).getTime())
    expect(r.earliest.get('b')!.start.getTime()).toBe(day(7).getTime())
  })
})

describe('criticalPath - earliest and latest', () => {
  it('pushes a successor that starts too early to its earliest legal start', () => {
    // b overlaps a even though it waits on it. The forward pass reports where
    // b COULD be, which is after a finishes.
    const t = times({ a: span(1, 3), b: span(2, 2) })
    const r = criticalPath(t, [link('1', 'a', 'b')])
    expect(r.earliest.get('b')!.start.getTime()).toBe(day(4).getTime())
    expect(r.earliest.get('b')!.end.getTime()).toBe(day(6).getTime())
    expect(r.finish.getTime()).toBe(day(6).getTime())
  })

  it('keeps each task its own length through both passes', () => {
    const t = times({ a: span(1, 3), b: span(2, 2) })
    const r = criticalPath(t, [link('1', 'a', 'b')])
    for (const k of ['a', 'b']) {
      const e = r.earliest.get(k)!
      const l = r.latest.get(k)!
      expect(e.end.getTime() - e.start.getTime()).toBe(l.end.getTime() - l.start.getTime())
    }
  })

  it('never lets a latest finish exceed the project finish', () => {
    const t = times({ a: span(1, 2), b: span(3, 2), c: span(1, 1) })
    const r = criticalPath(t, [link('1', 'a', 'b')])
    for (const l of r.latest.values()) {
      expect(l.end.getTime()).toBeLessThanOrEqual(r.finish.getTime())
    }
  })
})

describe('criticalPath - in working time', () => {
  // September 2026: the 7th is a Monday. Weekends off.
  const cal = makeCalendar()

  it('calls a Friday-to-Monday handover critical, which calendar time does not', () => {
    // a runs Mon 7th to Fri 11th; b starts Mon 14th. The two days between
    // them are a weekend: a cannot slip a working day without moving b.
    const t = times({ a: span(7, 5), b: span(14, 2) })
    const deps = [link('1', 'a', 'b')]
    const calendar = criticalPath(t, deps)
    expect(calendar.critical.has('a')).toBe(false)
    expect(slackDays(calendar, 'a')).toBe(2)
    const working = criticalPath(t, deps, cal)
    expect(working.critical.has('a')).toBe(true)
    expect(slackDays(working, 'a')).toBe(0)
    expect(working.latest.get('a')!.start.getTime()).toBe(day(7).getTime())
  })

  it('reports slack in working days', () => {
    // a ends Friday the 11th; b starts Monday the 21st. In calendar time a
    // could start as late as Wednesday the 16th - nine days of room, two of
    // them a weekend a five-day task cannot use. In working time it could
    // start Monday the 14th: five working days.
    const t = times({ a: span(7, 5), b: span(21, 2) })
    const deps = [link('1', 'a', 'b')]
    expect(slackDays(criticalPath(t, deps), 'a')).toBe(9)
    const r = criticalPath(t, deps, cal)
    expect(slackDays(r, 'a')).toBe(5)
    expect(r.latest.get('a')!.start.getTime()).toBe(day(14).getTime())
  })

  it('keeps a task\'s working length when a link pushes its earliest start', () => {
    // b is five working days but starts too early; pushed to Monday the 14th
    // it still spans five working days, ending Saturday the 19th.
    const t = times({ a: span(7, 5), b: span(7, 5) })
    const r = criticalPath(t, [link('1', 'a', 'b')], cal)
    const b = r.earliest.get('b')!
    expect(b.start.getTime()).toBe(day(14).getTime())
    expect(b.end.getTime()).toBe(day(19).getTime())
  })

  it('lands a pushed start on a working day, like the cascade does', () => {
    // a ends Saturday the 12th 00:00 (a Friday finish); b, with a two-day
    // lag, would be required on Sunday - it starts Monday.
    const t = times({ a: span(7, 5), b: span(7, 1) })
    const r = criticalPath(t, [link('1', 'a', 'b', { lag: 1 * 1440 })], cal)
    expect(r.earliest.get('b')!.start.getTime()).toBe(day(14).getTime())
  })

  it('skips a holiday like a weekend', () => {
    // With Wednesday the 9th off, a five-day task from Monday runs to the
    // following Monday, and its Tuesday-starting successor is critical.
    const holiday = makeCalendar([0, 6], ['2026-09-09'])
    const t = times({ a: span(7, 8), b: span(15, 1) })
    const r = criticalPath(t, [link('1', 'a', 'b')], holiday)
    expect(r.critical.has('a')).toBe(true)
    expect(slackDays(r, 'a')).toBe(0)
  })
})

describe('slackDays', () => {
  it('rounds toward zero, so "2" means two whole days of room', () => {
    const t = times({ a: span(1, 1), b: span(1, 4) })
    const r = criticalPath(t, [link('1', 'a', 'b', { type: 'FF' })])
    expect(slackDays(r, 'a')).toBe(3)
    expect(r.slackMs.get('a')).toBe(3 * MS_DAY)
  })

  it('is zero for a key it has never seen', () => {
    expect(slackDays(criticalPath(new Map(), []), 'nope')).toBe(0)
  })
})
