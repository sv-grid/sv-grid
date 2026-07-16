import { describe, it, expect } from 'vitest'
import { generateValue, generateRows } from './sample-data.js'
import type { EntityField } from '../schema.js'

const f = (over: Partial<EntityField>): EntityField => ({ field: 'x', type: 'text', ...over } as EntityField)

describe('generateValue - realistic, field-name aware', () => {
  it('emails look like emails, derived from a person', () => {
    const v = generateValue(f({ field: 'email', type: 'text' }), 0)
    expect(String(v)).toMatch(/^[a-z.]+@[a-z.]+$/)
  })

  it('name fields get a full person name (not "name 1")', () => {
    const v = String(generateValue(f({ field: 'name', type: 'text' }), 0))
    expect(v).toMatch(/^\w+ [\w-]+/)
    expect(v).not.toMatch(/\bname 1\b/i)
  })

  it('company-ish fields get a company', () => {
    expect(['company', 'vendor', 'client', 'organization'].every((n) => /[A-Z]/.test(String(generateValue(f({ field: n }), 1))))).toBe(true)
  })

  it('currency-ish numbers use realistic amounts, not i*25', () => {
    const total = generateValue(f({ field: 'total', type: 'number' }), 0)
    expect(typeof total).toBe('number')
    expect(total).toBeGreaterThan(50)
  })

  it('quantity-ish numbers stay small', () => {
    const qty = generateValue(f({ field: 'quantity', type: 'number' }), 3) as number
    expect(qty).toBeGreaterThan(0)
    expect(qty).toBeLessThanOrEqual(50)
  })

  it('enum/options fields cycle their options', () => {
    const field = f({ field: 'status', type: 'enum', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] })
    expect(generateValue(field, 0)).toBe('a')
    expect(generateValue(field, 1)).toBe('b')
    expect(generateValue(field, 2)).toBe('a')
  })

  it('dates are ISO; datetime carries time', () => {
    expect(String(generateValue(f({ field: 'created', type: 'date' }), 0))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(String(generateValue(f({ field: 'created', type: 'datetime' }), 0))).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('is deterministic across calls', () => {
    const a = generateValue(f({ field: 'name' }), 2)
    const b = generateValue(f({ field: 'name' }), 2)
    expect(a).toBe(b)
  })

  it('generateRows fills every field', () => {
    const rows = generateRows([f({ field: 'id', type: 'number' }), f({ field: 'name' }), f({ field: 'email' })], 4)
    expect(rows).toHaveLength(4)
    expect(Object.keys(rows[0]!)).toEqual(['id', 'name', 'email'])
  })
})
