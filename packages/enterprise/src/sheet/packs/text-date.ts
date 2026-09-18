/**
 * More of Excel's text and date functions.
 *
 * Dates in this engine are the `yyyy-mm-dd` text the DATE family already
 * hands back, or a serial number; `toDate` reads either. The functions that
 * produce a date produce the text form, the ones that produce a time
 * produce a serial fraction of a day, which the `h:mm` number formats show.
 */
import { FormulaError, err, type CellValue } from '../ast'
import { toNumber, toText, isBlank, toDate, isoDate, dateSerial } from '../coerce'
import type { FnArgs, SheetFunction } from '../functions'

const first = (a: FnArgs): CellValue => a.flat[0] ?? ''
const nth = (a: FnArgs, i: number): CellValue => a.args[i]?.[0] ?? ''
const num = (a: FnArgs, i: number): number => toNumber(nth(a, i))
function opt(a: FnArgs, i: number, fallback: number): number {
  const v = a.args[i]?.[0]
  return v === undefined || v === '' ? fallback : toNumber(v)
}

const DAY_MS = 86400000

/** Hours, minutes and seconds out of a value: a serial's fraction, a
 *  `hh:mm[:ss] [AM|PM]` text (with or without a date before it), or a
 *  date-time `toDate` can read. */
function timeOf(v: CellValue): { h: number; m: number; s: number } {
  if (typeof v === 'number') {
    const secs = Math.round((v - Math.floor(v)) * 86400) % 86400
    return { h: Math.floor(secs / 3600), m: Math.floor((secs % 3600) / 60), s: secs % 60 }
  }
  const text = toText(v).trim()
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*$/.exec(text)
  if (m) {
    let h = Number(m[1])
    const meridian = m[4]?.toUpperCase()
    if (meridian === 'PM' && h < 12) h += 12
    if (meridian === 'AM' && h === 12) h = 0
    if (h > 23 || Number(m[2]) > 59 || Number(m[3] ?? 0) > 59) throw new FormulaError('#VALUE!')
    return { h, m: Number(m[2]), s: Number(m[3] ?? 0) }
  }
  const d = toDate(v)
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() }
}

const isWeekend = (d: Date): boolean => d.getUTCDay() === 0 || d.getUTCDay() === 6

const daySerial = (d: Date): number => Math.floor(dateSerial(d))

/** The holidays argument of NETWORKDAYS / WORKDAY as a set of day serials. */
function holidaySet(values: ReadonlyArray<CellValue> | undefined): Set<number> {
  const out = new Set<number>()
  for (const v of values ?? []) {
    if (isBlank(v)) continue
    out.add(daySerial(toDate(v)))
  }
  return out
}

const isLetter = (ch: string): boolean => ch.toLowerCase() !== ch.toUpperCase()

const lastOfMonth = (d: Date): number => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()

/** Days between two dates on a 360-day year, the US (NASD) method Excel
 *  defaults to. */
function days360(s: Date, e: Date): number {
  let d1 = s.getUTCDate()
  let d2 = e.getUTCDate()
  if (d1 === 31 || (s.getUTCMonth() === 1 && d1 === lastOfMonth(s))) d1 = 30
  if (d2 === 31 && d1 === 30) d2 = 30
  return (e.getUTCFullYear() - s.getUTCFullYear()) * 360 + (e.getUTCMonth() - s.getUTCMonth()) * 30 + (d2 - d1)
}

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export const TEXT_DATE_FUNCTIONS: Record<string, SheetFunction> = {
  // ---- Text ------------------------------------------------------------
  // Excel capitalises a letter that follows anything but a letter, so
  // "76BudGet" is "76Budget" and "2-way" is "2-Way".
  PROPER: (a) => {
    const s = toText(first(a))
    let out = ''
    let afterLetter = false
    for (const ch of s) {
      if (isLetter(ch)) {
        out += afterLetter ? ch.toLowerCase() : ch.toUpperCase()
        afterLetter = true
      } else {
        out += ch
        afterLetter = false
      }
    }
    return out
  },
  REPT: (a) => {
    const n = Math.trunc(num(a, 1))
    if (n < 0) return err('#VALUE!')
    return toText(nth(a, 0)).repeat(n)
  },
  // VALUE reads what a typed entry would: a plain number, a currency or
  // grouped one, a percentage, a time or a date.
  VALUE: (a) => {
    const v = first(a)
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return err('#VALUE!')
    const text = toText(v).trim()
    if (text === '') return err('#VALUE!')
    const cleaned = text.replace(/[$,]/g, '')
    if (/^-?\d*\.?\d+(e[+-]?\d+)?%$/i.test(cleaned)) return Number(cleaned.slice(0, -1)) / 100
    const n = Number(cleaned)
    if (cleaned !== '' && Number.isFinite(n)) return n
    if (/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(text)) {
      const t = timeOf(text)
      return (t.h * 3600 + t.m * 60 + t.s) / 86400
    }
    try {
      return dateSerial(toDate(text))
    } catch {
      return err('#VALUE!')
    }
  },
  CHAR: (a) => {
    const n = Math.trunc(num(a, 0))
    if (n < 1 || n > 255) return err('#VALUE!')
    return String.fromCharCode(n)
  },
  CODE: (a) => {
    const s = toText(first(a))
    return s === '' ? err('#VALUE!') : s.charCodeAt(0)
  },
  UNICHAR: (a) => {
    const n = Math.trunc(num(a, 0))
    if (n < 1 || n > 0x10ffff) return err('#VALUE!')
    return String.fromCodePoint(n)
  },
  UNICODE: (a) => {
    const s = toText(first(a))
    return s === '' ? err('#VALUE!') : s.codePointAt(0)!
  },
  EXACT: (a) => toText(nth(a, 0)) === toText(nth(a, 1)),
  CLEAN: (a) => {
    let out = ''
    for (const ch of toText(first(a))) if (ch.charCodeAt(0) >= 32) out += ch
    return out
  },
  REPLACE: (a) => {
    const s = toText(nth(a, 0))
    const start = Math.trunc(num(a, 1))
    const count = Math.trunc(num(a, 2))
    if (start < 1 || count < 0) return err('#VALUE!')
    return s.slice(0, start - 1) + toText(nth(a, 3)) + s.slice(start - 1 + count)
  },
  T: (a) => (typeof first(a) === 'string' ? first(a) : ''),
  N: (a) => {
    const v = first(a)
    return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0
  },

  // ---- Date and time ---------------------------------------------------
  // WEEKDAY(date, [type]): 1 counts Sunday as 1, 2 counts Monday as 1, 3
  // counts Monday as 0; 11 to 17 count from Monday to Sunday as 1.
  WEEKDAY: (a) => {
    const day = toDate(nth(a, 0)).getUTCDay()
    const type = opt(a, 1, 1)
    if (type === 1) return day + 1
    if (type === 2) return ((day + 6) % 7) + 1
    if (type === 3) return (day + 6) % 7
    if (type >= 11 && type <= 17) {
      const start = (type - 10) % 7
      return ((day - start + 7) % 7) + 1
    }
    return err('#NUM!')
  },
  // EDATE(date, months): the same day `months` on, clamped to the end of a
  // shorter month, so a 31st in January lands on the 28th or 29th.
  EDATE: (a) => {
    const d = toDate(nth(a, 0))
    const months = Math.trunc(num(a, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + months
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    return isoDate(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))))
  },
  NETWORKDAYS: (a) => {
    const start = daySerial(toDate(nth(a, 0)))
    const end = daySerial(toDate(nth(a, 1)))
    const holidays = holidaySet(a.args[2])
    const from = Math.min(start, end)
    const to = Math.max(start, end)
    let count = 0
    for (let s = from; s <= to; s += 1) {
      if (!isWeekend(toDate(s)) && !holidays.has(s)) count += 1
    }
    return end < start ? -count : count
  },
  WORKDAY: (a) => {
    let s = daySerial(toDate(nth(a, 0)))
    let left = Math.trunc(num(a, 1))
    const holidays = holidaySet(a.args[2])
    const step = left < 0 ? -1 : 1
    while (left !== 0) {
      s += step
      if (isWeekend(toDate(s)) || holidays.has(s)) continue
      left -= step
    }
    return isoDate(toDate(s))
  },
  // WEEKNUM(date, [type]): 1 and 2 make the week holding January 1 week 1,
  // starting Sunday or Monday; 11 to 17 start on Monday to Sunday; 21 is
  // the ISO week.
  WEEKNUM: (a) => {
    const d = toDate(nth(a, 0))
    const type = opt(a, 1, 1)
    if (type === 21) {
      const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      // Move to the Thursday of this week; its year is the ISO year.
      t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3)
      const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
      const firstThursday = new Date(jan4.getTime())
      firstThursday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3)
      return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
    }
    const startDay = type === 1 ? 0 : type === 2 ? 1 : type >= 11 && type <= 17 ? (type - 10) % 7 : -1
    if (startDay < 0) return err('#NUM!')
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const offset = (jan1.getUTCDay() - startDay + 7) % 7
    const dayOfYear = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - jan1.getTime()) / DAY_MS)
    return Math.floor((dayOfYear + offset) / 7) + 1
  },
  HOUR: (a) => timeOf(first(a)).h,
  MINUTE: (a) => timeOf(first(a)).m,
  SECOND: (a) => timeOf(first(a)).s,
  // TIME(hour, minute, second): a fraction of a day, wrapping past 24 hours.
  TIME: (a) => {
    const secs = Math.trunc(num(a, 0)) * 3600 + Math.trunc(num(a, 1)) * 60 + Math.trunc(num(a, 2))
    if (secs < 0) return err('#NUM!')
    return (secs % 86400) / 86400
  },
  DATEVALUE: (a) => {
    const v = first(a)
    if (typeof v === 'number') return err('#VALUE!')
    return daySerial(toDate(v))
  },
  TIMEVALUE: (a) => {
    const t = timeOf(first(a))
    return (t.h * 3600 + t.m * 60 + t.s) / 86400
  },
  DAYS360: (a) => days360(toDate(nth(a, 0)), toDate(nth(a, 1))),
  // YEARFRAC(start, end, [basis]): 0 is US 30/360, 1 actual/actual, 2
  // actual/360, 3 actual/365, 4 European 30/360 (read as US here).
  YEARFRAC: (a) => {
    const s = toDate(nth(a, 0))
    const e = toDate(nth(a, 1))
    const basis = Math.trunc(opt(a, 2, 0))
    const from = s.getTime() <= e.getTime() ? s : e
    const to = s.getTime() <= e.getTime() ? e : s
    if (basis === 0 || basis === 4) return days360(from, to) / 360
    const days = daySerial(to) - daySerial(from)
    if (basis === 2) return days / 360
    if (basis === 3) return days / 365
    if (basis !== 1) return err('#NUM!')
    // Actual/actual: the average year length across the span.
    const y1 = from.getUTCFullYear()
    const y2 = to.getUTCFullYear()
    let total = 0
    for (let y = y1; y <= y2; y += 1) total += isLeap(y) ? 366 : 365
    return days / (total / (y2 - y1 + 1))
  },
}
