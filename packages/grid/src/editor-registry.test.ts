import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'svelte'
import {
  registerCellEditor,
  getCellEditor,
  hasCellEditor,
  unregisterCellEditor,
  registeredCellEditorTypes,
  defaultEditorProps,
  resolveEditorProps,
  type CellEditorContext,
} from './editor-registry'

// A stand-in component (the registry never invokes it; the grid mounts it).
const Fake = (() => {}) as unknown as Component<any>
const Fake2 = (() => {}) as unknown as Component<any>

// onCommitAndMove / onRequestClose / inCell are deliberately left off: the
// tests below assert that defaultEditorProps maps them to undefined.
function ctx(overrides: Partial<CellEditorContext> = {}): CellEditorContext {
  return {
    value: 42,
    rowId: 'r1',
    columnId: 'score',
    onChange: () => {},
    onCommit: () => {},
    onCancel: () => {},
    ...overrides,
  } as CellEditorContext
}

afterEach(() => {
  for (const t of registeredCellEditorTypes()) unregisterCellEditor(t)
})

describe('editor-registry', () => {
  it('registers a bare component with the default mapping', () => {
    registerCellEditor('stars', Fake)
    expect(hasCellEditor('stars')).toBe(true)
    const reg = getCellEditor('stars')!
    expect(reg.component).toBe(Fake)
    expect(reg.props).toBeUndefined()
  })

  it('registers a full registration with custom prop mapping', () => {
    const props = (c: CellEditorContext) => ({ v: c.value })
    registerCellEditor('slider', { component: Fake, props, autoOpen: true })
    const reg = getCellEditor('slider')!
    expect(reg.component).toBe(Fake)
    expect(reg.autoOpen).toBe(true)
    expect(reg.props).toBe(props)
  })

  it('re-registering replaces the previous entry', () => {
    registerCellEditor('x', Fake)
    registerCellEditor('x', Fake2)
    expect(getCellEditor('x')!.component).toBe(Fake2)
  })

  it('unregister + registeredCellEditorTypes reflect the map', () => {
    registerCellEditor('a', Fake)
    registerCellEditor('b', Fake)
    expect(registeredCellEditorTypes().sort()).toEqual(['a', 'b'])
    unregisterCellEditor('a')
    expect(hasCellEditor('a')).toBe(false)
    expect(registeredCellEditorTypes()).toEqual(['b'])
  })

  it('getCellEditor returns undefined for unknown types', () => {
    expect(getCellEditor('nope')).toBeUndefined()
  })

  it('defaultEditorProps maps value + the three callbacks', () => {
    const onChange = vi.fn(), onCommit = vi.fn(), onCancel = vi.fn()
    const props = defaultEditorProps(ctx({ onChange, onCommit, onCancel }))
    expect(props).toEqual({ value: 42, onChange, onCommit, onCancel })
  })

  it('resolveEditorProps uses the custom mapping when present, else default', () => {
    registerCellEditor('custom', { component: Fake, props: (c) => ({ only: c.value }) })
    expect(resolveEditorProps(getCellEditor('custom')!, ctx())).toEqual({ only: 42 })

    registerCellEditor('plain', Fake)
    const props = resolveEditorProps(getCellEditor('plain')!, ctx())
    expect(props.value).toBe(42)
    expect(typeof props.onCommit).toBe('function')
  })
})
