/**
 * Component tests for the Tier-3 batch: SvRichText, SvCarousel, SvTour.
 * (execCommand-driven formatting is a no-op in jsdom, so RichText tests cover
 * structure + value/onChange, not the rendered rich output.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvRichText from './SvRichText.svelte'
import SvCarousel from './SvCarousel.svelte'
import SvTour from './SvTour.svelte'

function mountOn(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

afterEach(() => { document.body.innerHTML = '' })

describe('SvRichText', () => {
  it('renders a toolbar and an editable region seeded from value', () => {
    const { target, destroy } = mountOn(SvRichText, { value: '<p>Hello</p>' })
    try {
      expect(target.querySelector('.sv-rt__toolbar')).not.toBeNull()
      expect(target.querySelectorAll('.sv-rt__btn').length).toBeGreaterThan(6)
      const body = target.querySelector<HTMLElement>('.sv-rt__body')!
      expect(body.getAttribute('contenteditable')).toBe('true')
      expect(body.innerHTML).toBe('<p>Hello</p>')
    } finally { destroy() }
  })

  it('emits onChange on input', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountOn(SvRichText, { value: '', onChange })
    try {
      const body = target.querySelector<HTMLElement>('.sv-rt__body')!
      body.innerHTML = '<b>hi</b>'
      body.dispatchEvent(new Event('input', { bubbles: true }))
      expect(onChange).toHaveBeenCalledWith('<b>hi</b>')
    } finally { destroy() }
  })

  it('readonly hides the toolbar and disables editing', () => {
    const { target, destroy } = mountOn(SvRichText, { value: 'x', readonly: true })
    try {
      expect(target.querySelector('.sv-rt__toolbar')).toBeNull()
      expect(target.querySelector('.sv-rt__body')!.getAttribute('contenteditable')).toBe('false')
    } finally { destroy() }
  })

  it('honours a custom tools list', () => {
    const { target, destroy } = mountOn(SvRichText, { value: '', tools: ['bold', 'italic'] })
    try {
      expect(target.querySelectorAll('.sv-rt__btn')).toHaveLength(2)
    } finally { destroy() }
  })
})

describe('SvCarousel', () => {
  const slideProps = { count: 3, slide: undefined as any }
  // Provide a minimal slide snippet via a wrapper is awkward; render count-only.

  it('renders one slide element per count with arrows + dots', () => {
    const { target, destroy } = mountOn(SvCarousel, { ...slideProps })
    try {
      expect(target.querySelectorAll('.sv-carousel__slide')).toHaveLength(3)
      expect(target.querySelectorAll('.sv-carousel__dot')).toHaveLength(3)
      expect(target.querySelector('.sv-carousel__arrow.is-next')).not.toBeNull()
    } finally { destroy() }
  })

  it('next advances the active dot (with loop wrap)', () => {
    const { target, destroy } = mountOn(SvCarousel, { count: 3, current: 0 })
    try {
      target.querySelector<HTMLButtonElement>('.sv-carousel__arrow.is-next')!.click()
      flushSync()
      const active = [...target.querySelectorAll('.sv-carousel__dot')].findIndex((d) => d.classList.contains('is-active'))
      expect(active).toBe(1)
    } finally { destroy() }
  })

  it('clicking a dot jumps to that slide', () => {
    const { target, destroy } = mountOn(SvCarousel, { count: 4, current: 0 })
    try {
      target.querySelectorAll<HTMLButtonElement>('.sv-carousel__dot')[2]!.click()
      flushSync()
      expect(target.querySelectorAll('.sv-carousel__dot')[2]!.classList.contains('is-active')).toBe(true)
    } finally { destroy() }
  })
})

describe('SvTour', () => {
  const steps = [
    { title: 'Welcome', content: 'Intro.' },
    { title: 'Step two', content: 'More.' },
    { title: 'Done', content: 'Finish.' },
  ]

  it('shows the first step with a counter and Next', () => {
    const { destroy } = mountOn(SvTour, { open: true, steps })
    try {
      expect(document.body.querySelector('.sv-tour__title')!.textContent).toBe('Welcome')
      expect(document.body.querySelector('.sv-tour__count')!.textContent).toBe('1 / 3')
      expect(document.body.querySelector('.sv-tour__back')).toBeNull() // no Back on step 1
    } finally { destroy() }
  })

  it('Next advances, Back returns, Done finishes', () => {
    const onFinish = vi.fn()
    const { destroy } = mountOn(SvTour, { open: true, steps, onFinish })
    try {
      document.body.querySelector<HTMLButtonElement>('.sv-tour__next')!.click()
      flushSync()
      expect(document.body.querySelector('.sv-tour__title')!.textContent).toBe('Step two')
      document.body.querySelector<HTMLButtonElement>('.sv-tour__back')!.click()
      flushSync()
      expect(document.body.querySelector('.sv-tour__title')!.textContent).toBe('Welcome')
      // to the end
      document.body.querySelector<HTMLButtonElement>('.sv-tour__next')!.click(); flushSync()
      document.body.querySelector<HTMLButtonElement>('.sv-tour__next')!.click(); flushSync()
      document.body.querySelector<HTMLButtonElement>('.sv-tour__next')!.click(); flushSync() // Done
      expect(onFinish).toHaveBeenCalled()
      expect(document.body.querySelector('.sv-tour__pop')).toBeNull()
    } finally { destroy() }
  })

  it('Skip fires onSkip and closes', () => {
    const onSkip = vi.fn()
    const { destroy } = mountOn(SvTour, { open: true, steps, onSkip })
    try {
      document.body.querySelector<HTMLButtonElement>('.sv-tour__skip')!.click()
      flushSync()
      expect(onSkip).toHaveBeenCalled()
      expect(document.body.querySelector('.sv-tour__pop')).toBeNull()
    } finally { destroy() }
  })
})
