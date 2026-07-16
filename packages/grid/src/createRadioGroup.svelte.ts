/**
 * createRadioGroup - the HEADLESS core behind <SvRadioGroup>: an accessible
 * single-select radio group (WAI-ARIA `radiogroup`) with roving tabindex + full
 * arrow-key navigation, exposed as **prop-getters** you spread onto YOUR OWN
 * markup. Keyboard/ARIA/roving-focus come from the core, the DOM is yours.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createRadioGroup, type RadioOption } from '@svgrid/grid'
 *   let value = $state<string | number | null>('a')
 *   const rg = createRadioGroup({ options: () => options, value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <div {...rg.groupProps()}>
 *   {#each options as opt (opt.value)}
 *     <button {...rg.radioProps(opt)}>{opt.label}</button>
 *   {/each}
 * </div>
 * ```
 *
 * The styled <SvRadioGroup> is just one renderer over this core.
 */
export type RadioOption = { value: string | number; label: string; disabled?: boolean }

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type RadioGroupConfig = {
  options: () => ReadonlyArray<RadioOption>
  value: () => string | number | null
  onChange?: (value: string | number) => void
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
}

export type RadioProps = {
  type: 'button'
  role: 'radio'
  'aria-checked': boolean
  'data-idx': number
  'data-checked': '' | undefined
  disabled: boolean
  tabindex: number
  onclick: () => void
}

export type RadioGroupProps = {
  role: 'radiogroup'
  'aria-label': string | undefined
  'aria-disabled': boolean
  onkeydown: (e: KeyboardEvent) => void
}

export type RadioGroup = {
  /** Currently selected value. */
  readonly value: string | number | null
  readonly disabled: boolean
  isChecked: (option: RadioOption) => boolean
  /** Select by value (no-op when disabled / option disabled / unknown). */
  select: (value: string | number) => void
  onKeydown: (e: KeyboardEvent) => void
  /** Spread onto the group container element. */
  groupProps: () => RadioGroupProps
  /** Spread onto each option element. */
  radioProps: (option: RadioOption) => RadioProps
}

export function createRadioGroup(config: RadioGroupConfig): RadioGroup {
  const opts = () => config.options()
  const disabled = () => config.disabled?.() ?? false

  const enabledIdx = $derived(opts().map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0))
  const selectedIdx = $derived(opts().findIndex((o) => o.value === config.value()))
  // Roving-tabindex target: the selected option, else the first enabled one.
  const focusIdx = $derived(selectedIdx >= 0 ? selectedIdx : enabledIdx[0] ?? -1)

  function pickIndex(i: number) {
    const o = opts()[i]
    if (!o || o.disabled || disabled()) return
    config.onChange?.(o.value)
  }

  function select(value: string | number) {
    pickIndex(opts().findIndex((o) => o.value === value))
  }

  // Arrow handling lives on the group container so it works for ANY markup:
  // the originating radio is found by role + data-idx, so nothing is assumed
  // about how you nest your elements.
  function onKeydown(e: KeyboardEvent) {
    if (disabled()) return
    const container = e.currentTarget as HTMLElement
    const origin = (e.target as HTMLElement | null)?.closest<HTMLElement>('[role="radio"]')
    const i = origin ? Number(origin.getAttribute('data-idx')) : focusIdx
    const pos = enabledIdx.indexOf(i)
    if (pos < 0) return
    if (e.key === ' ') { e.preventDefault(); pickIndex(i); return }
    let nextPos = pos
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextPos = (pos + 1) % enabledIdx.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nextPos = (pos - 1 + enabledIdx.length) % enabledIdx.length
    else return
    e.preventDefault()
    const target = enabledIdx[nextPos]!
    pickIndex(target)
    container.querySelectorAll<HTMLElement>('[role="radio"]')[target]?.focus()
  }

  return {
    get value() { return config.value() },
    get disabled() { return disabled() },
    isChecked: (option: RadioOption) => option.value === config.value(),
    select,
    onKeydown,
    groupProps: () => ({
      role: 'radiogroup',
      'aria-label': config.ariaLabel?.(),
      'aria-disabled': disabled(),
      onkeydown: onKeydown,
    }),
    radioProps: (option: RadioOption) => {
      const i = opts().findIndex((o) => o.value === option.value)
      const checked = option.value === config.value()
      return {
        type: 'button',
        role: 'radio',
        'aria-checked': checked,
        'data-idx': i,
        'data-checked': checked ? '' : undefined,
        disabled: disabled() || !!option.disabled,
        tabindex: i === focusIdx ? 0 : -1,
        onclick: () => pickIndex(i),
      }
    },
  }
}
