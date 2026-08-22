import { describe, expect, it } from 'vitest'
import type { EntitySchema, StandardSchemaV1 } from './schema'
import {
  buildInitialValues,
  controlKind,
  editMode,
  evalValidationRules,
  fieldState,
  rowId,
  toSubmitValues,
  validateAll,
  toDateString,
  toDateTimeString,
  toNumberValue,
  fromNumberValue,
  toSliderValue,
  toTags,
  visibleFormFields,
} from './edit-panel'
import { schemaToFormFields, type FormFieldDescriptor } from './schema'

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

describe('editor value coercion', () => {
  it('formats a Date to a local yyyy-MM-dd (no UTC shift)', () => {
    // Local midnight - toISOString would shift the day in negative-offset zones; local formatting must not.
    const d = new Date(2024, 0, 2, 0, 0) // 2 Jan 2024, local
    expect(toDateString(d)).toBe('2024-01-02')
    expect(toDateString(null)).toBe('')
  })

  it('formats a Date to a local yyyy-MM-ddTHH:mm', () => {
    expect(toDateTimeString(new Date(2024, 2, 4, 9, 5))).toBe('2024-03-04T09:05')
    expect(toDateTimeString(null)).toBe('')
  })

  it('coerces numbers in/out with the empty-string convention', () => {
    expect(toNumberValue(1200)).toBe(1200)
    expect(toNumberValue('1200')).toBeNull() // strings are not numbers
    expect(toNumberValue(NaN)).toBeNull()
    expect(fromNumberValue(null)).toBe('')
    expect(fromNumberValue(0)).toBe(0) // 0 is a real value, not empty
  })

  it('slider falls back to min when unset', () => {
    expect(toSliderValue(42, 0)).toBe(42)
    expect(toSliderValue('', 10)).toBe(10)
    expect(toSliderValue(undefined, 5)).toBe(5)
  })

  it('coerces tags from arrays, comma strings, or empty', () => {
    expect(toTags(['a', 'b'])).toEqual(['a', 'b'])
    expect(toTags('a, b ,c')).toEqual(['a', 'b', 'c'])
    expect(toTags('')).toEqual([])
    expect(toTags(null)).toEqual([])
    expect(toTags([1, 2])).toEqual(['1', '2'])
  })
})

// --- the form builder: value-driven fields -----------------------------------

/** `field <op> value` as a serializable predicate leaf. */
const cmp = (column: string, op: string, value: unknown) =>
  ({ kind: 'cmp', column, op, value }) as never

type Order = { id: string; reason: string; other: string; total: number; approver: string }

const orders: EntitySchema<Order> = {
  name: 'orders',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'reason', type: 'enum', options: [{ value: 'damaged', label: 'Damaged' }, { value: 'other', label: 'Other' }] },
    // Only asked for, and only demanded, when the reason is "other".
    {
      field: 'other',
      type: 'text',
      when: { visible: cmp('reason', 'equals', 'other'), required: cmp('reason', 'equals', 'other') },
    },
    { field: 'total', type: 'number' },
    // Locked once the order is large enough to need sign-off.
    { field: 'approver', type: 'text', when: { disabled: cmp('total', 'lessThan', 1000) } },
  ],
}

describe('conditional fields', () => {
  const specOf = (name: string) => schemaToFormFields(orders).find((f) => f.field === name)!

  it('shows and demands a field only while its condition holds', () => {
    const hidden = fieldState(specOf('other'), { reason: 'damaged', other: '' })
    expect(hidden.visible).toBe(false)
    expect(hidden.required).toBe(false)

    const shown = fieldState(specOf('other'), { reason: 'other', other: '' })
    expect(shown.visible).toBe(true)
    expect(shown.required).toBe(true)
  })

  it('locks a field while its disabled condition holds, and readonly always wins', () => {
    expect(fieldState(specOf('approver'), { total: 10 }).disabled).toBe(true)
    expect(fieldState(specOf('approver'), { total: 5000 }).disabled).toBe(false)
    expect(fieldState(specOf('id'), { total: 5000 }).disabled).toBe(true)
  })

  it('lists only the fields the form is currently showing', () => {
    expect(visibleFormFields(orders, { reason: 'damaged' }).map((f) => f.field)).not.toContain('other')
    expect(visibleFormFields(orders, { reason: 'other' }).map((f) => f.field)).toContain('other')
  })

  it('never blocks a save on a field the user cannot see', async () => {
    // `other` is required-when-visible, but the reason is "damaged", so it is
    // neither shown nor demanded.
    expect(await validateAll(orders, { reason: 'damaged', other: '', total: 1 })).toEqual({})
    expect(await validateAll(orders, { reason: 'other', other: '', total: 1 })).toEqual({
      other: 'Other is required',
    })
  })

  it('leaves a hidden field out of the payload, so a stale value is never written', () => {
    const hidden = toSubmitValues(orders, { reason: 'damaged', other: 'stale text', total: 1, approver: '' })
    expect(hidden).not.toHaveProperty('other')
    const shown = toSubmitValues(orders, { reason: 'other', other: 'kept', total: 1, approver: '' })
    expect(shown.other).toBe('kept')
  })

  it('falls back to showing a field when its condition is malformed', () => {
    // A broken rule must never hide data or block a save.
    const broken: FormFieldDescriptor = {
      field: 'x', label: 'X', type: 'text', editorType: 'text',
      required: false, readonly: false, span: 1,
      when: { visible: { kind: 'nonsense' } as never },
    }
    expect(fieldState(broken, {}).visible).toBe(true)
    expect(fieldState(broken, {}).disabled).toBe(false)
  })
})

describe('no-code validation rules at runtime', () => {
  it('applies each operator the generated server applies', () => {
    const values = { name: 'ab', qty: 5, max: 3 }
    expect(evalValidationRules([{ field: 'name', op: 'minLen', value: 3, message: 'Too short' }], values))
      .toEqual({ name: 'Too short' })
    expect(evalValidationRules([{ field: 'name', op: 'minLen', value: 2, message: 'Too short' }], values)).toEqual({})
    expect(evalValidationRules([{ field: 'qty', op: 'lte', compareTo: 'max', message: 'Over the max' }], values))
      .toEqual({ qty: 'Over the max' })
    expect(evalValidationRules([{ field: 'missing', op: 'required', message: 'Needed' }], values))
      .toEqual({ missing: 'Needed' })
  })

  it('runs as part of validateAll, so a rule fires in the form, not just on the server', async () => {
    const withRules: EntitySchema<{ id: string; code: string }> = {
      name: 'things',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'code', type: 'text' },
      ],
      validations: [{ field: 'code', op: 'minLen', value: 4, message: 'Code needs 4+ characters' }],
    }
    expect(await validateAll(withRules, { code: 'ab' })).toEqual({ code: 'Code needs 4+ characters' })
    expect(await validateAll(withRules, { code: 'abcd' })).toEqual({})
  })
})
