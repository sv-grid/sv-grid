import { describe, expect, it } from 'vitest'
import {
  resolveEvents,
  hasConflict,
  overlapCount,
  overlapsBands,
  workingIntervals,
  withinWorking,
  eventsOnDay,
  layoutDayEvents,
  monthWeekSegments,
  agendaGroups,
  rangeForView,
  daysForView,
  navigateAnchor,
  timelineAxis,
  timelineGeom,
  timelineRows,
  wallMinutes,
  atWallMinute,
  type EventSpec,
  type ResolvedEvent,
  type RecurrenceException,
} from './scheduler-model'
import type { RecurrenceRule } from './recurrence'
import type { SchedulerResource } from './SvGrid.types'

type Row = {
  id: string
  title: string
  start: string
  end?: string
  allDay?: boolean
  who?: string
  repeat?: RecurrenceRule | RecurrenceRule[]
  exceptions?: RecurrenceException[]
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
    getExceptions: (r) => r.exceptions,
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

  it('does not emit recurring occurrences before the event start date', () => {
    // 2026-07-15 is a Wednesday; the rule matches Mon-Fri, but the event only
    // begins on the 15th, so Mon 13 / Tue 14 must NOT appear.
    const rows: Row[] = [
      {
        id: 'e',
        title: 'Sync',
        start: '2026-07-15T10:00',
        end: '2026-07-15T10:30',
        repeat: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] },
      },
    ]
    const out = resolveEvents(rows, spec(), at(2026, 7, 13), at(2026, 7, 20))
    expect(out.map((e) => e.start.getDate()).sort((a, b) => a - b)).toEqual([15, 16, 17])
  })

  it('carries a secondary color (left-strip accent) when the spec provides one', () => {
    const rows: Row[] = [{ id: 'a', title: 'Shift', start: '2026-07-15T09:00', end: '2026-07-15T12:00' }]
    const out = resolveEvents(
      rows,
      spec({ getColor: () => '#111', getSecondaryColor: () => '#f80' }),
      at(2026, 7, 1),
      at(2026, 8, 1),
    )
    expect(out[0]!.color).toBe('#111')
    expect(out[0]!.color2).toBe('#f80')
  })

  const weekly: Row = {
    id: 'standup',
    title: 'Standup',
    start: '2026-07-06T09:30',
    end: '2026-07-06T09:45',
    repeat: { freq: 'weekly', weekdays: [1] }, // Mondays: 6, 13, 20, 27
  }

  it('skips a deleted recurrence occurrence', () => {
    const rows: Row[] = [{ ...weekly, exceptions: [{ occurrenceStart: '2026-07-13T09:30', deleted: true }] }]
    const out = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    expect(out.map((e) => e.start.getDate())).toEqual([6, 20, 27]) // 13 removed
  })

  it('applies a per-occurrence override (moved time + retitled) to one instance only', () => {
    const rows: Row[] = [
      { ...weekly, exceptions: [{ occurrenceStart: '2026-07-13T09:30', start: '2026-07-13T14:00', end: '2026-07-13T15:00', title: 'Moved' }] },
    ]
    const out = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    expect(out).toHaveLength(4)
    const moved = out.find((e) => e.start.getDate() === 13)!
    expect(moved.start.getHours()).toBe(14)
    expect(moved.end.getHours()).toBe(15)
    expect(moved.title).toBe('Moved')
    expect(moved.isException).toBe(true)
    // Its identity is keyed on the CANONICAL 09:30 start, not the moved time.
    expect(moved.occurrenceStart!.getHours()).toBe(9)
    expect(moved.occurrenceStart!.getMinutes()).toBe(30)
    // Untouched siblings keep the base time + title and are not exceptions.
    const other = out.find((e) => e.start.getDate() === 20)!
    expect(other.start.getHours()).toBe(9)
    expect(other.title).toBe('Standup')
    expect(other.isException).toBeFalsy()
  })

  it('applies per-occurrence `fields` overrides to one instance (merged row + resource)', () => {
    const rows: Row[] = [
      { ...weekly, who: 'room1', exceptions: [{ occurrenceStart: '2026-07-13T09:30', fields: { who: 'room9', title: 'Standup (offsite)' } }] },
    ]
    const out = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    const overridden = out.find((e) => e.start.getDate() === 13)!
    expect(overridden.resourceId).toBe('room9') // re-derived from the merged row
    expect((overridden.row as Row).who).toBe('room9') // the instance row carries the override
    expect(overridden.title).toBe('Standup (offsite)') // title from fields when not set explicitly
    expect(overridden.isException).toBe(true)
    // Siblings keep the base resource + row.
    const sibling = out.find((e) => e.start.getDate() === 20)!
    expect(sibling.resourceId).toBe('room1')
    expect((sibling.row as Row).who).toBe('room1')
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

describe('hasConflict', () => {
  const rows: Row[] = [
    { id: 'a', title: 'A', start: '2026-07-15T09:00', end: '2026-07-15T10:00', who: 'room1' },
    { id: 'b', title: 'B', start: '2026-07-15T11:00', end: '2026-07-15T12:00', who: 'room2' },
  ]
  const events = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))

  it('detects an overlap on the same resource', () => {
    expect(hasConflict(at(2026, 7, 15, 9, 30), at(2026, 7, 15, 10, 30), 'room1', events)).toBe(true)
  })
  it('ignores overlaps on a different resource', () => {
    expect(hasConflict(at(2026, 7, 15, 9, 30), at(2026, 7, 15, 10, 30), 'room2', events)).toBe(false)
  })
  it('ignores the event being moved (excludeRowKey)', () => {
    expect(hasConflict(at(2026, 7, 15, 9, 0), at(2026, 7, 15, 10, 0), 'room1', events, 'a')).toBe(false)
  })
  it('is false when there is a clear gap', () => {
    expect(hasConflict(at(2026, 7, 15, 10, 0), at(2026, 7, 15, 11, 0), 'room1', events)).toBe(false)
  })
})

describe('overlapCount (capacity)', () => {
  const rows: Row[] = [
    { id: 'a', title: 'A', start: '2026-07-15T09:00', end: '2026-07-15T10:00', who: 'room1' },
    { id: 'b', title: 'B', start: '2026-07-15T09:30', end: '2026-07-15T10:30', who: 'room1' },
    { id: 'c', title: 'C', start: '2026-07-15T09:15', end: '2026-07-15T09:45', who: 'room2' },
  ]
  const events = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
  it('counts overlapping events on the same resource', () => {
    expect(overlapCount(at(2026, 7, 15, 9, 20), at(2026, 7, 15, 9, 40), 'room1', events)).toBe(2)
  })
  it('excludes the moved event and other resources', () => {
    expect(overlapCount(at(2026, 7, 15, 9, 20), at(2026, 7, 15, 9, 40), 'room1', events, 'a')).toBe(1)
    expect(overlapCount(at(2026, 7, 15, 9, 20), at(2026, 7, 15, 9, 40), 'room2', events)).toBe(1)
  })
})

describe('overlapsBands (restricted hours)', () => {
  const lunch = [{ start: 12, end: 13 }]
  it('is true when the range overlaps a band', () => {
    expect(overlapsBands(12 * 60 + 30, 13 * 60 + 30, lunch)).toBe(true)
    expect(overlapsBands(11 * 60, 12 * 60 + 15, lunch)).toBe(true)
  })
  it('is false when the range is clear of every band', () => {
    expect(overlapsBands(13 * 60, 14 * 60, lunch)).toBe(false)
    expect(overlapsBands(10 * 60, 12 * 60, lunch)).toBe(false) // ends exactly at 12
  })
})

describe('workingIntervals / withinWorking (per-resource availability)', () => {
  const win = [
    { days: [1, 3, 5], start: 9, end: 13 }, // Mon/Wed/Fri morning
    { days: [2, 4], start: 14, end: 18 }, // Tue/Thu afternoon
  ]
  const band = [0, 24 * 60] as const

  it('returns the matching window for a weekday (in minutes)', () => {
    expect(workingIntervals(1, win, band[0], band[1])).toEqual([[540, 780]]) // Mon 9-13
    expect(workingIntervals(2, win, band[0], band[1])).toEqual([[840, 1080]]) // Tue 14-18
  })
  it('is empty for a day with no matching window (day off)', () => {
    expect(workingIntervals(0, win, band[0], band[1])).toEqual([]) // Sunday off
  })
  it('clamps to the visible band and merges overlapping windows', () => {
    const w = [{ start: 6, end: 12 }, { start: 11, end: 20 }]
    expect(workingIntervals(1, w, 8 * 60, 18 * 60)).toEqual([[480, 1080]]) // merged 8-18
  })
  it('withinWorking is true only when the slot fits inside a window', () => {
    const iv = workingIntervals(1, win, band[0], band[1]) // [[540,780]]
    expect(withinWorking(600, 660, iv)).toBe(true) // 10-11 inside 9-13
    expect(withinWorking(780, 840, iv)).toBe(false) // 13-14 outside
    expect(withinWorking(720, 840, iv)).toBe(false) // 12-14 crosses the edge
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

// N overlapping events, all starting at 09:00 for `hours` hours.
function pileUp(n: number, hours = 1): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    title: `e${i}`,
    start: '2026-07-15T09:00',
    end: `2026-07-15T${String(9 + hours).padStart(2, '0')}:00`,
  }))
}

describe('layoutDayEvents (split, default)', () => {
  it('places two overlapping events in two half-width columns', () => {
    const rows: Row[] = [
      { id: 'a', title: 'a', start: '2026-07-15T09:00', end: '2026-07-15T10:00' },
      { id: 'b', title: 'b', start: '2026-07-15T09:30', end: '2026-07-15T10:30' },
    ]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events, overflows } = layoutDayEvents(evs, at(2026, 7, 15))
    expect(events).toHaveLength(2)
    expect(overflows).toHaveLength(0)
    expect(events.every((p) => p.colCount === 2)).toBe(true)
    expect(new Set(events.map((p) => p.col))).toEqual(new Set([0, 1]))
    expect(events.every((p) => Math.abs(p.widthPct - 50) < 0.01)).toBe(true)
    expect(new Set(events.map((p) => p.leftPct))).toEqual(new Set([0, 50]))
  })

  it('gives a non-overlapping event the full width', () => {
    const rows: Row[] = [
      { id: 'a', title: 'a', start: '2026-07-15T09:00', end: '2026-07-15T10:00' },
      { id: 'b', title: 'b', start: '2026-07-15T11:00', end: '2026-07-15T12:00' },
    ]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events } = layoutDayEvents(evs, at(2026, 7, 15))
    expect(events.every((p) => p.colCount === 1 && p.widthPct === 100)).toBe(true)
  })

  it('expands an event into adjacent columns that are free during its span', () => {
    // a + b (both 10-11) occupy col0/col1; c (10:30-12:30) is forced to col2 =>
    // 3-col cluster. d starts 11:30 after a/b end, takes col0, and must WIDEN
    // across the now-free col1 up to col2 (c overlaps) => 2/3 width, not 1/3.
    const rows: Row[] = [
      { id: 'a', title: 'a', start: '2026-07-15T10:00', end: '2026-07-15T11:00' },
      { id: 'b', title: 'b', start: '2026-07-15T10:00', end: '2026-07-15T11:00' },
      { id: 'c', title: 'c', start: '2026-07-15T10:30', end: '2026-07-15T12:30' },
      { id: 'd', title: 'd', start: '2026-07-15T11:30', end: '2026-07-15T12:30' },
    ]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events } = layoutDayEvents(evs, at(2026, 7, 15))
    const byId = new Map(events.map((p) => [p.event.rowKey, p]))
    expect(byId.get('d')!.colCount).toBe(3)
    expect(byId.get('d')!.col).toBe(0)
    // d widens across the free col1, stopping before c (col2): ~2/3 of the width.
    expect(byId.get('d')!.widthPct).toBeCloseTo((2 / 3) * 100, 1)
    // a still overlaps b so it stays a single column wide (1/3).
    expect(byId.get('a')!.widthPct).toBeCloseTo((1 / 3) * 100, 1)
  })

  it('positions events as a percentage of the visible band', () => {
    const rows: Row[] = [{ id: 'a', title: 'a', start: '2026-07-15T12:00', end: '2026-07-15T13:00' }]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    const p = layoutDayEvents(evs, at(2026, 7, 15), { dayStartHour: 8, dayEndHour: 20 }).events[0]!
    expect(p.topPct).toBeCloseTo((4 / 12) * 100)
    expect(p.heightPct).toBeCloseTo((1 / 12) * 100)
  })

  it('ignores all-day events', () => {
    const rows: Row[] = [{ id: 'a', title: 'a', start: '2026-07-15T00:00', allDay: true }]
    const evs = resolveEvents(rows, spec(), at(2026, 7, 15), at(2026, 7, 16))
    expect(layoutDayEvents(evs, at(2026, 7, 15)).events).toHaveLength(0)
  })

  it('splits N-way with no cap', () => {
    const evs = resolveEvents(pileUp(8), spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events, overflows } = layoutDayEvents(evs, at(2026, 7, 15))
    expect(events).toHaveLength(8)
    expect(overflows).toHaveLength(0)
    expect(events.every((p) => p.colCount === 8 && Math.abs(p.widthPct - 12.5) < 0.01)).toBe(true)
  })
})

describe('layoutDayEvents (cap)', () => {
  it('keeps clusters that fit within maxColumns fully visible', () => {
    const evs = resolveEvents(pileUp(3), spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events, overflows } = layoutDayEvents(evs, at(2026, 7, 15), { mode: 'cap', maxColumns: 3 })
    expect(events).toHaveLength(3)
    expect(overflows).toHaveLength(0)
  })

  it('shows maxColumns-1 events + one "+N more" overflow tile', () => {
    const evs = resolveEvents(pileUp(6), spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events, overflows } = layoutDayEvents(evs, at(2026, 7, 15), { mode: 'cap', maxColumns: 3 })
    // 3 columns -> 2 real + 1 overflow slot; 6 events => 2 shown, 4 hidden.
    expect(events).toHaveLength(2)
    expect(overflows).toHaveLength(1)
    expect(overflows[0]!.count).toBe(4)
    expect(overflows[0]!.events).toHaveLength(4)
    // Overflow tile sits in the last of the 3 columns.
    expect(overflows[0]!.leftPct).toBeCloseTo((2 / 3) * 100)
    expect(overflows[0]!.widthPct).toBeCloseTo(100 / 3)
  })

  it('clamps maxColumns to a minimum of 2', () => {
    const evs = resolveEvents(pileUp(5), spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events, overflows } = layoutDayEvents(evs, at(2026, 7, 15), { mode: 'cap', maxColumns: 1 })
    expect(events).toHaveLength(1) // maxColumns floored to 2 -> 1 real + overflow
    expect(overflows[0]!.count).toBe(4)
  })
})

describe('layoutDayEvents (stack)', () => {
  it('offsets overlapping events instead of shrinking them, with rising z-index', () => {
    const evs = resolveEvents(pileUp(3), spec(), at(2026, 7, 15), at(2026, 7, 16))
    const { events, overflows } = layoutDayEvents(evs, at(2026, 7, 15), {
      mode: 'stack',
      stackOffsetPct: 14,
    })
    expect(events).toHaveLength(3)
    expect(overflows).toHaveLength(0)
    const byCol = [...events].sort((a, b) => a.col - b.col)
    expect(byCol.map((p) => p.leftPct)).toEqual([0, 14, 28])
    expect(byCol.map((p) => p.zIndex)).toEqual([1, 2, 3])
    // Earliest column is widest; later ones are offset but still wide.
    expect(byCol[0]!.widthPct).toBe(100)
    expect(byCol[2]!.widthPct).toBe(72)
  })
})

describe('monthWeekSegments (spanning bars)', () => {
  const weekStart = at(2026, 7, 13) // Monday (Mon13..Sun19)
  function segsFor(rows: Row[]) {
    const evs = resolveEvents(rows, spec(), at(2026, 7, 1), at(2026, 8, 1))
    return monthWeekSegments(evs, weekStart)
  }

  it('a single-day event is a 1-column segment in lane 0', () => {
    const { segments, laneCount } = segsFor([{ id: 'a', title: 'a', start: '2026-07-14T10:00', end: '2026-07-14T11:00' }])
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ startCol: 1, endCol: 1, lane: 0, continuesLeft: false, continuesRight: false })
    expect(laneCount).toBe(1)
  })

  it('a multi-day event spans multiple columns as one segment', () => {
    const { segments } = segsFor([{ id: 'a', title: 'a', start: '2026-07-14T09:00', end: '2026-07-16T17:00' }])
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ startCol: 1, endCol: 3 })
  })

  it('an event crossing the week boundary is clipped + flagged continuesRight', () => {
    const { segments } = segsFor([{ id: 'a', title: 'a', start: '2026-07-18T20:00', end: '2026-07-20T08:00' }])
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ startCol: 5, endCol: 6, continuesRight: true, continuesLeft: false })
  })

  it('an event starting before the week is clipped + flagged continuesLeft', () => {
    const { segments } = segsFor([{ id: 'a', title: 'a', start: '2026-07-11T09:00', end: '2026-07-14T17:00' }])
    expect(segments[0]).toMatchObject({ startCol: 0, endCol: 1, continuesLeft: true })
  })

  it('an end at exact midnight does not spill onto the next day', () => {
    const { segments } = segsFor([{ id: 'a', title: 'a', start: '2026-07-14T09:00', end: '2026-07-15T00:00' }])
    expect(segments[0]).toMatchObject({ startCol: 1, endCol: 1 })
  })

  it('overlapping events stack into separate lanes', () => {
    const { segments, laneCount } = segsFor([
      { id: 'a', title: 'a', start: '2026-07-14T09:00', end: '2026-07-16T17:00' },
      { id: 'b', title: 'b', start: '2026-07-15T09:00', end: '2026-07-17T17:00' },
    ])
    expect(laneCount).toBe(2)
    expect(new Set(segments.map((s) => s.lane))).toEqual(new Set([0, 1]))
  })

  it('non-overlapping events reuse lane 0', () => {
    const { segments, laneCount } = segsFor([
      { id: 'a', title: 'a', start: '2026-07-13T09:00', end: '2026-07-13T17:00' },
      { id: 'b', title: 'b', start: '2026-07-16T09:00', end: '2026-07-16T17:00' },
    ])
    expect(laneCount).toBe(1)
    expect(segments.every((s) => s.lane === 0)).toBe(true)
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

describe('timeline model', () => {
  const R: SchedulerResource[] = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ]
  const ev = (id: string, start: Date, end: Date, resourceId?: string): ResolvedEvent =>
    ({ key: id, rowKey: id, row: {}, title: id, start, end, allDay: false, resourceId, recurring: false })

  it('rangeForView / navigateAnchor cover the timeline views', () => {
    expect(rangeForView('timelineDay', at(2026, 7, 15)).start.getDate()).toBe(15)
    expect(rangeForView('timelineWeek', at(2026, 7, 15), 0).start.getDay()).toBe(0)
    const mo = rangeForView('timelineMonth', at(2026, 7, 15))
    expect(mo.start.getDate()).toBe(1)
    expect(mo.end.getMonth()).toBe(7) // exclusive next month (Aug)
    const yr = rangeForView('timelineYear', at(2026, 7, 15))
    expect(yr.start.getMonth()).toBe(0)
    expect(yr.end.getFullYear()).toBe(2027)
    expect(navigateAnchor('timelineMonth', at(2026, 7, 15), 1).getMonth()).toBe(7)
    expect(navigateAnchor('timelineYear', at(2026, 7, 15), -1).getFullYear()).toBe(2025)
  })

  it('timelineAxis: day ticks respect the band, week=7 days, year=12 months', () => {
    const day = timelineAxis('timelineDay', at(2026, 7, 15), at(2026, 7, 16), { dayStartHour: 8, dayEndHour: 18 })
    expect(day.ticks).toHaveLength(10) // 08..17
    expect(day.start.getHours()).toBe(8)
    expect(day.ticks[0]!.leftPct).toBeCloseTo(0)
    const week = timelineAxis('timelineWeek', at(2026, 7, 6), at(2026, 7, 13))
    expect(week.ticks).toHaveLength(7)
    const month = timelineAxis('timelineMonth', at(2026, 7, 1), at(2026, 8, 1))
    expect(month.ticks).toHaveLength(31)
    const year = timelineAxis('timelineYear', at(2026, 1, 1), at(2027, 1, 1))
    expect(year.ticks).toHaveLength(12)
    expect(year.majors).toHaveLength(4) // quarters
  })

  it('timelineGeom clamps to the axis window + flags clipped edges', () => {
    const axisStart = at(2026, 7, 6)
    const axisMs = 7 * 86_400_000
    // fully inside: day 2 of 7, 1-day event
    const g = timelineGeom(at(2026, 7, 8), at(2026, 7, 9), axisStart, axisMs)!
    expect(g.leftPct).toBeCloseTo((2 / 7) * 100)
    expect(g.widthPct).toBeCloseTo((1 / 7) * 100)
    expect(g.continuesLeft).toBe(false)
    // starts before the window -> clipped left
    const g2 = timelineGeom(at(2026, 7, 4), at(2026, 7, 7), axisStart, axisMs)!
    expect(g2.leftPct).toBeCloseTo(0)
    expect(g2.continuesLeft).toBe(true)
    // entirely outside
    expect(timelineGeom(at(2026, 8, 1), at(2026, 8, 2), axisStart, axisMs)).toBeNull()
  })

  it('timelineRows: buckets by resource + lane-packs overlaps', () => {
    const events = [
      ev('1', at(2026, 7, 6, 9), at(2026, 7, 6, 11), 'a'),
      ev('2', at(2026, 7, 6, 10), at(2026, 7, 6, 12), 'a'), // overlaps #1 -> lane 1
      ev('3', at(2026, 7, 6, 13), at(2026, 7, 6, 14), 'a'), // after #1 -> lane 0
      ev('4', at(2026, 7, 6, 9), at(2026, 7, 6, 10), 'b'),
    ]
    const rows = timelineRows(R, events)
    expect(rows).toHaveLength(2)
    const a = rows[0]!
    expect(a.laneCount).toBe(2)
    expect(a.items.find((i) => i.event.key === '2')!.lane).toBe(1)
    expect(a.items.find((i) => i.event.key === '3')!.lane).toBe(0)
    expect(rows[1]!.items).toHaveLength(1)
  })

  it('timelineRows: a single null row when there are no resources', () => {
    const rows = timelineRows(null, [ev('1', at(2026, 7, 6, 9), at(2026, 7, 6, 10))])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.resource).toBeNull()
    expect(rows[0]!.items).toHaveLength(1)
  })
})

// A day the clocks change has 23 or 25 hours. The time grid labels its rows by
// the wall clock (8am is the ninth row on every day), so events must be placed
// by the wall clock too: counting real minutes since midnight drew every event
// of a fall-back day an hour late, and of a spring-forward day an hour early.
describe('on a day the clocks change', () => {
  function inZone<T>(tz: string, fn: () => T): T {
    const prev = process.env.TZ
    process.env.TZ = tz
    try {
      return fn()
    } finally {
      if (prev === undefined) delete process.env.TZ
      else process.env.TZ = prev
    }
  }
  const ev = (id: string, start: Date, end: Date): ResolvedEvent =>
    ({ key: id, rowKey: id, row: {}, title: id, start, end, allDay: false, recurring: false })
  const pctOfMin = (min: number, from = 0, to = 24) => ((min - from * 60) / ((to - from) * 60)) * 100

  // [zone, year, month, day, hours in that day]
  const days: Array<[string, number, number, number, number]> = [
    ['America/New_York', 2026, 11, 1, 25],
    ['America/New_York', 2026, 3, 8, 23],
    ['Europe/Helsinki', 2026, 10, 25, 25],
    ['Europe/Helsinki', 2026, 3, 29, 23],
  ]

  for (const [tz, y, m, d, hours] of days) {
    it(`${tz} ${y}-${m}-${d} (${hours} hours): events sit at their wall-clock rows`, () => {
      inZone(tz, () => {
        expect((at(y, m, d + 1).getTime() - at(y, m, d).getTime()) / 3_600_000).toBe(hours)
        const evs = [
          ev('a', at(y, m, d, 8), at(y, m, d, 8, 45)),
          ev('b', at(y, m, d, 19), at(y, m, d, 20)),
          ev('late', at(y, m, d, 23), at(y, m, d + 1)),
        ]
        const all = layoutDayEvents(evs, at(y, m, d)).events
        const a = all.find((p) => p.event.key === 'a')!
        expect(a.topPct).toBeCloseTo(pctOfMin(8 * 60))
        expect(a.heightPct).toBeCloseTo(pctOfMin(45))
        // An event that ends at midnight fills the last row, not past it.
        const late = all.find((p) => p.event.key === 'late')!
        expect(late.topPct).toBeCloseTo(pctOfMin(23 * 60))
        expect(late.topPct + late.heightPct).toBeCloseTo(100)
        // A 7am-8pm band: the 7pm event is inside it and sits on its 7pm row.
        const band = layoutDayEvents(evs, at(y, m, d), { dayStartHour: 7, dayEndHour: 20 }).events
        const b = band.find((p) => p.event.key === 'b')
        expect(b).toBeDefined()
        expect(b!.topPct).toBeCloseTo(pctOfMin(19 * 60, 7, 20))
        expect(b!.heightPct).toBeCloseTo((60 / (13 * 60)) * 100)
      })
    })

    it(`${tz} ${y}-${m}-${d}: an event across the change runs from its start row to its end row`, () => {
      inZone(tz, () => {
        // 0:30 to 5:00 by the clock, whatever the real length.
        const p = layoutDayEvents([ev('x', at(y, m, d, 0, 30), at(y, m, d, 5))], at(y, m, d)).events[0]!
        expect(p.topPct).toBeCloseTo(pctOfMin(30))
        expect(p.heightPct).toBeCloseTo(pctOfMin(270))
      })
    })

    it(`${tz} ${y}-${m}-${d}: the day before and the day after are untouched`, () => {
      inZone(tz, () => {
        for (const dd of [d - 1, d + 1]) {
          const p = layoutDayEvents([ev('a', at(y, m, dd, 8), at(y, m, dd, 9))], at(y, m, dd)).events[0]!
          expect(p.topPct).toBeCloseTo(pctOfMin(8 * 60))
          expect(p.heightPct).toBeCloseTo(pctOfMin(60))
        }
      })
    })
  }

  it('wallMinutes and atWallMinute count the clock, not real minutes', () => {
    inZone('America/New_York', () => {
      const day = at(2026, 11, 1)
      expect(wallMinutes(at(2026, 11, 1, 9), day)).toBe(540)
      expect(wallMinutes(at(2026, 11, 2), day)).toBe(1440)
      expect(wallMinutes(at(2026, 10, 31, 23), day)).toBe(-60)
      expect(atWallMinute(day, 540).getHours()).toBe(9)
      expect(atWallMinute(day, 1440).getTime()).toBe(at(2026, 11, 2).getTime())
      const spring = at(2026, 3, 8)
      expect(atWallMinute(spring, 8 * 60 + 15).getHours()).toBe(8)
      expect(atWallMinute(spring, 8 * 60 + 15).getMinutes()).toBe(15)
      expect(wallMinutes(at(2026, 3, 8, 8, 15), spring)).toBe(495)
    })
  })

  it('month bars: a week that starts on a 23-hour Sunday keeps Monday in its own column', () => {
    inZone('America/New_York', () => {
      // Sunday-first week of Mar 8 2026; Mar 8 has 23 hours.
      const segs = monthWeekSegments(
        [ev('mon', at(2026, 3, 9, 10), at(2026, 3, 9, 11)), ev('sat', at(2026, 3, 14, 10), at(2026, 3, 14, 11))],
        at(2026, 3, 8),
      ).segments
      expect(segs.find((s) => s.event.key === 'mon')).toMatchObject({ startCol: 1, endCol: 1 })
      expect(segs.find((s) => s.event.key === 'sat')).toMatchObject({ startCol: 6, endCol: 6 })
    })
    inZone('Europe/Helsinki', () => {
      // Twin: a Sunday-first week whose Sunday is a 25-hour day.
      const segs = monthWeekSegments([ev('sat', at(2026, 10, 31, 10), at(2026, 10, 31, 11))], at(2026, 10, 25)).segments
      expect(segs[0]).toMatchObject({ startCol: 6, endCol: 6 })
    })
  })

  for (const [tz, y, m, d, hours] of days) {
    it(`timeline day ${tz} ${y}-${m}-${d}: one tick per real hour, each labelled by its clock`, () => {
      inZone(tz, () => {
        const ax = timelineAxis('timelineDay', at(y, m, d), at(y, m, d + 1))
        expect(ax.ticks).toHaveLength(hours)
        expect(ax.end.getTime()).toBe(at(y, m, d + 1).getTime())
        // Ticks tile the axis with no gap or overlap.
        for (let i = 1; i < ax.ticks.length; i++) {
          expect(ax.ticks[i]!.start.getTime()).toBe(ax.ticks[i - 1]!.end.getTime())
        }
        // The 8am tick starts at 8am, and an 8am event sits on it.
        const t8 = ax.ticks.find((t) => t.start.getHours() === 8 && t.start.getMinutes() === 0)!
        expect(t8.label).toBe('8 AM')
        const g = timelineGeom(at(y, m, d, 8), at(y, m, d, 9), ax.start, ax.totalMs)!
        expect(g.leftPct).toBeCloseTo(t8.leftPct)
        expect(g.widthPct).toBeCloseTo(t8.widthPct)
        // A 7am-8pm band ends at 8pm by the clock.
        const band = timelineAxis('timelineDay', at(y, m, d), at(y, m, d + 1), { dayStartHour: 7, dayEndHour: 20 })
        expect(band.start.getHours()).toBe(7)
        expect(band.end.getHours()).toBe(20)
        expect(band.ticks).toHaveLength(13)
      })
    })
  }
})
