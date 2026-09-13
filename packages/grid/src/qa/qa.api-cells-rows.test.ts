/**
 * QA sweep: cell, row, editing and history members of `SvGridApi`.
 *
 * Each case states the documented contract in its name and asserts it against
 * the mounted component - not against the implementation's internals - so a
 * behaviour change that the docs do not describe fails here.
 */
import { describe, expect, it, vi } from 'vitest'
import { cellAt, flush, mountQaGrid, qaGetRowId, qaRows } from './harness.svelte'
import type { QaGrid, QaRow } from './harness.svelte'

describe('QA: api.getCellValue / api.setCellValue', () => {
  it('getCellValue reads through the column field', async () => {
    const { api } = await mountQaGrid()
    expect(api.getCellValue(0, 'name')).toBe('Ada Lovelace')
    expect(api.getCellValue(2, 'salary')).toBe(138_000)
  })

  it('getCellValue returns undefined when either argument does not resolve', async () => {
    const { api } = await mountQaGrid()
    expect(api.getCellValue(999, 'name')).toBeUndefined()
    expect(api.getCellValue(0, 'nope')).toBeUndefined()
  })

  it('setCellValue writes through the field and re-renders', async () => {
    const { api, target } = await mountQaGrid()
    api.setCellValue(0, 'name', 'Ada L.')
    await flush()
    expect(api.getCellValue(0, 'name')).toBe('Ada L.')
    expect(cellAt(target, 0, 0)?.textContent?.trim()).toBe('Ada L.')
  })

  it('setCellValue does NOT fire onCellValueChange (editor commit path only)', async () => {
    const onCellValueChange = vi.fn()
    const { api } = await mountQaGrid({ onCellValueChange })
    api.setCellValue(1, 'salary', 1)
    await flush()
    expect(onCellValueChange).not.toHaveBeenCalled()
  })

  it('setCellValue leaves the source array the parent passed in untouched', async () => {
    const rows = qaRows.map((r) => ({ ...r }))
    const { api } = await mountQaGrid({}, rows)
    api.setCellValue(0, 'name', 'Mutated')
    await flush()
    expect(rows[0]!.name).toBe('Ada Lovelace')
    expect(api.getData()[0]!.name).toBe('Mutated')
  })
})

describe('QA: api.addRow / addRows / removeRow / removeRows', () => {
  const extra: QaRow = { id: 99, name: 'New Person', team: 'QA', salary: 1, active: true }

  it('addRow appends at the bottom by default', async () => {
    const { api } = await mountQaGrid()
    api.addRow(extra)
    await flush()
    const data = api.getData()
    expect(data.length).toBe(qaRows.length + 1)
    expect(data[data.length - 1]!.name).toBe('New Person')
  })

  it("addRow('top') prepends and a numeric position inserts before that index", async () => {
    const { api } = await mountQaGrid()
    api.addRow(extra, 'top')
    api.addRow({ ...extra, id: 98, name: 'Third' }, 2)
    await flush()
    expect(api.getData().map((r) => r.name).slice(0, 3)).toEqual([
      'New Person',
      'Ada Lovelace',
      'Third',
    ])
  })

  it('addRows inserts a batch in order', async () => {
    const { api } = await mountQaGrid()
    api.addRows([extra, { ...extra, id: 98, name: 'Second' }], 'top')
    await flush()
    expect(api.getData().map((r) => r.name).slice(0, 2)).toEqual(['New Person', 'Second'])
  })

  it('removeRow removes by data-array index', async () => {
    const { api } = await mountQaGrid()
    api.removeRow(0)
    await flush()
    expect(api.getData().map((r) => r.id)).toEqual([2, 3, 4, 5, 6])
  })

  it('removeRows removes every listed index in one pass', async () => {
    const { api } = await mountQaGrid()
    api.removeRows([0, 2, 4])
    await flush()
    expect(api.getData().map((r) => r.id)).toEqual([2, 4, 6])
  })

  it('removeRow with an out-of-range index is a no-op', async () => {
    const { api } = await mountQaGrid()
    api.removeRow(999)
    await flush()
    expect(api.getData().length).toBe(qaRows.length)
  })
})

describe('QA: api.applyTransaction', () => {
  it('adds, updates and removes in one call and reports the counts', async () => {
    const { api } = await mountQaGrid({ getRowId: qaGetRowId })
    const result = api.applyTransaction({
      add: [{ id: 7, name: 'Katherine Johnson', team: 'Apollo', salary: 160_000, active: true }],
      update: [{ ...qaRows[0]!, salary: 200_000 }],
      remove: ['r5'],
    })
    await flush()
    expect(result).toEqual({ added: 1, updated: 1, removed: 1 })
    const data = api.getData()
    expect(data.map((r) => r.id)).toEqual([1, 2, 3, 4, 6, 7])
    expect(data[0]!.salary).toBe(200_000)
  })

  it('removes by row object reference without getRowId', async () => {
    const rows = qaRows.map((r) => ({ ...r }))
    const { api } = await mountQaGrid({}, rows)
    const result = api.applyTransaction({ remove: [rows[1]!] })
    await flush()
    expect(result.removed).toBe(1)
    expect(api.getData().map((r) => r.id)).toEqual([1, 3, 4, 5, 6])
  })

  it('reports zero counts for an empty transaction and leaves data alone', async () => {
    const { api } = await mountQaGrid({ getRowId: qaGetRowId })
    expect(api.applyTransaction({})).toEqual({ added: 0, updated: 0, removed: 0 })
    expect(api.getData().length).toBe(qaRows.length)
  })

  it('applies the whole batch with one re-render', async () => {
    const { api, target } = await mountQaGrid({ getRowId: qaGetRowId })
    api.applyTransaction({
      add: [
        { id: 8, name: 'Hedy Lamarr', team: 'Radio', salary: 120_000, active: true },
        { id: 9, name: 'Jean Bartik', team: 'ENIAC', salary: 130_000, active: true },
      ],
      remove: ['r1', 'r2'],
    })
    await flush()
    const names = [...target.querySelectorAll('td[data-svgrid-col="0"]')].map((c) =>
      c.textContent?.trim(),
    )
    expect(names).toContain('Hedy Lamarr')
    expect(names).not.toContain('Ada Lovelace')
  })
})

describe('QA: api.startEditing / api.stopEditing', () => {
  it('startEditing opens an editor and returns true when editing is enabled', async () => {
    const { api, target } = await mountQaGrid({ enableInlineEditing: true })
    expect(api.startEditing(0, 'name')).toBe(true)
    await flush()
    expect(target.querySelector('.sv-grid-cell-editing')).not.toBeNull()
  })

  it('startEditing returns false when inline editing is off', async () => {
    const { api } = await mountQaGrid()
    expect(api.startEditing(0, 'name')).toBe(false)
  })

  it('startEditing returns false for an unknown cell', async () => {
    const { api } = await mountQaGrid({ enableInlineEditing: true })
    expect(api.startEditing(0, 'nope')).toBe(false)
    expect(api.startEditing(9999, 'name')).toBe(false)
  })

  it('stopEditing(true) discards the edit; stopEditing() commits it', async () => {
    const { api, target } = await mountQaGrid({ enableInlineEditing: true })

    api.startEditing(0, 'name')
    await flush()
    const input = target.querySelector<HTMLInputElement>('.sv-grid-cell-editing input')
    expect(input).not.toBeNull()
    input!.value = 'Discarded'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    expect(api.stopEditing(true)).toBe(true)
    await flush()
    expect(api.getCellValue(0, 'name')).toBe('Ada Lovelace')

    api.startEditing(0, 'name')
    await flush()
    const input2 = target.querySelector<HTMLInputElement>('.sv-grid-cell-editing input')
    input2!.value = 'Committed'
    input2!.dispatchEvent(new Event('input', { bubbles: true }))
    expect(api.stopEditing()).toBe(true)
    await flush()
    expect(api.getCellValue(0, 'name')).toBe('Committed')
  })

  it('stopEditing returns false when no edit is in progress', async () => {
    const { api } = await mountQaGrid({ enableInlineEditing: true })
    expect(api.stopEditing()).toBe(false)
  })
})

describe('QA: inline-edit commit vs the data the parent passed', () => {
  /**
   * What the commit path actually touches, pinned because it is the one place
   * where grid state and consumer state overlap.
   *
   * The row ARRAY is the grid's own: `addRow` / `removeRow` / `setCellValue`
   * all replace it, never the caller's. A committed EDITOR value, though, is
   * written into the row object it came from - so a consumer that hands the
   * grid its live row objects sees the new value on them. That is what
   * `docs/help/editing/saving-values.md` now documents (it used to promise the
   * opposite), and the reason the fixtures in this suite are cloned per mount.
   */
  it('a committed edit writes through to the row object the parent passed', async () => {
    const rows = qaRows.map((r) => ({ ...r }))
    const { api, target } = await mountQaGrid({ enableInlineEditing: true }, rows)

    api.startEditing(0, 'name')
    await flush()
    const input = target.querySelector<HTMLInputElement>('.sv-grid-cell-editing input')
    input!.value = 'Written through'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    api.stopEditing()
    await flush()

    expect(api.getCellValue(0, 'name')).toBe('Written through')
    expect(rows[0]!.name).toBe('Written through')
  })

  it('a cancelled edit touches neither the grid nor the caller rows', async () => {
    const rows = qaRows.map((r) => ({ ...r }))
    const { api, target } = await mountQaGrid({ enableInlineEditing: true }, rows)

    api.startEditing(1, 'name')
    await flush()
    const input = target.querySelector<HTMLInputElement>('.sv-grid-cell-editing input')
    input!.value = 'Never committed'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    api.stopEditing(true)
    await flush()

    expect(api.getCellValue(1, 'name')).toBe('Grace Hopper')
    expect(rows[1]!.name).toBe('Grace Hopper')
  })

  it('addRow / removeRow / setCellValue leave the caller array alone', async () => {
    const rows = qaRows.map((r) => ({ ...r }))
    const { api } = await mountQaGrid({}, rows)

    api.addRow({ id: 42, name: 'Added', team: 'QA', salary: 1, active: true })
    api.removeRow(0)
    api.setCellValue(0, 'name', 'Rewritten')
    await flush()

    expect(rows.length).toBe(qaRows.length)
    expect(rows.map((r) => r.name)).toEqual(qaRows.map((r) => r.name))
  })
})

describe('QA: api.undo / redo / canUndo / canRedo / clearHistory', () => {
  /** Commit one inline edit through the editor, which is what history records. */
  async function editFirstName(
    grid: QaGrid,
    value: string,
  ): Promise<void> {
    grid.api.startEditing(0, 'name')
    await flush()
    const input = grid.target.querySelector<HTMLInputElement>('.sv-grid-cell-editing input')
    input!.value = value
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    grid.api.stopEditing()
    await flush()
  }

  it('an empty history reports canUndo/canRedo false and undo/redo return false', async () => {
    const { api } = await mountQaGrid({ enableInlineEditing: true })
    expect(api.canUndo()).toBe(false)
    expect(api.canRedo()).toBe(false)
    expect(api.undo()).toBe(false)
    expect(api.redo()).toBe(false)
  })

  it('undo reverts the last edit and redo re-applies it', async () => {
    const grid = await mountQaGrid({ enableInlineEditing: true })
    await editFirstName(grid, 'Edited')
    expect(grid.api.getCellValue(0, 'name')).toBe('Edited')
    expect(grid.api.canUndo()).toBe(true)

    expect(grid.api.undo()).toBe(true)
    await flush()
    expect(grid.api.getCellValue(0, 'name')).toBe('Ada Lovelace')
    expect(grid.api.canRedo()).toBe(true)

    expect(grid.api.redo()).toBe(true)
    await flush()
    expect(grid.api.getCellValue(0, 'name')).toBe('Edited')
  })

  it('clearHistory wipes both stacks', async () => {
    const grid = await mountQaGrid({ enableInlineEditing: true })
    await editFirstName(grid, 'Edited')
    grid.api.clearHistory()
    expect(grid.api.canUndo()).toBe(false)
    expect(grid.api.canRedo()).toBe(false)
    expect(grid.api.undo()).toBe(false)
  })
})
