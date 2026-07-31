/**
 * Component tests for SvCarousel, exercising the shared createCarousel core:
 * slide/dot rendering, arrow navigation with looping, autoplay advance, and the
 * persistent play/pause stop toggle.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync, createRawSnippet } from 'svelte'
import SvCarousel from './SvCarousel.svelte'

const slide = createRawSnippet(() => ({ render: () => `<div class="slide"></div>` }))

function mountCarousel(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvCarousel, { target, props: { slide, ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}
const activeDot = (target: HTMLElement) =>
  [...target.querySelectorAll('.sv-carousel__dot')].findIndex((d) => d.classList.contains('is-active'))
const click = (el: Element | null | undefined) => { el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); flushSync() }

describe('SvCarousel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders one slide + dot per item, first active', () => {
    const { target, destroy } = mountCarousel({ count: 3 })
    try {
      expect(target.querySelectorAll('.sv-carousel__slide').length).toBe(3)
      expect(target.querySelectorAll('.sv-carousel__dot').length).toBe(3)
      expect(activeDot(target)).toBe(0)
    } finally { destroy() }
  })

  it('the next arrow advances and loops back to the first', () => {
    const { target, destroy } = mountCarousel({ count: 2, loop: true })
    try {
      click(target.querySelector('.sv-carousel__arrow.is-next'))
      expect(activeDot(target)).toBe(1)
      click(target.querySelector('.sv-carousel__arrow.is-next'))
      expect(activeDot(target)).toBe(0) // wrapped
    } finally { destroy() }
  })

  it('a dot jumps directly to its slide', () => {
    const { target, destroy } = mountCarousel({ count: 4 })
    try {
      click(target.querySelectorAll('.sv-carousel__dot')[2])
      expect(activeDot(target)).toBe(2)
    } finally { destroy() }
  })

  it('autoplay advances on the interval and the toggle stops it', () => {
    const { target, destroy } = mountCarousel({ count: 3, autoplay: 1000 })
    try {
      expect(activeDot(target)).toBe(0)
      vi.advanceTimersByTime(1000)
      flushSync()
      expect(activeDot(target)).toBe(1)
      // Stop toggle: autoplay no longer advances.
      click(target.querySelector('.sv-carousel__playpause'))
      vi.advanceTimersByTime(3000)
      flushSync()
      expect(activeDot(target)).toBe(1)
    } finally { destroy() }
  })
})
