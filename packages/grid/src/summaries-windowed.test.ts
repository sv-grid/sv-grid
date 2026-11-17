/**
 * Footer totals over windowed rows (a server row model): only the loaded rows
 * are read, the totals are what a walk of every entry gave, and the entries
 * not loaded still count as records.
 */
import { describe, expect, it } from 'vitest'
import { createSummaries } from './summaries'
import { makeWindowedArray } from './windowed-brand'

type R = { amount?: number; name?: string }

const columns = [
  { id: 'amount', columnDef: { field: 'amount' } },
  { id: 'name', columnDef: { field: 'name' } },
] as never

function rowOf(i: number, original: R) {
  return { id: String(i), index: i, depth: 0, original, getCanExpand: () => false }
}

describe('footer totals over windowed rows', () => {
  it('reads only the loaded rows of a million, with the same totals and the full count', () => {
    const loaded = new Map<number, R>([[3, { amount: 10, name: 'a' }], [500_000, { amount: 32, name: 'b' }], [999_999, { amount: 1, name: 'c' }]])
    let reads = 0
    const rows = makeWindowedArray(1_000_000, (i) => {
      reads += 1
      const data = loaded.get(i)
      return rowOf(i, data ?? {}) as never
    }, () => [...loaded.keys()])
    const { computeSummaries } = createSummaries({ advancedKeep: null, editedCellValues: {} })
    const started = Date.now()
    const summary = computeSummaries(rows, columns)
    expect(summary.amount).toBe('43')
    expect(summary.name).toBe('Count: 1000000')
    expect(reads).toBeLessThan(10)
    expect(Date.now() - started).toBeLessThan(200)
  })

  it('an ordinary array is still walked whole', () => {
    const rows = [rowOf(0, { amount: 2 }), rowOf(1, { amount: 5 }), rowOf(2, {})] as never
    const { computeSummaries } = createSummaries({ advancedKeep: null, editedCellValues: {} })
    const summary = computeSummaries(rows, columns)
    expect(summary.amount).toBe('7')
    expect(summary.name).toBe('Count: 3')
  })
})
