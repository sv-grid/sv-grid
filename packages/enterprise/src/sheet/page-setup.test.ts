import { describe, expect, it } from 'vitest'
import { defaultPageSetup, copyPageSetup, marginPresetOf, shiftPageSetup, marginsCss, MARGIN_PRESETS, PAPER_SIZES } from './page-setup'

describe('page setup', () => {
  it('starts on Excel\'s defaults, and a copy is its own', () => {
    const setup = defaultPageSetup()
    expect(setup).toMatchObject({ orientation: 'portrait', paper: 'A4', printArea: null, printTitleRows: null, gridlines: false, headings: false, scale: 100 })
    expect(marginPresetOf(setup.margins)).toBe('normal')
    setup.printArea = [[0, 0, 4, 2]]
    setup.printTitleRows = [0, 0]
    const copy = copyPageSetup(setup)
    expect(copy).toEqual(setup)
    expect(copy.margins).not.toBe(setup.margins)
    expect(copy.printArea![0]).not.toBe(setup.printArea[0])
    expect(marginPresetOf({ ...MARGIN_PRESETS.wide })).toBe('wide')
    expect(marginPresetOf({ ...MARGIN_PRESETS.wide, left: 0.9 })).toBeNull()
    expect(PAPER_SIZES.A4.code).toBe(9)
    expect(marginsCss(MARGIN_PRESETS.narrow)).toBe('0.75in 0.25in 0.75in 0.25in')
  })

  it('an insert or delete moves the print area and the title rows', () => {
    const setup = { ...defaultPageSetup(), printArea: [[2, 0, 6, 3]] as [number, number, number, number][], printTitleRows: [2, 3] as [number, number] }
    const inserted = shiftPageSetup(setup, { kind: 'insertRows', at: 1, count: 2 })
    expect(inserted.printArea).toEqual([[4, 0, 8, 3]])
    expect(inserted.printTitleRows).toEqual([4, 5])
    const cols = shiftPageSetup(setup, { kind: 'deleteCols', at: 0, count: 1 })
    expect(cols.printArea).toEqual([[2, 0, 6, 2]])
    expect(cols.printTitleRows).toEqual([2, 3])
    const trimmed = shiftPageSetup(setup, { kind: 'deleteRows', at: 3, count: 1 })
    expect(trimmed.printArea).toEqual([[2, 0, 5, 3]])
    expect(trimmed.printTitleRows).toEqual([2, 2])
    const gone = shiftPageSetup(setup, { kind: 'deleteRows', at: 2, count: 6 })
    expect(gone.printArea).toBeNull()
    expect(gone.printTitleRows).toBeNull()
  })
})
