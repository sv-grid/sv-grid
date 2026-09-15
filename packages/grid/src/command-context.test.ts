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
    gridRootEl: { focus: vi.fn() },
    pasteFromClipboard: vi.fn(async () => {}),
    copySelectionToClipboard: vi.fn(),
    cutSelectionToClipboard: vi.fn(async () => {}),
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

describe('cmd.canEdit', () => {
  it('asks the editing layer, in display index space', () => {
    const { ctx } = makeCtx()
    ctx.isCellEditableAt = vi.fn((r: number, c: number) => !(r === 1 && c === 0))
    const cmd = buildCommandContext(ctx, false)
    expect(cmd.canEdit!(0, 0)).toBe(true)
    expect(cmd.canEdit!(1, 0)).toBe(false)
    expect(ctx.isCellEditableAt).toHaveBeenCalledWith(1, 0)
  })

  it('says yes when the controller has no editing layer', () => {
    const { ctx } = makeCtx()
    expect(buildCommandContext(ctx, false).canEdit!(2, 1)).toBe(true)
  })
})

describe('cmd.focus', () => {
  it('focuses the grid root without scrolling it', () => {
    const { ctx } = makeCtx()
    buildCommandContext(ctx, false).focus()
    expect(ctx.gridRootEl.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('is a no-op before the grid has mounted', () => {
    const { ctx } = makeCtx()
    ctx.gridRootEl = null
    expect(() => buildCommandContext(ctx, false).focus()).not.toThrow()
  })
})

describe('cmd.recordUndo', () => {
  it('puts a non-cell step in the history that undo and redo call back', () => {
    const { ctx } = makeCtx()
    const cmd = buildCommandContext(ctx, false)
    const undo = vi.fn()
    const redo = vi.fn()
    cmd.recordUndo(undo, redo)
    expect(ctx.history).toHaveLength(1)
    expect(ctx.history[0].custom).toEqual({ undo, redo })
    undoHistory(ctx)
    expect(ctx.applyHistoryStep).toHaveBeenCalledWith(expect.objectContaining({ custom: { undo, redo } }), 'undo')
  })

  it('joins the batch it is recorded inside, so cells and formats undo together', () => {
    const { ctx } = makeCtx({ '0:a': 1 })
    const cmd = buildCommandContext(ctx, false)
    cmd.batch(() => {
      cmd.setCellValue(0, 0, 2)
      cmd.recordUndo(() => {}, () => {})
    })
    expect(ctx.history).toHaveLength(2)
    expect(ctx.history[0].groupId).toBeDefined()
    expect(ctx.history[1].groupId).toBe(ctx.history[0].groupId)
  })
})

describe('cmd.editor', () => {
  it('is the open inline editor element, and null when nothing is being edited', () => {
    const { ctx } = makeCtx()
    const root = document.createElement('div')
    ctx.gridRootEl = root
    expect(buildCommandContext(ctx, false).editor).toBeNull()
    const input = document.createElement('input')
    input.className = 'sv-grid-cell-editor'
    root.appendChild(input)
    expect(buildCommandContext(ctx, true).editor).toBe(input)
  })
})

describe('cmd.paste', () => {
  it('routes to the grid clipboard paste, the same path Ctrl+V takes', async () => {
    const { ctx } = makeCtx()
    await buildCommandContext(ctx, false).paste()
    expect(ctx.pasteFromClipboard).toHaveBeenCalledTimes(1)
  })
})

describe('cmd.copy and cmd.cut', () => {
  it('route to the selection copy and cut, the paths Ctrl+C and Ctrl+X take', async () => {
    const { ctx } = makeCtx()
    const cmd = buildCommandContext(ctx, false)
    cmd.copy()
    expect(ctx.copySelectionToClipboard).toHaveBeenCalledTimes(1)
    await cmd.cut()
    expect(ctx.cutSelectionToClipboard).toHaveBeenCalledTimes(1)
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
