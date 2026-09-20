/**
 * Excel 97-2003 workbooks: the .xls a finance team still mails around.
 *
 * The format is BIFF8 - a stream of records inside a compound file, where
 * every record is a two-byte type, a two-byte length and its payload. There
 * is no XML and no text: a string lives once in a shared table and cells
 * point at it by index, a number may be packed into thirty bits, and a
 * formula is RPN rather than the text that was typed.
 *
 * What travels: cell values and formulas, number formats, fonts, colours,
 * alignment, column widths, row heights, hidden rows and columns, merged
 * cells, frozen panes, sheet protection, hidden sheets and defined names.
 * What does not: charts, pictures, pivot tables, conditional formatting and
 * comments, which a modern file keeps in parts this format never had. Save
 * as .xlsx or .ods for those.
 */
import type { BorderSpec } from '@svgrid/grid'
import { colToLetters, lettersToCol, quoteSheet } from './address'
import { formatKeyAt, type CellFormatEntry } from './format-store'
import type { SheetState, SheetStateEntry } from './document'
import { isCompoundFile, readCompoundFile, writeCompoundFile } from './xls-cfb'
import { formulaFromRpn, isModernFunctionName, rpnFromFormula, xlsErrorCode, xlsErrorText, type XlsReadContext } from './xls-formula'
import {
  asText, BUILTIN_NUMFMT, isDateFormat, isoToSerial, ptToPx, pxToPt, serialToIso, widthToPx,
} from './xlsx-document'
import { isError, type CellValue } from './ast'
import type { SheetDocument } from './document'
import { TEXT_PREFIX } from './workbook'
import { filteredRows } from './filter-files'

// ---------------------------------------------------------------------------
// The records this module knows by name.

const BOF = 0x0809
const EOF_RECORD = 0x000a
const BOUNDSHEET = 0x0085
const SST = 0x00fc
const CONTINUE = 0x003c
const FORMAT = 0x041e
const XF = 0x00e0
const FONT = 0x0031
const PALETTE = 0x0092
const EXTERNSHEET = 0x0017
const SUPBOOK = 0x01ae
const NAME = 0x0018
const ROW = 0x0208
const COLINFO = 0x007d
const DIMENSIONS = 0x0200
const LABELSST = 0x00fd
const LABEL = 0x0204
const NUMBER = 0x0203
const RK = 0x027e
const MULRK = 0x00bd
const BLANK = 0x0201
const MULBLANK = 0x00be
const BOOLERR = 0x0205
const FORMULA = 0x0006
const STRING_RECORD = 0x0207
const SHRFMLA = 0x04bc
const ARRAY_RECORD = 0x0221
const MERGEDCELLS = 0x00e5
const WINDOW1 = 0x003d
const WINDOW2 = 0x023e
const PANE = 0x0041
const PROTECT = 0x0012
const CODEPAGE = 0x0042
const DATEMODE = 0x0022
const STYLE = 0x0293
const DEFCOLWIDTH = 0x0055
const DEFAULTROWHEIGHT = 0x0225
const COUNTRY = 0x008c
const SELECTION = 0x001d

/** BIFF8's own palette, for the colours a file names by index alone. */
const PALETTE_DEFAULT = [
  '000000', 'ffffff', 'ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff',
  '800000', '008000', '000080', '808000', '800080', '008080', 'c0c0c0', '808080',
  '9999ff', '993366', 'ffffcc', 'ccffff', '660066', 'ff8080', '0066cc', 'ccccff',
  '000080', 'ff00ff', 'ffff00', '00ffff', '800080', '800000', '008080', '0000ff',
  '00ccff', 'ccffff', 'ccffcc', 'ffff99', '99ccff', 'ff99cc', 'cc99ff', 'ffcc99',
  '3366ff', '33cccc', '99cc00', 'ffcc00', 'ff9900', 'ff6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
]

/** The first palette entry a colour index names; 0-7 repeat the first eight. */
const PALETTE_BASE = 8

type Record8 = { type: number; data: Uint8Array }

/** Every record in a stream, in order. */
function records(stream: Uint8Array): Record8[] {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)
  const out: Record8[] = []
  let at = 0
  while (at + 4 <= stream.length) {
    const type = view.getUint16(at, true)
    const size = view.getUint16(at + 2, true)
    if (at + 4 + size > stream.length) break
    out.push({ type, data: stream.subarray(at + 4, at + 4 + size) })
    at += 4 + size
  }
  return out
}

const u8 = (r: Uint8Array, at: number): number => r[at] ?? 0
const u16 = (r: Uint8Array, at: number): number => (r[at] ?? 0) | ((r[at + 1] ?? 0) << 8)
const u32 = (r: Uint8Array, at: number): number => (u16(r, at) | (u16(r, at + 2) << 16)) >>> 0
const f64 = (r: Uint8Array, at: number): number =>
  new DataView(r.buffer, r.byteOffset, r.byteLength).getFloat64(at, true)

/**
 * An RK number: a double with its low thirty-four bits thrown away, or a
 * thirty-bit integer, either of them possibly divided by a hundred. Excel
 * uses it because most numbers in a sheet fit, and four bytes beat eight.
 */
function rkValue(rk: number): number {
  const hundredths = (rk & 0x01) !== 0
  const whole = (rk & 0x02) !== 0
  let value: number
  if (whole) {
    value = rk >> 2
  } else {
    const buffer = new DataView(new ArrayBuffer(8))
    buffer.setUint32(4, (rk & 0xfffffffc) >>> 0, true)
    value = buffer.getFloat64(0, true)
  }
  return hundredths ? value / 100 : value
}

/** The four bytes an RK holds, or null for a number that does not fit one. */
function rkBytes(value: number): number | null {
  for (const hundredths of [false, true]) {
    const scaled = hundredths ? value * 100 : value
    if (Number.isInteger(scaled) && scaled >= -(2 ** 29) && scaled < 2 ** 29) {
      return ((scaled << 2) | (hundredths ? 0x01 : 0) | 0x02) >>> 0
    }
    const buffer = new DataView(new ArrayBuffer(8))
    buffer.setFloat64(0, scaled, true)
    if (buffer.getUint32(0, true) === 0 && (buffer.getUint32(4, true) & 0x03) === 0) {
      return (buffer.getUint32(4, true) | (hundredths ? 0x01 : 0)) >>> 0
    }
  }
  return null
}

/** A string with its own length in front: `cch`, a flag byte, the characters. */
function unicodeString(data: Uint8Array, at: number, lengthBytes: 1 | 2 = 2): { text: string; next: number } {
  const count = lengthBytes === 1 ? u8(data, at) : u16(data, at)
  let cursor = at + lengthBytes
  const flags = u8(data, cursor)
  cursor += 1
  const wide = (flags & 0x01) !== 0
  const rich = (flags & 0x08) !== 0
  const far = (flags & 0x04) !== 0
  const runs = rich ? u16(data, cursor) : 0
  if (rich) cursor += 2
  const extra = far ? u32(data, cursor) : 0
  if (far) cursor += 4
  let text = ''
  for (let i = 0; i < count; i += 1) {
    if (wide) { text += String.fromCharCode(u16(data, cursor)); cursor += 2 }
    else { text += String.fromCharCode(u8(data, cursor)); cursor += 1 }
  }
  return { text, next: cursor + runs * 4 + extra }
}

/**
 * The shared string table, which is the one record that does not fit in a
 * record: it runs on through CONTINUEs, and a string may be cut in half by
 * one, with a flag byte at the join saying how the rest is encoded.
 */
function sharedStrings(blocks: Uint8Array[]): string[] {
  const out: string[] = []
  if (!blocks.length) return out
  let block = 0
  let at = 8 // cstTotal and cstUnique
  const nextBlock = (): boolean => {
    block += 1
    at = 0
    return block < blocks.length
  }
  const byteAt = (): number => {
    while (block < blocks.length && at >= blocks[block]!.length) if (!nextBlock()) return 0
    const value = u8(blocks[block]!, at)
    at += 1
    return value
  }
  const wordAt = (): number => byteAt() | (byteAt() << 8)
  const total = blocks[0]!.length >= 8 ? u32(blocks[0]!, 4) : 0
  for (let i = 0; i < total; i += 1) {
    while (block < blocks.length && at >= blocks[block]!.length) if (!nextBlock()) return out
    if (block >= blocks.length) return out
    const count = wordAt()
    let flags = byteAt()
    let wide = (flags & 0x01) !== 0
    const rich = (flags & 0x08) !== 0
    const far = (flags & 0x04) !== 0
    const runs = rich ? wordAt() : 0
    const extra = far ? (wordAt() | (wordAt() << 16)) : 0
    let text = ''
    for (let c = 0; c < count; c += 1) {
      // A CONTINUE in the middle of a string starts with a flag byte of its
      // own: the rest can be encoded the other way round.
      if (at >= blocks[block]!.length) {
        if (!nextBlock()) return out
        flags = byteAt()
        wide = (flags & 0x01) !== 0
      }
      text += wide ? String.fromCharCode(wordAt()) : String.fromCharCode(byteAt())
    }
    for (let skip = 0; skip < runs * 4 + extra; skip += 1) byteAt()
    out.push(text)
  }
  return out
}

// ---------------------------------------------------------------------------
// Reading.

type Style = { format: CellFormatEntry; numFmt: string | undefined }

/** A workbook's fonts, formats and cell styles, as this document spells them. */
function readStyles(globals: Record8[]): { xfs: Style[] } {
  const palette = [...PALETTE_DEFAULT]
  for (const record of globals) {
    if (record.type !== PALETTE) continue
    const count = u16(record.data, 0)
    for (let i = 0; i < count && i < palette.length; i += 1) {
      const at = 2 + i * 4
      palette[i] = [u8(record.data, at), u8(record.data, at + 1), u8(record.data, at + 2)]
        .map((v) => v.toString(16).padStart(2, '0')).join('')
    }
  }
  const colour = (index: number): string | undefined => {
    if (index === 0x7fff || index === 64 || index === 65) return undefined
    const rgb = palette[Math.max(0, index - PALETTE_BASE)]
    return rgb ? `#${rgb}` : undefined
  }

  type Font = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string; fontFamily?: string; fontSize?: number }
  const fonts: Font[] = []
  const formats = new Map<number, string>()
  const xfs: Style[] = []
  for (const record of globals) {
    if (record.type === FONT) {
      const grbit = u16(record.data, 2)
      const font: Font = {}
      const height = u16(record.data, 0)
      if (height) font.fontSize = ptToPx(height / 20)
      if (u16(record.data, 6) >= 700) font.bold = true
      if (grbit & 0x02) font.italic = true
      if (grbit & 0x08) font.strike = true
      if (u8(record.data, 10) !== 0) font.underline = true
      const shade = colour(u16(record.data, 4))
      if (shade) font.color = shade
      const name = unicodeString(record.data, 14, 1).text
      if (name) font.fontFamily = name
      fonts.push(font)
    } else if (record.type === FORMAT) {
      formats.set(u16(record.data, 0), unicodeString(record.data, 2).text)
    } else if (record.type === XF) {
      const fontIndex = u16(record.data, 0)
      // There is no fifth font: Excel leaves index 4 out of the file.
      const font = fonts[fontIndex >= 5 ? fontIndex - 1 : fontIndex] ?? {}
      const numFmt = formats.get(u16(record.data, 2)) ?? BUILTIN_NUMFMT[u16(record.data, 2)]
      const format: CellFormatEntry = { ...font }
      if (numFmt && !/^General$/i.test(numFmt)) format.numFmt = numFmt
      if ((u16(record.data, 4) & 0x01) === 0) format.locked = false
      const align = u8(record.data, 6) & 0x07
      if (align === 1) format.align = 'left'
      else if (align === 2 || align === 6) format.align = 'center'
      else if (align === 3) format.align = 'right'
      if (u8(record.data, 6) & 0x08) format.wrap = true
      const indent = u8(record.data, 8) & 0x0f
      if (indent) format.indent = indent
      const fill = u32(record.data, 14)
      const pattern = (fill >>> 26) & 0x3f
      const fore = u16(record.data, 18) & 0x7f
      const back = (u16(record.data, 18) >> 7) & 0x7f
      // A solid fill paints in the pattern's foreground colour; anything
      // else is a hatch this document has no word for, so its background
      // stands in for it.
      const paint = pattern === 1 ? colour(fore) : pattern > 1 ? colour(back) : undefined
      if (paint) format.fill = paint
      const borders = u32(record.data, 10)
      const sides: CellFormatEntry['border'] = {}
      // BIFF numbers its line styles: 1 thin, 2 medium, 5 thick, 6 double,
      // 4 and 7 dotted, and the rest dashes of one length or another.
      const edge = (line: number, colourIndex: number): BorderSpec | undefined => {
        if (!line) return undefined
        const spec: BorderSpec = { width: line === 5 ? 3 : line === 2 || line === 8 || line === 10 || line === 12 ? 2 : 1 }
        if (line === 6) spec.style = 'double'
        else if (line === 4 || line === 7) spec.style = 'dotted'
        else if (line >= 3 && line !== 5) spec.style = 'dashed'
        const shade = colour(colourIndex)
        if (shade) spec.color = shade
        return spec
      }
      const left = edge(borders & 0x0f, (borders >>> 16) & 0x7f)
      const right = edge((borders >>> 4) & 0x0f, (borders >>> 23) & 0x7f)
      const top = edge((borders >>> 8) & 0x0f, u16(record.data, 14) & 0x7f)
      const bottom = edge((borders >>> 12) & 0x0f, (u16(record.data, 14) >> 7) & 0x7f)
      if (left) sides.left = left
      if (right) sides.right = right
      if (top) sides.top = top
      if (bottom) sides.bottom = bottom
      if (Object.keys(sides).length) format.border = sides
      xfs.push({ format, numFmt })
    }
  }
  return { xfs }
}

/** The document an .xls holds, as a saved state. */
export function sheetStateFromXls(bytes: Uint8Array): SheetState {
  const streams = readCompoundFile(bytes)
  const stream = streams.get('Workbook') ?? streams.get('Book')
  if (!stream) throw new Error('@svgrid/enterprise: not an .xls file: it holds no workbook stream')
  const all = records(stream)

  // The globals run to the first EOF; each sheet is its own run of records
  // after them, found through the offsets the BOUNDSHEETs carry.
  const globalEnd = all.findIndex((r) => r.type === EOF_RECORD)
  const globals = all.slice(0, globalEnd < 0 ? all.length : globalEnd)
  const styles = readStyles(globals)

  const sheetNames: string[] = []
  const sheetHidden: boolean[] = []
  for (const record of globals) {
    if (record.type !== BOUNDSHEET) continue
    sheetNames.push(unicodeString(record.data, 6, 1).text)
    sheetHidden.push((u8(record.data, 4) & 0x03) !== 0)
  }

  const sstBlocks: Uint8Array[] = []
  for (let i = 0; i < globals.length; i += 1) {
    if (globals[i]!.type !== SST) continue
    sstBlocks.push(globals[i]!.data)
    for (let j = i + 1; j < globals.length && globals[j]!.type === CONTINUE; j += 1) sstBlocks.push(globals[j]!.data)
    break
  }
  const shared = sharedStrings(sstBlocks)

  // Which sheet a 3d reference names: an index into EXTERNSHEET, which
  // points at a SUPBOOK, which is this workbook or another one.
  const internal: boolean[] = []
  for (const record of globals) {
    if (record.type !== SUPBOOK) continue
    internal.push(record.data.length === 4 && u16(record.data, 2) === 0x0401)
  }
  const xti: Array<{ book: number; first: number; last: number }> = []
  for (const record of globals) {
    if (record.type !== EXTERNSHEET) continue
    const count = u16(record.data, 0)
    for (let i = 0; i < count; i += 1) {
      const at = 2 + i * 6
      xti.push({ book: u16(record.data, at), first: u16(record.data, at + 2), last: u16(record.data, at + 4) })
    }
  }
  const sheetAt = (index: number): string | null => {
    const entry = xti[index]
    if (!entry || internal[entry.book] === false) return null
    const first = sheetNames[entry.first]
    if (first === undefined) return null
    const last = sheetNames[entry.last]
    return entry.first === entry.last || last === undefined
      ? quoteSheet(first)
      : `${quoteSheet(first)}:${quoteSheet(last)}`
  }

  // Defined names, which formulas reach by index. The name itself sits at a
  // fixed offset inside the record, after four lengths of text nobody uses
  // any more (a custom menu, a description, a help topic, a status bar).
  const nameTexts: string[] = []
  const nameRpn: Uint8Array[] = []
  const names: Record<string, string> = {}
  for (const record of globals) {
    if (record.type !== NAME) continue
    const builtin = (u16(record.data, 0) & 0x20) !== 0
    const count = u8(record.data, 3)
    const wide = (u8(record.data, 14) & 0x01) !== 0
    let text = ''
    for (let i = 0; i < count; i += 1) {
      text += wide ? String.fromCharCode(u16(record.data, 15 + i * 2)) : String.fromCharCode(u8(record.data, 15 + i))
    }
    const start = 15 + count * (wide ? 2 : 1)
    nameTexts.push(builtin ? '' : text)
    nameRpn.push(record.data.subarray(start, start + u16(record.data, 4)))
  }
  const nameAt = (index: number): string | null => nameTexts[index - 1] || null
  nameTexts.forEach((text, index) => {
    // A name that only stands in for a function Excel 97 never had is not a
    // name the workbook wants: the formulas calling it say so themselves.
    if (!text || isModernFunctionName(text)) return
    const formula = formulaFromRpn(nameRpn[index]!, { sheetAt, nameAt, row: 0, col: 0 })
    if (formula) names[text] = `=${formula}`
  })

  const sheets: SheetState['workbook']['sheets'] = []
  const entries: Record<string, SheetStateEntry> = {}

  // Every sheet's records: the runs of records between the BOFs that follow
  // the globals, in the order the BOUNDSHEETs named them.
  const starts: number[] = []
  for (let i = (globalEnd < 0 ? all.length : globalEnd + 1); i < all.length; i += 1) {
    if (all[i]!.type === BOF) starts.push(i)
  }

  sheetNames.forEach((name, index) => {
    const from = starts[index]
    const to = starts[index + 1] ?? all.length
    const body = from === undefined ? [] : all.slice(from, to)
    const cells: string[][] = []
    const entry: SheetStateEntry = {
      formats: {}, columnWidths: {}, rowHeights: [], hidden: { rows: [], cols: [] },
      freeze: { rows: 0, cols: 0 }, comments: {}, protected: false, sheetHidden: sheetHidden[index] ?? false,
      merges: [], validation: [], conditionalFormats: [], autoFilter: null,
    }
    const put = (row: number, col: number, text: string) => {
      if (text === '') return
      while (cells.length <= row) cells.push([])
      const line = cells[row]!
      while (line.length <= col) line.push('')
      line[col] = text
    }
    const style = (ixfe: number): Style | undefined => styles.xfs[ixfe]
    const look = (row: number, col: number, ixfe: number) => {
      const found = style(ixfe)
      if (!found || !Object.keys(found.format).length) return
      entry.formats[formatKeyAt(row, col)] = { ...found.format }
    }
    /** A number as the workbook stores it: an ISO date when the cell is one. */
    const numberText = (value: number, ixfe: number): string =>
      isDateFormat(style(ixfe)?.numFmt) && Number.isInteger(value) && value > 0 ? serialToIso(value) : String(value)

    // A shared or array formula is stored once, at its anchor, and every
    // other cell points back at it.
    const anchored = new Map<string, { rpn: Uint8Array; array: boolean }>()
    for (const record of body) {
      if (record.type === SHRFMLA) {
        const cce = u16(record.data, 8)
        anchored.set(`${u16(record.data, 0)},${u8(record.data, 4)}`, { rpn: record.data.subarray(10, 10 + cce), array: false })
      } else if (record.type === ARRAY_RECORD) {
        const cce = u16(record.data, 12)
        anchored.set(`${u16(record.data, 0)},${u8(record.data, 4)}`, { rpn: record.data.subarray(14, 14 + cce), array: true })
      }
    }
    /** The cells an array formula spills into, which hold no text of their own. */
    const spills: Array<[number, number, number, number]> = []
    for (const record of body) {
      if (record.type !== ARRAY_RECORD) continue
      spills.push([u16(record.data, 0), u8(record.data, 4), u16(record.data, 2), u8(record.data, 5)])
    }
    const spilled = (row: number, col: number): boolean =>
      spills.some(([r1, c1, r2, c2]) => row >= r1 && row <= r2 && col >= c1 && col <= c2 && !(row === r1 && col === c1))

    let pending: { row: number; col: number } | null = null
    for (const record of body) {
      const data = record.data
      switch (record.type) {
        case ROW: {
          const row = u16(data, 0)
          const twips = u16(data, 6) & 0x7fff
          const grbit = u32(data, 12)
          if (grbit & 0x20) entry.hidden.rows.push(row)
          if (grbit & 0x40) entry.rowHeights.push([row, ptToPx(twips / 20)])
          break
        }
        case COLINFO: {
          const first = u16(data, 0)
          const last = Math.min(u16(data, 2), 255)
          const width = widthToPx(u16(data, 4) / 256)
          const hidden = (u16(data, 8) & 0x01) !== 0
          // A run over the whole sheet is the default width said once, not a
          // decision about every column.
          const wide = last - first > 64
          for (let col = first; col <= last; col += 1) {
            if (!wide) entry.columnWidths[colToLetters(col)] = width
            if (hidden) entry.hidden.cols.push(col)
          }
          break
        }
        case LABELSST: {
          const row = u16(data, 0)
          const col = u16(data, 2)
          look(row, col, u16(data, 4))
          put(row, col, asText(shared[u32(data, 6)] ?? ''))
          break
        }
        case LABEL: {
          const row = u16(data, 0)
          const col = u16(data, 2)
          look(row, col, u16(data, 4))
          put(row, col, asText(unicodeString(data, 6).text))
          break
        }
        case NUMBER: {
          const row = u16(data, 0)
          const col = u16(data, 2)
          const ixfe = u16(data, 4)
          look(row, col, ixfe)
          put(row, col, numberText(f64(data, 6), ixfe))
          break
        }
        case RK: {
          const row = u16(data, 0)
          const col = u16(data, 2)
          const ixfe = u16(data, 4)
          look(row, col, ixfe)
          put(row, col, numberText(rkValue(u32(data, 6) | 0), ixfe))
          break
        }
        case MULRK: {
          const row = u16(data, 0)
          const first = u16(data, 2)
          const count = Math.floor((data.length - 6) / 6)
          for (let i = 0; i < count; i += 1) {
            const ixfe = u16(data, 4 + i * 6)
            const col = first + i
            look(row, col, ixfe)
            put(row, col, numberText(rkValue(u32(data, 6 + i * 6) | 0), ixfe))
          }
          break
        }
        case BLANK:
          look(u16(data, 0), u16(data, 2), u16(data, 4))
          break
        case MULBLANK: {
          const row = u16(data, 0)
          const first = u16(data, 2)
          const count = Math.floor((data.length - 6) / 2)
          for (let i = 0; i < count; i += 1) look(row, first + i, u16(data, 4 + i * 2))
          break
        }
        case BOOLERR: {
          const row = u16(data, 0)
          const col = u16(data, 2)
          look(row, col, u16(data, 4))
          put(row, col, u8(data, 7) ? xlsErrorText(u8(data, 6)) : u8(data, 6) ? 'TRUE' : 'FALSE')
          break
        }
        case FORMULA: {
          const row = u16(data, 0)
          const col = u16(data, 2)
          const ixfe = u16(data, 4)
          look(row, col, ixfe)
          if (spilled(row, col)) { pending = null; break }
          const cce = u16(data, 20)
          let rpn = data.subarray(22, 22 + cce)
          // A cell that points at a shared or array formula: the tokens are
          // the anchor's, read as if they were written here.
          if (rpn.length >= 5 && rpn[0] === 0x01) {
            const found = anchored.get(`${u16(rpn, 1)},${u16(rpn, 3)}`)
            rpn = found ? found.rpn : new Uint8Array(0)
          }
          const ctx: XlsReadContext = { sheetAt, nameAt, row, col }
          const text = rpn.length ? formulaFromRpn(rpn, ctx) : null
          if (text) { put(row, col, `=${text}`); pending = null; break }
          // A formula this reader cannot spell keeps the value the file
          // cached for it, which is what the sheet showed.
          if (u16(data, 12) === 0xffff) {
            const kind = u8(data, 6)
            if (kind === 0) { pending = { row, col }; break }
            if (kind === 1) put(row, col, u8(data, 8) ? 'TRUE' : 'FALSE')
            else if (kind === 2) put(row, col, xlsErrorText(u8(data, 8)))
            pending = null
            break
          }
          put(row, col, numberText(f64(data, 6), ixfe))
          pending = null
          break
        }
        case STRING_RECORD:
          if (pending) put(pending.row, pending.col, asText(unicodeString(data, 0).text))
          pending = null
          break
        case MERGEDCELLS: {
          const count = u16(data, 0)
          for (let i = 0; i < count; i += 1) {
            const at = 2 + i * 8
            entry.merges.push([u16(data, at), u16(data, at + 4), u16(data, at + 2), u16(data, at + 6)])
          }
          break
        }
        case WINDOW2:
          if ((u16(data, 0) & 0x08) === 0) entry.freeze = { rows: 0, cols: 0 }
          break
        case PANE:
          entry.freeze = { rows: u16(data, 2), cols: u16(data, 0) }
          break
        case PROTECT:
          if (u16(data, 0)) entry.protected = true
          break
        default:
          break
      }
    }
    // A pane is written whether or not it is frozen; only WINDOW2 says which.
    const window2 = body.find((r) => r.type === WINDOW2)
    if (window2 && (u16(window2.data, 0) & 0x08) === 0) entry.freeze = { rows: 0, cols: 0 }

    sheets.push({ name, cells })
    entries[name] = entry
  })

  if (!sheets.length) {
    sheets.push({ name: 'Sheet1', cells: [] })
    entries.Sheet1 = {
      formats: {}, columnWidths: {}, rowHeights: [], hidden: { rows: [], cols: [] },
      freeze: { rows: 0, cols: 0 }, comments: {}, protected: false,
      merges: [], validation: [], conditionalFormats: [], autoFilter: null,
    }
  }
  return { version: 1, workbook: { sheets, active: sheets[0]!.name, names }, sheets: entries }
}

/** Whether these bytes are an .xls at all, which is how the opener tells one. */
export const isXlsFile = (bytes: Uint8Array): boolean => isCompoundFile(bytes)

/** The document an .xls file holds, as a saved state. */
export async function documentFromXls(file: Blob | ArrayBuffer | Uint8Array): Promise<SheetState> {
  const bytes = file instanceof Uint8Array
    ? file
    : new Uint8Array(file instanceof ArrayBuffer ? file : await file.arrayBuffer())
  return sheetStateFromXls(bytes)
}

// ---------------------------------------------------------------------------
// Writing.

/** The most a record's payload can hold; past this it runs on in a CONTINUE. */
const MAX_PAYLOAD = 8224

class Stream {
  readonly bytes: number[] = []
  byte(v: number): void { this.bytes.push(v & 0xff) }
  word(v: number): void { this.bytes.push(v & 0xff, (v >> 8) & 0xff) }
  long(v: number): void { this.word(v & 0xffff); this.word((v >>> 16) & 0xffff) }
  double(v: number): void {
    const view = new DataView(new ArrayBuffer(8))
    view.setFloat64(0, v, true)
    for (let i = 0; i < 8; i += 1) this.bytes.push(view.getUint8(i))
  }
  put(values: ArrayLike<number>): void { for (let i = 0; i < values.length; i += 1) this.bytes.push(values[i]! & 0xff) }
  /** A record: its type, its length, its payload, and a CONTINUE for the rest. */
  record(type: number, payload: ArrayLike<number>): void {
    let at = 0
    do {
      const take = Math.min(MAX_PAYLOAD, payload.length - at)
      this.word(at === 0 ? type : CONTINUE)
      this.word(take)
      for (let i = 0; i < take; i += 1) this.bytes.push(payload[at + i]! & 0xff)
      at += take
    } while (at < payload.length)
  }
  get length(): number { return this.bytes.length }
}

/** A short string as a record holds one: a length byte, a flag, the characters. */
function shortStringBytes(text: string): number[] {
  const wide = [...text].some((c) => c.charCodeAt(0) > 0xff)
  const out: number[] = [Math.min(text.length, 255), wide ? 1 : 0]
  for (const ch of text.slice(0, 255)) {
    const code = ch.charCodeAt(0)
    if (wide) out.push(code & 0xff, (code >> 8) & 0xff)
    else out.push(code & 0xff)
  }
  return out
}

/** The same, with a two-byte length: what a STRING record holds. */
function longStringBytes(text: string): number[] {
  const clipped = text.slice(0, 32767)
  const wide = [...clipped].some((c) => c.charCodeAt(0) > 0xff)
  const out: number[] = [clipped.length & 0xff, (clipped.length >> 8) & 0xff, wide ? 1 : 0]
  for (const ch of clipped) {
    const code = ch.charCodeAt(0)
    if (wide) out.push(code & 0xff, (code >> 8) & 0xff)
    else out.push(code & 0xff)
  }
  return out
}

/**
 * The shared string table, written the way it is read: one run of bytes per
 * record, and a string that does not fit what is left of one carries on in
 * the next with its flag byte repeated.
 */
function sstRecords(strings: string[], out: Stream): void {
  if (!strings.length) return
  const blocks: number[][] = []
  let block: number[] = []
  const room = (): number => MAX_PAYLOAD - block.length
  const flush = () => { blocks.push(block); block = [] }
  block.push(strings.length & 0xff, (strings.length >> 8) & 0xff, 0, 0)
  block.push(strings.length & 0xff, (strings.length >> 8) & 0xff, 0, 0)
  for (const text of strings) {
    const clipped = text.slice(0, 32767)
    const wide = [...clipped].some((c) => c.charCodeAt(0) > 0xff)
    const width = wide ? 2 : 1
    // The length and the flag byte are never split.
    if (room() < 4) flush()
    block.push(clipped.length & 0xff, (clipped.length >> 8) & 0xff, wide ? 1 : 0)
    for (const ch of clipped) {
      if (room() < width) {
        flush()
        block.push(wide ? 1 : 0)
      }
      const code = ch.charCodeAt(0)
      if (wide) block.push(code & 0xff, (code >> 8) & 0xff)
      else block.push(code & 0xff)
    }
  }
  flush()
  blocks.forEach((data, index) => { out.record(index === 0 ? SST : CONTINUE, data) })
}

/** The colours a workbook uses, as the indexed palette BIFF8 wants. */
function palette() {
  const colours = [...PALETTE_DEFAULT]
  /** Where a new colour may go: the first eight are the standard ones, which
   *  a file is expected to keep. */
  let next = 8
  const index = (colour: string | undefined): number | null => {
    if (!colour) return null
    const m = /^#?([0-9a-f]{6})$/i.exec(colour.trim())
    const rgb = m
      ? m[1]!.toLowerCase()
      : /^#([0-9a-f]{3})$/i.test(colour.trim())
        ? colour.trim().slice(1).split('').map((c) => c + c).join('').toLowerCase()
        : null
    if (!rgb) return null
    const found = colours.indexOf(rgb)
    if (found >= 0) return found + PALETTE_BASE
    if (next >= colours.length) return null
    colours[next] = rgb
    next += 1
    return next - 1 + PALETTE_BASE
  }
  const record = (): number[] => {
    const out: number[] = [colours.length & 0xff, (colours.length >> 8) & 0xff]
    for (const rgb of colours) {
      out.push(parseInt(rgb.slice(0, 2), 16), parseInt(rgb.slice(2, 4), 16), parseInt(rgb.slice(4, 6), 16), 0)
    }
    return out
  }
  return { index, record }
}

/** Excel's line style for a border, by how thick and how dashed it is. */
function lineStyle(spec: NonNullable<NonNullable<CellFormatEntry['border']>['top']>): number {
  const width = spec.width ?? 2
  if (spec.style === 'double') return 6
  if (spec.style === 'dotted') return 4
  if (spec.style === 'dashed') return width >= 2 ? 8 : 3
  return width >= 3 ? 5 : width >= 2 ? 2 : 1
}

/** The fonts, number formats and cell styles of a workbook, deduplicated. */
function styleTable() {
  const colours = palette()
  type Font = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string; fontFamily?: string; fontSize?: number }
  const fonts: Font[] = [{}]
  const fontKeys = new Map<string, number>([[JSON.stringify({}), 0]])
  const formats = new Map<string, number>()
  const xfKeys = new Map<string, number>()
  const xfs: CellFormatEntry[] = []

  const fontOf = (entry: CellFormatEntry): number => {
    const font: Font = {}
    for (const key of ['bold', 'italic', 'underline', 'strike', 'color', 'fontFamily', 'fontSize'] as const) {
      const value = entry[key]
      if (value !== undefined) Object.assign(font, { [key]: value })
    }
    const key = JSON.stringify(font)
    let index = fontKeys.get(key)
    if (index === undefined) { index = fonts.length; fonts.push(font); fontKeys.set(key, index) }
    return index
  }
  const formatOf = (code: string | undefined): number => {
    if (!code || /^General$/i.test(code)) return 0
    const builtin = Object.entries(BUILTIN_NUMFMT).find(([, c]) => c === code)
    if (builtin) return Number(builtin[0])
    let id = formats.get(code)
    if (id === undefined) { id = 164 + formats.size; formats.set(code, id) }
    return id
  }
  /** The XF index for a look, counting the fifteen style records in front. */
  const xfOf = (entry: CellFormatEntry | undefined): number => {
    if (!entry || !Object.keys(entry).length) return 15
    const key = JSON.stringify(entry)
    let index = xfKeys.get(key)
    if (index === undefined) {
      index = xfs.length
      xfs.push(entry)
      xfKeys.set(key, index)
      fontOf(entry)
      formatOf(entry.numFmt)
      colours.index(entry.color)
      colours.index(entry.fill)
      for (const side of ['top', 'right', 'bottom', 'left'] as const) colours.index(entry.border?.[side]?.color)
    }
    return index + 16
  }

  const write = (out: Stream): void => {
    // A font record for each look, with the gap at index four Excel leaves.
    fonts.forEach((font, index) => {
      if (index === 4) writeFont(out, font, colours)
      writeFont(out, font, colours)
    })
    for (const [code, id] of formats) out.record(FORMAT, [id & 0xff, (id >> 8) & 0xff, ...longStringBytes(code)])
    // Fifteen style records, then the plain cell style, then the looks.
    for (let i = 0; i < 15; i += 1) out.record(XF, xfBytes({}, 0, 0, true, colours))
    out.record(XF, xfBytes({}, 0, 0, false, colours))
    for (const entry of xfs) {
      const fontIndex = fontOf(entry)
      out.record(XF, xfBytes(entry, fontIndex >= 4 ? fontIndex + 1 : fontIndex, formatOf(entry.numFmt), false, colours))
    }
    out.record(STYLE, [0x00, 0x80, 0x00, 0xff])
    out.record(PALETTE, colours.record())
  }
  return { xfOf, write }
}

function writeFont(out: Stream, font: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string; fontFamily?: string; fontSize?: number }, colours: ReturnType<typeof palette>): void {
  const body: number[] = []
  const twips = Math.round((font.fontSize ? pxToPt(font.fontSize) : 11) * 20)
  body.push(twips & 0xff, (twips >> 8) & 0xff)
  const grbit = (font.italic ? 0x02 : 0) | (font.strike ? 0x08 : 0)
  body.push(grbit, 0)
  const colour = colours.index(font.color) ?? 0x7fff
  body.push(colour & 0xff, (colour >> 8) & 0xff)
  const weight = font.bold ? 700 : 400
  body.push(weight & 0xff, (weight >> 8) & 0xff)
  body.push(0, 0) // not super- or subscript
  body.push(font.underline ? 1 : 0, 0, 0, 0)
  body.push(...shortStringBytes(font.fontFamily ?? 'Calibri'))
  out.record(FONT, body)
}

/** One XF record: the font, the format, and everything about the cell's look. */
function xfBytes(entry: CellFormatEntry, fontIndex: number, formatId: number, style: boolean, colours: ReturnType<typeof palette>): number[] {
  const out: number[] = []
  out.push(fontIndex & 0xff, (fontIndex >> 8) & 0xff)
  out.push(formatId & 0xff, (formatId >> 8) & 0xff)
  // Locked unless the cell says otherwise; a style record is its own parent.
  const grbit = (entry.locked === false ? 0 : 0x01) | (style ? 0x04 | 0xfff0 : 0)
  out.push(grbit & 0xff, (grbit >> 8) & 0xff)
  const align = entry.align === 'left' ? 1 : entry.align === 'center' ? 2 : entry.align === 'right' ? 3 : 0
  out.push(align | (entry.wrap ? 0x08 : 0) | 0x20, 0)
  out.push((entry.indent ?? 0) & 0x0f, 0)
  const line = (spec: NonNullable<NonNullable<CellFormatEntry['border']>['top']> | undefined): number => spec ? lineStyle(spec) : 0
  const shade = (spec: NonNullable<NonNullable<CellFormatEntry['border']>['top']> | undefined): number => (spec && colours.index(spec.color)) || 0x40
  const left = entry.border?.left
  const right = entry.border?.right
  const top = entry.border?.top
  const bottom = entry.border?.bottom
  const borders = (line(left) | (line(right) << 4) | (line(top) << 8) | (line(bottom) << 12)
    | (shade(left) << 16) | (shade(right) << 23)) >>> 0
  out.push(borders & 0xff, (borders >>> 8) & 0xff, (borders >>> 16) & 0xff, (borders >>> 24) & 0xff)
  const fill = colours.index(entry.fill)
  const second = ((shade(top) | (shade(bottom) << 7)) | ((fill === null ? 0 : 1) << 26)) >>> 0
  out.push(second & 0xff, (second >>> 8) & 0xff, (second >>> 16) & 0xff, (second >>> 24) & 0xff)
  const pattern = ((fill ?? 0x40) & 0x7f) | ((0x41 & 0x7f) << 7)
  out.push(pattern & 0xff, (pattern >> 8) & 0xff)
  return out
}

/** The last row and column Excel 97-2003 has; anything past them is dropped. */
const XLS_ROWS = 65536
const XLS_COLS = 256

type PlannedCell =
  | { kind: 'blank'; row: number; col: number; ixfe: number }
  | { kind: 'number'; row: number; col: number; ixfe: number; value: number }
  | { kind: 'string'; row: number; col: number; ixfe: number; sst: number }
  | { kind: 'bool'; row: number; col: number; ixfe: number; value: boolean }
  | { kind: 'error'; row: number; col: number; ixfe: number; code: number }
  | { kind: 'formula'; row: number; col: number; ixfe: number; rpn: Uint8Array; value: CellValue }

/** The bytes of an .xls holding this document. */
export function documentToXls(doc: SheetDocument): Uint8Array {
  const wb = doc.workbook
  const styles = styleTable()
  const strings: string[] = []
  const stringIds = new Map<string, number>()
  const sstOf = (text: string): number => {
    let id = stringIds.get(text)
    if (id === undefined) { id = strings.length; strings.push(text); stringIds.set(text, id) }
    return id
  }

  const sheetNames = wb.sheets.slice(0, 255)
  const sheetRef = (name: string): number => {
    const found = sheetNames.findIndex((s) => s.toLowerCase() === name.toLowerCase())
    return found < 0 ? 0 : found
  }
  const defined = wb.names.list()
  const nameRef = (name: string): number | null => {
    const found = defined.findIndex((d) => d.name.toLowerCase() === name.toLowerCase())
    return found < 0 ? null : found + 1
  }
  const formulaCtx = { sheetRef, nameRef }

  // Every sheet's cells, worked out before anything is written: the strings
  // and the looks they use have to be in the globals, which come first.
  const planned = sheetNames.map((name) => {
    const state = doc.get(name)
    const formats = state.formats.serialize()
    const looks = new Map<string, CellFormatEntry>()
    for (const [key, entry] of Object.entries(formats)) {
      const at = splitKey(key)
      if (at) looks.set(`${at.row},${at.col}`, entry)
    }
    let maxRow = Math.min(wb.rowCount(name), XLS_ROWS) - 1
    let maxCol = Math.min(wb.colCount(name), XLS_COLS) - 1
    for (const key of looks.keys()) {
      const [r, c] = key.split(',').map(Number)
      if (r! < XLS_ROWS) maxRow = Math.max(maxRow, r!)
      if (c! < XLS_COLS) maxCol = Math.max(maxCol, c!)
    }
    for (const r of state.heights.keys()) if (r < XLS_ROWS) maxRow = Math.max(maxRow, r)
    for (const r of state.hidden.rows) if (r < XLS_ROWS) maxRow = Math.max(maxRow, r)

    const cells: PlannedCell[] = []
    for (let row = 0; row <= maxRow; row += 1) {
      for (let col = 0; col <= maxCol; col += 1) {
        const raw = wb.getRaw(name, row, col)
        const look = looks.get(`${row},${col}`)
        if (raw === '' && !look) continue
        const text = raw.trim()
        const value = text === '' ? '' : wb.getValue(name, row, col)
        // A date is stored here as its ISO text, and Excel has no such cell:
        // it goes out as the number of days Excel counts, and the cell is
        // given a date format when it carries none, so it still reads as a
        // date rather than as forty-six thousand.
        const serial = text.startsWith('=') || raw.startsWith(TEXT_PREFIX) ? null : isoToSerial(text)
        const withDate = serial !== null && !isDateFormat(look?.numFmt)
          ? { ...(look ?? {}), numFmt: BUILTIN_NUMFMT[14]! }
          : look
        const ixfe = styles.xfOf(withDate)
        if (text === '') { cells.push({ kind: 'blank', row, col, ixfe }); continue }
        if (text.startsWith('=')) {
          const rpn = rpnFromFormula(text, formulaCtx)
          if (rpn) { cells.push({ kind: 'formula', row, col, ixfe, rpn, value }); continue }
          // A formula BIFF8 has no words for keeps the value it worked out.
        }
        if (raw.startsWith(TEXT_PREFIX)) { cells.push({ kind: 'string', row, col, ixfe, sst: sstOf(raw.slice(1)) }); continue }
        if (serial !== null) { cells.push({ kind: 'number', row, col, ixfe, value: serial }); continue }
        if (isError(value)) { cells.push({ kind: 'error', row, col, ixfe, code: xlsErrorCode(value.error) }); continue }
        if (typeof value === 'number') { cells.push({ kind: 'number', row, col, ixfe, value }); continue }
        if (typeof value === 'boolean') { cells.push({ kind: 'bool', row, col, ixfe, value }); continue }
        cells.push({ kind: 'string', row, col, ixfe, sst: sstOf(String(value === '' ? raw : value)) })
      }
    }
    // The rows the AutoFilter folds away go out hidden: BIFF has AUTOFILTER
    // records this does not write, so they come back hidden by hand, which
    // shows the same rows.
    const filtered = filteredRows(doc, name)
    return { name, state, cells, maxRow, maxCol, filtered }
  })

  // The globals: what every sheet shares.
  const globals = new Stream()
  globals.record(BOF, [0x00, 0x06, 0x05, 0x00, 0xd3, 0x10, 0xcc, 0x07, 0x00, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00])
  globals.record(CODEPAGE, [0xb0, 0x04])
  globals.record(DATEMODE, [0x00, 0x00])
  globals.record(COUNTRY, [0x01, 0x00, 0x01, 0x00])
  styles.write(globals)
  sstRecords(strings, globals)
  // One window over the workbook, saying which sheet opens.
  const active = Math.max(0, sheetNames.indexOf(wb.active))
  globals.record(WINDOW1, [
    0x00, 0x00, 0x00, 0x00, 0x40, 0x38, 0x00, 0x25, 0x38, 0x00,
    active & 0xff, (active >> 8) & 0xff, active & 0xff, (active >> 8) & 0xff,
    0x01, 0x00, 0x58, 0x02,
  ])

  // A workbook of its own, so a formula on one sheet can name another.
  globals.record(SUPBOOK, [sheetNames.length & 0xff, (sheetNames.length >> 8) & 0xff, 0x01, 0x04])
  const externsheet: number[] = [sheetNames.length & 0xff, (sheetNames.length >> 8) & 0xff]
  sheetNames.forEach((_, index) => { externsheet.push(0, 0, index & 0xff, (index >> 8) & 0xff, index & 0xff, (index >> 8) & 0xff) })
  globals.record(EXTERNSHEET, externsheet)

  for (const entry of defined) {
    const rpn = rpnFromFormula(String(entry.refersTo), formulaCtx)
    if (!rpn) continue
    const name = shortStringBytes(entry.name)
    globals.record(NAME, [
      0x00, 0x00, 0x00, name[0]!, rpn.length & 0xff, (rpn.length >> 8) & 0xff,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...name.slice(1), ...rpn,
    ])
  }

  // Where each sheet's records start is written into its BOUNDSHEET, which
  // is in front of them: the place is noted now and filled in at the end.
  const offsets: number[] = []
  planned.forEach(({ name, state }) => {
    globals.word(BOUNDSHEET)
    const body = [0, 0, 0, 0, state.sheetHidden ? 0x01 : 0x00, 0x00, ...shortStringBytes(name)]
    globals.word(body.length)
    offsets.push(globals.length)
    globals.put(body)
  })
  globals.record(EOF_RECORD, [])

  const sheets = planned.map(sheetStream)
  let at = globals.length
  offsets.forEach((position, index) => {
    const value = at
    globals.bytes[position] = value & 0xff
    globals.bytes[position + 1] = (value >>> 8) & 0xff
    globals.bytes[position + 2] = (value >>> 16) & 0xff
    globals.bytes[position + 3] = (value >>> 24) & 0xff
    at += sheets[index]!.length
  })

  const workbook = new Uint8Array(globals.length + sheets.reduce((sum, s) => sum + s.length, 0))
  workbook.set(Uint8Array.from(globals.bytes), 0)
  let written = globals.length
  for (const sheet of sheets) { workbook.set(Uint8Array.from(sheet.bytes), written); written += sheet.length }
  return writeCompoundFile([{ name: 'Workbook', data: workbook }])
}

/** A format store key back into a row and a column. */
function splitKey(key: string): { row: number; col: number } | null {
  const gap = key.indexOf(' ')
  if (gap < 0) return null
  const row = Number(decodeURIComponent(key.slice(0, gap)).slice(1))
  const col = lettersToCol(decodeURIComponent(key.slice(gap + 1)))
  return Number.isInteger(row) && row >= 0 && col >= 0 ? { row, col } : null
}

/** One sheet's own run of records. */
function sheetStream(
  sheet: { name: string; state: ReturnType<SheetDocument['get']>; cells: PlannedCell[]; maxRow: number; maxCol: number; filtered: ReadonlySet<number> },
): Stream {
  const { state, cells, maxRow, maxCol, filtered } = sheet
  const out = new Stream()
  out.record(BOF, [0x00, 0x06, 0x10, 0x00, 0xd3, 0x10, 0xcc, 0x07, 0x00, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00])
  out.record(DEFAULTROWHEIGHT, [0x00, 0x00, 0xff, 0x00])
  out.record(DEFCOLWIDTH, [0x08, 0x00])

  const widths = new Set<number>()
  for (const letter of Object.keys(state.widths)) { const c = lettersToCol(letter); if (c >= 0 && c < XLS_COLS) widths.add(c) }
  for (const c of state.hidden.cols) if (c < XLS_COLS) widths.add(c)
  for (const col of [...widths].sort((a, b) => a - b)) {
    const px = state.widths[colToLetters(col)]
    const units = Math.round((px === undefined ? 64 : px) / 7 * 256)
    const grbit = state.hidden.cols.has(col) ? 0x01 : 0x00
    out.record(COLINFO, [
      col & 0xff, (col >> 8) & 0xff, col & 0xff, (col >> 8) & 0xff,
      units & 0xff, (units >> 8) & 0xff, 15, 0, grbit, 0, 0, 0,
    ])
  }

  out.record(DIMENSIONS, [
    0, 0, 0, 0,
    (maxRow + 1) & 0xff, ((maxRow + 1) >> 8) & 0xff, ((maxRow + 1) >>> 16) & 0xff, ((maxRow + 1) >>> 24) & 0xff,
    0, 0, (maxCol + 1) & 0xff, ((maxCol + 1) >> 8) & 0xff, 0, 0,
  ])

  // The rows that hold something, then the cells: a reader wants the row
  // records in front of the cells they describe.
  const rowsWithCells = new Set(cells.map((c) => c.row))
  for (const row of state.heights.keys()) if (row < XLS_ROWS) rowsWithCells.add(row)
  for (const row of state.hidden.rows) if (row < XLS_ROWS) rowsWithCells.add(row)
  for (const row of filtered) if (row < XLS_ROWS) rowsWithCells.add(row)
  for (const row of [...rowsWithCells].sort((a, b) => a - b)) {
    const px = state.heights.get(row)
    const twips = px === undefined ? 255 : Math.round(pxToPt(px) * 20)
    const grbit = 0x0100 | (state.hidden.rows.has(row) || filtered.has(row) ? 0x20 : 0) | (px === undefined ? 0 : 0x40)
    out.record(ROW, [
      row & 0xff, (row >> 8) & 0xff, 0, 0, (maxCol + 1) & 0xff, ((maxCol + 1) >> 8) & 0xff,
      twips & 0xff, (twips >> 8) & 0xff, 0, 0, 0, 0,
      grbit & 0xff, (grbit >> 8) & 0xff, 15, 0,
    ])
  }

  for (const cell of cells) {
    const head = [cell.row & 0xff, (cell.row >> 8) & 0xff, cell.col & 0xff, (cell.col >> 8) & 0xff, cell.ixfe & 0xff, (cell.ixfe >> 8) & 0xff]
    switch (cell.kind) {
      case 'blank':
        out.record(BLANK, head)
        break
      case 'string':
        out.record(LABELSST, [...head, cell.sst & 0xff, (cell.sst >>> 8) & 0xff, (cell.sst >>> 16) & 0xff, (cell.sst >>> 24) & 0xff])
        break
      case 'bool':
        out.record(BOOLERR, [...head, cell.value ? 1 : 0, 0])
        break
      case 'error':
        out.record(BOOLERR, [...head, cell.code, 1])
        break
      case 'number': {
        const rk = rkBytes(cell.value)
        if (rk === null) {
          const body = new Stream()
          body.put(head)
          body.double(cell.value)
          out.record(NUMBER, body.bytes)
        } else {
          out.record(RK, [...head, rk & 0xff, (rk >>> 8) & 0xff, (rk >>> 16) & 0xff, (rk >>> 24) & 0xff])
        }
        break
      }
      case 'formula': {
        const body = new Stream()
        body.put(head)
        // The value the sheet showed, so a reader has it before it
        // recalculates - and the shape that says which kind of value it is.
        let follows: string | null = null
        if (isError(cell.value)) body.put([0x02, 0x00, xlsErrorCode(cell.value.error), 0x00, 0x00, 0x00, 0xff, 0xff])
        else if (typeof cell.value === 'boolean') body.put([0x01, 0x00, cell.value ? 1 : 0, 0x00, 0x00, 0x00, 0xff, 0xff])
        else if (typeof cell.value === 'number') body.double(cell.value)
        else if (cell.value === '') body.put([0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff])
        else { body.put([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff]); follows = String(cell.value) }
        body.word(0x0002) // work it out again on the way in
        body.long(0)
        body.word(cell.rpn.length)
        body.put(cell.rpn)
        out.record(FORMULA, body.bytes)
        if (follows !== null) out.record(STRING_RECORD, longStringBytes(follows))
        break
      }
    }
  }

  if (state.merges.length) {
    const merges = state.merges.filter(([r1, c1, r2, c2]) => r2 < XLS_ROWS && c2 < XLS_COLS && r1 >= 0 && c1 >= 0)
    for (let at = 0; at < merges.length; at += 1024) {
      const block = merges.slice(at, at + 1024)
      const body: number[] = [block.length & 0xff, (block.length >> 8) & 0xff]
      for (const [r1, c1, r2, c2] of block) {
        body.push(r1 & 0xff, (r1 >> 8) & 0xff, r2 & 0xff, (r2 >> 8) & 0xff, c1 & 0xff, (c1 >> 8) & 0xff, c2 & 0xff, (c2 >> 8) & 0xff)
      }
      out.record(MERGEDCELLS, body)
    }
  }

  if (state.protected) out.record(PROTECT, [0x01, 0x00])

  const frozen = state.freeze.rows > 0 || state.freeze.cols > 0
  // Gridlines and headings on, the sheet selected, and frozen when it is:
  // a frozen pane is both "there is a split" and "the split does not move".
  const grbit = 0x06b6 | (frozen ? 0x0108 : 0)
  out.record(WINDOW2, [
    grbit & 0xff, (grbit >> 8) & 0xff, 0, 0, 0, 0, 0x40, 0x00, 0x00, 0x00,
    0, 0, 0, 0, 0, 0, 0, 0,
  ])
  if (frozen) {
    out.record(PANE, [
      state.freeze.cols & 0xff, (state.freeze.cols >> 8) & 0xff,
      state.freeze.rows & 0xff, (state.freeze.rows >> 8) & 0xff,
      state.freeze.rows & 0xff, (state.freeze.rows >> 8) & 0xff,
      state.freeze.cols & 0xff, (state.freeze.cols >> 8) & 0xff,
      0x02,
    ])
  }
  out.record(SELECTION, [0x03, 0, 0, 0, 0, 0, 0x01, 0x00, 0, 0, 0, 0, 0, 0, 0])
  out.record(EOF_RECORD, [])
  return out
}
