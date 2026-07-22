/**
 * createSlider - the HEADLESS core behind <SvSlider>, in the same spirit as
 * `createSvGrid` for the grid: a runes-based state machine (single + dual-thumb,
 * stepping, keyboard, drag state) that owns the value<->position math and the
 * ARIA wiring, exposed as **prop-getters** you spread onto YOUR OWN markup.
 *
 * The core never touches the DOM: the styled renderer measures the track
 * (`getBoundingClientRect`) and passes the rect + pointer position IN via
 * `pointerDown` / `setFromPointer`. The core turns that into a stepped value.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createSlider } from '@svgrid/grid'
 *   let value = $state(50)
 *   const s = createSlider({ value: () => value, onChange: (v) => (value = v as number) })
 * </script>
 * <div bind:this={track} onpointerdown={(e) => s.pointerDown({ x: e.clientX, y: e.clientY }, track.getBoundingClientRect())}>
 *   <div {...s.thumbProps(0)} style:left={s.percentOf(s.hi) + '%'}></div>
 * </div>
 * ```
 */
export type SliderValue = number | [number, number]
export type SliderOrientation = 'horizontal' | 'vertical'
export type SliderThumb = 'single' | 'lo' | 'hi'
export type SliderPoint = { x: number; y: number }

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type SliderConfig = {
  value: () => SliderValue
  onChange?: (value: SliderValue) => void
  min?: () => number
  max?: () => number
  step?: () => number
  range?: () => boolean
  orientation?: () => SliderOrientation
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
  /** Right-to-left: mirrors horizontal pointer + Left/Right key direction. */
  rtl?: () => boolean
}

export function createSlider(config: SliderConfig) {
  const min = () => config.min?.() ?? 0
  const max = () => config.max?.() ?? 100
  const stepSize = () => config.step?.() ?? 1
  const range = () => config.range?.() ?? false
  const isVert = () => (config.orientation?.() ?? 'horizontal') === 'vertical'
  const disabled = () => config.disabled?.() ?? false
  const rtl = () => config.rtl?.() ?? false

  const lo = $derived(range() ? (config.value() as [number, number])[0] : min())
  const hi = $derived(range() ? (config.value() as [number, number])[1] : (config.value() as number))

  function clampStep(v: number): number {
    const stepped = Math.round((v - min()) / stepSize()) * stepSize() + min()
    return Math.min(max(), Math.max(min(), Number(stepped.toFixed(10))))
  }
  /** Value -> percentage along the track (0..100). */
  const percentOf = (v: number) => ((v - min()) / (max() - min())) * 100

  let dragging = $state<SliderThumb | null>(null)

  /** Turn a pointer position (client coords) + measured track rect into a value. */
  function valueFromPointer(pos: SliderPoint, rect: DOMRect): number {
    const horiz = (pos.x - rect.left) / rect.width
    const frac = isVert()
      ? 1 - (pos.y - rect.top) / rect.height
      : rtl() ? 1 - horiz : horiz
    return clampStep(min() + Math.min(1, Math.max(0, frac)) * (max() - min()))
  }

  const emitSingle = (v: number) => config.onChange?.(v)
  const emitRange = (nlo: number, nhi: number) => config.onChange?.([Math.min(nlo, nhi), Math.max(nlo, nhi)])

  function nudge(which: SliderThumb, next: number) {
    if (which === 'single') emitSingle(next)
    else if (which === 'lo') emitRange(next, hi)
    else emitRange(lo, next)
  }

  /** Begin a drag: pick the nearest thumb (range) and emit the initial value. */
  function pointerDown(pos: SliderPoint, rect: DOMRect) {
    if (disabled()) return
    const v = valueFromPointer(pos, rect)
    if (range()) {
      const which: SliderThumb = Math.abs(v - lo) <= Math.abs(v - hi) ? 'lo' : 'hi'
      dragging = which
      which === 'lo' ? emitRange(v, hi) : emitRange(lo, v)
    } else {
      dragging = 'single'
      emitSingle(v)
    }
  }
  /** Continue a drag: emit the value for the currently-dragged thumb. */
  function setFromPointer(pos: SliderPoint, rect: DOMRect) {
    if (!dragging) return
    nudge(dragging, valueFromPointer(pos, rect))
  }
  function endDrag() { dragging = null }

  /** Step a thumb by `delta` steps (used for custom controls). */
  function step(which: SliderThumb, delta: number) {
    if (disabled()) return
    const cur = which === 'lo' ? lo : hi
    nudge(which, clampStep(cur + delta * stepSize()))
  }

  function onThumbKey(e: KeyboardEvent, which: SliderThumb) {
    if (disabled()) return
    const cur = which === 'lo' ? lo : hi
    // Under horizontal RTL, Left increases and Right decreases (Up/Down keep
    // their natural up=more direction regardless of text direction).
    const rtlH = rtl() && !isVert()
    const inc = clampStep(cur + stepSize())
    const dec = clampStep(cur - stepSize())
    let next = cur
    if (e.key === 'ArrowUp') next = inc
    else if (e.key === 'ArrowDown') next = dec
    else if (e.key === 'ArrowRight') next = rtlH ? dec : inc
    else if (e.key === 'ArrowLeft') next = rtlH ? inc : dec
    else if (e.key === 'Home') next = min()
    else if (e.key === 'End') next = max()
    else if (e.key === 'PageUp') next = clampStep(cur + stepSize() * 10)
    else if (e.key === 'PageDown') next = clampStep(cur - stepSize() * 10)
    else return
    e.preventDefault()
    nudge(which, next)
  }

  const thumbOf = (i: number): SliderThumb => (range() ? (i === 0 ? 'lo' : 'hi') : 'single')

  return {
    get value() { return config.value() },
    get lo() { return lo },
    get hi() { return hi },
    /** Thumb currently being dragged, or null. */
    get dragging() { return dragging },
    percentOf,
    clampStep,
    valueFromPointer,
    pointerDown,
    setFromPointer,
    endDrag,
    step,
    /** Spread onto the track container (static a11y/data hooks). */
    trackProps: () => ({
      'data-orientation': isVert() ? 'vertical' : 'horizontal',
    }),
    /** Spread onto the thumb at index `i` (0 = single/low, 1 = high). */
    thumbProps: (i: number) => {
      const which = thumbOf(i)
      const cur = which === 'lo' ? lo : hi
      const vmin = which === 'hi' ? lo : min()
      const vmax = which === 'lo' ? hi : max()
      const label = which === 'lo' ? 'Minimum' : which === 'hi' ? 'Maximum' : (config.ariaLabel?.() ?? 'Value')
      return {
        role: 'slider' as const,
        tabindex: disabled() ? -1 : 0,
        'aria-valuemin': vmin,
        'aria-valuemax': vmax,
        'aria-valuenow': cur,
        'aria-label': label,
        'aria-orientation': (isVert() ? 'vertical' : 'horizontal') as SliderOrientation,
        'aria-disabled': disabled() || undefined,
        onkeydown: (e: KeyboardEvent) => onThumbKey(e, which),
      }
    },
  }
}

export type Slider = ReturnType<typeof createSlider>
