// @vitest-environment node
/**
 * `createColumnarDataSource` must answer every request exactly as the
 * in-memory reference does: same rows, same order, same counts, same
 * aggregate values to the last bit. The contract matrix in
 * `sveltekit/contract.test.ts` covers the documented cases on clean data;
 * this file throws seeded random requests at deliberately messy data - ties,
 * nulls, empty strings, accents and case, negative and fractional numbers,
 * a column that mixes numbers with text - where a shortcut would show.
 */
import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createInMemoryDataSource } from '../sveltekit/in-memory'
import { createColumnarDataSource } from './columnar'

type Row = {
  id: number
  name: string | null
  region: string
  qty: number
  price: number
  mixed: number | string | null
  active: boolean
  placed: string
}

function prng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296
  }
}

const NAMES = ['Émile', 'emile', 'Emile', 'Zoë', 'zoe', 'Ångström', 'apple', 'Apple', 'banana', '', null, 'b2', 'B10', 'b1']
const REGIONS = ['North', 'South', 'East', 'West', 'north', '']
const MIXED: Array<number | string | null> = [1, 2, '3', 'x', null, 10, '10', 0, -1]

function makeRows(n: number, seed: number): Row[] {
  const r = prng(seed)
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: pick(NAMES),
    region: pick(REGIONS),
    qty: Math.floor(r() * 7) - 2,
    price: Math.round(r() * 1000) / 8,
    mixed: pick(MIXED),
    active: r() < 0.5,
    placed: `2026-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
  }))
}

const schema: EntitySchema<Row> = {
  name: 'rows',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'region', type: 'text' },
    { field: 'qty', type: 'number' },
    { field: 'price', type: 'number' },
    { field: 'mixed', type: 'text' },
    { field: 'active', type: 'boolean' },
    { field: 'placed', type: 'text' },
  ],
}

const FIELDS = ['id', 'name', 'region', 'qty', 'price', 'mixed', 'active', 'placed']
const GROUPABLE = ['name', 'region', 'qty', 'mixed', 'active']
const OPS = ['equals', 'contains', 'startsWith', 'greaterThan', 'lessThan', 'between', 'isBlank']
const VALUES = ['', '0', '1', '2', '-1', 'e', 'E', 'ö', 'north', 'North', '10', '50', '2026-05', 'x', 'true']

function randomRequest(r: () => number, rows: Row[]): ServerRequest {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!
  const sortModel = Array.from({ length: Math.floor(r() * 4) }, () => ({ id: pick(FIELDS), desc: r() < 0.5 }))
  const columns: NonNullable<ServerRequest['filterModel']['columns']> = {}
  for (let k = Math.floor(r() * 3); k > 0; k -= 1) {
    const field = pick(FIELDS)
    if (r() < 0.2) columns[field] = { operator: 'equals', value: '', selectedValues: [pick(VALUES), pick(VALUES)] }
    else columns[field] = { operator: pick(OPS), value: pick(VALUES), valueTo: pick(VALUES) }
  }
  const groupBy = r() < 0.5 ? Array.from({ length: 1 + Math.floor(r() * 2) }, () => pick(GROUPABLE)) : []
  const depth = groupBy.length ? Math.floor(r() * (groupBy.length + 1)) : 0
  // Group keys taken from a real row, so expanded paths usually exist.
  const sample = pick(rows)
  const groupKeys = groupBy.slice(0, depth).map((f) => {
    const v = (sample as Record<string, unknown>)[f]
    return v == null ? '' : String(v)
  })
  const pageSize = pick([1, 5, 50, 1000])
  const startRow = pick([0, 0, 3, 40])
  return {
    startRow,
    endRow: startRow + pageSize,
    pageIndex: 0,
    pageSize,
    sortModel,
    filterModel: { columns, ...(r() < 0.3 ? { global: pick(VALUES) } : {}) },
    ...(groupBy.length ? { groupBy, groupKeys } : {}),
    aggregations: [
      { col: pick(['qty', 'price', 'mixed', 'id']), fn: pick(['sum', 'avg', 'min', 'max', 'count']) },
      { col: pick(['qty', 'price']), fn: pick(['sum', 'avg', 'min', 'max', 'count']) },
    ],
    ...(r() < 0.3 ? { needsGrandTotal: true } : {}),
    ...(groupBy.length && r() < 0.1 ? { pivotBy: ['active'], pivotMode: true } : {}),
  }
}

describe('createColumnarDataSource matches the reference', () => {
  const rows = makeRows(600, 7)

  it('on 600 seeded random requests over messy data', async () => {
    const reference = createInMemoryDataSource(rows, schema)
    const columnar = createColumnarDataSource(rows, schema)
    const r = prng(2026)
    let nonEmpty = 0
    for (let i = 0; i < 600; i += 1) {
      const request = randomRequest(r, rows)
      const expected = await reference.getRows(request)
      const actual = await columnar.getRows(request)
      if (expected.rows.length) nonEmpty += 1
      // Leaves must be the very same objects, in the same order.
      expect(actual, JSON.stringify(request)).toEqual(expected)
    }
    // Enough of the matrix has rows that the comparison means something,
    // and most of it went through the columnar path, not the fallback.
    expect(nonEmpty).toBeGreaterThan(300)
    expect(columnar.stats().columnar).toBeGreaterThan(350)
  })

  it('returns the reference row objects themselves for leaves', async () => {
    const columnar = createColumnarDataSource(rows, schema)
    const { rows: got } = await columnar.getRows({
      startRow: 0, endRow: 3, pageIndex: 0, pageSize: 3, sortModel: [{ id: 'name', desc: false }], filterModel: {},
    })
    for (const row of got) expect(rows).toContain(row)
  })

  it('stays equal after writes', async () => {
    const reference = createInMemoryDataSource(rows, schema)
    const columnar = createColumnarDataSource(rows, schema)
    const sorted: ServerRequest = {
      startRow: 0, endRow: 20, pageIndex: 0, pageSize: 20, sortModel: [{ id: 'price', desc: true }], filterModel: {},
    }
    await columnar.getRows(sorted) // fill the cache first
    for (const src of [reference, columnar]) {
      await src.updateRow('5', { price: 99999 })
      await src.deleteRow('6')
      await src.createRow({ id: 9001, name: 'new', region: 'North', qty: 1, price: 5, mixed: 1, active: true, placed: '2026-01-01' })
      await src.updateWhere({ columns: { region: { operator: 'equals', value: 'South' } } }, { qty: 42 }, { selectAll: true, toggled: [] })
    }
    expect(await columnar.getRows(sorted)).toEqual(await reference.getRows(sorted))
    const grouped: ServerRequest = { ...sorted, groupBy: ['region'], groupKeys: [], aggregations: [{ col: 'qty', fn: 'sum' }], needsGrandTotal: true }
    expect(await columnar.getRows(grouped)).toEqual(await reference.getRows(grouped))
  })

  it('warms one column per call until every field is built', () => {
    const columnar = createColumnarDataSource(rows, schema)
    let calls = 0
    while (columnar.warm()) calls += 1
    expect(calls).toBe(schema.fields.length)
    expect(columnar.warm()).toBe(false)
  })
})
