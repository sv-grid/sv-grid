import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importData, mapImportMatrix, mapImportMatrixAsync, readImportMatrix } from './import'
import { clearLicenseKey, setLicenseKey } from './license'

function fakeApi() {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const api = {
    getColumns: () => [{ field: 'name', header: 'Name' }],
    addRows: (...args: unknown[]) => calls.push({ method: 'addRows', args }),
  }
  return { api: api as any, calls }
}

beforeEach(() => setLicenseKey('SVENTERPRISE-DEV-TEST'))
afterEach(() => clearLicenseKey())

describe('security: prototype pollution', () => {
  // NOTE: each test here must FAIL if the UNSAFE_FIELDS guard is removed.
  // A string assigned to `__proto__` is a JS no-op, so a naive test would
  // pass either way - we force real reparenting with an object value, or use
  // `constructor` (a normal writable key that DOES become an own prop).

  it('drops a "constructor" header instead of writing it as an own prop', async () => {
    const { api } = fakeApi()
    // Without the guard: rec.constructor = 'X' becomes a real own property.
    const r = await importData(api, { file: 'constructor,name\nX,ok', format: 'csv' })
    expect(Object.prototype.hasOwnProperty.call(r.rows[0], 'constructor')).toBe(false)
    expect(r.rows[0]).toEqual({ name: 'ok' })
  })

  it('never reparents a row through a __proto__ column, even with json coercion', async () => {
    const { api } = fakeApi()
    // With json coercion the cell becomes an OBJECT; without the guard,
    // `rec['__proto__'] = { isAdmin: true }` would reparent the row so that
    // `row.isAdmin` reads true off the polluted prototype.
    const json = '[{"__proto__":{"isAdmin":true},"id":1}]'
    const r = await importData(api, { file: json, format: 'json', columnTypes: { __proto__: 'json' } })
    expect(Object.getPrototypeOf(r.rows[0])).toBe(Object.prototype)
    expect((r.rows[0] as Record<string, unknown>).isAdmin).toBeUndefined()
    expect(r.rows[0]).toEqual({ id: 1 })
  })

  it('drops constructor / prototype JSON keys', async () => {
    const { api } = fakeApi()
    // Both are own enumerable keys on the parsed object, so without the guard
    // they land in the row and break the toEqual.
    const json = JSON.stringify([{ constructor: 'x', prototype: 'y', a: 1 }])
    const r = await importData(api, { file: json, format: 'json' })
    expect(r.rows[0]).toEqual({ a: 1 })
  })

  it('refuses an unsafe target even from an explicit columnMap', () => {
    // Exercises the columnMap branch of computeFields (not the default one).
    const r = mapImportMatrix(
      [['h', 'name'], ['{"x":1}', 'ok']],
      { columnMap: { h: '__proto__' }, columnTypes: { __proto__: 'json' } },
    )
    expect(Object.getPrototypeOf(r.rows[0])).toBe(Object.prototype)
    expect(r.rows[0]).toEqual({ name: 'ok' })
  })

  it('skips a blank header rather than writing an empty-key field', () => {
    // Without the guard, the empty header maps to field '' and rec[''] = 'orphan'.
    const r = mapImportMatrix([['name', ''], ['A', 'orphan']])
    expect(r.rows[0]).toEqual({ name: 'A' })
  })
})

describe('guard-rails: size + rows + errors', () => {
  it('rejects a File/Blob over maxBytes before reading', async () => {
    const { api } = fakeApi()
    const blob = new Blob(['a,b\n1,2\n'])
    await expect(importData(api, { file: blob, format: 'csv', maxBytes: 3 })).rejects.toThrow(/import limit/)
  })

  it('rejects more rows than maxRows', async () => {
    const { api } = fakeApi()
    const csv = 'name\n' + Array.from({ length: 5 }, (_, i) => `r${i}`).join('\n')
    await expect(importData(api, { file: csv, format: 'csv', maxRows: 3 })).rejects.toThrow(/maxRows/)
  })

  it("overLimit:'truncate' keeps the first maxRows and flags it", async () => {
    const { api } = fakeApi()
    const csv = 'name\n' + Array.from({ length: 5 }, (_, i) => `r${i}`).join('\n')
    const r = await importData(api, { file: csv, format: 'csv', maxRows: 3, overLimit: 'truncate' })
    expect(r.rows).toHaveLength(3)
    expect(r.rows.map((x: any) => x.name)).toEqual(['r0', 'r1', 'r2'])
    expect(r.truncated).toBe(true)
    expect(r.total).toBe(5) // original count preserved
  })

  it('caps collected errors at maxErrors and flags truncation', async () => {
    const { api } = fakeApi()
    const csv = 'n\nx\ny\nz\nw'
    const r = await importData(api, {
      file: csv,
      format: 'csv',
      columnTypes: { n: 'number' },
      maxErrors: 2,
    })
    expect(r.errors).toHaveLength(2)
    expect(r.errorsTruncated).toBe(true)
  })
})

describe('dedupeBy', () => {
  it('keeps the last occurrence of each key, in place', () => {
    const r = mapImportMatrix(
      [
        ['id', 'v'],
        ['1', 'a'],
        ['2', 'b'],
        ['1', 'c'], // dup of id 1 -> overrides "a" at position 0
      ],
      { dedupeBy: 'id' },
    )
    expect(r.rows).toEqual([{ id: 1, v: 'c' }, { id: 2, v: 'b' }])
    expect(r.deduped).toBe(1)
  })
})

describe('cancellation', () => {
  it('throws AbortError when the signal is already aborted', async () => {
    const { api } = fakeApi()
    const controller = new AbortController()
    controller.abort()
    await expect(
      importData(api, { file: 'name\nA', format: 'csv', signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('mapImportMatrixAsync', () => {
  it('matches the sync mapper and reports progress to completion', async () => {
    const matrix = [['name'], ...Array.from({ length: 10 }, (_, i) => [`n${i}`])]
    const ticks: number[] = []
    const r = await mapImportMatrixAsync(matrix, {
      chunkSize: 3,
      onProgress: (p) => ticks.push(p.ratio),
    })
    expect(r.rows).toHaveLength(10)
    expect(r.rows).toEqual(mapImportMatrix(matrix).rows)
    expect(ticks.at(-1)).toBe(1) // finishes at 100%
  })
})

describe('encoding', () => {
  it('decodes a non-UTF-8 (windows-1252) CSV blob', async () => {
    // 0xE9 is "é" in windows-1252 but an invalid lone byte in UTF-8.
    const bytes = new Uint8Array([
      ...'name\nCaf'.split('').map((c) => c.charCodeAt(0)),
      0xe9, // é
    ])
    const blob = new Blob([bytes])
    const { matrix } = await readImportMatrix(blob, 'csv', { encoding: 'windows-1252' })
    expect(matrix[1]).toEqual(['Café'])
  })
})
