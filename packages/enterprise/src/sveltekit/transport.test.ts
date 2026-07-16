import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createInMemoryDataSource } from './in-memory'
import { createKitDataSource, createKitHandlers } from './transport'

type Customer = { id: string; name: string; age: number; tier: string }

const schema: EntitySchema<Customer> = {
  name: 'customers',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'age', type: 'number' },
    { field: 'tier', type: 'enum' },
  ],
}

const seed: Customer[] = [
  { id: '1', name: 'Ann', age: 30, tier: 'pro' },
  { id: '2', name: 'Bob', age: 41, tier: 'free' },
]

/**
 * Stand up the full loop in-process: an in-memory backend behind the server
 * handlers, and a client whose `fetch` routes straight into those handlers via
 * a real `Request`. This exercises the wire protocol end to end without a
 * running SvelteKit server.
 */
function wireClientToServer() {
  const backend = createInMemoryDataSource(seed, schema)
  const handlers = createKitHandlers({ schema, source: backend })
  const fakeFetch = (url: string, init?: RequestInit) =>
    handlers.handle(new Request(`http://localhost${url}`, init))
  const client = createKitDataSource<Customer>({ endpoint: '/api/customers', fetch: fakeFetch })
  return { client, backend }
}

const req = (partial: Partial<ServerRequest>): ServerRequest => ({
  startRow: 0,
  endRow: 50,
  pageIndex: 0,
  pageSize: 50,
  sortModel: [],
  filterModel: {},
  ...partial,
})

describe('SvelteKit transport round trip', () => {
  it('getRows travels client -> server -> backend and back', async () => {
    const { client } = wireClientToServer()
    const res = await client.getRows(req({ sortModel: [{ id: 'age', desc: true }] }))
    expect(res.rowCount).toBe(2)
    expect(res.rows[0]?.name).toBe('Bob')
  })

  it('createRow / updateRow / deleteRow mutate the backend through the protocol', async () => {
    const { client, backend } = wireClientToServer()

    const created = await client.createRow({ id: '3', name: 'Cara', age: 25, tier: 'pro' })
    expect(created.name).toBe('Cara')
    expect(backend.rows()).toHaveLength(3)

    const updated = await client.updateRow('3', { age: 26 })
    expect(updated.age).toBe(26)

    await client.deleteRow('1')
    expect(backend.rows().some((r) => r.id === '1')).toBe(false)
  })

  it('surfaces a backend error as a rejected fetch', async () => {
    const { client } = wireClientToServer()
    // updating a non-existent id makes the in-memory source throw -> 500
    await expect(client.updateRow('nope', { age: 1 })).rejects.toThrow(/svgrid kit: 500/)
  })

  it('returns 405 when the backend lacks a writer', async () => {
    const readOnly = { getRows: async () => ({ rows: [], rowCount: 0 }) }
    const handlers = createKitHandlers({ schema, source: readOnly })
    const client = createKitDataSource<Customer>({
      endpoint: '/x',
      fetch: (url, init) => handlers.handle(new Request(`http://localhost${url}`, init)),
    })
    await expect(client.createRow({ name: 'x' })).rejects.toThrow(/405/)
  })
})

describe('createKitHandlers server-enforced validation', () => {
  const vSchema: EntitySchema<Customer> = {
    name: 'customers',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'name', type: 'text', required: true },
      { field: 'age', type: 'number', min: 0, max: 120 },
      { field: 'tier', type: 'enum' },
    ],
  }
  const post = (h: ReturnType<typeof createKitHandlers>, body: unknown) =>
    h.handle(new Request('http://localhost/api/customers', { method: 'POST', body: JSON.stringify(body) }))

  it('rejects a constraint-violating create with 422 + fieldErrors', async () => {
    const handlers = createKitHandlers({ schema: vSchema, source: createInMemoryDataSource<Customer>([], vSchema), validate: true })
    const res = await post(handlers, { kind: 'mutate', op: 'create', input: { id: '9', age: 999 } })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.fieldErrors.name).toBeTruthy() // required missing
    expect(body.fieldErrors.age).toBeTruthy()  // above max
  })

  it('accepts a valid create', async () => {
    const handlers = createKitHandlers({ schema: vSchema, source: createInMemoryDataSource<Customer>([], vSchema), validate: true })
    const res = await post(handlers, { kind: 'mutate', op: 'create', input: { id: '9', name: 'Zoe', age: 22 } })
    expect(res.status).toBe(200)
  })

  it('validates only the fields present in an update patch', async () => {
    const handlers = createKitHandlers({ schema: vSchema, source: createInMemoryDataSource<Customer>(seed, vSchema), validate: true })
    // omits required `name` (fine - not in the patch), valid age -> 200
    expect((await post(handlers, { kind: 'mutate', op: 'update', id: '1', patch: { age: 33 } })).status).toBe(200)
    // bad age in the patch -> 422
    expect((await post(handlers, { kind: 'mutate', op: 'update', id: '1', patch: { age: -5 } })).status).toBe(422)
  })

  it('is off by default (no validation unless opted in)', async () => {
    const handlers = createKitHandlers({ schema: vSchema, source: createInMemoryDataSource<Customer>([], vSchema) })
    const res = await post(handlers, { kind: 'mutate', op: 'create', input: { id: '9', age: 999 } })
    expect(res.status).toBe(200)
  })
})

describe('createKitHandlers audit hook', () => {
  const post = (h: ReturnType<typeof createKitHandlers>, b: unknown) =>
    h.handle(new Request('http://localhost/api/customers', { method: 'POST', body: JSON.stringify(b) }))

  it('fires after create / update / delete with the change details', async () => {
    const log: Array<{ action: string; id: string | null; values?: unknown }> = []
    const handlers = createKitHandlers({ schema, source: createInMemoryDataSource(seed, schema), audit: (e) => { log.push({ action: e.action, id: e.id, values: e.values }) } })
    await post(handlers, { kind: 'mutate', op: 'create', input: { id: '9', name: 'Zoe', age: 20, tier: 'pro' } })
    await post(handlers, { kind: 'mutate', op: 'update', id: '9', patch: { age: 21 } })
    await post(handlers, { kind: 'mutate', op: 'delete', id: '9' })
    expect(log.map((e) => e.action)).toEqual(['create', 'update', 'delete'])
    expect(log[0]!.id).toBe('9')
    expect(log[1]!.values).toEqual({ age: 21 })
  })

  it('never fires on reads, and a throwing audit sink does not fail the write', async () => {
    let fired = 0
    const handlers = createKitHandlers({ schema, source: createInMemoryDataSource(seed, schema), audit: () => { fired++; throw new Error('sink down') } })
    expect((await post(handlers, { kind: 'query', request: req({}) })).status).toBe(200)
    expect(fired).toBe(0)
    expect((await post(handlers, { kind: 'mutate', op: 'create', input: { id: '9', name: 'Z', age: 1, tier: 'x' } })).status).toBe(200)
    expect(fired).toBe(1) // audit ran, but the write still succeeded
  })
})

describe('createKitHandlers authorize (RBAC seam)', () => {
  const body = (b: unknown, init: RequestInit = {}) =>
    new Request('http://localhost/api/customers', { method: 'POST', body: JSON.stringify(b), ...init })

  it('reads pass but writes 403 when authorize denies them', async () => {
    const handlers = createKitHandlers({ schema, source: createInMemoryDataSource(seed, schema), authorize: ({ action }) => action === 'read' })
    expect((await handlers.handle(body({ kind: 'query', request: req({}) }))).status).toBe(200)
    expect((await handlers.handle(body({ kind: 'mutate', op: 'delete', id: '1' }))).status).toBe(403)
  })

  it('resolves the role from event.locals', async () => {
    const handlers = createKitHandlers({
      schema,
      source: createInMemoryDataSource(seed, schema),
      authorize: ({ action, event }) => action === 'read' || event.locals?.role === 'admin',
    })
    expect((await handlers.handle(body({ kind: 'mutate', op: 'delete', id: '1' }), { locals: { role: 'viewer' } })).status).toBe(403)
    expect((await handlers.handle(body({ kind: 'mutate', op: 'delete', id: '2' }), { locals: { role: 'admin' } })).status).toBe(200)
  })
})
