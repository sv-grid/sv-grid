import { describe, expect, it, vi } from 'vitest'
import { createCellRender } from './cell-render'

// --- minimal fakes -------------------------------------------------------
//
// createCellRender only reaches into a small slice of the controller: it
// reads `ctx.props`, `ctx.grid`, `ctx.conditionalColumnStats`,
// `ctx.noteOverrides` and `ctx.editorOptionsCache`. We build a row/column
// shape that mirrors the @svgrid/grid runtime closely enough to exercise
// every branch.

type AnyRow = {
  id: string
  original: Record<string, unknown>
  getCellValueByColumnId: (colId: string) => unknown
}

function makeRow(id: string, data: Record<string, unknown>): AnyRow {
  return {
    id,
    original: data,
    getCellValueByColumnId: (colId: string) => data[colId],
  }
}

function makeColumn(id: string, def: Record<string, unknown> = {}): any {
  return { id, columnDef: { ...def } }
}

function makeCtx(overrides: Partial<any> = {}): any {
  return {
    props: {},
    grid: { id: 'grid' },
    conditionalColumnStats: new Map(),
    noteOverrides: {},
    editorOptionsCache: {},
    ...overrides,
  }
}

describe('createCellRender / cellConditionalFormat', () => {
  it('returns null when no conditionalFormats are configured', () => {
    const cr = createCellRender(makeCtx())
    const out = cr.cellConditionalFormat(makeRow('r1', { amt: 5 }), makeColumn('amt'), 5)
    expect(out).toBeNull()
  })

  it('returns null when conditionalFormats is an empty array', () => {
    const cr = createCellRender(makeCtx({ props: { conditionalFormats: [] } }))
    expect(cr.cellConditionalFormat(makeRow('r', {}), makeColumn('amt'), 1)).toBeNull()
  })

  it('resolves a rule format against the value', () => {
    const formats = [
      {
        type: 'rule',
        columns: ['amt'],
        when: ({ value }: { value: unknown }) => Number(value) > 10,
        background: '#ff0000',
        fontWeight: 700,
      },
    ]
    const cr = createCellRender(makeCtx({ props: { conditionalFormats: formats } }))
    const hit = cr.cellConditionalFormat(makeRow('r', { amt: 20 }), makeColumn('amt'), 20)
    expect(hit?.background).toBe('#ff0000')
    expect(hit?.fontWeight).toBe(700)

    const miss = cr.cellConditionalFormat(makeRow('r', { amt: 1 }), makeColumn('amt'), 1)
    expect(miss).toEqual({})
  })

  it('passes the precomputed column stat through to colorScale formats', () => {
    const formats = [{ type: 'colorScale', min: '#fff', max: '#000' } as any]
    const stats = new Map([['amt', { min: 0, max: 100 }]])
    const cr = createCellRender(
      makeCtx({ props: { conditionalFormats: formats }, conditionalColumnStats: stats }),
    )
    const out = cr.cellConditionalFormat(makeRow('r', { amt: 50 }), makeColumn('amt'), 50)
    expect(out).not.toBeNull()
    expect(out?.background).toBeDefined()
  })
})

describe('createCellRender / computeRowClass', () => {
  it('returns empty string when no rowClass configured', () => {
    const cr = createCellRender(makeCtx())
    expect(cr.computeRowClass(makeRow('r', {}), 0)).toBe('')
  })

  it('resolves a string rowClass', () => {
    const rowClass = vi.fn(() => 'highlight')
    const cr = createCellRender(makeCtx({ props: { rowClass } }))
    const row = makeRow('r', { a: 1 })
    expect(cr.computeRowClass(row, 3)).toBe('highlight')
    expect(rowClass).toHaveBeenCalledWith({ row: row.original, rowIndex: 3 })
  })

  it('resolves an array / object rowClass', () => {
    const cr = createCellRender(
      makeCtx({ props: { rowClass: () => ['a', '', 'b'] } }),
    )
    expect(cr.computeRowClass(makeRow('r', {}), 0)).toBe('a b')

    const cr2 = createCellRender(
      makeCtx({ props: { rowClass: () => ({ on: true, off: false }) } }),
    )
    expect(cr2.computeRowClass(makeRow('r', {}), 0)).toBe('on')
  })
})

describe('createCellRender / computeCellClass', () => {
  it('returns empty string when cellClass is null/undefined', () => {
    const cr = createCellRender(makeCtx())
    expect(cr.computeCellClass(makeRow('r', {}), makeColumn('a'))).toBe('')
  })

  it('resolves a string cellClass', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.computeCellClass(makeRow('r', {}), makeColumn('a', { cellClass: 'red' })),
    ).toBe('red')
  })

  it('resolves an array cellClass', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.computeCellClass(makeRow('r', {}), makeColumn('a', { cellClass: ['x', 'y'] })),
    ).toBe('x y')
  })

  it('invokes a function cellClass with a minimal cell context', () => {
    const cellClass = vi.fn((c: any) => (c.getValue() > 5 ? 'big' : 'small'))
    const cr = createCellRender(makeCtx())
    const row = makeRow('r', { score: 9 })
    expect(cr.computeCellClass(row, makeColumn('score', { cellClass }))).toBe('big')
    expect(cellClass).toHaveBeenCalledTimes(1)
    const passed = cellClass.mock.calls[0][0]
    expect(passed.row).toBe(row)
    expect(passed.getValue()).toBe(9)
  })

  it('returns empty string for an unsupported cellClass type (number)', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.computeCellClass(makeRow('r', {}), makeColumn('a', { cellClass: 123 as any })),
    ).toBe('')
  })
})

describe('createCellRender / computeCellTooltip', () => {
  it('returns null when no tooltip configured', () => {
    const cr = createCellRender(makeCtx())
    expect(cr.computeCellTooltip(makeRow('r', {}), makeColumn('a'))).toBeNull()
  })

  it('returns a static string tooltip, but null for empty string', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.computeCellTooltip(makeRow('r', {}), makeColumn('a', { tooltip: 'help' })),
    ).toBe('help')
    expect(
      cr.computeCellTooltip(makeRow('r', {}), makeColumn('a', { tooltip: '' })),
    ).toBeNull()
  })

  it('invokes a function tooltip and stringifies the result', () => {
    const tooltip = (c: any) => `val=${c.getValue()}`
    const cr = createCellRender(makeCtx())
    const row = makeRow('r', { a: 42 })
    expect(cr.computeCellTooltip(row, makeColumn('a', { tooltip }))).toBe('val=42')
  })

  it('returns null when the function tooltip returns a falsy value', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.computeCellTooltip(makeRow('r', {}), makeColumn('a', { tooltip: () => '' })),
    ).toBeNull()
  })

  it('returns null for an unsupported tooltip type', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.computeCellTooltip(makeRow('r', {}), makeColumn('a', { tooltip: 5 as any })),
    ).toBeNull()
  })
})

describe('createCellRender / computeCellNote', () => {
  it('returns null when neither overrides nor notes have an entry', () => {
    const cr = createCellRender(makeCtx())
    expect(cr.computeCellNote(makeRow('r', {}), makeColumn('a'))).toBeNull()
  })

  it('prefers the internal note override over props.notes', () => {
    const cr = createCellRender(
      makeCtx({
        noteOverrides: { r: { a: 'overlay' } },
        props: { notes: { r: { a: 'stored' } } },
      }),
    )
    expect(cr.computeCellNote(makeRow('r', {}), makeColumn('a'))).toBe('overlay')
  })

  it('treats a blank override as a removal (null)', () => {
    const cr = createCellRender(
      makeCtx({
        noteOverrides: { r: { a: '   ' } },
        props: { notes: { r: { a: 'stored' } } },
      }),
    )
    expect(cr.computeCellNote(makeRow('r', {}), makeColumn('a'))).toBeNull()
  })

  it('falls back to props.notes when no override exists', () => {
    const cr = createCellRender(
      makeCtx({ props: { notes: { r: { a: 'stored note' } } } }),
    )
    expect(cr.computeCellNote(makeRow('r', {}), makeColumn('a'))).toBe('stored note')
  })

  it('returns null for a whitespace-only stored note', () => {
    const cr = createCellRender(makeCtx({ props: { notes: { r: { a: '  ' } } } }))
    expect(cr.computeCellNote(makeRow('r', {}), makeColumn('a'))).toBeNull()
  })

  it('returns null when the row or column is absent in the notes map', () => {
    const cr = createCellRender(makeCtx({ props: { notes: { other: { a: 'x' } } } }))
    expect(cr.computeCellNote(makeRow('r', {}), makeColumn('a'))).toBeNull()
    const cr2 = createCellRender(makeCtx({ props: { notes: { r: { b: 'x' } } } }))
    expect(cr2.computeCellNote(makeRow('r', {}), makeColumn('a'))).toBeNull()
  })
})

describe('createCellRender / getColumnEditorOptions', () => {
  it('returns [] for a function editorOptions when row has no original', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', { editorOptions: () => [{ value: 1, label: 'one' }] })
    expect(cr.getColumnEditorOptions(col, null)).toEqual([])
  })

  it('evaluates a function editorOptions per row', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', {
      editorOptions: (data: any) => [{ value: data.code, label: data.name }],
    })
    const row = makeRow('r', { code: 'x', name: 'X' })
    const opts = cr.getColumnEditorOptions(col, row)
    expect(opts).toEqual([{ value: 'x', label: 'X' }])
  })

  it('caches normalized static editorOptions and reuses them', () => {
    const ctx = makeCtx()
    const cr = createCellRender(ctx)
    const src = ['a', 'b']
    const col = makeColumn('a', { editorOptions: src })
    const first = cr.getColumnEditorOptions(col)
    const second = cr.getColumnEditorOptions(col)
    expect(first).toBe(second) // same cached array reference
    expect(ctx.editorOptionsCache['a']).toBe(first)
  })

  it('re-normalizes when the editorOptions source changes', () => {
    const ctx = makeCtx()
    const cr = createCellRender(ctx)
    const first = cr.getColumnEditorOptions(makeColumn('a', { editorOptions: ['a'] }))
    const second = cr.getColumnEditorOptions(makeColumn('a', { editorOptions: ['b'] }))
    expect(first).not.toBe(second)
  })
})

describe('createCellRender / formatListCellValue', () => {
  it('joins an array of values using the default separator', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', {
      editorOptions: [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
      ],
    })
    expect(cr.formatListCellValue(col, [1, 2])).toBe('One, Two')
  })

  it('honors a custom editorSeparator', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', {
      editorSeparator: ' | ',
      editorOptions: [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
      ],
    })
    expect(cr.formatListCellValue(col, [1, 2])).toBe('One | Two')
  })

  it('returns empty string for null / empty scalar values', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', { editorOptions: [] })
    expect(cr.formatListCellValue(col, null)).toBe('')
    expect(cr.formatListCellValue(col, '')).toBe('')
  })

  it('maps a single scalar value to its label', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', {
      editorOptions: [{ value: 'k', label: 'Known' }],
    })
    expect(cr.formatListCellValue(col, 'k')).toBe('Known')
    // unknown value falls back to its string form
    expect(cr.formatListCellValue(col, 'z')).toBe('z')
  })
})

describe('createCellRender / formatCellValue', () => {
  const row = makeRow('r', {})

  it('uses a custom formatter callback when present', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', {
      formatter: ({ value }: any) => `<<${value}>>`,
    })
    expect(cr.formatCellValue(col, 7, row)).toBe('<<7>>')
  })

  it('coerces a nullish formatter result to empty string', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', { formatter: () => null })
    expect(cr.formatCellValue(col, 1, row)).toBe('')
  })

  it('masks password columns with bullets, capped at 12', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', { editorType: 'password' })
    expect(cr.formatCellValue(col, 'abc', row)).toBe('•••')
    expect(cr.formatCellValue(col, '', row)).toBe('')
    expect(cr.formatCellValue(col, 'x'.repeat(50), row)).toBe('•'.repeat(12))
  })

  it('stringifies plain values when there is no format config', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a')
    expect(cr.formatCellValue(col, 'hello', row)).toBe('hello')
    expect(cr.formatCellValue(col, null, row)).toBe('')
  })

  it('applies numeric / currency / percent format configs', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.formatCellValue(makeColumn('a', { format: { type: 'number' } }), 1234.5, row),
    ).toContain('1,234')
    const cur = cr.formatCellValue(
      makeColumn('a', { format: { type: 'currency', currency: 'USD' } }),
      1000,
      row,
    )
    expect(cur).toContain('$')
    const pct = cr.formatCellValue(
      makeColumn('a', { format: { type: 'percent' } }),
      0.25,
      row,
    )
    expect(pct).toContain('%')
  })

  it('formats date configs and falls back when the value is not a date', () => {
    const cr = createCellRender(makeCtx())
    const dateCol = makeColumn('a', { format: { type: 'date' } })
    const out = cr.formatCellValue(dateCol, '2024-01-15T00:00:00Z', row)
    expect(out).toMatch(/2024/)

    // Unparseable -> returns String(value)
    expect(cr.formatCellValue(dateCol, 'not-a-date', row)).toBe('not-a-date')
  })

  it('formats datetime configs with merged default options', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', { format: { type: 'datetime' } })
    const out = cr.formatCellValue(col, '2024-03-10T13:45:00Z', row)
    expect(out).toMatch(/2024/)
  })
})

describe('createCellRender / formatPinnedValue', () => {
  it('invokes a formatter with a null row', () => {
    const cr = createCellRender(makeCtx())
    const formatter = vi.fn(({ value, row }: any) => `${value}:${row}`)
    const col = makeColumn('a', { formatter })
    expect(cr.formatPinnedValue(col, 5)).toBe('5:null')
    expect(formatter.mock.calls[0][0].row).toBeNull()
  })

  it('masks password pinned values', () => {
    const cr = createCellRender(makeCtx())
    expect(cr.formatPinnedValue(makeColumn('a', { editorType: 'password' }), 'pw')).toBe('••')
    expect(cr.formatPinnedValue(makeColumn('a', { editorType: 'password' }), '')).toBe('')
  })

  it('stringifies when no format config', () => {
    const cr = createCellRender(makeCtx())
    expect(cr.formatPinnedValue(makeColumn('a'), 'total')).toBe('total')
    expect(cr.formatPinnedValue(makeColumn('a'), null)).toBe('')
  })

  it('applies numeric and date format configs', () => {
    const cr = createCellRender(makeCtx())
    expect(
      cr.formatPinnedValue(makeColumn('a', { format: { type: 'number' } }), 9999),
    ).toContain('9,999')
    const d = cr.formatPinnedValue(
      makeColumn('a', { format: { type: 'date' } }),
      '2022-06-01T00:00:00Z',
    )
    expect(d).toMatch(/2022/)
    // unparseable date falls through to String()
    expect(
      cr.formatPinnedValue(makeColumn('a', { format: { type: 'date' } }), 'xyz'),
    ).toBe('xyz')
  })

  it('formats datetime pinned configs', () => {
    const cr = createCellRender(makeCtx())
    const out = cr.formatPinnedValue(
      makeColumn('a', { format: { type: 'datetime' } }),
      '2021-12-31T08:00:00Z',
    )
    expect(out).toMatch(/2021/)
  })
})

describe('createCellRender / computePinnedCellClass', () => {
  it('returns empty string when cellClass is not a function', () => {
    const cr = createCellRender(makeCtx())
    expect(cr.computePinnedCellClass({ a: 1 }, makeColumn('a', { cellClass: 'x' }))).toBe('')
  })

  it('invokes a function cellClass with a null row and the pinned value', () => {
    const cr = createCellRender(makeCtx())
    const cellClass = vi.fn((c: any) => (c.value > 0 ? 'pos' : 'neg'))
    const col = makeColumn('a', {
      cellClass,
      field: 'a',
    })
    expect(cr.computePinnedCellClass({ a: 3 }, col)).toBe('pos')
    expect(cellClass.mock.calls[0][0].row).toBeNull()
  })

  it('coerces a falsy cellClass result to empty string', () => {
    const cr = createCellRender(makeCtx())
    const col = makeColumn('a', { cellClass: () => undefined, field: 'a' })
    expect(cr.computePinnedCellClass({ a: 1 }, col)).toBe('')
  })
})
