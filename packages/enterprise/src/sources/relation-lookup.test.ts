import { describe, expect, it, vi } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createRelationLookup } from './relation-lookup'

type Company = { id: number; name: string }

const companies: Company[] = [
  { id: 1, name: 'Acme Inc' },
  { id: 2, name: 'Globex' },
  { id: 3, name: 'Initech' },
]

const schema: EntitySchema<Company> = {
  name: 'companies',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true },
    { field: 'name', type: 'text' },
  ],
}

/** Minimal getRows over the array: honors global search + an equals filter on id. */
function source() {
  const getRows = vi.fn(async (req: ServerRequest) => {
    let rows = companies
    const g = req.filterModel.global?.toLowerCase()
    if (g) rows = rows.filter((c) => c.name.toLowerCase().includes(g))
    const idCol = req.filterModel.columns?.id
    if (idCol?.selectedValues) rows = rows.filter((c) => idCol.selectedValues!.includes(String(c.id)))
    else if (idCol) rows = rows.filter((c) => String(c.id) === idCol.value)
    return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
  })
  return { getRows }
}

describe('createRelationLookup', () => {
  it('searches and maps rows to { value, label }', async () => {
    const lookup = createRelationLookup({ source: source(), schema, labelField: 'name' })
    expect(await lookup.search('in')).toEqual([
      { value: '1', label: 'Acme Inc', row: { id: 1, name: 'Acme Inc' } },
      { value: '3', label: 'Initech', row: { id: 3, name: 'Initech' } },
    ])
  })

  it('returns a full page for an empty query', async () => {
    const lookup = createRelationLookup({ source: source(), schema, labelField: 'name' })
    expect((await lookup.search('')).map((o) => o.label)).toEqual(['Acme Inc', 'Globex', 'Initech'])
  })

  it('resolves a stored key to its label', async () => {
    const lookup = createRelationLookup({ source: source(), schema, labelField: 'name' })
    expect(await lookup.labelFor(2)).toBe('Globex')
  })

  it('caches labels seen during search (no extra getRows for labelFor)', async () => {
    const src = source()
    const lookup = createRelationLookup({ source: src, schema, labelField: 'name' })
    await lookup.search('acme') // caches value 1 -> Acme Inc
    src.getRows.mockClear()
    expect(await lookup.labelFor(1)).toBe('Acme Inc')
    expect(src.getRows).not.toHaveBeenCalled()
  })

  it('returns null for an empty value and the key itself when unresolved', async () => {
    const lookup = createRelationLookup({ source: source(), schema, labelField: 'name' })
    expect(await lookup.labelFor('')).toBeNull()
    expect(await lookup.labelFor(999)).toBe('999')
  })

  it('honors an explicit valueField over the schema id', async () => {
    const lookup = createRelationLookup({ source: source(), labelField: 'name', valueField: 'name' })
    const opts = await lookup.search('glob')
    expect(opts[0]).toMatchObject({ value: 'Globex', label: 'Globex' })
  })

  describe('labelsFor (batch)', () => {
    it('resolves many keys in a single request (no N+1), deduping', async () => {
      const src = source()
      const lookup = createRelationLookup({ source: src, schema, labelField: 'name' })
      const map = await lookup.labelsFor([1, 2, 2, 3, null, ''])
      expect(map.get('1')).toBe('Acme Inc')
      expect(map.get('2')).toBe('Globex')
      expect(map.get('3')).toBe('Initech')
      expect(src.getRows).toHaveBeenCalledTimes(1) // one query for all misses
    })

    it('serves cached keys without a request, and maps unresolved keys to themselves', async () => {
      const src = source()
      const lookup = createRelationLookup({ source: src, schema, labelField: 'name' })
      await lookup.labelsFor([1]) // warm the cache
      src.getRows.mockClear()
      const map = await lookup.labelsFor([1, 999])
      expect(map.get('1')).toBe('Acme Inc') // cached
      expect(map.get('999')).toBe('999') // unresolved -> itself
      expect(src.getRows).toHaveBeenCalledTimes(1) // only the miss (999)
    })
  })
})
