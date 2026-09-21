/**
 * Regressions for the six bugs a review of this branch turned up. Each one
 * shipped with passing tests, so each test here is written to fail against the
 * original code.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { translateFormula } from './refs'
import { parseFormula } from './parse'
import { evaluate } from './evaluate'
import { createFormatStore, type CellAddressLookup } from './format-store'
import { handleSheetKey, setFormatTarget } from './shortcuts'

const ctx = { resolve: () => 1, lastRow: () => 0 }
const run = (src: string) => evaluate(parseFormula(src), ctx as never)

describe('parentheses survive re-serialisation', () => {
  it('does not turn =(A1+B1)*2 into =A2+B2*2', () => {
    // The original dropped every parenthesis, so a fill silently changed the
    // arithmetic and produced a plausible wrong number.
    expect(translateFormula('=(A1+B1)*2', 1, 0)).toBe('=(A2+B2)*2')
  })
})

describe('percent is postfix', () => {
  it('reads =50% as a half rather than a parse error', () => {
    expect(run('=50%')).toBe(0.5)
  })
})

describe('the evaluator never throws past its boundary', () => {
  it('returns an error value for a call with no arguments', () => {
    // =IF() parses, then args[0]! was undefined and the TypeError escaped.
    for (const src of ['=IF()', '=IFS()', '=IFERROR()', '=IFNA()', '=SWITCH()']) {
      expect(() => run(src)).not.toThrow()
      expect(run(src)).toHaveProperty('error')
    }
  })

  it('still evaluates those functions normally', () => {
    expect(run('=IF(TRUE,1,2)')).toBe(1)
    expect(run('=IFERROR(1/0,"x")')).toBe('x')
  })
})

describe('shifted bindings match the key that is actually pressed', () => {
  const at: CellAddressLookup = {
    rowIdAt: (i) => (i === 0 ? 'r0' : null),
    columnIdAt: (i) => (i === 0 ? 'c0' : null),
  }

  function cmd() {
    return {
      api: {} as never,
      editing: false,
      activeCell: { rowIndex: 0, colIndex: 0, columnId: 'c0' },
      rowCount: 1, colCount: 1,
      ranges: [[0, 0, 0, 0]],
      columnIdAt: () => 'c0',
      getCellValue: () => 1,
      setCellValue: () => {},
      setActiveCell: vi.fn(), setSelection: vi.fn(),
      extendSelection: vi.fn(), scrollIntoView: vi.fn(),
      startEditing: vi.fn(() => true),
      batch: <T,>(fn: () => T) => fn(),
    } as unknown as GridCommandContext
  }

  beforeEach(() => setFormatTarget(null))

  /** What a browser ACTUALLY sends for Ctrl+Shift+4 on a US layout: the key
   *  is the shifted character, not the digit printed on the cap. Every
   *  original test synthesized `key: '4'`, which is why they passed. */
  const realShiftEvent = (key: string, code: string) =>
    new KeyboardEvent('keydown', { key, code, ctrlKey: true, shiftKey: true, cancelable: true })

  it('fires Ctrl+Shift+4 when the browser reports "$"', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    expect(handleSheetKey(realShiftEvent('$', 'Digit4'), cmd())).toBe(true)
    expect(store.get('r0', 'c0')?.numFmt).toBe('$#,##0.00;($#,##0.00)')
  })

  it('fires Ctrl+Shift+5 when the browser reports "%"', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    expect(handleSheetKey(realShiftEvent('%', 'Digit5'), cmd())).toBe(true)
    expect(store.get('r0', 'c0')?.numFmt).toBe('0%')
  })

  it('fires each of Ctrl+Shift+1 through 6', () => {
    const pairs: Array<[string, string, string]> = [
      ['!', 'Digit1', '#,##0.00'],
      ['@', 'Digit2', 'h:mm AM/PM'],
      ['#', 'Digit3', 'yyyy-mm-dd'],
      ['$', 'Digit4', '$#,##0.00;($#,##0.00)'],
      ['%', 'Digit5', '0%'],
      ['^', 'Digit6', '0.00E+00'],
    ]
    for (const [key, code, expected] of pairs) {
      const store = createFormatStore()
      setFormatTarget({ store, lookup: at })
      expect(handleSheetKey(realShiftEvent(key, code), cmd()), `${code} did not fire`).toBe(true)
      expect(store.get('r0', 'c0')?.numFmt).toBe(expected)
    }
  })

  it('still works when code is absent, as synthesized events have it', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    const bare = new KeyboardEvent('keydown', { key: '5', ctrlKey: true, shiftKey: true, cancelable: true })
    expect(handleSheetKey(bare, cmd())).toBe(true)
  })

  it('does not fire Ctrl+Shift+5 for a different physical key', () => {
    const store = createFormatStore()
    setFormatTarget({ store, lookup: at })
    expect(handleSheetKey(realShiftEvent('%', 'KeyP'), cmd())).toBe(false)
  })
})

describe('the format store survives a round trip through storage', () => {
  const at: CellAddressLookup = {
    rowIdAt: (i) => `r${i}`,
    columnIdAt: (i) => `c${i}`,
  }

  it('rebuilds its indexes, so forgetRow still works after hydrate', () => {
    // The original left the indexes empty, so forgetRow was a silent no-op
    // and structure.ts's delete cleanup dropped nothing.
    const a = createFormatStore()
    a.set([[0, 0, 0, 1]], { bold: true }, at)
    const b = createFormatStore(a.serialize())
    expect(b.size).toBe(2)
    b.forgetRow('r0')
    expect(b.size).toBe(0)
  })

  it('handles ids containing spaces', () => {
    // Keys are encoded precisely so they can be split back apart; a plain
    // join could not be.
    const spaced: CellAddressLookup = {
      rowIdAt: () => 'row one',
      columnIdAt: () => 'col two',
    }
    const a = createFormatStore()
    a.set([[0, 0, 0, 0]], { bold: true }, spaced)
    const b = createFormatStore(a.serialize())
    expect(b.get('row one', 'col two')?.bold).toBe(true)
    b.forgetColumn('col two')
    expect(b.size).toBe(0)
  })
})
