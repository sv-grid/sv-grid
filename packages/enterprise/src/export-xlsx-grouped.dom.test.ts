import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { installSmartShim } from './smart-shim'

// The Smart writer found a string's shared-string index, and checked the group
// rows already written, with indexOf: rows x strings and rows x groups. A
// grouped export took 80 ms at 1,000 rows and 3 s at 10,000. These pin the
// output that the Map / Set lookups have to keep.
async function exportSheet(groupBy: string[] | undefined, count: number) {
  installSmartShim()
  ;(window as unknown as { JSZip: typeof JSZip }).JSZip = JSZip
  const Smart = (window as unknown as { Smart: { Utilities: { DataExporter?: unknown } } }).Smart
  // Registers Smart.Utilities.DataExporter, as export.ts loads it.
  await import('./smart.export.js')
  const Ctor = Smart.Utilities.DataExporter as new (o: object, g?: string[]) => {
    downloadFile: (b: Blob) => void
    exportData: (rows: object[], format: string, name: string) => void
  }
  const names = ['Ann', 'Bob', 'Cy', 'Dee']
  const rows: Record<string, unknown>[] = [{ year: 'Year', month: 'Month', day: 'Day', who: 'Who', note: 'Note' }]
  for (let i = 0; i < count; i++) {
    rows.push({ year: 2020 + (i % 3), month: (i * 7) % 12, day: (i * 5) % 28, who: names[i % 4], note: `note ${i}` })
  }
  const ex = new Ctor({ exportHeader: true }, groupBy)
  let blob: Blob | null = null
  ex.downloadFile = (b) => { blob = b }
  ex.exportData(rows, 'xlsx', 'x')
  for (let i = 0; i < 100 && !blob; i++) await new Promise((r) => setTimeout(r, 20))
  const zip = await JSZip.loadAsync(await (blob as unknown as Blob).arrayBuffer())
  return {
    sheet: await zip.file('xl/worksheets/sheet1.xml')!.async('string'),
    strings: await zip.file('xl/sharedStrings.xml')!.async('string'),
  }
}

describe('grouped xlsx export', () => {
  it('writes one header row per group and every string cell points at its string', async () => {
    const { sheet, strings } = await exportSheet(['year', 'who'], 200)
    // Header in row 1, group rows in 2 and 3, the first data row in 4.
    const shared = [...strings.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1])
    // 3 years x 4 people = 12 inner groups under 3 outer ones.
    expect(sheet.match(/outlineLevel="0"/g)?.length).toBe(3)
    expect(sheet.match(/outlineLevel="1"/g)?.length).toBe(12)
    for (const m of sheet.matchAll(/<c r="[A-Z]+\d+" t="s"[^>]*>\s*<v>(\d+)<\/v>/g)) {
      expect(Number(m[1])).toBeLessThan(shared.length)
    }
    // The first data row's name resolves to that row's string.
    const firstWho = /<c r="D4" t="s"[^>]*>\s*<v>(\d+)<\/v>/.exec(sheet)
    expect(shared[Number(firstWho![1])]).toBe('Ann')
  })

  // Counted rather than timed: 20,000 distinct strings and ~1,000 groups took
  // 1.3 s with indexOf and 0.26 s without in jsdom, too close for a time limit
  // on a shared CI runner, but the indexOf calls scale with the rows.
  it('does not search an array per cell', async () => {
    const indexOf = Array.prototype.indexOf
    let calls = 0
    Array.prototype.indexOf = function (this: unknown[], ...args: [unknown, number?]) {
      calls++
      return indexOf.apply(this, args)
    }
    try {
      await exportSheet(['year', 'month', 'day'], 20000)
    } finally {
      Array.prototype.indexOf = indexOf
    }
    expect(calls).toBeLessThan(5000)
  }, 60000)
})
