/**
 * Per-country phone length validation (phoneDigitsValid): exact lengths, ranges,
 * unknown countries (any non-empty), and empty handling.
 */
import { describe, expect, it } from 'vitest'
import { phoneDigitsValid } from './countries'

describe('phoneDigitsValid', () => {
  it('checks exact national lengths', () => {
    expect(phoneDigitsValid('US', '4155551234')).toBe(true) // 10
    expect(phoneDigitsValid('US', '415555')).toBe(false)
    expect(phoneDigitsValid('IN', '9876543210')).toBe(true) // 10
    expect(phoneDigitsValid('SG', '81234567')).toBe(true) // 8
    expect(phoneDigitsValid('SG', '8123456')).toBe(false)
  })
  it('accepts ranges', () => {
    expect(phoneDigitsValid('DE', '1701234567')).toBe(true) // 10 in [10,11]
    expect(phoneDigitsValid('DE', '17012345678')).toBe(true) // 11
    expect(phoneDigitsValid('DE', '170')).toBe(false)
  })
  it('ignores non-digits and unknown countries', () => {
    expect(phoneDigitsValid('US', '(415) 555-1234')).toBe(true)
    expect(phoneDigitsValid('ZZ', '12345')).toBe(true) // unknown -> any non-empty
    expect(phoneDigitsValid('ZZ', '')).toBe(false)
  })
})
