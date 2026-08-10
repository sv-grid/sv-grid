import { describe, expect, it } from 'vitest'
import { createAlertRules, memoryAlertRules } from './alert-storage'
import type { AlertRule } from './alert-types'

const rule = (id: string, over: Partial<AlertRule> = {}): AlertRule => ({
  id,
  name: `Rule ${id}`,
  enabled: true,
  severity: 'info',
  scope: 'row',
  predicate: { kind: 'const', value: true },
  trigger: { type: 'dataChange' },
  actions: [{ kind: 'toast' }],
  createdAt: 0,
  ...over,
})

describe('createAlertRules CRUD', () => {
  it('saves, replaces, gets, removes and toggles', () => {
    const mgr = createAlertRules(memoryAlertRules())
    mgr.save(rule('a'))
    mgr.save(rule('b'))
    expect(mgr.list().map((r) => r.id)).toEqual(['a', 'b'])

    // Save with an existing id replaces in place.
    mgr.save(rule('a', { name: 'Renamed' }))
    expect(mgr.get('a')?.name).toBe('Renamed')
    expect(mgr.list()).toHaveLength(2)

    expect(mgr.toggle('a')).toBe(false)
    expect(mgr.get('a')?.enabled).toBe(false)

    expect(mgr.rename('b', 'Bee')).toBe(true)
    expect(mgr.get('b')?.name).toBe('Bee')

    expect(mgr.remove('a')).toBe(true)
    expect(mgr.remove('missing')).toBe(false)
    expect(mgr.list().map((r) => r.id)).toEqual(['b'])
  })
})

describe('export / import share', () => {
  it('round-trips a rule set through JSON', () => {
    const src = createAlertRules(memoryAlertRules())
    src.save(rule('a'))
    src.save(rule('b', { severity: 'error' }))
    const json = src.export()

    const dest = createAlertRules(memoryAlertRules())
    const imported = dest.import(json)
    expect(imported).toHaveLength(2)
    expect(dest.get('b')?.severity).toBe('error')
  })
})
