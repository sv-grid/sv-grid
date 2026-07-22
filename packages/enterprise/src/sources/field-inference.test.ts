import { describe, it, expect } from 'vitest'
import { refineField } from './field-inference'
import type { EntityField } from '../schema'

const f = (field: string, type: EntityField['type'] = 'text', extra: Partial<EntityField> = {}): EntityField =>
  ({ field, type, ...extra })

describe('refineField', () => {
  it('infers formats + editors from text column names', () => {
    expect(refineField(f('email')).format).toBe('email')
    expect(refineField(f('contact_email')).format).toBe('email')
    expect(refineField(f('website')).format).toBe('url')
    expect(refineField(f('phone')).input?.editorType).toBe('phone')
    expect(refineField(f('mobile_number')).input?.editorType).toBe('phone')
    expect(refineField(f('country')).input?.editorType).toBe('country')
    expect(refineField(f('brand_color')).input?.editorType).toBe('color')
  })

  it('masks structured codes with the right pattern', () => {
    expect(refineField(f('ssn')).input).toMatchObject({ editorType: 'mask', mask: '###-##-####' })
    expect(refineField(f('vin')).input?.mask).toBe('*****************')
    expect(refineField(f('license_plate')).input?.mask).toBe('AAA-####')
    expect(refineField(f('isbn')).input?.mask).toBe('###-#-#####-###-#')
    expect(refineField(f('zip')).input?.mask).toBe('#####')
    expect(refineField(f('tax_id')).input?.mask).toBe('##-#######')
  })

  it('routes password fields to a hidden-from-grid password editor', () => {
    const r = refineField(f('password'))
    expect(r.input?.editorType).toBe('password')
    expect(r.hidden).toEqual({ grid: true })
  })

  it('infers rating / slider from numeric column names', () => {
    expect(refineField(f('rating', 'number')).input?.editorType).toBe('rating')
    expect(refineField(f('csat', 'number')).input?.editorType).toBe('rating')
    expect(refineField(f('progress', 'number')).input?.editorType).toBe('slider')
    expect(refineField(f('fuel_level', 'number')).input?.editorType).toBe('slider')
  })

  it('does NOT add range validation (must not reject existing data)', () => {
    const r = refineField(f('rating', 'number'))
    expect(r.min).toBeUndefined()
    expect(r.max).toBeUndefined()
  })

  it('leaves keys, relations, enums, and explicit editors untouched', () => {
    expect(refineField(f('phone', 'text', { primaryKey: true })).input).toBeUndefined()
    expect(refineField(f('email', 'text', { readonly: true })).format).toBeUndefined()
    expect(refineField({ field: 'ownerId', type: 'relation', relation: { entity: 'users', labelField: 'name' } }).input).toBeUndefined()
    expect(refineField(f('country', 'enum', { options: [{ value: 'us', label: 'US' }] })).input).toBeUndefined()
    const explicit = f('phone', 'text', { input: { editorType: 'mask', mask: '###' } })
    expect(refineField(explicit).input).toEqual({ editorType: 'mask', mask: '###' })
  })

  it('leaves an ordinary field alone', () => {
    expect(refineField(f('description'))).toEqual(f('description'))
    expect(refineField(f('quantity', 'number'))).toEqual(f('quantity', 'number'))
  })
})
