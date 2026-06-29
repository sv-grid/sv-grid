import { describe, expect, it } from 'vitest'
import { normalizeEditorOptions, parseEditorValue } from './cell-editors'

describe('normalizeEditorOptions', () => {
  it('returns [] for undefined', () => {
    expect(normalizeEditorOptions(undefined)).toEqual([])
  })

  it('treats a function (mistakenly passed) as empty', () => {
    // The type says functions are resolved earlier, but the guard handles it.
    const fn = (() => []) as unknown as undefined
    expect(normalizeEditorOptions(fn)).toEqual([])
  })

  it('maps bare strings to { value, label }', () => {
    expect(normalizeEditorOptions(['a', 'b'])).toEqual([
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ])
  })

  it('maps bare numbers to stringified labels', () => {
    expect(normalizeEditorOptions([1, 2])).toEqual([
      { value: 1, label: '1' },
      { value: 2, label: '2' },
    ])
  })

  it('keeps an explicit label and color', () => {
    expect(
      normalizeEditorOptions([{ value: 'x', label: 'Ex', color: '#f00' }]),
    ).toEqual([{ value: 'x', label: 'Ex', color: '#f00' }])
  })

  it('defaults a missing label to String(value)', () => {
    expect(normalizeEditorOptions([{ value: 7 }])).toEqual([
      { value: 7, label: '7', color: undefined },
    ])
  })
})

describe('parseEditorValue - rating', () => {
  it('rounds and clamps into 0..5', () => {
    expect(parseEditorValue('rating', 3.4)).toBe(3)
    expect(parseEditorValue('rating', 4.6)).toBe(5)
    expect(parseEditorValue('rating', 9)).toBe(5)
    expect(parseEditorValue('rating', -2)).toBe(0)
  })
  it('returns 0 for non-finite input', () => {
    expect(parseEditorValue('rating', 'nope')).toBe(0)
    expect(parseEditorValue('rating', Infinity)).toBe(0)
  })
})

describe('parseEditorValue - color', () => {
  it('returns the trimmed color string', () => {
    expect(parseEditorValue('color', '  #abcdef  ')).toBe('#abcdef')
  })
  it('passes non-hex color strings through', () => {
    expect(parseEditorValue('color', 'rebeccapurple')).toBe('rebeccapurple')
  })
  it('falls back to #000000 for empty/nullish', () => {
    expect(parseEditorValue('color', '')).toBe('#000000')
    expect(parseEditorValue('color', null)).toBe('#000000')
    expect(parseEditorValue('color', undefined)).toBe('#000000')
  })
})

describe('parseEditorValue - time', () => {
  it('returns null for empty input', () => {
    expect(parseEditorValue('time', '')).toBe(null)
    expect(parseEditorValue('time', null)).toBe(null)
  })
  it('returns null for malformed strings', () => {
    expect(parseEditorValue('time', 'noon')).toBe(null)
    expect(parseEditorValue('time', '12')).toBe(null)
  })
  it('normalizes HH:MM', () => {
    expect(parseEditorValue('time', '9:05')).toBe('09:05')
  })
  it('keeps seconds when present', () => {
    expect(parseEditorValue('time', '23:59:59')).toBe('23:59:59')
  })
  it('clamps out-of-range components', () => {
    expect(parseEditorValue('time', '99:99:99')).toBe('23:59:59')
  })
})

describe('parseEditorValue - password', () => {
  it('keeps an empty string instead of nulling it', () => {
    expect(parseEditorValue('password', '')).toBe('')
  })
  it('stringifies and preserves content', () => {
    expect(parseEditorValue('password', 'hunter2')).toBe('hunter2')
    expect(parseEditorValue('password', null)).toBe('')
  })
})

describe('parseEditorValue - select / rich-select', () => {
  it('returns scalar value as-is', () => {
    expect(parseEditorValue('select', 'one')).toBe('one')
    expect(parseEditorValue('rich-select', 5)).toBe(5)
  })
  it('takes the first element of an array', () => {
    expect(parseEditorValue('select', ['a', 'b'])).toBe('a')
  })
  it('coerces nullish to null', () => {
    expect(parseEditorValue('select', null)).toBe(null)
    expect(parseEditorValue('select', undefined)).toBe(null)
    expect(parseEditorValue('rich-select', [])).toBe(null)
  })
})

describe('parseEditorValue - textarea', () => {
  it('stringifies, nullish to empty', () => {
    expect(parseEditorValue('textarea', 'multi\nline')).toBe('multi\nline')
    expect(parseEditorValue('textarea', null)).toBe('')
  })
})

describe('parseEditorValue - list / chips (single)', () => {
  it('returns scalar as-is', () => {
    expect(parseEditorValue('list', 'x')).toBe('x')
    expect(parseEditorValue('chips', 7)).toBe(7)
  })
  it('takes first element of array', () => {
    expect(parseEditorValue('list', ['a', 'b'])).toBe('a')
    expect(parseEditorValue('chips', [])).toBe(null)
  })
  it('coerces nullish to null', () => {
    expect(parseEditorValue('list', null)).toBe(null)
  })
})

describe('parseEditorValue - list / chips (multiple)', () => {
  it('clones an array', () => {
    const input = ['a', 'b']
    const out = parseEditorValue('list', input, { multiple: true }) as string[]
    expect(out).toEqual(['a', 'b'])
    expect(out).not.toBe(input)
  })
  it('returns [] for empty/nullish', () => {
    expect(parseEditorValue('chips', null, { multiple: true })).toEqual([])
    expect(parseEditorValue('chips', '', { multiple: true })).toEqual([])
  })
  it('wraps a scalar into a single-element array', () => {
    expect(parseEditorValue('list', 'solo', { multiple: true })).toEqual(['solo'])
  })
})

describe('parseEditorValue - unknown type fallback', () => {
  it('stringifies, nullish to empty', () => {
    expect(parseEditorValue('autocomplete', 'hey')).toBe('hey')
    expect(parseEditorValue('autocomplete', undefined)).toBe('')
  })
})
