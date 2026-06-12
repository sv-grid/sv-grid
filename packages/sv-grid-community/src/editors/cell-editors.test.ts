import { describe, expect, it } from 'vitest'
import { parseEditorValue } from './cell-editors'

describe('parseEditorValue - number', () => {
  it('parses a valid string', () => {
    expect(parseEditorValue('number', '42')).toBe(42)
  })
  it('parses a numeric value as-is', () => {
    expect(parseEditorValue('number', 42)).toBe(42)
  })
  it('returns null for non-numeric input', () => {
    expect(parseEditorValue('number', 'bad')).toBe(null)
    expect(parseEditorValue('number', NaN)).toBe(null)
  })
  it('returns null for Infinity', () => {
    expect(parseEditorValue('number', Infinity)).toBe(null)
  })
  it('handles empty string as null', () => {
    expect(parseEditorValue('number', '')).toBe(0)
  })
})

describe('parseEditorValue - date', () => {
  it('returns an ISO string for a valid date', () => {
    const result = parseEditorValue('date', '2026-01-01')
    expect(typeof result).toBe('string')
    expect(String(result)).toContain('2026-01-01')
  })
  it('returns null for an unparseable string', () => {
    expect(parseEditorValue('date', 'not-a-date')).toBe(null)
  })
  it('accepts a Date object via its string form', () => {
    const result = parseEditorValue('date', new Date('2026-05-30T00:00:00Z'))
    expect(String(result)).toContain('2026-05-30')
  })
})

describe('parseEditorValue - datetime', () => {
  it('returns an ISO string for a valid datetime input', () => {
    const result = parseEditorValue('datetime', '2026-01-01T10:30')
    expect(typeof result).toBe('string')
    expect(String(result)).toContain('2026-01-01')
  })
  it('returns null for invalid datetime input', () => {
    expect(parseEditorValue('datetime', 'bogus')).toBe(null)
  })
})

describe('parseEditorValue - checkbox', () => {
  it('returns booleans as-is', () => {
    expect(parseEditorValue('checkbox', true)).toBe(true)
    expect(parseEditorValue('checkbox', false)).toBe(false)
  })
  it('parses "true"/"false" strings case-insensitively', () => {
    expect(parseEditorValue('checkbox', 'true')).toBe(true)
    expect(parseEditorValue('checkbox', 'TRUE')).toBe(true)
    expect(parseEditorValue('checkbox', 'false')).toBe(false)
    expect(parseEditorValue('checkbox', 'False')).toBe(false)
  })
  it('treats other strings as false', () => {
    expect(parseEditorValue('checkbox', 'yes')).toBe(false)
    expect(parseEditorValue('checkbox', '1')).toBe(false)
    expect(parseEditorValue('checkbox', '')).toBe(false)
  })
  it('coerces numbers via String() (non-"true" → false)', () => {
    expect(parseEditorValue('checkbox', 1)).toBe(false)
    expect(parseEditorValue('checkbox', 0)).toBe(false)
  })
})

describe('parseEditorValue - text (default)', () => {
  it('returns the string form of a value', () => {
    expect(parseEditorValue('text', 'hello')).toBe('hello')
    expect(parseEditorValue('text', 42)).toBe('42')
  })
  it('coerces null/undefined to empty string', () => {
    expect(parseEditorValue('text', null)).toBe('')
    expect(parseEditorValue('text', undefined)).toBe('')
  })
})
