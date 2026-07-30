import { describe, expect, it } from 'vitest'
import {
  resolveEvents,
  eventsOnDay,
  layoutDayEvents,
  agendaGroups,
  rangeForView,
  daysForView,
  navigateAnchor,
  type EventSpec,
} from './scheduler-model'
import type { RecurrenceRule } from './recurrence'

type Row = {
  id: string
  title: string
  start: string
  end?: string
  allDay?: boolean
  who?: string
  repeat?: RecurrenceRule | RecurrenceRule[]
}

function spec(over: Partial<EventSpec<Row>> = {}): EventSpec<Row> {
  return {
    getKey: (r) => r.id,
    getStart: (r) => r.start,
    getEnd: (r) => r.end,
    getAllDay: (r) => r.allDay ?? false,
    getTitle: (r) => r.title,
    getResource: (r) => r.who,
    getRecurrence: (r) => r.repeat,
    ...over,
  }
}

// A local-time date, kept explicit so tests don't depend on the wall clock.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

describe('resolveEvents', () => {
  it('keeps single events that overlap the window and drops those outside', () => {
    const rows: Row[] = [
      { id: 'a', title: 'In', start: '2026-07-15T09:00', end: '2026-07-15T10:00' },
      { id: 'b', title: 'Out', start: '2026-09-01T09:00', end: '2026-09-01T10:00' },
    ]
    const out = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    expect(out.map((e) => e.rowKey)).toEqual(['a'])
    expect(out[0]!.recurring).toBe(false)
  })

  it('falls back to a default duration when a row has no end', () => {
    const rows: Row[] = [{ id: 'a', title: 'x', start: '2026-07-15T09:00' }]
    const out = resolveEvents(rows, spec({ defaultDurationMin: 45 }), at(2026, 7, 1), at(2026, 8, 1))
    expect(out[0]!.end.getTime() - out[0]!.start.getTime()).toBe(45 * 60_000)
  })

  it('expands a weekly recurrence to one instance per matching day, keeping the time', () => {
    const rows: Row[] = [
      {
        id: 'standup',
        title: 'Standup',
        start: '2026-07-06T09:30',
        end: '2026-07-06T09:45',
        repeat: { freq: 'weekly', weekdays: [1] }, // Mondays
      },
    ]
    const out = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    // Mondays in July 2026: 6, 13, 20, 27
    expect(out).toHaveLength(4)
    expect(out.every((e) => e.recurring)).toBe(true)
    expect(out.every((e) => e.start.getHours() === 9 && e.start.getMinutes() === 30)).toBe(true)
    expect(out.every((e) => e.end.getTime() - e.start.getTime() === 15 * 60_000)).toBe(true)
    // Distinct instance keys.
    expect(new Set(out.map((e) => e.key)).size).toBe(4)
  })

  it('sorts all-day before timed at the same start', () => {
    const rows: Row[] = [
      { id: 'timed', title: 't', start: '2026-07-15T00:00', end: '2026-07-15T01:00' },
      { id: 'allday', title: 'a', start: '2026-07-15T00:00', allDay: true },
    ]
    const out = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    expect(out.map((e) => e.rowKey)).toEqual(['allday', 'timed'])
  })
})

describe('eventsOnDay', () => {
  it('includes an event that spans the day even if it starts earlier', () => {
    const rows: Row[] = [
      { id: 'multi', title: 'trip', start: '2026-07-14T20:00', end: '2026-07-16T08:00' },
    ]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    expect(eventsOnDay(evs, at(2026, 7, 15))).toHaveLength(1)
    expect(eventsOnDay(evs, at(2026, 7, 17))).toHaveLength(0)
  })
})

describe('layoutDayEvents', () => {
  it('places two overlapping events in two half-width columns', () => {
    const rows: Row[] = [
      { id: 'a', title: 'a', start: '2026-07-15T09:00', end: '2026-07-15T10:00' },
      { id: 'b', title: 'b', start: '2026-07-15T09:30', end: '2026-07-15T10:30' },
    ]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    const laid = layoutDayEvents(evs, at(2026, 7, 15), 0, 24)
    expect(laid).toHaveLength(2)
    expect(laid.every((p) => p.colCount === 2)).toBe(true)
    expect(new Set(laid.map((p) => p.col))).toEqual(new Set([0, 1]))
  })

  it('gives a non-overlapping event the full width', () => {
    const rows: Row[] = [
      { id: 'a', title: 'a', start: '2026-07-15T09:00', end: '2026-07-15T10:00' },
      { id: 'b', title: 'b', start: '2026-07-15T11:00', end: '2026-07-15T12:00' },
    ]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    const laid = layoutDayEvents(evs, at(2026, 7, 15), 0, 24)
    expect(laid.every((p) => p.colCount === 1)).toBe(true)
  })

  it('positions events as a percentage of the visible band', () => {
    const rows: Row[] = [{ id: 'a', title: 'a', start: '2026-07-15T12:00', end: '2026-07-15T13:00' }]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    const p = layoutDayEvents(evs, at(2026, 7, 15), 8, 20)[0]! // 12h band, noon is 4h in
    expect(p.topPct).toBeCloseTo((4 / 12) * 100)
    expect(p.heightPct).toBeCloseTo((1 / 12) * 100)
  })

  it('ignores all-day events', () => {
    const rows: Row[] = [{ id: 'a', title: 'a', start: '2026-07-15T00:00', allDay: true }]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    expect(layoutDayEvents(evs, at(2026, 7, 15), 0, 24)).toHaveLength(0)
  })
})

describe('agendaGroups', () => {
  it('buckets events by day in chronological order', () => {
    const rows: Row[] = [
      { id: 'a', title: 'a', start: '2026-07-16T09:00', end: '2026-07-16T10:00' },
      { id: 'b', title: 'b', start: '2026-07-15T14:00', end: '2026-07-15T15:00' },
      { id: 'c', title: 'c', start: '2026-07-15T09:00', end: '2026-07-15T10:00' },
    ]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    const groups = agendaGroups(evs)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.events.map((e) => e.rowKey)).toEqual(['c', 'b'])
    expect(groups[1]!.events.map((e) => e.rowKey)).toEqual(['a'])
  })
})

describe('rangeForView / daysForView / navigateAnchor', () => {
  it('month range is a fixed 6-week grid aligned to the week start', () => {
    const { start, end } = rangeForView('month', at(2026, 7, 15), 1) // Monday start
    expect(start.getDay()).toBe(1)
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(42)
  })

  it('week view yields 7 days from the week start', () => {
    const days = daysForView('week', at(2026, 7, 15), 0)
    expect(days).toHaveLength(7)
    expect(days[0]!.getDay()).toBe(0)
  })

  it('day view yields just the anchor day', () => {
    const days = daysForView('day', at(2026, 7, 15))
    expect(days).toHaveLength(1)
    expect(days[0]!.getDate()).toBe(15)
  })

  it('navigates by month / week / day', () => {
    expect(navigateAnchor('month', at(2026, 7, 15), 1).getMonth()).toBe(7) // August
    expect(navigateAnchor('week', at(2026, 7, 15), -1).getDate()).toBe(8)
    expect(navigateAnchor('day', at(2026, 7, 15), 1).getDate()).toBe(16)
  })
})
