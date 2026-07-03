/**
 * Unit tests for aligned grids: two members sharing a group mirror horizontal
 * scroll and column-resize widths to each other. Driven with minimal fake ctxs.
 */
import { describe, expect, it } from 'vitest'
import { createAlignedGrids } from './aligned-grids'

function makeCtx(group: string | undefined) {
  return {
    props: { alignedGridGroup: group },
    scrollContainer: { scrollLeft: 0 } as { scrollLeft: number },
    columnWidths: {} as Record<string, number>,
  } as Record<string, any>
}

describe('aligned grids', () => {
  it('mirrors horizontal scroll to peers in the same group', () => {
    const a = makeCtx('g')
    const b = makeCtx('g')
    const ha = createAlignedGrids(a)
    const hb = createAlignedGrids(b)
    const un1 = ha.register()
    const un2 = hb.register()

    ha.broadcastScroll(240)
    expect(b.scrollContainer.scrollLeft).toBe(240)
    // and the other way
    hb.broadcastScroll(80)
    expect(a.scrollContainer.scrollLeft).toBe(80)
    un1(); un2()
  })

  it('mirrors column-resize widths to peers (matched by column id)', () => {
    const a = makeCtx('g')
    const b = makeCtx('g')
    const ha = createAlignedGrids(a)
    const hb = createAlignedGrids(b)
    ha.register(); hb.register()

    a.columnWidths = { Feb: 180 }
    ha.broadcastWidths()
    expect(b.columnWidths.Feb).toBe(180)
  })

  it('does NOT mirror across different groups', () => {
    const a = makeCtx('one')
    const b = makeCtx('two')
    const ha = createAlignedGrids(a)
    const hb = createAlignedGrids(b)
    ha.register(); hb.register()

    ha.broadcastScroll(200)
    expect(b.scrollContainer.scrollLeft).toBe(0)
    a.columnWidths = { Feb: 999 }
    ha.broadcastWidths()
    expect(b.columnWidths.Feb).toBeUndefined()
  })

  it('is inert with no group set, and after unregister', () => {
    const a = makeCtx(undefined)
    const b = makeCtx(undefined)
    const ha = createAlignedGrids(a)
    const hb = createAlignedGrids(b)
    ha.register(); hb.register()
    ha.broadcastScroll(120)
    expect(b.scrollContainer.scrollLeft).toBe(0)

    // Grouped, then unregistered -> no longer receives updates.
    const c = makeCtx('gg')
    const d = makeCtx('gg')
    const hc = createAlignedGrids(c)
    const hd = createAlignedGrids(d)
    const unc = hc.register()
    const und = hd.register()
    und() // d leaves the group
    hc.broadcastScroll(55)
    expect(d.scrollContainer.scrollLeft).toBe(0)
    unc()
  })
})
