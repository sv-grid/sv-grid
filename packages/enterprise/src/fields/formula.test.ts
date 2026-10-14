/**
 * The formula language: dates read in local time in every zone, comparisons
 * between stored dates and date values, the lazy functions, units, and the
 * function edges the docs list.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { columnResolver, compileFormula, formulaError, formulaReaders, formulaRefs, isoDate, renameFormulaRefs } from './formula'

const names: Record<string, string> = { due: 'due', qty: 'qty', name: 'name', 'last counted': 'audited' }
const resolve = (n: string) => names[n.trim().toLowerCase()] ?? null
const run = (src: string, row: Record<string, unknown> = {}) => compileFormula(src, resolve).fn(row)

const ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati', 'America/New_York']
const startTz = process.env.TZ
afterEach(() => {
  if (startTz === undefined) delete process.env.TZ
  else process.env.TZ = startTz
})
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('dates are local calendar days in every time zone', () => {
  it('the zone really changes under the test', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(480)
    process.env.TZ = 'Asia/Tokyo'
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-540)
  })

  for (const tz of ZONES) {
    it(`reads a stored YYYY-MM-DD as that day (${tz})`, () => {
      process.env.TZ = tz
      const row = { audited: '2026-09-05' }
      expect(run('DAY({Last counted})', row)).toBe(5)
      expect(run('MONTH({Last counted})', row)).toBe(9)
      expect(run('YEAR({Last counted})', row)).toBe(2026)
      // September 5, 2026 is a Saturday.
      expect(run('WEEKDAY({Last counted})', row)).toBe(6)
      expect(run('DATESTR({Last counted})', row)).toBe('2026-09-05')
      expect(run('DATESTR(DATEADD({Last counted}, 90, "days"))', row)).toBe('2026-12-04')
      expect(run('IS_BEFORE({Last counted}, "2026-09-06")', row)).toBe(true)
      expect(run('IS_BEFORE({Last counted}, "2026-09-05")', row)).toBe(false)
      expect(run('DATETIME_DIFF("2026-10-14", {Last counted}, "days")', row)).toBe(39)
    })

    it(`today's date stored in a field is TODAY() (${tz})`, () => {
      process.env.TZ = tz
      const row = { due: localToday() }
      expect(run('DATESTR(TODAY())')).toBe(localToday())
      expect(run('{Due} = TODAY()', row)).toBe(true)
      expect(run('IS_BEFORE({Due}, TODAY())', row)).toBe(false)
      expect(run('DATETIME_DIFF(TODAY(), {Due}, "days")', row)).toBe(0)
    })
  }

  it('day and week math crosses a daylight-saving change without losing a day', () => {
    process.env.TZ = 'America/New_York'
    expect(run('DATESTR(DATEADD("2026-10-20", 14, "days"))')).toBe('2026-11-03')
    expect(run('DATESTR(DATEADD("2026-03-01", 2, "weeks"))')).toBe('2026-03-15')
    expect(run('DATETIME_DIFF("2026-11-03", "2026-10-20", "days")')).toBe(14)
    expect(run('DATETIME_DIFF("2026-03-15", "2026-03-01", "w")')).toBe(2)
  })
})

describe('comparing a stored date with a date value', () => {
  it('compares as dates, and an empty date matches nothing', () => {
    expect(run('{Due} < TODAY()', { due: '2000-01-01' })).toBe(true)
    expect(run('{Due} > TODAY()', { due: '2000-01-01' })).toBe(false)
    expect(run('TODAY() > {Due}', { due: '2000-01-01' })).toBe(true)
    expect(run('{Due} = DATEADD("2026-09-04", 1, "days")', { due: '2026-09-05' })).toBe(true)
    expect(run('{Due} <= DATEADD("2026-09-04", 1, "days")', { due: '2026-09-06' })).toBe(false)
    expect(run('{Due} < TODAY()', { due: '' })).toBe(false)
    expect(run('{Due} = TODAY()', { due: null })).toBe(false)
    expect(run('{Due} != TODAY()', { due: null })).toBe(true)
    // Two stored dates still compare as text.
    expect(run('{Due} < "2026-10-01"', { due: '2026-09-05' })).toBe(true)
  })
})

describe('SWITCH is lazy', () => {
  it('runs only the branch it returns', () => {
    expect(run('SWITCH({Qty}, 0, "none", 10 / {Qty})', { qty: 0 })).toBe('none')
    expect(run('SWITCH({Qty}, 0, "none", 10 / {Qty})', { qty: 4 })).toBe(2.5)
    expect(run('SWITCH({Name}, "a", 1, "b", 2)', { name: 'c' })).toBeNull()
    expect(run('SWITCH({Name}, "a", 1, "b", 2, 0)', { name: 'b' })).toBe(2)
  })
})

describe('function edges', () => {
  it('VALUE of text without digits is empty', () => {
    expect(run('VALUE("abc")')).toBeNull()
    expect(run('VALUE("")')).toBeNull()
    expect(run('VALUE("$1,200.50")')).toBe(1200.5)
    expect(run('VALUE("0")')).toBe(0)
  })

  it('CEILING and FLOOR take a significance', () => {
    expect(run('CEILING(2.1)')).toBe(3)
    expect(run('FLOOR(2.9)')).toBe(2)
    expect(run('CEILING(7, 5)')).toBe(10)
    expect(run('FLOOR(7, 5)')).toBe(5)
    expect(run('CEILING(2.1, 0.1)')).toBe(2.1)
    expect(run('CEILING(2.12, 0.05)')).toBe(2.15)
    expect(run('FLOOR(-2.5, 1)')).toBe(-3)
    expect(run('CEILING(3, 0)')).toBe(0)
  })

  it('MID without a count gives the rest of the text', () => {
    expect(run('MID({Name}, 5)', { name: 'Arc floor lamp' })).toBe('floor lamp')
    expect(run('MID({Name}, 5, 5)', { name: 'Arc floor lamp' })).toBe('floor')
    expect(run('MID({Name}, 5, 0)', { name: 'Arc floor lamp' })).toBe('')
  })

  it('DATEADD and DATETIME_DIFF share their units; months and years are calendar units', () => {
    const d = (src: string) => run(`DATESTR(${src})`)
    expect(d('DATEADD("2026-01-31", 1, "months")')).toBe('2026-02-28')
    expect(d('DATEADD("2026-09-05", 2, "years")')).toBe('2028-09-05')
    expect(d('DATEADD("2026-09-05", 1, "week")')).toBe('2026-09-12')
    expect(d('DATEADD("2026-09-05", 3)')).toBe('2026-09-08')
    expect(run('DATETIME_DIFF("2026-10-05", "2026-09-20", "months")')).toBe(0)
    expect(run('DATETIME_DIFF("2026-10-20", "2026-09-20", "months")')).toBe(1)
    expect(run('DATETIME_DIFF("2028-09-04", "2026-09-05", "years")')).toBe(1)
    expect(run('DATETIME_DIFF("2026-09-20", "2026-10-20", "months")')).toBe(-1)
    // "m" is minutes in both.
    const t0 = new Date(2026, 8, 5, 10, 0).getTime()
    expect(run('DATETIME_DIFF(DATEADD({Due}, 90, "m"), {Due}, "minutes")', { due: new Date(t0) })).toBe(90)
    expect(run('DATETIME_DIFF(DATEADD({Due}, 2, "hours"), {Due})', { due: new Date(t0) })).toBe(7200)
  })

  it('an unknown unit is an error: at compile time when written as text, empty when it comes from a field', () => {
    expect(formulaError('DATEADD({Due}, 1, "fortnights")', resolve)).toMatch(/Unknown unit "fortnights"/)
    expect(formulaError('DATETIME_DIFF({Due}, TODAY(), "M")', resolve)).toBeNull()
    expect(formulaError('DATETIME_DIFF({Due}, TODAY(), "lightyears")', resolve)).toMatch(/Unknown unit/)
    expect(run('DATEADD("2026-09-05", 1, {Name})', { name: 'fortnights' })).toBeNull()
  })
})

describe('renameFormulaRefs', () => {
  it('rewrites references, not text that looks like one', () => {
    const to = (n: string) => (n.trim().toLowerCase() === 'unit cost' ? 'Cost' : null)
    expect(renameFormulaRefs('{Qty} * { unit cost } & "{Unit cost}"', to)).toBe('{Qty} * {Cost} & "{Unit cost}"')
    expect(renameFormulaRefs('{Qty} * 2', to)).toBe('{Qty} * 2')
    expect(renameFormulaRefs('"unclosed {Unit cost}', to)).toBe('"unclosed {Unit cost}')
  })
})

describe('date text', () => {
  it('reads only stored-date text as a date, never short text such as "1"', () => {
    expect(isoDate('2026-12-04')?.getDate()).toBe(4)
    expect(isoDate('2026-12-04T10:30:00Z')?.toISOString()).toBe('2026-12-04T10:30:00.000Z')
    expect(isoDate('1')).toBeNull()
    expect(isoDate('Count now')).toBeNull()
    expect(run('YEAR("1")')).toBeNull()
    expect(run('YEAR("12")')).toBeNull()
    expect(run('YEAR("October 5, 2026")')).toBe(2026)
    expect(run('IS_BEFORE("1", "2026-10-01")')).toBe(false)
  })
})

describe('self-reference and readers', () => {
  const cols = [
    { field: 'qty', header: 'Qty', fieldType: 'number' },
    { field: 'cost', header: 'Unit cost', fieldType: 'number' },
    { field: 'value', header: 'Stock value', fieldType: 'formula', fieldProps: { formula: '{Qty} * {Unit cost}' } },
    { field: 'status', header: 'Status', fieldType: 'formula', fieldProps: { formula: 'IF({qty} = 0, "Out", "OK")' } },
    { field: 'note', header: 'Note', fieldType: 'formula', fieldProps: { formula: '"{Qty}" & {Nope}' } },
  ]

  it('a formula naming its own field is an error with a message', () => {
    const others = cols.filter((c) => c.field !== 'value')
    expect(formulaError('{Stock value} + 1', columnResolver(others, ['value', 'Stock value']))).toBe('A formula cannot read its own field {Stock value}')
    expect(formulaError('{ VALUE } + 1', columnResolver(others, ['value', 'Stock value']))).toBe('A formula cannot read its own field {VALUE}')
    expect(formulaError('{Qty} + 1', columnResolver(others, ['value', 'Stock value']))).toBeNull()
  })

  it('lists the keys a formula names and the formula fields that read a field', () => {
    const resolve2 = columnResolver(cols)
    expect(formulaRefs('{Qty} * {Unit cost} & {Nope} & "{Status}"', resolve2)).toEqual(['qty', 'cost'])
    expect(formulaRefs('{Qty', resolve2)).toEqual([])
    expect(formulaReaders(cols, { field: 'qty' }).map((c) => c.header)).toEqual(['Stock value', 'Status'])
    expect(formulaReaders(cols, { field: 'cost' }).map((c) => c.header)).toEqual(['Stock value'])
    expect(formulaReaders(cols, { field: 'status' })).toEqual([])
  })
})
