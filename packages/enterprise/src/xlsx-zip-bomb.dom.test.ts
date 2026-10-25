/**
 * Zip bombs: a small .xlsx / .ods whose parts inflate to far more than any
 * real workbook. Every reader unzips through readZipEntry, which counts the
 * bytes as they come out and stops at the budget instead of inflating the
 * whole part into memory first.
 *
 * The readers' budget is 256 MB; building that much in a test is its own
 * memory problem, so here it is 1 MB and the bombs are a few MB of padding.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

vi.mock('./xlsx-limits', async (importActual) => {
  const actual = await importActual<typeof import('./xlsx-limits')>()
  return { ...actual, createUnzipBudget: (limit = 1024 * 1024) => actual.createUnzipBudget(limit) }
})

import { createUnzipBudget, readZipEntry } from './xlsx-limits'
import { importData } from './import'
import { clearLicenseKey, setLicenseKey } from './license'
import { documentFromXlsx } from './sheet/xlsx-document'
import { documentFromOds } from './sheet/ods-document'
import { documentFromFile } from './sheet/open-file'

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
/** XML that is valid and compresses to almost nothing: `size` bytes of spaces inside the root. */
const padded = (inner: string, size: number) => `<?xml version="1.0"?><worksheet ${NS}>${' '.repeat(size)}<sheetData>${inner}</sheetData></worksheet>`
const ROW = '<row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>1</t></is></c></row>'

async function zipOf(parts: Record<string, string>): Promise<Blob> {
  const zip = new JSZip()
  for (const [path, text] of Object.entries(parts)) zip.file(path, text)
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return new Blob([bytes as BlobPart])
}
const WORKBOOK = {
  'xl/workbook.xml': `<?xml version="1.0"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
}
const bomb = () => zipOf({ ...WORKBOOK, 'xl/worksheets/sheet1.xml': padded(ROW, 6 * 1024 * 1024) })
const small = () => zipOf({ ...WORKBOOK, 'xl/worksheets/sheet1.xml': padded(ROW, 10) })

beforeEach(() => setLicenseKey('SVENTERPRISE-DEV-TEST'))
afterEach(() => clearLicenseKey())

describe('readZipEntry', () => {
  it('stops inflating at the budget, without reading the whole part', async () => {
    const zip = await JSZip.loadAsync(await (await bomb()).arrayBuffer())
    const budget = createUnzipBudget(256 * 1024)
    await expect(readZipEntry(zip.file('xl/worksheets/sheet1.xml')!, 'string', budget)).rejects.toThrow(/unzips to more than/)
    // It overran by at most a chunk, not by the rest of the 6 MB part.
    expect(budget.left).toBeGreaterThan(-256 * 1024)
  })

  it('reads a part within the budget exactly, as text or as base64', async () => {
    const zip = await JSZip.loadAsync(await (await zipOf({ 'a.txt': 'héllo wörld', 'b.bin': 'AQID' })).arrayBuffer())
    const budget = createUnzipBudget(1024)
    expect(await readZipEntry(zip.file('a.txt')!, 'string', budget)).toBe('héllo wörld')
    expect(await readZipEntry(zip.file('b.bin')!, 'base64', budget)).toBe(btoa('AQID'))
  })

  it('shares one budget between the parts of a file', async () => {
    const zip = await JSZip.loadAsync(await (await zipOf({ 'a.xml': 'x'.repeat(600), 'b.xml': 'y'.repeat(600) })).arrayBuffer())
    const budget = createUnzipBudget(1000)
    await expect(Promise.all([readZipEntry(zip.file('a.xml')!, 'string', budget), readZipEntry(zip.file('b.xml')!, 'string', budget)])).rejects.toThrow(/unzips to more than/)
  })
})

describe('every reader refuses a zip bomb', () => {
  const api = { getData: () => [], addRows: () => {}, setColumnVisible: () => {}, isColumnVisible: () => true } as never

  it('importData', async () => {
    await expect(importData(api, { file: await bomb(), format: 'xlsx' })).rejects.toThrow(/unzips to more than 1 MB/)
    await expect(importData(api, { file: await small(), format: 'xlsx', preview: true } as never)).resolves.toBeTruthy()
  })

  it('documentFromXlsx and documentFromFile (File > Open)', async () => {
    await expect(documentFromXlsx(await bomb(), JSZip as never)).rejects.toThrow(/unzips to more than/)
    await expect(documentFromFile(await bomb(), JSZip as never)).rejects.toThrow(/unzips to more than/)
    await expect(documentFromXlsx(await small(), JSZip as never)).resolves.toBeTruthy()
  })

  it('documentFromOds', async () => {
    const ods = await zipOf({ 'content.xml': `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0">${' '.repeat(6 * 1024 * 1024)}</office:document-content>` })
    await expect(documentFromOds(ods, JSZip as never)).rejects.toThrow(/unzips to more than/)
  })
})
