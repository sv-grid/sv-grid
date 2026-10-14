/**
 * The selection bar's Edit fields over field columns: the controls follow the
 * field, values are read by the field's own parser, and fields that are not
 * one value (files, links, computed) stay out.
 */
import { describe, expect, it } from 'vitest'
import { enableFields } from './index'
import { fillFieldColumn } from './registry.svelte'
import { bulkEditableFields } from '../bulk-edit'

enableFields()

describe('bulk edit over fields', () => {
  it('describes each field for its control and reads typed values the way the field does', () => {
    const defs = [
      { field: 'budget', header: 'Budget', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', separators: 'comma-period', precision: 0 } },
      { field: 'progress', header: 'Progress', fieldType: 'number', fieldProps: { format: 'percent', separators: 'comma-period' } },
      { field: 'tags', header: 'Tags', fieldType: 'multiSelect', fieldProps: { options: [{ value: 'A' }, { value: 'B' }] } },
      { field: 'score', header: 'Score', fieldType: 'rating', fieldProps: { max: 10 } },
      { field: 'files', header: 'Files', fieldType: 'attachment' },
      { field: 'no', header: 'No', fieldType: 'autoNumber' },
    ].map((d) => fillFieldColumn(d))
    const ctx = {
      allColumns: defs.map((d) => ({ id: String(d.field), columnDef: d })),
      isCellEditable: (c: { columnDef: Record<string, unknown> }) => c.columnDef.editable !== false,
    }
    const fields = bulkEditableFields(ctx)
    const by = Object.fromEntries(fields.map((f) => [f.id, f]))
    // Files and a computed autonumber are not one value to set on every row.
    expect(Object.keys(by)).toEqual(['budget', 'progress', 'tags', 'score'])
    expect(by.budget!.parse!('$5,000')).toBe(5000)
    // Percent points typed, the fraction stored.
    expect(by.progress!.parse!('50')).toBe(0.5)
    expect(by.tags!.multiple).toBe(true)
    expect(by.score!.max).toBe(10)
  })
})
