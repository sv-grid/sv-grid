import { describe, expect, it } from 'vitest'
import { sheetPrintHtml, printAreas, areasWithObjects, type SheetPrintInput } from './print'
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

describe('what floats over the cells, on the page', () => {
  it('draws a sparkline behind the cell it belongs to', () => {
    const html = sheetPrintHtml(input({
      cellAt: (r, c) => (r === 1 && c === 2
        ? { text: '', sparkline: '<svg width="80" height="16"><path d="M0 8 L80 2"/></svg>' }
        : { text: `${r}${c}` }),
      merges: [],
    }))
    expect(html).toContain('<td class="sp-cell"><span class="sp"><svg width="80" height="16">')
    expect(html).toContain('<span class="tx"></span>')
    expect(html).toContain('td .sp { position: absolute;')
  })

  it('fits an IMAGE cell\'s picture inside the cell, and prints no text under it', () => {
    const html = sheetPrintHtml(input({
      merges: [],
      cellAt: (r, c) => (r === 1 && c === 1
        ? { text: 'https://example.com/a.png', image: '<img src="https://example.com/a.png" alt="A logo">' }
        : { text: `${r}${c}` }),
    }))
    expect(html).toContain('<span class="im"><img src="https://example.com/a.png" alt="A logo">')
    expect(html).not.toContain('>https://example.com/a.png<')
    expect(html).toContain('td .im img { width: 100%; height: 100%; object-fit: contain; }')
  })

  it('hangs a picture and a chart from their anchor cells, with their own offsets', () => {
    const html = sheetPrintHtml(input({
      merges: [],
      objects: [
        { row: 1, col: 0, dx: 8, dy: 4, width: 220, height: 140, html: '<img src="data:image/png;base64,AAA" alt="">' },
        { row: 2, col: 1, dx: 0, dy: 0, width: 420, height: 260, html: '<svg width="420" height="260"></svg>' },
      ],
    }))
    expect(html).toContain('<td class="ob-cell"><span class="ob" style="inset-inline-start:8px;top:4px;width:220px;height:140px"><img src="data:image/png;base64,AAA" alt="">')
    expect(html).toContain('<span class="ob" style="inset-inline-start:0px;top:0px;width:420px;height:260px"><svg width="420" height="260">')
    // The cell it hangs from stops clipping, or a chart would print as a sliver.
    expect(html).toContain('td.ob-cell { overflow: visible; }')
  })

  it('leaves out an object anchored to a hidden row or outside the printed area', () => {
    const hidden = sheetPrintHtml(input({
      merges: [],
      objects: [{ row: 3, col: 0, dx: 0, dy: 0, width: 10, height: 10, html: '<img src="x" alt="">' }],
    }))
    expect(hidden).not.toContain('class="ob"')

    const outside = sheetPrintHtml(input({
      merges: [],
      setup: { ...defaultPageSetup(), printArea: [[0, 0, 0, 1]] as [number, number, number, number][] },
      objects: [{ row: 2, col: 0, dx: 0, dy: 0, width: 10, height: 10, html: '<img src="x" alt="">' }],
    }))
    expect(outside).not.toContain('class="ob"')
  })

  it('carries two objects on one cell, in order', () => {
    const html = sheetPrintHtml(input({
      merges: [],
      objects: [
        { row: 1, col: 0, dx: 0, dy: 0, width: 10, height: 10, html: '<img src="one" alt="">' },
        { row: 1, col: 0, dx: 20, dy: 0, width: 10, height: 10, html: '<img src="two" alt="">' },
      ],
    }))
    expect(html.indexOf('src="one"')).toBeLessThan(html.indexOf('src="two"'))
  })
})

describe('the area an object needs', () => {
  const setup = defaultPageSetup()
  const base = () => input({ merges: [], cellAt: (r, c) => ({ text: `${r},${c}` }) })

  it('grows the used range down and across to cover a chart below the numbers', () => {
    const withChart = {
      ...base(),
      objects: [{ row: 6, col: 0, dx: 8, dy: 8, width: 430, height: 250, html: '<svg></svg>' }],
    }
    // The used range is four rows of three columns; the chart hangs from row
    // 7 and needs twelve rows of 22px and five columns to hold it.
    expect(printAreas(withChart)).toEqual([[0, 0, 3, 2]])
    const grown = areasWithObjects(withChart)[0]!
    expect(grown[0]).toBe(0)
    expect(grown[2]).toBeGreaterThanOrEqual(17)
    expect(grown[3]).toBeGreaterThanOrEqual(3)
    // And the chart is on the page, in the cell it hangs from.
    expect(sheetPrintHtml(withChart)).toContain('<span class="ob" style="inset-inline-start:8px;top:8px;width:430px;height:250px">')
  })

  it('leaves an explicit print area exactly as it is', () => {
    const pinned = {
      ...base(),
      setup: { ...setup, printArea: [[0, 0, 1, 1]] as [number, number, number, number][] },
      objects: [{ row: 6, col: 0, dx: 0, dy: 0, width: 430, height: 250, html: '<svg></svg>' }],
    }
    expect(areasWithObjects(pinned)).toEqual([[0, 0, 1, 1]])
    expect(sheetPrintHtml(pinned)).not.toContain('class="ob"')
  })

  it('leaves the area alone when there is nothing floating over it', () => {
    expect(areasWithObjects(base())).toEqual([[0, 0, 3, 2]])
  })
})

describe('a table on the printed page', () => {
  it('prints the bands the sheet draws, under whatever the cell says itself', () => {
    const html = sheetPrintHtml(input({
      rowCount: 3,
      colCount: 2,
      merges: [],
      hidden: { rows: new Set(), cols: new Set() },
      cellAt: (r, c) => {
        if (r === 0) return { text: `H${c}`, table: { fill: '#5b9bd5', color: '#ffffff', bold: true, borderBottom: '#2e75b6' } }
        if (r === 1) return { text: `${r}${c}`, table: { fill: '#dce6f1' } }
        // A cell with a fill of its own: the table's band goes under it.
        return { text: `${r}${c}`, table: { fill: '#dce6f1' }, entry: { fill: '#fde68a' } }
      },
    }))
    expect(html).toContain('background:#5b9bd5')
    expect(html).toContain('color:#ffffff')
    expect(html).toContain('border-bottom:1px solid #2e75b6')
    expect(html).toContain('background:#dce6f1')
    // The cell's own fill is written after the table's, so it wins.
    const ownRow = html.slice(html.lastIndexOf('<tr'))
    expect(ownRow.indexOf('background:#dce6f1')).toBeLessThan(ownRow.indexOf('background:#fde68a'))
  })

  it('leaves a sheet with no table exactly as it was', () => {
    expect(sheetPrintHtml(input())).not.toContain('font-weight:600')
  })
})
