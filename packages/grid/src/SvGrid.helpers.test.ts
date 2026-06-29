import { describe, expect, it } from 'vitest'
import {
  cfTextStyle,
  fmtStat,
  getCellKey,
  resolveClassList,
  toDateInputValue,
  toDateTimeLocalInputValue,
  getEditableInputValue,
  getEditorInputType,
  toValueArray,
  getOptionLabel,
  getOptionColor,
  colorfulChipStyle,
  getEditorClass,
  asDate,
  clampMenuX,
  cssEscape,
  rawToNumber,
  formatFacetNumber,
  formatFacetDate,
} from './SvGrid.helpers'
import type { ResolvedCellFormat } from './conditional-formatting'

describe('cfTextStyle', () => {
  it('returns empty string when no color or fontWeight', () => {
    expect(cfTextStyle({} as ResolvedCellFormat)).toBe('')
  })

  it('emits a color declaration', () => {
    expect(cfTextStyle({ color: 'red' } as ResolvedCellFormat)).toBe('color:red;')
  })

  it('emits a font-weight declaration including 0 (not null)', () => {
    expect(cfTextStyle({ fontWeight: 700 } as ResolvedCellFormat)).toBe(
      'font-weight:700;',
    )
  })

  it('combines color and fontWeight', () => {
    expect(
      cfTextStyle({ color: '#fff', fontWeight: 'bold' } as ResolvedCellFormat),
    ).toBe('color:#fff;font-weight:bold;')
  })

  it('omits font-weight when it is null', () => {
    expect(
      cfTextStyle({ color: 'blue', fontWeight: null } as unknown as ResolvedCellFormat),
    ).toBe('color:blue;')
  })
})

describe('fmtStat', () => {
  it('formats integers with locale grouping', () => {
    expect(fmtStat(1000)).toBe((1000).toLocaleString())
  })

  it('rounds floats to at most 2 fraction digits', () => {
    expect(fmtStat(1.23456)).toBe(
      (1.23456).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    )
  })

  it('treats whole-number floats as integers', () => {
    expect(fmtStat(5.0)).toBe((5).toLocaleString())
  })
})

describe('getCellKey', () => {
  it('joins rowId and columnId with a colon', () => {
    expect(getCellKey('r1', 'colA')).toBe('r1:colA')
  })
})

describe('resolveClassList', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(resolveClassList(null)).toBe('')
    expect(resolveClassList(undefined)).toBe('')
    expect(resolveClassList('')).toBe('')
  })

  it('passes a plain string through unchanged', () => {
    expect(resolveClassList('a b')).toBe('a b')
  })

  it('joins arrays and drops falsy entries', () => {
    expect(resolveClassList(['a', '', 'b'])).toBe('a b')
  })

  it('emits only truthy keys of a record', () => {
    expect(resolveClassList({ a: true, b: false, c: true })).toBe('a c')
  })

  it('returns empty string for an all-false record', () => {
    expect(resolveClassList({ a: false })).toBe('')
  })
})

describe('toDateInputValue', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(toDateInputValue(null)).toBe('')
    expect(toDateInputValue(undefined)).toBe('')
    expect(toDateInputValue('')).toBe('')
  })

  it('passes an already-ISO date string through', () => {
    expect(toDateInputValue('2024-01-15')).toBe('2024-01-15')
  })

  it('formats a Date instance to yyyy-mm-dd', () => {
    expect(toDateInputValue(new Date(Date.UTC(2024, 0, 15)))).toBe('2024-01-15')
  })

  it('parses a numeric timestamp', () => {
    const ts = Date.UTC(2020, 5, 1)
    expect(toDateInputValue(ts)).toBe('2020-06-01')
  })

  it('returns empty for an unparseable value', () => {
    expect(toDateInputValue('not-a-date')).toBe('')
  })
})

describe('toDateTimeLocalInputValue', () => {
  it('returns empty for null/empty', () => {
    expect(toDateTimeLocalInputValue(null)).toBe('')
    expect(toDateTimeLocalInputValue('')).toBe('')
  })

  it('passes a matching datetime-local string through', () => {
    expect(toDateTimeLocalInputValue('2024-01-15T13:45')).toBe('2024-01-15T13:45')
  })

  it('formats a Date instance to yyyy-mm-ddThh:mm', () => {
    expect(toDateTimeLocalInputValue(new Date(Date.UTC(2024, 0, 15, 8, 30)))).toBe(
      '2024-01-15T08:30',
    )
  })

  it('returns empty for an invalid value', () => {
    expect(toDateTimeLocalInputValue('garbage')).toBe('')
  })
})

describe('getEditableInputValue', () => {
  it('delegates to the date formatter for date editors', () => {
    expect(getEditableInputValue('date', '2024-01-15')).toBe('2024-01-15')
  })

  it('delegates to the datetime formatter for datetime editors', () => {
    expect(getEditableInputValue('datetime', '2024-01-15T10:00')).toBe(
      '2024-01-15T10:00',
    )
  })

  it('stringifies other editor types', () => {
    expect(getEditableInputValue('text', 42)).toBe('42')
  })

  it('returns empty string for nullish values', () => {
    expect(getEditableInputValue('text', null)).toBe('')
  })
})

describe('getEditorInputType', () => {
  it('maps each known editor type to its input type', () => {
    expect(getEditorInputType('number')).toBe('number')
    expect(getEditorInputType('date')).toBe('date')
    expect(getEditorInputType('datetime')).toBe('datetime-local')
    expect(getEditorInputType('time')).toBe('time')
    expect(getEditorInputType('password')).toBe('password')
    expect(getEditorInputType('color')).toBe('color')
  })

  it('falls back to text for unknown editor types', () => {
    expect(getEditorInputType('select' as never)).toBe('text')
  })
})

describe('toValueArray', () => {
  it('returns empty for null/empty', () => {
    expect(toValueArray(null)).toEqual([])
    expect(toValueArray('')).toEqual([])
  })

  it('filters nullish/empty entries from an array', () => {
    expect(toValueArray([1, null, '', 2, undefined])).toEqual([1, 2])
  })

  it('wraps a scalar in an array', () => {
    expect(toValueArray('x')).toEqual(['x'])
    expect(toValueArray(7)).toEqual([7])
  })
})

describe('getOptionLabel', () => {
  const options = [
    { value: 1, label: 'One' },
    { value: 'two', label: 'Two' },
  ]

  it('finds the label by strict value match', () => {
    expect(getOptionLabel(options, 1)).toBe('One')
  })

  it('finds the label by stringified value match', () => {
    expect(getOptionLabel(options, '1')).toBe('One')
  })

  it('falls back to the stringified value when no option matches', () => {
    expect(getOptionLabel(options, 99)).toBe('99')
  })

  it('returns empty string for a nullish unmatched value', () => {
    expect(getOptionLabel(options, null)).toBe('')
  })
})

describe('getOptionColor', () => {
  const options = [
    { value: 'a', label: 'A', color: '#f00' },
    { value: 'b', label: 'B' },
  ]

  it('returns the configured color', () => {
    expect(getOptionColor(options, 'a')).toBe('#f00')
  })

  it('returns undefined when matched option has no color', () => {
    expect(getOptionColor(options, 'b')).toBeUndefined()
  })

  it('returns undefined when no option matches', () => {
    expect(getOptionColor(options, 'z')).toBeUndefined()
  })

  it('matches by stringified value', () => {
    const opts = [{ value: 5, label: 'Five', color: 'green' }]
    expect(getOptionColor(opts, '5')).toBe('green')
  })
})

describe('colorfulChipStyle', () => {
  it('returns empty for no color', () => {
    expect(colorfulChipStyle(undefined)).toBe('')
  })

  it('builds a color-mix based style with the given color', () => {
    const style = colorfulChipStyle('#abc')
    expect(style).toContain('background: color-mix(in srgb, #abc 22%, transparent);')
    expect(style).toContain('border-color: color-mix(in srgb, #abc 45%, transparent);')
    expect(style).toContain('color: color-mix(in srgb, #abc 80%, var(--sg-fg, #0f172a));')
  })
})

describe('getEditorClass', () => {
  it('returns the modifier class for each editor type', () => {
    expect(getEditorClass('number')).toBe(
      'sv-grid-cell-editor sv-grid-cell-editor-number',
    )
    expect(getEditorClass('date')).toBe('sv-grid-cell-editor sv-grid-cell-editor-date')
    expect(getEditorClass('datetime')).toBe(
      'sv-grid-cell-editor sv-grid-cell-editor-datetime',
    )
    expect(getEditorClass('color')).toBe(
      'sv-grid-cell-editor sv-grid-cell-editor-color',
    )
  })

  it('returns the base class for other editor types', () => {
    expect(getEditorClass('text')).toBe('sv-grid-cell-editor')
  })
})

describe('asDate', () => {
  it('returns null for null/empty', () => {
    expect(asDate(null)).toBeNull()
    expect(asDate('')).toBeNull()
  })

  it('returns the same Date instance for a Date', () => {
    const d = new Date(2024, 0, 1)
    expect(asDate(d)).toBe(d)
  })

  it('parses a date string', () => {
    const result = asDate('2024-01-15')
    expect(result).toBeInstanceOf(Date)
    expect(result?.getUTCFullYear()).toBe(2024)
  })

  it('returns null for an invalid date', () => {
    expect(asDate('nope')).toBeNull()
  })
})

describe('clampMenuX', () => {
  it('clamps to the left minimum of 8', () => {
    expect(clampMenuX(-50, 100)).toBe(8)
  })

  it('clamps against the right edge', () => {
    const max = window.innerWidth - 100 - 8
    expect(clampMenuX(window.innerWidth, 100)).toBe(max)
  })

  it('returns the value unchanged when it fits', () => {
    expect(clampMenuX(20, 50)).toBe(20)
  })
})

describe('cssEscape', () => {
  const hasCssEscape = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'

  it('delegates to CSS.escape when available, otherwise escapes quotes', () => {
    if (hasCssEscape) {
      expect(cssEscape('1abc')).toBe(CSS.escape('1abc'))
    } else {
      // Fallback only escapes double quotes.
      expect(cssEscape('a"b')).toBe('a\\"b')
    }
  })

  it('uses the quote-escaping fallback path when CSS is unavailable', () => {
    const original = (globalThis as { CSS?: unknown }).CSS
    // Force the fallback branch regardless of environment.
    ;(globalThis as { CSS?: unknown }).CSS = undefined
    try {
      expect(cssEscape('say "hi"')).toBe('say \\"hi\\"')
      expect(cssEscape('plain')).toBe('plain')
    } finally {
      ;(globalThis as { CSS?: unknown }).CSS = original
    }
  })

  it('leaves a plain identifier intact', () => {
    expect(cssEscape('abc')).toBe('abc')
  })
})

describe('rawToNumber', () => {
  it('returns NaN for null/empty', () => {
    expect(rawToNumber(null, false)).toBeNaN()
    expect(rawToNumber('', false)).toBeNaN()
  })

  it('returns a numeric value as-is', () => {
    expect(rawToNumber(42, false)).toBe(42)
  })

  it('coerces a numeric string', () => {
    expect(rawToNumber('3.5', false)).toBe(3.5)
  })

  it('returns NaN for a non-numeric string', () => {
    expect(rawToNumber('abc', false)).toBeNaN()
  })

  it('returns the timestamp for a Date when isDate is true', () => {
    const d = new Date(Date.UTC(2024, 0, 1))
    expect(rawToNumber(d, true)).toBe(d.getTime())
  })

  it('parses a date string to a timestamp when isDate is true', () => {
    expect(rawToNumber('2024-01-01', true)).toBe(new Date('2024-01-01').getTime())
  })

  it('returns NaN for an invalid date when isDate is true', () => {
    expect(rawToNumber('not-a-date', true)).toBeNaN()
  })
})

describe('formatFacetNumber', () => {
  it('uses 0 fraction digits for magnitudes >= 1000', () => {
    expect(formatFacetNumber(1234.56)).toBe(
      (1234.56).toLocaleString(undefined, { maximumFractionDigits: 0 }),
    )
  })

  it('uses 1 fraction digit for magnitudes >= 100', () => {
    expect(formatFacetNumber(123.456)).toBe(
      (123.456).toLocaleString(undefined, { maximumFractionDigits: 1 }),
    )
  })

  it('uses 2 fraction digits for magnitudes >= 1', () => {
    expect(formatFacetNumber(1.2345)).toBe(
      (1.2345).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    )
  })

  it('uses 4 fraction digits for small magnitudes', () => {
    expect(formatFacetNumber(0.123456)).toBe(
      (0.123456).toLocaleString(undefined, { maximumFractionDigits: 4 }),
    )
  })

  it('handles negative numbers via absolute magnitude', () => {
    expect(formatFacetNumber(-2000)).toBe(
      (-2000).toLocaleString(undefined, { maximumFractionDigits: 0 }),
    )
  })
})

describe('formatFacetDate', () => {
  it('formats a timestamp into a short localized date', () => {
    const ts = Date.UTC(2024, 0, 15)
    const expected = new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    expect(formatFacetDate(ts)).toBe(expected)
  })
})
