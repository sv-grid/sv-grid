import { describe, expect, it } from 'vitest'
import type { EntitySchema } from './schema'
import {
  addField,
  blankField,
  isSchemaValid,
  moveField,
  removeField,
  sampleRows,
  updateField,
  validateSchema,
} from './schema-designer'

function base(): EntitySchema {
  return {
    name: 'customers',
    idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true, readonly: true },
      { field: 'name', type: 'text' },
      { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }] },
    ],
  }
}

describe('blankField / addField', () => {
  it('adds a uniquely named blank field', () => {
    const s = addField(base())
    expect(s.fields).toHaveLength(4)
    const added = s.fields[3]!
    expect(added.type).toBe('text')
    expect(base().fields.map((f) => f.field)).not.toContain(added.field)
  })

  it('avoids name collisions', () => {
    const s: EntitySchema = { name: 't', fields: [{ field: 'field1', type: 'text' }] }
    expect(blankField(s).field).not.toBe('field1')
  })
})

describe('removeField', () => {
  it('removes and clears idField if it pointed there', () => {
    const s = removeField(base(), 'id')
    expect(s.fields.map((f) => f.field)).toEqual(['name', 'tier'])
    expect(s.idField).toBeUndefined()
  })
})

describe('updateField', () => {
  it('patches a field', () => {
    const s = updateField(base(), 'name', { label: 'Full Name', required: true })
    const f = s.fields.find((x) => x.field === 'name')!
    expect(f.label).toBe('Full Name')
    expect(f.required).toBe(true)
  })

  it('enforces a single primary key', () => {
    const s = updateField(base(), 'name', { primaryKey: true })
    expect(s.fields.find((f) => f.field === 'id')!.primaryKey).toBe(false)
    expect(s.fields.find((f) => f.field === 'name')!.primaryKey).toBe(true)
  })

  it('drops options when a field leaves the enum type', () => {
    const s = updateField(base(), 'tier', { type: 'text' })
    expect(s.fields.find((f) => f.field === 'tier')!.options).toBeUndefined()
  })
})

describe('moveField', () => {
  it('reorders and is a no-op at the ends', () => {
    expect(moveField(base(), 'name', -1).fields.map((f) => f.field)).toEqual(['name', 'id', 'tier'])
    expect(moveField(base(), 'id', -1).fields.map((f) => f.field)).toEqual(['id', 'name', 'tier'])
  })
})

describe('validateSchema', () => {
  it('is clean for a well-formed schema', () => {
    expect(validateSchema(base())).toEqual([])
    expect(isSchemaValid(base())).toBe(true)
  })

  it('errors on duplicate names', () => {
    const s: EntitySchema = {
      name: 't',
      idField: 'id',
      fields: [{ field: 'id', type: 'text' }, { field: 'id', type: 'number' }],
    }
    expect(validateSchema(s).some((i) => i.level === 'error' && /Duplicate/.test(i.message))).toBe(true)
  })

  it('errors when no primary key resolves', () => {
    const s: EntitySchema = { name: 't', fields: [{ field: 'x', type: 'text' }] }
    expect(isSchemaValid(s)).toBe(false)
    expect(validateSchema(s).some((i) => /primary key/.test(i.message))).toBe(true)
  })

  it('warns on an enum with no options and an incomplete relation', () => {
    const s: EntitySchema = {
      name: 't',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'k', type: 'enum' },
        { field: 'r', type: 'relation' },
      ],
    }
    const warnings = validateSchema(s).filter((i) => i.level === 'warning')
    expect(warnings.map((w) => w.field).sort()).toEqual(['k', 'r'])
  })
})

describe('sampleRows', () => {
  it('produces deterministic, type-appropriate sample data', () => {
    const rows = sampleRows(base(), 2)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.tier).toBe('free') // first enum option
    expect(typeof rows[0]!.name).toBe('string')
    // deterministic: same input, same output
    expect(sampleRows(base(), 2)).toEqual(rows)
  })
})
