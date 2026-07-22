import { describe, expect, it } from 'vitest'
import { parseDuration, formatDuration } from './duration'

describe('parseDuration', () => {
  it('parses h:mm', () => {
    expect(parseDuration('1:30')).toBe(90)
    expect(parseDuration('0:05')).toBe(5)
  })
  it('rejects invalid minutes in h:mm', () => {
    expect(parseDuration('1:75')).toBeNull()
  })
  it('parses unit form incl. decimals', () => {
    expect(parseDuration('1h 30m')).toBe(90)
    expect(parseDuration('1.5h')).toBe(90)
    expect(parseDuration('45m')).toBe(45)
  })
  it('treats a bare number as minutes', () => {
    expect(parseDuration('90')).toBe(90)
  })
  it('returns null for empty / garbage', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('1h banana')).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats colon style', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(5)).toBe('0:05')
  })
  it('formats unit style', () => {
    expect(formatDuration(90, 'units')).toBe('1h 30m')
    expect(formatDuration(60, 'units')).toBe('1h')
    expect(formatDuration(45, 'units')).toBe('45m')
  })
  it('returns empty for invalid input', () => {
    expect(formatDuration(-1)).toBe('')
    expect(formatDuration(NaN)).toBe('')
  })
})
