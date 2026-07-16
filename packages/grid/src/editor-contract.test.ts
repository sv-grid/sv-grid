import { describe, expect, it } from 'vitest'
import { editorAria, editorErrorId } from './editor-contract'

describe('editor-contract', () => {
  it('emits ARIA only for the flags that are set (undefined => attribute omitted)', () => {
    expect(editorAria({})).toEqual({
      'aria-invalid': undefined,
      'aria-required': undefined,
      'aria-describedby': undefined,
      'aria-label': undefined,
    })
  })

  it('wires invalid + required + describedby + label', () => {
    const a = editorAria({ id: 'qty', invalid: true, required: true, error: 'Too big', ariaLabel: 'Quantity' })
    expect(a['aria-invalid']).toBe('true')
    expect(a['aria-required']).toBe('true')
    expect(a['aria-describedby']).toBe('qty__error')
    expect(a['aria-label']).toBe('Quantity')
  })

  it('describedby is only set when there is an error AND an id', () => {
    expect(editorAria({ id: 'qty', error: '' })['aria-describedby']).toBeUndefined()
    expect(editorAria({ error: 'x' })['aria-describedby']).toBeUndefined() // no id
    expect(editorAria({ id: 'qty', error: 'x' })['aria-describedby']).toBe('qty__error')
  })

  it('editorErrorId', () => {
    expect(editorErrorId('a')).toBe('a__error')
    expect(editorErrorId(undefined)).toBeUndefined()
  })
})
