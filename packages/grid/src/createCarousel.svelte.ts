/**
 * createCarousel - the HEADLESS core behind <SvCarousel>: slide navigation
 * (with optional looping), autoplay that pauses on hover/focus and via a
 * persistent stop toggle (WCAG 2.2.2), and rtl-aware arrow wiring - as
 * prop-getters you spread onto your own markup. The component keeps only the
 * visual track + swipe. Runes-based, like `createListbox`.
 */
import { type EditorDir } from './editor-contract'

export type CarouselConfig = {
  count: () => number
  /** Active slide index (the component owns the state; core calls onChange). */
  current: () => number
  onChange?: (index: number) => void
  loop?: () => boolean
  /** Autoplay interval in ms; 0 = off. */
  autoplay?: () => number
  dir?: () => EditorDir | undefined
}

export function createCarousel(config: CarouselConfig) {
  const count = () => config.count()
  const current = () => config.current()
  const loop = () => config.loop?.() ?? true
  const rtl = () => config.dir?.() === 'rtl'

  let paused = $state(false) // hover/focus
  let userPaused = $state(false) // explicit stop toggle

  function go(i: number) {
    const n = count()
    if (n === 0) return
    const target = loop() ? ((i % n) + n) % n : Math.max(0, Math.min(i, n - 1))
    config.onChange?.(target)
  }
  const next = () => go(current() + 1)
  const prev = () => go(current() - 1)
  const canGoPrev = () => loop() || current() > 0
  const canGoNext = () => loop() || current() < count() - 1

  // Autoplay, paused while hovered/focused or explicitly stopped (WCAG 2.2.2).
  $effect(() => {
    const ms = config.autoplay?.() ?? 0
    if (!ms || paused || userPaused || count() < 2) return
    const t = setInterval(() => next(), ms)
    return () => clearInterval(t)
  })

  return {
    get paused() { return paused },
    get userPaused() { return userPaused },
    rtl,
    isActive: (i: number) => i === current(),
    go,
    next,
    prev,
    canGoPrev,
    canGoNext,
    /** Spread onto the carousel container. Pauses autoplay on hover/focus. */
    rootProps: (ariaLabel = 'Carousel') => ({
      role: 'group' as const,
      'aria-roledescription': 'carousel',
      'aria-label': ariaLabel,
      onpointerenter: () => { paused = true },
      onpointerleave: () => { paused = false },
      onfocusin: () => { paused = true },
      onfocusout: () => { paused = false },
    }),
    /** Spread onto each slide element. */
    slideProps: (i: number) => ({
      role: 'group' as const,
      'aria-roledescription': 'slide',
      'aria-label': `${i + 1} of ${count()}`,
      'aria-hidden': i !== current(),
      inert: i !== current(),
    }),
    /** The visually-leading (inline-start) arrow: logical prev in ltr, next in rtl. */
    prevArrowProps: () => ({
      'aria-label': rtl() ? 'Next slide' : 'Previous slide',
      onclick: rtl() ? next : prev,
      disabled: rtl() ? !canGoNext() : !canGoPrev(),
    }),
    /** The visually-trailing (inline-end) arrow: logical next in ltr, prev in rtl. */
    nextArrowProps: () => ({
      'aria-label': rtl() ? 'Previous slide' : 'Next slide',
      onclick: rtl() ? prev : next,
      disabled: rtl() ? !canGoPrev() : !canGoNext(),
    }),
    /** Spread onto a dot indicator. */
    dotProps: (i: number) => ({
      'aria-label': `Go to slide ${i + 1}`,
      'aria-current': (i === current() ? 'true' : undefined) as 'true' | undefined,
      onclick: () => go(i),
    }),
    /** Spread onto the persistent play/pause toggle (render only when autoplay > 0). */
    playPauseProps: () => ({
      'aria-label': userPaused ? 'Play autoplay' : 'Pause autoplay',
      'aria-pressed': userPaused,
      onclick: () => { userPaused = !userPaused },
    }),
  }
}

export type Carousel = ReturnType<typeof createCarousel>
