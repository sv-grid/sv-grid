import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import {
  insertRows, deleteRows, deleteColumns,
  axisForSelection, setStructureTarget, rewriteFormulas,
} from './structure'
import { handleSheetKey } from './shortcuts'
import { createNames } from './names'
import { createFormatStore, type CellAddressLookup } from './format-store'

/** A sheet of raw text plus a target that records the structural call. */
function sheet(raw: string[][], ranges: any[] = []) {
  const applied: any[] = []
  const cmd = {
    api: {} as never,
    editing: false,
    activeCell: { rowIndex: 0, colIndex: 0, columnId: 'c0' },
    rowCount: raw.length,
    colCount: raw[0]?.length ?? 0,
    ranges,
    columnIdAt: (c: number) => `c${c}`,
    getCellValue: (r: number, c: number) => raw[r]?.[c],
    setCellValue: (r: number, c: number, v: unknown) => { raw[r]![c] = String(v) },
    setActiveCell: vi.fn(), setSelection: vi.fn(),
    extendSelection: vi.fn(), scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
  } as unknown as GridCommandContext

  const target = {
    getRaw: (r: number, c: number) => raw[r]?.[c] ?? '',
    setRaw: (r: number, c: number, text: string) => { raw[r]![c] = text },
    apply: (edit: unknown) => applied.push(edit),
  }
  return { cmd, raw, target, applied }
}

const lookup: CellAddressLookup = {
  rowIdAt: (i) => (i >= 0 && i < 4 ? `r${i}` : null),
  columnIdAt: (i) => (i >= 0 && i < 4 ? `c${i}` : null),
}

const key = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { cancelable: true, ...init })

beforeEach(() => setStructureTarget(null))

describe('rewriteFormulas', () => {
  it('widens a range that straddles an insertion', () => {
    // The bug this waited for the engine to fix: inserting a row above
    // =SUM(D1:D4) without widening silently drops the new row from the total.
    const s = sheet([['=SUM(A1:A4)'], ['1'], ['2'], ['3']])
    setStructureTarget(s.target)
    rewriteFormulas(s.cmd, s.target, { kind: 'insertRows', at: 2, count: 1 })
    expect(s.raw[0]![0]).toBe('=SUM(A1:A5)')
  })

  it('breaks a reference into a deleted row', () => {
    const s = sheet([['=A3'], ['1'], ['2']])
    rewriteFormulas(s.cmd, s.target, { kind: 'deleteRows', at: 2, count: 1 })
    expect(s.raw[0]![0]).toBe('=#REF!')
  })

  it('leaves literals alone', () => {
    const s = sheet([['hello'], ['42']])
    rewriteFormulas(s.cmd, s.target, { kind: 'insertRows', at: 0, count: 1 })
    expect(s.raw[0]![0]).toBe('hello')
    expect(s.raw[1]![0]).toBe('42')
  })

  it('rewrites defined names too', () => {
    const names = createNames({ Target: '=$A$5' })
    const s = sheet([['1']])
    rewriteFormulas(s.cmd, { ...s.target, names }, { kind: 'insertRows', at: 0, count: 1 })
    expect(names.list()[0]!.refersTo).toBe('=$A$6')
  })

  it('reports how many cells it touched', () => {
    const s = sheet([['=A2'], ['=A3'], ['x']])
    const n = rewriteFormulas(s.cmd, s.target, { kind: 'insertRows', at: 0, count: 1 })
    expect(n).toBe(2)
  })
})

describe('insert and delete', () => {
  it('declines with no target attached', () => {
    const s = sheet([['1']])
    expect(insertRows(s.cmd, 0, 1)).toBe(false)
  })

  it('applies the edit after rewriting', () => {
    const s = sheet([['=A2'], ['1']])
    setStructureTarget(s.target)
    expect(insertRows(s.cmd, 0, 1)).toBe(true)
    expect(s.applied).toEqual([{ kind: 'insertRows', at: 0, count: 1 }])
    expect(s.raw[0]![0]).toBe('=A3')
  })

  it('declines a zero or negative count', () => {
    const s = sheet([['1']])
    setStructureTarget(s.target)
    expect(insertRows(s.cmd, 0, 0)).toBe(false)
    expect(s.applied).toHaveLength(0)
  })

  it('takes the span from the selection when no explicit count is given', () => {
    const s = sheet([['1'], ['2'], ['3']], [[1, 0, 2, 0]])
    setStructureTarget(s.target)
    insertRows(s.cmd)
    expect(s.applied[0]).toEqual({ kind: 'insertRows', at: 1, count: 2 })
  })

  it('does columns as well', () => {
    const s = sheet([['1', '2', '3']], [[0, 1, 0, 2]])
    setStructureTarget(s.target)
    deleteColumns(s.cmd)
    expect(s.applied[0]).toEqual({ kind: 'deleteCols', at: 1, count: 2 })
  })

  it('runs as one undoable batch', () => {
    const s = sheet([['=A2'], ['=A3'], ['1']])
    let batches = 0
    ;(s.cmd as any).batch = <T,>(fn: () => T) => { batches += 1; return fn() }
    setStructureTarget(s.target)
    insertRows(s.cmd, 0, 1)
    expect(batches).toBe(1)
  })
})

describe('forgetting formats for deleted rows and columns', () => {
  it('drops entries for a deleted row', () => {
    // Without this the store keeps an entry per removed row for the life of
    // the session.
    const store = createFormatStore()
    store.set([[0, 0, 2, 0]], { bold: true }, lookup)
    const s = sheet([['1'], ['2'], ['3']])
    setStructureTarget({ ...s.target, format: { store, lookup } })
    deleteRows(s.cmd, 1, 1)
    expect(store.get('r1', 'c0')).toBeUndefined()
    expect(store.get('r0', 'c0')).toBeDefined()
    expect(store.size).toBe(2)
  })

  it('drops entries for a deleted column', () => {
    const store = createFormatStore()
    store.set([[0, 0, 0, 2]], { bold: true }, lookup)
    const s = sheet([['1', '2', '3']])
    setStructureTarget({ ...s.target, format: { store, lookup } })
    deleteColumns(s.cmd, 1, 1)
    expect(store.get('r0', 'c1')).toBeUndefined()
    expect(store.size).toBe(2)
  })

  it('leaves the store alone on an INSERT', () => {
    // Ids travel with the thing they name, so an insert moves nothing.
    const store = createFormatStore()
    store.set([[0, 0, 0, 0]], { bold: true }, lookup)
    const s = sheet([['1'], ['2']])
    setStructureTarget({ ...s.target, format: { store, lookup } })
    insertRows(s.cmd, 0, 1)
    expect(store.get('r0', 'c0')?.bold).toBe(true)
    expect(store.size).toBe(1)
  })
})

describe('axisForSelection', () => {
  it('reads a full-width selection as rows', () => {
    const s = sheet([['1', '2'], ['3', '4']], [[0, 0, 0, 1]])
    expect(axisForSelection(s.cmd)).toBe('rows')
  })

  it('reads a full-height selection as columns', () => {
    const s = sheet([['1', '2'], ['3', '4']], [[0, 0, 1, 0]])
    expect(axisForSelection(s.cmd)).toBe('cols')
  })

  it('calls a partial selection ambiguous', () => {
    const s = sheet([['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']], [[0, 0, 1, 1]])
    expect(axisForSelection(s.cmd)).toBe('ambiguous')
  })

  it('defaults to rows with no selection', () => {
    expect(axisForSelection(sheet([['1']]).cmd)).toBe('rows')
  })
})

describe('the keyboard bindings', () => {
  it('declines with no target attached', () => {
    const s = sheet([['1', '2']], [[0, 0, 0, 1]])
    expect(handleSheetKey(key({ key: '+', ctrlKey: true, shiftKey: true }), s.cmd)).toBe(false)
  })

  it('inserts rows on Ctrl+Shift+Plus over a full-width selection', () => {
    const s = sheet([['1', '2'], ['3', '4']], [[0, 0, 0, 1]])
    setStructureTarget(s.target)
    expect(handleSheetKey(key({ key: '+', ctrlKey: true, shiftKey: true }), s.cmd)).toBe(true)
    expect(s.applied[0]).toMatchObject({ kind: 'insertRows', at: 0 })
  })

  it('deletes columns on Ctrl+Minus over a full-height selection', () => {
    const s = sheet([['1', '2'], ['3', '4']], [[0, 1, 1, 1]])
    setStructureTarget(s.target)
    expect(handleSheetKey(key({ key: '-', ctrlKey: true }), s.cmd)).toBe(true)
    expect(s.applied[0]).toMatchObject({ kind: 'deleteCols', at: 1, count: 1 })
  })

  it('declines an ambiguous selection rather than guessing', () => {
    // Excel opens a dialog here. Deciding what that looks like belongs to the
    // consumer, so the key falls through and they can bind their own.
    const s = sheet(
      [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']],
      [[0, 0, 1, 1]],
    )
    setStructureTarget(s.target)
    expect(handleSheetKey(key({ key: '+', ctrlKey: true, shiftKey: true }), s.cmd)).toBe(false)
  })
})
