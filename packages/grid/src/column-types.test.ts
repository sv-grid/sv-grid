import { describe, expect, it } from 'vitest'
import { inferCellDataType, resolveColumnTypes } from './column-types'

describe('inferCellDataType', () => {
  it('classifies primitives', () => {
    expect(inferCellDataType(42)).toBe('number')
    expect(inferCellDataType(true)).toBe('boolean')
    expect(inferCellDataType(new Date())).toBe('date')
    expect(inferCellDataType('2026-06-27')).toBe('dateString')
    expect(inferCellDataType('2026-06-27T10:00:00Z')).toBe('dateString')
    expect(inferCellDataType('hello')).toBe('text')
  })
  it('returns undefined for null/undefined so nothing is forced', () => {
    expect(inferCellDataType(null)).toBeUndefined()
    expect(inferCellDataType(undefined)).toBeUndefined()
  })
})

describe('resolveColumnTypes', () => {
  it('maps explicit cellDataType to editorType + format', () => {
    const cols = [
      { field: 'name', cellDataType: 'text' },
      { field: 'age', cellDataType: 'number' },
      { field: 'active', cellDataType: 'boolean' },
      { field: 'joined', cellDataType: 'date' },
      { field: 'iso', cellDataType: 'dateString' },
    ]
    const out = resolveColumnTypes(cols, undefined, false)
    expect(out[0].editorType).toBe('text')
    expect(out[1].editorType).toBe('number')
    expect(out[2].editorType).toBe('checkbox')
    expect(out[3].editorType).toBe('date')
    expect(out[3].format).toEqual({ type: 'date' })
    expect(out[4].editorType).toBe('date')
    expect(out[4].format).toBeUndefined()
  })

  it('never overrides an explicit editorType or format', () => {
    const cols = [{ field: 'age', cellDataType: 'number', editorType: 'text', format: { type: 'currency' } }]
    const out = resolveColumnTypes(cols, undefined, false)
    expect(out[0].editorType).toBe('text')
    expect(out[0].format).toEqual({ type: 'currency' })
  })

  it('infers from a sample row only when infer=true and nothing is declared', () => {
    const cols = [
      { field: 'age' },
      { field: 'name' },
      { field: 'when' },
      { field: 'flag' },
    ]
    const sample = { age: 30, name: 'Ada', when: '2026-01-02', flag: false }
    const off = resolveColumnTypes(cols, sample, false)
    expect(off[0].editorType).toBeUndefined() // inference off

    const on = resolveColumnTypes(cols, sample, true)
    expect(on[0].editorType).toBe('number')
    expect(on[1].editorType).toBe('text')
    expect(on[2].editorType).toBe('date')
    expect(on[3].editorType).toBe('checkbox')
  })

  it('recurses into header groups', () => {
    const cols = [{ header: 'Group', columns: [{ field: 'age', cellDataType: 'number' }] }]
    const out = resolveColumnTypes(cols, undefined, false)
    expect(out[0].columns[0].editorType).toBe('number')
  })
})
