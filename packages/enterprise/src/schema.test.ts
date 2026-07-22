import { describe, expect, it } from 'vitest'
import {
  applyComputed,
  resolveIdField,
  schemaToColumns,
  schemaToFormFields,
  titleCase,
  validateEntity,
  validateField,
  type EntitySchema,
  type StandardSchemaV1,
} from './schema'

/** Index a list by `field`, asserting presence (keeps tests strict-null clean). */
function byField<T extends { field?: string }>(arr: readonly T[]): (f: string) => T {
  const m = new Map(arr.map((x) => [x.field, x]))
  return (f) => {
    const v = m.get(f)
    if (!v) throw new Error(`no field "${f}"`)
    return v
  }
}

type Customer = {
  id: string
  firstName: string
  age: number
  active: boolean
  tier: string
  secret: string
  companyId: string
}

const schema: EntitySchema<Customer> = {
  name: 'customers',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'firstName', type: 'text', required: true },
    { field: 'age', type: 'number' },
    { field: 'active', type: 'boolean' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { field: 'secret', type: 'text', hidden: { grid: true } },
    { field: 'companyId', type: 'relation', relation: { entity: 'companies', labelField: 'name' } },
  ],
}

describe('titleCase', () => {
  it('humanizes snake, kebab, and camel case', () => {
    expect(titleCase('first_name')).toBe('First Name')
    expect(titleCase('first-name')).toBe('First Name')
    expect(titleCase('firstName')).toBe('First Name')
    expect(titleCase('companyId')).toBe('Company Id')
  })
})

describe('resolveIdField', () => {
  it('prefers explicit idField', () => {
    expect(resolveIdField({ ...schema, idField: 'firstName' })).toBe('firstName')
  })
  it('falls back to the single primaryKey flag', () => {
    expect(resolveIdField(schema)).toBe('id')
  })
  it('falls back to a field named id', () => {
    const s: EntitySchema = { name: 't', fields: [{ field: 'id', type: 'text' }, { field: 'x', type: 'text' }] }
    expect(resolveIdField(s)).toBe('id')
  })
  it('throws on multiple primary keys', () => {
    const s: EntitySchema = {
      name: 't',
      fields: [{ field: 'a', type: 'text', primaryKey: true }, { field: 'b', type: 'text', primaryKey: true }],
    }
    expect(() => resolveIdField(s)).toThrow(/multiple fields set primaryKey/)
  })
  it('throws when no key resolves', () => {
    const s: EntitySchema = { name: 't', fields: [{ field: 'x', type: 'text' }] }
    expect(() => resolveIdField(s)).toThrow(/no primary key/)
  })
})

describe('schemaToColumns', () => {
  const cols = schemaToColumns(schema)
  const col = byField(cols)

  it('drops grid-hidden fields', () => {
    expect(cols.find((c) => c.field === 'secret')).toBeUndefined()
    expect(cols).toHaveLength(6)
  })

  it('maps types to cellDataType / editorType', () => {
    expect(col('age').cellDataType).toBe('number')
    expect(col('active').cellDataType).toBe('boolean')
    expect(col('age').editorType).toBe('number')
    expect(col('tier').editorType).toBe('select')
  })

  it('marks readonly fields non-editable and carries enum options through', () => {
    expect(col('id').editable).toBe(false)
    expect(col('firstName').editable).toBe(true)
    expect(col('tier').editorOptions).toEqual([
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
    ])
  })

  it('derives a title-cased header from the field', () => {
    expect(col('firstName').header).toBe('First Name')
  })

  it('merges the column escape hatch last (explicit wins)', () => {
    const s: EntitySchema<Customer> = {
      name: 'c',
      idField: 'id',
      fields: [{ field: 'age', type: 'number', column: { header: 'Years', editable: false } }],
    }
    const only = schemaToColumns(s)[0]
    expect(only?.header).toBe('Years')
    expect(only?.editable).toBe(false)
  })
})

describe('schemaToFormFields', () => {
  const fields = schemaToFormFields(schema)
  const ff = byField(fields)

  it('keeps fields that are only hidden from the grid', () => {
    // `secret` is hidden:{grid:true} so it stays in the form
    expect(fields.find((f) => f.field === 'secret')).toBeDefined()
  })

  it('forces the primary key read-only and non-required', () => {
    expect(ff('id').readonly).toBe(true)
    expect(ff('id').required).toBe(false)
  })

  it('carries required, options, and relation through', () => {
    expect(ff('firstName').required).toBe(true)
    expect(ff('tier').options).toHaveLength(2)
    expect(ff('companyId').relation).toEqual({ entity: 'companies', labelField: 'name' })
  })

  it('carries a form-only editor override (phone/mask) into the descriptor', () => {
    const s: EntitySchema = {
      name: 'm', idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'phone', type: 'text', input: { editorType: 'phone' } },
        { field: 'code', type: 'text', input: { editorType: 'mask', mask: '(999) 000-0000' } },
        { field: 'score', type: 'number', input: { editorType: 'slider' } },
      ],
    }
    const f = byField(schemaToFormFields(s))
    expect(f('phone').editorType).toBe('phone')
    expect(f('code').editorType).toBe('mask')
    expect(f('code').mask).toBe('(999) 000-0000')
    expect(f('score').editorType).toBe('slider')
  })

  it('degrades form-only editors to a safe grid cell editor (columns stay valid)', () => {
    const s: EntitySchema = {
      name: 'm', idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'phone', type: 'text', input: { editorType: 'phone' } },
        { field: 'score', type: 'number', input: { editorType: 'slider' } },
      ],
    }
    const col = (name: string) => schemaToColumns(s).find((c) => c.field === name)!
    expect(col('phone').editorType).toBe('text')   // phone/country/mask -> text in the grid
    expect(col('score').editorType).toBe('number') // slider -> number in the grid
  })

  it('threads an upload config through to the form descriptor', () => {
    const s: EntitySchema = {
      name: 'm', idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'avatar', type: 'text', upload: { image: true, accept: 'image/*' } },
      ],
    }
    expect(byField(schemaToFormFields(s))('avatar').upload).toEqual({ image: true, accept: 'image/*' })
  })
})

describe('validateField', () => {
  // Hand-rolled Standard Schema validator (no Zod dependency in the test).
  const nonEmpty: StandardSchemaV1<string, string> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (v) =>
        typeof v === 'string' && v.length > 0
          ? { value: v }
          : { issues: [{ message: 'Required' }] },
    },
  }

  it('returns null when there is no validator', async () => {
    expect(await validateField({}, 'anything')).toBeNull()
  })
  it('returns null on a valid value', async () => {
    expect(await validateField({ validate: nonEmpty }, 'ok')).toBeNull()
  })
  it('returns the first issue message on an invalid value', async () => {
    expect(await validateField({ validate: nonEmpty }, '')).toBe('Required')
  })
})

describe('computed fields', () => {
  type Line = { id: string; qty: number; price: number; total: number }
  const lineSchema: EntitySchema<Line> = {
    name: 'lines',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'qty', type: 'number', required: true },
      { field: 'price', type: 'number', required: true },
      { field: 'total', type: 'number', computed: (r) => Number(r.qty) * Number(r.price) },
    ],
  }

  it('materializes computed values onto a row', () => {
    const out = applyComputed(lineSchema, { id: '1', qty: 3, price: 10, total: 0 })
    expect(out.total).toBe(30)
  })

  it('returns the same row object when there are no computed fields', () => {
    const row = { id: '1', qty: 3, price: 10, total: 0 }
    expect(applyComputed({ ...lineSchema, fields: lineSchema.fields.slice(0, 3) }, row)).toBe(row)
  })

  it('renders a computed field read-only in the grid and form', () => {
    const col = schemaToColumns(lineSchema).find((c) => c.field === 'total')!
    expect(col.editable).toBe(false)
    const ff = schemaToFormFields(lineSchema).find((f) => f.field === 'total')!
    expect(ff.readonly).toBe(true)
    expect(typeof ff.computed).toBe('function')
  })

  it('wires a computed field to the grid value accessor (fieldFn), so it sorts/filters client-side', () => {
    const col = schemaToColumns(lineSchema).find((c) => c.field === 'total')!
    expect(typeof col.fieldFn).toBe('function')
    expect(col.fieldFn!({ id: '1', qty: 4, price: 25, total: 0 })).toBe(100)
  })
})

describe('validateEntity (schema-level cross-field)', () => {
  type Range = { id: string; start: number; end: number }
  const rangeSchema: EntitySchema<Range> = {
    name: 'ranges',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'start', type: 'number' },
      { field: 'end', type: 'number' },
    ],
    hooks: {
      validate: (v) => (Number(v.end) <= Number(v.start) ? { end: 'End must be after start' } : null),
    },
  }

  it('returns {} when there is no validate hook', async () => {
    expect(await validateEntity({ ...rangeSchema, hooks: undefined }, {})).toEqual({})
  })
  it('returns errors from the hook', async () => {
    expect(await validateEntity(rangeSchema, { start: 5, end: 2 })).toEqual({ end: 'End must be after start' })
  })
  it('returns {} when valid', async () => {
    expect(await validateEntity(rangeSchema, { start: 1, end: 9 })).toEqual({})
  })
})
