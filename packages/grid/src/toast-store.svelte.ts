/**
 * toast-store - the headless model behind <SvToaster>: a singleton reactive
 * queue of transient notifications with auto-dismiss timers, plus the `toast()`
 * API you call from anywhere. Every toast is also pushed to the shared ARIA
 * live region via `announce()`, so screen-reader users hear it even though the
 * visual toast is off to the side.
 *
 * ```ts
 * import { toast } from '@svgrid/grid'
 * toast.success('Saved')
 * toast.error('Could not save', { duration: 0 }) // sticky
 * ```
 *
 * Mount a single <SvToaster /> once near the app root to render the queue.
 */
import { announce } from './a11y/live-region'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export type ToastOptions = {
  variant?: ToastVariant
  /** Auto-dismiss after N ms. `0` = sticky (dismiss manually). Default 4000. */
  duration?: number
  /** Show the dismiss (x) button. Default true. */
  dismissible?: boolean
  /** Optional bold title above the message. */
  title?: string
}

export type Toast = {
  id: number
  message: string
  variant: ToastVariant
  duration: number
  dismissible: boolean
  title?: string
}

type VariantOptions = Omit<ToastOptions, 'variant'>

export type ToastFn = {
  (message: string, options?: ToastOptions): number
  info: (message: string, options?: VariantOptions) => number
  success: (message: string, options?: VariantOptions) => number
  warning: (message: string, options?: VariantOptions) => number
  error: (message: string, options?: VariantOptions) => number
}

function createToastStore() {
  const toasts = $state<Toast[]>([])
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  // Remaining ms + when the current run started, so hovering can pause/resume
  // the auto-dismiss countdown instead of losing it.
  const meta = new Map<number, { remaining: number; startedAt: number }>()
  let seq = 0

  function schedule(id: number, ms: number) {
    meta.set(id, { remaining: ms, startedAt: Date.now() })
    timers.set(id, setTimeout(() => dismiss(id), ms))
  }
  /** Pause a toast's auto-dismiss (e.g. on hover), banking the time left. */
  function pause(id: number): void {
    const timer = timers.get(id)
    const m = meta.get(id)
    if (!timer || !m) return
    clearTimeout(timer)
    timers.delete(id)
    m.remaining = Math.max(0, m.remaining - (Date.now() - m.startedAt))
  }
  /** Resume a paused toast with the banked time remaining. */
  function resume(id: number): void {
    const m = meta.get(id)
    if (!m || timers.has(id) || m.remaining <= 0) return
    m.startedAt = Date.now()
    timers.set(id, setTimeout(() => dismiss(id), m.remaining))
  }

  function dismiss(id: number): void {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    meta.delete(id)
  }

  function clear(): void {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    meta.clear()
    toasts.splice(0, toasts.length)
  }

  function push(message: string, options: ToastOptions = {}): number {
    const id = ++seq
    const variant = options.variant ?? 'info'
    const duration = options.duration ?? 4000
    const entry: Toast = {
      id,
      message,
      variant,
      duration,
      dismissible: options.dismissible ?? true,
      title: options.title,
    }
    toasts.push(entry)
    // Errors/warnings interrupt (assertive); info/success are polite.
    announce(entry.title ? `${entry.title}: ${message}` : message, {
      assertive: variant === 'error' || variant === 'warning',
    })
    if (duration > 0) schedule(id, duration)
    return id
  }

  const toast = push as ToastFn
  toast.info = (m, o = {}) => push(m, { ...o, variant: 'info' })
  toast.success = (m, o = {}) => push(m, { ...o, variant: 'success' })
  toast.warning = (m, o = {}) => push(m, { ...o, variant: 'warning' })
  toast.error = (m, o = {}) => push(m, { ...o, variant: 'error' })

  return {
    get toasts() {
      return toasts
    },
    toast,
    dismiss,
    clear,
    pause,
    resume,
  }
}

const store = createToastStore()

/** Live reactive list of active toasts (read inside a component/effect). */
export const toastStore = { get toasts() { return store.toasts } }
/** Show a toast. Returns its id. Has `.info/.success/.warning/.error` helpers. */
export const toast: ToastFn = store.toast
/** Dismiss a toast by id. */
export const dismissToast = (id: number): void => store.dismiss(id)
/** Remove every toast (and cancel their timers). */
export const clearToasts = (): void => store.clear()
/** Pause a toast's auto-dismiss countdown (e.g. while hovered). */
export const pauseToast = (id: number): void => store.pause(id)
/** Resume a paused toast's countdown with the time it had left. */
export const resumeToast = (id: number): void => store.resume(id)
