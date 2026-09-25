import { describe, expect, it } from 'vitest'
import {
  cellTypeAt, isChecked, toggledValue, radioIndex, shiftCellTypes,
  removeCellTypes, applyCellType, checkboxValues, newCellTypeId,
  CHECKED, UNCHECKED, type CellTypeRegion,
} from './cell-types'
import type { Rect } from './rects'

const rect = (r1: number, c1: number, r2: number, c2: number) => [r1, c1, r2, c2] as unknown as Rect

const box = (rects: Rect[], extra: Partial<CellTypeRegion> = {}): CellTypeRegion =>
  ({ id: newCellTypeId(), kind: 'checkbox', rects, ...extra })

describe('finding the region at a cell', () => {
  it('finds the one whose rectangle covers the cell', () => {
    const regions = [box([rect(0, 0, 3, 0)])]
    expect(cellTypeAt(regions, 2, 0)?.kind).toBe('checkbox')
    expect(cellTypeAt(regions, 4, 0)).toBeNull()
    expect(cellTypeAt(regions, 2, 1)).toBeNull()
  })

  it('lets the last region win where two overlap', () => {
    const first = box([rect(0, 0, 5, 0)], { kind: 'checkbox' })
    const second = box([rect(2, 0, 2, 0)], { kind: 'button' })
    expect(cellTypeAt([first, second], 2, 0)?.kind).toBe('button')
    expect(cellTypeAt([first, second], 1, 0)?.kind).toBe('checkbox')
  })
})

describe('the checkbox', () => {
  it('uses Excel’s TRUE and FALSE by default', () => {
    const region = box([rect(0, 0, 0, 0)])
    expect(checkboxValues(region)).toEqual({ on: CHECKED, off: UNCHECKED })
    expect(isChecked(region, 'TRUE')).toBe(true)
    expect(isChecked(region, 'FALSE')).toBe(false)
  })

  it('reads the cell rather than remembering a click', () => {
    const region = box([rect(0, 0, 0, 0)])
    // However the value got there, the tick follows it.
    expect(isChecked(region, 'true')).toBe(true)
    expect(isChecked(region, '  TRUE  ')).toBe(true)
    expect(isChecked(region, '')).toBe(false)
    expect(isChecked(region, 'anything else')).toBe(false)
  })

  it('takes a pair of its own', () => {
    const region = box([rect(0, 0, 0, 0)], { checked: 'Yes', unchecked: 'No' })
    expect(isChecked(region, 'Yes')).toBe(true)
    expect(isChecked(region, 'TRUE')).toBe(false)
    expect(toggledValue(region, 'Yes')).toBe('No')
    expect(toggledValue(region, 'No')).toBe('Yes')
  })

  it('toggles from whatever is there', () => {
    const region = box([rect(0, 0, 0, 0)])
    expect(toggledValue(region, 'TRUE')).toBe('FALSE')
    expect(toggledValue(region, 'FALSE')).toBe('TRUE')
    // A blank or a stray value reads as unticked, so a click ticks it.
    expect(toggledValue(region, '')).toBe('TRUE')
    expect(toggledValue(region, 'x')).toBe('TRUE')
  })
})

describe('the radio group', () => {
  const region = box([rect(0, 0, 2, 0)], { kind: 'radio', choices: ['Low', 'Medium', 'High'] })

  it('finds the choice the cell holds', () => {
    expect(radioIndex(region, 'Medium')).toBe(1)
    expect(radioIndex(region, 'high')).toBe(2)
    expect(radioIndex(region, '')).toBe(-1)
    expect(radioIndex(region, 'Urgent')).toBe(-1)
  })

  it('answers -1 with no choices at all', () => {
    expect(radioIndex(box([rect(0, 0, 0, 0)], { kind: 'radio' }), 'Low')).toBe(-1)
  })
})

describe('laying a region down', () => {
  it('cuts the cells it claims out of the ones already there', () => {
    const first = box([rect(0, 0, 5, 0)])
    const second = box([rect(2, 0, 3, 0)], { kind: 'button' })
    const after = applyCellType([first], second)
    // The first region is left with the cells it still owns, split in two.
    expect(cellTypeAt(after, 1, 0)?.id).toBe(first.id)
    expect(cellTypeAt(after, 2, 0)?.id).toBe(second.id)
    expect(cellTypeAt(after, 4, 0)?.id).toBe(first.id)
  })

  it('drops a region left with nothing', () => {
    const first = box([rect(0, 0, 1, 0)])
    const after = applyCellType([first], box([rect(0, 0, 1, 0)], { kind: 'button' }))
    expect(after).toHaveLength(1)
    expect(after[0]!.kind).toBe('button')
  })

  it('removes the cells a clear names', () => {
    const region = box([rect(0, 0, 3, 0)])
    expect(removeCellTypes([region], [rect(0, 0, 3, 0)])).toEqual([])
    expect(cellTypeAt(removeCellTypes([region], [rect(0, 0, 0, 0)]), 0, 0)).toBeNull()
    expect(cellTypeAt(removeCellTypes([region], [rect(0, 0, 0, 0)]), 1, 0)).not.toBeNull()
  })
})

describe('following a structural edit', () => {
  it('moves down when rows are inserted above', () => {
    const region = box([rect(4, 0, 6, 0)])
    const after = shiftCellTypes([region], { kind: 'insertRows', at: 0, count: 2 })
    expect(cellTypeAt(after, 6, 0)).not.toBeNull()
    expect(cellTypeAt(after, 4, 0)).toBeNull()
  })

  it('shrinks when rows inside it are deleted', () => {
    const region = box([rect(2, 0, 6, 0)])
    const after = shiftCellTypes([region], { kind: 'deleteRows', at: 3, count: 2 })
    expect(cellTypeAt(after, 2, 0)).not.toBeNull()
    expect(cellTypeAt(after, 4, 0)).not.toBeNull()
    expect(cellTypeAt(after, 5, 0)).toBeNull()
  })
})
