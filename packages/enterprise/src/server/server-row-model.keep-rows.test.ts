/**
 * `keepRowsWhileLoading`: after a sort or a filter the rows on screen stay
 * until the new answer's first block lands, or until the time runs out.
 * The source here holds every request until the test releases it, so each
 * case can look at the grid in between.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rowPlaceholderState, type ServerDataSource, type ServerRequest } from '@svgrid/grid/server'
import { createServerRowModel } from './server-row-model'

type Item = { id: number; name: string }
const ITEMS: Item[] = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, name: `item ${i + 1}` }))

function heldSource() {
  const waiting: Array<{ req: ServerRequest; release: () => void; fail: () => void }> = []
  const source: ServerDataSource<Item> = {
    getRows(req) {
      return new Promise((resolve, reject) => {
        const ordered = req.sortModel[0]?.desc ? [...ITEMS].reverse() : ITEMS
        const filtered = req.filterModel.global ? ordered.filter((r) => r.name.includes(req.filterModel.global!)) : ordered
        waiting.push({
          req,
          release: () => resolve({ rows: filtered.slice(req.startRow, req.endRow), rowCount: filtered.length }),
          fail: () => reject(new Error('down')),
        })
      })
    },
  }
  const releaseAll = () => waiting.splice(0).forEach((w) => w.release())
  return { source, waiting, releaseAll }
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}
const firstId = (ctl: { getRows(): ReadonlyArray<unknown> }) => {
  const row = ctl.getRows()[0]
  return row && !rowPlaceholderState(row) ? (row as Item).id : rowPlaceholderState(row)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('keepRowsWhileLoading', () => {
  it('keeps the rows through a sort and swaps them in one update when the block lands', async () => {
    const { source, releaseAll } = heldSource()
    const onChange = vi.fn()
    const ctl = createServerRowModel(source, { blockSize: 100, keepRowsWhileLoading: 1000, onChange })
    ctl.refresh()
    await flush()
    releaseAll()
    await flush()
    expect(firstId(ctl)).toBe(1)

    onChange.mockClear()
    ctl.setSort([{ id: 'id', desc: true }])
    await flush()
    // Still the old rows, and nobody was told anything changed.
    expect(firstId(ctl)).toBe(1)
    expect(onChange).not.toHaveBeenCalled()

    releaseAll()
    await flush()
    expect(firstId(ctl)).toBe(300)
    expect(onChange).toHaveBeenCalledTimes(1)
    ctl.dispose()
  })

  it('shows skeletons once the time is up', async () => {
    vi.useFakeTimers()
    const { source, releaseAll } = heldSource()
    const ctl = createServerRowModel(source, { blockSize: 100, keepRowsWhileLoading: 200 })
    ctl.refresh()
    await flush()
    releaseAll()
    await flush()

    ctl.setSort([{ id: 'id', desc: true }])
    await flush()
    expect(firstId(ctl)).toBe(1)
    await vi.advanceTimersByTimeAsync(250)
    expect(firstId(ctl)).toBe('loading')

    releaseAll()
    await flush()
    expect(firstId(ctl)).toBe(300)
    ctl.dispose()
  })

  it('holds through a filter, which rebuilds every level', async () => {
    const { source, releaseAll } = heldSource()
    const ctl = createServerRowModel(source, { blockSize: 100, keepRowsWhileLoading: 1000 })
    ctl.refresh()
    await flush()
    releaseAll()
    await flush()

    ctl.setFilter({ global: 'item 2' })
    await flush()
    expect(firstId(ctl)).toBe(1)
    releaseAll()
    await flush()
    expect(firstId(ctl)).toBe(2)
    expect(ctl.getState().rowCount).toBe(ITEMS.filter((r) => r.name.includes('item 2')).length)
    ctl.dispose()
  })

  it('ends the hold on a failed block, so its Retry shows', async () => {
    const { source, waiting, releaseAll } = heldSource()
    const ctl = createServerRowModel(source, { blockSize: 100, keepRowsWhileLoading: 5000 })
    ctl.refresh()
    await flush()
    releaseAll()
    await flush()

    ctl.setSort([{ id: 'id', desc: true }])
    await flush()
    waiting.splice(0).forEach((w) => w.fail())
    await flush()
    expect(firstId(ctl)).toBe('failed')
    ctl.dispose()
  })

  it('changes nothing by default: skeletons right after a sort', async () => {
    const { source, releaseAll } = heldSource()
    const ctl = createServerRowModel(source, { blockSize: 100 })
    ctl.refresh()
    await flush()
    releaseAll()
    await flush()
    ctl.setSort([{ id: 'id', desc: true }])
    await flush()
    expect(firstId(ctl)).toBe('loading')
    ctl.dispose()
  })
})
