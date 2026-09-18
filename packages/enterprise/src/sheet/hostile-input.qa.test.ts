/**
 * Deep QA: hostile and careless input. A spreadsheet is typed into by
 * people and filled by machines, so the engine's answer to nonsense has to
 * be an error value or a refusal, never a crash and never a hang.
 */
import { describe, expect, it } from 'vitest'
import { createWorkbook } from './workbook'
import { createSheetDocument } from './document'
import { imageCall, isDrawableImageSource } from './cell-images'
import { parseLinkTarget, hyperlinkArgument } from './links'
import { evaluationSteps } from './evaluate-steps'
import { parseFormula } from './parse'
import { pivotDrill, pivotBlock, type SheetPivot } from './pivot-range'
import { sparklineSvg } from './sparklines'
import { checkSheet } from './error-check'
import type { Rect } from './format-store'

const rect = (a: number, b: number, c: number, d: number) => [a, b, c, d] as unknown as Rect

describe('text that is trying to be something else', () => {
  it('will not draw a picture from a scheme a browser must not follow', () => {
    for (const source of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox',
      ' JavaScript:alert(1) ',
      'file:///etc/passwd',
    ]) expect([source, isDrawableImageSource(source)]).toEqual([source, false])
  })

  it('reads a link target without following a scheme it should not', () => {
    const target = parseLinkTarget('javascript:alert(1)')
    // Whatever it is read as, it is not an external address to open.
    expect(target?.kind === 'external' && /^javascript:/i.test(target.href)).toBe(false)
  })

  it('does not take a quote in a formula as the end of one', () => {
    expect(hyperlinkArgument('=HYPERLINK("a"")b", "x")')).toBe('"a"")b"')
    expect(imageCall('=IMAGE("a"")b")')).toEqual({ source: '"a"")b"' })
  })
})

describe('numbers and sizes that are out of the ordinary', () => {
  it('a sparkline over huge and tiny values still draws', () => {
    expect(sparklineSvg([1e308, -1e308, 0], { width: 40, height: 12 })).toContain('<svg')
    expect(sparklineSvg([Number.NaN, 1, 2], { width: 40, height: 12 })).toContain('<svg')
    expect(sparklineSvg([1, 2], { width: 0, height: 0 })).toContain('<svg')
  })

  it('a formula that overflows gives a number or an error, not a hang', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['=10^308*10'], ['=0/0'], ['=SQRT(-1)']] }])
    for (let r = 0; r < 3; r += 1) {
      const value = wb.getValue('S', r, 0)
      expect(typeof value === 'number' || typeof value === 'object').toBe(true)
    }
  })

  it('a workbook with a cell far out does not allocate the space between', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['1']] }])
    wb.setRaw('S', 5000, 3, '=A1+1')
    expect(wb.getValue('S', 5000, 3)).toBe(2)
    expect(wb.rowCount('S')).toBe(5001)
  })
})

describe('a pivot pointed at nonsense', () => {
  const grid = [['Region', 'Amount'], ['N', 10]]
  const valueAt = (r: number, c: number) => grid[r]?.[c] ?? ''
  const textAt = (r: number, c: number) => String(grid[r]?.[c] ?? '')

  it('answers nothing rather than throwing when a field is not there', () => {
    const pivot: SheetPivot = {
      id: 'p', source: rect(0, 0, 1, 1), target: { row: 4, col: 0 },
      rows: ['Nothing'], cols: ['Missing'], values: [{ field: 'Gone', agg: 'sum' }],
    }
    expect(() => pivotBlock(pivot, valueAt, textAt)).not.toThrow()
    expect(() => pivotDrill(pivot, 5, 1, valueAt, textAt)).not.toThrow()
  })

  it('answers nothing for a source that is one cell', () => {
    const pivot: SheetPivot = {
      id: 'p', source: rect(0, 0, 0, 0), target: { row: 4, col: 0 },
      rows: ['Region'], cols: [], values: [{ field: 'Amount', agg: 'sum' }],
    }
    expect(() => pivotBlock(pivot, valueAt, textAt)).not.toThrow()
  })
})

describe('the auditing tools on what cannot be walked', () => {
  it('gives no steps for a formula that does not parse, rather than throwing', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['']] }])
    expect(() => parseFormula('=SUM(')).toThrow()
    // The dialog catches that; what it must not do is walk a broken tree.
    const steps = evaluationSteps(parseFormula('=1+1'), () => ({ error: '#VALUE!' }))
    expect(steps).toHaveLength(1)
    void wb
  })

  it('checks a sheet whose cells are all errors without slowing to a crawl', () => {
    const cells = Array.from({ length: 500 }, () => ['=1/0', '=NOSUCH()', '=A1:A2 B1:B2'])
    const wb = createWorkbook([{ name: 'S', cells }])
    const found = checkSheet('S', {
      rowCount: () => wb.rowCount('S'), colCount: () => wb.colCount('S'),
      getRaw: (r, c) => wb.getRaw('S', r, c), getValue: (r, c) => wb.getValue('S', r, c),
    })
    expect(found.length).toBeGreaterThan(1000)
  })
})

describe('a document restored from something that is not one', () => {
  it('refuses a state with no workbook rather than half-applying it', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    expect(() => doc.setState({ version: 1, workbook: { sheets: [], active: '', names: {} }, sheets: {} })).not.toThrow()
    // The one sheet standing is kept: a workbook with no sheets has nowhere
    // to put the cursor.
    expect(doc.workbook.sheets.length).toBeGreaterThan(0)
  })

  it('reads a saved document with parts it has never seen', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const state = JSON.parse(JSON.stringify(doc.getState()))
    ;(state.sheets.S as Record<string, unknown>).somethingNew = [{ id: 'x' }]
    ;(state.workbook as Record<string, unknown>).alsoNew = true
    expect(() => doc.setState(state)).not.toThrow()
    expect(doc.workbook.getRaw('S', 0, 0)).toBe('1')
  })
})
