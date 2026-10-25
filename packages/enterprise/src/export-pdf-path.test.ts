/**
 * The PDF export end to end, from a grid api to the document pdfmake is
 * handed: booleans, column aggregates, and conditional formatting in grouped
 * exports, which used to be dropped. pdfmake itself is stubbed; the layout and
 * a real render are covered in export-pdf-layout.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { exportGrid } from './export'
import { clearLicenseKey, setLicenseKey } from './license'

type Cell = { text?: string; columns?: Array<{ canvas?: unknown; text?: string }> }
type Def = { content: Array<{ table?: { body: Cell[][] } }> }
let defs: Def[] = []
const g = globalThis as unknown as { pdfMake?: unknown }

beforeEach(() => {
  setLicenseKey('SVENTERPRISE-DEV-TEST')
  defs = []
  g.pdfMake = {
    createPdf: (def: Def) => {
      defs.push(def)
      return { getBlob: (cb: (b: Blob) => void) => cb(new Blob(['%PDF-'])), download() {} }
    },
  }
})
afterEach(() => {
  clearLicenseKey()
  delete g.pdfMake
})

type Row = { team: string; name: string; active: boolean; score: number }
const data: Row[] = [
  { team: 'A', name: 'Ada', active: true, score: 10 },
  { team: 'A', name: 'Grace', active: false, score: 30 },
  { team: 'B', name: 'Linus', active: true, score: 5 },
]
function api(columns: Array<Record<string, unknown>>, grouping: string[] = []) {
  return {
    getDisplayedRows: () => data,
    getSelectedRows: () => [],
    getData: () => data,
    getColumns: () => columns.map((c) => ({ visible: true, id: c.field, ...c })),
    getState: () => ({ grouping }),
    getColumnPinning: () => ({ left: [], right: [] }),
  } as never
}
const body = () => defs[0]!.content.find((c) => c.table)!.table!.body
const drawn = (cell: Cell | undefined) => !!cell?.columns?.some((c) => c.canvas)

describe('PDF export path', () => {
  it('prints a boolean as a tick, or nothing, instead of the words', async () => {
    await exportGrid(api([{ field: 'name', header: 'Name' }, { field: 'active', header: 'Active', align: 'center' }]), { format: 'pdf', download: false })
    const rows = body()
    expect(drawn(rows[1]![1])).toBe(true)
    expect(rows[2]![1]!.text).toBe('')
    expect(JSON.stringify(rows)).not.toMatch(/"(true|false)"/)
  })

  it('totals a grouped export with each column\'s own aggregate from the grid', async () => {
    await exportGrid(
      api([{ field: 'team', header: 'Team' }, { field: 'name', header: 'Name', aggregate: 'count' }, { field: 'score', header: 'Score', format: { type: 'number' }, aggregate: 'avg' }], ['team']),
      { format: 'pdf', download: false },
    )
    const texts = body().map((r) => r.map((c) => c.text))
    expect(texts).toContainEqual(['Subtotal (A)', '2', '20'])
    expect(texts.at(-1)).toEqual(['Total', '3', '15'])
  })

  it('keeps conditional formatting in a grouped export, and honours iconOnly', async () => {
    await exportGrid(api([{ field: 'team', header: 'Team' }, { field: 'score', header: 'Score' }], ['team']), {
      format: 'pdf',
      download: false,
      conditionalFormats: [{ columns: ['score'], type: 'iconSet', set: 'triangles', thresholds: [10, 20], iconOnly: true }],
    })
    const dataRows = body().filter((r) => r.length === 2 && (drawn(r[1]) || /^\d+$/.test(r[1]!.text ?? '')))
    expect(dataRows).toHaveLength(3)
    for (const r of dataRows) {
      expect(drawn(r[1])).toBe(true)
      expect(r[1]!.columns!.some((c) => /\d/.test(c.text ?? ''))).toBe(false)
    }
  })
})
