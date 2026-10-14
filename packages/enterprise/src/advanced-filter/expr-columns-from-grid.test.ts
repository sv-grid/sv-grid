/**
 * The advanced filter builder types each column by its data type, not by what
 * edits it: a number typed into a text box still gets numeric operators.
 */
import { describe, expect, it } from 'vitest'
import { exprColumnsFromGrid } from './expr-columns-from-grid'

const api = (columns: Array<Record<string, unknown>>) => ({
  getColumns: () => columns.map((c) => ({ visible: true, header: String(c.id), ...c })) as never,
})

describe('exprColumnsFromGrid', () => {
  it('types columns by cellDataType, whatever the editor', () => {
    const cols = exprColumnsFromGrid(
      api([
        { id: 'amount', cellDataType: 'number', editorType: 'text' },
        { id: 'rating', cellDataType: 'number', editorType: 'stars' },
        { id: 'due', cellDataType: 'dateString', editorType: 'text' },
        { id: 'done', cellDataType: 'boolean' },
        { id: 'at', cellDataType: 'date', editorType: 'datetime' },
        { id: 'name', editorType: 'text' },
      ]),
    )
    expect(Object.fromEntries(cols.map((c) => [c.id, c.type]))).toEqual({
      amount: 'number',
      rating: 'number',
      due: 'date',
      done: 'boolean',
      at: 'datetime',
      name: 'text',
    })
  })

  it('leaves out structural columns and hidden ones', () => {
    const cols = exprColumnsFromGrid(api([{ id: '__rowNumber' }, { id: 'x', visible: false }, { id: 'y' }]))
    expect(cols.map((c) => c.id)).toEqual(['y'])
  })
})
