import { describe, expect, it } from 'vitest'
import { defaultGridMessages, resolveGridMessages } from './grid-messages'

describe('resolveGridMessages', () => {
  it('returns the full English defaults when no overrides are given', () => {
    expect(resolveGridMessages()).toEqual(defaultGridMessages)
    expect(resolveGridMessages(null)).toEqual(defaultGridMessages)
    expect(resolveGridMessages({})).toEqual(defaultGridMessages)
  })

  it('names the client group expander, so a localized grid has no English left in it', () => {
    const m = resolveGridMessages({ expandGroup: 'Gruppe aufklappen', rowsSuffix: 'Zeilen' })
    expect(m.expandGroup).toBe('Gruppe aufklappen')
    expect(m.collapseGroup).toBe('Collapse group')
    expect(m.rowsSuffix).toBe('Zeilen')
  })

  it('replaces only the provided keys, keeping English for the rest', () => {
    const m = resolveGridMessages({ noRows: 'Aucune ligne', pageSize: 'Taille :' })
    expect(m.noRows).toBe('Aucune ligne')
    expect(m.pageSize).toBe('Taille :')
    // untouched keys stay English
    expect(m.columns).toBe('Columns')
    expect(m.opContains).toBe('Contains')
  })

  it('falls back to the default for empty-string overrides', () => {
    const m = resolveGridMessages({ noRows: '' })
    expect(m.noRows).toBe(defaultGridMessages.noRows)
  })
})
