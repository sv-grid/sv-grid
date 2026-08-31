# `@svgrid/grid` · `toast-store.svelte.ts`

Auto-generated. Source: `packages\grid\src\toast-store.svelte.ts`.

### `type ToastVariant`

A toast's severity, which selects its colour and icon. */

```ts
export type ToastVariant = 'info' | 'success' | 'warning' | 'error'
```

### `type ToastAction`

A button rendered inside a toast (a primary `action` or a secondary `cancel`). */

```ts
export type ToastAction = {
  label: string
  /** Invoked with the toast id when pressed. */
  onClick?: (id: number) => void
  /** Keep the toast open after the click (default: dismiss it). */
  keepOpen?: boolean
}
```

### `type ToastOptions`

Options for one toast: its variant, how long it stays, and any action button. */

```ts
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
```

### `type Toast`

A live toast: its options plus the id needed to dismiss it. */

```ts
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
```

### `type UpdateToast`

Patch applied by `toast.update(id, patch)`; every field is optional. */

```ts
export type UpdateToast = Partial<Omit<Toast, 'id'>>
```

### `type PromiseMessages`

Messages for `toast.promise`; success/error may derive from the value/error. */

```ts
export type PromiseMessages<T> = {
  loading: string
  success: string | ((value: T) => string)
  error: string | ((error: unknown) => string)
}
```

### `type ToastFn`

The callable toast API - `toast(msg)` plus `.success` / `.error` / friends. */

```ts
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
```

### `const toastStore`

Live reactive list of active toasts (read inside a component/effect). */

```ts
export const toastStore = { get toasts() { return store.toasts } }
```

### `const toast`

Show a toast. Returns its id. Has `.info/.success/.warning/.error` helpers. */

```ts
export const toast: ToastFn = store.toast
```

### `const dismissToast`

Dismiss a toast by id. */

```ts
export const dismissToast = (id: number): void => store.dismiss(id)
```

### `const updateToast`

Patch an existing toast in place (message/variant/title/action/duration/render). */

```ts
export const updateToast = (id: number, patch: UpdateToast): void => store.update(id, patch)
```

### `const clearToasts`

Remove every toast (and cancel their timers). */

```ts
export const clearToasts = (): void => store.clear()
```

### `const pauseToast`

Pause a toast's auto-dismiss countdown (e.g. while hovered). */

```ts
export const pauseToast = (id: number): void => store.pause(id)
```

### `const resumeToast`

Resume a paused toast's countdown with the time it had left. */

```ts
export const resumeToast = (id: number): void => store.resume(id)
```
