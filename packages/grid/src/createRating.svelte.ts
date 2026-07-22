/**
 * createRating - the HEADLESS core behind <SvRating>: a controlled star-rating
 * control (WAI-ARIA `slider`) with hover preview, optional half steps, keyboard
 * (Arrows step, Home/End jump), and readonly/disabled - exposed as **prop-getters**
 * you spread onto YOUR OWN markup.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createRating } from '@svgrid/grid'
 *   let value = $state(3)
 *   const r = createRating({ value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <div {...r.rootProps()}>
 *   {#each Array(5) as _, i}<button {...r.starProps(i)}>{r.fillOf(i)}</button>{/each}
 * </div>
 * ```
 *
 * The styled <SvRating> is just one renderer over this core.
 */
export type RatingFill = 'full' | 'half' | 'empty'

import { editorAria, type EditorAriaState } from './editor-contract'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type RatingConfig = {
  value: () => number
  onChange?: (value: number) => void
  max?: () => number
  allowHalf?: () => boolean
  readonly?: () => boolean
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
  /** Accessible label for a star given its 1-based position (localizable). */
  starLabel?: (position: number) => string | undefined
  // Editor contract (ARIA + validation) - folded into rootProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
}

export type RatingRootProps = {
  role: 'slider'
  id: string | undefined
  tabindex: number
  'aria-label': string
  'aria-invalid': 'true' | undefined
  'aria-required': 'true' | undefined
  'aria-describedby': string | undefined
  'aria-valuenow': number
  'aria-valuemin': number
  'aria-valuemax': number
  'aria-readonly': boolean
  onkeydown: (e: KeyboardEvent) => void
  onpointerleave: () => void
}

export type RatingStarProps = {
  type: 'button'
  tabindex: number
  disabled: boolean
  'aria-label': string
  'data-fill': RatingFill
  onpointermove: (e: PointerEvent) => void
  onclick: (e: MouseEvent) => void
}

export type Rating = {
  /** The committed value. */
  readonly value: number
  /** What the stars should paint right now: the hover preview, else `value`. */
  readonly preview: number
  readonly max: number
  readonly interactive: boolean
  /** Fill state of the star at `index` given the current preview. */
  fillOf: (index: number) => RatingFill
  /** Set the hover preview (pass null to clear). No-op when non-interactive. */
  setHover: (value: number | null) => void
  /** Commit a value. No-op when non-interactive. */
  pick: (value: number) => void
  onKeydown: (e: KeyboardEvent) => void
  /** Spread onto the container element. */
  rootProps: () => RatingRootProps
  /** Spread onto the star element at `index`. */
  starProps: (index: number) => RatingStarProps
}

export function createRating(config: RatingConfig): Rating {
  const max = () => config.max?.() ?? 5
  const allowHalf = () => config.allowHalf?.() ?? false
  const ro = () => config.readonly?.() ?? false
  const disabled = () => config.disabled?.() ?? false
  const interactive = () => !ro() && !disabled()

  let hover = $state<number | null>(null)
  const preview = $derived(hover ?? config.value())

  function valueAt(e: MouseEvent, index: number): number {
    if (!allowHalf()) return index + 1
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    return e.clientX - rect.left < rect.width / 2 ? index + 0.5 : index + 1
  }

  function fillOf(index: number): RatingFill {
    if (preview >= index + 1) return 'full'
    if (preview >= index + 0.5) return 'half'
    return 'empty'
  }

  function setHover(value: number | null) {
    if (interactive()) hover = value
  }
  function pick(value: number) {
    if (interactive()) config.onChange?.(value)
  }

  function onKeydown(e: KeyboardEvent) {
    if (!interactive()) return
    const step = allowHalf() ? 0.5 : 1
    const v = config.value()
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); config.onChange?.(Math.min(max(), v + step)) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); config.onChange?.(Math.max(0, v - step)) }
    else if (e.key === 'Home') { e.preventDefault(); config.onChange?.(0) }
    else if (e.key === 'End') { e.preventDefault(); config.onChange?.(max()) }
  }

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  return {
    get value() { return config.value() },
    get preview() { return preview },
    get max() { return max() },
    get interactive() { return interactive() },
    fillOf,
    setHover,
    pick,
    onKeydown,
    rootProps: () => ({
      role: 'slider',
      id: config.id?.(),
      tabindex: interactive() ? 0 : -1,
      ...editorAria(ariaState()),
      'aria-label': config.ariaLabel?.() ?? 'Rating',
      'aria-valuenow': config.value(),
      'aria-valuemin': 0,
      'aria-valuemax': max(),
      'aria-readonly': ro(),
      onkeydown: onKeydown,
      onpointerleave: () => { hover = null },
    }),
    starProps: (index: number) => ({
      type: 'button',
      tabindex: -1,
      disabled: !interactive(),
      'aria-label': config.starLabel?.(index + 1) ?? `${index + 1} star${index ? 's' : ''}`,
      'data-fill': fillOf(index),
      onpointermove: (e: PointerEvent) => { if (interactive()) hover = valueAt(e, index) },
      onclick: (e: MouseEvent) => { if (interactive()) config.onChange?.(valueAt(e, index)) },
    }),
  }
}
