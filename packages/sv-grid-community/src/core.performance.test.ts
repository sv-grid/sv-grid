import { describe, expect, it } from 'vitest'
import { createCoreRowModel, createSortedRowModel, createSvGrid, sortFns, tableFeatures } from './index'

describe('core performance smoke', () => {
  it('handles large synthetic shape with bounded row model call', () => {
    const columns = Array.from({ length: 50 }, (_, index) => ({
      field: `c${index}`,
      editorType: 'number' as const,
    }))
    const data = Array.from({ length: 5000 }, (_, rowIndex) => {
      const row: Record<string, number> = {}
      for (let col = 0; col < 50; col += 1) row[`c${col}`] = rowIndex + col
      return row
    })
    const grid = createSvGrid({
      _features: tableFeatures({}),
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
      },
      columns,
      data,
      state: { sorting: [{ id: 'c0', desc: true }, { id: 'c1', desc: false }] },
    })

    const rows = grid.getRowModel().rows
    expect(rows.length).toBe(5000)
    expect(rows[0]?.getCellValueByColumnId('c0')).toBe(4999)
  })
})
