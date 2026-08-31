/**
 * scheduler-ical - pure, dependency-free iCalendar (RFC 5545) import / export for
 * the scheduler. Works on a small {@link ICalEvent} shape so it stays data-model
 * agnostic: map your rows to/from it. Handles timed + all-day events, RRULE
 * round-trip (via the shared {@link RecurrenceRule}), STATUS, DESCRIPTION and
 * LOCATION. No `Date.now()` in the core - `toICS` accepts a stamp.
 */
import type { RecurrenceRule } from './recurrence'

/** One VEVENT: the fields SvGrid reads from and writes to an iCalendar feed. */
export type ICalEvent = {
  uid?: string
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  allDay?: boolean
  status?: 'confirmed' | 'tentative' | 'cancelled'
  rrule?: RecurrenceRule | null
}

const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
const pad = (n: number) => String(n).padStart(2, '0')

const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const dateOnly = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`

const escText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const unescText = (s: string) =>
  s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

/** Fold a content line at 74 octets (RFC 5545 line folding). */
function fold(line: string): string {
  if (line.length <= 74) return line
  let out = line.slice(0, 74)
  let rest = line.slice(74)
  while (rest.length > 73) {
    out += '\r\n ' + rest.slice(0, 73)
    rest = rest.slice(73)
  }
  return out + '\r\n ' + rest
}

// --- RRULE serialize / parse ------------------------------------------------

/** A {@link RecurrenceRule} -> an iCal `RRULE` value (without the `RRULE:` name). */
export function ruleToRRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`]
  if (rule.interval && rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`)
  if (rule.weekdays?.length) {
    if (rule.weekOfMonth != null && rule.weekdays.length === 1) {
      parts.push(`BYDAY=${rule.weekOfMonth}${WD[rule.weekdays[0]!]}`)
    } else {
      parts.push(`BYDAY=${rule.weekdays.map((w) => WD[w]).join(',')}`)
    }
  }
  if (rule.day != null && rule.weekOfMonth == null) parts.push(`BYMONTHDAY=${rule.day}`)
  if (rule.month != null) parts.push(`BYMONTH=${rule.month + 1}`)
  if (rule.count != null) parts.push(`COUNT=${rule.count}`)
  if (rule.until != null) parts.push(`UNTIL=${utcStamp(new Date(rule.until as string))}`)
  return parts.join(';')
}

/** An iCal `RRULE` value -> a {@link RecurrenceRule}. */
export function rruleToRule(value: string): RecurrenceRule | null {
  const map: Record<string, string> = {}
  for (const kv of value.split(';')) {
    const [k, v] = kv.split('=')
    if (k && v) map[k.toUpperCase()] = v
  }
  const freq = (map.FREQ ?? '').toLowerCase()
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) return null
  const rule: RecurrenceRule = { freq: freq as RecurrenceRule['freq'] }
  if (map.INTERVAL) rule.interval = Number(map.INTERVAL)
  if (map.BYDAY) {
    const parts = map.BYDAY.split(',')
    const m = parts[0]!.match(/^(-?\d+)?([A-Z]{2})$/)
    if (parts.length === 1 && m && m[1]) {
      rule.weekOfMonth = Number(m[1])
      rule.weekdays = [WD.indexOf(m[2] as (typeof WD)[number])]
    } else {
      rule.weekdays = parts.map((p) => WD.indexOf(p.replace(/^-?\d+/, '') as (typeof WD)[number])).filter((n) => n >= 0)
    }
  }
  if (map.BYMONTHDAY) rule.day = Number(map.BYMONTHDAY)
  if (map.BYMONTH) rule.month = Number(map.BYMONTH) - 1
  if (map.COUNT) rule.count = Number(map.COUNT)
  if (map.UNTIL) rule.until = parseICalDate(map.UNTIL).date.toISOString()
  return rule
}

// --- export -----------------------------------------------------------------

/** Serialize events to an iCalendar string. `stamp` sets DTSTAMP (default epoch). */
export function toICS(events: ReadonlyArray<ICalEvent>, opts: { prodId?: string; stamp?: Date } = {}): string {
  const stamp = utcStamp(opts.stamp ?? new Date(0))
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${opts.prodId ?? '-//SvGrid//Scheduler//EN'}`]
  events.forEach((e, i) => {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.uid ?? `svgrid-${i}-${e.start.getTime()}`}`)
    lines.push(`DTSTAMP:${stamp}`)
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.start)}`)
      lines.push(`DTEND;VALUE=DATE:${dateOnly(e.end)}`)
    } else {
      lines.push(`DTSTART:${utcStamp(e.start)}`)
      lines.push(`DTEND:${utcStamp(e.end)}`)
    }
    lines.push(`SUMMARY:${escText(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${escText(e.description)}`)
    if (e.location) lines.push(`LOCATION:${escText(e.location)}`)
    if (e.status) lines.push(`STATUS:${e.status.toUpperCase()}`)
    if (e.rrule) lines.push(`RRULE:${ruleToRRule(e.rrule)}`)
    lines.push('END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}

// --- import -----------------------------------------------------------------

function parseICalDate(value: string): { date: Date; allDay: boolean } {
  // 20260706 (date) | 20260706T093000Z (utc) | 20260706T093000 (local/floating)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/)
  if (!m) return { date: new Date(NaN), allDay: false }
  const [, y, mo, d, hh, mm, ss, z] = m
  if (hh == null) return { date: new Date(Number(y), Number(mo) - 1, Number(d)), allDay: true }
  if (z) return { date: new Date(Date.UTC(+y!, +mo! - 1, +d!, +hh, +mm!, +ss!)), allDay: false }
  return { date: new Date(+y!, +mo! - 1, +d!, +hh, +mm!, +ss!), allDay: false }
}

/** Parse an iCalendar string into events (unfolds lines, reads VEVENT blocks). */
export function fromICS(text: string): ICalEvent[] {
  // Unfold: a line starting with space/tab continues the previous one.
  const raw = text.replace(/\r\n/g, '\n').split('\n')
  const unfolded: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else unfolded.push(line)
  }
  const out: ICalEvent[] = []
  let cur: Partial<ICalEvent> & { _allDayStart?: boolean } = {}
  let inEvent = false
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      cur = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (cur.title && cur.start && cur.end) out.push({ title: cur.title, start: cur.start, end: cur.end, allDay: cur.allDay, uid: cur.uid, description: cur.description, location: cur.location, status: cur.status, rrule: cur.rrule ?? null })
      inEvent = false
      continue
    }
    if (!inEvent) continue
    const ci = line.indexOf(':')
    if (ci < 0) continue
    const nameAndParams = line.slice(0, ci)
    const value = line.slice(ci + 1)
    const name = nameAndParams.split(';')[0]!.toUpperCase()
    if (name === 'UID') cur.uid = value
    else if (name === 'SUMMARY') cur.title = unescText(value)
    else if (name === 'DESCRIPTION') cur.description = unescText(value)
    else if (name === 'LOCATION') cur.location = unescText(value)
    else if (name === 'STATUS') cur.status = value.toLowerCase() as ICalEvent['status']
    else if (name === 'DTSTART') {
      const { date, allDay } = parseICalDate(value)
      cur.start = date
      cur.allDay = allDay
    } else if (name === 'DTEND') {
      cur.end = parseICalDate(value).date
    } else if (name === 'RRULE') {
      cur.rrule = rruleToRule(value) ?? undefined
    }
  }
  return out
}
