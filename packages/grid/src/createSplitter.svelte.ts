/**
 * createSplitter - the HEADLESS core behind <SvSplitter>: a two-pane resizable
 * split with a draggable separator (WAI-ARIA `separator`), keyboard resize and
 * clamping, exposed as **prop-getters** you spread onto YOUR OWN markup. The core
 * never touches the DOM - the renderer measures the container rect and passes the
 * pointer position + rect IN via `setFromPointer` (same split as createSlider).
 * Parity: Smart `smart-splitter`.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createSplitter } from '@svgrid/grid'
 *   let frac = $state(0.5)
 *   const sp = createSplitter({ fraction: () => frac, onChange: (f) => (frac = f) })
 * </script>
 * <div class="row" bind:this={row}>
 *   <div style:flex-basis={sp.percent + '%'}>A</div>
 *   <div {...sp.separatorProps()} onpointerdown={...}></div>
 *   <div style:flex="1">B</div>
 * </div>
 * ```
 */
export type SplitterOrientation = 'horizontal' | 'vertical'
export type SplitterPoint = { x: number; y: number }

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type SplitterConfig = {
  /** Size of the FIRST pane as a fraction of the container (0..1). */
  fraction: () => number
  onChange?: (fraction: number) => void
  /** Split direction: `horizontal` = a vertical gutter between left/right panes. */
  orientation?: () => SplitterOrientation
  /** Min / max fraction for the first pane (0..1). */
  min?: () => number
  max?: () => number
  /** Keyboard step as a fraction (default 0.02 = 2%). */
  step?: () => number
  disabled?: () => boolean
  dir?: () => 'ltr' | 'rtl' | 'auto' | undefined
  ariaLabel?: () => string | undefined
}

export function createSplitter(config: SplitterConfig) {
  const isVert = () => (config.orientation?.() ?? 'horizontal') === 'vertical'
  const min = () => config.min?.() ?? 0.1
  const max = () => config.max?.() ?? 0.9
  const step = () => config.step?.() ?? 0.02
  const disabled = () => config.disabled?.() ?? false
  const rtl = () => config.dir?.() === 'rtl'

  const clamp = (f: number) => Math.min(max(), Math.max(min(), f))
  const fraction = $derived(clamp(config.fraction()))
  const percent = $derived(Math.round(fraction * 1000) / 10)

  let dragging = $state(false)

  function fromPointer(pos: SplitterPoint, rect: DOMRect): number {
    const raw = isVert()
      ? (pos.y - rect.top) / rect.height
      : (pos.x - rect.left) / rect.width
    // Horizontal RTL: the first pane sits on the right, so invert.
    const f = !isVert() && rtl() ? 1 - raw : raw
    return clamp(f)
  }

  function pointerDown() { if (!disabled()) dragging = true }
  function setFromPointer(pos: SplitterPoint, rect: DOMRect) {
    if (!dragging || disabled()) return
    config.onChange?.(fromPointer(pos, rect))
  }
  function endDrag() { dragging = false }

  function nudge(delta: number) {
    if (disabled()) return
    config.onChange?.(clamp(fraction + delta))
  }

  function onKeydown(e: KeyboardEvent) {
    if (disabled()) return
    const horiz = !isVert()
    const rtlH = horiz && rtl()
    const inc = () => nudge(step())
    const dec = () => nudge(-step())
    switch (e.key) {
      case 'ArrowRight': if (horiz) { e.preventDefault(); rtlH ? dec() : inc() } break
      case 'ArrowLeft': if (horiz) { e.preventDefault(); rtlH ? inc() : dec() } break
      case 'ArrowDown': if (!horiz) { e.preventDefault(); inc() } break
      case 'ArrowUp': if (!horiz) { e.preventDefault(); dec() } break
      case 'Home': e.preventDefault(); config.onChange?.(min()); break
      case 'End': e.preventDefault(); config.onChange?.(max()); break
    }
  }

  return {
    /** Clamped fraction (0..1) of the first pane. */
    get fraction() { return fraction },
    /** Clamped size of the first pane as a percentage (0..100). */
    get percent() { return percent },
    /** Whether the separator is being dragged. */
    get dragging() { return dragging },
    pointerDown,
    setFromPointer,
    endDrag,
    nudge,
    /** Spread onto the draggable separator element. */
    separatorProps: () => ({
      role: 'separator' as const,
      tabindex: disabled() ? -1 : 0,
      'aria-orientation': (isVert() ? 'horizontal' : 'vertical') as 'horizontal' | 'vertical',
      'aria-valuemin': Math.round(min() * 100),
      'aria-valuemax': Math.round(max() * 100),
      'aria-valuenow': Math.round(fraction * 100),
      'aria-label': config.ariaLabel?.() ?? 'Resize panes',
      'aria-disabled': disabled() || undefined,
      onkeydown: onKeydown,
    }),
  }
}

export type Splitter = ReturnType<typeof createSplitter>
