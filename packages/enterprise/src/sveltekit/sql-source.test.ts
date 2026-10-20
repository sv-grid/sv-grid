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
      'SELECT * FROM "customers" WHERE "age" > ? ORDER BY "name" ASC, "id" ASC LIMIT 25 OFFSET 50',
    )
    expect(calls[0]!.params).toEqual([20])
    expect(calls[1]!.sql).toBe('SELECT COUNT(*) AS count FROM "customers" WHERE "age" > ?')
    expect(calls[1]!.params).toEqual([20])
  })

  it('schema-qualifies the table as "schema"."table" when dbSchema is set', async () => {
    const { execute, calls } = recorder([[{ id: '1' }], [{ count: 1 }]])
    const src = createSqlDataSource({ schema, table: 'customers', dbSchema: 'analytics', execute })
    await src.getRows(req({}))
    expect(calls[0]!.sql).toContain('FROM "analytics"."customers"')
    expect(calls[1]!.sql).toContain('FROM "analytics"."customers"')
    // Writes are qualified too.
    const { execute: ex2, calls: c2 } = recorder([[{ id: '9' }]])
    const src2 = createSqlDataSource({ schema, table: 'customers', dbSchema: 'analytics', execute: ex2 })
    await src2.createRow({ name: 'Zed' } as never)
    expect(c2[0]!.sql).toContain('INSERT INTO "analytics"."customers"')
  })

  it('orders unsorted rows by the primary key, and breaks ties under a sort with it', async () => {
    const { execute, calls } = recorder([[], [{ count: 0 }]])
    await createSqlDataSource({ schema, table: 'customers', execute }).getRows(req({ startRow: 25, pageSize: 25 }))
    expect(calls[0]!.sql).toBe('SELECT * FROM "customers" ORDER BY "id" ASC LIMIT 25 OFFSET 25')
    // A sort on a column that repeats pages in a fixed order too.
    await createSqlDataSource({ schema, table: 'customers', execute }).getRows(req({ sortModel: [{ id: 'age', desc: true }] }))
    expect(calls[2]!.sql).toBe('SELECT * FROM "customers" ORDER BY "age" DESC, "id" ASC LIMIT 50 OFFSET 0')
    // A sort on the key itself needs no tie-breaker.
    await createSqlDataSource({ schema, table: 'customers', execute }).getRows(req({ sortModel: [{ id: 'id', desc: true }] }))
    expect(calls[4]!.sql).toBe('SELECT * FROM "customers" ORDER BY "id" DESC LIMIT 50 OFFSET 0')
    // MySQL quoting and a renamed key column.
    const renamed: EntitySchema<Customer> = { ...schema, fields: [{ field: 'id', dbColumn: 'customer_id', type: 'text', primaryKey: true }, ...schema.fields.slice(1)] }
    await createSqlDataSource({ schema: renamed, table: 'customers', execute, dialect: { quote: '`' } }).getRows(req({}))
    expect(calls[6]!.sql).toContain('ORDER BY `customer_id` ASC LIMIT 50 OFFSET 0')
  })

  it('orders unsorted rows by a created_at / inserted_at column, or by defaultOrder', async () => {
    type Made = Customer & { createdAt: string }
    const made: EntitySchema<Made> = { ...schema, fields: [...schema.fields, { field: 'createdAt', dbColumn: 'created_at', type: 'datetime' }] } as EntitySchema<Made>
    const { execute, calls } = recorder([[], [{ count: 0 }]])
    await createSqlDataSource({ schema: made, table: 'customers', execute }).getRows(req({}))
    expect(calls[0]!.sql).toContain('ORDER BY "created_at" ASC, "id" ASC LIMIT 50')
    // A user sort still wins over creation order.
    await createSqlDataSource({ schema: made, table: 'customers', execute }).getRows(req({ sortModel: [{ id: 'name', desc: false }] }))
    expect(calls[2]!.sql).toContain('ORDER BY "name" ASC, "id" ASC LIMIT 50')
    const inserted: EntitySchema<Customer> = { ...schema, fields: [...schema.fields, { field: 'inserted_at', type: 'datetime' }] } as EntitySchema<Customer>
    await createSqlDataSource({ schema: inserted, table: 'customers', execute }).getRows(req({}))
    expect(calls[4]!.sql).toContain('ORDER BY "inserted_at" ASC, "id" ASC')
    // An explicit order wins over the convention.
    await createSqlDataSource({ schema: made, table: 'customers', execute, defaultOrder: [{ field: 'age', desc: true }] }).getRows(req({}))
    expect(calls[6]!.sql).toContain('ORDER BY "age" DESC, "id" ASC LIMIT 50')
    expect(() => createSqlDataSource({ schema, table: 'customers', execute, defaultOrder: [{ field: 'nope' }] })).toThrow('defaultOrder field "nope" is not in the schema')
  })

  // PGlite boots a real Postgres: past vitest's 5 s default when other suites share the machine.
  it('keeps rows in insertion order with text and UUID keys, across an update and a new insert', { timeout: 30_000 }, async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const db = new PGlite()
    // The shape of a Base table: a text key the database fills with a UUID,
    // seed ids that sort as text (1, 10, 2), and an identity column that
    // numbers the rows in the order they were written.
    await db.exec(`create table customers (
        id text primary key default gen_random_uuid()::text,
        name text, age int,
        seq bigint generated always as identity);
      insert into customers (id, name, age) values
        ('1', 'Ann', 30), ('2', 'Bob', 40), ('10', 'Cy', 50), ('3f2b9c1e-0000-4000-8000-000000000000', 'Dee', 60), ('11', 'Eve', 70);`)
    type Seq = Customer & { seq: number }
    const seqSchema = { ...schema, fields: [...schema.fields, { field: 'seq', type: 'number' }] } as EntitySchema<Seq>
    const execute: SqlExecutor = async (sql, params) => (await db.query<Record<string, unknown>>(sql, params)).rows
    const src = createSqlDataSource({ schema: seqSchema, table: 'customers', execute, dialect: { placeholders: '$' }, defaultOrder: [{ field: 'seq' }] })
    const names = async (r: Partial<ServerRequest> = {}) => (await src.getRows(req(r))).rows.map((x) => x.name)
    expect(await names()).toEqual(['Ann', 'Bob', 'Cy', 'Dee', 'Eve'])
    await src.updateRow('1', { age: 31 })
    expect(await names()).toEqual(['Ann', 'Bob', 'Cy', 'Dee', 'Eve'])
    // Added in the app: no id, the database makes a UUID; it goes last.
    await src.createRow({ name: 'Fay', age: 20 })
    await src.createRow({ name: 'Gus', age: 21 })
    expect(await names()).toEqual(['Ann', 'Bob', 'Cy', 'Dee', 'Eve', 'Fay', 'Gus'])
    // Pages line up with the whole list.
    expect([...(await names({ startRow: 0, pageSize: 3 })), ...(await names({ startRow: 3, pageSize: 3 })), ...(await names({ startRow: 6, pageSize: 3 }))])
      .toEqual(['Ann', 'Bob', 'Cy', 'Dee', 'Eve', 'Fay', 'Gus'])
    // The key alone is not an order for these: text order puts 10 before 2.
    const byKey = createSqlDataSource({ schema, table: 'customers', execute, dialect: { placeholders: '$' } })
    // (The seed rows only: a random UUID can sort anywhere among them.)
    const seeds = new Set(['Ann', 'Bob', 'Cy', 'Dee', 'Eve'])
    expect((await byKey.getRows(req({}))).rows.map((x) => x.name).filter((n) => seeds.has(n))).toEqual(['Ann', 'Cy', 'Eve', 'Bob', 'Dee'])
    await db.close()
  })

  it('takes LIMIT and OFFSET only as non-negative integers', async () => {
    const { execute, calls } = recorder([[], [{ count: 0 }]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    for (const bad of ['10; DROP TABLE customers', -1, 1.5, Number.NaN, Infinity, null]) {
      await expect(src.getRows(req({ pageSize: bad as never }))).rejects.toThrow(/limit must be a non-negative integer/)
      await expect(src.getRows(req({ startRow: bad as never }))).rejects.toThrow(/offset must be a non-negative integer/)
    }
    expect(calls).toEqual([])
    // A digit string, as a hand-written client may send, still reads.
    await src.getRows(req({ pageSize: '20' as never, startRow: '40' as never }))
    expect(calls[0]!.sql).toContain('LIMIT 20 OFFSET 40')
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

describe('createSqlDataSource server grouping', () => {
  it('runs the grouped SELECT + GROUP BY, and counts DISTINCT keys', async () => {
    const { execute, calls } = recorder([
      [{ name: 'Ann', age: 61, childCount: 2 }],
      [{ count: 3 }],
    ])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    const res = await src.getRows(
      req({ groupBy: ['name'], groupKeys: [], aggregations: [{ col: 'age', fn: 'sum' }] }),
    )

    // Group rows come back as-is: the key, the aliased aggregate, the count.
    expect(res.rows).toEqual([{ name: 'Ann', age: 61, childCount: 2 }])
    // Three distinct names, not however many customer rows there are.
    expect(res.rowCount).toBe(3)

    expect(calls[0]!.sql).toBe(
      'SELECT "name", SUM("age") AS "age", COUNT(*) AS "childCount" FROM "customers" GROUP BY "name" ORDER BY "name" ASC LIMIT 50 OFFSET 0',
    )
    expect(calls[1]!.sql).toBe('SELECT COUNT(DISTINCT "name") AS count FROM "customers"')
  })

  it('descends into a group with the path as a bound predicate', async () => {
    const { execute, calls } = recorder([[{ id: '1', name: 'Ann', age: 30 }], [{ count: 1 }]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    await src.getRows(req({ groupBy: ['name'], groupKeys: ['Ann'] }))

    // The innermost level is leaves: the projection, scoped by the path.
    expect(calls[0]!.sql).toBe('SELECT * FROM "customers" WHERE "name" = ? ORDER BY "id" ASC LIMIT 50 OFFSET 0')
    expect(calls[0]!.params).toEqual(['Ann'])
  })

  it('runs the grand-total statement when the grid asks for one', async () => {
    const { execute, calls } = recorder([
      [{ name: 'Ann', age: 30, childCount: 1 }],
      [{ count: 1 }],
      [{ age: 91 }],
    ])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    const res = await src.getRows(
      req({
        groupBy: ['name'],
        groupKeys: [],
        aggregations: [{ col: 'age', fn: 'sum' }],
        needsGrandTotal: true,
        filterModel: { columns: { age: { operator: 'greaterThan', value: '20' } } },
      }),
    )

    expect(res.grandTotal).toEqual({ age: 91 })
    // Its own statement, with the filter and without a GROUP BY.
    expect(calls[2]!.sql).toBe('SELECT SUM("age") AS "age" FROM "customers" WHERE "age" > ?')
    expect(calls[2]!.params).toEqual([20])
  })

  it('does not run a third statement when no total was asked for', async () => {
    const { execute, calls } = recorder([[], [{ count: 0 }]])
    const src = createSqlDataSource({ schema, table: 'customers', execute })
    const res = await src.getRows(req({ groupBy: ['name'], groupKeys: [] }))
    expect(calls).toHaveLength(2)
    expect('grandTotal' in res).toBe(false)
  })
})
