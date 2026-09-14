import { describe, expect, it } from 'vitest'
import {
  createFormatStore, entryToStyle, type CellAddressLookup,
} from './format-store'
import { createNames, isValidName } from './names'

/** Display index -> stable id. Reversing this mapping is how a sort is
 *  simulated: same indices, different ids underneath. */
function lookup(rowIds: string[], colIds: string[]): CellAddressLookup {
  return {
    rowIdAt: (i) => rowIds[i] ?? null,
    columnIdAt: (i) => colIds[i] ?? null,
  }
}

const at = lookup(['r1', 'r2', 'r3'], ['a', 'b', 'c'])

describe('format store', () => {
  it('starts empty', () => {
    expect(createFormatStore().size).toBe(0)
  })

  it('sets and reads one cell', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true }, at)
    expect(s.get('r1', 'a')).toEqual({ bold: true })
    expect(s.get('r1', 'b')).toBeUndefined()
  })

  it('applies across a rectangle', () => {
    const s = createFormatStore()
    s.set([[0, 0, 1, 1]], { numFmt: '0.00' }, at)
    expect(s.size).toBe(4)
    expect(s.get('r2', 'b')?.numFmt).toBe('0.00')
  })

  it('merges rather than replacing', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true }, at)
    s.set([[0, 0, 0, 0]], { italic: true }, at)
    expect(s.get('r1', 'a')).toEqual({ bold: true, italic: true })
  })

  it('survives a sort, because it keys on row id not index', () => {
    // The bug this exists to avoid: demo 27 keys by display index, so sorting
    // moves every bold cell to whatever row now sits at that index.
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true }, at)
    const sorted = lookup(['r3', 'r1', 'r2'], ['a', 'b', 'c'])
    // r1 is now at display row 1. The formatting followed it.
    expect(s.get(sorted.rowIdAt(1)!, 'a')).toEqual({ bold: true })
    expect(s.get(sorted.rowIdAt(0)!, 'a')).toBeUndefined()
  })

  it('survives a column reorder too', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { fill: '#eee' }, at)
    const moved = lookup(['r1', 'r2', 'r3'], ['c', 'a', 'b'])
    expect(s.get('r1', moved.columnIdAt(1)!)).toEqual({ fill: '#eee' })
  })

  it('ignores a rect outside the grid', () => {
    const s = createFormatStore()
    s.set([[0, 0, 9, 9]], { bold: true }, at)
    expect(s.size).toBe(9)
  })

  it('removes one field with an explicit undefined', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true, numFmt: '0.00' }, at)
    s.set([[0, 0, 0, 0]], { bold: undefined }, at)
    expect(s.get('r1', 'a')).toEqual({ numFmt: '0.00' })
  })

  it('drops an entry once its last field goes, rather than keeping {}', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true }, at)
    s.set([[0, 0, 0, 0]], { bold: undefined }, at)
    expect(s.get('r1', 'a')).toBeUndefined()
    expect(s.size).toBe(0)
  })

  it('clears a range', () => {
    const s = createFormatStore()
    s.set([[0, 0, 2, 2]], { bold: true }, at)
    s.clear([[0, 0, 0, 2]], at)
    expect(s.size).toBe(6)
    expect(s.get('r1', 'a')).toBeUndefined()
  })
})

describe('toggle', () => {
  it('turns a uniform range off', () => {
    const s = createFormatStore()
    s.set([[0, 0, 1, 0]], { bold: true }, at)
    s.toggle([[0, 0, 1, 0]], 'bold', at)
    expect(s.get('r1', 'a')?.bold).toBeUndefined()
    expect(s.get('r2', 'a')?.bold).toBeUndefined()
  })

  it('turns a MIXED range on, which is what users expect', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true }, at)
    s.toggle([[0, 0, 1, 0]], 'bold', at)
    expect(s.get('r1', 'a')?.bold).toBe(true)
    expect(s.get('r2', 'a')?.bold).toBe(true)
  })

  it('turns an unformatted range on', () => {
    const s = createFormatStore()
    s.toggle([[0, 0, 0, 0]], 'italic', at)
    expect(s.get('r1', 'a')?.italic).toBe(true)
  })

  it('leaves other fields alone when toggling off', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true, numFmt: '0.00' }, at)
    s.toggle([[0, 0, 0, 0]], 'bold', at)
    expect(s.get('r1', 'a')).toEqual({ numFmt: '0.00' })
  })

  it('does not double-apply where two ranges overlap', () => {
    const s = createFormatStore()
    s.toggle([[0, 0, 0, 0], [0, 0, 0, 1]], 'bold', at)
    expect(s.get('r1', 'a')?.bold).toBe(true)
    expect(s.get('r1', 'b')?.bold).toBe(true)
  })
})

describe('forgetting', () => {
  it('drops every entry for a deleted row', () => {
    // Without this the store leaks one entry per removed row for the life of
    // the session.
    const s = createFormatStore()
    s.set([[0, 0, 1, 2]], { bold: true }, at)
    s.forgetRow('r1')
    expect(s.size).toBe(3)
    expect(s.get('r1', 'a')).toBeUndefined()
    expect(s.get('r2', 'a')).toBeDefined()
  })

  it('drops every entry for a deleted column', () => {
    const s = createFormatStore()
    s.set([[0, 0, 2, 1]], { bold: true }, at)
    s.forgetColumn('a')
    expect(s.size).toBe(3)
    expect(s.get('r1', 'b')).toBeDefined()
  })
})

describe('persistence', () => {
  it('round-trips through serialize and hydrate', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 1]], { bold: true, numFmt: '0%' }, at)
    const snapshot = s.serialize()

    const restored = createFormatStore(snapshot)
    expect(restored.get('r1', 'a')).toEqual({ bold: true, numFmt: '0%' })
    expect(restored.size).toBe(2)
  })

  it('replaces rather than merging on hydrate', () => {
    const s = createFormatStore()
    s.set([[0, 0, 0, 0]], { bold: true }, at)
    s.hydrate({})
    expect(s.size).toBe(0)
  })
})

describe('entryToStyle', () => {
  it('renders nothing for no entry', () => {
    expect(entryToStyle(undefined)).toBe('')
    expect(entryToStyle({})).toBe('')
  })

  it('renders each field', () => {
    expect(entryToStyle({ bold: true })).toContain('font-weight:700')
    expect(entryToStyle({ italic: true })).toContain('font-style:italic')
    expect(entryToStyle({ color: 'red' })).toContain('color:red')
    expect(entryToStyle({ fill: '#eee' })).toContain('background:#eee')
    expect(entryToStyle({ align: 'right' })).toContain('text-align:right')
    expect(entryToStyle({ fontSize: 14 })).toContain('font-size:14px')
    expect(entryToStyle({ indent: 2 })).toContain('padding-left:24px')
  })

  it('combines underline and strike into one declaration', () => {
    // Two text-decoration declarations would have the second win, dropping
    // the underline.
    const style = entryToStyle({ underline: true, strike: true })
    expect(style).toContain('text-decoration:underline line-through')
    expect(style.match(/text-decoration/g)).toHaveLength(1)
  })
})

describe('defined names', () => {
  it('accepts a reasonable name', () => {
    expect(isValidName('Tax')).toBe(true)
    expect(isValidName('_total')).toBe(true)
    expect(isValidName('Q1.Sales')).toBe(true)
  })

  it('rejects anything that reads as a CELL reference', () => {
    // A name like A1 would make every formula containing it ambiguous.
    expect(isValidName('A1')).toBe(false)
    expect(isValidName('$A$1')).toBe(false)
    expect(isValidName('TRUE')).toBe(false)
  })

  it('reserves R and C, which Excel uses for R1C1 notation', () => {
    expect(isValidName('R')).toBe(false)
    expect(isValidName('C')).toBe(false)
    // But a longer word that happens to be a valid column label is fine: the
    // tokenizer only reads a word as a column when it is qualified.
    expect(isValidName('Tax')).toBe(true)
    expect(isValidName('ABC')).toBe(true)
  })

  it('rejects a name that does not start with a letter or underscore', () => {
    expect(isValidName('1st')).toBe(false)
    expect(isValidName('')).toBe(false)
    expect(isValidName('has space')).toBe(false)
  })

  it('defines and resolves', () => {
    const names = createNames()
    names.define('Tax', '=$B$1')
    expect(names.has('Tax')).toBe(true)
    expect(names.resolve('Tax')).toMatchObject({ k: 'ref' })
  })

  it('is case insensitive but keeps the case it was defined with', () => {
    const names = createNames()
    names.define('Tax', '=$B$1')
    expect(names.has('TAX')).toBe(true)
    expect(names.list()[0]!.name).toBe('Tax')
  })

  it('resolves a range name', () => {
    const names = createNames()
    names.define('Prices', '=$A$1:$C$9')
    expect(names.resolve('Prices')).toMatchObject({ k: 'range' })
  })

  it('returns null for an unknown or unparseable name', () => {
    const names = createNames()
    names.define('Broken', '=SUM(')
    expect(names.resolve('Broken')).toBeNull()
    expect(names.resolve('Nope')).toBeNull()
  })

  it('throws with a useful message on an invalid name', () => {
    expect(() => createNames().define('A1', '=$B$1')).toThrow(/not a valid defined name/)
  })

  it('removes', () => {
    const names = createNames()
    names.define('Tax', '=$B$1')
    names.remove('TAX')
    expect(names.has('Tax')).toBe(false)
  })

  it('lists alphabetically', () => {
    const names = createNames()
    names.define('Zeta', '=$A$1')
    names.define('Alpha', '=$A$2')
    expect(names.list().map((n) => n.name)).toEqual(['Alpha', 'Zeta'])
  })

  it('round-trips through serialize and hydrate', () => {
    const names = createNames({ Tax: '=$B$1', Rate: '=$B$2' })
    expect(names.list()).toHaveLength(2)
    expect(createNames(names.serialize()).has('Tax')).toBe(true)
  })

  it('drops an invalid name on hydrate rather than throwing', () => {
    // Hydration comes from saved state, which may predate the rules.
    const names = createNames({ Tax: '=$B$1', A1: '=$B$2' })
    expect(names.list()).toHaveLength(1)
  })
})
