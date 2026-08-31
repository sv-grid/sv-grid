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
import type { Snippet } from 'svelte'
import { announce } from './a11y/live-region'

/** A toast's severity, which selects its colour and icon. */
export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

/** A button rendered inside a toast (a primary `action` or a secondary `cancel`). */
export type ToastAction = {
  label: string
  /** Invoked with the toast id when pressed. */
  onClick?: (id: number) => void
  /** Keep the toast open after the click (default: dismiss it). */
  keepOpen?: boolean
}

/** Options for one toast: its variant, how long it stays, and any action button. */
export type ToastOptions = {
  variant?: ToastVariant
  /** Auto-dismiss after N ms. `0` = sticky (dismiss manually). Default 4000. */
  duration?: number
  /** Show the dismiss (x) button. Default true. */
  dismissible?: boolean
  /** Optional bold title above the message. */
  title?: string
  /** Primary action button. */
  action?: ToastAction
  /** Secondary (cancel) action button. */
  cancel?: ToastAction
  /** Render a fully custom toast body instead of the icon + title + message. */
  render?: Snippet<[Toast]>
}

/** A live toast: its options plus the id needed to dismiss it. */
export type Toast = {
  id: number
  message: string
  variant: ToastVariant
  duration: number
  dismissible: boolean
  title?: string
  action?: ToastAction
  cancel?: ToastAction
  render?: Snippet<[Toast]>
}

/** Patch applied by `toast.update(id, patch)`; every field is optional. */
export type UpdateToast = Partial<Omit<Toast, 'id'>>

/** Messages for `toast.promise`; success/error may derive from the value/error. */
export type PromiseMessages<T> = {
  loading: string
  success: string | ((value: T) => string)
  error: string | ((error: unknown) => string)
}

type VariantOptions = Omit<ToastOptions, 'variant'>

/** The callable toast API - `toast(msg)` plus `.success` / `.error` / friends. */
export type ToastFn = {
  (message: string, options?: ToastOptions): number
  info: (message: string, options?: VariantOptions) => number
  success: (message: string, options?: VariantOptions) => number
  warning: (message: string, options?: VariantOptions) => number
  error: (message: string, options?: VariantOptions) => number
  /**
   * Show a sticky loading toast, then update it IN PLACE to success/error when
   * the promise settles. Returns the original promise so callers can await it.
   */
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>, options?: ToastOptions) => Promise<T>
  /** Patch an existing toast (message/variant/title/action/duration/render). */
  update: (id: number, patch: UpdateToast) => void
  /** Push a toast with a fully custom body snippet. Returns its id. */
  custom: (render: Snippet<[Toast]>, options?: ToastOptions) => number
  /** Dismiss a toast by id. */
  dismiss: (id: number) => void
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
      action: options.action,
      cancel: options.cancel,
      render: options.render,
    }
    toasts.push(entry)
    // Errors/warnings interrupt (assertive); info/success are polite.
    announce(entry.title ? `${entry.title}: ${message}` : message, {
      assertive: variant === 'error' || variant === 'warning',
    })
    if (duration > 0) schedule(id, duration)
    return id
  }

  /** Patch an existing toast in place (used by `promise`, and callable directly). */
  function update(id: number, patch: UpdateToast): void {
    const t = toasts.find((x) => x.id === id)
    if (!t) return
    if (patch.message != null) t.message = patch.message
    if (patch.title !== undefined) t.title = patch.title
    if (patch.variant) t.variant = patch.variant
    if (patch.dismissible !== undefined) t.dismissible = patch.dismissible
    if (patch.action !== undefined) t.action = patch.action
    if (patch.cancel !== undefined) t.cancel = patch.cancel
    if (patch.render !== undefined) t.render = patch.render
    // A new duration restarts the auto-dismiss timer (0 = make it sticky again).
    if (patch.duration !== undefined) {
      const timer = timers.get(id)
      if (timer) { clearTimeout(timer); timers.delete(id) }
      meta.delete(id)
      t.duration = patch.duration
      if (patch.duration > 0) schedule(id, patch.duration)
    }
    announce(t.title ? `${t.title}: ${t.message}` : t.message, {
      assertive: t.variant === 'error' || t.variant === 'warning',
    })
  }

  function promise<T>(p: Promise<T>, messages: PromiseMessages<T>, options: ToastOptions = {}): Promise<T> {
    const id = push(messages.loading, {
      ...options,
      variant: 'info',
      duration: 0,
      dismissible: options.dismissible ?? false,
    })
    p.then(
      (value) => update(id, {
        message: typeof messages.success === 'function' ? messages.success(value) : messages.success,
        variant: 'success',
        duration: options.duration ?? 4000,
        dismissible: true,
      }),
      (error) => update(id, {
        message: typeof messages.error === 'function' ? messages.error(error) : messages.error,
        variant: 'error',
        duration: options.duration ?? 6000,
        dismissible: true,
      }),
    )
    return p
  }

  const toast = push as ToastFn
  toast.info = (m, o = {}) => push(m, { ...o, variant: 'info' })
  toast.success = (m, o = {}) => push(m, { ...o, variant: 'success' })
  toast.warning = (m, o = {}) => push(m, { ...o, variant: 'warning' })
  toast.error = (m, o = {}) => push(m, { ...o, variant: 'error' })
  toast.promise = promise
  toast.update = update
  toast.custom = (render, o = {}) => push('', { ...o, render })
  toast.dismiss = dismiss

  return {
    get toasts() {
      return toasts
    },
    toast,
    update,
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
/** Patch an existing toast in place (message/variant/title/action/duration/render). */
export const updateToast = (id: number, patch: UpdateToast): void => store.update(id, patch)
/** Remove every toast (and cancel their timers). */
export const clearToasts = (): void => store.clear()
/** Pause a toast's auto-dismiss countdown (e.g. while hovered). */
export const pauseToast = (id: number): void => store.pause(id)
/** Resume a paused toast's countdown with the time it had left. */
export const resumeToast = (id: number): void => store.resume(id)
