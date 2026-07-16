/**
 * createMaskedInput - the HEADLESS core behind <SvMaskedInput>: a runes-based
 * state machine that owns the pattern-mask formatting (#=digit, A=letter,
 * *=alnum; other chars are literals) via the pure `./datetime/mask` engine,
 * exposed as **prop-getters** you spread onto YOUR OWN markup. No styles, no DOM.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createMaskedInput } from '@svgrid/grid'
 *   let value = $state('')
 *   const mi = createMaskedInput({ value: () => value, mask: () => '(###) ###-####', onChange: (m) => (value = m) })
 * </script>
 * <input {...mi.inputProps()} />
 * ```
 *
 * The styled <SvMaskedInput> is just one renderer over this core.
 */
import { applyMask, unmask, isMaskComplete } from './datetime/mask'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type MaskedInputConfig = {
  value: () => string
  /** Called with (masked, raw, complete). */
  onChange?: (masked: string, raw: string, complete: boolean) => void
  mask?: () => string
  placeholder?: () => string | undefined
  disabled?: () => boolean
  readonly?: () => boolean
  ariaLabel?: () => string | undefined
}

export function createMaskedInput(config: MaskedInputConfig) {
  const mask = () => config.mask?.() ?? ''
  const disabled = () => config.disabled?.() ?? false
  const readonly = () => config.readonly?.() ?? false

  let text = $state('')
  let lastRaw = ''

  // Reflect controlled `value` into the masked display text.
  $effect(() => {
    const m = mask()
    const raw = m ? unmask(config.value(), m) : config.value()
    if (raw !== lastRaw) {
      lastRaw = raw
      text = m ? applyMask(raw, m).formatted : config.value()
    }
  })

  function onInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement
    const m = mask()
    const raw = m ? unmask(el.value, m) : el.value
    const masked = m ? applyMask(raw, m).formatted : el.value
    lastRaw = raw
    text = masked
    el.value = masked
    config.onChange?.(masked, raw, m ? isMaskComplete(masked, m) : true)
  }

  return {
    /** The current masked display text. */
    get masked() { return text },
    /** The raw (unmasked) data characters. */
    get raw() { return mask() ? unmask(text, mask()) : text },
    /** Whether every token position in the mask is filled. */
    get complete() { return mask() ? isMaskComplete(text, mask()) : true },
    /** Spread onto the text input element. */
    inputProps: () => ({
      value: text,
      type: 'text' as const,
      placeholder: config.placeholder?.() ?? mask(),
      disabled: disabled(),
      readonly: readonly(),
      'aria-label': config.ariaLabel?.(),
      oninput: onInput,
    }),
  }
}

export type MaskedInputCore = ReturnType<typeof createMaskedInput>
