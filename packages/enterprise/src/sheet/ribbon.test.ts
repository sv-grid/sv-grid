/**
 * The ribbon is data, so it is tested as data: no mounting, no DOM.
 *
 * The two things worth holding down are that the model is well-formed (a
 * renderer can trust every item), and that the buttons run the SAME actions
 * the keymap binds rather than a parallel implementation.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { RIBBON_TABS, ribbonItems, withDecimals } from './ribbon'
import { setFormatTarget, setWorkbook } from './shortcuts'
import { createFormatStore } from './format-store'
import { createWorkbook } from './workbook'
import { FORMAT_PRESETS } from './number-format'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'

const ROWS = 5
const COLS = 4
const LETTERS = ['a', 'b', 'c', 'd']

function makeCmd(over: Partial<GridCommandContext> = {}): GridCommandContext {
  const values = new Map<string, unknown>()
  return {
    api: { copyToClipboard: vi.fn(async () => '') } as never,
    editing: false,
    activeCell: { rowIndex: 0, colIndex: 0, columnId: 'a' },
    rowCount: ROWS,
    colCount: COLS,
    ranges: [[0, 0, 1, 1]],
    columnIdAt: (c: number) => LETTERS[c] ?? null,
    getCellValue: (r: number, c: number) => values.get(`${r}:${c}`),
    setCellValue: (r: number, c: number, v: unknown) => values.set(`${r}:${c}`, v),
    setActiveCell: vi.fn(),
    setSelection: vi.fn(),
    extendSelection: vi.fn(),
    scrollIntoView: vi.fn(),
    startEditing: vi.fn(() => true),
    batch: <T,>(fn: () => T) => fn(),
    ...over,
  } as GridCommandContext
}

function attachStore() {
  const store = createFormatStore()
  const onChange = vi.fn()
  setFormatTarget({
    store,
    lookup: {
      rowIdAt: (i: number) => (i >= 0 && i < ROWS ? `r${i}` : null),
      columnIdAt: (i: number) => LETTERS[i] ?? null,
    },
    onChange,
  })
  return { store, onChange }
}

beforeEach(() => {
  setFormatTarget(null)
  setWorkbook(null)
})

describe('the model is well-formed', () => {
  it('ships the four tabs that were scoped', () => {
    expect(RIBBON_TABS.map((t) => t.id)).toEqual(['home', 'insert', 'formulas', 'data'])
  })

  it('gives every item a unique id', () => {
    const ids = ribbonItems().map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every item a label and a title', () => {
    for (const item of ribbonItems()) {
      expect(item.label, item.id).toBeTruthy()
      expect(item.title, item.id).toBeTruthy()
    }
  })

  it('gives every item exactly one of `run` or `emits`', () => {
    for (const item of ribbonItems()) {
      const has = Number(Boolean(item.run)) + Number(Boolean(item.emits))
      expect(has, `${item.id} must either run or emit, not both or neither`).toBe(1)
    }
  })

  it('gives every select and swatch row its options', () => {
    for (const item of ribbonItems()) {
      if (item.kind === 'select' || item.kind === 'swatches') {
        expect(item.options?.length, item.id).toBeGreaterThan(0)
      }
    }
  })

  it('gives every group a label, because that is what makes it a ribbon', () => {
    for (const tab of RIBBON_TABS) {
      expect(tab.groups.length, tab.id).toBeGreaterThan(0)
      for (const group of tab.groups) expect(group.label, group.id).toBeTruthy()
    }
  })
})

function item(id: string) {
  const found = ribbonItems().find((i) => i.id === id)
  if (!found) throw new Error(`no ribbon item "${id}"`)
  return found
}

describe('the buttons drive the real actions', () => {
  it('Bold writes through the attached format store', () => {
    const { store, onChange } = attachStore()
    const cmd = makeCmd()
    expect(item('bold').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.bold).toBe(true)
    expect(store.get('r1', 'b')?.bold).toBe(true)
    expect(onChange).toHaveBeenCalled()
  })

  it('Bold reports itself on only when EVERY selected cell is bold', () => {
    const { store } = attachStore()
    const cmd = makeCmd()
    expect(item('bold').isOn!(cmd)).toBe(false)
    store.set([[0, 0, 0, 0]], { bold: true }, {
      rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => LETTERS[i] ?? null,
    })
    // One of four is bold, so the button stays off and pressing turns all on.
    expect(item('bold').isOn!(cmd)).toBe(false)
    item('bold').run!(cmd)
    expect(item('bold').isOn!(cmd)).toBe(true)
  })

  it('declines every formatting button when no store is attached', () => {
    const cmd = makeCmd()
    for (const id of ['bold', 'italic', 'fmt-currency', 'align-left', 'wrap', 'clear-formats']) {
      expect(item(id).isEnabled!(cmd), id).toBe(false)
      expect(item(id).run!(cmd), id).toBe(false)
    }
  })

  it('applies a number preset and lights the matching button', () => {
    attachStore()
    const cmd = makeCmd()
    expect(item('fmt-currency').run!(cmd)).toBe(true)
    expect(item('fmt-currency').isOn!(cmd)).toBe(true)
    expect(item('fmt-percent').isOn!(cmd)).toBe(false)
  })

  it('AutoSum writes a SUM over the run above', () => {
    const cmd = makeCmd({
      activeCell: { rowIndex: 3, colIndex: 0, columnId: 'a' },
      ranges: [],
      getCellValue: (r: number) => (r < 3 ? 10 : undefined),
    })
    const written: unknown[] = []
    const spy = makeCmd({
      ...cmd,
      setCellValue: (_r: number, _c: number, v: unknown) => { written.push(v) },
    } as never)
    expect(item('autosum').run!(spy)).toBe(true)
    expect(written[0]).toBe('=SUM(A1:A3)')
  })

  it('Copy asks the grid api rather than reimplementing the clipboard', () => {
    const api = { copyToClipboard: vi.fn(async () => 'x') }
    const cmd = makeCmd({ api: api as never })
    expect(item('copy').run!(cmd)).toBe(true)
    expect(api.copyToClipboard).toHaveBeenCalled()
  })

  it('Cut copies BEFORE it blanks, so a failed write cannot lose the cells', () => {
    const order: string[] = []
    const cleared: Array<[number, number]> = []
    const cmd = makeCmd({
      api: { copyToClipboard: vi.fn(async () => { order.push('copy'); return '' }) } as never,
      setCellValue: (r: number, c: number) => { order.push('clear'); cleared.push([r, c]) },
    })
    expect(item('cut').run!(cmd)).toBe(true)
    expect(order[0]).toBe('copy')
    expect(cleared).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]])
  })

  it('New sheet declines without a workbook and adds one with it', () => {
    const cmd = makeCmd()
    expect(item('new-sheet').isEnabled!(cmd)).toBe(false)
    expect(item('new-sheet').run!(cmd)).toBe(false)

    const wb = createWorkbook([{ name: 'One', cells: [] }])
    setWorkbook(wb)
    expect(item('new-sheet').isEnabled!(cmd)).toBe(true)
    expect(item('new-sheet').run!(cmd)).toBe(true)
    expect(wb.sheets).toEqual(['One', 'Sheet1'])
  })
})

describe('increase / decrease decimal', () => {
  it('walks a plain pattern up and down', () => {
    expect(withDecimals('0', 1)).toBe('0.0')
    expect(withDecimals('0.0', 1)).toBe('0.00')
    expect(withDecimals('0.00', -1)).toBe('0.0')
    expect(withDecimals('0.0', -1)).toBe('0')
  })

  it('keeps the prefix and the suffix', () => {
    expect(withDecimals('$#,##0.00', 1)).toBe('$#,##0.000')
    expect(withDecimals('0.0%', 1)).toBe('0.00%')
    expect(withDecimals('0.0%', -1)).toBe('0%')
    expect(withDecimals('$#,##0', 1)).toBe('$#,##0.0')
  })

  it('stops at zero and at Excel"s 30-place ceiling', () => {
    expect(withDecimals('0', -1)).toBeNull()
    expect(withDecimals(`0.${'0'.repeat(30)}`, 1)).toBeNull()
  })

  it('moves EVERY section, so positives and negatives keep one precision', () => {
    expect(withDecimals('0.00;[Red]0.00', 1)).toBe('0.000;[Red]0.000')
    // The currency preset, which is the pattern this matters most for.
    expect(withDecimals('$#,##0.00;($#,##0.00)', 1)).toBe('$#,##0.000;($#,##0.000)')
    expect(withDecimals('$#,##0.00;($#,##0.00)', -1)).toBe('$#,##0.0;($#,##0.0)')
  })

  it('declines all sections when any one of them cannot move', () => {
    // The second section is already at zero, so decreasing would desync the
    // two. Better to do nothing than to half-apply.
    expect(withDecimals('0.0;0', -1)).toBeNull()
  })

  it('declines a pattern with a quoted literal rather than mangling it', () => {
    // A quoted literal may contain the ';' that sections are split on.
    expect(withDecimals('0.00" items"', 1)).toBeNull()
  })

  it('moves the decimals of the active cell through the button', () => {
    const { store } = attachStore()
    const cmd = makeCmd()
    item('fmt-currency').run!(cmd)
    expect(store.get('r0', 'a')?.numFmt).toBe(FORMAT_PRESETS.currency)
    expect(item('dec-more').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.numFmt).toBe('$#,##0.000;($#,##0.000)')
    expect(item('dec-less').run!(cmd)).toBe(true)
    expect(item('dec-less').run!(cmd)).toBe(true)
    expect(store.get('r0', 'a')?.numFmt).toBe('$#,##0.0;($#,##0.0)')
  })
})
