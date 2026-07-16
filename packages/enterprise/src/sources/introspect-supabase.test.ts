import { describe, expect, it } from 'vitest'
import { introspectSupabaseTable } from './introspect-supabase'

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

  it('returns null when nothing can determine the columns', async () => {
    const schema = await introspectSupabaseTable(opts(fetchFor({ openapiStatus: 404, sample: [], csv: '' })))
    expect(schema).toBeNull()
  })
})
