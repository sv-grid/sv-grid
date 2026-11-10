/**
 * Windowed data: an array whose entries are read on demand, so a server row
 * model can hand the grid 100M rows without building 100M of anything.
 */
import { describe, expect, it } from 'vitest'
import { createWindowedData, isWindowedData, windowedSourceOf } from './windowed-data'
import { createSvGridCore } from './core'
import { createCoreRowModel, tableFeatures } from './index'
import { createBlockCache } from './server-block-cache'
import { rowsToWrite } from './cell-values'

describe('createWindowedData', () => {
  it('reports the length and reads entries through at()', () => {
    const reads: number[] = []
    const data = createWindowedData(100_000_000, (i) => {
      reads.push(i)
      return { id: i }
    })
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(100_000_000)
    expect(data[99_999_999]).toEqual({ id: 99_999_999 })
    expect(data[100_000_000]).toBeUndefined()
    expect(reads).toEqual([99_999_999])
  })

  it('is recognised, and ordinary arrays are not', () => {
    const data = createWindowedData(3, (i) => i)
    expect(isWindowedData(data)).toBe(true)
    expect(windowedSourceOf(data)?.length).toBe(3)
    expect(isWindowedData([1, 2, 3])).toBe(false)
    expect(isWindowedData(null)).toBe(false)
  })

  it('still iterates like an array', () => {
    const data = createWindowedData(4, (i) => i * 10)
    expect([...data]).toEqual([0, 10, 20, 30])
    expect(data.slice(1, 3)).toEqual([10, 20])
    expect(2 in data).toBe(true)
    expect(9 in data).toBe(false)
  })

  it('finds a row among what is loaded: an edit deep in a million rows reads no others', () => {
    const rows = new Map([[5, { id: 5 }], [999_000, { id: 999_000 }]])
    let reads = 0
    const data = createWindowedData(1_000_000, (i) => {
      reads += 1
      return rows.get(i) ?? { id: -1, placeholder: true }
    }, () => [...rows.keys()])
    const deep = rows.get(999_000)!
    expect(data.find((r) => r.id === 999_000)).toBe(deep)
    expect(data.findIndex((r) => r.id === 999_000)).toBe(999_000)
    expect(data.indexOf(deep as never)).toBe(999_000)
    expect(data.some((r) => r.id === 5)).toBe(true)
    expect(reads).toBeLessThan(20)
    // What is not there is found out as quickly.
    reads = 0
    expect(data.find((r) => r.id === 7)).toBeUndefined()
    expect(data.findIndex((r) => r.id === 7)).toBe(-1)
    expect(data.indexOf({ id: 7 } as never)).toBe(-1)
    expect(data.some((r) => r.id === 7)).toBe(false)
    expect(reads).toBeLessThan(20)
    // The rest is an array's: a copy of it is one.
    expect(data.constructor).toBe(Array)
    expect(createWindowedData(2, (i) => i, () => [0, 1]).slice()).toEqual([0, 1])
  })

  it('walks every entry when the source cannot say what is loaded', () => {
    const data = createWindowedData(3, (i) => ({ id: i }))
    expect(data.find((r) => r.id === 2)).toEqual({ id: 2 })
    expect(data.findIndex((r) => r.id === 2)).toBe(2)
  })

  it('refuses writes', () => {
    const data = createWindowedData(2, (i) => i) as number[]
    expect(() => {
      'use strict'
      data[0] = 5
    }).toThrow()
  })
})

describe('core row model over windowed data', () => {
  function grid(data: unknown) {
    return createSvGridCore({
      _features: tableFeatures({}),
      _rowModels: { coreRowModel: createCoreRowModel() },
      columns: [{ field: 'v', header: 'V' }],
      data: data as any[],
      getRowId: (r: any) => String(r.id),
      state: {},
    } as any)
  }

  it('builds a row only for the indices that are read', () => {
    let reads = 0
    const data = createWindowedData(50_000_000, (i) => {
      reads += 1
      return { id: i, v: i * 2 }
    })
    const rows = grid(data).getRowModel().rows
    expect(rows.length).toBe(50_000_000)
    expect(reads).toBe(0)
    const row = rows[25_000_000]!
    expect(row.id).toBe('25000000')
    expect(row.index).toBe(25_000_000)
    expect(row.getCellValueByColumnId('v')).toBe(50_000_000)
    expect(reads).toBe(1)
  })

  it('keeps a row object while its data object is the same', () => {
    const objects = [{ id: 0, v: 1 }, { id: 1, v: 2 }]
    const g = grid(createWindowedData(2, (i) => objects[i]))
    const first = g.getRowModel().rows[1]
    expect(g.getRowModel().rows[1]).toBe(first)
  })
})

describe('rowsToWrite', () => {
  const windowed = (reads: { n: number }) => {
    const held = new Map([[10, { id: 10 }], [999_999, { id: 999_999 }]])
    return { held, data: createWindowedData(1_000_000, (i) => {
      reads.n += 1
      return held.get(i)
    }, () => [...held.keys()]) }
  }

  it('over rows held in place, copies what is loaded and finds each row its slot', () => {
    const reads = { n: 0 }
    const { held, data } = windowed(reads)
    const { next, dataIndexOf } = rowsToWrite<{ id: number }>({ props: { holdRowsOnWrite: true }, internalData: data })
    expect(reads.n).toBeLessThan(10)
    const row = { index: 999_999, original: held.get(999_999)! }
    expect(dataIndexOf(row as never)).toBe(999_999)
    expect(next[999_999]).toBe(held.get(999_999))
    expect(dataIndexOf({ index: 3, original: { id: 3 } } as never)).toBe(-1)
  })

  it('a row a writer has replaced in the copy is still that row: its second column finds it', () => {
    const { held, data } = windowed({ n: 0 })
    const { next, dataIndexOf } = rowsToWrite<{ id: number }>({ props: { holdRowsOnWrite: true }, internalData: data })
    const row = { index: 10, original: held.get(10)! }
    next[10] = { ...held.get(10)!, id: 11 }
    expect(dataIndexOf(row as never)).toBe(10)
  })

  it('without that, the whole list: it becomes the rows', () => {
    const rows = [{ id: 1 }, { id: 2 }]
    const { next, dataIndexOf } = rowsToWrite<{ id: number }>({ props: {}, internalData: rows })
    expect(next).toEqual(rows)
    expect(next).not.toBe(rows)
    expect(dataIndexOf({ original: rows[1] } as never)).toBe(1)
  })
})

describe('block cache windowedRows', () => {
  it('spans the row count without materialising it', async () => {
    const cache = createBlockCache<{ id: number }>({
      blockSize: 100,
      initialRowCount: 1,
      fetch: async (start, end) => ({
        rows: Array.from({ length: end - start }, (_, k) => ({ id: start + k })),
        rowCount: 100_000_000,
      }),
      onChange: () => {},
    })
    cache.setViewport(0, 10)
    for (let i = 0; i < 10; i += 1) await Promise.resolve()
    const rows = cache.windowedRows()
    expect(rows.length).toBe(100_000_000)
    expect(rows[5]).toEqual({ id: 5 })
    expect(cache.windowedRows()).toBe(rows) // memoised until the next change
    cache.dispose()
  })
})
