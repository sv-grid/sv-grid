import { describe, expect, it } from 'vitest'
import {
  compileNumberFormat, formatWithPattern, FORMAT_PRESETS, SPECIAL_FORMATS, formatCategory,
  accountingPattern, accountingParts,
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
    expect(formatCategory(accountingPattern('', 0))).toEqual({ category: 'accounting', decimals: 0, thousands: true })
    for (const { pattern } of Object.values(SPECIAL_FORMATS)) expect(formatCategory(pattern).category).toBe('special')
  })
})

describe('Accounting', () => {
  it('lines the symbol up on the left and the number on the right, one space between', () => {
    expect(f(1234.5, FORMAT_PRESETS.accounting)).toBe(' $ 1,234.50 ')
    expect(f(-1234.5, FORMAT_PRESETS.accounting)).toBe(' $ (1,234.50)')
    expect(f(0, FORMAT_PRESETS.accounting)).toBe(' $ -   ')
    expect(f('n/a', FORMAT_PRESETS.accounting)).toBe(' n/a ')
  })

  it('spells the pattern for a symbol and a number of decimals, and reads it back', () => {
    expect(accountingPattern('$', 2)).toBe(FORMAT_PRESETS.accounting)
    expect(accountingPattern('', 0)).toBe('_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)')
    expect(accountingPattern('\u20ac', 1)).toBe('_("\u20ac"* #,##0.0_);_("\u20ac"* (#,##0.0);_("\u20ac"* "-"?_);_(@_)')
    expect(f(99, accountingPattern('\u20ac', 1))).toBe(' \u20ac 99.0 ')
    expect(f(-7, accountingPattern('', 0))).toBe('  (7)')
    expect(accountingParts(FORMAT_PRESETS.accounting)).toEqual({ symbol: '$', decimals: 2 })
    expect(accountingParts(accountingPattern('', 3))).toEqual({ symbol: '', decimals: 3 })
    expect(accountingParts(accountingPattern('\u00a3', 0))).toEqual({ symbol: '\u00a3', decimals: 0 })
    expect(accountingParts(FORMAT_PRESETS.currency)).toBeNull()
    expect(accountingParts(undefined)).toBeNull()
  })
})

describe('Special', () => {
  it('lays the digits into the mask from the right', () => {
    expect(f(1234, SPECIAL_FORMATS.zip.pattern)).toBe('01234')
    expect(f(94105, SPECIAL_FORMATS.zip.pattern)).toBe('94105')
    expect(f(941051234, SPECIAL_FORMATS.zip4.pattern)).toBe('94105-1234')
    expect(f(123456789, SPECIAL_FORMATS.ssn.pattern)).toBe('123-45-6789')
    expect(f(5551234, SPECIAL_FORMATS.phone.pattern)).toBe('555-1234')
    expect(f(5551234567, SPECIAL_FORMATS.phone.pattern)).toBe('(555) 123-4567')
    // Digits beyond the mask go in front; a short number leaves its literals.
    expect(f(15551234567, SPECIAL_FORMATS.phone.pattern)).toBe('(1555) 123-4567')
    expect(f(1234, '###-####')).toBe('-1234')
  })

  it('a condition picks its section, and the fallback takes the rest', () => {
    expect(f(50, '[<100]"small";"big"')).toBe('small')
    expect(f(100, '[<100]"small";"big"')).toBe('big')
    expect(f(-5, '[>=0]0;[Red]-0.0')).toBe('-5.0')
    expect(compileNumberFormat('[>=0]0;[Red]-0.0').format(-5).color).toBe('#ff0000')
    expect(f(7, '[=7]"seven";0')).toBe('seven')
  })

  it('reads _x and *x as one space', () => {
    expect(f(5, '_(0_)')).toBe(' 5 ')
    expect(f(5, '* 0')).toBe(' 5')
    expect(f(1.5, '0.0_);(0.0)')).toBe('1.5 ')
    expect(f(-1.5, '0.0_);(0.0)')).toBe('(1.5)')
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

  it('puts the hour on a 12-hour clock when the pattern names the meridiem', () => {
    // This expected 15:05 PM until a QA pass read Excel: a pattern carrying
    // AM/PM shows the hour the way a clock face does.
    expect(f(d, 'h:mm AM/PM')).toBe('3:05 PM')
    expect(f(d, 'hh:mm AM/PM')).toBe('03:05 PM')
    expect(f(d, 'h:mm am/pm')).toBe('3:05 pm')
    // A/P is the single letter Excel prints for it.
    expect(f(d, 'h:mm A/P')).toBe('3:05 P')
    // And without one the hour stays on the 24-hour clock.
    expect(f(d, 'h:mm')).toBe('15:05')
  })

  it('renders the month as one letter for mmmmm', () => {
    expect(f(d, 'mmmmm')).toBe('S')
    expect(f(d, 'mmmm')).toBe('September')
  })

  it('rounds to the finest unit it shows, as Excel does', () => {
    // 23:59:40 under hh:mm is midnight, and the date rolls with it.
    expect(f(46275.9997685, 'hh:mm')).toBe('00:00')
    expect(f(46275.9997685, 'yyyy-mm-dd hh:mm')).toBe('2026-09-11 00:00')
    // A date-only pattern still truncates: an afternoon is not tomorrow.
    expect(f(46275.99, 'yyyy-mm-dd')).toBe('2026-09-10')
  })

  it('shows fractional seconds where the pattern asks for them', () => {
    expect(f(46275.5000116, 'h:mm:ss.000')).toBe('12:00:01.002')
    expect(f(46275.5000116, 'h:mm:ss.0')).toBe('12:00:01.0')
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
    expect(f(0.425, FORMAT_PRESETS.percent)).toBe('43%')
    expect(f(12345, FORMAT_PRESETS.scientific)).toBe('1.23E+04')
    expect(f(42, FORMAT_PRESETS.general)).toBe('42')
  })
})

describe('the three Excel formats that were rendering nonsense', () => {
  const show = (pattern: string, value: unknown) => compileNumberFormat(pattern).format(value).text

  it('an elapsed time totals the duration rather than reading the clock', () => {
    // A timesheet's [h]:mm over a day and a half is 36 hours, not noon.
    expect(show('[h]:mm', 1.5)).toBe('36:00')
    expect(show('[hh]:mm:ss', 1.5)).toBe('36:00:00')
    expect(show('[mm]:ss', 0.5)).toBe('720:00')
    expect(show('[s]', 0.5)).toBe('43200')
    // The clock tokens are untouched by it.
    expect(show('h:mm', 1.5)).toBe('12:00')
    // And a bracket that is a colour or a condition still is one.
    expect(compileNumberFormat('[Red]0.0').format(-5)).toEqual({ text: '-5.0', color: '#ff0000' })
    expect(show('[>100]"big";[<=100]"small"', 150)).toBe('big')
  })

  it('a fraction finds the closest one that fits the placeholders', () => {
    expect(show('# ?/?', 1.25)).toBe('1 1/4')
    expect(show('# ?/?', 2.5)).toBe('2 1/2')
    expect(show('# ?/?', -1.25)).toBe('-1 1/4')
    // Rounding up to a whole is a whole, not 1/1.
    expect(show('# ?/?', 0.99)).toBe('1')
    expect(show('# ?/?', 3)).toBe('3')
    // Two digits of denominator reach further.
    expect(show('# ??/??', 5.0625)).toBe('5  1/16')
    // A literal denominator is used as it stands, unreduced.
    expect(show('# ?/8', 1.25)).toBe('1 2/8')
    expect(show('# ?/16', 2.0625)).toBe('2 1/16')
    // Without an integer part the whole value is the numerator.
    expect(show('?/?', 1.25)).toBe('5/4')
  })

  it('the text placeholder shows the value, and an empty section hides it', () => {
    // A number in a cell formatted as Text reads as the number.
    expect(show('@', 5)).toBe('5')
    expect(show('@', 'text')).toBe('text')
    expect(show('"x"@', 'y')).toBe('xy')
    // `;;;` is Excel's hide-the-cell trick, and it hides text too.
    expect(show(';;;', 5)).toBe('')
    expect(show(';;;', 'text')).toBe('')
    // A numeric pattern with no text section leaves text alone.
    expect(show('0.00', 'text')).toBe('text')
    // A fourth section without an @ shows its own words instead.
    expect(show('0.00;;;"n/a"', 'whatever')).toBe('n/a')
  })
})

describe('scientific and engineering notation', () => {
  const show = (pattern: string, value: number) => compileNumberFormat(pattern).format(value).text

  it('the integer placeholders set the step the exponent moves in', () => {
    // One of them is the everyday scientific form; three make it
    // engineering notation, where the exponent is a multiple of three and
    // the mantissa carries up to three integer digits.
    expect(show('0.00E+00', 12345)).toBe('1.23E+04')
    expect(show('0.00E+00', 0.00012)).toBe('1.20E-04')
    expect(show('0.00E+00', -12345)).toBe('-1.23E+04')
    expect(show('0.0E+0', 12345)).toBe('1.2E+4')
    expect(show('##0.0E+0', 12345)).toBe('12.3E+3')
    expect(show('##0.0E+0', 0.000123)).toBe('123.0E-6')
    // Rounding that carries the mantissa over its width moves a step out.
    expect(show('##0.0E+0', 999.95)).toBe('1.0E+3')
    expect(show('##0.0E+0', 0)).toBe('0.0E+0')
  })
})

