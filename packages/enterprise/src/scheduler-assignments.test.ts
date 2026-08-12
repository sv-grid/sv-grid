import { describe, expect, it } from 'vitest'
import {
  assignedMinutes,
  expandAssignments,
  overallocations,
  resourceLoad,
  type SchedulerAssignment,
} from './scheduler-assignments'

type Ev = { key: string; start: Date; end: Date; resource?: string }
const D = (h: number) => new Date(2026, 0, 5, h, 0, 0, 0)
const ev = (key: string, s: number, e: number, resource?: string): Ev => ({ key, start: D(s), end: D(e), resource })

const opts = {
  keyOf: (e: Ev) => e.key,
  startOf: (e: Ev) => e.start,
  endOf: (e: Ev) => e.end,
  resourceOf: (e: Ev) => e.resource,
}

describe('expandAssignments', () => {
  it('renders one event once per assigned resource', () => {
    const events = [ev('e1', 9, 11)]
    const assigns: SchedulerAssignment[] = [
      { id: 'a1', eventId: 'e1', resourceId: 'r1' },
      { id: 'a2', eventId: 'e1', resourceId: 'r2' },
    ]
    const out = expandAssignments(events, assigns, opts)
    expect(out.map((a) => a.resourceId).sort()).toEqual(['r1', 'r2'])
    expect(out.every((a) => a.units === 1)).toBe(true)
  })

  it('dedupes duplicate resource assignments to the max units', () => {
    const out = expandAssignments([ev('e1', 9, 11)], [
      { id: 'a1', eventId: 'e1', resourceId: 'r1', units: 0.5 },
      { id: 'a2', eventId: 'e1', resourceId: 'r1', units: 0.8 },
    ], opts)
    expect(out).toHaveLength(1)
    expect(out[0]!.units).toBe(0.8)
  })

  it('falls back to resourceOf when the event has no assignment', () => {
    const out = expandAssignments([ev('e1', 9, 11, 'rX')], [], opts)
    expect(out).toEqual([expect.objectContaining({ resourceId: 'rX', units: 1 })])
  })

  it('drops an event with neither assignment nor resource', () => {
    const out = expandAssignments([ev('e1', 9, 11)], [], opts)
    expect(out).toHaveLength(0)
  })
})

describe('resourceLoad', () => {
  it('sums units of overlapping allocations on the resource', () => {
    const events = [ev('e1', 9, 11), ev('e2', 10, 12)]
    const allocs = expandAssignments(events, [
      { id: 'a1', eventId: 'e1', resourceId: 'r1', units: 1 },
      { id: 'a2', eventId: 'e2', resourceId: 'r1', units: 0.5 },
    ], opts)
    expect(resourceLoad(allocs, 'r1', D(10), D(11))).toBe(1.5) // both overlap 10-11
    expect(resourceLoad(allocs, 'r1', D(9), D(10))).toBe(1) // only e1
    expect(resourceLoad(allocs, 'r2', D(9), D(12))).toBe(0)
  })
})

describe('overallocations', () => {
  it('flags buckets where load exceeds capacity', () => {
    const events = [ev('e1', 9, 12), ev('e2', 9, 12)]
    const allocs = expandAssignments(events, [
      { id: 'a1', eventId: 'e1', resourceId: 'r1' },
      { id: 'a2', eventId: 'e2', resourceId: 'r1' },
    ], opts)
    const buckets = [{ start: D(9), end: D(10) }, { start: D(10), end: D(11) }]
    const over = overallocations(allocs, ['r1'], buckets, 1)
    expect(over).toHaveLength(2) // 2 concurrent > capacity 1, in both buckets
    expect(over[0]).toMatchObject({ resourceId: 'r1', load: 2, capacity: 1 })
  })

  it('respects a per-resource capacity function', () => {
    const events = [ev('e1', 9, 12), ev('e2', 9, 12)]
    const allocs = expandAssignments(events, [
      { id: 'a1', eventId: 'e1', resourceId: 'r1' },
      { id: 'a2', eventId: 'e2', resourceId: 'r1' },
    ], opts)
    const over = overallocations(allocs, ['r1'], [{ start: D(9), end: D(10) }], () => 2)
    expect(over).toHaveLength(0) // capacity 2 absorbs 2 concurrent
  })
})

describe('assignedMinutes', () => {
  it('totals weighted minutes across allocations', () => {
    const allocs = expandAssignments([ev('e1', 9, 11)], [
      { id: 'a1', eventId: 'e1', resourceId: 'r1', units: 0.5 },
    ], opts)
    expect(assignedMinutes(allocs, 'r1')).toBe(60) // 120 min * 0.5
  })
})
