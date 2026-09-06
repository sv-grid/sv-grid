/**
 * Typing a decimal into an `editorType: 'number'` cell.
 *
 * `<input type="number">` applies the HTML value-sanitization algorithm: the
 * element only reports a value it can parse as a valid floating-point number.
 * Every intermediate state on the way to "12.5" - "12." - is not one, so the
 * element reports "" and the keystroke vanishes. The same applies to a lone
 * "-" on the way to a negative, and to "1e" on the way to "1e3".
 *
 * jsdom implements that sanitization, so this is reproducible here rather than
 * only in a browser.
 */
import { describe, expect, it } from 'vitest'
import {
  getCellEditorInputType,
  getEditorInputType,
  isNumericEditorInput,
} from './SvGrid.helpers'

describe('what a bare number input does to intermediate values', () => {
  // This is the browser behaviour the editor has to work around, pinned so the
  // reasoning below cannot quietly stop being true.
  const sanitized = (raw: string) => {
    const el = document.createElement('input')
    el.type = 'number'
    el.value = raw
    return el.value
  }

  it('throws away a trailing decimal point', () => {
    expect(sanitized('12.')).toBe('')
  })

  it('throws away a lone minus sign', () => {
    expect(sanitized('-')).toBe('')
  })

  it('throws away a half-typed exponent', () => {
    expect(sanitized('1e')).toBe('')
  })

  it('keeps values that are already valid', () => {
    expect(sanitized('12.5')).toBe('12.5')
    expect(sanitized('-3')).toBe('-3')
    expect(sanitized('1e3')).toBe('1e3')
  })
})

describe('getCellEditorInputType', () => {
  it('does NOT hand the number editor a type=number input', () => {
    // The whole point: a text input keeps the raw keystrokes, and the value is
    // coerced at commit by parseEditorValue - which the editor already did.
    expect(getCellEditorInputType('number')).toBe('text')
  })

  it('leaves every other editor on its native input type', () => {
    for (const t of ['text', 'date', 'datetime', 'time', 'password', 'color'] as const) {
      expect(getCellEditorInputType(t), t).toBe(getEditorInputType(t))
    }
  })

  it('does not change the FILTER inputs, which share the other helper', () => {
    // The filter row and filter menu still ask getEditorInputType. They have
    // the same defect, but changing them is a separate decision - this pins
    // that they were not swept along by accident.
    expect(getEditorInputType('number')).toBe('number')
  })
})

describe('isNumericEditorInput', () => {
  it('accepts every state on the way to a number', () => {
    // Rejecting these is the exact bug this replaces.
    for (const v of ['', '-', '12', '12.', '12.5', '-3', '.5', '1e', '1e3', '1e-3']) {
      expect(isNumericEditorInput(v), JSON.stringify(v)).toBe(true)
    }
  })

  it('rejects what can never become a number', () => {
    // The guarantee type="number" used to provide, now that it is gone.
    for (const v of ['abc', '12x', '12..5', '--3', '1 2', '12,5']) {
      expect(isNumericEditorInput(v), JSON.stringify(v)).toBe(false)
    }
  })
})
