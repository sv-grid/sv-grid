/**
 * Dates must come out of an export as the day the grid showed, in every
 * timezone (#103). Text exports used `toISOString()`, which is UTC, so local
 * midnight on the 15th came out as the 14th east of UTC. A bare 'YYYY-MM-DD'
 * was parsed as UTC midnight, so west of UTC it formatted as the day before.
 *
 * These pin `process.env.TZ` per case: a suite run on a UTC machine (CI) would
 * pass the old code without it.
 */
import { describe, expect, it } from 'vitest'
import { parseDateValue } from './cell-formatting'
import { asDate } from './SvGrid.helpers'
import {
  coerceExportDate,
  formatValueForExport,
  serializeDelimited,
  serializeHtml,
  serializeMarkdown,
  toLocalIsoString,
} from './export-format'

async function inZone<T>(tz: string, fn: () => T | Promise<T>): Promise<T> {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    return await fn()
  } finally {
    // Assigning undefined would set the string "undefined".
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}

const EAST = 'Europe/Sofia' // UTC+2 in January
const FAR_EAST = 'Pacific/Auckland' // UTC+13 in January
const WEST = 'America/New_York' // UTC-5 in January

describe('parseDateValue', () => {
  it('reads a bare calendar date as local midnight of that day', async () => {
    for (const tz of [EAST, FAR_EAST, WEST, 'UTC']) {
      await inZone(tz, () => {
        const d = parseDateValue('2026-06-27')!
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], tz).toEqual([2026, 5, 27, 0])
        // The grid's display path uses the same parser.
        expect(asDate('2026-06-27')!.getTime(), tz).toBe(d.getTime())
      })
    }
  })

  it('rejects an impossible calendar date instead of rolling it over', () => {
    expect(parseDateValue('2026-02-30')).toBeNull()
    expect(parseDateValue('2026-13-01')).toBeNull()
  })

  it('leaves full timestamps, Dates and epoch numbers alone', () => {
    expect(parseDateValue('2024-01-15T10:00:00Z')!.toISOString()).toBe('2024-01-15T10:00:00.000Z')
    const d = new Date(2024, 0, 15)
    expect(parseDateValue(d)).toBe(d)
    expect(parseDateValue(0)!.getTime()).toBe(0)
    expect(parseDateValue(null)).toBeNull()
    expect(parseDateValue('')).toBeNull()
    expect(parseDateValue('nope')).toBeNull()
    expect(parseDateValue(true)).toBeNull()
  })

  it('coerceExportDate follows it', async () => {
    await inZone(WEST, () => {
      expect(coerceExportDate('2024-01-15')!.getDate()).toBe(15)
    })
  })
})

describe('formatted date export west of UTC', () => {
  it('shows the calendar day of a date-only string', async () => {
    await inZone(WEST, () => {
      expect(formatValueForExport('2024-01-15', { type: 'date', locales: 'en-US' })).toBe('01/15/2024')
    })
  })
})

describe('toLocalIsoString', () => {
  it('writes the local wall clock with its offset', async () => {
    await inZone(EAST, () => {
      expect(toLocalIsoString(new Date(2024, 0, 15))).toBe('2024-01-15T00:00:00.000+02:00')
    })
    await inZone(WEST, () => {
      expect(toLocalIsoString(new Date(2024, 0, 15, 9, 5, 7, 42))).toBe('2024-01-15T09:05:07.042-05:00')
    })
    await inZone('Asia/Kolkata', () => {
      expect(toLocalIsoString(new Date(2024, 0, 15))).toBe('2024-01-15T00:00:00.000+05:30')
    })
  })

  it('is the same instant as the Date', async () => {
    await inZone(FAR_EAST, () => {
      const d = new Date(2024, 0, 15, 3, 4, 5)
      expect(new Date(toLocalIsoString(d)).getTime()).toBe(d.getTime())
    })
  })
})

describe('text exports keep the local day (#103)', () => {
  it('CSV, HTML and Markdown write 2024-01-15 east of UTC', async () => {
    for (const tz of [EAST, FAR_EAST]) {
      await inZone(tz, async () => {
        // Build the Date inside the zone: local midnight there.
        const local = [{ when: 'When' }, { when: new Date(2024, 0, 15) }]
        expect(await serializeDelimited(local, ['when']), tz).toContain('2024-01-15T00:00:00.000+')
        expect(await serializeHtml(local, ['when']), tz).toContain('2024-01-15T00:00:00.000+')
        expect(await serializeMarkdown(local, ['when']), tz).toContain('2024-01-15T00:00:00.000+')
      })
    }
  })
})
