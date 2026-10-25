/**
 * A crafted .xlsx must not take the tab down. Both readers fill the gap before
 * a cell with blanks, and the gap comes from the file: `<c r="ZZZZZZZ1">` asked
 * for about eight billion of them. See xlsx-limits.ts.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { importData } from './import'
import { clearLicenseKey, setLicenseKey } from './license'
import { documentFromXlsxParts } from './sheet/xlsx-document'

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
const sheet = (rows: string) => `<?xml version="1.0"?><worksheet ${NS}><sheetData>${rows}</sheetData></worksheet>`
const cell = (ref: string, text: string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`

async function xlsx(sheetXml: string): Promise<Blob> {
  const zip = new JSZip()
  zip.file('xl/worksheets/sheet1.xml', sheetXml)
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  return new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function fakeApi() {
  const noop = () => {}
  return {
    getData: () => [],
    addRows: noop,
    setColumnVisible: noop,
    isColumnVisible: () => true,
  } as never
}

// The many-rows-at-XFD shape: inside the sheet, but 16,383 blanks per row.
const thinRows = (n: number) =>
  Array.from({ length: n }, (_, i) => `<row r="${i + 1}">${cell(`A${i + 1}`, 'a')}${cell(`XFD${i + 1}`, 'z')}</row>`).join('')

beforeEach(() => setLicenseKey('SVENTERPRISE-DEV-TEST'))
afterEach(() => clearLicenseKey())

describe('importData: xlsx bounds', () => {
  it('rejects a cell past column XFD instead of allocating up to it', async () => {
    const file = await xlsx(sheet(`<row r="1">${cell('A1', 'id')}${cell('ZZZZZZZ1', 'boom')}</row>`))
    const start = Date.now()
    await expect(importData(fakeApi(), { file, format: 'xlsx' })).rejects.toThrow(/outside the sheet/)
    expect(Date.now() - start).toBeLessThan(2000)
  })

  it('rejects a sheet whose blanks would run into the hundreds of millions', async () => {
    const file = await xlsx(sheet(thinRows(700)))
    await expect(importData(fakeApi(), { file, format: 'xlsx' })).rejects.toThrow(/spread too thinly/)
  })

  it('still reads an ordinary sheet with a gap', async () => {
    const file = await xlsx(sheet(`<row r="1">${cell('A1', 'id')}${cell('C1', 'name')}</row><row r="2">${cell('A2', '1')}${cell('C2', 'Ada')}</row>`))
    const result = await importData(fakeApi(), { file, format: 'xlsx', preview: true } as never)
    expect(result.rows[0]).toMatchObject({ id: 1, name: 'Ada' })
  })
})

describe('documentFromXlsxParts: bounds', () => {
  const parts = (sheetXml: string) => ({
    'xl/workbook.xml': `<?xml version="1.0"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheetXml,
  })

  it('skips a cell billions of columns out, quickly', () => {
    const start = Date.now()
    const state = documentFromXlsxParts(parts(sheet(`<row r="1">${cell('A1', 'kept')}${cell('ZZZZZZZ1', 'boom')}</row>`)))
    expect(Date.now() - start).toBeLessThan(2000)
    expect(state.workbook.sheets[0]!.cells[0]).toEqual(['kept'])
  })

  it('skips a row billions down, quickly', () => {
    const start = Date.now()
    const state = documentFromXlsxParts(parts(sheet(`<row r="1">${cell('A1', 'kept')}</row><row r="99999999999">${cell('A99999999999', 'boom')}</row>`)))
    expect(Date.now() - start).toBeLessThan(2000)
    expect(state.workbook.sheets[0]!.cells).toHaveLength(1)
  })

  it('refuses a sheet whose blanks would run into the hundreds of millions', () => {
    expect(() => documentFromXlsxParts(parts(sheet(thinRows(700))))).toThrow(/spread too thinly/)
  })
})
