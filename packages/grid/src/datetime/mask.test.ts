import { describe, expect, it } from 'vitest'
import { applyMask, unmask, isMaskComplete } from './mask'

describe('applyMask', () => {
  it('formats a phone pattern, inserting literals', () => {
    expect(applyMask('1234567890', '(###) ###-####').formatted).toBe('(123) 456-7890')
    expect(applyMask('123', '(###) ###-####').formatted).toBe('(123')
    expect(applyMask('1234', '(###) ###-####').formatted).toBe('(123) 4')
  })
  it('drops chars that do not fit the token', () => {
    expect(applyMask('12ab34', '####').formatted).toBe('1234')
    expect(applyMask('ab12', 'AA##').formatted).toBe('ab12')
    // *### : '*' takes 'a', then the three '#' take the digits, skipping 'b'.
    expect(applyMask('a1b2', '*###').formatted).toBe('a12')
  })
  it('* accepts letter or digit', () => {
    expect(applyMask('a1', '**').formatted).toBe('a1')
  })
  it('empty input yields empty', () => {
    expect(applyMask('', '(###)').formatted).toBe('')
  })
})

describe('unmask', () => {
  it('returns only data characters', () => {
    expect(unmask('(123) 456-7890', '(###) ###-####')).toBe('1234567890')
    expect(unmask('ab-12', 'AA-##')).toBe('ab12')
  })
})

describe('isMaskComplete', () => {
  it('true only when every token is filled', () => {
    expect(isMaskComplete('(123) 456-7890', '(###) ###-####')).toBe(true)
    expect(isMaskComplete('(123) 456', '(###) ###-####')).toBe(false)
  })
})
