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

// onCommitAndMove / onRequestClose / inCell are the hooks the grid injects at
// mount; the registry tests here never exercise them.
function ctx(overrides: Partial<CellEditorContext> = {}): CellEditorContext {
  return {
    value: null,
    rowId: 'r1',
    columnId: 'c1',
    onChange: () => {},
    onCommit: () => {},
    onCancel: () => {},
    ...overrides,
  } as CellEditorContext
}

afterEach(() => {
  for (const t of registeredCellEditorTypes()) unregisterCellEditor(t)
})

describe('registerBuiltinEditors', () => {
  it('registers the config-free editor types', () => {
    const types = registerBuiltinEditors()
    expect(types).toEqual(['otp', 'duration', 'richtext'])
    expect(hasCellEditor('otp')).toBe(true)
    expect(hasCellEditor('duration')).toBe(true)
    expect(hasCellEditor('richtext')).toBe(true)
  })

  it('sanitizes the rich-text value on the way in and on the way out', () => {
    registerBuiltinEditors()
    const onChange = vi.fn()
    // Markup already sitting in the row data is cleaned before the editor sees
    // it, so opening a poisoned cell cannot execute anything either.
    const props = resolveEditorProps(
      getCellEditor('richtext')!,
      ctx({ value: '<p onclick="alert(1)">hi</p><script>alert(2)</script>', onChange }),
    )
    expect(props.value).toBe('<p>hi</p>')
    ;(props.onChange as (v: string) => void)('<b>ok</b><img src=x onerror="alert(3)">')
    const stored = onChange.mock.calls[0]![0] as string
    expect(stored).toContain('<b>ok</b>')
    expect(stored).not.toContain('onerror')
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
