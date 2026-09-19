/**
 * One door for a file the user picked.
 *
 * A spreadsheet arrives as one of three things, whatever the picker called
 * it: an .xlsx from Excel or Google Sheets, an .ods from LibreOffice (or
 * Google Sheets, which offers both), or a .csv, which every one of them
 * exports. The kind is read from the BYTES rather than from the name: a file
 * picked on a phone often arrives with no extension and no media type, and a
 * zip always starts PK, with the package inside saying which package it is.
 */
import { documentFromXlsxParts, loadZip, type ZipCtor } from './xlsx-document'
import { sheetStateFromOds } from './ods-document'
import { sheetStateFromCsv } from './csv'
import type { SheetState } from './document'

/** A picture travels as the data URL the document holds, as in the xlsx reader. */
const MEDIA_PREFIX = 'xl/media/'
const mediaTypeOf = (path: string): string => {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension || 'png'}`
}

export type OpenedFile = { state: SheetState; kind: 'xlsx' | 'ods' | 'csv' }

/** What a file holds, and which kind of file it turned out to be. */
export async function readSpreadsheetFile(
  file: Blob & { name?: string },
  JSZip?: ZipCtor,
): Promise<OpenedFile> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (head[0] !== 0x50 || head[1] !== 0x4b) {
    const name = (file.name ?? '').replace(/\.[^.]+$/, '')
    return { state: sheetStateFromCsv(await file.text(), (name || 'Sheet1').slice(0, 31)), kind: 'csv' }
  }
  const Zip = await loadZip(JSZip)
  const zip = await Zip.loadAsync(file)
  const parts: Record<string, string> = {}
  const pending: Array<Promise<void>> = []
  zip.forEach((path, entry) => {
    if (entry.dir) return
    const clean = path.replace(/^\//, '')
    if (clean.startsWith(MEDIA_PREFIX)) {
      pending.push(entry.async('base64').then((base64) => { parts[clean] = `data:${mediaTypeOf(clean)};base64,${base64}` }))
      return
    }
    if (!/\.(xml|rels|vml)$/i.test(clean)) return
    pending.push(entry.async('string').then((text) => { parts[clean] = text }))
  })
  await Promise.all(pending)
  if (parts['content.xml'] && !parts['xl/workbook.xml']) return { state: sheetStateFromOds(parts), kind: 'ods' }
  return { state: documentFromXlsxParts(parts), kind: 'xlsx' }
}

/** The document a file holds: .xlsx, .ods or .csv, decided by its bytes. */
export async function documentFromFile(file: Blob & { name?: string }, JSZip?: ZipCtor): Promise<SheetState> {
  return (await readSpreadsheetFile(file, JSZip)).state
}
