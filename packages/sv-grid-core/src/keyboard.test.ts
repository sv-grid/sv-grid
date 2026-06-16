import { describe, expect, it } from 'vitest'
import { getKeyboardIntent, getNextActiveCell } from './keyboard'

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
