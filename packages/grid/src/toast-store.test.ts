/**
 * Tests for the headless toast store: queueing, variants, auto-dismiss timers,
 * manual dismiss, sticky toasts, and the SR announcement side effect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast, dismissToast, clearToasts, pauseToast, resumeToast, toastStore } from './toast-store.svelte'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  clearToasts()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('toast store', () => {
  it('queues a toast with defaults', () => {
    const id = toast('Hello')
    expect(toastStore.toasts).toHaveLength(1)
    const t = toastStore.toasts[0]!
    expect(t.id).toBe(id)
    expect(t.message).toBe('Hello')
    expect(t.variant).toBe('info')
    expect(t.dismissible).toBe(true)
  })

  it('variant helpers set the variant', () => {
    toast.success('ok')
    toast.error('bad')
    toast.warning('hmm')
    expect(toastStore.toasts.map((t) => t.variant)).toEqual(['success', 'error', 'warning'])
  })

  it('auto-dismisses after its duration', () => {
    toast('bye', { duration: 3000 })
    expect(toastStore.toasts).toHaveLength(1)
    vi.advanceTimersByTime(2999)
    expect(toastStore.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toastStore.toasts).toHaveLength(0)
  })

  it('duration 0 is sticky (no auto-dismiss)', () => {
    toast('stay', { duration: 0 })
    vi.advanceTimersByTime(60_000)
    expect(toastStore.toasts).toHaveLength(1)
  })

  it('dismissToast removes by id and cancels its timer', () => {
    const id = toast('x', { duration: 5000 })
    dismissToast(id)
    expect(toastStore.toasts).toHaveLength(0)
    // Advancing past the original duration must not throw or double-remove.
    vi.advanceTimersByTime(5000)
    expect(toastStore.toasts).toHaveLength(0)
  })

  it('announces via a live region (assertive for errors)', () => {
    toast.error('boom')
    vi.runOnlyPendingTimers()
    // The store routes errors to the assertive live region.
    expect(document.querySelector('[aria-live="assertive"]')).not.toBeNull()
  })

  it('pause banks the remaining time and resume finishes it (hover to keep)', () => {
    const id = toast('hover me', { duration: 3000 })
    vi.advanceTimersByTime(1000) // 2000 left
    pauseToast(id)
    vi.advanceTimersByTime(10_000) // stays while paused
    expect(toastStore.toasts).toHaveLength(1)
    resumeToast(id)
    vi.advanceTimersByTime(1999)
    expect(toastStore.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1) // banked 2000ms elapsed
    expect(toastStore.toasts).toHaveLength(0)
  })

  it('clearToasts empties the queue', () => {
    toast('a'); toast('b'); toast('c')
    expect(toastStore.toasts).toHaveLength(3)
    clearToasts()
    expect(toastStore.toasts).toHaveLength(0)
  })
})
