/**
 * Tests for the option-list helpers, focused on `flattenForVirtual` - the pure
 * model that lets the selection controls window a GROUPED list and mix row
 * heights, reusing the shared virtualizer.
 */
import { describe, expect, it } from 'vitest'
import { flattenForVirtual, normalizeOptions, type ListOption } from './list-option'

describe('flattenForVirtual', () => {
  it('passes an ungrouped list through as option rows (uniform height)', () => {
    const options = normalizeOptions([1, 2, 3])
    const m = flattenForVirtual(options, { rowHeight: 32 })
    expect(m.hasGroups).toBe(false)
    expect(m.entries).toHaveLength(3)
    expect(m.entries.every((e) => e.type === 'option')).toBe(true)
    expect(m.entries.map((e) => e.size)).toEqual([32, 32, 32])
    // Ungrouped: option index === flat index.
    expect(m.optionFlatIndex).toEqual([0, 1, 2])
    expect(m.sizeAt(1)).toBe(32)
  })

  it('interleaves group heading rows and keeps option->flat mapping', () => {
    const options: ListOption[] = [
      { value: 'a', label: 'A', group: 'G1' },
      { value: 'b', label: 'B', group: 'G1' },
      { value: 'c', label: 'C', group: 'G2' },
    ]
    const m = flattenForVirtual(options, { rowHeight: 30, groupHeaderHeight: 20 })
    expect(m.hasGroups).toBe(true)
    // [G1 header, a, b, G2 header, c]
    expect(m.entries.map((e) => e.type)).toEqual(['group', 'option', 'option', 'group', 'option'])
    expect(m.entries.map((e) => e.size)).toEqual([20, 30, 30, 20, 30])
    // Option indices 0,1,2 land at flat rows 1,2,4.
    expect(m.optionFlatIndex).toEqual([1, 2, 4])
    expect(m.entries[0]).toMatchObject({ type: 'group', label: 'G1' })
  })

  it('supports a per-option variable height function', () => {
    const options = normalizeOptions(['x', 'y', 'z'])
    const m = flattenForVirtual(options, { rowHeight: (_opt, i) => 20 + i * 10 })
    expect(m.entries.map((e) => e.size)).toEqual([20, 30, 40])
    expect(m.sizeAt(2)).toBe(40)
  })

  it('clamps non-positive heights to at least 1px', () => {
    const options = normalizeOptions(['x'])
    const m = flattenForVirtual(options, { rowHeight: 0, groupHeaderHeight: 0 })
    expect(m.sizeAt(0)).toBe(1)
  })

  it('is empty for no options', () => {
    const m = flattenForVirtual([], { rowHeight: 32 })
    expect(m.entries).toEqual([])
    expect(m.optionFlatIndex).toEqual([])
  })
})
