import { describe, expect, it } from 'vitest'
import { dependencyArrows, elbowPath, type BarRect } from './timeline-arrows'

/** The points of an SVG polyline path, as [x, y] pairs. */
function points(d: string): Array<[number, number]> {
  return d
    .trim()
    .split(/\s+/)
    .map((seg) => seg.replace(/^[ML]/, '').split(',').map(Number) as [number, number])
}

describe('elbowPath', () => {
  it('turns once when the successor is to the right', () => {
    // Out of the predecessor's edge, across, and in: four points.
    const p = points(elbowPath(100, 10, 200, 40, 26))
    expect(p).toEqual([
      [100, 10],
      [110, 10],
      [110, 40],
      [200, 40],
    ])
  })

  it('stands the turn off the bar edge rather than leaving at a diagonal', () => {
    const p = points(elbowPath(100, 10, 200, 40, 26))
    // The second point shares the start's y: the line leaves horizontally.
    expect(p[1]![1]).toBe(p[0]![1])
    // ... and it stands off by the stub, so the turn is not on the bar itself.
    expect(p[1]![0] - p[0]![0]).toBe(10)
  })

  it('detours around when the successor sits to the LEFT', () => {
    // A backward link: a straight elbow would run back through the
    // predecessor's own bar, so the path drops a lane and comes back.
    const p = points(elbowPath(200, 10, 100, 40, 26))
    expect(p).toHaveLength(6)
    expect(p[0]).toEqual([200, 10])
    expect(p[5]).toEqual([100, 40])
    // The detour is one lane below the start, because the target is below.
    expect(p[2]![1]).toBe(36)
    expect(p[3]![1]).toBe(36)
    // It approaches the successor from its left, standing off by the stub.
    expect(p[3]![0]).toBe(90)
  })

  it('detours ABOVE when the backward successor is above', () => {
    const p = points(elbowPath(200, 40, 100, 10, 26))
    expect(p[2]![1]).toBe(14)
  })

  it('takes the loop height from the caller, so each view uses its own row', () => {
    expect(points(elbowPath(200, 10, 100, 40, 8))[2]![1]).toBe(18)
    expect(points(elbowPath(200, 10, 100, 40, 40))[2]![1]).toBe(50)
  })
})

describe('dependencyArrows', () => {
  const rects = new Map<string, BarRect>([
    ['a', { left: 10, right: 60, midY: 16 }],
    ['b', { left: 100, right: 180, midY: 48 }],
  ])
  const first = (type?: 'FS' | 'SS' | 'FF' | 'SF') =>
    points(dependencyArrows(rects, [{ id: 'd1', from: 'a', to: 'b', type }], new Set(), 26)[0]!.d)

  it('joins predecessor finish to successor start by default (FS)', () => {
    const p = first()
    expect(p[0]).toEqual([60, 16])
    expect(p[p.length - 1]).toEqual([100, 48])
  })

  it('joins start to start for SS', () => {
    const p = first('SS')
    expect(p[0]![0]).toBe(10)
    expect(p[p.length - 1]![0]).toBe(100)
  })

  it('joins finish to finish for FF', () => {
    const p = first('FF')
    expect(p[0]![0]).toBe(60)
    expect(p[p.length - 1]![0]).toBe(180)
  })

  it('joins start to finish for SF', () => {
    const p = first('SF')
    expect(p[0]![0]).toBe(10)
    expect(p[p.length - 1]![0]).toBe(180)
  })

  it('puts the arrowhead on the successor edge it arrives at', () => {
    const [fs] = dependencyArrows(rects, [{ id: 'd1', from: 'a', to: 'b' }], new Set(), 26)
    expect(fs).toMatchObject({ hx: 100, hy: 48 })
    const [ff] = dependencyArrows(
      rects,
      [{ id: 'd1', from: 'a', to: 'b', type: 'FF' }],
      new Set(),
      26,
    )
    expect(ff).toMatchObject({ hx: 180, hy: 48 })
  })

  it('marks the links the caller says are violated', () => {
    const out = dependencyArrows(
      rects,
      [
        { id: 'ok', from: 'a', to: 'b' },
        { id: 'late', from: 'b', to: 'a' },
      ],
      new Set(['late']),
      26,
    )
    expect(out.map((a) => [a.id, a.bad])).toEqual([
      ['ok', false],
      ['late', true],
    ])
  })

  it('skips a link whose end is not on screen rather than throwing', () => {
    // A row filtered out of the view, or one inside a collapsed subtree the
    // caller chose not to re-anchor. Drawing nothing is the right answer.
    const out = dependencyArrows(
      rects,
      [
        { id: 'd1', from: 'a', to: 'gone' },
        { id: 'd2', from: 'gone', to: 'b' },
        { id: 'd3', from: 'a', to: 'b' },
      ],
      new Set(),
      26,
    )
    expect(out.map((a) => a.id)).toEqual(['d3'])
  })

  it('returns nothing for no links', () => {
    expect(dependencyArrows(rects, [], new Set(), 26)).toEqual([])
  })
})
