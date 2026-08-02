import { describe, it, expect } from 'vitest'
import { toICS, fromICS, ruleToRRule, rruleToRule, type ICalEvent } from './scheduler-ical'
import type { RecurrenceRule } from './recurrence'

describe('iCal RRULE round-trip', () => {
  const cases: [RecurrenceRule, string][] = [
    [{ freq: 'weekly', weekdays: [1, 3, 5] }, 'FREQ=WEEKLY;BYDAY=MO,WE,FR'],
    [{ freq: 'daily', interval: 2 }, 'FREQ=DAILY;INTERVAL=2'],
    [{ freq: 'monthly', day: -1 }, 'FREQ=MONTHLY;BYMONTHDAY=-1'],
    [{ freq: 'monthly', weekdays: [2], weekOfMonth: 1 }, 'FREQ=MONTHLY;BYDAY=1TU'],
    [{ freq: 'monthly', weekdays: [5], weekOfMonth: -1 }, 'FREQ=MONTHLY;BYDAY=-1FR'],
    [{ freq: 'yearly', month: 10, weekdays: [4], weekOfMonth: 4 }, 'FREQ=YEARLY;BYDAY=4TH;BYMONTH=11'],
    [{ freq: 'weekly', weekdays: [1], count: 8 }, 'FREQ=WEEKLY;BYDAY=MO;COUNT=8'],
  ]
  it('serializes rules to RRULE', () => {
    for (const [rule, str] of cases) expect(ruleToRRule(rule)).toBe(str)
  })
  it('parses RRULE back to an equivalent rule', () => {
    for (const [rule, str] of cases) expect(rruleToRule(str)).toMatchObject(rule)
  })
})

describe('toICS / fromICS', () => {
  const events: ICalEvent[] = [
    { uid: 'a@x', title: 'Kickoff, prep', start: new Date('2026-07-06T09:00:00Z'), end: new Date('2026-07-06T10:00:00Z'), status: 'confirmed' },
    { uid: 'b@x', title: 'Offsite', start: new Date('2026-07-08T00:00:00Z'), end: new Date('2026-07-10T00:00:00Z'), allDay: true },
    { uid: 'c@x', title: 'Standup', start: new Date('2026-07-06T09:30:00Z'), end: new Date('2026-07-06T09:45:00Z'), rrule: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } },
  ]

  it('produces a valid VCALENDAR with one VEVENT per event', () => {
    const ics = toICS(events)
    expect(ics).toMatch(/^BEGIN:VCALENDAR/)
    expect(ics).toContain('BEGIN:VEVENT')
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(3)
    expect(ics).toContain('DTSTART:20260706T090000Z')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260708')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(ics).toContain('SUMMARY:Kickoff\\, prep') // comma escaped
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
  })

  it('round-trips events through export -> import', () => {
    const back = fromICS(toICS(events))
    expect(back).toHaveLength(3)
    expect(back[0]!.title).toBe('Kickoff, prep') // unescaped
    expect(back[0]!.start.toISOString()).toBe('2026-07-06T09:00:00.000Z')
    expect(back[1]!.allDay).toBe(true)
    expect(back[2]!.rrule).toMatchObject({ freq: 'weekly', weekdays: [1, 2, 3, 4, 5] })
  })

  it('imports a hand-written ICS (folded lines + CRLF)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:z@x',
      'DTSTART:20260706T140000Z',
      'DTEND:20260706T150000Z',
      'SUMMARY:Client call',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const out = fromICS(ics)
    expect(out).toHaveLength(1)
    expect(out[0]!.title).toBe('Client call')
    expect(out[0]!.end.toISOString()).toBe('2026-07-06T15:00:00.000Z')
  })
})
