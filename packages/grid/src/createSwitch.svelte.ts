/**
 * createSwitch - the HEADLESS core behind <SvSwitchButton>: a controlled on/off
 * switch (ARIA `switch`) with full keyboard (Space/Enter toggle, ArrowRight on,
 * ArrowLeft off), exposed as **prop-getters** you spread onto YOUR OWN markup.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createSwitch } from '@svgrid/grid'
 *   let on = $state(false)
 *   const sw = createSwitch({ checked: () => on, onChange: (v) => (on = v) })
 * </script>
 * <button {...sw.switchProps()}><span class="thumb"></span></button>
 * ```
 *
 * The styled <SvSwitchButton> is just one renderer over this core.
 */
export type SwitchConfig = {
  checked: () => boolean
  onChange?: (checked: boolean) => void
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
}

export type SwitchProps = {
  type: 'button'
  role: 'switch'
  'aria-checked': boolean
  'aria-label': string | undefined
  disabled: boolean
  'data-checked': '' | undefined
  onclick: () => void
  onkeydown: (e: KeyboardEvent) => void
}

export type Switch = {
  /** Current on/off state. */
  readonly checked: boolean
  readonly disabled: boolean
  /** Flip on/off (no-op when disabled). */
  toggle: () => void
  onKeydown: (e: KeyboardEvent) => void
  /** Spread onto the switch element. */
  switchProps: () => SwitchProps
}

export function createSwitch(config: SwitchConfig): Switch {
  const checked = () => config.checked()
  const disabled = () => config.disabled?.() ?? false

  function toggle() {
    if (disabled()) return
    config.onChange?.(!checked())
  }

  function onKeydown(e: KeyboardEvent) {
    if (disabled()) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
    else if (e.key === 'ArrowRight') { if (!checked()) config.onChange?.(true) }
    else if (e.key === 'ArrowLeft') { if (checked()) config.onChange?.(false) }
  }

  return {
    get checked() { return checked() },
    get disabled() { return disabled() },
    toggle,
    onKeydown,
    switchProps: () => ({
      type: 'button',
      role: 'switch',
      'aria-checked': checked(),
      'aria-label': config.ariaLabel?.(),
      disabled: disabled(),
      'data-checked': checked() ? '' : undefined,
      onclick: toggle,
      onkeydown: onKeydown,
    }),
  }
}
