import { describe, expect, it } from 'vitest'
import type { EntitySchema, StandardSchemaV1 } from './schema'
import {
  buildInitialValues,
  controlKind,
  editMode,
  rowId,
  toSubmitValues,
  validateAll,
} from './edit-panel'

type Customer = {
  id: string
  name: string
  age: number
  active: boolean
  tier: string
  bio: string
}

const email: StandardSchemaV1<string, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (v) =>
      typeof v === 'string' && v.includes('@') ? { value: v } : { issues: [{ message: 'Invalid email' }] },
  },
}

const schema: EntitySchema<Customer> = {
  name: 'customers',
  label: 'Customer',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, validate: email },
    { field: 'age', type: 'number', defaultValue: 18 },
    { field: 'active', type: 'boolean' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { field: 'bio', type: 'json', input: { span: 2 } },
  ],
}

describe('editMode', () => {
  it('is create without a row, edit with one', () => {
    expect(editMode(null)).toBe('create')
    expect(editMode(undefined)).toBe('create')
    expect(editMode({ id: '1' } as Customer)).toBe('edit')
  })
})

describe('controlKind', () => {
  it('maps editor types to controls', () => {
    expect(controlKind({ editorType: 'checkbox' })).toBe('checkbox')
    expect(controlKind({ editorType: 'number' })).toBe('number')
    expect(controlKind({ editorType: 'date' })).toBe('date')
    expect(controlKind({ editorType: 'datetime' })).toBe('datetime')
    expect(controlKind({ editorType: 'select' })).toBe('select')
    expect(controlKind({ editorType: 'list' })).toBe('select')
    expect(controlKind({ editorType: 'textarea' })).toBe('textarea')
    expect(controlKind({ editorType: 'text' })).toBe('text')
    expect(controlKind({ editorType: 'autocomplete' })).toBe('text')
  })
})

describe('buildInitialValues', () => {
  it('seeds from defaults and type-appropriate empties in create mode', () => {
    const v = buildInitialValues(schema, null)
    expect(v).toEqual({ id: '', name: '', age: 18, active: false, tier: '', bio: '' })
  })

  it('seeds from the row in edit mode', () => {
    const row: Customer = { id: '7', name: 'a@b.com', age: 40, active: true, tier: 'pro', bio: 'hi' }
    expect(buildInitialValues(schema, row)).toEqual(row)
  })
})

describe('validateAll', () => {
  it('flags a required-but-empty field with a friendly message', async () => {
    const errors = await validateAll(schema, buildInitialValues(schema, null))
    expect(errors.name).toBe('Name is required')
  })

  it('runs the Standard Schema validator when a value is present', async () => {
    const values = { ...buildInitialValues(schema, null), name: 'not-an-email' }
    const errors = await validateAll(schema, values)
    expect(errors.name).toBe('Invalid email')
  })

  it('passes a valid form (no readonly checks, no false positives)', async () => {
    const values = { ...buildInitialValues(schema, null), name: 'a@b.com' }
    expect(await validateAll(schema, values)).toEqual({})
  })

  it('never validates readonly fields', async () => {
    // id is readonly + empty; must not produce an error even though it looks empty
    const errors = await validateAll(schema, { ...buildInitialValues(schema, null), name: 'a@b.com' })
    expect(errors.id).toBeUndefined()
  })

  it('merges schema-level cross-field errors', async () => {
    const withCross: EntitySchema<Customer> = {
      ...schema,
      hooks: { validate: () => ({ name: 'blocked by rule', region: 'required together' }) },
    }
    // A per-field failure (missing name) is NOT overwritten by the cross-field rule,
    // but a cross-field-only error (region) is surfaced.
    const errors = await validateAll(withCross, buildInitialValues(withCross, null))
    expect(errors.name).toBe('Name is required') // per-field wins
    expect(errors.region).toBe('required together') // cross-field added
  })
})

describe('built-in validation (no external lib)', () => {
  type Row = { id: string; name: string; age: number; site: string; contact: string }
  const s: EntitySchema<Row> = {
    name: 'people',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text', minLength: 2, maxLength: 10 },
      { field: 'age', type: 'number', min: 0, max: 120 },
      { field: 'site', type: 'text', format: 'url' },
      { field: 'contact', type: 'text', format: 'email' },
    ],
  }
  const base = () => buildInitialValues(s, null)

  it('rejects a non-numeric number and enforces min/max', async () => {
    expect((await validateAll(s, { ...base(), age: 'abc' })).age).toMatch(/must be a number/)
    expect((await validateAll(s, { ...base(), age: '-5' })).age).toMatch(/at least 0/)
    expect((await validateAll(s, { ...base(), age: '200' })).age).toMatch(/at most 120/)
    expect((await validateAll(s, { ...base(), age: '30' })).age).toBeUndefined()
  })

  it('enforces string length', async () => {
    expect((await validateAll(s, { ...base(), name: 'x' })).name).toMatch(/at least 2/)
    expect((await validateAll(s, { ...base(), name: 'x'.repeat(20) })).name).toMatch(/at most 10/)
  })

  it('validates email and url formats', async () => {
    expect((await validateAll(s, { ...base(), contact: 'nope' })).contact).toMatch(/valid email/)
    expect((await validateAll(s, { ...base(), contact: 'a@b.co' })).contact).toBeUndefined()
    expect((await validateAll(s, { ...base(), site: 'ftp://x' })).site).toMatch(/valid URL/)
    expect((await validateAll(s, { ...base(), site: 'https://x.io' })).site).toBeUndefined()
  })

  it('skips built-in checks when the value is empty (that is what required is for)', async () => {
    expect((await validateAll(s, base())).age).toBeUndefined()
    expect((await validateAll(s, base())).contact).toBeUndefined()
  })
})

describe('toSubmitValues', () => {
  it('omits readonly fields and coerces number + boolean', () => {
    const values = { id: '7', name: 'a@b.com', age: '42', active: 'true', tier: 'pro', bio: 'x' }
    const out = toSubmitValues(schema, values)
    expect(out).toEqual({ name: 'a@b.com', age: 42, active: true, tier: 'pro', bio: 'x' })
    expect('id' in out).toBe(false)
  })

  it('turns an empty number into null', () => {
    const out = toSubmitValues(schema, { ...buildInitialValues(schema, null), age: '' })
    expect(out.age).toBeNull()
  })
})

describe('rowId', () => {
  it('resolves the primary key as a string', () => {
    expect(rowId(schema, { id: 99 } as unknown as Customer)).toBe('99')
  })
})
