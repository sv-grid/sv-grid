import { describe, expect, it } from 'vitest'
import { sanitizeOtp, otpCells, isOtpComplete } from './otp'

describe('sanitizeOtp', () => {
  it('keeps only digits in numeric mode and clamps to length', () => {
    expect(sanitizeOtp('12ab34-56', 4, true)).toBe('1234')
  })
  it('keeps non-whitespace in text mode', () => {
    expect(sanitizeOtp('a b\tc d', 3, false)).toBe('abc')
  })
  it('clamps to length', () => {
    expect(sanitizeOtp('123456789', 6, true)).toBe('123456')
  })
})

describe('otpCells', () => {
  it('pads to exactly length cells', () => {
    expect(otpCells('12', 4)).toEqual(['1', '2', '', ''])
  })
})

describe('isOtpComplete', () => {
  it('is true only when every cell is filled', () => {
    expect(isOtpComplete('1234', 4)).toBe(true)
    expect(isOtpComplete('12', 4)).toBe(false)
    expect(isOtpComplete('', 4)).toBe(false)
  })
})
