/**
 * The icon catalogue as data: the name list and the glyph table have to agree
 * with each other and with the filter-operator catalogue.
 *
 * The third test here is the one that earns its keep. Operator icons are
 * data-driven (`filterOperatorOptions[].iconName`), and an operator naming an
 * icon the grid has no case for renders an empty box rather than failing -
 * which is exactly how `op-between` shipped blank. `GridIconName` makes that a
 * compile error now, and this makes it a test failure too, so it also catches
 * an operator added through a path that skips type-checking.
 */
import { describe, expect, it } from 'vitest'
import { GRID_ICON_GLYPHS, GRID_ICON_NAMES, type GridIconName } from './grid-icons'
import { filterOperatorOptions } from './filter-operators'

describe('grid icon catalogue', () => {
  it('lists every name exactly once', () => {
    const dupes = GRID_ICON_NAMES.filter((n, i) => GRID_ICON_NAMES.indexOf(n) !== i)
    expect(dupes, `duplicated icon names: ${dupes.join(', ')}`).toEqual([])
  })

  it('only maps glyphs for names in the catalogue', () => {
    const orphans = Object.keys(GRID_ICON_GLYPHS).filter(
      (k) => !GRID_ICON_NAMES.includes(k as GridIconName),
    )
    expect(orphans, `glyphs for unknown icons: ${orphans.join(', ')}`).toEqual([])
  })

  it('has a name for every filter operator icon', () => {
    const missing = filterOperatorOptions
      .map((o) => o.iconName)
      .filter((n) => !GRID_ICON_NAMES.includes(n))
    expect(missing, `operators naming an icon the grid cannot draw: ${missing.join(', ')}`).toEqual(
      [],
    )
  })

  it('keeps the pin icons separate from the operator icons they look like', () => {
    // Pin used to render `op-startsWith` / `op-greaterThan` / `x` directly, so
    // overriding a filter operator silently repainted the pin menu. Same
    // default glyphs, different names.
    for (const name of ['pin-left', 'pin-right', 'unpin'] as const) {
      expect(GRID_ICON_NAMES).toContain(name)
    }
  })
})
