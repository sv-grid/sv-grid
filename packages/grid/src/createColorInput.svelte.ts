/**
 * createColorInput - the HEADLESS core behind <SvColorInput>: a runes-based
 * state machine that owns hex normalization, the palette, the draft hex field
 * and the open/close popover state, exposed as **prop-getters** you spread onto
 * YOUR OWN markup. DOM measurement / portalling stays in the renderer, NOT here.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createColorInput } from '@svgrid/grid'
 *   let value = $state('#3b82f6')
 *   const col = createColorInput({ value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <button {...col.swatchProps()}>{col.normalized}</button>
 * {#if col.popover.open}<div>...palette...</div>{/if}
 * ```
 *
 * The styled <SvColorInput> is just one renderer over this core (it adds the
 * portal + anchored positioning).
 */
import { editorAria, type EditorAriaState } from './editor-contract'

export const DEFAULT_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#64748b', '#0f172a', '#ffffff',
]

/** Normalize a hex string (#abc / #aabbcc / abc) to lower-case #aabbcc (pure). */
export function normalizeHex(h: string): string | null {
  let s = h.trim()
  if (!s.startsWith('#')) s = '#' + s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('')
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null
}

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type ColorInputConfig = {
  value: () => string
  onChange?: (hex: string) => void
  disabled?: () => boolean
  readonly?: () => boolean
  palette?: () => string[]
  // Editor contract (ARIA + validation) - folded into swatchProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
  ariaLabel?: () => string | undefined
}

export function createColorInput(config: ColorInputConfig) {
  const disabled = () => config.disabled?.() ?? false
  const readonly = () => config.readonly?.() ?? false
  const isInteractive = $derived(!disabled() && !readonly())

  let open = $state(false)
  let hexDraft = $state('')

  const normalized = $derived(normalizeHex(config.value()) ?? '#000000')

  function openPanel() {
    if (!isInteractive || open) return
    hexDraft = normalized
    open = true
  }
  function close() { open = false }
  function toggle() { open ? (open = false) : openPanel() }

  function pick(hex: string) {
    const n = normalizeHex(hex)
    if (n) config.onChange?.(n)
  }
  function commitHex() {
    const n = normalizeHex(hexDraft)
    if (n) config.onChange?.(n)
    else hexDraft = normalized
  }
  const isActive = (c: string) => normalizeHex(c) === normalized

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  // Popover control surface (open state + show/close/toggle), no DOM measurement.
  const popover = {
    get open() { return open },
    show: openPanel,
    close,
    toggle,
  }

  return {
    /** The normalized current color (#aabbcc). */
    get normalized() { return normalized },
    /** Preset swatches. */
    get palette() { return config.palette?.() ?? DEFAULT_PALETTE },
    /** Draft hex text for the panel field (settable for `bind:value`). */
    get hexDraft() { return hexDraft },
    set hexDraft(v: string) { hexDraft = v },
    /** Whether interaction is allowed. */
    get isInteractive() { return isInteractive },
    /** Popover open state + open/close/toggle controls. */
    popover,
    pick,
    commitHex,
    isActive,
    /** Spread onto the swatch trigger button. */
    swatchProps: () => ({
      id: config.id?.(),
      type: 'button' as const,
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': open,
      // aria-invalid/required/describedby come from the editor contract; the
      // aria-label default names the swatch by its current color when unset.
      ...editorAria(ariaState()),
      'aria-label': config.ariaLabel?.() ?? `Color ${normalized}`,
      disabled: !isInteractive,
      onclick: toggle,
    }),
    /** Spread onto a palette chip button for color `c`. */
    chipProps: (c: string) => ({
      type: 'button' as const,
      'aria-label': c,
      onclick: () => { pick(c); open = false },
    }),
  }
}

export type ColorInputCore = ReturnType<typeof createColorInput>
