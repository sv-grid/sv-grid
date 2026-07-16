import { describe, expect, it } from 'vitest'
import { introspectDatabase, listDatabaseTables, mapSqlType, type DbExecute } from './introspect-db'

describe('mapSqlType', () => {
  it('maps common SQL types across dialects', () => {
    expect(mapSqlType('integer')).toBe('number')
    expect(mapSqlType('bigint')).toBe('number') // not confused with bit
    expect(mapSqlType('numeric')).toBe('number')
    expect(mapSqlType('boolean')).toBe('boolean')
    expect(mapSqlType('bit')).toBe('boolean')
    expect(mapSqlType('timestamp with time zone')).toBe('datetime')
    expect(mapSqlType('datetime2')).toBe('datetime')
    expect(mapSqlType('date')).toBe('dateString')
    expect(mapSqlType('jsonb')).toBe('json')
    expect(mapSqlType('varchar')).toBe('text')
  })
})

/** Fake executor: returns canned catalog rows and records the SQL it was asked. */
function fakeExec(rowsByCall: Array<Array<Record<string, unknown>>>) {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  let i = 0
  const execute: DbExecute = async (sql, params) => {
    calls.push({ sql, params })
    return rowsByCall[i++] ?? []
  }
  return { execute, calls }
}

describe('introspectDatabase (information_schema dialects)', () => {
  const catalog = [
    { name: 'id', type: 'integer', nullable: 0, pk: 1 },
    { name: 'email', type: 'varchar', nullable: 0, pk: 0 },
    { name: 'age', type: 'integer', nullable: 1, pk: 0 },
    { name: 'active', type: 'boolean', nullable: 1, pk: 0 },
  ]

  it('postgres: maps columns, primary key, and NOT NULL -> required', async () => {
    const { execute, calls } = fakeExec([catalog])
    const schema = await introspectDatabase({ dialect: 'postgres', table: 'users', execute })
    expect(schema.name).toBe('users')
    const byField = Object.fromEntries(schema.fields.map((f) => [f.field, f]))
    expect(byField.id!).toMatchObject({ type: 'number', primaryKey: true, readonly: true })
    expect(byField.email!).toMatchObject({ type: 'text', required: true })
    expect(byField.age!.required).toBeUndefined() // nullable
    expect(byField.active!.type).toBe('boolean')
    expect(calls[0]!.sql).toContain('information_schema.columns')
    expect(calls[0]!.params).toEqual(['users'])
  })

  it('supabase is treated as postgres', async () => {
    const { execute, calls } = fakeExec([catalog])
    await introspectDatabase({ dialect: 'supabase', table: 'users', execute })
    expect(calls[0]!.sql).toContain('information_schema.columns')
  })

  it('mssql uses @p1 placeholders', async () => {
    const { execute, calls } = fakeExec([catalog])
    await introspectDatabase({ dialect: 'mssql', table: 'Users', execute })
    expect(calls[0]!.sql).toContain('@p1')
  })

  it('throws when the table has no columns', async () => {
    const { execute } = fakeExec([[]])
    await expect(introspectDatabase({ dialect: 'postgres', table: 'ghost', execute })).rejects.toThrow(
      /no columns/,
    )
  })

  it('turns a foreign-key column into a relation field', async () => {
    const cols = [
      { name: 'id', type: 'integer', nullable: 0, pk: 1 },
      { name: 'name', type: 'varchar', nullable: 0, pk: 0 },
      { name: 'company_id', type: 'integer', nullable: 0, pk: 0 },
    ]
    const fks = [{ column: 'company_id', ref_table: 'companies', ref_column: 'id' }]
    const { execute, calls } = fakeExec([cols, fks])
    const schema = await introspectDatabase({ dialect: 'postgres', table: 'contacts', execute })
    const byField = Object.fromEntries(schema.fields.map((f) => [f.field, f]))
    expect(byField.company_id!).toMatchObject({
      type: 'relation',
      required: true,
      relation: { entity: 'companies', foreignKey: 'company_id', labelField: 'name' },
    })
    expect(calls[1]!.sql).toContain('FOREIGN KEY')
  })

  it('degrades gracefully when the FK query fails', async () => {
    let call = 0
    const execute: DbExecute = async () => {
      call += 1
      if (call === 1) return [{ name: 'id', type: 'integer', nullable: 0, pk: 1 }]
      throw new Error('permission denied')
    }
    const schema = await introspectDatabase({ dialect: 'postgres', table: 't', execute })
    expect(schema.fields[0]!.type).toBe('number') // no throw, no relation
  })
})

describe('introspectDatabase (sqlite PRAGMA)', () => {
  it('reads PRAGMA table_info rows (notnull + pk-as-index)', async () => {
    const pragma = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'title', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 2, name: 'done', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
    ]
    const { execute, calls } = fakeExec([pragma])
    const schema = await introspectDatabase({ dialect: 'sqlite', table: 'todos', execute })
    const byField = Object.fromEntries(schema.fields.map((f) => [f.field, f]))
    expect(calls[0]!.sql).toBe('PRAGMA table_info("todos")')
    expect(byField.id!).toMatchObject({ type: 'number', primaryKey: true })
    expect(byField.title!.required).toBe(true)
    expect(byField.done!.required).toBeUndefined()
  })

  it('reads PRAGMA foreign_key_list into a relation field', async () => {
    const pragma = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, pk: 1 },
      { cid: 1, name: 'company_id', type: 'INTEGER', notnull: 1, pk: 0 },
    ]
    const fkList = [{ id: 0, seq: 0, table: 'companies', from: 'company_id', to: 'id' }]
    const { execute, calls } = fakeExec([pragma, fkList])
    const schema = await introspectDatabase({ dialect: 'sqlite', table: 'contacts', execute })
    expect(schema.fields.find((f) => f.field === 'company_id')).toMatchObject({
      type: 'relation',
      relation: { entity: 'companies', foreignKey: 'company_id', labelField: 'name' },
    })
    expect(calls[1]!.sql).toBe('PRAGMA foreign_key_list("contacts")')
  })
})

describe('listDatabaseTables', () => {
  it('returns base table names', async () => {
    const { execute } = fakeExec([[{ name: 'users' }, { name: 'orders' }]])
    expect(await listDatabaseTables('postgres', execute)).toEqual(['users', 'orders'])
  })
})
