import { describe, expect, it, vi } from 'vitest'
import { createAlertEngine } from './alert-engine'
import { createAlertObserver } from './alert-observer'
import { createAlertScheduler } from './alert-scheduler'
import type { AlertEvent, AlertRule } from './alert-types'

type Row = { id: string; price: number; region: string; status: string }

const seedRows = (over: Partial<Row>[] = []): Row[] =>
  [
    { id: 'a', price: 120, region: 'EU', status: 'open' },
    { id: 'b', price: 80, region: 'US', status: 'open' },
  ].map((r, i) => ({ ...r, ...(over[i] ?? {}) }))

const getRowId = (r: Row) => r.id

const dataChangeRule: AlertRule = {
  id: 'r1',
  name: 'High price',
  enabled: true,
  severity: 'warning',
  scope: 'row',
  predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 },
  trigger: { type: 'dataChange' },
  actions: [{ kind: 'toast', message: '{region} at {value}' }],
  createdAt: 0,
}

const relativeRule: AlertRule = {
  id: 'r2',
  name: 'Jumped',
  enabled: true,
  severity: 'info',
  scope: 'row',
  predicate: { kind: 'const', value: true },
  trigger: { type: 'relativeChange', expr: { kind: 'percentChange', column: 'price', op: '>', value: 5, abs: true } },
  actions: [{ kind: 'toast', message: 'moved' }],
  createdAt: 0,
}

function harness(rules: AlertRule[]) {
  const engine = createAlertEngine<Row>({ rules, getRowId, now: () => 1000 })
  const events: AlertEvent[] = []
  const observer = createAlertObserver<Row>({
    engine,
    getRowId,
    schedule: 'sync', // deterministic: runs inline
    onEvents: (batch) => events.push(...batch),
  })
  return { engine, observer, events }
}

describe('engine.needsPrev / needsFullSet', () => {
  it('needsPrev is true only when a relativeChange rule is enabled', () => {
    expect(createAlertEngine<Row>({ rules: [dataChangeRule], getRowId }).needsPrev()).toBe(false)
    expect(createAlertEngine<Row>({ rules: [relativeRule], getRowId }).needsPrev()).toBe(true)
    expect(
      createAlertEngine<Row>({ rules: [{ ...relativeRule, enabled: false }], getRowId }).needsPrev(),
    ).toBe(false)
  })

  it('needsFullSet is true only when an aggregate-scope rule is enabled', () => {
    expect(createAlertEngine<Row>({ rules: [dataChangeRule], getRowId }).needsFullSet()).toBe(false)
    const agg: AlertRule = { ...dataChangeRule, id: 'agg', scope: 'aggregate' }
    expect(createAlertEngine<Row>({ rules: [agg], getRowId }).needsFullSet()).toBe(true)
  })
})

describe('createAlertObserver push mode', () => {
  it('seed is silent - pre-existing matches do not fire', () => {
    const { observer, events } = harness([dataChangeRule])
    observer.seed(seedRows()) // 'a' already > 100
    expect(events).toHaveLength(0)
  })

  it('pushChanged fires only for the rows it is given, once on crossing', () => {
    const { observer, events } = harness([dataChangeRule])
    observer.seed(seedRows([{ price: 90 }])) // 'a' starts below threshold
    // 'b' unchanged and below threshold; push 'a' now crossing.
    observer.pushChanged([{ id: 'a', price: 130, region: 'EU', status: 'open' }])
    expect(events).toHaveLength(1)
    expect(events[0]!.rowId).toBe('a')
    // Pushing it again while it stays above must not re-fire (edge memory).
    observer.pushChanged([{ id: 'a', price: 131, region: 'EU', status: 'open' }])
    expect(events).toHaveLength(1)
  })

  it('does not evaluate rows that were never pushed', () => {
    const { observer, events } = harness([dataChangeRule])
    observer.seed(seedRows([{ price: 90 }, { price: 95 }])) // both below
    // Only 'b' is pushed, crossing the line; 'a' is untouched.
    observer.pushChanged([{ id: 'b', price: 150, region: 'US', status: 'open' }])
    expect(events).toHaveLength(1)
    expect(events[0]!.rowId).toBe('b')
  })

  it('relativeChange push sees prev via the maintained snapshot', () => {
    const { observer, events } = harness([relativeRule])
    const start = seedRows()
    observer.seed(start)
    // 'a' 120 -> 140 is +16% -> fires.
    observer.pushChanged([{ id: 'a', price: 140, region: 'EU', status: 'open' }])
    expect(events).toHaveLength(1)
    expect(events[0]!.columnId).toBe('price')
  })
})

describe('createAlertObserver scales O(changed), not O(total)', () => {
  it('a push over a 100k seed touches only the changed rows', () => {
    // Seed 100k rows, then push a handful. The evaluation must not re-scan the
    // whole set - we assert by counting getRowId calls after the seed.
    let calls = 0
    const countingId = (r: Row) => {
      calls++
      return r.id
    }
    const engine = createAlertEngine<Row>({ rules: [dataChangeRule], getRowId: countingId, now: () => 1000 })
    const events: AlertEvent[] = []
    const observer = createAlertObserver<Row>({
      engine,
      getRowId: countingId,
      schedule: 'sync',
      onEvents: (b) => events.push(...b),
    })

    const big: Row[] = Array.from({ length: 100_000 }, (_, i) => ({
      id: `r${i}`,
      price: 10, // all below the >100 threshold
      region: 'EU',
      status: 'open',
    }))
    observer.seed(big)
    calls = 0 // ignore the one-time seed cost; measure only the push

    observer.pushChanged([{ id: 'r5', price: 130, region: 'EU', status: 'open' }])
    expect(events).toHaveLength(1)
    expect(events[0]!.rowId).toBe('r5')
    // O(changed): a single changed row costs a bounded handful of id lookups,
    // nowhere near the 100k total.
    expect(calls).toBeLessThan(50)
  })
})

describe('createAlertObserver scan (watch) mode', () => {
  it('index-diffs the array and evaluates only changed rows', () => {
    const { observer, events } = harness([dataChangeRule])
    let data: Row[] = seedRows([{ price: 90 }]) // 'a' below
    observer.scan(() => data) // first scan seeds silently
    expect(events).toHaveLength(0)
    // Immutable replace of 'a' only (Svelte-5 style).
    data = [{ ...data[0]!, price: 130 }, data[1]!]
    observer.scan(() => data)
    expect(events).toHaveLength(1)
    expect(events[0]!.rowId).toBe('a')
  })
})

describe('createScheduler', () => {
  it('sync mode runs immediately', () => {
    const s = createAlertScheduler('sync')
    const fn = vi.fn()
    s.schedule(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(s.pending).toBe(false)
  })

  it('coalesces multiple schedules and flush runs the latest once', () => {
    const s = createAlertScheduler('raf') // no rAF in node -> setTimeout fallback, but flush is sync
    const a = vi.fn()
    const b = vi.fn()
    s.schedule(a)
    s.schedule(b)
    expect(s.pending).toBe(true)
    s.flush()
    // Latest wins - only the most recent callback runs, exactly once.
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
    expect(s.pending).toBe(false)
  })

  it('cancel drops the pending callback', () => {
    const s = createAlertScheduler('raf')
    const fn = vi.fn()
    s.schedule(fn)
    s.cancel()
    s.flush()
    expect(fn).not.toHaveBeenCalled()
  })
})
