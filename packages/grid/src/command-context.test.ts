/**
 * The command context handed to registered keyboard shortcuts.
 *
 * The interesting part is `setCellValue`: it is the only writer a command
 * touches, so if it does not record history then every sheet command ships
 * un-undoable no matter how carefully `cmd.batch` groups. These tests hold
 * that behaviour down, along with the index-space contract (display indices
 * in, `readCellRaw` / `writeCellRaw` out) that the getters exist for.
 */
import { describe, expect, it, vi } from 'vitest'
import { buildCommandContext } from './command-context'
import { undoHistory, type HistoryStep } from './history'

function makeCtx(values: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...values }
  const key = (r: number, columnId: string) => `${r}:${columnId}`
  const ctx: any = {
    allRows: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
    allColumns: [
      { id: 'a', columnDef: { field: 'a' } },
      { id: 'b', columnDef: { field: 'b' } },
    ],
    history: [] as HistoryStep[],
    historyPtr: -1,
    historyVersion: 0,
    historyGroupId: undefined as string | undefined,
    UNDO_LIMIT: 200,
    grid: { getState: () => ({ activeCell: { rowIndex: 0, colIndex: 0 } }) },
    getSelectionRects: () => [],
    readCellRaw: (r: number, columnId: string) => store[key(r, columnId)],
    writeCellRaw: vi.fn((r: number, columnId: string, value: unknown) => {
      if (store[key(r, columnId)] === value) return
      store[key(r, columnId)] = value
    }),
    applyHistoryStep: vi.fn((s: HistoryStep, direction: 'undo' | 'redo') => {
      store[key(Number(s.rowId.slice(1)) - 1, s.columnId)] =
        direction === 'undo' ? s.before : s.after
    }),
    setActiveCell: vi.fn(),
    setSelection: vi.fn(),
    extendSelection: vi.fn(),
    scrollActiveCellIntoView: vi.fn(),
    buildApi: () => ({}),
  }
  return { ctx, store, key }
}

describe('setCellValue records history', () => {
  it('pushes one step per changed cell', () => {
    const { ctx } = makeCtx({ '0:a': 1 })
    const cmd = buildCommandContext(ctx, false)
    cmd.setCellValue(0, 0, 9)
    expect(ctx.history).toEqual([
      { rowId: 'r1', columnId: 'a', field: 'a', before: 1, after: 9 },
    ])
    expect(ctx.historyPtr).toBe(0)
  })

  it('pushes nothing when the value is unchanged', () => {
    const { ctx } = makeCtx({ '0:a': 1 })
    const cmd = buildCommandContext(ctx, false)
    cmd.setCellValue(0, 0, 1)
    expect(ctx.history).toEqual([])
    expect(ctx.historyPtr).toBe(-1)
  })

  it('pushes nothing for a column index that does not exist', () => {
    const { ctx } = makeCtx()
    const cmd = buildCommandContext(ctx, false)
    cmd.setCellValue(0, 99, 'x')
    expect(ctx.writeCellRaw).not.toHaveBeenCalled()
    expect(ctx.history).toEqual([])
  })

  it('reads `before` from the cell rather than from the new value', () => {
    const { ctx } = makeCtx({ '1:b': 'old' })
    const cmd = buildCommandContext(ctx, false)
    cmd.setCellValue(1, 1, 'new')
    expect(ctx.history[0]).toMatchObject({ rowId: 'r2', before: 'old', after: 'new' })
  })
})

describe('cmd.batch groups the steps it writes', () => {
  it('makes a multi-cell command ONE undo', () => {
    const { ctx, store } = makeCtx({ '0:a': 1, '1:a': 2, '2:a': 3 })
    const cmd = buildCommandContext(ctx, false)
    cmd.batch(() => {
      cmd.setCellValue(0, 0, 'x')
      cmd.setCellValue(1, 0, 'x')
      cmd.setCellValue(2, 0, 'x')
    })
    const ids = ctx.history.map((s: HistoryStep) => s.groupId)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBeTruthy()

    expect(undoHistory(ctx)).toBe(true)
    expect([store['0:a'], store['1:a'], store['2:a']]).toEqual([1, 2, 3])
    expect(ctx.historyPtr).toBe(-1)
  })

  it('leaves a lone write outside a batch ungrouped', () => {
    const { ctx } = makeCtx({ '0:a': 1 })
    const cmd = buildCommandContext(ctx, false)
    cmd.setCellValue(0, 0, 'x')
    expect(ctx.history[0].groupId).toBeUndefined()
  })
})
