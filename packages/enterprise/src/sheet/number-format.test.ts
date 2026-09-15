import { describe, expect, it } from 'vitest'
import {
  compileNumberFormat, formatWithPattern, FORMAT_PRESETS, formatCategory,
} from './number-format'

const f = (value: unknown, pattern: string) => formatWithPattern(value, pattern)
const colorOf = (value: unknown, pattern: string) =>
  compileNumberFormat(pattern).format(value).color

describe('formatCategory', () => {
  it('names the category of every preset and of the patterns typed entries carry', () => {
    for (const [name, pattern] of Object.entries(FORMAT_PRESETS)) {
      expect(formatCategory(pattern).category).toBe(name)
    }
    expect(formatCategory('0%')).toEqual({ category: 'percent', decimals: 0, thousands: false })
    expect(formatCategory('$#,##0;($#,##0)')).toEqual({ category: 'currency', decimals: 0, thousands: true })
    expect(formatCategory('#,##0.0')).toEqual({ category: 'number', decimals: 1, thousands: true })
    expect(formatCategory('0.000')).toEqual({ category: 'number', decimals: 3, thousands: false })
    expect(formatCategory(undefined).category).toBe('general')
    expect(formatCategory('[Red]0.0;[Blue]-0.0').category).toBe('custom')
  })
})

describe('General', () => {
  it('prints integers plainly and trims float noise', () => {
    expect(f(42, 'General')).toBe('42')
    expect(f(1.5, 'General')).toBe('1.5')
    expect(f(0.1 + 0.2, 'General')).toBe('0.3')
  })

  it('treats an empty pattern as General', () => {
    expect(f(42, '')).toBe('42')
  })

  it('passes text and blanks through', () => {
    expect(f('abc', 'General')).toBe('abc')
    expect(f('', 'General')).toBe('')
    expect(f(null, 'General')).toBe('')
  })
})

describe('digit placeholders', () => {
  it('pads with 0 and omits with #', () => {
    expect(f(5, '000')).toBe('005')
    expect(f(5, '###')).toBe('5')
    expect(f(0, '#')).toBe('')
    expect(f(0, '0')).toBe('0')
  })

  it('fixes the decimal count with 0', () => {
    expect(f(1.5, '0.00')).toBe('1.50')
    expect(f(1.567, '0.00')).toBe('1.57')
    expect(f(1, '0.00')).toBe('1.00')
  })

  it('trims an optional decimal with #, keeps a required one', () => {
    // 0.0# keeps one place always and a second only when it is there.
    expect(f(1.5, '0.0#')).toBe('1.5')
    expect(f(1.55, '0.0#')).toBe('1.55')
    expect(f(1, '0.0#')).toBe('1.0')
  })

  it('pads an optional decimal with a space for ?', () => {
    expect(f(1.5, '0.0?')).toBe('1.5 ')
  })

  it('rounds rather than truncating', () => {
    expect(f(2.999, '0.00')).toBe('3.00')
    expect(f(0.5, '0')).toBe('1')
  })
})

describe('thousands and scaling', () => {
  it('groups with a comma between placeholders', () => {
    expect(f(1234567, '#,##0')).toBe('1,234,567')
    expect(f(1234.5, '#,##0.00')).toBe('1,234.50')
    expect(f(999, '#,##0')).toBe('999')
  })

  it('scales by a thousand for a trailing comma', () => {
    // A comma before the decimal point (or at the end) divides.
    expect(f(1500000, '0,,"M"')).toBe('2M')
    expect(f(1500, '0.0,"k"')).toBe('1.5k')
  })
})

describe('percent', () => {
  it('multiplies by 100 and prints the sign', () => {
    expect(f(0.42, '0%')).toBe('42%')
    expect(f(0.4256, '0.00%')).toBe('42.56%')
  })
})

describe('scientific', () => {
  it('sizes the mantissa and the exponent from their own placeholders', () => {
    // The trap: the 00 after E+ sizes the EXPONENT. Counting it as decimals
    // gives 1.2345E+4 instead of 1.23E+04.
    expect(f(12345, '0.00E+00')).toBe('1.23E+04')
    expect(f(0.00012, '0.0E+00')).toBe('1.2E-04')
  })
})

describe('sections', () => {
  it('uses one section for everything when only one is given', () => {
    expect(f(-5, '0.00')).toBe('-5.00')
  })

  it('renders a negative through its own section, using the ABSOLUTE value', () => {
    // The classic accounting pattern. Section two supplies the parentheses, so
    // emitting -1.50 inside them would read "(-1.50)".
    expect(f(-1.5, '0.00;(0.00)')).toBe('(1.50)')
    expect(f(1.5, '0.00;(0.00)')).toBe('1.50')
  })

  it('lets two sections cover zero with the negative one', () => {
    expect(f(0, '0.00;(0.00)')).toBe('0.00')
  })

  it('uses a third section for zero when given', () => {
    expect(f(0, '0.00;(0.00);"-"')).toBe('-')
    expect(f(-1, '0.00;(0.00);"-"')).toBe('(1.00)')
  })

  it('uses the fourth section for text, substituting @', () => {
    expect(f('hi', '0.00;;;"[" @ "]"')).toBe('[ hi ]')
  })

  it('does not split on a semicolon inside quotes', () => {
    expect(f(1, '"a;b"0')).toBe('a;b1')
  })
})

describe('colors', () => {
  it('reads a named colour from the matching section', () => {
    expect(colorOf(-5, '0.00;[Red]-0.00')).toBe('#ff0000')
    expect(colorOf(5, '0.00;[Red]-0.00')).toBeUndefined()
  })

  it('does not print the colour directive', () => {
    expect(f(-5, '0.00;[Red](0.00)')).toBe('(5.00)')
  })

  it('is case insensitive', () => {
    expect(colorOf(1, '[blue]0')).toBe('#0000ff')
  })

  it('drops an unsupported bracket directive rather than printing it', () => {
    expect(f(50, '[<100]0')).toBe('50')
  })
})

describe('literals and escapes', () => {
  it('emits quoted text', () => {
    expect(f(5, '"USD "0.00')).toBe('USD 5.00')
  })

  it('emits an escaped character', () => {
    expect(f(5, '\\$0.00')).toBe('$5.00')
  })

  it('emits an unrecognised character as a literal', () => {
    expect(f(5, '$0.00')).toBe('$5.00')
    expect(f(5, '0.00 kg')).toBe('5.00 kg')
  })
})

describe('dates', () => {
  const d = new Date(Date.UTC(2026, 8, 14, 15, 5, 9))

  it('renders the year, month and day tokens', () => {
    expect(f(d, 'yyyy-mm-dd')).toBe('2026-09-14')
    expect(f(d, 'yy')).toBe('26')
    expect(f(d, 'd/m/yyyy')).toBe('14/9/2026')
  })

  it('renders month and day names', () => {
    expect(f(d, 'mmmm')).toBe('September')
    expect(f(d, 'mmm')).toBe('Sep')
    expect(f(d, 'dddd')).toBe('Monday')
    expect(f(d, 'ddd')).toBe('Mon')
  })

  it('reads m as MINUTES after an hour token and MONTHS otherwise', () => {
    // The trap: hh:mm must give 15:05, not 15:09.
    expect(f(d, 'hh:mm')).toBe('15:05')
    expect(f(d, 'mm')).toBe('09')
    expect(f(d, 'hh:mm:ss')).toBe('15:05:09')
  })

  it('renders AM/PM', () => {
    expect(f(d, 'h:mm AM/PM')).toBe('15:05 PM')
  })

  it('parses an ISO string', () => {
    expect(f('2026-09-14', 'yyyy-mm-dd')).toBe('2026-09-14')
  })

  it('reads an Excel serial number', () => {
    // The 1899-12-30 epoch, correct for every date from 1900-03-01 on. Serial
    // 46279 is 2026-09-14; Excel agrees.
    expect(f(46279, 'yyyy-mm-dd')).toBe('2026-09-14')
  })

  it('emits quoted text inside a date pattern', () => {
    expect(f(d, '"on "yyyy')).toBe('on 2026')
  })
})

describe('non-numeric input', () => {
  it('passes a boolean through', () => {
    expect(f(true, '0.00')).toBe('TRUE')
  })

  it('leaves a blank blank rather than printing zero', () => {
    expect(f('', '0.00')).toBe('')
    expect(f(null, '#,##0')).toBe('')
  })

  it('passes unparseable text through a numeric pattern', () => {
    expect(f('n/a', '0.00')).toBe('n/a')
  })
})

describe('caching', () => {
  it('returns the same compiled object for the same pattern', () => {
    expect(compileNumberFormat('#,##0.00')).toBe(compileNumberFormat('#,##0.00'))
  })
})

describe('the presets behind Ctrl+Shift+1..6', () => {
  it('formats a positive and a negative through each', () => {
    expect(f(1234.5, FORMAT_PRESETS.number)).toBe('1,234.50')
    expect(f(1234.5, FORMAT_PRESETS.currency)).toBe('$1,234.50')
    expect(f(-1234.5, FORMAT_PRESETS.currency)).toBe('($1,234.50)')
    expect(f(0.425, FORMAT_PRESETS.percent)).toBe('42.50%')
    expect(f(12345, FORMAT_PRESETS.scientific)).toBe('1.23E+04')
    expect(f(42, FORMAT_PRESETS.general)).toBe('42')
  })
})
