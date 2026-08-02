import { describe, it, expect } from 'vitest'
import { zoneParts, zoneOffsetMs, toZonedLocal, fromZonedLocal, instantFromWallClock, normalizeTimeZone } from './timezone'

const H = 3_600_000

describe('timezone utils', () => {
  // 2026-07-01 12:00 UTC (summer): NY = EDT (-4), Kolkata = +5:30, London = BST (+1)
  const summer = new Date('2026-07-01T12:00:00Z')
  // 2026-01-01 12:00 UTC (winter): NY = EST (-5), London = GMT (0)
  const winter = new Date('2026-01-01T12:00:00Z')

  it('zoneParts gives wall-clock in the target zone', () => {
    expect(zoneParts(summer, 'America/New_York')).toMatchObject({ hour: 8, minute: 0 })
    expect(zoneParts(summer, 'Asia/Kolkata')).toMatchObject({ hour: 17, minute: 30 })
    expect(zoneParts(summer, 'Europe/London')).toMatchObject({ hour: 13, minute: 0 })
    expect(zoneParts(winter, 'America/New_York')).toMatchObject({ hour: 7 })
  })

  it('zoneOffsetMs is DST-aware', () => {
    expect(zoneOffsetMs(summer, 'America/New_York')).toBe(-4 * H)
    expect(zoneOffsetMs(winter, 'America/New_York')).toBe(-5 * H)
    expect(zoneOffsetMs(summer, 'Asia/Kolkata')).toBe(5.5 * H)
    expect(zoneOffsetMs(winter, 'Europe/London')).toBe(0)
  })

  it('toZonedLocal exposes the zone wall-clock via local getters', () => {
    const z = toZonedLocal(summer, 'Asia/Kolkata')
    expect(z.getHours()).toBe(17)
    expect(z.getMinutes()).toBe(30)
  })

  it('fromZonedLocal round-trips back to the same instant', () => {
    for (const tz of ['America/New_York', 'Asia/Kolkata', 'Europe/London', 'Australia/Sydney']) {
      for (const inst of [summer, winter]) {
        const back = fromZonedLocal(toZonedLocal(inst, tz), tz)
        expect(back.getTime()).toBe(Math.floor(inst.getTime() / 1000) * 1000)
      }
    }
  })

  it('instantFromWallClock maps a zone wall-clock to the right instant', () => {
    // 09:00 in New York on 2026-07-01 (EDT -4) === 13:00 UTC.
    const inst = instantFromWallClock(2026, 7, 1, 9, 0, 0, 'America/New_York')
    expect(inst.toISOString()).toBe('2026-07-01T13:00:00.000Z')
    // 09:00 in Kolkata (+5:30) === 03:30 UTC.
    expect(instantFromWallClock(2026, 7, 1, 9, 0, 0, 'Asia/Kolkata').toISOString()).toBe('2026-07-01T03:30:00.000Z')
  })

  it('handles the DST spring-forward edge without drifting', () => {
    // US spring-forward 2026-03-08: 02:00 EST -> 03:00 EDT. 09:00 that day is EDT (-4).
    const inst = instantFromWallClock(2026, 3, 8, 9, 0, 0, 'America/New_York')
    expect(inst.toISOString()).toBe('2026-03-08T13:00:00.000Z')
    // The round trip is stable for a post-transition instant.
    const back = fromZonedLocal(toZonedLocal(inst, 'America/New_York'), 'America/New_York')
    expect(back.getTime()).toBe(inst.getTime())
  })

  it('undefined zone is the identity (browser local)', () => {
    expect(toZonedLocal(summer, undefined)).toBe(summer)
    expect(fromZonedLocal(summer, undefined)).toBe(summer)
    expect(zoneOffsetMs(summer, undefined)).toBe(-summer.getTimezoneOffset() * 60_000)
  })

  it('normalizeTimeZone rejects bad ids', () => {
    expect(normalizeTimeZone('America/New_York')).toBe('America/New_York')
    expect(normalizeTimeZone('Not/AZone')).toBeUndefined()
    expect(normalizeTimeZone(undefined)).toBeUndefined()
  })
})
