/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createSheetDocument } from './document'
import { documentToXlsxParts, documentFromXlsxParts } from './xlsx-document'
import { chartRefs, dataUrlParts, rectOfRef, EMU_PER_PX } from './xlsx-drawing'
import type { SheetChartObject, SheetImageObject } from './objects'

/** A one-pixel PNG, which is a real image and a short string. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const chart = (over: Partial<SheetChartObject> = {}): SheetChartObject => ({
  id: 'c1',
  kind: 'chart',
  anchor: { row: 8, col: 1, dx: 8, dy: 4, width: 420, height: 260 },
  range: [0, 0, 4, 2] as never,
  type: 'bar',
  headers: true,
  series: 'columns',
  ...over,
})

const picture = (over: Partial<SheetImageObject> = {}): SheetImageObject => ({
  id: 'i1',
  kind: 'image',
  anchor: { row: 2, col: 5, dx: 0, dy: 0, width: 96, height: 48 },
  src: PNG,
  ...over,
})

const sheetWith = (objects: Array<SheetChartObject | SheetImageObject>) => {
  const doc = createSheetDocument({
    sheets: [{ name: 'Sales', cells: [
      ['Region', 'Q1', 'Q2'],
      ['North', '48000', '52500'],
      ['South', '39000', '41500'],
      ['EMEA', '71000', '69500'],
      ['APAC', '23000', '28500'],
    ] }],
  })
  doc.get('Sales').objects = objects
  return doc
}

describe('references a chart part carries', () => {
  it('reads the block the way the drawn chart reads it, by columns', () => {
    const refs = chartRefs(chart(), 'Sales')
    expect(refs.categories).toBe('Sales!$A$2:$A$5')
    expect(refs.series).toEqual([
      { name: 'Sales!$B$1', values: 'Sales!$B$2:$B$5' },
      { name: 'Sales!$C$1', values: 'Sales!$C$2:$C$5' },
    ])
  })

  it('reads it by rows, and without headers', () => {
    expect(chartRefs(chart({ series: 'rows' }), 'Sales').series).toEqual([
      { name: 'Sales!$A$2', values: 'Sales!$B$2:$C$2' },
      { name: 'Sales!$A$3', values: 'Sales!$B$3:$C$3' },
      { name: 'Sales!$A$4', values: 'Sales!$B$4:$C$4' },
      { name: 'Sales!$A$5', values: 'Sales!$B$5:$C$5' },
    ])
    const bare = chartRefs(chart({ headers: false }), 'Sales')
    expect(bare.categories).toBe('')
    expect(bare.series[0]).toEqual({ name: '', values: 'Sales!$A$1:$A$5' })
  })

  it('quotes a sheet name that needs it', () => {
    expect(chartRefs(chart(), 'Price list').categories).toBe("'Price list'!$A$2:$A$5")
  })
})

describe('a data URL', () => {
  it('splits into its media type and payload, and refuses what is not base64', () => {
    expect(dataUrlParts(PNG)).toMatchObject({ mime: 'image/png' })
    expect(dataUrlParts('data:image/svg+xml,<svg/>')).toBeNull()
    expect(dataUrlParts('https://example.com/a.png')).toBeNull()
  })
})

describe('a reference back to a rectangle', () => {
  it('reads a sheet, a block and a single cell', () => {
    expect(rectOfRef('Sales!$B$2:$C$5')).toEqual({ sheet: 'Sales', rect: [1, 1, 4, 2] })
    expect(rectOfRef("'Price list'!$A$1")).toEqual({ sheet: 'Price list', rect: [0, 0, 0, 0] })
    expect(rectOfRef('nonsense')).toBeNull()
  })
})

describe('objects in the package', () => {
  it('writes a picture as media plus an anchor, and reads it back', () => {
    const parts = documentToXlsxParts(sheetWith([picture({ alt: 'The logo' })]))
    expect(parts['xl/media/image1.png']).toBe(PNG)
    const drawing = parts['xl/drawings/drawing1.xml']!
    expect(drawing).toContain('<xdr:col>5</xdr:col>')
    expect(drawing).toContain('<xdr:row>2</xdr:row>')
    expect(drawing).toContain(`cx="${96 * EMU_PER_PX}"`)
    expect(drawing).toContain('descr="The logo"')
    expect(parts['xl/drawings/_rels/drawing1.xml.rels']).toContain('Target="../media/image1.png"')
    expect(parts['xl/worksheets/sheet1.xml']).toContain('<drawing r:id="rIdD1"/>')
    expect(parts['xl/worksheets/_rels/sheet1.xml.rels']).toContain('Target="../drawings/drawing1.xml"')
    expect(parts['[Content_Types].xml']).toContain('<Default Extension="png" ContentType="image/png"/>')

    const back = documentFromXlsxParts(parts).sheets.Sales!.objects!
    expect(back).toHaveLength(1)
    expect(back[0]).toMatchObject({
      kind: 'image',
      src: PNG,
      alt: 'The logo',
      anchor: { row: 2, col: 5, width: 96, height: 48 },
    })
  })

  it('writes a chart as its own part, with the references rather than the numbers', () => {
    const parts = documentToXlsxParts(sheetWith([chart({ title: 'Sales by region' })]))
    const part = parts['xl/charts/chart1.xml']!
    expect(part).toContain('<c:barChart>')
    expect(part).toContain('<c:f>Sales!$B$2:$B$5</c:f>')
    expect(part).toContain('<c:f>Sales!$A$2:$A$5</c:f>')
    expect(part).toContain('<a:t>Sales by region</a:t>')
    // The numbers themselves are not in the file: Excel reads them from the
    // cells beside it.
    expect(part).not.toContain('48000')
    expect(parts['xl/drawings/drawing1.xml']).toContain('<xdr:graphicFrame')
    expect(parts['[Content_Types].xml']).toContain('/xl/charts/chart1.xml')

    const back = documentFromXlsxParts(parts).sheets.Sales!.objects!
    expect(back[0]).toMatchObject({
      kind: 'chart',
      type: 'bar',
      headers: true,
      series: 'columns',
      title: 'Sales by region',
      range: [0, 0, 4, 2],
      anchor: { row: 8, col: 1, width: 420, height: 260 },
    })
  })

  it('writes a trendline as the element Excel names, and reads it back', () => {
    const linear = documentToXlsxParts(sheetWith([chart({ trend: 'linear' })]))
    expect(linear['xl/charts/chart1.xml']).toContain('<c:trendline><c:trendlineType val="linear"/></c:trendline>')
    expect(documentFromXlsxParts(linear).sheets.Sales!.objects![0]).toMatchObject({ trend: 'linear' })

    const moving = documentToXlsxParts(sheetWith([chart({ trend: 'sma3' })]))
    expect(moving['xl/charts/chart1.xml']).toContain('<c:trendlineType val="movingAvg"/><c:period val="3"/>')
    expect(documentFromXlsxParts(moving).sheets.Sales!.objects![0]).toMatchObject({ trend: 'sma3' })

    const plain = documentToXlsxParts(sheetWith([chart()]))
    expect(plain['xl/charts/chart1.xml']).not.toContain('trendline')
    expect(documentFromXlsxParts(plain).sheets.Sales!.objects![0]).not.toHaveProperty('trend')
  })

  it('orders a series the way the schema does, trendline before the categories', () => {
    // Excel reports a file whose chart elements are out of order as one
    // needing repair, so the order is worth pinning rather than assuming.
    const part = documentToXlsxParts(sheetWith([chart({ trend: 'linear' })]))['xl/charts/chart1.xml']!
    const ser = part.slice(part.indexOf('<c:ser>'), part.indexOf('</c:ser>'))
    const order = ['<c:idx', '<c:order', '<c:tx>', '<c:trendline>', '<c:cat>', '<c:val>'].map((tag) => ser.indexOf(tag))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('writes each chart kind as the element Excel names it', () => {
    for (const [type, tag] of [['line', 'lineChart'], ['area', 'areaChart'], ['pie', 'pieChart'], ['scatter', 'scatterChart']] as const) {
      const parts = documentToXlsxParts(sheetWith([chart({ type })]))
      expect(parts['xl/charts/chart1.xml']).toContain(`<c:${tag}>`)
      expect(documentFromXlsxParts(parts).sheets.Sales!.objects![0]).toMatchObject({ kind: 'chart', type })
    }
  })

  it('numbers the parts across the workbook and keeps a stacked chart stacked', () => {
    const parts = documentToXlsxParts(sheetWith([picture(), chart({ stacked: true }), picture()]))
    expect(Object.keys(parts).filter((p) => p.startsWith('xl/media/')).sort()).toEqual(['xl/media/image1.png', 'xl/media/image2.png'])
    expect(parts['xl/charts/chart1.xml']).toContain('<c:grouping val="stacked"/>')
    const back = documentFromXlsxParts(parts).sheets.Sales!.objects!
    expect(back.map((o) => o.kind)).toEqual(['image', 'chart', 'image'])
    expect(back[1]).toMatchObject({ stacked: true })
  })

  it('leaves a picture whose bytes are somewhere else out of the file', () => {
    const parts = documentToXlsxParts(sheetWith([picture({ src: 'https://example.com/logo.png' })]))
    expect(Object.keys(parts).some((p) => p.startsWith('xl/media/'))).toBe(false)
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<drawing')
  })

  it('writes nothing about drawings for a sheet with no objects', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const parts = documentToXlsxParts(doc)
    expect(Object.keys(parts).some((p) => p.startsWith('xl/drawings/'))).toBe(false)
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<drawing')
  })

  it('reads a two-cell anchor from another producer at about the right size', () => {
    const parts = documentToXlsxParts(sheetWith([picture()]))
    parts['xl/drawings/drawing1.xml'] = parts['xl/drawings/drawing1.xml']!
      .replace('<xdr:oneCellAnchor>', '<xdr:twoCellAnchor>')
      .replace('</xdr:oneCellAnchor>', '</xdr:twoCellAnchor>')
      .replace(/<xdr:ext[^/]*\/>/, '<xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>')
    const back = documentFromXlsxParts(parts).sheets.Sales!.objects!
    // Two columns wide and three rows tall, at the default sizes.
    expect(back[0]!.anchor).toMatchObject({ row: 2, col: 5, width: 128, height: 60 })
  })
})

describe('the package stays well formed', () => {
  it('every part of a document with a chart, a picture and sparklines parses', () => {
    const doc = sheetWith([picture(), chart({ title: 'Sales & "growth" <2026>' })])
    doc.get('Sales').sparklines = [{ id: 's', location: [1, 4, 2, 4] as never, data: [1, 1, 2, 3] as never, type: 'line' }]
    const parts = documentToXlsxParts(doc)
    for (const [path, xml] of Object.entries(parts)) {
      if (path.startsWith('xl/media/')) continue
      const parsed = new DOMParser().parseFromString(xml, 'application/xml')
      expect([path, parsed.getElementsByTagName('parsererror').length]).toEqual([path, 0])
    }
    // The title's angle brackets and quotes went in escaped, not raw.
    expect(parts["xl/charts/chart1.xml"]).toContain("Sales &amp; &quot;growth&quot; &lt;2026&gt;")
  })
})

describe('sparklines in the package', () => {
  const withSparklines = () => {
    const doc = createSheetDocument({
      sheets: [{ name: 'Sales', cells: [
        ['Region', 'Jan', 'Feb', 'Mar', ''],
        ['North', '10', '14', '9', ''],
        ['South', '7', '5', '11', ''],
      ] }],
    })
    doc.get('Sales').sparklines = [{
      id: 's1',
      location: [1, 4, 2, 4] as never,
      data: [1, 1, 2, 3] as never,
      type: 'column',
      color: '#2563eb',
      negativeColor: '#e11d48',
      sameScale: true,
    }]
    return doc
  }

  it('goes into the worksheet extension list, one entry per cell', () => {
    const sheet = documentToXlsxParts(withSparklines())['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('<x14:sparklineGroup type="column"')
    expect(sheet).toContain('minAxisType="group" maxAxisType="group"')
    expect(sheet).toContain('<x14:colorSeries rgb="FF2563EB"/>')
    expect(sheet).toContain('<x14:colorNegative rgb="FFE11D48"/>')
    expect(sheet).toContain('<xm:f>Sales!B2:D2</xm:f><xm:sqref>E2</xm:sqref>')
    expect(sheet).toContain('<xm:f>Sales!B3:D3</xm:f><xm:sqref>E3</xm:sqref>')
  })

  it('comes back as the same group', () => {
    const back = documentFromXlsxParts(documentToXlsxParts(withSparklines())).sheets.Sales!.sparklines!
    expect(back).toHaveLength(1)
    expect(back[0]).toMatchObject({
      location: [1, 4, 2, 4],
      data: [1, 1, 2, 3],
      type: 'column',
      color: '#2563eb',
      negativeColor: '#e11d48',
      sameScale: true,
    })
  })

  it('reads a Win/Loss group and a plain line group', () => {
    for (const [type, written] of [['winloss', 'stacked'], ['line', null]] as const) {
      const doc = withSparklines()
      doc.get('Sales').sparklines = [{ id: 's', location: [1, 4, 1, 4] as never, data: [1, 1, 1, 3] as never, type }]
      const parts = documentToXlsxParts(doc)
      if (written) expect(parts['xl/worksheets/sheet1.xml']).toContain(`type="${written}"`)
      else expect(parts['xl/worksheets/sheet1.xml']).not.toContain('sparklineGroup type=')
      expect(documentFromXlsxParts(parts).sheets.Sales!.sparklines![0]).toMatchObject({ type })
    }
  })
})
