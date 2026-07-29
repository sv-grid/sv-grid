import { describe, expect, it, vi } from 'vitest'
import {
  parseCron,
  cronMatches,
  isScheduleDue,
  nextRun,
  createScheduler,
  CRON_PRESETS,
  type Schedule,
} from './scheduling'

// A fixed reference instant: Monday 2026-07-27, 17:30 local time.
// (2026-07-27 is a Monday; getDay() === 1.)
const MON_1730 = new Date(2026, 6, 27, 17, 30, 0)

describe('parseCron', () => {
  it('rejects the wrong field count', () => {
    expect(() => parseCron('* * * *')).toThrow(/5 fields/)
    expect(() => parseCron('0 9 * * * *')).toThrow(/5 fields/)
  })

  it('rejects an unparseable step', () => {
    expect(() => parseCron('*/0 * * * *')).toThrow(/step/)
  })
})

describe('cronMatches', () => {
  it('matches an exact minute/hour', () => {
    expect(cronMatches('30 17 * * *', MON_1730)).toBe(true)
    expect(cronMatches('31 17 * * *', MON_1730)).toBe(false)
    expect(cronMatches('30 16 * * *', MON_1730)).toBe(false)
  })

  it('matches weekday ranges (1-5 = Mon-Fri)', () => {
    expect(cronMatches('30 17 * * 1-5', MON_1730)).toBe(true)
    const sun = new Date(2026, 6, 26, 17, 30) // Sunday
    expect(cronMatches('30 17 * * 1-5', sun)).toBe(false)
  })

  it('accepts 7 as an alias for Sunday', () => {
    const sun = new Date(2026, 6, 26, 9, 0)
    expect(cronMatches('0 9 * * 7', sun)).toBe(true)
    expect(cronMatches('0 9 * * 0', sun)).toBe(true)
  })

  it('honors step values (*/15)', () => {
    expect(cronMatches('*/15 * * * *', new Date(2026, 6, 27, 10, 0))).toBe(true)
    expect(cronMatches('*/15 * * * *', new Date(2026, 6, 27, 10, 15))).toBe(true)
    expect(cronMatches('*/15 * * * *', new Date(2026, 6, 27, 10, 7))).toBe(false)
  })

  it('honors lists (0,30)', () => {
    expect(cronMatches('0,30 * * * *', new Date(2026, 6, 27, 10, 0))).toBe(true)
    expect(cronMatches('0,30 * * * *', new Date(2026, 6, 27, 10, 30))).toBe(true)
    expect(cronMatches('0,30 * * * *', new Date(2026, 6, 27, 10, 15))).toBe(false)
  })

  it('uses UNION semantics when both day-of-month and day-of-week are set', () => {
    // Fires on the 1st OR on any Monday. 2026-07-27 is a Monday (not the 1st).
    expect(cronMatches('0 9 1 * 1', new Date(2026, 6, 27, 9, 0))).toBe(true)
    // 2026-07-15 is a Wednesday and not the 1st -> neither matches.
    expect(cronMatches('0 9 1 * 1', new Date(2026, 6, 15, 9, 0))).toBe(false)
    // The 1st of the month, a Wednesday -> dom matches.
    expect(cronMatches('0 9 1 * 1', new Date(2026, 6, 1, 9, 0))).toBe(true)
  })

  it('every preset parses and matches at least one time this year', () => {
    for (const p of CRON_PRESETS) {
      expect(() => parseCron(p.cron)).not.toThrow()
      expect(nextRun({ id: p.label, cron: p.cron }, MON_1730)).toBeInstanceOf(Date)
    }
  })
})

describe('isScheduleDue', () => {
  it('is false when disabled', () => {
    expect(isScheduleDue({ id: 'a', cron: '30 17 * * *', enabled: false }, MON_1730)).toBe(false)
  })

  it('fires a one-off in its exact minute only', () => {
    const s: Schedule = { id: 'once', runAt: MON_1730.toISOString() }
    expect(isScheduleDue(s, MON_1730)).toBe(true)
    expect(isScheduleDue(s, new Date(2026, 6, 27, 17, 31))).toBe(false)
  })

  it('prefers runAt over cron when both are present', () => {
    const s: Schedule = { id: 'both', runAt: MON_1730.toISOString(), cron: '0 0 * * *' }
    expect(isScheduleDue(s, MON_1730)).toBe(true)
    expect(isScheduleDue(s, new Date(2026, 6, 27, 0, 0))).toBe(false)
  })
})

describe('nextRun', () => {
  it('finds the next cron occurrence', () => {
    const from = new Date(2026, 6, 27, 17, 31) // just after 17:30
    const next = nextRun({ id: 'eod', cron: '30 17 * * 1-5' }, from)
    // Next weekday 17:30 is Tuesday the 28th.
    expect(next).toEqual(new Date(2026, 6, 28, 17, 30))
  })

  it('returns null for a one-off already in the past', () => {
    const past = new Date(2020, 0, 1, 0, 0).toISOString()
    expect(nextRun({ id: 'old', runAt: past }, MON_1730)).toBeNull()
  })

  it('returns the one-off instant when still in the future', () => {
    const future = new Date(2026, 6, 27, 18, 0)
    expect(nextRun({ id: 'soon', runAt: future.toISOString() }, MON_1730)).toEqual(future)
  })
})

describe('createScheduler', () => {
  it('fires a due schedule exactly once per minute across repeated ticks', () => {
    const onFire = vi.fn()
    let clock = MON_1730
    const scheduler = createScheduler({
      schedules: [{ id: 'eod', cron: '30 17 * * 1-5' }],
      onFire,
      now: () => clock,
    })
    // Two ticks in the same minute (the 30s interval fires twice a minute).
    scheduler.tick()
    scheduler.tick()
    expect(onFire).toHaveBeenCalledTimes(1)
    expect(onFire).toHaveBeenCalledWith(expect.objectContaining({ id: 'eod' }), clock)

    // Advance a minute past the match: no new fire.
    clock = new Date(2026, 6, 27, 17, 31)
    scheduler.tick()
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it('fires a one-off only once, ever', () => {
    const onFire = vi.fn()
    let clock = MON_1730
    const scheduler = createScheduler({
      schedules: [{ id: 'once', runAt: MON_1730.toISOString() }],
      onFire,
      now: () => clock,
    })
    scheduler.tick()
    // Same minute again, and a later matching-looking minute: still once.
    scheduler.tick()
    clock = new Date(MON_1730.getTime() + 60_000)
    scheduler.tick()
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it('skips disabled schedules', () => {
    const onFire = vi.fn()
    const scheduler = createScheduler({
      schedules: [{ id: 'x', cron: '30 17 * * *', enabled: false }],
      onFire,
      now: () => MON_1730,
    })
    scheduler.tick()
    expect(onFire).not.toHaveBeenCalled()
  })

  it('start()/stop() drive ticks on the interval', () => {
    vi.useFakeTimers()
    try {
      const onFire = vi.fn()
      const scheduler = createScheduler({
        schedules: [{ id: 'min', cron: '* * * * *' }],
        onFire,
        now: () => new Date(2026, 6, 27, 17, 30, 0),
        intervalMs: 30_000,
      })
      scheduler.start()
      vi.advanceTimersByTime(30_000)
      expect(onFire).toHaveBeenCalledTimes(1) // once per minute despite 2 ticks
      scheduler.stop()
      vi.advanceTimersByTime(120_000)
      expect(onFire).toHaveBeenCalledTimes(1) // stopped: no more fires
    } finally {
      vi.useRealTimers()
    }
  })

  it('upcoming() reports the next run per schedule', () => {
    const scheduler = createScheduler({
      schedules: [
        { id: 'eod', cron: '30 17 * * 1-5' },
        { id: 'old', runAt: new Date(2020, 0, 1).toISOString() },
      ],
      onFire: () => {},
      now: () => new Date(2026, 6, 27, 17, 31),
    })
    const up = scheduler.upcoming()
    expect(up.find((u) => u.id === 'eod')?.at).toEqual(new Date(2026, 6, 28, 17, 30))
    expect(up.find((u) => u.id === 'old')?.at).toBeNull()
  })
})
