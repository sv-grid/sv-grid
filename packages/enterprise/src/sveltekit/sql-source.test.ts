import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createSqlDataSource, type SqlExecutor } from './sql-source'

type Customer = { id: string; name: string; age: number }

const schema: EntitySchema<Customer> = {
  name: 'customers',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'age', type: 'number' },
  ],
}

/** Records every (sql, params) and returns queued results per call. */
function recorder(results: Array<ReadonlyArray<Record<string, unknown>>>) {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  let i = 0
  const execute: SqlExecutor = async (sql, params) => {
    calls.push({ sql, params })
    return results[i++] ?? []
  }
  return { execute, calls }
}

const req = (p: Partial<ServerRequest>): ServerRequest => ({
  startRow: 0,
  endRow: 50,
  pageIndex: 0,
  pageSize: 50,
  sortModel: [],
  filterModel: {},
  ...p,
})

describe('createSqlDataSource reads', () => {
  it('builds a parameterized SELECT + COUNT and maps the result', async () => {
    const { execute, calls } = recorder([
      [{ id: '1', name: 'Ann', age: 30 }],
      [{ count: 7 }],
    ])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    const res = await src.getRows(
      req({
        filterModel: { columns: { age: { operator: 'greaterThan', value: '20' } } },
        sortModel: [{ id: 'name', desc: false }],
        startRow: 50,
        pageSize: 25,
      }),
    )

    expect(res.rowCount).toBe(7)
    expect(res.rows[0]?.name).toBe('Ann')

    expect(calls[0]!.sql).toBe(
      'SELECT * FROM "customers" WHERE "age" > ? ORDER BY "name" ASC LIMIT 25 OFFSET 50',
    )
    expect(calls[0]!.params).toEqual([20])
    expect(calls[1]!.sql).toBe('SELECT COUNT(*) AS count FROM "customers" WHERE "age" > ?')
    expect(calls[1]!.params).toEqual([20])
  })

  it('honors the Postgres dialect ($ placeholders)', async () => {
    const { execute, calls } = recorder([[], [{ count: 0 }]])
    const src = createSqlDataSource({
      schema,
      table: 'customers',
      execute,
      dialect: { placeholders: '$', ilike: true },
    })
    await src.getRows(req({ filterModel: { columns: { name: { operator: 'contains', value: 'a' } } } }))
    expect(calls[0]!.sql).toContain('"name" ILIKE $1')
  })
})

describe('createSqlDataSource writes', () => {
  it('creates with a parameterized INSERT ... RETURNING', async () => {
    const { execute, calls } = recorder([[{ id: '9', name: 'Zoe', age: 41 }]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    const created = await src.createRow({ id: '9', name: 'Zoe', age: 41 })
    expect(created).toEqual({ id: '9', name: 'Zoe', age: 41 })
    expect(calls[0]!.sql).toBe(
      'INSERT INTO "customers" ("id", "name", "age") VALUES (?, ?, ?) RETURNING *',
    )
    expect(calls[0]!.params).toEqual(['9', 'Zoe', 41])
  })

  it('updates by id with SET + WHERE', async () => {
    const { execute, calls } = recorder([[{ id: '9', name: 'Zoe', age: 42 }]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    await src.updateRow('9', { age: 42 })
    expect(calls[0]!.sql).toBe('UPDATE "customers" SET "age" = ? WHERE "id" = ? RETURNING *')
    expect(calls[0]!.params).toEqual([42, '9'])
  })

  it('deletes by id', async () => {
    const { execute, calls } = recorder([[]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    await src.deleteRow('9')
    expect(calls[0]!.sql).toBe('DELETE FROM "customers" WHERE "id" = ?')
    expect(calls[0]!.params).toEqual(['9'])
  })

  it('omits RETURNING and echoes input when returning:false (MySQL)', async () => {
    const { execute, calls } = recorder([[]])
    const src = createSqlDataSource({ schema, table: 'customers', execute, returning: false })
    const created = await src.createRow({ id: '1', name: 'A', age: 1 })
    expect(calls[0]!.sql).not.toContain('RETURNING')
    expect(created).toEqual({ id: '1', name: 'A', age: 1 })
  })

  it('getAggregate emits a GROUP BY with quoted identifiers', async () => {
    const { execute, calls } = recorder([[{ category: 'x', value: 10 }, { category: 'y', value: 5 }]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    const out = await src.getAggregate({ dimension: 'name', measure: 'age', reduce: 'sum' })
    expect(calls[0]!.sql).toBe('SELECT "name" AS category, SUM("age") AS value FROM "customers" GROUP BY "name" ORDER BY value DESC')
    expect(out).toEqual([{ category: 'x', value: 10 }, { category: 'y', value: 5 }])
  })

  it('getAggregate uses COUNT(*) for reduce:count', async () => {
    const { execute, calls } = recorder([[]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    await src.getAggregate({ dimension: 'name', reduce: 'count' })
    expect(calls[0]!.sql).toContain('COUNT(*) AS value')
    expect(calls[0]!.sql).toContain('GROUP BY "name"')
  })

  it('getAggregate with no dimension emits a single total (no GROUP BY) - a KPI', async () => {
    const { execute, calls } = recorder([[{ value: 42 }]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    const out = await src.getAggregate({ measure: 'age', reduce: 'sum' })
    expect(calls[0]!.sql).toBe('SELECT SUM("age") AS value FROM "customers"')
    expect(calls[0]!.sql).not.toContain('GROUP BY')
    expect(out).toEqual([{ category: '', value: 42 }])
  })
})

// A schema whose fields are renamed relative to their DB columns (the Drizzle
// `createdAt: timestamp('created_at')` case).
type Ev = { id: string; startsAt: string }
const renamedSchema: EntitySchema<Ev> = {
  name: 'events',
  idField: 'id',
  fields: [
    { field: 'id', dbColumn: 'event_id', type: 'text', primaryKey: true },
    { field: 'startsAt', dbColumn: 'starts_at', type: 'datetime' },
  ],
}

describe('createSqlDataSource honors dbColumn (renamed columns)', () => {
  it('SELECTs the real columns aliased back to the field names', async () => {
    const { execute, calls } = recorder([[{ id: '1', startsAt: 'x' }], [{ count: 1 }]])
    const src = createSqlDataSource({ schema: renamedSchema, table: 'events', execute })
    await src.getRows(req({ sortModel: [{ id: 'startsAt', desc: true }] }))
    expect(calls[0]!.sql).toContain('SELECT "event_id" AS "id", "starts_at" AS "startsAt" FROM "events"')
    expect(calls[0]!.sql).toContain('ORDER BY "starts_at" DESC') // sort uses the DB column
  })

  it('filters on the real column', async () => {
    const { execute, calls } = recorder([[], [{ count: 0 }]])
    const src = createSqlDataSource({ schema: renamedSchema, table: 'events', execute })
    await src.getRows(req({ filterModel: { columns: { startsAt: { operator: 'contains', value: '2026' } } } }))
    // The WHERE predicate targets the real DB column, not the field name.
    expect(calls[0]!.sql).toContain('LOWER("starts_at") LIKE')
    expect(calls[0]!.sql).not.toContain('LOWER("startsAt")')
  })

  it('INSERT / UPDATE write the real columns and RETURNING aliases back', async () => {
    const { execute, calls } = recorder([[{ id: '9', startsAt: 'y' }]])
    const src = createSqlDataSource({ schema: renamedSchema, table: 'events', execute })
    await src.createRow({ id: '9', startsAt: 'y' })
    expect(calls[0]!.sql).toContain('INSERT INTO "events" ("event_id", "starts_at")')
    expect(calls[0]!.sql).toContain('RETURNING "event_id" AS "id", "starts_at" AS "startsAt"')
  })

  it('getAggregate reduces the real measure column', async () => {
    const { execute, calls } = recorder([[{ value: 3 }]])
    const src = createSqlDataSource({ schema: renamedSchema, table: 'events', execute })
    await src.getAggregate({ dimension: 'startsAt', reduce: 'count' })
    expect(calls[0]!.sql).toContain('GROUP BY "starts_at"')
  })
})
