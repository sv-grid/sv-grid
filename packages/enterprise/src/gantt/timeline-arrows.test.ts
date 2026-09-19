import { describe, expect, it } from 'vitest'
import { arrowHeadPath, dependencyArrows, distanceToPath, elbowPath, nearestArrow, pathPoints, type BarRect } from './timeline-arrows'

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
    // predecessor's own bar, so the path steps to the row boundary and
    // comes back along it.
    const p = points(elbowPath(200, 10, 100, 40, 26))
    expect(p).toHaveLength(6)
    expect(p[0]).toEqual([200, 10])
    expect(p[5]).toEqual([100, 40])
    // The detour runs HALF a row below the start - the gap between this row's
    // bar and the next one's - because the target is below.
    expect(p[2]![1]).toBe(23)
    expect(p[3]![1]).toBe(23)
    // It approaches the successor from its left, standing off by the stub.
    expect(p[3]![0]).toBe(90)
  })

  it('detours ABOVE when the backward successor is above', () => {
    const p = points(elbowPath(200, 40, 100, 10, 26))
    expect(p[2]![1]).toBe(27)
  })

  it('takes the row pitch from the caller, so each view uses its own row', () => {
    expect(points(elbowPath(200, 10, 100, 40, 8))[2]![1]).toBe(14)
    expect(points(elbowPath(200, 10, 100, 40, 40))[2]![1]).toBe(30)
  })

  it('keeps the backward run OFF the successor bar for back-to-back tasks', () => {
    // Two tasks scheduled back to back on adjacent rows at a coarse zoom: the
    // successor starts 3px after the predecessor ends, under the stub. With
    // the detour a full row down its backward segment sat on the successor's
    // own centre line (y = 42) and drew across the bar it points at.
    const rowH = 32
    const p = points(elbowPath(100, 10, 103, 42, rowH))
    expect(p).toHaveLength(6)
    // The backward segment is between the rows, not on either bar's centre.
    expect(p[2]![1]).toBe(26)
    expect(p[3]![1]).toBe(26)
    expect(p[2]![1]).not.toBe(42)
    // And the path still arrives on the successor's edge.
    expect(p[5]).toEqual([103, 42])
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

  it('joins start to start for SS, leaving leftwards and arriving from the left', () => {
    const p = first('SS')
    // Out of a's start (10), a stub to the LEFT of it, down, into b's start.
    expect(p).toEqual([
      [10, 16],
      [0, 16],
      [0, 48],
      [100, 48],
    ])
    expect(dependencyArrows(rects, [{ id: 'd1', from: 'a', to: 'b', type: 'SS' }], new Set(), 26)[0]!.dir).toBe('right')
  })

  it('joins finish to finish for FF, arriving from the RIGHT', () => {
    // Arriving from the left would run the length of b's bar. The stub
    // stands off the further finish (b's, 180), so the head points left.
    const [ff] = dependencyArrows(rects, [{ id: 'd1', from: 'a', to: 'b', type: 'FF' }], new Set(), 26)
    expect(points(ff!.d)).toEqual([
      [60, 16],
      [190, 16],
      [190, 48],
      [180, 48],
    ])
    expect(ff).toMatchObject({ hx: 180, hy: 48, dir: 'left' })
  })

  it('joins start to finish for SF', () => {
    // b ends (180) after a starts (10): no room for one turn, so the path
    // steps to the row boundary, crosses, and comes into b's finish from
    // the right.
    const [sf] = dependencyArrows(rects, [{ id: 'd1', from: 'a', to: 'b', type: 'SF' }], new Set(), 26)
    const p = points(sf!.d)
    expect(p[0]).toEqual([10, 16])
    expect(p[1]).toEqual([0, 16])
    expect(p[p.length - 1]).toEqual([180, 48])
    expect(p[p.length - 2]).toEqual([190, 48])
    expect(sf!.dir).toBe('left')
    // With room - a successor that ends well before the predecessor starts -
    // it is one turn.
    const roomy = new Map<string, BarRect>([
      ['a', { left: 200, right: 260, midY: 16 }],
      ['b', { left: 20, right: 100, midY: 48 }],
    ])
    expect(points(dependencyArrows(roomy, [{ id: 'd', from: 'a', to: 'b', type: 'SF' }], new Set(), 26)[0]!.d)).toEqual([
      [200, 16],
      [190, 16],
      [190, 48],
      [100, 48],
    ])
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

  describe('a successor scheduled back to back', () => {
    // b starts where a finishes and runs on under the stub the arrow leaves
    // by. An elbow would hook back on itself; the arrow drops into b's top.
    const tight = new Map<string, BarRect>([
      ['a', { left: 10, right: 100, midY: 16, halfH: 11 }],
      ['b', { left: 100, right: 180, midY: 48, halfH: 11 }],
      ['above', { left: 100, right: 180, midY: -16, halfH: 11 }],
      // A milestone right after a: its apex is under the stub.
      ['m', { left: 92, right: 108, midY: 80, kind: 'milestone' }],
      // A milestone the predecessor overruns: only a side corner is reachable.
      ['mBack', { left: 70, right: 86, midY: 144, kind: 'milestone' }],
      // A successor that ENDS under the stub cannot be entered from above.
      ['short', { left: 96, right: 106, midY: 112, halfH: 11 }],
    ])
    const one = (to: string, type?: 'FS' | 'SS' | 'FF' | 'SF') =>
      dependencyArrows(tight, [{ id: 'd', from: 'a', to, type }], new Set(), 32)[0]!

    it('drops into the top edge of a successor below, head pointing down', () => {
      const arrow = one('b')
      expect(points(arrow.d)).toEqual([
        [100, 16],
        [110, 16],
        [110, 37], // b's midY 48 minus halfH 11: its top edge
      ])
      expect(arrow).toMatchObject({ hx: 110, hy: 37, dir: 'down' })
    })

    it('rises into the bottom edge of a successor above', () => {
      const arrow = one('above')
      expect(points(arrow.d).at(-1)).toEqual([110, -5])
      expect(arrow.dir).toBe('up')
    })

    it('drops onto the apex of a milestone that follows the predecessor', () => {
      const arrow = one('m')
      // Straight down from the finish to the top corner: no hook round to the side.
      expect(points(arrow.d)).toEqual([
        [100, 16],
        [100, 16],
        [100, 72], // midY 80 minus the half-diagonal 8
      ])
      expect(arrow).toMatchObject({ hx: 100, hy: 72, dir: 'down' })
    })

    it('keeps the side entry for a milestone behind the finish and for a bar the stub overshoots', () => {
      expect(one('mBack').dir).toBe('right')
      expect(points(one('mBack').d).at(-1)).toEqual([70, 144])
      expect(one('short').dir).toBe('right')
    })

    it('only applies to finish-to-start links', () => {
      // SS leaves a's START and arrives at b's start from the left; FF arrives
      // at b's finish from the right. Neither drops in from above.
      expect(one('b', 'SS').dir).toBe('right')
      expect(points(one('b', 'SS').d).at(-1)).toEqual([100, 48])
      expect(one('b', 'FF').dir).toBe('left')
      expect(points(one('b', 'FF').d).at(-1)).toEqual([180, 48])
    })
  })

  it('draws the head for each direction as a 6px triangle at the tip', () => {
    expect(arrowHeadPath(10, 20, 'right')).toBe('M10,20 l-6,-3.5 l0,7 z')
    expect(arrowHeadPath(10, 20, 'left')).toBe('M10,20 l6,-3.5 l0,7 z')
    expect(arrowHeadPath(10, 20, 'down')).toBe('M10,20 l-3.5,-6 l7,0 z')
    expect(arrowHeadPath(10, 20, 'up')).toBe('M10,20 l-3.5,6 l7,0 z')
  })
})

describe('hit-testing an arrow', () => {
  it('reads the vertices back out of a path', () => {
    expect(pathPoints('M10,20 L30,20 L30,50 L60,50')).toEqual([
      [10, 20],
      [30, 20],
      [30, 50],
      [60, 50],
    ])
    expect(pathPoints('M1.5,2.25 L-3,4')).toEqual([[1.5, 2.25], [-3, 4]])
  })

  it('measures to the nearest segment, not the nearest vertex', () => {
    const p = pathPoints('M0,0 L100,0 L100,100')
    // Beside the middle of the horizontal run: 5px off it, 50px from a vertex.
    expect(distanceToPath(p, 50, 5)).toBe(5)
    // Beside the vertical run.
    expect(distanceToPath(p, 96, 50)).toBe(4)
    // Past the end, the distance is to the endpoint.
    expect(distanceToPath(p, 100, 110)).toBe(10)
  })

  it('picks the arrow under the pointer, and the nearest when two overlap', () => {
    const arrows = [
      { id: 'a', d: 'M0,10 L50,10 L50,40 L100,40' },
      { id: 'b', d: 'M0,70 L50,70 L50,100 L100,100' },
    ]
    expect(nearestArrow(arrows, 25, 12, 6)?.id).toBe('a')
    expect(nearestArrow(arrows, 75, 97, 6)?.id).toBe('b')
    // Between the two, too far from either.
    expect(nearestArrow(arrows, 25, 40, 6)).toBeNull()
    // Where they run close, the closer one wins.
    const close = [
      { id: 'top', d: 'M0,10 L100,10' },
      { id: 'under', d: 'M0,16 L100,16' },
    ]
    expect(nearestArrow(close, 50, 12, 6)?.id).toBe('top')
    expect(nearestArrow(close, 50, 15, 6)?.id).toBe('under')
  })
})
