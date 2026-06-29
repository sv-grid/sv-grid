import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClipboard } from './clipboard'

// ---------------------------------------------------------------------------
// Fake controller `ctx` builder. The clipboard handlers operate entirely
// through this handle, so a hand-rolled stub lets us exercise every branch
// without mounting the full grid.
// ---------------------------------------------------------------------------

interface FakeOptions {
  /** Column definitions: id, field, editable, editorType. */
  columns?: Array<{
    id: string
    field?: string
    editable?: boolean
    editorType?: string
  }>
  data?: Array<Record<string, unknown>>
  /** Which rows can expand (group rows). Keyed by row index. */
  groupRows?: Set<number>
  /** Predicate for editability; default true. */
  editableAt?: (r: number, c: number) => boolean
}

function makeCtx(opts: FakeOptions = {}) {
  const columns = opts.columns ?? [
    { id: 'a', field: 'a', editable: true, editorType: 'text' },
    { id: 'b', field: 'b', editable: true, editorType: 'text' },
  ]
  const data = (opts.data ?? [
    { a: 'a0', b: 'b0' },
    { a: 'a1', b: 'b1' },
  ]).map((d) => ({ ...d }))

  const allColumns = columns.map((c) => ({
    id: c.id,
    columnDef: {
      field: c.field,
      editable: c.editable,
      editorType: c.editorType,
    },
  }))

  // allRows mirror internalData by index; row.id === index as a string.
  const buildRows = () =>
    data.map((row, index) => ({
      id: String(index),
      original: row,
      getCanExpand: () => opts.groupRows?.has(index) ?? false,
      getCellValueByColumnId: (colId: string) =>
        (row as Record<string, unknown>)[colId],
    }))

  let activeCell: { rowIndex: number; colIndex: number } | null = null

  const ctx: any = {
    internalData: data,
    allColumns,
    get allRows() {
      // Recompute from current internalData so writeCellRaw's
      // `r.original === row` lookup stays consistent with internalData.
      return ctx._rows
    },
    _rows: buildRows(),
    selectionRange: { anchor: null, focus: null },
    fillDrag: null,
    editedCellValues: {},
    userHasActivatedCell: false,
    gridRootEl: null,
    props: {},
    findColumnById: (id: string) => allColumns.find((c) => c.id === id),
    isCellEditableAt: opts.editableAt ?? (() => true),
    getCellDisplayValue: vi.fn(
      (_rowId: string, _colId: string, base: unknown) => base,
    ),
    grid: {
      getState: () => ({ activeCell }),
      store: { setState: vi.fn() },
    },
    _setActiveCell: (c: { rowIndex: number; colIndex: number } | null) => {
      activeCell = c
    },
  }

  // Keep _rows pointing at the live internalData objects whenever it is
  // reassigned by writeCellRaw / clearSelectedCells.
  let backing = data
  Object.defineProperty(ctx, 'internalData', {
    get: () => backing,
    set: (next: Array<Record<string, unknown>>) => {
      backing = next
      ctx._rows = next.map((row, index) => ({
        id: String(index),
        original: row,
        getCanExpand: () => opts.groupRows?.has(index) ?? false,
        getCellValueByColumnId: (colId: string) =>
          (row as Record<string, unknown>)[colId],
      }))
    },
  })

  return ctx
}

describe('readCellRaw', () => {
  it('reads the underlying field value', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    expect(cb.readCellRaw(0, 'a')).toBe('a0')
    expect(cb.readCellRaw(1, 'b')).toBe('b1')
  })

  it('returns undefined when the row is missing', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    expect(cb.readCellRaw(99, 'a')).toBeUndefined()
  })

  it('returns undefined when the column has no field', () => {
    const ctx = makeCtx({
      columns: [{ id: 'noField' }],
      data: [{ a: 1 }],
    })
    const cb = createClipboard(ctx)
    expect(cb.readCellRaw(0, 'noField')).toBeUndefined()
  })
})

describe('writeCellRaw', () => {
  it('writes a new value and fires onCellValueChange', () => {
    const onCellValueChange = vi.fn()
    const ctx = makeCtx()
    ctx.props.onCellValueChange = onCellValueChange
    const cb = createClipboard(ctx)
    cb.writeCellRaw(0, 'a', 'X')
    expect(ctx.internalData[0].a).toBe('X')
    // Original array object was replaced (immutable update).
    expect(onCellValueChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rowIndex: 0,
        columnId: 'a',
        oldValue: 'a0',
        newValue: 'X',
      }),
    )
  })

  it('records the edit in editedCellValues keyed by rowId:colId', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    cb.writeCellRaw(1, 'b', 'Y')
    expect(ctx.editedCellValues['1:b']).toBe('Y')
  })

  it('is a no-op when the value is unchanged', () => {
    const onCellValueChange = vi.fn()
    const ctx = makeCtx()
    ctx.props.onCellValueChange = onCellValueChange
    const cb = createClipboard(ctx)
    cb.writeCellRaw(0, 'a', 'a0')
    expect(onCellValueChange).not.toHaveBeenCalled()
  })

  it('does nothing when the row is missing', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    cb.writeCellRaw(99, 'a', 'Z')
    expect(ctx.internalData).toHaveLength(2)
  })

  it('does nothing when the column has no field', () => {
    const ctx = makeCtx({
      columns: [{ id: 'noField' }],
      data: [{ a: 1 }],
    })
    const cb = createClipboard(ctx)
    cb.writeCellRaw(0, 'noField', 5)
    expect(ctx.internalData[0]).toEqual({ a: 1 })
  })
})

describe('clearSelectedCellValues', () => {
  it('nulls every editable cell in the selection range', () => {
    const ctx = makeCtx()
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 1 },
    }
    const cb = createClipboard(ctx)
    cb.clearSelectedCellValues()
    expect(ctx.internalData[0]).toEqual({ a: null, b: null })
    expect(ctx.internalData[1]).toEqual({ a: null, b: null })
  })

  it('skips non-editable cells', () => {
    const ctx = makeCtx({ editableAt: (r, c) => !(r === 0 && c === 0) })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 1 },
    }
    const cb = createClipboard(ctx)
    cb.clearSelectedCellValues()
    expect(ctx.internalData[0].a).toBe('a0') // untouched
    expect(ctx.internalData[0].b).toBeNull()
  })

  it('clears just the active cell when no range is selected', () => {
    const ctx = makeCtx()
    ctx.userHasActivatedCell = true
    ctx._setActiveCell({ rowIndex: 1, colIndex: 1 })
    const cb = createClipboard(ctx)
    cb.clearSelectedCellValues()
    expect(ctx.internalData[1].b).toBeNull()
    expect(ctx.internalData[0].a).toBe('a0')
  })

  it('does nothing for the active cell when not activated', () => {
    const ctx = makeCtx()
    ctx.userHasActivatedCell = false
    ctx._setActiveCell({ rowIndex: 1, colIndex: 1 })
    const cb = createClipboard(ctx)
    cb.clearSelectedCellValues()
    expect(ctx.internalData[1].b).toBe('b1')
  })
})

describe('startFillDrag', () => {
  function fakeEvent() {
    return {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    } as unknown as PointerEvent
  }

  it('seeds the drag from the selection range', () => {
    const ctx = makeCtx()
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 1 },
    }
    const cb = createClipboard(ctx)
    cb.startFillDrag(fakeEvent(), 2, 1)
    expect(ctx.fillDrag).toEqual({
      sourceMinRow: 0,
      sourceMaxRow: 1,
      sourceMinCol: 0,
      sourceMaxCol: 1,
      targetRow: 2,
      targetCol: 1,
    })
  })

  it('seeds a 1x1 drag from the active cell when no range', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    const event = fakeEvent()
    cb.startFillDrag(event, 3, 4)
    expect(ctx.fillDrag).toEqual({
      sourceMinRow: 3,
      sourceMaxRow: 3,
      sourceMinCol: 4,
      sourceMaxCol: 4,
      targetRow: 3,
      targetCol: 4,
    })
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalled()
  })
})

describe('onFillPointerMove', () => {
  it('does nothing when there is no active fillDrag', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    cb.onFillPointerMove({ clientX: 0, clientY: 0 } as PointerEvent)
    expect(ctx.fillDrag).toBeNull()
  })

  it('updates the target when a cell is found under the pointer', () => {
    const ctx = makeCtx()
    ctx.fillDrag = {
      sourceMinRow: 0,
      sourceMaxRow: 0,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      targetRow: 0,
      targetCol: 0,
    }
    const cb = createClipboard(ctx)
    const td = document.createElement('td')
    td.setAttribute('data-svgrid-row', '2')
    td.setAttribute('data-svgrid-col', '1')
    document.elementFromPoint = () => td
    cb.onFillPointerMove({ clientX: 5, clientY: 5 } as PointerEvent)
    expect(ctx.fillDrag.targetRow).toBe(2)
    expect(ctx.fillDrag.targetCol).toBe(1)
  })

  it('does not re-set the drag when hovering the same target', () => {
    const ctx = makeCtx()
    const original = {
      sourceMinRow: 0,
      sourceMaxRow: 0,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      targetRow: 1,
      targetCol: 1,
    }
    ctx.fillDrag = original
    const cb = createClipboard(ctx)
    const td = document.createElement('td')
    td.setAttribute('data-svgrid-row', '1')
    td.setAttribute('data-svgrid-col', '1')
    document.elementFromPoint = () => td
    cb.onFillPointerMove({ clientX: 5, clientY: 5 } as PointerEvent)
    expect(ctx.fillDrag).toBe(original) // unchanged reference
  })

  it('ignores a pointer that is not over a grid cell', () => {
    const ctx = makeCtx()
    const original = {
      sourceMinRow: 0,
      sourceMaxRow: 0,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      targetRow: 0,
      targetCol: 0,
    }
    ctx.fillDrag = original
    const cb = createClipboard(ctx)
    document.elementFromPoint = () => document.createElement('div')
    cb.onFillPointerMove({ clientX: 5, clientY: 5 } as PointerEvent)
    expect(ctx.fillDrag).toBe(original)
  })
})

describe('onFillPointerUp / applyFillPattern', () => {
  it('does nothing when there is no fillDrag', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    cb.onFillPointerUp()
    expect(ctx.selectionRange).toEqual({ anchor: null, focus: null })
  })

  it('fills downward from a numeric source pattern', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'number' }],
      data: [{ a: 1 }, { a: 2 }, { a: 0 }, { a: 0 }],
    })
    ctx.fillDrag = {
      sourceMinRow: 0,
      sourceMaxRow: 1,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      targetRow: 3,
      targetCol: 0,
    }
    const cb = createClipboard(ctx)
    cb.onFillPointerUp()
    // 1,2 -> linear pattern continues 3,4
    expect(ctx.internalData[2].a).toBe(3)
    expect(ctx.internalData[3].a).toBe(4)
    expect(ctx.fillDrag).toBeNull()
    expect(ctx.selectionRange.focus).toEqual({ rowIndex: 3, colIndex: 0 })
  })

  it('fills upward, reverse-extrapolating the pattern', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'number' }],
      data: [{ a: 0 }, { a: 0 }, { a: 10 }, { a: 20 }],
    })
    ctx.fillDrag = {
      sourceMinRow: 2,
      sourceMaxRow: 3,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      targetRow: 0,
      targetCol: 0,
    }
    const cb = createClipboard(ctx)
    cb.applyFillPattern()
    // reversed source 20,10 -> continues 0,-10 going up; row1=0, row0=-10
    expect(ctx.internalData[1].a).toBe(0)
    expect(ctx.internalData[0].a).toBe(-10)
  })

  it('skips columns that are not editable', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: false, editorType: 'number' }],
      data: [{ a: 1 }, { a: 2 }, { a: 0 }],
    })
    ctx.fillDrag = {
      sourceMinRow: 0,
      sourceMaxRow: 1,
      sourceMinCol: 0,
      sourceMaxCol: 0,
      targetRow: 2,
      targetCol: 0,
    }
    const cb = createClipboard(ctx)
    cb.applyFillPattern()
    expect(ctx.internalData[2].a).toBe(0) // untouched
  })

  it('fills horizontally to the right', () => {
    const ctx = makeCtx({
      columns: [
        { id: 'a', field: 'a', editable: true, editorType: 'number' },
        { id: 'b', field: 'b', editable: true, editorType: 'number' },
        { id: 'c', field: 'c', editable: true, editorType: 'number' },
      ],
      data: [{ a: 2, b: 4, c: 0 }],
    })
    ctx.fillDrag = {
      sourceMinRow: 0,
      sourceMaxRow: 0,
      sourceMinCol: 0,
      sourceMaxCol: 1,
      targetRow: 0,
      targetCol: 2,
    }
    const cb = createClipboard(ctx)
    cb.applyFillPattern()
    // 2,4 -> next is 6
    expect(ctx.internalData[0].c).toBe(6)
  })

  it('fills horizontally to the left', () => {
    const ctx = makeCtx({
      columns: [
        { id: 'a', field: 'a', editable: true, editorType: 'number' },
        { id: 'b', field: 'b', editable: true, editorType: 'number' },
        { id: 'c', field: 'c', editable: true, editorType: 'number' },
      ],
      data: [{ a: 0, b: 10, c: 20 }],
    })
    ctx.fillDrag = {
      sourceMinRow: 0,
      sourceMaxRow: 0,
      sourceMinCol: 1,
      sourceMaxCol: 2,
      targetRow: 0,
      targetCol: 0,
    }
    const cb = createClipboard(ctx)
    cb.applyFillPattern()
    // reversed 20,10 -> next going left is 0
    expect(ctx.internalData[0].a).toBe(0)
  })
})

describe('toggleBooleanCell', () => {
  it('flips a falsy cell to true and records the edit', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true }],
      data: [{ a: false }],
    })
    const cb = createClipboard(ctx)
    cb.toggleBooleanCell(0, 0)
    expect(ctx.internalData[0].a).toBe(true)
    expect(ctx.editedCellValues['0:a']).toBe(true)
    expect(ctx.grid.store.setState).toHaveBeenCalled()
  })

  it('flips a truthy cell to false', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true }],
      data: [{ a: true }],
    })
    const cb = createClipboard(ctx)
    cb.toggleBooleanCell(0, 0)
    expect(ctx.internalData[0].a).toBe(false)
  })

  it('does nothing when the row or column is missing', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a' }],
      data: [{ a: true }],
    })
    const cb = createClipboard(ctx)
    cb.toggleBooleanCell(99, 0)
    cb.toggleBooleanCell(0, 99)
    expect(ctx.internalData[0].a).toBe(true)
  })

  it('does nothing when the column has no field', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a' }],
      data: [{ a: true }],
    })
    const cb = createClipboard(ctx)
    cb.toggleBooleanCell(0, 0)
    expect(ctx.grid.store.setState).not.toHaveBeenCalled()
  })
})

describe('copySelectionToClipboard', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  it('does nothing when there is no selection', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    cb.copySelectionToClipboard()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('writes the selection as tab/newline separated text', () => {
    const ctx = makeCtx({
      data: [
        { a: 'a0', b: 'b0' },
        { a: 'a1', b: 'b1' },
      ],
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 1 },
    }
    const cb = createClipboard(ctx)
    cb.copySelectionToClipboard()
    expect(writeText).toHaveBeenCalledWith('a0\tb0\na1\tb1')
  })

  it('emits empty strings for missing columns and nullish values', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a' }],
      data: [{ a: null }],
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 1 }, // col 1 doesn't exist
    }
    const cb = createClipboard(ctx)
    cb.copySelectionToClipboard()
    expect(writeText).toHaveBeenCalledWith('\t')
  })

  it('skips group rows', () => {
    const ctx = makeCtx({
      data: [
        { a: 'g', b: 'g' },
        { a: 'a1', b: 'b1' },
      ],
      groupRows: new Set([0]),
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 1 },
    }
    const cb = createClipboard(ctx)
    cb.copySelectionToClipboard()
    expect(writeText).toHaveBeenCalledWith('a1\tb1')
  })

  it('falls back to legacy copy when clipboard API is absent', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const execCommand = vi.fn().mockReturnValue(true)
    // @ts-expect-error - jsdom lacks execCommand by default
    document.execCommand = execCommand
    const ctx = makeCtx()
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    cb.copySelectionToClipboard()
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('swallows an execCommand error in the legacy path', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    // @ts-expect-error - override execCommand to throw
    document.execCommand = () => {
      throw new Error('blocked')
    }
    const ctx = makeCtx()
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    // Must not throw even though execCommand blows up.
    expect(() => cb.copySelectionToClipboard()).not.toThrow()
  })
})

describe('clearSelectedCells', () => {
  it('returns false when there is no anchor or active cell', () => {
    const ctx = makeCtx()
    const cb = createClipboard(ctx)
    expect(cb.clearSelectedCells()).toBe(false)
  })

  it('clears a text cell to empty string and returns true', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'text' }],
      data: [{ a: 'hello' }],
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    expect(cb.clearSelectedCells()).toBe(true)
    expect(ctx.internalData[0].a).toBe('')
    expect(ctx.grid.store.setState).toHaveBeenCalled()
  })

  it('clears a number cell via parseEditorValue coercion', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'number' }],
      data: [{ a: 5 }],
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    cb.clearSelectedCells()
    // parseEditorValue('number', '') coerces '' -> 0 (Number('') is finite).
    expect(ctx.internalData[0].a).toBe(0)
  })

  it('falls back to the active cell when no selection range', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'text' }],
      data: [{ a: 'x' }],
    })
    ctx._setActiveCell({ rowIndex: 0, colIndex: 0 })
    const cb = createClipboard(ctx)
    expect(cb.clearSelectedCells()).toBe(true)
    expect(ctx.internalData[0].a).toBe('')
  })

  it('skips group rows and non-editable cells, returning false when nothing changed', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'text' }],
      data: [{ a: 'g' }],
      groupRows: new Set([0]),
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    expect(cb.clearSelectedCells()).toBe(false)
    expect(ctx.internalData[0].a).toBe('g')
  })

  it('skips cells with no field', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a' }],
      data: [{ a: 'x' }],
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    expect(cb.clearSelectedCells()).toBe(false)
  })

  it('skips non-editable cells', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'text' }],
      data: [{ a: 'x' }],
      editableAt: () => false,
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    expect(cb.clearSelectedCells()).toBe(false)
    expect(ctx.internalData[0].a).toBe('x')
  })

  it('skips rows whose id maps outside the data bounds', () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'text' }],
      data: [{ a: 'x' }],
    })
    // Force the row's id to a non-numeric value so Number(id) is NaN
    // and the integer/bounds guard skips it.
    ctx._rows[0].id = 'not-a-number'
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    expect(cb.clearSelectedCells()).toBe(false)
    expect(ctx.internalData[0].a).toBe('x')
  })
})

describe('cutSelectionToClipboard', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('copies then clears the selection', async () => {
    const ctx = makeCtx({
      columns: [{ id: 'a', field: 'a', editable: true, editorType: 'text' }],
      data: [{ a: 'hello' }],
    })
    ctx.selectionRange = {
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    }
    const cb = createClipboard(ctx)
    await cb.cutSelectionToClipboard()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
    expect(ctx.internalData[0].a).toBe('')
  })
})
