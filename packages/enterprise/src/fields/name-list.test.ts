/**
 * Names joined into one line for a copy, and split back for a paste: a name
 * with a comma or a quote survives the round trip.
 */
import { describe, expect, it } from 'vitest'
import { joinNames, quoteName, splitNames } from './name-list'

describe('name lists', () => {
  it('quote only a name with a comma or a double quote', () => {
    expect(quoteName('Acme')).toBe('Acme')
    expect(quoteName('Acme, Inc.')).toBe('"Acme, Inc."')
    expect(quoteName('The "Big" Shop')).toBe('"The ""Big"" Shop"')
    expect(joinNames(['Northwind', 'Acme, Inc.'])).toBe('Northwind, "Acme, Inc."')
  })

  it('split at commas outside quotes, trimmed, empty parts left out', () => {
    expect(splitNames('Northwind, Acme')).toEqual(['Northwind', 'Acme'])
    expect(splitNames('Northwind, "Acme, Inc." , ,Beta,')).toEqual(['Northwind', 'Acme, Inc.', 'Beta'])
    expect(splitNames('"The ""Big"" Shop"')).toEqual(['The "Big" Shop'])
    expect(splitNames('5" pipe, x')).toEqual(['5" pipe', 'x'])
    expect(splitNames('"unclosed, still one')).toEqual(['unclosed, still one'])
    expect(splitNames('')).toEqual([])
  })

  it('round-trip whatever names they are given', () => {
    const names = ['Acme, Inc.', 'The "Big" Shop', 'Plain', '"quoted"', 'a,b,c']
    expect(splitNames(joinNames(names))).toEqual(names)
  })
})
