import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './debounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('debounce', () => {
  it('runs once after the quiet period with the latest args', () => {
    const fn = vi.fn()
    const d = debounce(fn, 200)
    d('a'); d('b'); d('c')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(199)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('resets the timer on each call', () => {
    const fn = vi.fn()
    const d = debounce(fn, 200)
    d('x')
    vi.advanceTimersByTime(150)
    d('y') // restarts the 200ms window
    vi.advanceTimersByTime(150)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledExactlyOnceWith('y')
  })

  it('cancel() drops the pending call', () => {
    const fn = vi.fn()
    const d = debounce(fn, 200)
    d('a')
    d.cancel()
    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush() runs the pending call immediately', () => {
    const fn = vi.fn()
    const d = debounce(fn, 200)
    d('a')
    d.flush()
    expect(fn).toHaveBeenCalledExactlyOnceWith('a')
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1) // not called again
  })
})
