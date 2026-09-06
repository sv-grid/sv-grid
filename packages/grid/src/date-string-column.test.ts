/**
 * `cellDataType: 'dateString'` columns, which hold an ISO date STRING
 * ('2026-06-27') rather than a Date or a timestamp.
 *
 * Two bugs lived here, both reported from the same demo:
 *
 *  1. Committing an edit ran through `parseEditorValue('date', ...)`, which
 *     does `new Date(v).toISOString()` - so '2026-12-25' was stored as
 *     '2026-12-25T01:00:00.000Z'. The cell then showed a timestamp next to
 *     neighbours showing plain dates. `dateString` resolves to
 *     `editorType: 'date'`, so nothing downstream knew the difference.
 *
 *  2. That conversion goes through UTC. A local midnight either side of the
 *     meridian lands on the previous or next day, so the stored CALENDAR DATE
 *     depended on where the user was sitting.
 */
import { describe, expect, it } from 'vitest'
import { parseEditorValue } from './editors/cell-editors'
import { toIsoDateLocal, usesRichDateFilter } from './SvGrid.helpers'

describe('parseEditorValue with dateOnly', () => {
  it('keeps an ISO date exactly as picked', () => {
    expect(parseEditorValue('date', '2026-12-25', { dateOnly: true })).toBe('2026-12-25')
  })

  it('trims a datetime down to its calendar date', () => {
    expect(parseEditorValue('date', '2026-12-25T09:30', { dateOnly: true })).toBe('2026-12-25')
  })

  it('never sends the value through UTC', () => {
    // The bug: a date whose UTC form is the day before. Whatever the runner's
    // zone, the day the user picked has to be the day that is stored.
    for (const raw of ['2026-01-01', '2026-12-31', '2026-06-15']) {
      expect(parseEditorValue('date', raw, { dateOnly: true })).toBe(raw)
    }
  })

  it('uses local parts when the input is not already ISO', () => {
    const d = new Date(2026, 11, 25, 23, 30) // local 25 Dec, late evening
    const out = parseEditorValue('date', d.toString(), { dateOnly: true })
    expect(out).toBe('2026-12-25')
  })

  it('returns null for something that is not a date at all', () => {
    expect(parseEditorValue('date', 'not a date', { dateOnly: true })).toBeNull()
  })

  it('leaves the normal date editor alone - it still stores a timestamp', () => {
    // `cellDataType: 'date'` columns hold Date values and DO want the ISO
    // timestamp. Only dateString opts out.
    const out = parseEditorValue('date', '2026-12-25')
    expect(String(out)).toMatch(/^2026-12-2[45]T/)
  })
})

describe('toIsoDateLocal', () => {
  it('formats from local parts, not UTC', () => {
    expect(toIsoDateLocal(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
    expect(toIsoDateLocal(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
  })

  it('is empty for no date', () => {
    expect(toIsoDateLocal(null)).toBe('')
    expect(toIsoDateLocal(undefined)).toBe('')
    expect(toIsoDateLocal(new Date('nonsense'))).toBe('')
  })
})

describe('usesRichDateFilter', () => {
  it('is on for the date-ish editors', () => {
    for (const t of ['date', 'datetime', 'time'] as const) {
      expect(usesRichDateFilter(t), t).toBe(true)
    }
  })

  it('honours the -native opt-out, same as the cell editor', () => {
    for (const t of ['date-native', 'datetime-native', 'time-native'] as const) {
      expect(usesRichDateFilter(t), t).toBe(false)
    }
  })

  it('is off for everything else', () => {
    for (const t of ['text', 'number', 'list', 'checkbox', undefined] as const) {
      expect(usesRichDateFilter(t as never), String(t)).toBe(false)
    }
  })
})
