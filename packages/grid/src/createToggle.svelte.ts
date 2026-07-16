/**
 * createToggle - the HEADLESS core behind <SvToggleButton>, in the same spirit
 * as `createSvGrid`: a tiny controlled state machine (a single pressed on/off
 * bit + ARIA) exposed as **prop-getters** you spread onto YOUR OWN markup. No
 * styles, no DOM assumptions.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createToggle } from '@svgrid/grid'
 *   let pressed = $state(false)
 *   const t = createToggle({ pressed: () => pressed, onChange: (v) => (pressed = v) })
 * </script>
 * <button {...t.buttonProps()}>Bold</button>
 * ```
 *
 * The styled <SvToggleButton> is just one renderer over this core.
 */

/** Reactive inputs are passed as getters so the core tracks live prop changes
 *  (the same controlled pattern used across the SvGrid UI kit). */
export type ToggleConfig = {
  pressed: () => boolean
  onChange?: (pressed: boolean) => void
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
}

export type ToggleButtonProps = {
  type: 'button'
  'aria-pressed': boolean
  'aria-label': string | undefined
  disabled: boolean
  'data-pressed': '' | undefined
  onclick: () => void
}

export type Toggle = {
  /** Current pressed state. */
  readonly pressed: boolean
  readonly disabled: boolean
  /** Flip pressed (no-op when disabled). */
  toggle: () => void
  /** Spread onto the button element. */
  buttonProps: () => ToggleButtonProps
}

export function createToggle(config: ToggleConfig): Toggle {
  const pressed = () => config.pressed()
  const disabled = () => config.disabled?.() ?? false

  function toggle() {
    if (disabled()) return
    config.onChange?.(!pressed())
  }

  return {
    get pressed() { return pressed() },
    get disabled() { return disabled() },
    toggle,
    buttonProps: () => ({
      type: 'button',
      'aria-pressed': pressed(),
      'aria-label': config.ariaLabel?.(),
      disabled: disabled(),
      'data-pressed': pressed() ? '' : undefined,
      onclick: toggle,
    }),
  }
}
