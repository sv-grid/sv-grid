/**
 * The shared "editor contract" for the SvGrid UI kit.
 *
 * Every value-bearing editor (inputs, selects, pickers) accepts this common set
 * of props so forms, validation, accessibility, direction (RTL) and localization
 * behave IDENTICALLY across the kit - the same spirit as the grid's headless
 * core, applied to the editors. Components spread their own `value` / options /
 * behavior on top of this base.
 *
 * Framework-free (no Svelte, no DOM) so it can be unit-tested and reused.
 */

export type EditorSize = 'sm' | 'md' | 'lg'

/**
 * A small action button rendered inside a framed field (via `SvField`'s
 * `actions`) - the generalized form of the clear / reveal buttons, for a lookup,
 * a generate, a copy, etc. `icon` is a Svelte snippet; when absent the `label`
 * text is shown. (Type-only Svelte import, so this module stays runtime-free.)
 */
export type EditorAction = {
  /** Accessible name + tooltip for the button. */
  label: string
  /** Invoked when the button is pressed. */
  onClick: () => void
  /** Optional icon snippet; falls back to the `label` text. */
  icon?: import('svelte').Snippet
  disabled?: boolean
}

/** Text direction. `'auto'` defers to the surrounding document/CSS. */
export type EditorDir = 'ltr' | 'rtl' | 'auto'

/** Props shared by every value-bearing editor in the kit. */
export type SvEditorProps = {
  /** Disable interaction + form submission. */
  disabled?: boolean
  /** Read-only: the value is shown but not editable. */
  readonly?: boolean
  /** Required for validation (adds `aria-required` + participates in validity). */
  required?: boolean
  /** Marks the control invalid (`aria-invalid` + error styling). */
  invalid?: boolean
  /**
   * Fill the container instead of the control's own default width. A default
   * width is right for a control sitting on its own; in a form grid a row of
   * inputs each stopping at a different width reads as broken.
   */
  block?: boolean
  /** Error message; when set it is announced via `aria-describedby` and shown. */
  error?: string
  /** Visible field label, rendered above the control and wired via `for`/`id`. */
  label?: string
  /** Helper text shown under the control and announced via `aria-describedby`. */
  hint?: string
  /** Control size / density. */
  size?: EditorSize
  /**
   * Text direction. `'rtl'` mirrors layout for Arabic/Hebrew/etc.; `'auto'` (the
   * default) inherits from the surrounding document so a page-level `dir` wins.
   */
  dir?: EditorDir
  /** Form field name; the editor emits a hidden input carrying its value. */
  name?: string
  /** Root/control element id (the label/hint/error ids derive from it). */
  id?: string
  /** Accessible name when there is no visible `label`. */
  ariaLabel?: string
  /** Busy state - shows a spinner (e.g. while an async value/validation resolves). */
  loading?: boolean
}

/**
 * The interaction surface an editor exposes when embedded as a grid cell editor.
 * Standalone usage ignores these; the grid supplies them so every editor shares
 * one commit / cancel / move contract (Enter commits, Escape cancels, Tab moves)
 * instead of each cell-editor re-implementing key handling.
 *
 * `CellEditorContext` (editor-registry.ts) extends this type, so what the grid
 * hands a registered editor and what this contract promises are the same thing
 * by construction rather than by convention.
 */
export type EditorInteraction<V = unknown> = {
  /**
   * Commit the value and stop editing (Enter, option pick, blur-commit).
   * The argument is optional: an editor that has been reporting through
   * `onChange` can just call `onCommit()` to commit what the grid already has.
   */
  onCommit?: (value?: V) => void
  /** Abandon the edit and restore the previous value (Escape). */
  onCancel?: () => void
  /** Commit, then move to the adjacent cell (Tab = 1, Shift+Tab = -1). */
  onCommitAndMove?: (value: V | undefined, direction: 1 | -1) => void
  /** Ask the surrounding popover/panel to close without committing. */
  onRequestClose?: () => void
  /** True while mounted inside a grid cell (lets an editor tune autofocus etc.). */
  inCell?: boolean
}

/** Stable DOM id for an editor's error text, for `aria-describedby` wiring. */
export const editorErrorId = (id?: string): string | undefined => (id ? `${id}__error` : undefined)

/** Stable DOM id for an editor's hint text, for `aria-describedby` wiring. */
export const editorHintId = (id?: string): string | undefined => (id ? `${id}__hint` : undefined)

let _autoId = 0
/**
 * Generate a stable-per-instance element id. Call ONCE per component instance
 * (e.g. `const uid = provided ?? nextEditorId()`) so label/hint/error wiring
 * always has an anchor even when the consumer passes no `id`.
 */
export const nextEditorId = (prefix = 'sv-ed'): string => `${prefix}-${_autoId++}`

/** A subset of {@link SvEditorProps} that drives ARIA on the focusable control. */
export type EditorAriaState = Pick<
  SvEditorProps,
  'id' | 'invalid' | 'required' | 'error' | 'hint' | 'ariaLabel'
>

/**
 * ARIA attributes for the focusable control of an editor, derived from its state.
 * Spread onto the input/button/combobox:
 * `<input {...editorAria({ id, invalid, required, error, hint, ariaLabel })} />`
 *
 * `aria-describedby` points at the error text (when invalid) and/or the hint
 * text - both ids derive from `id`, so pass a stable `id` (see {@link nextEditorId}).
 * Undefined values are omitted by Svelte, so unset props add no attributes.
 */
export function editorAria(state: EditorAriaState): {
  'aria-invalid': 'true' | undefined
  'aria-required': 'true' | undefined
  'aria-describedby': string | undefined
  'aria-label': string | undefined
} {
  const described = [
    state.error ? editorErrorId(state.id) : undefined,
    state.hint ? editorHintId(state.id) : undefined,
  ].filter(Boolean)
  return {
    'aria-invalid': state.invalid ? 'true' : undefined,
    'aria-required': state.required ? 'true' : undefined,
    'aria-describedby': described.length ? described.join(' ') : undefined,
    'aria-label': state.ariaLabel,
  }
}

/**
 * Merge a component's default message strings with a consumer's `messages`
 * override, so every editor can be fully localized from the outside.
 *
 * ```ts
 * const M = { clear: 'Clear', noResults: 'No results' }
 * const messages = resolveMessages(M, props.messages) // Partial override
 * ```
 *
 * Undefined/empty overrides fall back to the default, so a partial `messages`
 * object only replaces the keys it sets.
 */
export function resolveMessages<T extends Record<string, string>>(
  defaults: T,
  overrides?: Partial<T> | null,
): T {
  if (!overrides) return defaults
  const out = { ...defaults }
  for (const k in overrides) {
    const v = overrides[k]
    if (v != null && v !== '') out[k] = v as T[Extract<keyof T, string>]
  }
  return out
}
