import { describe, expect, it, vi } from 'vitest'
import {
  undoHistory,
  redoHistory,
  pushHistory,
  runHistoryGroup,
  nextGroupId,
  type HistoryStep,
} from './history'

function step(n: number, over: Partial<HistoryStep> = {}): HistoryStep {
  return { rowId: `r${n}`, columnId: 'c', field: 'c', before: n, after: n * 10, ...over }
}

function makeCtx(history: HistoryStep[] = [], limit = 200) {
  const applied: Array<{ rowId: string; direction: string }> = []
  const ctx = {
    history,
    historyPtr: history.length - 1,
    historyVersion: 0,
    historyGroupId: undefined as string | undefined,
    UNDO_LIMIT: limit,
    applyHistoryStep: vi.fn((s: HistoryStep, direction: 'undo' | 'redo') => {
      applied.push({ rowId: s.rowId, direction })
    }),
  }
  return { ctx, applied }
}

describe('undo / redo without groups', () => {
  it('walks one step per call', () => {
    const { ctx, applied } = makeCtx([step(1), step(2)])
    expect(undoHistory(ctx)).toBe(true)
    expect(applied).toEqual([{ rowId: 'r2', direction: 'undo' }])
    expect(ctx.historyPtr).toBe(0)
  })

  it('returns false at the bottom and the top', () => {
    const { ctx } = makeCtx([])
    expect(undoHistory(ctx)).toBe(false)
    expect(redoHistory(ctx)).toBe(false)
  })

  it('round-trips undo then redo', () => {
    const { ctx, applied } = makeCtx([step(1)])
    undoHistory(ctx)
    expect(ctx.historyPtr).toBe(-1)
    redoHistory(ctx)
    expect(ctx.historyPtr).toBe(0)
    expect(applied.map((a) => a.direction)).toEqual(['undo', 'redo'])
  })
})

describe('undo / redo with groups', () => {
  it('undoes a whole group in one call', () => {
    const g = 'g1'
    const { ctx, applied } = makeCtx([
      step(1),
      step(2, { groupId: g }), step(3, { groupId: g }), step(4, { groupId: g }),
    ])
    expect(undoHistory(ctx)).toBe(true)
    expect(applied.map((a) => a.rowId)).toEqual(['r4', 'r3', 'r2'])
    // The pointer lands before the group, so the next undo takes the lone step.
    expect(ctx.historyPtr).toBe(0)
  })

  it('undoes a group newest-first so repeated writes to one cell unwind right', () => {
    // Both steps touch r1. Applying oldest-first would leave the cell holding
    // the intermediate value instead of the original.
    const g = 'g1'
    const { ctx, applied } = makeCtx([
      { rowId: 'r1', columnId: 'c', field: 'c', before: 'orig', after: 'mid', groupId: g },
      { rowId: 'r1', columnId: 'c', field: 'c', before: 'mid', after: 'final', groupId: g },
    ])
    undoHistory(ctx)
    expect(applied).toEqual([
      { rowId: 'r1', direction: 'undo' },
      { rowId: 'r1', direction: 'undo' },
    ])
    expect(ctx.applyHistoryStep.mock.calls[0]![0].before).toBe('mid')
    expect(ctx.applyHistoryStep.mock.calls[1]![0].before).toBe('orig')
  })

  it('redoes a whole group in order', () => {
    const g = 'g1'
    const { ctx, applied } = makeCtx([
      step(1, { groupId: g }), step(2, { groupId: g }), step(3, { groupId: g }),
    ])
    ctx.historyPtr = -1
    expect(redoHistory(ctx)).toBe(true)
    expect(applied.map((a) => a.rowId)).toEqual(['r1', 'r2', 'r3'])
    expect(ctx.historyPtr).toBe(2)
  })

  it('keeps two adjacent groups separate', () => {
    const { ctx, applied } = makeCtx([
      step(1, { groupId: 'g1' }), step(2, { groupId: 'g1' }),
      step(3, { groupId: 'g2' }), step(4, { groupId: 'g2' }),
    ])
    undoHistory(ctx)
    expect(applied.map((a) => a.rowId)).toEqual(['r4', 'r3'])
    expect(ctx.historyPtr).toBe(1)
    undoHistory(ctx)
    expect(applied.map((a) => a.rowId)).toEqual(['r4', 'r3', 'r2', 'r1'])
    expect(ctx.historyPtr).toBe(-1)
  })
})

describe('pushHistory', () => {
  it('truncates forward history so an edit invalidates redo', () => {
    const { ctx } = makeCtx([step(1), step(2), step(3)])
    ctx.historyPtr = 0
    pushHistory(ctx, [step(9)])
    expect(ctx.history.map((s) => s.rowId)).toEqual(['r1', 'r9'])
    expect(ctx.historyPtr).toBe(1)
  })

  it('drops the OLDEST entries when the buffer is full', () => {
    const { ctx } = makeCtx([step(1), step(2), step(3)], 3)
    pushHistory(ctx, [step(4)])
    expect(ctx.history.map((s) => s.rowId)).toEqual(['r2', 'r3', 'r4'])
    expect(ctx.historyPtr).toBe(2)
  })

  it('does not tag a group of one', () => {
    const { ctx } = makeCtx()
    pushHistory(ctx, [step(1)], nextGroupId())
    expect(ctx.history[0]!.groupId).toBeUndefined()
  })

  it('tags every step when several are pushed together', () => {
    const { ctx } = makeCtx()
    pushHistory(ctx, [step(1), step(2)], nextGroupId())
    const ids = ctx.history.map((s) => s.groupId)
    expect(ids[0]).toBeDefined()
    expect(new Set(ids).size).toBe(1)
  })

  it('ignores an empty push', () => {
    const { ctx } = makeCtx()
    pushHistory(ctx, [])
    expect(ctx.history).toHaveLength(0)
    expect(ctx.historyVersion).toBe(0)
  })
})

describe('runHistoryGroup', () => {
  it('joins separate pushes into one undoable action', () => {
    const { ctx, applied } = makeCtx()
    runHistoryGroup(ctx, () => {
      pushHistory(ctx, [step(1)])
      pushHistory(ctx, [step(2)])
      pushHistory(ctx, [step(3)])
    })
    expect(new Set(ctx.history.map((s) => s.groupId)).size).toBe(1)
    undoHistory(ctx)
    expect(applied.map((a) => a.rowId)).toEqual(['r3', 'r2', 'r1'])
    expect(ctx.historyPtr).toBe(-1)
  })

  it('survives the buffer overflowing mid-group', () => {
    // This is why the group id is ambient rather than stamped afterwards: the
    // cap drops entries from the front, so any index captured before the call
    // would point at the wrong steps by the end of it.
    const { ctx } = makeCtx([step(0)], 3)
    runHistoryGroup(ctx, () => {
      pushHistory(ctx, [step(1)])
      pushHistory(ctx, [step(2)])
      pushHistory(ctx, [step(3)])
    })
    expect(ctx.history.map((s) => s.rowId)).toEqual(['r1', 'r2', 'r3'])
    expect(new Set(ctx.history.map((s) => s.groupId)).size).toBe(1)
  })

  it('nests into the outer group so one action is one undo', () => {
    const { ctx } = makeCtx()
    runHistoryGroup(ctx, () => {
      pushHistory(ctx, [step(1)])
      runHistoryGroup(ctx, () => pushHistory(ctx, [step(2)]))
    })
    expect(new Set(ctx.history.map((s) => s.groupId)).size).toBe(1)
  })

  it('clears the ambient id when the body throws', () => {
    const { ctx } = makeCtx()
    expect(() => runHistoryGroup(ctx, () => { throw new Error('boom') })).toThrow('boom')
    expect(ctx.historyGroupId).toBeUndefined()
    pushHistory(ctx, [step(1)])
    expect(ctx.history[0]!.groupId).toBeUndefined()
  })

  it('returns the body result', () => {
    const { ctx } = makeCtx()
    expect(runHistoryGroup(ctx, () => 42)).toBe(42)
  })
})
