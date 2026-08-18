/**
 * Row scoping (`scope`) - the mechanism behind multi-tenancy.
 *
 * Scoping reads is the easy half and the useless half on its own: if create can
 * plant a row in another tenant, or update/delete can reach one by guessing an
 * id, the isolation is decorative. These tests cover all four paths plus the
 * ways a client might try to talk its way out of the scope.
 */
import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createInMemoryDataSource } from './in-memory'
import { createKitDataSource, createKitHandlers } from './transport'

type Row = { id: string; name: string; tenantId: string }

const schema: EntitySchema<Row> = {
  name: 'notes',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'tenantId', type: 'text' },
  ],
}

const seed: Row[] = [
  { id: '1', name: 'Acme note', tenantId: 'acme' },
  { id: '2', name: 'Acme second', tenantId: 'acme' },
  { id: '3', name: 'Globex secret', tenantId: 'globex' },
]

/** Wire a client to handlers scoped to `tenant` (null = unscoped/super-admin). */
function wire(tenant: string | null, opts: { throwOnResolve?: boolean } = {}) {
  const backend = createInMemoryDataSource(seed.map((r) => ({ ...r })), schema)
  const handlers = createKitHandlers({
    schema,
    source: backend,
    scope: () => {
      if (opts.throwOnResolve) throw new Error('no tenant on session')
      return tenant ? { field: 'tenantId', value: tenant } : null
    },
  })
  const fakeFetch = (url: string, init?: RequestInit) =>
    handlers.handle(new Request(`http://localhost${url}`, init))
  const client = createKitDataSource<Row>({ endpoint: '/api/notes', fetch: fakeFetch })
  return { client, backend, handlers }
}

const req = (partial: Partial<ServerRequest> = {}): ServerRequest => ({
  startRow: 0, endRow: 50, pageIndex: 0, pageSize: 50, sortModel: [], filterModel: {}, ...partial,
})

describe('row scoping: reads', () => {
  it('returns only the caller tenant\'s rows', async () => {
    const { client } = wire('acme')
    const { rows } = await client.getRows(req())
    expect(rows.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('is unscoped when the resolver returns null', async () => {
    const { client } = wire(null)
    const { rows } = await client.getRows(req())
    expect(rows).toHaveLength(3)
  })

  it('a client-supplied tenant filter cannot widen the scope', async () => {
    const { client } = wire('acme')
    // Ask for globex explicitly - the server's predicate is written last.
    const { rows } = await client.getRows(
      req({ filterModel: { columns: { tenantId: { operator: 'equals', value: 'globex' } } } }),
    )
    expect(rows.every((r) => r.tenantId === 'acme')).toBe(true)
  })
})

describe('row scoping: writes', () => {
  it('stamps the tenant on create, overriding what the client sent', async () => {
    const { client, backend } = wire('acme')
    const created = await client.createRow!({ id: '9', name: 'New', tenantId: 'globex' } as Partial<Row>)
    expect(created.tenantId).toBe('acme')
    const { rows } = await backend.getRows(req())
    expect(rows.find((r) => r.id === '9')!.tenantId).toBe('acme')
  })

  it('rejects updating a row in another tenant', async () => {
    const { client } = wire('acme')
    await expect(client.updateRow!('3', { name: 'hacked' })).rejects.toThrow()
  })

  it('rejects deleting a row in another tenant', async () => {
    const { client } = wire('acme')
    await expect(client.deleteRow!('3')).rejects.toThrow()
  })

  it('leaves the other tenant\'s data untouched after a rejected write', async () => {
    const { client, backend } = wire('acme')
    await client.updateRow!('3', { name: 'hacked' }).catch(() => {})
    await client.deleteRow!('3').catch(() => {})
    const { rows } = await backend.getRows(req())
    expect(rows.find((r) => r.id === '3')).toEqual({ id: '3', name: 'Globex secret', tenantId: 'globex' })
  })

  it('allows updating and deleting the caller\'s own rows', async () => {
    const { client } = wire('acme')
    const updated = await client.updateRow!('1', { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
    await expect(client.deleteRow!('2')).resolves.not.toThrow()
  })

  it('a patch cannot move a row into another tenant', async () => {
    const { client, backend } = wire('acme')
    await client.updateRow!('1', { tenantId: 'globex' } as Partial<Row>)
    const { rows } = await backend.getRows(req())
    expect(rows.find((r) => r.id === '1')!.tenantId).toBe('acme')
  })
})

describe('row scoping: resolver failure', () => {
  it('rejects rather than falling through to an unscoped query', async () => {
    // The dangerous failure mode: "I cannot tell which tenant you are" must not
    // mean "show everything".
    const { client } = wire('acme', { throwOnResolve: true })
    await expect(client.getRows(req())).rejects.toThrow()
  })
})
