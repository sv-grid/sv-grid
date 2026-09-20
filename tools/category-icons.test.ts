/**
 * Every demo category has its own glyph, in both galleries. The registries are
 * read as text (importing them would compile every demo), the glyph map as a
 * module. A new category with no glyph would show the fallback grid in the
 * sidebar; this is what tells you to draw one.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATEGORY_ICON_PATHS, CATEGORY_ICON_FALLBACK, categoryIcon } from '../examples/src/shared/category-icons'

function categoriesOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf('export type DemoCategory =')
  expect(start).toBeGreaterThan(-1)
  const body = src.slice(start, src.indexOf('\n\n', start))
  return [...body.matchAll(/^\s*\|\s*'([^']+)'/gm)].map((m) => m[1]!)
}

const REGISTRIES = ['website/src/lib/demos.ts', 'examples/src/shared/registry.ts']

describe('demo category glyphs', () => {
  for (const file of REGISTRIES) {
    it(`${file}: every category has a glyph of its own`, () => {
      const cats = categoriesOf(file)
      expect(cats.length).toBeGreaterThan(20)
      const missing = cats.filter((c) => categoryIcon(c) === CATEGORY_ICON_FALLBACK)
      expect(missing).toEqual([])
    })
  }

  it('the map carries no category neither registry has any more', () => {
    // The site has Community and Recipes; the standalone shell files those
    // demos elsewhere. A key is stale only when both have dropped it.
    const known = new Set(REGISTRIES.flatMap(categoriesOf))
    const stale = Object.keys(CATEGORY_ICON_PATHS).filter((c) => !known.has(c))
    expect(stale).toEqual([])
  })

  it('paths are 24x24 stroke paths with the pen the UI-lane glyphs use', () => {
    for (const [cat, d] of Object.entries(CATEGORY_ICON_PATHS)) {
      expect(d, cat).toMatch(/^M[\d.\s\-a-zA-Z,]+$/)
      const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      for (const n of numbers) expect(Math.abs(n), `${cat}: ${n}`).toBeLessThanOrEqual(24)
    }
  })
})
