import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  registerGridShortcuts,
  runGridShortcuts,
  hasGridShortcuts,
  clearGridShortcuts,
  type GridCommandContext,
} from './shortcut-registry'

// The context is a structural type over controller state; nothing in the
// registry reads it, so a cast of an empty object is enough here. The real
// shape is covered by command-context.test.ts.
const cmd = {} as GridCommandContext
const key = (init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', init)

beforeEach(() => clearGridShortcuts())

describe('shortcut registry', () => {
  it('reports nothing registered on a fresh grid', () => {
    expect(hasGridShortcuts()).toBe(false)
    expect(runGridShortcuts(key(), cmd)).toBe(false)
  })

  it('runs a registered handler and reports the claim', () => {
    const handler = vi.fn(() => true)
    registerGridShortcuts(handler)
    expect(hasGridShortcuts()).toBe(true)
    expect(runGridShortcuts(key({ key: 'd' }), cmd)).toBe(true)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('falls through when the handler declines', () => {
    registerGridShortcuts(() => false)
    expect(runGridShortcuts(key(), cmd)).toBe(false)
  })

  it('stops at the first handler that claims', () => {
    const order: string[] = []
    registerGridShortcuts(() => { order.push('a'); return true })
    registerGridShortcuts(() => { order.push('b'); return true })
    runGridShortcuts(key(), cmd)
    expect(order).toEqual(['a'])
  })

  it('runs higher priority first regardless of registration order', () => {
    const order: string[] = []
    registerGridShortcuts(() => { order.push('low'); return false }, { priority: 1 })
    registerGridShortcuts(() => { order.push('high'); return false }, { priority: 50 })
    runGridShortcuts(key(), cmd)
    expect(order).toEqual(['high', 'low'])
  })

  it('keeps registration order for equal priorities', () => {
    const order: string[] = []
    registerGridShortcuts(() => { order.push('first'); return false })
    registerGridShortcuts(() => { order.push('second'); return false })
    runGridShortcuts(key(), cmd)
    expect(order).toEqual(['first', 'second'])
  })

  it('replaces rather than stacks when the same id registers twice', () => {
    const first = vi.fn(() => false)
    const second = vi.fn(() => false)
    registerGridShortcuts(first, { id: 'sheet' })
    registerGridShortcuts(second, { id: 'sheet' })
    runGridShortcuts(key(), cmd)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('unregisters through the returned disposer', () => {
    const handler = vi.fn(() => true)
    const off = registerGridShortcuts(handler)
    off()
    expect(hasGridShortcuts()).toBe(false)
    expect(runGridShortcuts(key(), cmd)).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('leaves siblings alone when one disposer runs', () => {
    const kept = vi.fn(() => false)
    const off = registerGridShortcuts(() => false, { id: 'gone' })
    registerGridShortcuts(kept, { id: 'kept' })
    off()
    runGridShortcuts(key(), cmd)
    expect(hasGridShortcuts()).toBe(true)
    expect(kept).toHaveBeenCalledOnce()
  })

  it('hands the handler the event and the context it was called with', () => {
    const handler = vi.fn(() => true)
    registerGridShortcuts(handler)
    const event = key({ key: 'ArrowDown', ctrlKey: true })
    runGridShortcuts(event, cmd)
    expect(handler).toHaveBeenCalledWith(event, cmd)
  })
})
