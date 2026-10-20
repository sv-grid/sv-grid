import { describe, expect, it } from 'vitest'
import { introspectSupabaseTable, listSupabaseTables } from './introspect-supabase'

type Parts = { openapi?: unknown; openapiStatus?: number; csv?: string; sample?: unknown }

function resp(opts: { status?: number; json?: unknown; text?: string; headers?: Record<string, string> }) {
  const status = opts.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: (k: string) => opts.headers?.[k.toLowerCase()] ?? null },
    json: async () => opts.json,
    text: async () => opts.text ?? '',
  } as unknown as Response
}

function fetchFor(parts: Parts): typeof globalThis.fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    const accept = (init?.headers as Record<string, string>)?.Accept
    if (u.endsWith('/rest/v1/')) return resp({ status: parts.openapiStatus ?? 200, json: parts.openapi })
    if (accept === 'text/csv') return resp({ text: parts.csv ?? '' })
    return resp({ json: parts.sample ?? [] })
  }) as unknown as typeof globalThis.fetch
}

const opts = (fetch: typeof globalThis.fetch) => ({ url: 'https://x.supabase.co', key: 'anon', table: 'customers', fetch })

describe('introspectSupabaseTable', () => {
  it('reads columns, types, and the primary key from the OpenAPI doc', async () => {
    const openapi = {
      definitions: {
        customers: {
          required: ['name'],
          properties: {
            id: { type: 'integer', description: 'Note:\nThis is a Primary Key.<pk/>' },
            name: { type: 'string' },
            active: { type: 'boolean' },
            tier: { type: 'string', enum: ['free', 'pro'] },
          },
        },
      },
    }
    const schema = await introspectSupabaseTable(opts(fetchFor({ openapi })))
    expect(schema?.idField).toBe('id')
    expect(schema?.fields.map((f) => [f.field, f.type])).toEqual([
      ['id', 'number'], ['name', 'text'], ['active', 'boolean'], ['tier', 'enum'],
    ])
    expect(schema?.fields.find((f) => f.field === 'id')).toMatchObject({ primaryKey: true, readonly: true })
    expect(schema?.fields.find((f) => f.field === 'name')?.required).toBe(true)
  })

  it('detects a foreign key from the OpenAPI description', async () => {
    const openapi = {
      definitions: {
        customers: {
          properties: {
            id: { type: 'integer', description: '<pk/>' },
            name: { type: 'string' },
            company_id: { type: 'integer', description: "Note:\nThis is a Foreign Key to `companies.id`.<fk table='companies' column='id'/>" },
          },
        },
      },
    }
    const schema = await introspectSupabaseTable(opts(fetchFor({ openapi })))
    const rel = schema?.fields.find((f) => f.field === 'company_id')
    expect(rel?.type).toBe('relation')
    expect(rel?.relation).toEqual({ entity: 'companies', foreignKey: 'company_id', labelField: 'name' })
  })

  it('supports the OpenAPI 3 components.schemas shape', async () => {
    const openapi = { components: { schemas: { customers: { properties: { name: { type: 'string' } } } } } }
    const schema = await introspectSupabaseTable(opts(fetchFor({ openapi })))
    expect(schema?.fields.map((f) => f.field)).toEqual(['name'])
  })

  it('falls back to the CSV header for an empty table when OpenAPI is blocked', async () => {
    // OpenAPI 404 (CORS/blocked), sample empty, CSV header present.
    const schema = await introspectSupabaseTable(
      opts(fetchFor({ openapiStatus: 404, sample: [], csv: 'id,Name\n' })),
    )
    expect(schema?.fields.map((f) => f.field)).toEqual(['id', 'Name'])
    expect(schema?.idField).toBe('id')
  })

  it('falls back to a sample row when OpenAPI is blocked and the table has data', async () => {
    const schema = await introspectSupabaseTable(
      opts(fetchFor({ openapiStatus: 404, sample: [{ id: 1, name: 'Ada', active: true }] })),
    )
    expect(schema?.fields.map((f) => [f.field, f.type])).toEqual([
      ['id', 'number'], ['name', 'text'], ['active', 'boolean'],
    ])
  })

  it('works with the default fetch, which a browser refuses to call as a method', async () => {
    // The browser's fetch throws "Illegal invocation" when its receiver is
    // not the window. Called as `options.fetch(...)` it got the options
    // object, every path caught that as "no answer", and baseFromSupabase
    // found no table at all unless the caller passed a fetch of their own.
    const real = globalThis.fetch
    const sample = fetchFor({ openapiStatus: 401, sample: [{ id: 1, name: 'Chai' }] })
    globalThis.fetch = function (this: unknown, url: string | URL, init?: RequestInit) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation")
      return sample(url, init)
    } as typeof globalThis.fetch
    try {
      const s = await introspectSupabaseTable({ url: 'https://x.supabase.co', key: 'anon', table: 'products' })
      expect(s?.fields.map((f) => f.field)).toEqual(['id', 'name'])
    } finally {
      globalThis.fetch = real
    }
  })

  it('returns null when nothing can determine the columns', async () => {
    const schema = await introspectSupabaseTable(opts(fetchFor({ openapiStatus: 404, sample: [], csv: '' })))
    expect(schema).toBeNull()
  })
})

describe('listSupabaseTables', () => {
  it('lists table names from the OpenAPI definitions (sorted)', async () => {
    const openapi = { definitions: { orders: {}, customers: {}, deals: {} } }
    const tables = await listSupabaseTables('https://x.supabase.co', 'anon', fetchFor({ openapi }))
    expect(tables).toEqual(['customers', 'deals', 'orders'])
  })

  it('returns [] for a project with no tables, and for a doc restricted for this key', async () => {
    expect(await listSupabaseTables('https://x.supabase.co', 'anon', fetchFor({ openapi: { definitions: {} } }))).toEqual([])
    // 401 / 403 that does not call the key invalid: each table still introspects by name.
    expect(await listSupabaseTables('https://x.supabase.co', 'anon', fetchFor({ openapiStatus: 401 }))).toEqual([])
    expect(await listSupabaseTables('https://x.supabase.co', 'anon', fetchFor({ openapiStatus: 403 }))).toEqual([])
  })

  it('throws, naming the URL, when the project cannot be reached or does not answer as one', async () => {
    const down = (async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    await expect(listSupabaseTables('https://typo.supabase.co/', 'anon', down)).rejects.toThrow('Could not reach https://typo.supabase.co/rest/v1/ (fetch failed)')
    const answer = (status: number, text: string) => (async () => resp({ status, text })) as unknown as typeof fetch
    await expect(listSupabaseTables('https://x.supabase.co', 'bad', answer(401, '{"message":"Invalid API key"}'))).rejects.toThrow('https://x.supabase.co/rest/v1/ answered 401 (invalid API key)')
    await expect(listSupabaseTables('https://x.supabase.co', 'anon', answer(404, 'Not Found'))).rejects.toThrow('https://x.supabase.co/rest/v1/ answered 404')
    await expect(listSupabaseTables('https://x.supabase.co', 'anon', answer(500, ''))).rejects.toThrow('answered 500')
    // A 200 that is not an API description: an ordinary web page at that URL.
    const page = (async () => ({ ...resp({}), json: async () => { throw new SyntaxError('Unexpected token <') } })) as unknown as typeof fetch
    await expect(listSupabaseTables('https://example.com', 'anon', page)).rejects.toThrow('https://example.com/rest/v1/ did not answer with an API description')
    await expect(listSupabaseTables('https://example.com', 'anon', fetchFor({ openapi: { hello: 'world' } }))).rejects.toThrow('did not answer with an API description')
  })
})
