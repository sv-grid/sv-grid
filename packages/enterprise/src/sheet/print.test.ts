import { describe, expect, it } from 'vitest'
import { sheetPrintHtml, printAreas, type SheetPrintInput } from './print'
import { defaultPageSetup } from './page-setup'

function input(overrides: Partial<SheetPrintInput> = {}): SheetPrintInput {
  return {
    name: 'Budget',
    rowCount: 4,
    colCount: 3,
    cellAt: (r, c) => {
      if (r === 0) return { text: ['Item', 'Q1', 'Q2'][c]!, entry: { bold: true, fill: '#e2e8f0' } }
      if (c === 0) return { text: `Line ${r}` }
      return { text: String(r * 10 + c), align: 'right', ...(r === 2 && c === 1 ? { cf: { color: '#9c0006' } } : {}) }
    },
    widths: { A: 150 },
    defaultWidth: 96,
    heights: new Map([[0, 32]]),
    defaultHeight: 22,
    hidden: { rows: new Set([3]), cols: new Set() },
    merges: [[1, 1, 1, 2]],
    setup: defaultPageSetup(),
    ...overrides,
  }
}

describe('sheetPrintHtml', () => {
  it('lays the used range out as a table with widths, heights, formats, merges and hidden lines', () => {
    const html = sheetPrintHtml(input())
    expect(html).toContain('<title>Budget</title>')
    expect(html).toContain('@page { size: A4 portrait; margin: 0.75in 0.7in 0.75in 0.7in; }')
    expect(html).toContain('<colgroup><col style="width:150px"><col style="width:96px"><col style="width:96px"></colgroup>')
    expect(html).toContain('<tr style="height:32px"><td style="font-weight:700;background:#e2e8f0">Item</td>')
    expect(html).toContain('<td colspan="2" style="text-align:right">11</td>')
    expect(html).not.toContain('>12<')
    expect(html).toContain('<td style="text-align:right;color:#9c0006">21</td>')
    expect(html).not.toContain('Line 3')
    expect(html).toContain('td, th { border: 1px solid transparent; }')
    expect(html).not.toContain('<thead>')
    expect(html).toContain('zoom: 1;')
  })

  it('the setup: landscape Letter with narrow margins, gridlines, headings, a print area, title rows and a scale', () => {
    const setup = { ...defaultPageSetup(), orientation: 'landscape' as const, paper: 'Letter' as const, gridlines: true, headings: true, scale: 80, printArea: [[1, 0, 3, 1]] as [number, number, number, number][], printTitleRows: [0, 0] as [number, number] }
    setup.margins = { top: 0.75, bottom: 0.75, left: 0.25, right: 0.25, header: 0.3, footer: 0.3 }
    const html = sheetPrintHtml(input({ setup }))
    expect(html).toContain('@page { size: letter landscape; margin: 0.75in 0.25in 0.75in 0.25in; }')
    expect(html).toContain('td, th { border: 1px solid #d0d0d0; }')
    expect(html).toContain('zoom: 0.8;')
    expect(html).toContain('<tr class="ch"><th class="corner"></th><th>A</th><th>B</th></tr>')
    expect(html).toContain('<thead><tr class="ch">')
    expect(html).toContain('<th class="rh">1</th><th style="font-weight:700;background:#e2e8f0">Item</th>')
    expect(html).toContain('<th class="rh">2</th><td>Line 1</td><td style="text-align:right">11</td></tr>')
    expect(html).not.toContain('>Q2<')
    expect(printAreas({ rowCount: 4, colCount: 3, setup })).toEqual([[1, 0, 3, 1]])
    expect(printAreas({ rowCount: 4, colCount: 3, setup: defaultPageSetup() })).toEqual([[0, 0, 3, 2]])
  })

  it('two print areas are two tables with a page break between', () => {
    const setup = { ...defaultPageSetup(), printArea: [[0, 0, 0, 0], [2, 2, 2, 2]] as [number, number, number, number][] }
    const html = sheetPrintHtml(input({ setup }))
    expect(html.match(/<table>/g)).toHaveLength(2)
    expect(html).toContain('table + table { break-before: page; }')
    expect(html).toContain('<td style="text-align:right">22</td>')
  })
})
