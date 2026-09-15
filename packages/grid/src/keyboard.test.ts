import { describe, expect, it } from 'vitest'
import { getKeyboardIntent, getNextActiveCell, getEntryStep, pastCollapsed } from './keyboard'
import type { ActiveCellState } from './core'

describe('keyboard navigation engine', () => {
  it('maps keys to navigation intents', () => {
    expect(getKeyboardIntent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe(
      'moveLeft',
    )
    expect(getKeyboardIntent(new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true }))).toBe(
      'gridStart',
    )
    expect(getKeyboardIntent(new KeyboardEvent('keydown', { key: ' ' }))).toBe(
      'activate',
    )
  })

  it('computes next active cell within bounds', () => {
    const next = getNextActiveCell(
      { rowIndex: 1, colIndex: 1, cellId: null },
      'moveDown',
      { maxRow: 2, maxCol: 3, pageSize: 10 },
    )
    expect(next.rowIndex).toBe(2)
    expect(next.colIndex).toBe(1)
  })

  it('handles row and grid boundary intents', () => {
    const rowEnd = getNextActiveCell(
      { rowIndex: 2, colIndex: 1, cellId: null },
      'rowEnd',
      { maxRow: 2, maxCol: 4, pageSize: 2 },
    )
    expect(rowEnd.colIndex).toBe(4)

    const gridStart = getNextActiveCell(
      { rowIndex: 2, colIndex: 4, cellId: null },
      'gridStart',
      { maxRow: 2, maxCol: 4, pageSize: 2 },
    )
    expect(gridStart.rowIndex).toBe(0)
    expect(gridStart.colIndex).toBe(0)
  })

  it('clamps page navigation to valid bounds', () => {
    const pageUp = getNextActiveCell(
      { rowIndex: 1, colIndex: 0, cellId: null },
      'pageUp',
      { maxRow: 20, maxCol: 2, pageSize: 10 },
    )
    const pageDown = getNextActiveCell(
      { rowIndex: 18, colIndex: 0, cellId: null },
      'pageDown',
      { maxRow: 20, maxCol: 2, pageSize: 10 },
    )

    expect(pageUp.rowIndex).toBe(0)
    expect(pageDown.rowIndex).toBe(20)
  })
})

describe('getEntryStep', () => {
  const at = (rowIndex: number, colIndex: number): ActiveCellState => ({ rowIndex, colIndex, cellId: null })
  const open = { maxRow: 9, maxCol: 9, range: null }

  it('a Tab starts a run at the column it leaves, and later Tabs keep it', () => {
    const first = getEntryStep(at(0, 0), 'tabNext', { ...open, tabOrigin: null })
    expect(first.cell).toMatchObject({ rowIndex: 0, colIndex: 1 })
    expect(first.tabOrigin).toBe(0)
    const second = getEntryStep(first.cell, 'tabNext', { ...open, tabOrigin: first.tabOrigin })
    expect(second.cell).toMatchObject({ rowIndex: 0, colIndex: 2 })
    expect(second.tabOrigin).toBe(0)
    const back = getEntryStep(second.cell, 'tabPrev', { ...open, tabOrigin: second.tabOrigin })
    expect(back.cell).toMatchObject({ rowIndex: 0, colIndex: 1 })
    expect(back.tabOrigin).toBe(0)
  })

  it('Enter after a run goes down from the run\'s first column and ends it', () => {
    const step = getEntryStep(at(0, 2), 'moveDown', { ...open, tabOrigin: 0 })
    expect(step.cell).toMatchObject({ rowIndex: 1, colIndex: 0 })
    expect(step.tabOrigin).toBe(null)
    expect(step.withinRange).toBe(false)
    const up = getEntryStep(at(3, 5), 'moveUp', { ...open, tabOrigin: 2 })
    expect(up.cell).toMatchObject({ rowIndex: 2, colIndex: 2 })
  })

  it('Enter with no run is a plain move down', () => {
    const step = getEntryStep(at(0, 2), 'moveDown', { ...open, tabOrigin: null })
    expect(step.cell).toMatchObject({ rowIndex: 1, colIndex: 2 })
    expect(step.tabOrigin).toBe(null)
  })

  it('walks a selected block: Enter down the columns, Tab along the rows, both wrapping', () => {
    const range = { minRow: 1, maxRow: 2, minCol: 1, maxCol: 2 }
    const opts = { maxRow: 9, maxCol: 9, tabOrigin: null, range }
    const path = (start: ActiveCellState, intent: 'moveDown' | 'moveUp' | 'tabNext' | 'tabPrev', n: number) => {
      const out: Array<[number, number]> = []
      let cell = start
      for (let i = 0; i < n; i++) {
        const step = getEntryStep(cell, intent, opts)
        expect(step.withinRange).toBe(true)
        expect(step.tabOrigin).toBe(null)
        cell = step.cell
        out.push([cell.rowIndex, cell.colIndex])
      }
      return out
    }
    expect(path(at(1, 1), 'moveDown', 4)).toEqual([[2, 1], [1, 2], [2, 2], [1, 1]])
    expect(path(at(1, 1), 'moveUp', 4)).toEqual([[2, 2], [1, 2], [2, 1], [1, 1]])
    expect(path(at(1, 1), 'tabNext', 4)).toEqual([[1, 2], [2, 1], [2, 2], [1, 1]])
    expect(path(at(1, 1), 'tabPrev', 4)).toEqual([[2, 2], [2, 1], [1, 2], [1, 1]])
  })

  it('a one-cell range and a cursor outside the range are not a block', () => {
    const single = getEntryStep(at(1, 1), 'moveDown', { ...open, tabOrigin: null, range: { minRow: 1, maxRow: 1, minCol: 1, maxCol: 1 } })
    expect(single.withinRange).toBe(false)
    expect(single.cell).toMatchObject({ rowIndex: 2, colIndex: 1 })
    const outside = getEntryStep(at(5, 5), 'tabNext', { ...open, tabOrigin: null, range: { minRow: 1, maxRow: 2, minCol: 1, maxCol: 2 } })
    expect(outside.withinRange).toBe(false)
    expect(outside.cell).toMatchObject({ rowIndex: 5, colIndex: 6 })
    expect(outside.tabOrigin).toBe(5)
  })

  it('a Tab run inside a block does not start a run', () => {
    const range = { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 }
    const step = getEntryStep(at(0, 0), 'tabNext', { ...open, tabOrigin: null, range })
    expect(step.tabOrigin).toBe(null)
  })

  it('steps over collapsed cells, on the open sheet and inside a block', () => {
    const collapsed = { isRowCollapsed: (r: number) => r === 1, isColumnCollapsed: (c: number) => c === 1 }
    const down = getEntryStep(at(0, 0), 'moveDown', { ...open, tabOrigin: null, collapsed })
    expect(down.cell).toMatchObject({ rowIndex: 2, colIndex: 0 })
    const tab = getEntryStep(at(0, 0), 'tabNext', { ...open, tabOrigin: null, collapsed })
    expect(tab.cell).toMatchObject({ rowIndex: 0, colIndex: 2 })
    expect(tab.tabOrigin).toBe(0)
    // In a 3x3 block with its middle row and column hidden, Enter from the
    // top-left goes to the bottom-left, then wraps to the top of column 3.
    const range = { minRow: 0, maxRow: 2, minCol: 0, maxCol: 2 }
    const first = getEntryStep(at(0, 0), 'moveDown', { ...open, tabOrigin: null, range, collapsed })
    expect(first.cell).toMatchObject({ rowIndex: 2, colIndex: 0 })
    expect(first.withinRange).toBe(true)
    const second = getEntryStep(first.cell, 'moveDown', { ...open, tabOrigin: null, range, collapsed })
    expect(second.cell).toMatchObject({ rowIndex: 0, colIndex: 2 })
    // A block with nothing showing leaves the cursor where it is.
    const dark = { isRowCollapsed: () => true, isColumnCollapsed: () => false }
    const stuck = getEntryStep(at(0, 0), 'moveDown', { ...open, tabOrigin: null, range, collapsed: dark })
    expect(stuck.cell).toMatchObject({ rowIndex: 0, colIndex: 0 })
  })
})

describe('pastCollapsed', () => {
  const at = (rowIndex: number, colIndex: number): ActiveCellState => ({ rowIndex, colIndex, cellId: null })
  const bounds = { maxRow: 5, maxCol: 5 }
  const collapsed = (rows: number[], cols: number[]) => ({
    isRowCollapsed: (r: number) => rows.includes(r),
    isColumnCollapsed: (c: number) => cols.includes(c),
  })

  it('goes on in the direction of travel to the next visible line', () => {
    expect(pastCollapsed(at(0, 0), at(0, 1), bounds, collapsed([], [1, 2]))).toMatchObject({ rowIndex: 0, colIndex: 3 })
    expect(pastCollapsed(at(3, 0), at(2, 0), bounds, collapsed([2, 1], []))).toMatchObject({ rowIndex: 0, colIndex: 0 })
  })

  it('comes back to the nearest visible line when the edge is hidden: End on a sheet whose last columns are hidden', () => {
    expect(pastCollapsed(at(0, 0), at(0, 5), bounds, collapsed([], [4, 5]))).toMatchObject({ rowIndex: 0, colIndex: 3 })
  })

  it('stays put when everything in the direction of travel is hidden', () => {
    expect(pastCollapsed(at(0, 3), at(0, 4), bounds, collapsed([], [4, 5]))).toMatchObject({ rowIndex: 0, colIndex: 3 })
  })

  it('leaves an axis the move did not touch alone', () => {
    // The cursor sits on a row the user just hid; a sideways move keeps the row.
    expect(pastCollapsed(at(2, 0), at(2, 1), bounds, collapsed([2], []))).toMatchObject({ rowIndex: 2, colIndex: 1 })
  })

  it('returns the landing itself when nothing is hidden', () => {
    const next = at(1, 1)
    expect(pastCollapsed(at(0, 0), next, bounds, collapsed([], []))).toBe(next)
  })
})
