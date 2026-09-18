import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { handleSheetKey, setWorkbook } from './shortcuts'
import { createWorkbook } from './workbook'

function cmd() {
  return {
    api: {} as never,
    editing: false,
    activeCell: { rowIndex: 0, colIndex: 0, columnId: 'c0' },
    rowCount: 1, colCount: 1, ranges: [],
    columnIdAt: () => 'c0',
    getCellValue: () => '',
    setCellValue: () => {},
    setActiveCell: vi.fn(), setSelection: vi.fn(),
    extendSelection: vi.fn(), scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
  } as unknown as GridCommandContext
}

const key = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { cancelable: true, ...init })

const three = () => createWorkbook([
  { name: 'A', cells: [] }, { name: 'B', cells: [] }, { name: 'C', cells: [] },
])

beforeEach(() => setWorkbook(null))

describe('sheet switching keys', () => {
  it('declines with no workbook, leaving Ctrl+PageDown to the browser', () => {
    // A single-sheet grid should not swallow the browser tab shortcut.
    expect(handleSheetKey(key({ key: 'PageDown', ctrlKey: true }), cmd())).toBe(false)
    expect(handleSheetKey(key({ key: 'F11', shiftKey: true }), cmd())).toBe(false)
  })

  it('moves to the next and previous sheet', () => {
    const wb = three()
    setWorkbook(wb)
    expect(handleSheetKey(key({ key: 'PageDown', ctrlKey: true }), cmd())).toBe(true)
    expect(wb.active).toBe('B')
    handleSheetKey(key({ key: 'PageUp', ctrlKey: true }), cmd())
    expect(wb.active).toBe('A')
  })

  it('does NOT wrap at either end, as Excel does not', () => {
    // Pressing again at the last sheet should leave you there rather than
    // teleport you to the first.
    const wb = three()
    setWorkbook(wb)
    expect(handleSheetKey(key({ key: 'PageUp', ctrlKey: true }), cmd())).toBe(false)
    expect(wb.active).toBe('A')
    wb.setActive('C')
    expect(handleSheetKey(key({ key: 'PageDown', ctrlKey: true }), cmd())).toBe(false)
    expect(wb.active).toBe('C')
  })

  it('steps over hidden sheets, and stops before a hidden end', () => {
    const wb = three()
    setWorkbook(wb, undefined, (name) => name === 'B')
    expect(handleSheetKey(key({ key: 'PageDown', ctrlKey: true }), cmd())).toBe(true)
    expect(wb.active).toBe('C')
    handleSheetKey(key({ key: 'PageUp', ctrlKey: true }), cmd())
    expect(wb.active).toBe('A')
    setWorkbook(wb, undefined, (name) => name === 'C')
    wb.setActive('B')
    expect(handleSheetKey(key({ key: 'PageDown', ctrlKey: true }), cmd())).toBe(false)
    expect(wb.active).toBe('B')
  })

  it('adds a sheet on Shift+F11 and makes it active', () => {
    const wb = three()
    setWorkbook(wb)
    expect(handleSheetKey(key({ key: 'F11', shiftKey: true }), cmd())).toBe(true)
    expect(wb.sheets).toHaveLength(4)
    expect(wb.active).toBe('Sheet1')
  })

  it('reports every change so the tabs re-render', () => {
    const onChange = vi.fn()
    setWorkbook(three(), onChange)
    handleSheetKey(key({ key: 'PageDown', ctrlKey: true }), cmd())
    handleSheetKey(key({ key: 'F11', shiftKey: true }), cmd())
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('does not fire plain F11, which is fullscreen', () => {
    setWorkbook(three())
    expect(handleSheetKey(key({ key: 'F11' }), cmd())).toBe(false)
  })

  it('does not fire plain PageDown, which scrolls', () => {
    setWorkbook(three())
    expect(handleSheetKey(key({ key: 'PageDown' }), cmd())).toBe(false)
  })
})
