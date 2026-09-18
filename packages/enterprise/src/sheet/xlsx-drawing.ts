/**
 * The drawing part: the objects on a sheet, written into the .xlsx and read
 * back out of one.
 *
 * Until now a chart or a picture lived in the document and nowhere else, so
 * Save As wrote the cells and left the objects behind. Excel keeps them in
 * a separate part per sheet (`xl/drawings/drawing1.xml`), each anchored to a
 * cell, with a picture's bytes in `xl/media` and a chart's definition in its
 * own part. This builds those, and reads them.
 *
 * Two deliberate simplifications, both visible to the reader:
 *
 * - Every object is a ONE-cell anchor: the cell it hangs from plus a size in
 *   English Metric Units. That is exactly what the model holds ("move but
 *   don't size with cells"), so nothing is invented on the way out and
 *   nothing is lost on the way back.
 * - A chart part carries the REFERENCES its series read, not a cached copy
 *   of the numbers. Excel recalculates a chart from its references on open,
 *   so a file written here redraws from the cells beside it rather than from
 *   a snapshot that can disagree with them.
 */
import { colToLetters } from './address'
import type { CellValue } from './ast'
import type { SheetChartObject, SheetImageObject, SheetObject } from './objects'
import type { Rect } from './format-store'

const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

export const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing'
export const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
export const REL_CHART = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart'

/** Excel measures a drawing in English Metric Units: 9525 to the pixel. */
export const EMU_PER_PX = 9525
const emu = (px: number) => Math.round(px * EMU_PER_PX)
const px = (value: number) => Math.round(value / EMU_PER_PX)

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** An absolute reference the way a chart part spells one. */
function ref(sheet: string, r1: number, c1: number, r2 = r1, c2 = c1): string {
  const name = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet) ? sheet : `'${sheet.replace(/'/g, "''")}'`
  const from = `$${colToLetters(c1)}$${r1 + 1}`
  const to = `$${colToLetters(c2)}$${r2 + 1}`
  return `${name}!${from === to ? from : `${from}:${to}`}`
}

/** The image types Excel writes, by the extension the media part takes. */
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'png',
  'image/bmp': 'bmp',
}

/** A data URL split into its media type and its payload, or null. */
export function dataUrlParts(src: string): { mime: string; base64: string } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(src.trim())
  if (!match) return null
  const mime = match[1]!.toLowerCase()
  // A data URL without `;base64` is percent-encoded text, which is not a
  // picture worth writing into a spreadsheet.
  if (!match[2]) return null
  return { mime, base64: match[3]! }
}

export type DrawingParts = {
  /** `xl/drawings/drawing<n>.xml`, or null when the sheet has nothing to draw. */
  drawingPath: string | null
  drawingXml: string
  drawingRels: string
  /** Extra parts, keyed by their path: the chart definitions and the media. */
  parts: Record<string, string>
  /** Content-type overrides these parts need. */
  overrides: string[]
  /** Default extensions the package must declare for the media written. */
  extensions: string[]
  /** Objects that could not be written, for a caller that wants to say so. */
  skipped: SheetObject[]
}

export type DrawingContext = {
  /** The sheet the objects sit on, for a chart's references. */
  sheet: string
  /** 1-based index of this drawing part in the package. */
  index: number
  /** The number of chart parts already written, so the next one is unique. */
  chartsSoFar: number
  /** The number of media parts already written. */
  mediaSoFar: number
  valueAt(row: number, col: number): CellValue
  textAt(row: number, col: number): string
}

/**
 * The drawing part for one sheet's objects, with the charts and the media
 * they need.
 *
 * A picture whose source is not a `data:` URL is skipped rather than
 * guessed at: its bytes are somewhere else, and a spreadsheet that opens
 * with a broken image in it is worse than one that opens without the
 * image.
 */
export function drawingPartsFor(objects: ReadonlyArray<SheetObject>, context: DrawingContext): DrawingParts {
  const empty: DrawingParts = {
    drawingPath: null, drawingXml: '', drawingRels: '', parts: {}, overrides: [], extensions: [], skipped: [],
  }
  if (objects.length === 0) return empty

  const anchors: string[] = []
  const rels: string[] = []
  const parts: Record<string, string> = {}
  const overrides: string[] = []
  const extensions = new Set<string>()
  const skipped: SheetObject[] = []
  let charts = context.chartsSoFar
  let media = context.mediaSoFar
  let shape = 1

  for (const object of objects) {
    shape += 1
    const rel = `rId${rels.length + 1}`
    if (object.kind === 'image') {
      const data = dataUrlParts(object.src)
      const extension = data ? IMAGE_TYPES[data.mime] : undefined
      if (!data || !extension) { skipped.push(object); continue }
      media += 1
      const path = `xl/media/image${media}.${extension}`
      // Media rides in the parts map as the data URL it came from; the zip
      // writer is what turns it back into bytes, so everything here stays
      // text and stays testable.
      parts[path] = `data:${data.mime};base64,${data.base64}`
      extensions.add(extension)
      rels.push(`<Relationship Id="${rel}" Type="${REL_IMAGE}" Target="../media/image${media}.${extension}"/>`)
      anchors.push(pictureAnchor(object, rel, shape))
      continue
    }
    charts += 1
    const path = `xl/charts/chart${charts}.xml`
    parts[path] = chartPart(object, context)
    overrides.push(`<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`)
    rels.push(`<Relationship Id="${rel}" Type="${REL_CHART}" Target="../charts/chart${charts}.xml"/>`)
    anchors.push(chartAnchor(object, rel, shape))
  }

  if (anchors.length === 0) return { ...empty, skipped }
  const drawingPath = `xl/drawings/drawing${context.index}.xml`
  overrides.push(`<Override PartName="/${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`)
  return {
    drawingPath,
    drawingXml: `<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${anchors.join('')}</xdr:wsDr>`,
    drawingRels: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`,
    parts,
    overrides,
    extensions: [...extensions],
    skipped,
  }
}

function anchorFrom(object: SheetObject): string {
  const { row, col, dx, dy, width, height } = object.anchor
  return `<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${emu(dx)}</xdr:colOff>`
    + `<xdr:row>${row}</xdr:row><xdr:rowOff>${emu(dy)}</xdr:rowOff></xdr:from>`
    + `<xdr:ext cx="${emu(width)}" cy="${emu(height)}"/>`
}

function pictureAnchor(object: SheetImageObject, rel: string, shape: number): string {
  const { width, height } = object.anchor
  return '<xdr:oneCellAnchor>'
    + anchorFrom(object)
    + '<xdr:pic>'
    + `<xdr:nvPicPr><xdr:cNvPr id="${shape}" name="Picture ${shape}"${object.alt ? ` descr="${esc(object.alt)}"` : ''}/><xdr:cNvPicPr/></xdr:nvPicPr>`
    + `<xdr:blipFill><a:blip xmlns:r="${NS_R}" r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
    + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm>`
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>'
    + '</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>'
}

function chartAnchor(object: SheetChartObject, rel: string, shape: number): string {
  const { width, height } = object.anchor
  return '<xdr:oneCellAnchor>'
    + anchorFrom(object)
    + '<xdr:graphicFrame macro="">'
    + `<xdr:nvGraphicFramePr><xdr:cNvPr id="${shape}" name="Chart ${shape}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
    + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></xdr:xfrm>`
    + `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="${rel}"/></a:graphicData></a:graphic>`
    + '</xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>'
}

/** The lines the chart reads, worked out the way `chartSpecOf` works them
 *  out, so the file and the screen show the same chart. */
export function chartRefs(object: SheetChartObject, sheet: string): {
  categories: string
  series: Array<{ name: string; values: string }>
} {
  const [r1, c1, r2, c2] = object.range
  const byColumns = object.series === 'columns'
  const seriesFrom = byColumns ? c1 : r1
  const seriesTo = byColumns ? c2 : r2
  const pointFrom = byColumns ? r1 : c1
  const pointTo = byColumns ? r2 : c2
  const firstSeries = object.headers ? seriesFrom + 1 : seriesFrom
  const firstPoint = object.headers ? pointFrom + 1 : pointFrom
  const cell = (s: number, p: number) => (byColumns ? { row: p, col: s } : { row: s, col: p })

  const catFrom = cell(seriesFrom, firstPoint)
  const catTo = cell(seriesFrom, pointTo)
  const categories = object.headers ? ref(sheet, catFrom.row, catFrom.col, catTo.row, catTo.col) : ''

  const series: Array<{ name: string; values: string }> = []
  for (let s = firstSeries; s <= seriesTo; s += 1) {
    const head = cell(s, pointFrom)
    const from = cell(s, firstPoint)
    const to = cell(s, pointTo)
    series.push({
      name: object.headers ? ref(sheet, head.row, head.col) : '',
      values: ref(sheet, from.row, from.col, to.row, to.col),
    })
  }
  return { categories, series }
}

/** One chart part. */
function chartPart(object: SheetChartObject, context: DrawingContext): string {
  const { categories, series } = chartRefs(object, context.sheet)
  const grouping = object.stacked ? 'stacked' : object.type === 'bar' ? 'clustered' : 'standard'

  const body = series.map((s, i) => {
    const name = s.name ? `<c:tx><c:strRef><c:f>${esc(s.name)}</c:f></c:strRef></c:tx>` : ''
    const cat = categories ? `<c:cat><c:strRef><c:f>${esc(categories)}</c:f></c:strRef></c:cat>` : ''
    // Excel's own trendline element, so the line drawn here is a trendline
    // there rather than a second series of numbers.
    //
    // Its place in the series matters: the schema orders a series
    // idx, order, tx, ..., trendline, errBars, cat, val, and Excel reports a
    // file whose elements are out of that order as one needing repair.
    const trend = object.trend
      ? `<c:trendline><c:trendlineType val="${object.trend === 'sma3' ? 'movingAvg' : 'linear'}"/>${object.trend === 'sma3' ? '<c:period val="3"/>' : ''}</c:trendline>`
      : ''
    if (object.type === 'scatter') {
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${name}${trend}`
        + (categories ? `<c:xVal><c:numRef><c:f>${esc(categories)}</c:f></c:numRef></c:xVal>` : '')
        + `<c:yVal><c:numRef><c:f>${esc(s.values)}</c:f></c:numRef></c:yVal></c:ser>`
    }
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${name}${trend}${cat}`
      + `<c:val><c:numRef><c:f>${esc(s.values)}</c:f></c:numRef></c:val></c:ser>`
  }).join('')

  const plot = object.type === 'pie'
    ? `<c:pieChart><c:varyColors val="1"/>${body}</c:pieChart>`
    : object.type === 'line'
      ? `<c:lineChart><c:grouping val="${object.stacked ? 'stacked' : 'standard'}"/><c:marker val="1"/>${body}<c:axId val="1"/><c:axId val="2"/></c:lineChart>`
      : object.type === 'area'
        ? `<c:areaChart><c:grouping val="${object.stacked ? 'stacked' : 'standard'}"/>${body}<c:axId val="1"/><c:axId val="2"/></c:areaChart>`
        : object.type === 'scatter'
          ? `<c:scatterChart><c:scatterStyle val="lineMarker"/>${body}<c:axId val="1"/><c:axId val="2"/></c:scatterChart>`
          : `<c:barChart><c:barDir val="col"/><c:grouping val="${grouping}"/>${object.stacked ? '<c:overlap val="100"/>' : ''}${body}<c:axId val="1"/><c:axId val="2"/></c:barChart>`

  const axes = object.type === 'pie'
    ? ''
    : `<c:${object.type === 'scatter' ? 'valAx' : 'catAx'}><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:${object.type === 'scatter' ? 'valAx' : 'catAx'}>`
      + '<c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx>'

  const title = object.title
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(object.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>'

  return `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">`
    + `<c:chart>${title}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>`
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>'
}

// ---------------------------------------------------------------------------
// Reading one back
// ---------------------------------------------------------------------------

/** The elements of one namespace, by local name, in document order. */
function tags(root: Element | Document, ns: string, local: string): Element[] {
  return [...root.getElementsByTagNameNS(ns, local)]
}

function first(root: Element, ns: string, local: string): Element | null {
  return root.getElementsByTagNameNS(ns, local)[0] ?? null
}

function numberIn(root: Element | null, ns: string, local: string): number {
  const el = root ? first(root, ns, local) : null
  const value = Number(el?.textContent ?? '')
  return Number.isFinite(value) ? value : 0
}

/** A reference like `Sales!$B$2:$B$7`, as a rectangle on its sheet. */
export function rectOfRef(text: string): { sheet: string | null; rect: Rect } | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const bang = trimmed.lastIndexOf('!')
  const sheetPart = bang >= 0 ? trimmed.slice(0, bang) : ''
  const cells = bang >= 0 ? trimmed.slice(bang + 1) : trimmed
  const sheet = sheetPart.startsWith("'") && sheetPart.endsWith("'")
    ? sheetPart.slice(1, -1).replace(/''/g, "'")
    : sheetPart || null
  const ends = cells.split(':').map((part) => /^\$?([A-Za-z]+)\$?(\d+)$/.exec(part.trim()))
  if (!ends[0]) return null
  const at = (m: RegExpExecArray) => ({
    col: m[1]!.toUpperCase().split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1,
    row: Number(m[2]) - 1,
  })
  const from = at(ends[0])
  const to = ends[1] ? at(ends[1]) : from
  return {
    sheet,
    rect: [
      Math.min(from.row, to.row), Math.min(from.col, to.col),
      Math.max(from.row, to.row), Math.max(from.col, to.col),
    ] as unknown as Rect,
  }
}

export type DrawingReadContext = {
  /** Parse a part, the way the reader parses every other one. */
  parse(xml: string, what: string): Document
  /** The drawing part's own relationships, by id. */
  rels: Map<string, { target: string; type: string }>
  /** Every part in the package. Media entries are data URLs by the time
   *  they reach here, which is what an image object holds anyway. */
  parts: Record<string, string>
  /** A fresh object id. */
  newId(): string
  /** Column width and row height in pixels, for the one case that needs
   *  them: a two-cell anchor, whose size is a pair of cells rather than a
   *  measurement. Defaults to Excel's own defaults. */
  columnWidth?(col: number): number
  rowHeight?(row: number): number
}

/**
 * The objects a drawing part holds.
 *
 * A one-cell anchor gives its size outright. A two-cell anchor, which is
 * what most other producers write, gives a second cell instead, so the size
 * is measured across the cells between them: approximate where the columns
 * are not the default width, and better than dropping the picture.
 */
export function objectsFromDrawing(drawingXml: string, context: DrawingReadContext): SheetObject[] {
  const root = context.parse(drawingXml, 'drawing').documentElement
  const out: SheetObject[] = []
  const anchors = [...tags(root, NS_XDR, 'oneCellAnchor'), ...tags(root, NS_XDR, 'twoCellAnchor')]
  for (const anchor of anchors) {
    const from = first(anchor, NS_XDR, 'from')
    if (!from) continue
    const col = numberIn(from, NS_XDR, 'col')
    const row = numberIn(from, NS_XDR, 'row')
    const dx = px(numberIn(from, NS_XDR, 'colOff'))
    const dy = px(numberIn(from, NS_XDR, 'rowOff'))
    const ext = first(anchor, NS_XDR, 'ext')
    let width = ext ? px(Number(ext.getAttribute('cx') ?? 0)) : 0
    let height = ext ? px(Number(ext.getAttribute('cy') ?? 0)) : 0
    if (!width || !height) {
      const to = first(anchor, NS_XDR, 'to')
      const toCol = to ? numberIn(to, NS_XDR, 'col') : col + 4
      const toRow = to ? numberIn(to, NS_XDR, 'row') : row + 8
      const widthOf = context.columnWidth ?? (() => 64)
      const heightOf = context.rowHeight ?? (() => 20)
      width = 0
      height = 0
      for (let c = col; c < toCol; c += 1) width += widthOf(c)
      for (let r = row; r < toRow; r += 1) height += heightOf(r)
      width = Math.max(width - dx + (to ? px(numberIn(to, NS_XDR, 'colOff')) : 0), 24)
      height = Math.max(height - dy + (to ? px(numberIn(to, NS_XDR, 'rowOff')) : 0), 24)
    }
    const at = { row, col, dx, dy, width, height }

    const pic = first(anchor, NS_XDR, 'pic')
    if (pic) {
      const blip = first(pic, NS_A, 'blip')
      const id = blip?.getAttributeNS(NS_R, 'embed') ?? blip?.getAttribute('r:embed')
      const target = id ? context.rels.get(id)?.target : undefined
      const src = target ? context.parts[target] : undefined
      // Only a picture whose bytes are in the package comes back; one that
      // points outside it would be a broken image on the sheet.
      if (!src || !src.startsWith('data:')) continue
      const name = first(pic, NS_XDR, 'cNvPr')
      const alt = name?.getAttribute('descr') ?? undefined
      out.push({ id: context.newId(), kind: 'image', anchor: at, src, ...(alt ? { alt } : {}) })
      continue
    }

    const frame = first(anchor, NS_XDR, 'graphicFrame')
    if (!frame) continue
    const chartEl = first(frame, NS_C, 'chart')
    const chartId = chartEl?.getAttributeNS(NS_R, 'id') ?? chartEl?.getAttribute('r:id')
    const chartPath = chartId ? context.rels.get(chartId)?.target : undefined
    const chartXml = chartPath ? context.parts[chartPath] : undefined
    if (!chartXml) continue
    const chart = chartFromPart(chartXml, at, context)
    if (chart) out.push(chart)
  }
  return out
}

/** The chart kind a chart part describes, and the block its series read. */
function chartFromPart(xml: string, anchor: SheetObject['anchor'], context: DrawingReadContext): SheetChartObject | null {
  const root = context.parse(xml, 'chart').documentElement
  const kinds: Array<[string, SheetChartObject['type']]> = [
    ['barChart', 'bar'], ['lineChart', 'line'], ['areaChart', 'area'],
    ['pieChart', 'pie'], ['scatterChart', 'scatter'],
  ]
  const found = kinds.find(([tag]) => first(root, NS_C, tag) !== null)
  if (!found) return null
  const [tag, type] = found
  const plot = first(root, NS_C, tag)!

  // The block the chart reads is the union of every reference in it: the
  // categories, the series names and the values. That is how a chart
  // written by anything else comes back as a range rather than as a copy.
  let sheet: string | null = null
  let rect: Rect | null = null
  let headers = false
  for (const f of tags(plot, NS_C, 'f')) {
    const parsed = rectOfRef(f.textContent ?? '')
    if (!parsed) continue
    sheet = sheet ?? parsed.sheet
    const inside = f.parentElement?.parentElement?.localName
    if (inside === 'tx' || inside === 'cat' || inside === 'xVal') headers = true
    rect = rect ? union(rect, parsed.rect) : parsed.rect
  }
  if (!rect) return null
  const series = orientationOf(plot, rect)
  const title = first(root, NS_C, 'title')
  const titleText = title ? [...tags(title, NS_A, 't')].map((t) => t.textContent ?? '').join('').trim() : ''
  const grouping = first(plot, NS_C, 'grouping')?.getAttribute('val')
  const trendKind = first(plot, NS_C, 'trendlineType')?.getAttribute('val')
  return {
    id: context.newId(),
    kind: 'chart',
    anchor,
    range: rect,
    type,
    headers,
    series,
    ...(titleText ? { title: titleText } : {}),
    ...(grouping === 'stacked' || grouping === 'percentStacked' ? { stacked: true } : {}),
    ...(trendKind === 'linear' ? { trend: 'linear' as const } : trendKind === 'movingAvg' ? { trend: 'sma3' as const } : {}),
  }
}

function union(a: Rect, b: Rect): Rect {
  return [
    Math.min(a[0], b[0]), Math.min(a[1], b[1]),
    Math.max(a[2], b[2]), Math.max(a[3], b[3]),
  ] as unknown as Rect
}

/**
 * Whether each series is a column of the block or a row of it, read off the
 * first series' own reference: a reference down one column is a column.
 */
function orientationOf(plot: Element, rect: Rect): 'columns' | 'rows' {
  const values = first(plot, NS_C, 'val') ?? first(plot, NS_C, 'yVal')
  const f = values ? first(values, NS_C, 'f') : null
  const parsed = f ? rectOfRef(f.textContent ?? '') : null
  if (!parsed) return 'columns'
  const [r1, c1, r2, c2] = parsed.rect
  if (r1 !== r2 && c1 === c2) return 'columns'
  if (c1 !== c2 && r1 === r2) return 'rows'
  return rect[2] - rect[0] >= rect[3] - rect[1] ? 'columns' : 'rows'
}
