import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerBuiltinEditors } from './builtin-editors'
import {
  getCellEditor,
  hasCellEditor,
  unregisterCellEditor,
  registeredCellEditorTypes,
  resolveEditorProps,
  type CellEditorContext,
} from './editor-registry'

function ctx(overrides: Partial<CellEditorContext> = {}): CellEditorContext {
  return {
    value: null,
    rowId: 'r1',
    columnId: 'c1',
    onChange: () => {},
    onCommit: () => {},
    onCancel: () => {},
    ...overrides,
  }
}

afterEach(() => {
  for (const t of registeredCellEditorTypes()) unregisterCellEditor(t)
})

describe('registerBuiltinEditors', () => {
  it('registers the config-free editor types', () => {
    const types = registerBuiltinEditors()
    expect(types).toEqual(['otp', 'duration'])
    expect(hasCellEditor('otp')).toBe(true)
    expect(hasCellEditor('duration')).toBe(true)
  })

  it("maps the OTP editor's onComplete to commit", () => {
    registerBuiltinEditors()
    const onCommit = vi.fn(), onChange = vi.fn()
    const props = resolveEditorProps(getCellEditor('otp')!, ctx({ value: '12', onChange, onCommit }))
    expect(props.value).toBe('12')
    expect(props.autofocus).toBe(true)
    ;(props.onComplete as (v: string) => void)('123456')
    expect(onCommit).toHaveBeenCalledWith('123456')
    ;(props.onChange as (v: string) => void)('1')
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('maps the duration editor commit/cancel through the context', () => {
    registerBuiltinEditors()
    const onCommit = vi.fn(), onCancel = vi.fn()
    const props = resolveEditorProps(getCellEditor('duration')!, ctx({ value: 90, onCommit, onCancel }))
    expect(props.value).toBe(90)
    ;(props.onCommit as (v: number | null) => void)(120)
    expect(onCommit).toHaveBeenCalledWith(120)
    ;(props.onCancel as () => void)()
    expect(onCancel).toHaveBeenCalled()
  })
})
