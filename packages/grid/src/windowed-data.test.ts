/**
 * Windowed data: an array whose entries are read on demand, so a server row
 * model can hand the grid 100M rows without building 100M of anything.
 */
import { describe, expect, it } from 'vitest'
import { createWindowedData, isWindowedData, windowedSourceOf } from './windowed-data'
import { createSvGridCore } from './core'
import { createCoreRowModel, tableFeatures } from './index'
import { createBlockCache } from './server-block-cache'

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
