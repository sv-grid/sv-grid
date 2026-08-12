import { describe, expect, it } from 'vitest'
import { introspectOpenApi } from './introspect-openapi'

// A petstore-ish spec: bare-array list, $ref item schema, an enum, a nested $ref
// relation (pet.category -> Category), and a wrapped-list resource (orders).
const spec = {
  openapi: '3.0.3',
  servers: [{ url: 'https://api.example.com/v1/' }],
  paths: {
    '/pets': {
      get: { responses: { '200': { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } } } } }, parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }] },
      post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } },
    },
    '/pets/{petId}': {
      get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } } },
      put: { responses: { '200': {} } },
      delete: { responses: { '204': {} } },
    },
    '/categories': { get: { responses: { '200': { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } } } } } },
    '/orders': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderList' } } } } } } },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['available', 'pending', 'sold'] },
          bornOn: { type: 'string', format: 'date' },
          category: { $ref: '#/components/schemas/Category' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      Category: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } },
      Order: { type: 'object', properties: { id: { type: 'integer' }, total: { type: 'number' }, placedAt: { type: 'string', format: 'date-time' } } },
      OrderList: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Order' } }, total: { type: 'integer' } } },
    },
  },
}

describe('introspectOpenApi', () => {
  const out = introspectOpenApi(JSON.stringify(spec))

  it('groups paths into one entity + one REST source per resource', () => {
    expect(out.entities.map((e) => e.name).sort()).toEqual(['category', 'order', 'pet'])
    const pet = out.sources.pet
    expect(pet).toMatchObject({ kind: 'rest', baseUrl: 'https://api.example.com/v1', path: 'pets', method: 'GET', idField: 'id' })
    // query parameters carried onto the source
    if (pet?.kind === 'rest') expect(pet.params).toEqual([{ name: 'status', location: 'query', type: 'string' }])
  })

  it('maps JSON-Schema types + formats + enums + pk', () => {
    const pet = out.entities.find((e) => e.name === 'pet')!
    const byName = new Map(pet.fields.map((f) => [f.field, f]))
    expect(byName.get('id')).toMatchObject({ type: 'number', primaryKey: true })
    expect(byName.get('name')).toMatchObject({ type: 'text', required: true })
    expect(byName.get('status')).toMatchObject({ type: 'enum' })
    expect(byName.get('status')!.options!.map((o) => o.value)).toEqual(['available', 'pending', 'sold'])
    expect(byName.get('bornOn')!.type).toBe('dateString')
    expect(byName.get('tags')!.type).toBe('json')
  })

  it('turns a $ref property into a relation to the referenced entity', () => {
    const pet = out.entities.find((e) => e.name === 'pet')!
    const category = pet.fields.find((f) => f.field === 'category')!
    expect(category).toMatchObject({ type: 'relation', relation: { entity: 'category', foreignKey: 'category' } })
  })

  it('detects a wrapped list response (rowsPath = data) + item schema behind it', () => {
    const src = out.sources.order
    expect(src?.kind === 'rest' ? src.rowsPath : null).toBe('data')
    const order = out.entities.find((e) => e.name === 'order')!
    expect(order.fields.map((f) => f.field).sort()).toEqual(['id', 'placedAt', 'total'])
    expect(order.fields.find((f) => f.field === 'placedAt')!.type).toBe('datetime')
  })

  it('rejects non-JSON and non-OpenAPI input with clear errors', () => {
    expect(() => introspectOpenApi('name: swagger')).toThrow(/JSON only/)
    expect(() => introspectOpenApi('{"foo":1}')).toThrow(/no "paths"/)
    expect(() => introspectOpenApi('{"paths":{}}')).toThrow(/No REST resources/)
  })
})
