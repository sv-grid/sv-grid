/**
 * Tests for the declarative validation-rule library: each builder skips empty
 * values (except required), enforces its constraint, honors a custom message,
 * and cross-field compare reads sibling values. runRules returns the first error.
 */
import { describe, expect, it } from 'vitest'
import { rules, runRules, isEmptyValue } from './validators'

describe('validators', () => {
  it('required flags empty values only', () => {
    const r = rules.required()
    expect(r('')).toBeTruthy()
    expect(r(null)).toBeTruthy()
    expect(r([])).toBeTruthy()
    expect(r('x')).toBeNull()
    expect(isEmptyValue([])).toBe(true)
  })

  it('format rules pass when empty, fail on bad input', () => {
    expect(rules.email()('')).toBeNull()
    expect(rules.email()('nope')).toBeTruthy()
    expect(rules.email()('a@b.co')).toBeNull()
    expect(rules.url()('example.com')).toBeNull()
    expect(rules.pattern(/^\d+$/)('12a')).toBeTruthy()
    expect(rules.zipCode()('90210')).toBeNull()
  })

  it('numeric ranges + lengths', () => {
    expect(rules.min(10)(5)).toBeTruthy()
    expect(rules.max(10)(11)).toBeTruthy()
    expect(rules.range(1, 5)(3)).toBeNull()
    expect(rules.range(1, 5)(9)).toBeTruthy()
    expect(rules.minLength(3)('ab')).toBeTruthy()
    expect(rules.stringLength(2, 4)('abc')).toBeNull()
    expect(rules.integer()(3.5)).toBeTruthy()
    expect(rules.oneOf(['a', 'b'])('c')).toBeTruthy()
  })

  it('compare reads a sibling field', () => {
    const r = rules.compare('password')
    expect(r('x', { password: 'x' })).toBeNull()
    expect(r('y', { password: 'x' })).toBeTruthy()
    expect(rules.compare('age', '>')(20, { age: 18 })).toBeNull()
  })

  it('custom message overrides the default', () => {
    expect(rules.required({ message: 'Pick one' })('')).toBe('Pick one')
    expect(rules.min(5, { message: 'too small' })(1)).toBe('too small')
  })

  it('runRules returns the first failing message in order', () => {
    const list = [rules.required(), rules.minLength(4), rules.pattern(/[A-Z]/, { message: 'needs a capital' })]
    expect(runRules('', list)).toBe('This field is required')
    expect(runRules('ab', list)).toContain('at least 4')
    expect(runRules('abcd', list)).toBe('needs a capital')
    expect(runRules('Abcd', list)).toBeNull()
  })
})
