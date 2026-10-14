/**
 * Changing a field to a link finds the records its names point at, and the
 * field editor's count says how many cells lose their value or part of it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { convertValue, countCleared } from './convert'
import { registerLinkedTable } from './sources.svelte'

const companies = [
  { id: 'c1', name: 'Northwind' },
  { id: 'c2', name: 'Acme, Inc.' },
  { id: 'c3', name: 'Globex' },
]
let forget = () => {}
afterEach(() => forget())
const register = () => (forget = registerLinkedTable({ id: 'companies', name: 'Companies', primaryField: 'name', rows: companies }))
const link = { table: 'companies', multiple: true }

describe('converting to a link', () => {
  it('a multiple select or a lookup links the records its names (or ids) point at', () => {
    register()
    expect(convertValue(['Northwind', 'acme, inc.'], 'multiSelect', 'link', link)).toEqual(['c1', 'c2'])
    expect(convertValue(['c3', 'Nobody'], 'lookup', 'link', link)).toEqual(['c3'])
    expect(convertValue(['Nobody'], 'multiSelect', 'link', link)).toEqual([])
    expect(convertValue(['Northwind', 'Globex'], 'multiSelect', 'link', { table: 'companies', multiple: false })).toEqual(['c1'])
  })

  it('text links the comma-separated names, a quoted name with a comma as one', () => {
    register()
    expect(convertValue('Globex, Northwind', 'text', 'link', link)).toEqual(['c3', 'c1'])
    expect(convertValue('"Acme, Inc.", Globex', 'text', 'link', link)).toEqual(['c2', 'c3'])
    expect(convertValue('Globex', 'singleSelect', 'link', link)).toEqual(['c3'])
  })

  it('without the linked table nothing links', () => {
    expect(convertValue(['Northwind'], 'multiSelect', 'link', { table: 'missing' })).toEqual([])
  })

  it('counts a cell left empty, and one that drops a name no record has', () => {
    register()
    const values = [['Northwind'], ['Nobody'], ['Globex', 'Nobody'], [], 'Northwind, Globex', 'nobody']
    // ['Nobody'] and 'nobody' clear; ['Globex', 'Nobody'] loses a name.
    expect(countCleared(values, 'multiSelect', 'link', link)).toBe(3)
    // A single link keeps one record of two.
    expect(countCleared([['Northwind', 'Globex']], 'multiSelect', 'link', { table: 'companies', multiple: false })).toBe(1)
  })
})

describe('converting to a single select', () => {
  it('keeps the first of several names, and the count says so', () => {
    expect(convertValue(['Northwind', 'Globex'], 'link', 'singleSelect')).toBe('Northwind')
    expect(countCleared([['Northwind', 'Globex'], ['Northwind'], ['Acme', 'Acme'], 'Plain'], 'link', 'singleSelect')).toBe(1)
  })
})
