import { describe, expect, it } from 'vitest'
import { readSpreadsheetFile } from './open-file'
import { documentToXls } from './xls-document'
import { createWorkbook } from './workbook'
import { createSheetDocument } from './document'

const doc = () => createSheetDocument({ workbook: createWorkbook([{ name: 'S', cells: [['a', '1'], ['b', '=B1+1']] }]) })

describe('opening a file the user picked', () => {
  it('knows an .xls by its bytes, whatever the picker called it', async () => {
    const file = new Blob([documentToXls(doc()) as BlobPart])
    const opened = await readSpreadsheetFile(file)
    expect(opened.kind).toBe('xls')
    expect(opened.state.workbook.sheets[0]!.cells[1]).toEqual(['b', '=B1+1'])
  })

  it('reads a file with no extension and no type as the CSV it is', async () => {
    const opened = await readSpreadsheetFile(new Blob(['a,b\n1,2']))
    expect(opened.kind).toBe('csv')
    expect(opened.state.workbook.sheets[0]!.cells).toEqual([['a', 'b'], ['1', '2']])
  })
})
