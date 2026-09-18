/** @vitest-environment jsdom */
/**
 * Deep QA, round 6: the package as a reader sees it. Content types,
 * relationships and the parts every path must declare, since a package
 * that is missing one of those opens as a file needing repair.
 */
import { describe, expect, it } from 'vitest'
import { createSheetDocument } from './document'
import { documentToXlsxParts } from './xlsx-document'
import type { Rect } from './format-store'

const rect = (a: number, b: number, c: number, d: number) => [a, b, c, d] as unknown as Rect
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function withEverything() {
  const doc = createSheetDocument({
    sheets: [
      { name: 'One', cells: [['Region', 'Amount'], ['N', '10'], ['S', '20']] },
      { name: 'Two', cells: [['x']] },
    ],
  })
  doc.workbook.tables.define({ name: 'T', sheet: 'One', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false })
  doc.get('One').objects = [
    { id: 'a', kind: 'chart', anchor: { row: 5, col: 0, dx: 0, dy: 0, width: 300, height: 200 }, range: rect(0, 0, 2, 1), type: 'bar', headers: true, series: 'columns' },
    { id: 'b', kind: 'image', anchor: { row: 5, col: 4, dx: 0, dy: 0, width: 60, height: 40 }, src: PNG },
  ]
  doc.get('Two').objects = [
    { id: 'c', kind: 'image', anchor: { row: 0, col: 2, dx: 0, dy: 0, width: 60, height: 40 }, src: PNG },
  ]
  doc.get('One').links = {
    r1: { A: { target: 'https://example.com' }, B: { target: 'https://example.org' } },
    r2: { A: { target: 'Two!A1', tip: 'The other sheet' } },
  }
  doc.get('One').notes.r1 = { B: 'A note' }
  return doc
}

/** Every part a relationship points at, resolved the way a reader does. */
function relTargets(parts: Record<string, string>, relsPath: string): string[] {
  const xml = parts[relsPath]
  if (!xml) return []
  const base = relsPath.replace(/_rels\/[^/]+$/, '')
  return [...xml.matchAll(/Target="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((target) => !/^https?:/.test(target))
    .map((target) => {
      let path = base + target
      while (path.includes('/../')) path = path.replace(/[^/]+\/\.\.\//, '')
      return path
    })
}

describe('the package hangs together', () => {
  const parts = documentToXlsxParts(withEverything())

  it('every relationship points at a part that is in the package', () => {
    const missing: string[] = []
    for (const path of Object.keys(parts)) {
      if (!path.endsWith('.rels')) continue
      for (const target of relTargets(parts, path)) {
        if (!parts[target]) missing.push(`${path} -> ${target}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('every part that needs a content type has one', () => {
    const types = parts['[Content_Types].xml']!
    const defaults = new Set([...types.matchAll(/<Default Extension="([^"]+)"/g)].map((m) => m[1]!.toLowerCase()))
    const overrides = new Set([...types.matchAll(/<Override PartName="([^"]+)"/g)].map((m) => m[1]!))
    const uncovered = Object.keys(parts).filter((path) => {
      if (path === '[Content_Types].xml') return false
      const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
      return !overrides.has(`/${path}`) && !defaults.has(extension)
    })
    expect(uncovered).toEqual([])
  })

  it('numbers the drawings, charts and media across the workbook, not per sheet', () => {
    expect(parts['xl/drawings/drawing1.xml']).toBeTruthy()
    expect(parts['xl/drawings/drawing2.xml']).toBeTruthy()
    expect(parts['xl/media/image1.png']).toBeTruthy()
    expect(parts['xl/media/image2.png']).toBeTruthy()
    expect(parts['xl/charts/chart1.xml']).toBeTruthy()
    // Each sheet's own rels point at its own drawing.
    expect(parts['xl/worksheets/_rels/sheet1.xml.rels']).toContain('drawings/drawing1.xml')
    expect(parts['xl/worksheets/_rels/sheet2.xml.rels']).toContain('drawings/drawing2.xml')
  })

  it('gives each relationship id in a part a distinct name', () => {
    for (const [path, xml] of Object.entries(parts)) {
      if (!path.endsWith('.rels')) continue
      const ids = [...xml.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]!)
      expect([path, ids.length]).toEqual([path, new Set(ids).size])
    }
  })

  it('is well formed everywhere, media aside', () => {
    for (const [path, xml] of Object.entries(parts)) {
      if (path.startsWith('xl/media/')) continue
      const doc = new DOMParser().parseFromString(xml, 'application/xml')
      expect([path, doc.getElementsByTagName('parsererror').length]).toEqual([path, 0])
    }
  })
})
