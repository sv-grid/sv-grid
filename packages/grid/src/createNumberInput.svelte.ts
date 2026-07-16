/**
 * createNumberInput - the HEADLESS core behind <SvNumberInput>, in the same
 * spirit as `createListbox` / `createSvGrid`: a runes-based state machine that
 * owns parse / format / clamp / spinner state + keyboard, exposed as
 * **prop-getters** you spread onto YOUR OWN markup. No styles, no DOM.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createNumberInput } from '@svgrid/grid'
 *   let value = $state<number | null>(0)
 *   const num = createNumberInput({ value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <input {...num.inputProps()} />
 * <button {...num.incrementProps()}>+</button>
 * <button {...num.decrementProps()}>-</button>
 * ```
 *
 * The styled <SvNumberInput> is just one renderer over this core.
 */
import { editorAria, type EditorAriaState } from './editor-contract'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type NumberInputConfig = {
  value: () => number | null
  onChange?: (value: number | null) => void
  min?: () => number
  max?: () => number
  step?: () => number
  precision?: () => number | undefined
  /** Group thousands (1,234) on display. */
  grouping?: () => boolean
  prefix?: () => string
  suffix?: () => string
  placeholder?: () => string | undefined
  disabled?: () => boolean
  readonly?: () => boolean
  // Editor contract (ARIA + validation) - folded into inputProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  ariaLabel?: () => string | undefined
}

export function createNumberInput(config: NumberInputConfig) {
  const min = () => config.min?.() ?? -Infinity
  const max = () => config.max?.() ?? Infinity
  const step = () => config.step?.() ?? 1
  const precision = () => config.precision?.()
  const grouping = () => config.grouping?.() ?? false
  const prefix = () => config.prefix?.() ?? ''
  const suffix = () => config.suffix?.() ?? ''
  const disabled = () => config.disabled?.() ?? false
  const readonly = () => config.readonly?.() ?? false

  const isInteractive = $derived(!disabled() && !readonly())
  let text = $state('')
  let focused = $state(false)
  let lastKey = ''

  const fmt = $derived(
    new Intl.NumberFormat(undefined, {
      useGrouping: grouping(),
      minimumFractionDigits: precision() ?? 0,
      maximumFractionDigits: precision() ?? 20,
    }),
  )

  function display(v: number | null): string {
    if (v == null) return ''
    return `${prefix()}${fmt.format(v)}${suffix()}`
  }

  // Reflect controlled `value` into the display text unless the user is editing.
  $effect(() => {
    const v = config.value()
    const key = v == null ? 'null' : String(v)
    if (key !== lastKey) {
      lastKey = key
      if (!focused) text = display(v)
    }
  })

  function clamp(n: number): number {
    let r = Math.min(max(), Math.max(min(), n))
    const p = precision()
    if (p != null) r = Math.round(r * 10 ** p) / 10 ** p
    return r
  }

  function parse(s: string): number | null {
    const cleaned = s.replace(prefix(), '').replace(suffix(), '').replace(/[,\s]/g, '').trim()
    if (cleaned === '' || cleaned === '-') return null
    const n = Number(cleaned)
    return isNaN(n) ? null : n
  }

  function commit() {
    const parsed = parse(text)
    const next = parsed == null ? null : clamp(parsed)
    lastKey = next == null ? 'null' : String(next)
    config.onChange?.(next)
    text = display(next)
  }

  function bump(dir: 1 | -1) {
    if (!isInteractive) return
    const base = parse(text) ?? 0
    const next = clamp(base + dir * step())
    lastKey = String(next)
    config.onChange?.(next)
    text = focused ? String(next) : display(next)
  }
  const increment = () => bump(1)
  const decrement = () => bump(-1)

  function onFocus() {
    focused = true
    // Show the bare number for easy editing.
    const v = config.value()
    text = v == null ? '' : String(v)
  }
  function onBlur() {
    focused = false
    commit()
  }
  function onInput(e: Event) {
    text = (e.currentTarget as HTMLInputElement).value
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') { e.preventDefault(); bump(1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1) }
    else if (e.key === 'Enter') { commit() }
  }

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  return {
    /** The current display text (bind this to your input's value). */
    get text() { return text },
    /** Whether the field is being edited. */
    get focused() { return focused },
    /** Whether interaction is allowed (not disabled and not readonly). */
    get isInteractive() { return isInteractive },
    commit,
    bump,
    increment,
    decrement,
    /** Spread onto the text input element. */
    inputProps: () => ({
      id: config.id?.(),
      value: text,
      type: 'text' as const,
      inputmode: 'decimal' as const,
      role: 'spinbutton' as const,
      placeholder: config.placeholder?.(),
      disabled: disabled(),
      readonly: readonly(),
      'aria-valuenow': config.value() ?? undefined,
      'aria-valuemin': min() === -Infinity ? undefined : min(),
      'aria-valuemax': max() === Infinity ? undefined : max(),
      ...editorAria(ariaState()),
      oninput: onInput,
      onfocus: onFocus,
      onblur: onBlur,
      onkeydown: onKeydown,
    }),
    /** Spread onto a native increment button. */
    incrementProps: () => ({
      type: 'button' as const,
      'aria-label': 'Increment',
      disabled: !isInteractive,
      tabindex: -1,
      onclick: increment,
    }),
    /** Spread onto a native decrement button. */
    decrementProps: () => ({
      type: 'button' as const,
      'aria-label': 'Decrement',
      disabled: !isInteractive,
      tabindex: -1,
      onclick: decrement,
    }),
  }
}

export type NumberInputCore = ReturnType<typeof createNumberInput>
