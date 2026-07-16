import { describe, expect, it } from 'vitest'
import type { EntitySchema } from '../schema'
import { buildEntitySchema, linkRelationLabels, pickLabelField } from './schema-from-columns'

describe('buildEntitySchema', () => {
  it('uses an explicit primary key and marks it readonly', () => {
    const s = buildEntitySchema('t', [
      { name: 'name', type: 'text' },
      { name: 'code', type: 'text', primaryKey: true },
    ])
    expect(s.idField).toBe('code')
    expect(s.fields.find((f) => f.field === 'code')).toMatchObject({ primaryKey: true, readonly: true })
  })

  it('falls back to a column named id, then the first column', () => {
    expect(buildEntitySchema('t', [{ name: 'a' }, { name: 'id' }]).idField).toBe('id')
    expect(buildEntitySchema('t', [{ name: 'first' }, { name: 'second' }]).idField).toBe('first')
  })

  it('defaults type to text and carries required + enum options', () => {
    const s = buildEntitySchema('t', [
      { name: 'id', primaryKey: true },
      { name: 'name', required: true },
      { name: 'tier', enumValues: ['free', 'pro'] },
    ])
    expect(s.fields.find((f) => f.field === 'name')).toMatchObject({ type: 'text', required: true })
    const tier = s.fields.find((f) => f.field === 'tier')
    expect(tier?.type).toBe('enum')
    expect(tier?.options).toEqual([{ value: 'free', label: 'free' }, { value: 'pro', label: 'pro' }])
  })

  it('does not mark the primary key as required', () => {
    const s = buildEntitySchema('t', [{ name: 'id', primaryKey: true, required: true }])
    expect(s.fields[0]!).toMatchObject({ primaryKey: true, readonly: true })
    expect(s.fields[0]!.required).toBeUndefined()
  })

  it('throws with no columns', () => {
    expect(() => buildEntitySchema('t', [])).toThrow(/no columns/)
  })

  it('turns a foreign-key column into a relation field', () => {
    const s = buildEntitySchema('contacts', [
      { name: 'id', primaryKey: true },
      { name: 'name', required: true },
      { name: 'company_id', required: true, references: { table: 'companies', column: 'id' } },
    ])
    const rel = s.fields.find((f) => f.field === 'company_id')
    expect(rel).toMatchObject({
      field: 'company_id',
      type: 'relation',
      required: true,
      relation: { entity: 'companies', foreignKey: 'company_id', labelField: 'name' },
    })
  })

  it('does not turn the primary key into a relation even if it references', () => {
    const s = buildEntitySchema('t', [{ name: 'id', primaryKey: true, references: { table: 'other' } }])
    expect(s.fields[0]!.type).not.toBe('relation')
    expect(s.fields[0]).toMatchObject({ primaryKey: true })
  })

  it('honors an explicit labelField on the reference', () => {
    const s = buildEntitySchema('t', [
      { name: 'id', primaryKey: true },
      { name: 'owner', references: { table: 'users', labelField: 'email' } },
    ])
    expect(s.fields.find((f) => f.field === 'owner')?.relation?.labelField).toBe('email')
  })
})

describe('pickLabelField', () => {
  const make = (fieldNames: [string, 'text' | 'number'][]): EntitySchema => ({
    name: 't', idField: 'id',
    fields: fieldNames.map(([field, type]) => ({ field, type, ...(field === 'id' ? { primaryKey: true } : {}) })),
  })

  it('prefers name / title / label', () => {
    expect(pickLabelField(make([['id', 'number'], ['title', 'text'], ['body', 'text']]))).toBe('title')
  })
  it('falls back to the first non-id text field, then the id', () => {
    expect(pickLabelField(make([['id', 'number'], ['slug', 'text']]))).toBe('slug')
    expect(pickLabelField(make([['id', 'number'], ['count', 'number']]))).toBe('id')
  })
})

describe('linkRelationLabels', () => {
  it('resolves each relation labelField from the related schema', () => {
    const companies: EntitySchema = {
      name: 'companies', idField: 'id',
      fields: [{ field: 'id', type: 'number', primaryKey: true }, { field: 'name', type: 'text' }],
    }
    const contacts: EntitySchema = {
      name: 'contacts', idField: 'id',
      fields: [
        { field: 'id', type: 'number', primaryKey: true },
        { field: 'company_id', type: 'relation', relation: { entity: 'companies', foreignKey: 'company_id', labelField: 'name' } },
        { field: 'buddy_id', type: 'relation', relation: { entity: 'missing', foreignKey: 'buddy_id', labelField: 'name' } },
      ],
    }
    const [, linkedContacts] = linkRelationLabels([companies, contacts])
    expect(linkedContacts!.fields.find((f) => f.field === 'company_id')?.relation?.labelField).toBe('name')
    // Unknown related entity is left untouched.
    expect(linkedContacts!.fields.find((f) => f.field === 'buddy_id')?.relation?.labelField).toBe('name')
  })
})
