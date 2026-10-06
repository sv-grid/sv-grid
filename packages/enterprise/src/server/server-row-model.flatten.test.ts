/**
 * The flatten keeps a level of leaves mapped from one emit to the next and
 * redoes only the rows the cache changed. These pin the behaviour that makes
 * safe: a row the cache did not touch keeps its grid row object (so the grid
 * keeps its own row for it), and a row it did touch never shows stale data.
 */
import { describe, expect, it } from 'vitest'
import { rowPlaceholderState, type ServerDataSource } from '@svgrid/grid/server'
import { createServerRowModel } from './server-row-model'

type Item = { id: number; name: string }
const ITEMS: Item[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `item ${i + 1}` }))

const source: ServerDataSource<Item> = {
  async getRows(req) {
    const ordered = req.sortModel[0]?.desc ? [...ITEMS].reverse() : ITEMS
    return { rows: ordered.slice(req.startRow, req.endRow), rowCount: ITEMS.length }
  },
}

const settle = () => new Promise((r) => setTimeout(r, 0))
/** A real row at `i`: present, and not a placeholder. */
const loaded = (ctl: { getRows(): ReadonlyArray<unknown> }, i: number) => {
  const row = ctl.getRows()[i]
  return row !== undefined && !rowPlaceholderState(row)
}
async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !check(); i += 1) await settle()
  expect(check()).toBe(true)
}

describe('flatten over a level of leaves', () => {
  it('keeps the grid row object of a row the cache did not touch', async () => {
    const ctl = createServerRowModel(source, { blockSize: 100, getRowId: (r) => String(r.id) })
    ctl.refresh()
    await until(() => loaded(ctl, 0))
    const first = ctl.getRows()[0]
    ctl.setViewport(500, 520)
    await until(() => loaded(ctl, 510))
    expect(ctl.getRows()[0]).toBe(first)
    expect((ctl.getRows()[510] as Item).name).toBe('item 511')
    ctl.dispose()
  })

  it('shows the new data of a row a transaction patched', async () => {
    const ctl = createServerRowModel(source, { blockSize: 100, getRowId: (r) => String(r.id) })
    ctl.refresh()
    await until(() => loaded(ctl, 5))
    const before = ctl.getRows()[5]
    ctl.applyTransaction({ update: [{ id: 6, name: 'renamed' }] })
    await settle()
    expect(ctl.getRows()[5]).not.toBe(before)
    expect((ctl.getRows()[5] as Item).name).toBe('renamed')
    expect(ctl.getRows()[4]).toBeDefined()
    ctl.dispose()
  })

  it('shows the re-sorted rows, not the ones it kept, after a sort purges the level', async () => {
    const ctl = createServerRowModel(source, { blockSize: 100, getRowId: (r) => String(r.id) })
    ctl.refresh()
    await until(() => loaded(ctl, 0))
    expect((ctl.getRows()[0] as Item).id).toBe(1)
    ctl.setSort([{ id: 'id', desc: true }])
    await until(() => loaded(ctl, 0) && (ctl.getRows()[0] as Item).id !== 1)
    expect((ctl.getRows()[0] as Item).id).toBe(1000)
    expect((ctl.getRows()[1] as Item).id).toBe(999)
    ctl.dispose()
  })
})
