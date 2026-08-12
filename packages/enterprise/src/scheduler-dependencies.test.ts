import { describe, expect, it } from 'vitest'
import {
  buildDependencyGraph,
  cascade,
  hasCycle,
  requiredStart,
  topoOrder,
  violations,
  type EventTimes,
  type SchedulerDependency,
} from './scheduler-dependencies'

// A fixed base day so the tests are deterministic (no Date.now()).
const D = (h: number, m = 0) => new Date(2026, 0, 5, h, m, 0, 0)
const ev = (startH: number, endH: number): EventTimes => ({ start: D(startH), end: D(endH) })
const times = (m: Record<string, EventTimes>) => new Map(Object.entries(m))

describe('requiredStart', () => {
  const pred = ev(9, 11) // 09:00 - 11:00
  const durMs = 60 * 60_000 // 1h successor

  it('FS: successor starts at predecessor end', () => {
    expect(requiredStart(pred, { id: 'd', from: 'a', to: 'b', type: 'FS' }, durMs)).toEqual(D(11))
  })
  it('FS honours lag (minutes)', () => {
    expect(requiredStart(pred, { id: 'd', from: 'a', to: 'b', type: 'FS', lag: 30 }, durMs)).toEqual(D(11, 30))
  })
  it('FS honours negative lag (lead)', () => {
    expect(requiredStart(pred, { id: 'd', from: 'a', to: 'b', type: 'FS', lag: -60 }, durMs)).toEqual(D(10))
  })
  it('SS: successor starts with predecessor start', () => {
    expect(requiredStart(pred, { id: 'd', from: 'a', to: 'b', type: 'SS' }, durMs)).toEqual(D(9))
  })
  it('FF: successor ENDS at predecessor end (start = end - duration)', () => {
    expect(requiredStart(pred, { id: 'd', from: 'a', to: 'b', type: 'FF' }, durMs)).toEqual(D(10))
  })
  it('SF: successor ENDS at predecessor start', () => {
    expect(requiredStart(pred, { id: 'd', from: 'a', to: 'b', type: 'SF' }, durMs)).toEqual(D(8))
  })
  it('defaults to FS when type omitted', () => {
    expect(requiredStart(pred, { id: 'd', from: 'a', to: 'b' }, durMs)).toEqual(D(11))
  })
})

describe('buildDependencyGraph', () => {
  it('indexes successors, predecessors and nodes; drops malformed/self links', () => {
    const deps: SchedulerDependency[] = [
      { id: '1', from: 'a', to: 'b' },
      { id: '2', from: 'b', to: 'c' },
      { id: '3', from: 'x', to: 'x' }, // self - dropped
      { id: '4', from: '', to: 'z' }, // malformed - dropped
    ]
    const g = buildDependencyGraph(deps)
    expect(g.deps).toHaveLength(2)
    expect(g.succ.get('a')?.[0]?.to).toBe('b')
    expect(g.pred.get('c')?.[0]?.from).toBe('b')
    expect([...g.nodes].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('topoOrder / hasCycle', () => {
  it('orders predecessors before successors', () => {
    const g = buildDependencyGraph([
      { id: '1', from: 'a', to: 'b' },
      { id: '2', from: 'b', to: 'c' },
    ])
    const { order, cyclicIds } = topoOrder(g)
    expect(cyclicIds.size).toBe(0)
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })
  it('flags cyclic links and reports hasCycle', () => {
    const deps: SchedulerDependency[] = [
      { id: '1', from: 'a', to: 'b' },
      { id: '2', from: 'b', to: 'a' },
    ]
    expect(hasCycle(deps)).toBe(true)
    expect(topoOrder(buildDependencyGraph(deps)).cyclicIds.size).toBeGreaterThan(0)
  })
})

describe('cascade', () => {
  it('pushes an FS successor forward to the predecessor end', () => {
    const t = times({ a: ev(9, 11), b: ev(9, 10) }) // b overlaps a - illegal
    const out = cascade(t, [{ id: '1', from: 'a', to: 'b', type: 'FS' }])
    expect(out.get('b')).toEqual({ start: D(11), end: D(12) }) // duration (1h) preserved
    expect(out.has('a')).toBe(false) // predecessor untouched
  })

  it('never pulls a successor earlier when already legal', () => {
    const t = times({ a: ev(9, 10), b: ev(14, 15) }) // b already after a
    const out = cascade(t, [{ id: '1', from: 'a', to: 'b', type: 'FS' }])
    expect(out.size).toBe(0)
  })

  it('cascades multi-hop chains in one pass', () => {
    const t = times({ a: ev(9, 11), b: ev(9, 10), c: ev(9, 10) })
    const out = cascade(t, [
      { id: '1', from: 'a', to: 'b', type: 'FS' },
      { id: '2', from: 'b', to: 'c', type: 'FS' },
    ])
    expect(out.get('b')).toEqual({ start: D(11), end: D(12) })
    expect(out.get('c')).toEqual({ start: D(12), end: D(13) })
  })

  it('diamond: a successor with two predecessors takes the later constraint', () => {
    // a ends 11, b ends 13; both feed d. d must start at max(11,13) = 13.
    const t = times({ a: ev(9, 11), b: ev(9, 13), d: ev(9, 10) })
    const out = cascade(t, [
      { id: '1', from: 'a', to: 'd', type: 'FS' },
      { id: '2', from: 'b', to: 'd', type: 'FS' },
    ])
    expect(out.get('d')).toEqual({ start: D(13), end: D(14) })
  })

  it('respects lag when cascading', () => {
    const t = times({ a: ev(9, 11), b: ev(9, 10) })
    const out = cascade(t, [{ id: '1', from: 'a', to: 'b', type: 'FS', lag: 15 }])
    expect(out.get('b')).toEqual({ start: D(11, 15), end: D(12, 15) })
  })

  it('applies the snapForward hook (working-time skip)', () => {
    // Snap any start at/after 12:00 forward to 13:00 (a lunch break).
    const snapForward = (s: Date) => (s.getHours() === 12 ? new Date(2026, 0, 5, 13, 0) : s)
    const t = times({ a: ev(10, 12), b: ev(9, 10) })
    const out = cascade(t, [{ id: '1', from: 'a', to: 'b', type: 'FS' }], { snapForward })
    expect(out.get('b')?.start).toEqual(new Date(2026, 0, 5, 13, 0))
    expect(out.get('b')?.end).toEqual(new Date(2026, 0, 5, 14, 0)) // duration preserved past the break
  })

  it('ignores cyclic links without looping', () => {
    const t = times({ a: ev(9, 11), b: ev(9, 10) })
    const out = cascade(t, [
      { id: '1', from: 'a', to: 'b' },
      { id: '2', from: 'b', to: 'a' }, // cycle - both ignored
    ])
    expect(out.size).toBe(0)
  })
})

describe('violations', () => {
  it('reports a link whose successor starts too early', () => {
    const t = times({ a: ev(9, 11), b: ev(10, 11) }) // b starts before a ends
    const bad = violations(t, [{ id: '1', from: 'a', to: 'b', type: 'FS' }])
    expect(bad.map((d) => d.id)).toEqual(['1'])
  })
  it('reports nothing when the link is satisfied', () => {
    const t = times({ a: ev(9, 11), b: ev(11, 12) })
    expect(violations(t, [{ id: '1', from: 'a', to: 'b', type: 'FS' }])).toHaveLength(0)
  })
  it('treats exact touching (start == pred end) as legal', () => {
    const t = times({ a: ev(9, 11), b: ev(11, 12) })
    expect(violations(t, [{ id: '1', from: 'a', to: 'b', type: 'FS' }])).toHaveLength(0)
  })
})
