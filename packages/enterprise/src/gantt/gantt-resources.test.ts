import { describe, expect, it } from 'vitest'
import { overallocations, resourceLoad, type ResourceAssignment } from './gantt-resources'

const day = (n: number) => new Date(2026, 8, n)
const job = (key: string, resource: string, from: number, to: number): ResourceAssignment => ({
  key,
  resource,
  start: day(from),
  end: day(to),
})
/** `n` one-day columns starting on the 14th. */
const days = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ start: day(14 + i), end: day(15 + i) }))

describe('resourceLoad', () => {
  it('counts a resource\'s tasks per column', () => {
    const rows = resourceLoad([job('a', 'ann', 14, 16)], days(4))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.cells.map((c) => c.load)).toEqual([1, 1, 0, 0])
  })

  it('reads two overlapping tasks as a load of two', () => {
    const rows = resourceLoad([job('a', 'ann', 14, 17), job('b', 'ann', 15, 16)], days(3))
    expect(rows[0]!.cells.map((c) => c.load)).toEqual([1, 2, 1])
    expect(rows[0]!.peak).toBe(2)
  })

  it('flags only the columns past capacity', () => {
    const rows = resourceLoad([job('a', 'ann', 14, 17), job('b', 'ann', 15, 16)], days(3))
    expect(rows[0]!.cells.map((c) => c.over)).toEqual([false, true, false])
  })

  it('takes a per-resource capacity, so a crew of three is not "over" at two', () => {
    const rows = resourceLoad([job('a', 'crew', 14, 17), job('b', 'crew', 15, 16)], days(3), {
      capacityOf: () => 3,
    })
    expect(rows[0]!.cells.every((c) => !c.over)).toBe(true)
    expect(rows[0]!.capacity).toBe(3)
  })

  it('keeps one row per resource, in the order given', () => {
    const rows = resourceLoad([job('a', 'zoe', 14, 15), job('b', 'ann', 14, 15)], days(1), {
      resources: [{ id: 'ann', title: 'Ann' }, { id: 'zoe', title: 'Zoe' }],
    })
    expect(rows.map((r) => r.id)).toEqual(['ann', 'zoe'])
    expect(rows.map((r) => r.label)).toEqual(['Ann', 'Zoe'])
  })

  it('derives the rows from the data when no resources are given', () => {
    const rows = resourceLoad([job('a', 'zoe', 14, 15), job('b', 'ann', 14, 15)], days(1))
    // First-seen order, and the id doubles as the label.
    expect(rows.map((r) => r.id)).toEqual(['zoe', 'ann'])
    expect(rows.map((r) => r.label)).toEqual(['zoe', 'ann'])
  })

  it('keeps an explicit resource with nothing booked, as an empty row', () => {
    const rows = resourceLoad([], days(2), { resources: [{ id: 'ann' }] })
    expect(rows[0]!.cells.map((c) => c.load)).toEqual([0, 0])
    expect(rows[0]!.peak).toBe(0)
  })

  it('ignores an assignment whose resource is not in the list', () => {
    const rows = resourceLoad([job('a', 'ghost', 14, 15)], days(1), {
      resources: [{ id: 'ann' }],
    })
    expect(rows[0]!.cells[0]!.load).toBe(0)
  })

  it('ignores a zero-length task - a milestone books nobody for a day', () => {
    const rows = resourceLoad([job('m', 'ann', 14, 14)], days(2))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.cells.map((c) => c.load)).toEqual([0, 0])
  })

  it('counts a task that merely touches a coarse column', () => {
    // One week-wide column: a task inside it and one straddling its far edge
    // both count, which is what makes a coarse strip read high rather than low.
    const week = [{ start: day(14), end: day(21) }]
    const rows = resourceLoad([job('a', 'ann', 15, 17), job('b', 'ann', 20, 25)], week)
    expect(rows[0]!.cells[0]!.load).toBe(2)
  })

  it('does not count a task that ends exactly where a column starts', () => {
    const rows = resourceLoad([job('a', 'ann', 13, 14)], days(1))
    expect(rows[0]!.cells[0]!.load).toBe(0)
  })

  it('handles no columns and no assignments', () => {
    expect(resourceLoad([], [])).toEqual([])
  })
})

describe('overallocations', () => {
  it('names the resources that are over somewhere', () => {
    const rows = resourceLoad(
      [job('a', 'ann', 14, 17), job('b', 'ann', 15, 16), job('c', 'bob', 14, 17)],
      days(3),
    )
    expect(overallocations(rows)).toEqual(['ann'])
  })

  it('is empty when nobody is', () => {
    expect(overallocations(resourceLoad([job('a', 'ann', 14, 17)], days(3)))).toEqual([])
  })
})
