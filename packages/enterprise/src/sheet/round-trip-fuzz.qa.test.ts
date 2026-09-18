/**
 * Deep QA: the round trips again, this time on documents nobody wrote.
 *
 * The hand-written round-trip suite checks the shapes we thought of. This
 * one builds documents from a seeded generator instead: odd rectangles,
 * merges over a single cell, a link on the last column, a table whose last
 * row is its header, a sparkline reading a column that is not there. Seeded,
 * so a failure names the seed and comes back the same way every run. Sixty
 * of them here to keep the suite quick; the generator was run to five
 * hundred while it was written, which is what the number is for.
 */
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createSheetDocument } from './document'
import { documentToXlsxParts, documentFromXlsxParts } from './xlsx-document'
import type { Rect } from './format-store'

/** A small deterministic generator: the same seed gives the same document. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const TEXTS = ['12', '-3.5', 'North', '', 'TRUE', '=A1+1', '=SUM(A1:B2)', '=IF(A1>0,"up","down")', '0.0001', '1e21']

function build(seed: number) {
  const next = random(seed)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!
  const upto = (n: number) => Math.floor(next() * n)

  const rows = 2 + upto(6)
  const cols = 1 + upto(4)
  const cells: string[][] = []
  for (let r = 0; r < rows; r += 1) {
    const line: string[] = []
    for (let c = 0; c < cols; c += 1) line.push(pick(TEXTS))
    cells.push(line)
  }
  const doc = createSheetDocument({ sheets: [{ name: 'S', cells }] })
  const rect = (a: number, b: number, c: number, d: number) => [a, b, c, d] as unknown as Rect

  const merge = (a: number, b: number, c: number, d: number): [number, number, number, number] => [a, b, c, d]
  if (next() < 0.5) doc.patch('S', { merges: [merge(upto(rows), upto(cols), upto(rows), upto(cols))] })
  if (next() < 0.5) doc.patch('S', { links: { [`r${upto(rows)}`]: { A: { target: pick(['https://example.com', 'S!A2', 'Tax', 'mailto:a@b.c']) } } } })
  if (next() < 0.5) {
    doc.patch('S', { sparklines: [{ id: 's', location: rect(rows + 1, 0, rows + 1, 0), data: rect(0, 0, rows - 1, cols - 1), type: pick(['line', 'column', 'winloss'] as const) }] })
  }
  if (next() < 0.5) {
    doc.workbook.tables.define({ name: 'T_data', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: cols - 1, lastRow: rows - 1, hasTotals: next() < 0.5 })
  }
  if (next() < 0.5) doc.workbook.names.define('Tax', `S!A${1 + upto(rows)}`)
  if (next() < 0.5) doc.workbook.setIteration({ enabled: true, maxIterations: 1 + upto(50), maxChange: 0.001 })
  if (next() < 0.5) {
    doc.patch('S', { pivots: [{
      id: 'p', source: rect(0, 0, rows - 1, cols - 1), target: { row: rows + 2, col: 0 },
      rows: ['Column A'], cols: [], values: [{ field: 'Column B', agg: pick(['sum', 'count', 'avg'] as const) }],
    }] })
  }
  if (next() < 0.5) doc.patch('S', { freeze: { rows: upto(rows), cols: upto(cols) } })
  if (next() < 0.5) {
    doc.patch('S', { validation: [{
      id: 'v', rects: [rect(0, 0, rows - 1, 0)], allow: 'list', value1: 'a,b',
      ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' },
    }] })
  }
  if (next() < 0.5) {
    doc.patch('S', { conditionalFormats: [{
      id: 'cf', rects: [rect(0, 0, rows - 1, cols - 1)],
      kind: 'cellIs', operator: 'greater', value1: '5', style: { fill: '#fee2e2' },
    }] })
  }
  if (next() < 0.5) doc.patch('S', { comments: { [`r${upto(rows)}`]: { A: 'a note' } } })
  if (next() < 0.5) doc.patch('S', { columnWidths: { A: 40 + upto(200) }, rowHeights: [[upto(rows), 18 + upto(40)]] })
  if (next() < 0.5) doc.patch('S', { hidden: { rows: [upto(rows)], cols: [upto(cols)] } })
  return doc
}

describe('a generated document survives both round trips', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    it(`seed ${seed}`, () => {
      const doc = build(seed)
      const saved = JSON.parse(JSON.stringify(doc.getState()))

      // getState -> setState -> getState, which is what a save and a reload
      // through a host's own storage does.
      const again = createSheetDocument({ state: JSON.parse(JSON.stringify(saved)) })
      expect(JSON.parse(JSON.stringify(again.getState())), 'through the state').toEqual(saved)

      // And the file: every part parses, and reading it back gives a
      // document that can be written again to the same parts.
      const parts = documentToXlsxParts(doc)
      for (const [path, xml] of Object.entries(parts)) {
        if (!path.endsWith('.xml') && !path.endsWith('.rels')) continue
        const parsed = new DOMParser().parseFromString(xml, 'application/xml')
        expect(parsed.querySelector('parsererror')?.textContent ?? '', path).toBe('')
      }
      const read = createSheetDocument({ state: documentFromXlsxParts(parts) })
      const twice = documentToXlsxParts(read)
      expect(Object.keys(twice).sort(), 'the same parts the second time').toEqual(Object.keys(parts).sort())

      // What a cell holds is the thing a file is for: every formula comes
      // back as a formula and every typed value as itself.
      const before = doc.workbook
      const after = read.workbook
      for (let r = 0; r < before.rowCount('S'); r += 1) {
        for (let c = 0; c < before.colCount('S'); c += 1) {
          const was = before.getRaw('S', r, c)
          const now = after.getRaw('S', r, c)
          if (was.startsWith('=')) { expect(now, `formula at ${r},${c}`).toBe(was); continue }
          if (was === '') continue
          // A number typed as `1e21` comes back as `1e+21`: the file holds
          // the number, not the keystrokes, which is what Excel does too. So
          // numbers are compared as numbers and everything else as text.
          const wasNumber = Number(was)
          if (was.trim() !== '' && Number.isFinite(wasNumber)) expect(Number(now), `number at ${r},${c}`).toBe(wasNumber)
          else expect(now, `value at ${r},${c}`).toBe(was)
        }
      }
      const merges = (state: ReturnType<typeof doc.getState>) => state.sheets.S?.merges?.length ?? 0
      expect(merges(read.getState()), 'merges through the file').toBe(merges(doc.getState()))
    })
  }
})
