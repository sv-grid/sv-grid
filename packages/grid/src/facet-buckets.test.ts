/**
 * Unit tests for the facet value-bucketing helpers: isBucketableColumn,
 * buildBuckets, isInBucket. These are pure functions - the only grid
 * coupling is the Column type (we use createSvGrid to mint real columns
 * carrying an `editorType`) and the rawToNumber/format helpers.
 */
import { describe, expect, it } from 'vitest'
import {
  createCoreRowModel,
  createSvGrid,
  tableFeatures,
  rowSortingFeature,
  type Column,
  type ColumnDef,
  type RowData,
} from './index'
import {
  isBucketableColumn,
  buildBuckets,
  isInBucket,
  type FacetBucket,
} from './facet-buckets'

type Row = {
  id: string
  num: number
  when: string
  name: string
  flag: boolean
}

const features = tableFeatures({ rowSortingFeature })

/** Build a real grid and return its columns keyed by id so tests can grab
 *  a genuine Column<Row> object (with columnDef.editorType populated). */
function makeColumns(): Record<string, Column<Row>> {
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id', header: 'ID', editorType: 'text' },
    { field: 'num', header: 'Number', editorType: 'number' },
    { field: 'when', header: 'When', editorType: 'date' },
    { field: 'name', header: 'Name' }, // no editorType
    { field: 'flag', header: 'Flag', editorType: 'checkbox' },
  ]
  const grid = createSvGrid<typeof features, Row>({
    _features: features,
    _rowModels: { coreRowModel: createCoreRowModel<Row>() },
    columns,
    data: [],
  })
  const byId: Record<string, Column<Row>> = {}
  for (const c of grid.getAllColumns()) byId[c.id] = c as Column<Row>
  return byId
}

// Field accessor used by buildBuckets in production - read the property
// matching the column id off the row.
function accessor<TData extends RowData>(row: TData, column: Column<TData>): unknown {
  return (row as Record<string, unknown>)[column.id]
}

describe('isBucketableColumn', () => {
  const cols = makeColumns()

  it('returns { isDate: false } for a number column', () => {
    expect(isBucketableColumn(cols.num!)).toEqual({ isDate: false })
  })

  it('returns { isDate: true } for a date column', () => {
    expect(isBucketableColumn(cols.when!)).toEqual({ isDate: true })
  })

  it('returns { isDate: true } for a datetime column', () => {
    const grid = createSvGrid<typeof features, Row>({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      columns: [{ field: 'when', header: 'When', editorType: 'datetime' }],
      data: [],
    })
    const col = grid.getAllColumns().find((c) => c.id === 'when') as Column<Row>
    expect(isBucketableColumn(col)).toEqual({ isDate: true })
  })

  it('returns null for a text column', () => {
    expect(isBucketableColumn(cols.id!)).toBeNull()
  })

  it('returns null for a checkbox column', () => {
    expect(isBucketableColumn(cols.flag!)).toBeNull()
  })

  it('returns null for a column with no editorType', () => {
    expect(isBucketableColumn(cols.name!)).toBeNull()
  })
})

describe('buildBuckets - numeric', () => {
  const cols = makeColumns()

  it('returns null when distinct values do not exceed the threshold (30)', () => {
    // 30 distinct values -> not > 30 -> null
    const data: Row[] = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      num: i,
      when: '',
      name: '',
      flag: false,
    }))
    expect(buildBuckets(cols.num!, false, data, accessor)).toBeNull()
  })

  it('builds 10 buckets when distinct values exceed the threshold', () => {
    // 31 distinct values 0..30 -> > 30 -> buckets
    const data: Row[] = Array.from({ length: 31 }, (_, i) => ({
      id: String(i),
      num: i,
      when: '',
      name: '',
      flag: false,
    }))
    const buckets = buildBuckets(cols.num!, false, data, accessor)
    expect(buckets).not.toBeNull()
    expect(buckets!).toHaveLength(10)
  })

  it('spans the full numeric range with contiguous edges', () => {
    const data: Row[] = Array.from({ length: 31 }, (_, i) => ({
      id: String(i),
      num: i, // 0..30
      when: '',
      name: '',
      flag: false,
    }))
    const buckets = buildBuckets(cols.num!, false, data, accessor)!
    expect(buckets[0]!.numericMin).toBe(0)
    expect(buckets[9]!.numericMax).toBe(30)
    // bucket i's max equals bucket i+1's min (contiguous, no gaps)
    for (let i = 0; i < buckets.length - 1; i += 1) {
      expect(buckets[i]!.numericMax).toBeCloseTo(buckets[i + 1]!.numericMin, 10)
    }
  })

  it('flags only the final bucket as isLast and sets isDate=false', () => {
    const data: Row[] = Array.from({ length: 31 }, (_, i) => ({
      id: String(i),
      num: i,
      when: '',
      name: '',
      flag: false,
    }))
    const buckets = buildBuckets(cols.num!, false, data, accessor)!
    expect(buckets.filter((b) => b.isLast)).toHaveLength(1)
    expect(buckets[9]!.isLast).toBe(true)
    expect(buckets[0]!.isLast).toBe(false)
    expect(buckets.every((b) => b.isDate === false)).toBe(true)
  })

  it('uses numeric labels containing an en-dash separator', () => {
    const data: Row[] = Array.from({ length: 31 }, (_, i) => ({
      id: String(i),
      num: i,
      when: '',
      name: '',
      flag: false,
    }))
    const buckets = buildBuckets(cols.num!, false, data, accessor)!
    expect(buckets[0]!.label).toContain('–')
  })

  it('ignores non-finite / blank values when computing min/max and distinct', () => {
    // 31 numeric values plus a pile of null/undefined/empty/NaN-ish ones
    const data: Row[] = [
      ...Array.from({ length: 31 }, (_, i) => ({
        id: String(i),
        num: i,
        when: '',
        name: '',
        flag: false,
      })),
      { id: 'a', num: null as unknown as number, when: '', name: '', flag: false },
      { id: 'b', num: undefined as unknown as number, when: '', name: '', flag: false },
      { id: 'c', num: 'not-a-number' as unknown as number, when: '', name: '', flag: false },
    ]
    const buckets = buildBuckets(cols.num!, false, data, accessor)!
    // range is still 0..30 - the junk rows were skipped
    expect(buckets[0]!.numericMin).toBe(0)
    expect(buckets[9]!.numericMax).toBe(30)
  })

  it('returns null when all finite values are identical (min === max)', () => {
    // 40 rows but every num is 5 -> distinct.size === 1 -> <= threshold -> null.
    // (Also exercises the min === max guard via a distinct-but-uniform case below.)
    const data: Row[] = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      num: 5,
      when: '',
      name: '',
      flag: false,
    }))
    expect(buildBuckets(cols.num!, false, data, accessor)).toBeNull()
  })

  it('returns null when there is no finite data at all', () => {
    const data: Row[] = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      num: null as unknown as number,
      when: '',
      name: '',
      flag: false,
    }))
    expect(buildBuckets(cols.num!, false, data, accessor)).toBeNull()
  })

  it('returns null for an empty dataset', () => {
    expect(buildBuckets(cols.num!, false, [], accessor)).toBeNull()
  })

  it('handles negative ranges', () => {
    const data: Row[] = Array.from({ length: 41 }, (_, i) => ({
      id: String(i),
      num: i - 20, // -20..20, 41 distinct
      when: '',
      name: '',
      flag: false,
    }))
    const buckets = buildBuckets(cols.num!, false, data, accessor)!
    expect(buckets[0]!.numericMin).toBe(-20)
    expect(buckets[9]!.numericMax).toBe(20)
  })
})

describe('buildBuckets - date', () => {
  const cols = makeColumns()

  it('builds buckets from date strings with isDate=true and date labels', () => {
    const start = Date.UTC(2020, 0, 1)
    const day = 24 * 60 * 60 * 1000
    const data: Row[] = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      num: 0,
      when: new Date(start + i * day).toISOString(),
      name: '',
      flag: false,
    }))
    const buckets = buildBuckets(cols.when!, true, data, accessor)!
    expect(buckets).toHaveLength(10)
    expect(buckets.every((b) => b.isDate === true)).toBe(true)
    // labels should look like dates (contain a 4-digit year)
    expect(buckets[0]!.label).toMatch(/\d{4}/)
  })

  it('accepts Date instances directly', () => {
    const start = Date.UTC(2020, 0, 1)
    const day = 24 * 60 * 60 * 1000
    const data: Array<{ id: string; when: Date }> = Array.from(
      { length: 40 },
      (_, i) => ({ id: 'when' + i, when: new Date(start + i * day) }),
    )
    // accessor reads row[column.id]; column id is 'when'
    const rows = data.map((d) => ({ when: d.when })) as unknown as Row[]
    const buckets = buildBuckets(cols.when!, true, rows, accessor)!
    expect(buckets).toHaveLength(10)
    expect(buckets[0]!.numericMin).toBe(start)
  })

  it('returns null when date values are too few', () => {
    const data: Row[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      num: 0,
      when: new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
      name: '',
      flag: false,
    }))
    expect(buildBuckets(cols.when!, true, data, accessor)).toBeNull()
  })

  it('skips invalid date strings', () => {
    const start = Date.UTC(2021, 0, 1)
    const day = 24 * 60 * 60 * 1000
    const data: Row[] = [
      ...Array.from({ length: 40 }, (_, i) => ({
        id: String(i),
        num: 0,
        when: new Date(start + i * day).toISOString(),
        name: '',
        flag: false,
      })),
      { id: 'bad', num: 0, when: 'not-a-date', name: '', flag: false },
    ]
    const buckets = buildBuckets(cols.when!, true, data, accessor)!
    expect(buckets).toHaveLength(10)
    expect(buckets[0]!.numericMin).toBe(start)
  })
})

describe('isInBucket', () => {
  const mid: FacetBucket = {
    label: '10 - 20',
    numericMin: 10,
    numericMax: 20,
    isLast: false,
    isDate: false,
  }
  const last: FacetBucket = {
    label: '20 - 30',
    numericMin: 20,
    numericMax: 30,
    isLast: true,
    isDate: false,
  }

  it('returns false for non-finite numbers', () => {
    expect(isInBucket(Number.NaN, mid)).toBe(false)
    expect(isInBucket(Number.POSITIVE_INFINITY, mid)).toBe(false)
  })

  it('returns false below the lower bound', () => {
    expect(isInBucket(9.999, mid)).toBe(false)
  })

  it('includes the lower bound', () => {
    expect(isInBucket(10, mid)).toBe(true)
  })

  it('excludes the upper bound for a non-last bucket (half-open interval)', () => {
    expect(isInBucket(20, mid)).toBe(false)
    expect(isInBucket(19.999, mid)).toBe(true)
  })

  it('includes the upper bound for the last bucket (closed interval)', () => {
    expect(isInBucket(30, last)).toBe(true)
    expect(isInBucket(20, last)).toBe(true)
  })

  it('rejects values past the upper bound even on the last bucket', () => {
    expect(isInBucket(30.0001, last)).toBe(false)
  })

  it('partitions a value into exactly one bucket across a built set', () => {
    const cols = makeColumns()
    const data: Row[] = Array.from({ length: 101 }, (_, i) => ({
      id: String(i),
      num: i, // 0..100
      when: '',
      name: '',
      flag: false,
    }))
    const buckets = buildBuckets(cols.num!, false, data, accessor)!
    for (const v of [0, 1, 15, 50, 99, 100]) {
      const hits = buckets.filter((b) => isInBucket(v, b))
      expect(hits).toHaveLength(1)
    }
  })
})
