/**
 * Tests for the headless toast store: queueing, variants, auto-dismiss timers,
 * manual dismiss, sticky toasts, and the SR announcement side effect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast, dismissToast, updateToast, clearToasts, pauseToast, resumeToast, toastStore } from './toast-store.svelte'

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

  it('update patches a toast in place (same id) and restarts its timer', () => {
    const id = toast('working', { duration: 0 })
    updateToast(id, { message: 'done', variant: 'success', duration: 3000 })
    expect(toastStore.toasts).toHaveLength(1)
    const t = toastStore.toasts[0]!
    expect(t.id).toBe(id)
    expect(t.message).toBe('done')
    expect(t.variant).toBe('success')
    // The new duration now applies.
    vi.advanceTimersByTime(3000)
    expect(toastStore.toasts).toHaveLength(0)
  })

  it('update is a no-op for an unknown id', () => {
    updateToast(999, { message: 'nope' })
    expect(toastStore.toasts).toHaveLength(0)
  })

  it('promise shows a sticky loader, then updates in place to success', async () => {
    vi.useRealTimers() // real microtask flush for the promise
    let resolve!: (v: string) => void
    const p = new Promise<string>((r) => (resolve = r))
    const ret = toast.promise(p, { loading: 'Saving...', success: (v) => `Saved ${v}`, error: 'Failed' })
    expect(ret).toBe(p) // returns the original promise
    expect(toastStore.toasts).toHaveLength(1)
    const id = toastStore.toasts[0]!.id
    expect(toastStore.toasts[0]!.message).toBe('Saving...')
    expect(toastStore.toasts[0]!.variant).toBe('info')
    resolve('now')
    await p
    await Promise.resolve()
    const t = toastStore.toasts.find((x) => x.id === id)!
    expect(t.message).toBe('Saved now')
    expect(t.variant).toBe('success')
  })

  it('promise updates in place to error on rejection', async () => {
    vi.useRealTimers()
    const p = Promise.reject(new Error('x'))
    toast.promise(p, { loading: 'Load', success: 'ok', error: (e) => `Err: ${(e as Error).message}` })
    await p.catch(() => {})
    await Promise.resolve()
    const t = toastStore.toasts[0]!
    expect(t.variant).toBe('error')
    expect(t.message).toBe('Err: x')
  })

  it('action + cancel are stored on the toast', () => {
    const onClick = vi.fn()
    toast('Undo?', { action: { label: 'Undo', onClick }, cancel: { label: 'Dismiss' } })
    const t = toastStore.toasts[0]!
    expect(t.action?.label).toBe('Undo')
    expect(t.cancel?.label).toBe('Dismiss')
  })

  it('custom carries a render snippet', () => {
    const render = (() => {}) as never
    const id = toast.custom(render, { duration: 0 })
    expect(toastStore.toasts.find((x) => x.id === id)!.render).toBe(render)
  })
})
