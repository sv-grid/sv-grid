import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEditing } from './editing'

// ---------------------------------------------------------------------------
// Fake controller `ctx` for the editing handlers. The handlers operate purely
// through this handle (mirroring clipboard.test.ts), so a hand-rolled stub
// drives every non-clipboard branch without mounting the grid. Clipboard
// paste paths are covered by clipboard.test.ts and only lightly touched here.
// ---------------------------------------------------------------------------

interface ColSpec {
  id: string
  field?: string
  editable?: boolean | ((cellCtx: any) => boolean)
  editorType?: string
  editorMultiple?: boolean
  validate?: (p: { value: unknown; row: any }) => string | boolean | null | undefined
  rejectInvalid?: boolean
}

interface FakeOptions {
  columns?: ColSpec[]
  data?: Array<Record<string, unknown>>
  groupRows?: Set<number>
  editingEnabled?: boolean
}

function makeCtx(opts: FakeOptions = {}) {
  const columns: ColSpec[] = opts.columns ?? [
    { id: 'a', field: 'a', editable: true, editorType: 'text' },
    { id: 'b', field: 'b', editable: true, editorType: 'number' },
  ]
  const data = (opts.data ?? [
    { a: 'a0', b: 0 },
    { a: 'a1', b: 1 },
  ]).map((d) => ({ ...d }))

  const allColumns = columns.map((c) => ({
    id: c.id,
    columnDef: {
      field: c.field,
      editable: c.editable,
      editorType: c.editorType,
      editorMultiple: c.editorMultiple,
      validate: c.validate,
      rejectInvalid: c.rejectInvalid,
    },
  }))

  let activeCell: { rowIndex: number; colIndex: number } | null = null

  const buildRows = (rows: Array<Record<string, unknown>>) =>
    rows.map((row, index) => ({
      id: String(index),
      original: row,
      getCanExpand: () => opts.groupRows?.has(index) ?? false,
      getCellValueByColumnId: (colId: string) =>
        (row as Record<string, unknown>)[colId],
    }))

  let backing = data

  const ctx: any = {
    allColumns,
    _rows: buildRows(data),
    get allRows() {
      return ctx._rows
    },
    // The full filtered model. Same rows here (the fake has no pagination);
    // tests that exercise the "row left the model" path override `_rows`
    // alone so the two genuinely diverge.
    get allRowsBeforePagination() {
      return ctx._rowsBeforePagination ?? ctx._rows
    },
    get activeCell() {
      return activeCell
    },
    scrollActiveCellIntoView: () => {},
    editingEnabled: opts.editingEnabled ?? true,
    editingCell: null,
    editorSelectAll: false,
    editedCellValues: {},
    selectionRange: { anchor: null, focus: null },
    tabRunOrigin: null,
    activeRangeRect: () => null,
    isRowCollapsed: () => false,
    collapsedColumns: {},
    isCellInSelectedRange: () => false,
    gridRootEl: null,
    props: {},
    history: [] as any[],
    historyPtr: -1,
    historyVersion: 0,
    UNDO_LIMIT: 100,
    activeCalls: [] as Array<[number, number]>,
    selectionCalls: [] as Array<[number, number]>,
    setActiveCell: (r: number, c: number) => {
      activeCell = { rowIndex: r, colIndex: c }
      ctx.activeCalls.push([r, c])
    },
    setSelection: (r: number, c: number) => {
      ctx.selectionCalls.push([r, c])
    },
    grid: {
      getState: () => ({ activeCell }),
      store: { setState: vi.fn() },
    },
  }

  Object.defineProperty(ctx, 'internalData', {
    get: () => backing,
    set: (next: Array<Record<string, unknown>>) => {
      backing = next
      ctx._rows = buildRows(next)
    },
  })
  ctx.internalData = data

  return ctx
}

const editingFor = (opts?: FakeOptions) => {
  const ctx = makeCtx(opts)
  return { ctx, ed: createEditing(ctx) }
}

describe('isCellEditable', () => {
  it('treats undefined editable as editable', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a' }],
      data: [{ a: 1 }],
    })
    expect(ed.isCellEditable(ctx.allColumns[0], ctx.allRows[0])).toBe(true)
  })

  it('treats editable:false as locked (fast path, no row needed)', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editable: false }],
    })
    expect(ed.isCellEditable(ctx.allColumns[0])).toBe(false)
  })

  it('honours a cell-level predicate returning false', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editable: () => false }],
      data: [{ a: 1 }],
    })
    expect(ed.isCellEditable(ctx.allColumns[0], ctx.allRows[0])).toBe(false)
  })

  it('honours a cell-level predicate returning true', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editable: (cc: any) => cc.row.id === '0' }],
      data: [{ a: 1 }],
    })
    expect(ed.isCellEditable(ctx.allColumns[0], ctx.allRows[0])).toBe(true)
  })

  it('passes a usable CellContext to the predicate', () => {
    const spy = vi.fn().mockReturnValue(true)
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editable: spy }],
      data: [{ a: 'hello' }],
    })
    ed.isCellEditable(ctx.allColumns[0], ctx.allRows[0])
    const cc = spy.mock.calls[0]![0]
    expect(cc.getValue()).toBe('hello')
    expect(cc.cell.getValue()).toBe('hello')
    expect(cc.cell.getContext()).toBe(cc)
    expect(cc.column).toBe(ctx.allColumns[0])
  })

  it('returns editable when predicate exists but no row supplied', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editable: () => false }],
    })
    // No row -> cannot evaluate predicate -> defaults to editable.
    expect(ed.isCellEditable(ctx.allColumns[0])).toBe(true)
  })

  it('biases to not-editable when the predicate throws', () => {
    const { ctx, ed } = editingFor({
      columns: [
        {
          id: 'a',
          field: 'a',
          editable: () => {
            throw new Error('boom')
          },
        },
      ],
      data: [{ a: 1 }],
    })
    expect(ed.isCellEditable(ctx.allColumns[0], ctx.allRows[0])).toBe(false)
  })
})

describe('isCellEditableAt', () => {
  it('resolves row/column by index then defers to isCellEditable', () => {
    const { ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editable: true },
        { id: 'b', field: 'b', editable: false },
      ],
      data: [{ a: 1, b: 2 }],
    })
    expect(ed.isCellEditableAt(0, 0)).toBe(true)
    expect(ed.isCellEditableAt(0, 1)).toBe(false)
  })

  it('returns false when the column index is out of range', () => {
    const { ed } = editingFor()
    expect(ed.isCellEditableAt(0, 99)).toBe(false)
  })
})

describe('getRowColumnValue', () => {
  it('reads the base value when the column id is known', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a' }],
      data: [{ a: 'x' }],
    })
    expect(ed.getRowColumnValue(ctx.allRows[0], 'a')).toBe('x')
  })

  it('falls back to row.getCellValueByColumnId for an unknown column', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a' }],
      data: [{ a: 'x', ghost: 'g' }],
    })
    expect(ed.getRowColumnValue(ctx.allRows[0], 'ghost')).toBe('g')
  })
})

describe('getCellDisplayValue', () => {
  it('returns the base value when there is no pending edit', () => {
    const { ed } = editingFor()
    expect(ed.getCellDisplayValue('0', 'a', 'base')).toBe('base')
  })

  it('prefers an edited override keyed by rowId:colId', () => {
    const { ctx, ed } = editingFor()
    ctx.editedCellValues['0:a'] = 'edited'
    expect(ed.getCellDisplayValue('0', 'a', 'base')).toBe('edited')
  })

  it('treats an explicit undefined override as present', () => {
    const { ctx, ed } = editingFor()
    ctx.editedCellValues['0:a'] = undefined
    expect(ed.getCellDisplayValue('0', 'a', 'base')).toBeUndefined()
  })
})

describe('startEditingWithChar', () => {
  it('seeds the editor with the typed character and sets active/selection', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'x' }],
    })
    expect(ed.startEditingWithChar(0, 0, 'Z')).toBe(true)
    expect(ctx.editingCell).toEqual({
      rowId: '0',
      columnId: 'a',
      editorType: 'text',
      value: 'Z',
      // The row's data object, kept so the commit still lands if a filter
      // drops the row from the model mid-edit (#49).
      rowRef: ctx.internalData[0],
    })
    expect(ctx.editorSelectAll).toBe(false)
    expect(ctx.activeCalls).toEqual([[0, 0]])
    expect(ctx.selectionCalls).toEqual([[0, 0]])
  })

  it('defaults the editor type to text when none is declared', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a' }],
      data: [{ a: 'x' }],
    })
    ed.startEditingWithChar(0, 0, 'k')
    expect(ctx.editingCell.editorType).toBe('text')
  })

  it('returns false when editing is globally disabled', () => {
    const { ctx, ed } = editingFor({ editingEnabled: false })
    expect(ed.startEditingWithChar(0, 0, 'a')).toBe(false)
    expect(ctx.editingCell).toBeNull()
  })

  it('returns false for a missing row or column', () => {
    const { ed } = editingFor()
    expect(ed.startEditingWithChar(99, 0, 'a')).toBe(false)
    expect(ed.startEditingWithChar(0, 99, 'a')).toBe(false)
  })

  it('returns false for a group row', () => {
    const { ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'x' }],
      groupRows: new Set([0]),
    })
    expect(ed.startEditingWithChar(0, 0, 'a')).toBe(false)
  })

  it('returns false for a non-editable cell', () => {
    const { ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editable: false, editorType: 'text' }],
      data: [{ a: 'x' }],
    })
    expect(ed.startEditingWithChar(0, 0, 'a')).toBe(false)
  })

  it('rejects type-to-edit for checkbox/date/datetime/list/chips editors', () => {
    for (const editorType of ['checkbox', 'date', 'datetime', 'list', 'chips']) {
      const { ed } = editingFor({
        columns: [{ id: 'a', field: 'a', editorType }],
        data: [{ a: 'x' }],
      })
      expect(ed.startEditingWithChar(0, 0, 'a')).toBe(false)
    }
  })

  it('rejects a non-numeric character on a number editor', () => {
    const { ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'number' }],
      data: [{ a: 1 }],
    })
    expect(ed.startEditingWithChar(0, 0, 'x')).toBe(false)
  })

  it('accepts a numeric character on a number editor', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'number' }],
      data: [{ a: 1 }],
    })
    expect(ed.startEditingWithChar(0, 0, '7')).toBe(true)
    expect(ctx.editingCell.value).toBe('7')
  })
})

describe('saveEditingCell', () => {
  it('does nothing when there is no editing cell', () => {
    const { ctx, ed } = editingFor()
    ed.saveEditingCell()
    expect(ctx.grid.store.setState).not.toHaveBeenCalled()
  })

  it('parses, writes original, records edited value, and clears editing', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'b', field: 'b', editorType: 'number' }],
      data: [{ b: 0 }],
    })
    ctx.editingCell = { rowId: '0', columnId: 'b', editorType: 'number', value: '42' }
    ed.saveEditingCell()
    expect(ctx.internalData[0].b).toBe(42) // parsed to number, written to original
    expect(ctx.editedCellValues['0:b']).toBe(42)
    expect(ctx.editingCell).toBeNull()
    expect(ctx.grid.store.setState).toHaveBeenCalled()
  })

  it('coerces an unparseable number to null', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'b', field: 'b', editorType: 'number' }],
      data: [{ b: 5 }],
    })
    ctx.editingCell = { rowId: '0', columnId: 'b', editorType: 'number', value: 'abc' }
    ed.saveEditingCell()
    expect(ctx.internalData[0].b).toBeNull()
  })

  it('respects editorMultiple when parsing list editors', () => {
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'list', editorMultiple: true },
      ],
      data: [{ a: [] }],
    })
    ctx.editingCell = {
      rowId: '0',
      columnId: 'a',
      editorType: 'list',
      value: ['x', 'y'],
    }
    ed.saveEditingCell()
    expect(ctx.internalData[0].a).toEqual(['x', 'y'])
  })

  it('refuses a value the column validates against when rejectInvalid is set', () => {
    const onCellValueChange = vi.fn()
    const { ctx, ed } = editingFor({
      columns: [{
        id: 'b', field: 'b', editorType: 'number', rejectInvalid: true,
        validate: ({ value }) => (Number(value) < 0 ? 'Amount must be positive' : null),
      }],
      data: [{ b: 5 }],
    })
    ctx.props.onCellValueChange = onCellValueChange
    ctx.editingCell = { rowId: '0', columnId: 'b', editorType: 'number', value: '-5' }
    ed.saveEditingCell()
    // The row, the overlay, the history and the consumer are untouched; the
    // editor closes.
    expect(ctx.internalData[0].b).toBe(5)
    expect('0:b' in ctx.editedCellValues).toBe(false)
    expect(ctx.history).toHaveLength(0)
    expect(onCellValueChange).not.toHaveBeenCalled()
    expect(ctx.editingCell).toBeNull()

    // A value the rule accepts still lands.
    ctx.editingCell = { rowId: '0', columnId: 'b', editorType: 'number', value: '7' }
    ed.saveEditingCell()
    expect(ctx.internalData[0].b).toBe(7)
    expect(onCellValueChange).toHaveBeenCalledTimes(1)
  })

  it('without rejectInvalid a flagged value lands, as before', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'b', field: 'b', editorType: 'number', validate: () => 'always wrong' }],
      data: [{ b: 5 }],
    })
    ctx.editingCell = { rowId: '0', columnId: 'b', editorType: 'number', value: '-5' }
    ed.saveEditingCell()
    expect(ctx.internalData[0].b).toBe(-5)
  })

  it('checks the value after valueParser, so the rule sees what would be stored', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'b', field: 'b', editorType: 'number', rejectInvalid: true, validate: ({ value }) => (Number(value) > 100 ? false : null) }],
      data: [{ b: 5 }],
    })
    ;(ctx.allColumns[0].columnDef as any).valueParser = ({ newValue }: { newValue: number }) => newValue * 100
    ctx.editingCell = { rowId: '0', columnId: 'b', editorType: 'number', value: '2' }
    ed.saveEditingCell()
    expect(ctx.internalData[0].b).toBe(5) // 200 after the parser, refused
  })

  it('pushes a history step and bumps the version on a real change', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'old' }],
    })
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'new' }
    ed.saveEditingCell()
    expect(ctx.history).toHaveLength(1)
    expect(ctx.history[0]).toMatchObject({
      rowId: '0',
      columnId: 'a',
      field: 'a',
      before: 'old',
      after: 'new',
    })
    expect(ctx.historyPtr).toBe(0)
    expect(ctx.historyVersion).toBe(1)
  })

  it('does not push history when the value is unchanged', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'same' }],
    })
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'same' }
    ed.saveEditingCell()
    expect(ctx.history).toHaveLength(0)
    expect(ctx.historyVersion).toBe(0)
  })

  it('truncates forward (redo) history when editing after an undo', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'v0' }],
    })
    // Pretend there is forward history the user could have redone.
    ctx.history = [
      { rowId: '0', columnId: 'a', field: 'a', before: 'x', after: 'y' },
      { rowId: '0', columnId: 'a', field: 'a', before: 'y', after: 'z' },
    ]
    ctx.historyPtr = 0 // pointer is behind the tail
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'v1' }
    ed.saveEditingCell()
    // Forward step (index 1) dropped, new step appended at index 1.
    expect(ctx.history).toHaveLength(2)
    expect(ctx.history[1].after).toBe('v1')
    expect(ctx.historyPtr).toBe(1)
  })

  it('caps the history at UNDO_LIMIT dropping the oldest entries', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'start' }],
    })
    ctx.UNDO_LIMIT = 3
    ctx.history = [
      { rowId: '0', columnId: 'a', field: 'a', before: '0', after: '1' },
      { rowId: '0', columnId: 'a', field: 'a', before: '1', after: '2' },
      { rowId: '0', columnId: 'a', field: 'a', before: '2', after: '3' },
    ]
    ctx.historyPtr = 2
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'final' }
    ed.saveEditingCell()
    expect(ctx.history).toHaveLength(3) // capped
    expect(ctx.history[2].after).toBe('final') // newest kept
    expect(ctx.history[0].after).toBe('2') // oldest dropped
    expect(ctx.historyPtr).toBe(2)
  })

  it('fires onCellValueChange with the post-write payload', () => {
    const onCellValueChange = vi.fn()
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'before' }],
    })
    ctx.props.onCellValueChange = onCellValueChange
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'after' }
    ed.saveEditingCell()
    expect(onCellValueChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rowIndex: 0,
        columnId: 'a',
        oldValue: 'before',
        newValue: 'after',
      }),
    )
  })

  it('clears editing even when row/column cannot be resolved', () => {
    const { ctx, ed } = editingFor()
    ctx.editingCell = {
      rowId: 'missing',
      columnId: 'missing',
      editorType: 'text',
      value: 'x',
    }
    ed.saveEditingCell()
    expect(ctx.editingCell).toBeNull()
    expect(ctx.history).toHaveLength(0)
  })
})

describe('applyHistoryStep', () => {
  const step = {
    rowId: '0',
    columnId: 'a',
    field: 'a',
    before: 'B',
    after: 'A',
  }

  it('applies the before value on undo', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'A' }],
    })
    ed.applyHistoryStep(step, 'undo')
    expect(ctx.internalData[0].a).toBe('B')
    expect(ctx.editedCellValues['0:a']).toBe('B')
    expect(ctx.grid.store.setState).toHaveBeenCalled()
  })

  it('applies the after value on redo', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'B' }],
    })
    ed.applyHistoryStep(step, 'redo')
    expect(ctx.internalData[0].a).toBe('A')
  })

  it('fires onCellValueChange with swapped old/new on undo', () => {
    const onCellValueChange = vi.fn()
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'A' }],
    })
    ctx.props.onCellValueChange = onCellValueChange
    ed.applyHistoryStep(step, 'undo')
    expect(onCellValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: 'A', newValue: 'B' }),
    )
  })

  it('is a no-op when the row or column is missing', () => {
    const { ctx, ed } = editingFor()
    ed.applyHistoryStep(
      { rowId: 'nope', columnId: 'a', field: 'a', before: 1, after: 2 },
      'undo',
    )
    expect(ctx.grid.store.setState).not.toHaveBeenCalled()
  })
})

describe('updateEditingCellValue', () => {
  it('updates the value while preserving the rest of the editing cell', () => {
    const { ctx, ed } = editingFor()
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'old' }
    ed.updateEditingCellValue('new')
    expect(ctx.editingCell).toEqual({
      rowId: '0',
      columnId: 'a',
      editorType: 'text',
      value: 'new',
    })
  })

  it('leaves a null editing cell untouched', () => {
    const { ctx, ed } = editingFor()
    ed.updateEditingCellValue('x')
    expect(ctx.editingCell).toBeNull()
  })
})

describe('onEditorKeyDown', () => {
  function fakeEvent(key: string, init: Partial<KeyboardEvent> = {}) {
    return {
      key,
      ...init,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent
  }

  it('Enter saves the cell and refocuses the grid root', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'old' }],
    })
    const focus = vi.fn()
    ctx.gridRootEl = { focus }
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'new' }
    const ev = fakeEvent('Enter')
    ed.onEditorKeyDown(ev)
    expect(ev.stopPropagation).toHaveBeenCalled()
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(ctx.internalData[0].a).toBe('new')
    expect(ctx.editingCell).toBeNull()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('Enter saves and moves the active cell one row down, Shift+Enter one up', () => {
    // Typing a column of values: Enter after each one lands on the next row,
    // as in every spreadsheet, rather than leaving the cursor on the cell
    // just committed. The last row is a wall, not a wrap.
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'a0' }, { a: 'a1' }, { a: 'a2' }],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    ed.onCellDoubleClick(0, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'new' }
    ed.onEditorKeyDown(fakeEvent('Enter'))
    expect(ctx.internalData[0].a).toBe('new')
    expect(ctx.activeCalls.at(-1)).toEqual([1, 0])

    ed.onCellDoubleClick(1, 0)
    const up = { ...fakeEvent('Enter'), shiftKey: true } as unknown as KeyboardEvent
    ;(up as any).preventDefault = vi.fn()
    ;(up as any).stopPropagation = vi.fn()
    ed.onEditorKeyDown(up)
    expect(ctx.activeCalls.at(-1)).toEqual([0, 0])

    ed.onCellDoubleClick(2, 0)
    ed.onEditorKeyDown(fakeEvent('Enter'))
    expect(ctx.activeCalls.at(-1)).toEqual([2, 0])
  })

  it('Alt+Enter puts a line break into a multiline editor instead of committing', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'old' }],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'ab' }
    const area = document.createElement('textarea')
    area.value = 'ab'
    area.selectionStart = area.selectionEnd = 1
    const ev = {
      key: 'Enter', altKey: true, currentTarget: area,
      stopPropagation: vi.fn(), preventDefault: vi.fn(),
    } as unknown as KeyboardEvent
    ed.onEditorKeyDown(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(area.value).toBe('a\nb')
    expect(area.selectionStart).toBe(2)
    expect(ctx.editingCell?.value).toBe('a\nb')
    // Still editing: nothing was saved.
    expect(ctx.internalData[0].a).toBe('old')
  })

  it('Alt+Enter in a single-line input is just Enter', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'old' }, { a: 'next' }],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    ed.onCellDoubleClick(0, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'new' }
    const input = document.createElement('input')
    const ev = {
      key: 'Enter', altKey: true, currentTarget: input,
      stopPropagation: vi.fn(), preventDefault: vi.fn(),
    } as unknown as KeyboardEvent
    ed.onEditorKeyDown(ev)
    expect(ctx.internalData[0].a).toBe('new')
    expect(ctx.editingCell).toBeNull()
  })

  it('Escape cancels without saving and refocuses the grid root', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'old' }],
    })
    const focus = vi.fn()
    ctx.gridRootEl = { focus }
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'discard' }
    const ev = fakeEvent('Escape')
    ed.onEditorKeyDown(ev)
    expect(ctx.internalData[0].a).toBe('old') // unchanged
    expect(ctx.editingCell).toBeNull()
    expect(focus).toHaveBeenCalled()
  })

  it('stops propagation for other keys without saving or cancelling', () => {
    const { ctx, ed } = editingFor()
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'x' }
    const ev = fakeEvent('a')
    ed.onEditorKeyDown(ev)
    expect(ev.stopPropagation).toHaveBeenCalled()
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(ctx.editingCell).not.toBeNull()
  })

  it('tolerates a null gridRootEl on Escape', () => {
    const { ctx, ed } = editingFor()
    ctx.gridRootEl = null
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'x' }
    expect(() => ed.onEditorKeyDown(fakeEvent('Escape'))).not.toThrow()
    expect(ctx.editingCell).toBeNull()
  })

  // #45 in the original report: Tab used to commit and then let the browser
  // walk focus out of the grid, because editors stopPropagation() every key
  // and nothing called preventDefault() for Tab.
  it('Tab saves and advances the active cell one column (#48)', () => {
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'text' },
        { id: 'b', field: 'b', editorType: 'text' },
      ],
      data: [{ a: 'old', b: 'b0' }],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    ed.onCellDoubleClick(0, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'new' }
    const ev = fakeEvent('Tab')
    ed.onEditorKeyDown(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(ctx.internalData[0].a).toBe('new')
    expect(ctx.activeCalls.at(-1)).toEqual([0, 1])
  })

  it('Enter after a run of Tab commits returns to the column the run began in', () => {
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'text' },
        { id: 'b', field: 'b', editorType: 'text' },
        { id: 'c', field: 'c', editorType: 'text' },
      ],
      data: [{ a: '', b: '', c: '' }, { a: '', b: '', c: '' }],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    // The real setActiveCell forgets the run on a move to another cell;
    // the fake must too, or the test would pass with the origin never
    // being written back.
    const plain = ctx.setActiveCell
    ctx.setActiveCell = (r: number, c: number) => {
      const prev = ctx.activeCell
      if (!prev || prev.rowIndex !== r || prev.colIndex !== c) ctx.tabRunOrigin = null
      plain(r, c)
    }
    ed.onCellDoubleClick(0, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'one' }
    ed.onEditorKeyDown(fakeEvent('Tab'))
    ed.onCellDoubleClick(0, 1)
    ctx.editingCell = { ...ctx.editingCell, value: 'two' }
    ed.onEditorKeyDown(fakeEvent('Tab'))
    expect(ctx.activeCalls.at(-1)).toEqual([0, 2])
    expect(ctx.tabRunOrigin).toBe(0)
    ed.onCellDoubleClick(0, 2)
    ctx.editingCell = { ...ctx.editingCell, value: 'three' }
    ed.onEditorKeyDown(fakeEvent('Enter'))
    expect(ctx.internalData[0]).toMatchObject({ a: 'one', b: 'two', c: 'three' })
    expect(ctx.activeCalls.at(-1)).toEqual([1, 0])
    expect(ctx.tabRunOrigin).toBe(null)
    expect(ctx.selectionCalls.at(-1)).toEqual([1, 0])
  })

  it('Ctrl+Enter writes the entry into every cell of the block, as one undo, and stays put', () => {
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'text' },
        { id: 'b', field: 'b', editorType: 'text' },
      ],
      data: [{ a: '', b: '' }, { a: '', b: '' }, { a: 'keep', b: 'keep' }],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    ctx.activeRangeRect = () => ({ minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 })
    ctx.isCellInSelectedRange = () => true
    ed.onCellDoubleClick(0, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'x' }
    const ev = fakeEvent('Enter', { ctrlKey: true })
    ed.onEditorKeyDown(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(ctx.internalData.slice(0, 2)).toEqual([{ a: 'x', b: 'x' }, { a: 'x', b: 'x' }])
    expect(ctx.internalData[2]).toEqual({ a: 'keep', b: 'keep' })
    // The cursor did not move.
    expect(ctx.activeCalls.at(-1)).toEqual([0, 0])
    expect(ctx.editingCell).toBeNull()
    // Four steps, one group.
    const groups = new Set(ctx.history.map((s: any) => s.groupId))
    expect(ctx.history.length).toBe(4)
    expect(groups.size).toBe(1)
    expect([...groups][0]).toBeTruthy()
  })

  it('a commit inside a selected block keeps the block and moves within it', () => {
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'text' },
        { id: 'b', field: 'b', editorType: 'text' },
      ],
      data: [{ a: '', b: '' }, { a: '', b: '' }],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    ctx.activeRangeRect = () => ({ minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 })
    ctx.isCellInSelectedRange = () => true
    ed.onCellDoubleClick(1, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'x' }
    ed.onEditorKeyDown(fakeEvent('Enter'))
    // Past the block's last row: the top of the next column.
    expect(ctx.activeCalls.at(-1)).toEqual([0, 1])
    expect(ctx.selectionCalls).toEqual([])
  })

  it('Shift+Tab moves back a column and wraps to the previous row (#48)', () => {
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'text' },
        { id: 'b', field: 'b', editorType: 'text' },
      ],
      data: [
        { a: 'a0', b: 'b0' },
        { a: 'a1', b: 'b1' },
      ],
    })
    ctx.gridRootEl = { focus: vi.fn() }
    ed.onCellDoubleClick(1, 0)
    const ev = { ...fakeEvent('Tab'), shiftKey: true } as unknown as KeyboardEvent
    ;(ev as any).preventDefault = vi.fn()
    ;(ev as any).stopPropagation = vi.fn()
    ed.onEditorKeyDown(ev)
    // Off the left edge -> last column of the row above.
    expect(ctx.activeCalls.at(-1)).toEqual([0, 1])
  })
})

describe('saveEditingCell when the row leaves the row model (#49)', () => {
  it('writes through the captured row when a filter hides it mid-edit', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'old' }, { a: 'other' }],
    })
    const target = ctx.internalData[0]
    ed.onCellDoubleClick(0, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'typed' }
    // A filter typed into the filter row drops the edited row from BOTH the
    // page slice and the full filtered model while the editor is still open.
    ctx._rows = ctx._rows.slice(1)
    ctx._rowsBeforePagination = ctx._rows
    ed.saveEditingCell()
    expect(target.a).toBe('typed')
    expect(ctx.editingCell).toBeNull()
  })

  it('still resolves a row that is only off the current page', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'old' }, { a: 'other' }],
    })
    const target = ctx.internalData[0]
    ed.onCellDoubleClick(0, 0)
    ctx.editingCell = { ...ctx.editingCell, value: 'typed' }
    // Paginated away: gone from `allRows`, still in the full filtered model.
    ctx._rowsBeforePagination = ctx._rows
    ctx._rows = ctx._rows.slice(1)
    ed.saveEditingCell()
    expect(target.a).toBe('typed')
  })
})

describe('focusOnMount', () => {
  let rafCb: FrameRequestCallback | null = null
  beforeEach(() => {
    rafCb = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    })
  })

  function fakeInput(value: string) {
    return {
      value,
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
    }
  }

  it('selects all when editorSelectAll is set', () => {
    const { ctx, ed } = editingFor()
    ctx.editorSelectAll = true
    const node = fakeInput('hello')
    ed.focusOnMount(node as any)
    rafCb?.(0)
    expect(node.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(node.select).toHaveBeenCalled()
    expect(node.setSelectionRange).not.toHaveBeenCalled()
  })

  it('places the caret at the end when not selecting all', () => {
    const { ctx, ed } = editingFor()
    ctx.editorSelectAll = false
    const node = fakeInput('hello')
    ed.focusOnMount(node as any)
    rafCb?.(0)
    expect(node.setSelectionRange).toHaveBeenCalledWith(5, 5)
    expect(node.select).not.toHaveBeenCalled()
  })

  it('swallows errors from inputs that reject selection ranges', () => {
    const { ctx, ed } = editingFor()
    ctx.editorSelectAll = false
    const node = {
      value: '2020-01-01',
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: () => {
        throw new Error('unsupported')
      },
    }
    ed.focusOnMount(node as any)
    expect(() => rafCb?.(0)).not.toThrow()
    expect(node.focus).toHaveBeenCalled()
  })
})

describe('onCellDoubleClick', () => {
  it('enters edit mode seeded with the current display value', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'val' }],
    })
    ed.onCellDoubleClick(0, 0)
    expect(ctx.editorSelectAll).toBe(true)
    expect(ctx.editingCell).toEqual({
      rowId: '0',
      columnId: 'a',
      editorType: 'text',
      value: 'val',
      rowRef: ctx.internalData[0],
    })
    expect(ctx.activeCalls).toEqual([[0, 0]])
    expect(ctx.selectionCalls).toEqual([[0, 0]])
  })

  it('prefers an edited override as the seed value', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'base' }],
    })
    ctx.editedCellValues['0:a'] = 'override'
    ed.onCellDoubleClick(0, 0)
    expect(ctx.editingCell.value).toBe('override')
  })

  it('returns early when editing is disabled', () => {
    const { ctx, ed } = editingFor({ editingEnabled: false })
    ed.onCellDoubleClick(0, 0)
    expect(ctx.editingCell).toBeNull()
  })

  it('returns early for missing row/column or group rows', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'x' }],
      groupRows: new Set([0]),
    })
    ed.onCellDoubleClick(99, 0)
    ed.onCellDoubleClick(0, 99)
    ed.onCellDoubleClick(0, 0) // group row
    expect(ctx.editingCell).toBeNull()
  })

  it('returns early for a non-editable cell', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editable: false, editorType: 'text' }],
      data: [{ a: 'x' }],
    })
    ed.onCellDoubleClick(0, 0)
    expect(ctx.editingCell).toBeNull()
  })

  it('is a no-op when already editing the same cell', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text' }],
      data: [{ a: 'x' }],
    })
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'mid-edit' }
    ed.onCellDoubleClick(0, 0)
    expect(ctx.editingCell.value).toBe('mid-edit') // untouched
    expect(ctx.activeCalls).toEqual([]) // setActiveCell not called
  })

  it('seeds a multi-select list editor with an array', () => {
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'list', editorMultiple: true },
      ],
      data: [{ a: 'one' }],
    })
    ed.onCellDoubleClick(0, 0)
    expect(Array.isArray(ctx.editingCell.value)).toBe(true)
    expect(ctx.editingCell.value).toEqual(['one'])
  })

  it('unwraps an array seed for a single-select list editor', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'list' }],
      data: [{ a: ['first', 'second'] }],
    })
    ed.onCellDoubleClick(0, 0)
    expect(ctx.editingCell.value).toBe('first')
  })

  it('uses empty string for a single-select chips editor seeded from an empty array', () => {
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'chips' }],
      data: [{ a: [] }],
    })
    ed.onCellDoubleClick(0, 0)
    expect(ctx.editingCell.value).toBe('')
  })
})

describe('applyPastedText reports and records what it wrote', () => {
  function pasteReady(text: string) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue(text) },
      configurable: true,
    })
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editable: true, editorType: 'text' },
        { id: 'b', field: 'b', editable: true, editorType: 'text' },
      ],
      data: [{ a: 'a0', b: 'b0' }, { a: 'a1', b: 'b1' }, { a: 'a2', b: 'b2' }],
    })
    ctx.setActiveCell(1, 0)
    ctx.selectionRange = { anchor: { rowIndex: 1, colIndex: 0 }, focus: { rowIndex: 1, colIndex: 0 } }
    return { ctx, ed }
  }

  it('fires onCellValueChange for every cell a block paste changed', async () => {
    // A formula engine behind the grid only sees a value through this hook;
    // a paste that skipped it left the engine holding the old cells.
    const { ctx, ed } = pasteReady('x\ty\nz\tb2')
    const onCellValueChange = vi.fn()
    ctx.props.onCellValueChange = onCellValueChange
    await ed.pasteFromClipboard()
    expect(ctx.internalData[1]).toEqual({ a: 'x', b: 'y' })
    expect(ctx.internalData[2]).toEqual({ a: 'z', b: 'b2' })
    // b2 was already b2: no event for a cell that did not change.
    expect(onCellValueChange).toHaveBeenCalledTimes(3)
    expect(onCellValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 1, columnId: 'a', oldValue: 'a1', newValue: 'x' }),
    )
    expect(onCellValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 2, columnId: 'a', oldValue: 'a2', newValue: 'z' }),
    )
  })

  it('records the paste as one grouped history entry', async () => {
    const { ctx, ed } = pasteReady('x\ty\nz\tw')
    await ed.pasteFromClipboard()
    expect(ctx.history).toHaveLength(4)
    const groups = new Set(ctx.history.map((s: { groupId?: string }) => s.groupId))
    expect(groups.size).toBe(1)
    expect([...groups][0]).toBeDefined()
    expect(ctx.history[0]).toMatchObject({ rowId: '1', columnId: 'a', field: 'a', before: 'a1', after: 'x' })
  })

  it('writes nothing, records nothing, when the paste changes nothing', async () => {
    const { ctx, ed } = pasteReady('a1\tb1')
    const onCellValueChange = vi.fn()
    ctx.props.onCellValueChange = onCellValueChange
    const before = ctx.internalData
    await ed.pasteFromClipboard()
    expect(ctx.internalData).toBe(before)
    expect(ctx.history).toHaveLength(0)
    expect(onCellValueChange).not.toHaveBeenCalled()
  })
})

describe('onPasteClipboard', () => {
  const grid = () => editingFor({
    columns: [
      { id: 'a', field: 'a', editorType: 'text', editable: true },
      { id: 'b', field: 'b', editorType: 'text', editable: true },
    ],
    data: [{ a: '', b: '' }, { a: '', b: '' }],
  })

  it('hands the native paste event\'s text and HTML to the handler and applies nothing itself when it returns true', () => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn() }, configurable: true })
    const { ctx, ed } = grid()
    const seen: unknown[] = []
    ctx.props.onPasteClipboard = (payload: unknown) => { seen.push(payload); return true }
    const ev = {
      clipboardData: { getData: (type: string) => (type === 'text/html' ? '<table><tr><td x:fmla="=A1">1</td></tr></table>' : '1') },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent
    ed.onGridPaste(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(seen).toEqual([{ text: '1', html: '<table><tr><td x:fmla="=A1">1</td></tr></table>', source: 'event' }])
    expect(ctx.internalData[0]).toMatchObject({ a: '', b: '' })
  })

  it('falls through to the plain paste when the handler declines', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const { ctx, ed } = grid()
    ctx.props.onPasteClipboard = () => undefined
    ctx.selectionRange = { anchor: { rowIndex: 0, colIndex: 0 }, focus: { rowIndex: 0, colIndex: 0 } }
    const ev = {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'X\tY' : '') },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent
    ed.onGridPaste(ev)
    expect(ctx.internalData[0]).toMatchObject({ a: 'X', b: 'Y' })
  })

  it('reads both types through navigator.clipboard.read on the async path', async () => {
    const blob = (text: string) => ({ text: async () => text })
    const read = vi.fn().mockResolvedValue([
      { types: ['text/plain', 'text/html'], getType: async (t: string) => blob(t === 'text/html' ? '<b>h</b>' : 'p') },
    ])
    Object.defineProperty(navigator, 'clipboard', { value: { read, readText: vi.fn() }, configurable: true })
    const { ctx, ed } = grid()
    const seen: unknown[] = []
    ctx.props.onPasteClipboard = (payload: unknown) => { seen.push(payload); return true }
    await ed.pasteFromClipboard()
    expect(seen).toEqual([{ text: 'p', html: '<b>h</b>', source: 'async' }])
  })

  it('the paste is one history group even when the handler writes several cells', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const { ctx, ed } = grid()
    let groupSeen: unknown = 'unset'
    ctx.props.onPasteClipboard = () => { groupSeen = ctx.historyGroupId; return true }
    ed.onGridPaste({ clipboardData: { getData: () => 'x' }, preventDefault: vi.fn() } as unknown as ClipboardEvent)
    // The handler ran inside an ambient group, and the group closed after it.
    expect(groupSeen).toBeTruthy()
    expect(ctx.historyGroupId).toBeUndefined()
  })
})

describe('clipboard fallbacks (non-paste branches only)', () => {
  // onGridPaste and pasteFromClipboard guard on navigator.clipboard.readText.
  // The transformation itself is covered just above; here we only assert
  // the early-return guards.

  it('pasteFromClipboard returns early when the async API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const { ctx, ed } = editingFor()
    await ed.pasteFromClipboard()
    expect(ctx.grid.store.setState).not.toHaveBeenCalled()
  })

  it('pasteFromClipboard swallows a rejected readText', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    const { ctx, ed } = editingFor()
    await expect(ed.pasteFromClipboard()).resolves.toBeUndefined()
    expect(ctx.grid.store.setState).not.toHaveBeenCalled()
  })

  it('onGridPaste ignores the native event when the async API is present', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn() },
      configurable: true,
    })
    const { ctx, ed } = editingFor()
    const ev = {
      clipboardData: { getData: () => 'a\tb' },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent
    ed.onGridPaste(ev)
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(ctx.grid.store.setState).not.toHaveBeenCalled()
  })

  it('onGridPaste returns early on empty clipboard text in the fallback path', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const { ctx, ed } = editingFor()
    const ev = {
      clipboardData: { getData: () => '' },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent
    ed.onGridPaste(ev)
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(ctx.grid.store.setState).not.toHaveBeenCalled()
  })

  it('onGridPaste applies pasted text via the fallback path', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const { ctx, ed } = editingFor({
      columns: [
        { id: 'a', field: 'a', editorType: 'text', editable: true },
        { id: 'b', field: 'b', editorType: 'text', editable: true },
      ],
      data: [
        { a: '', b: '' },
        { a: '', b: '' },
      ],
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const ev = {
      clipboardData: { getData: () => 'X\tY\nZ\tW' },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent
    ed.onGridPaste(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(ctx.internalData[0]).toMatchObject({ a: 'X', b: 'Y' })
    expect(ctx.internalData[1]).toMatchObject({ a: 'Z', b: 'W' })
  })

  it('pastes into the selected row when getRowId does not return the array index', () => {
    // Regression: the row -> data-slot lookup was `Number(row.id)`, which is
    // the array index only under the DEFAULT getRowId. With 1-based ids
    // (`getRowId={(t) => String(t.id)}`) every paste landed one row BELOW the
    // selection; with non-numeric ids it parsed to NaN and wrote nothing.
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text', editable: true }],
      data: [{ a: 'x0' }, { a: 'x1' }, { a: 'x2' }],
    })
    ctx._rows.forEach((r: any, i: number) => { r.id = String(i + 1) })
    ctx.selectionRange = {
      anchor: { rowIndex: 1, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 0 },
    }
    ed.onGridPaste({
      clipboardData: { getData: () => 'PASTED' },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent)
    expect(ctx.internalData.map((d: any) => d.a)).toEqual(['x0', 'PASTED', 'x2'])
  })

  it('onGridPaste bails while a cell is being edited (native editor paste wins)', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined, // fallback path (Firefox / insecure) - would otherwise hijack
      configurable: true,
    })
    const { ctx, ed } = editingFor({
      columns: [{ id: 'a', field: 'a', editorType: 'text', editable: true }],
      data: [{ a: 'orig' }],
    })
    ctx.selectionRange = { anchor: { rowIndex: 0, colIndex: 0 }, focus: { rowIndex: 0, colIndex: 0 } }
    ctx.editingCell = { rowId: '0', columnId: 'a', editorType: 'text', value: 'orig' }
    const ev = {
      clipboardData: { getData: () => 'PASTED' },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent
    ed.onGridPaste(ev)
    // The grid must NOT preventDefault (so the editor's native paste proceeds)
    // and must NOT write to the data cell.
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(ctx.internalData[0]).toMatchObject({ a: 'orig' })
  })
})
