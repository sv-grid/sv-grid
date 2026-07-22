/**
 * Rendering tests for the presentational display trio: SvBadge, SvSkeleton,
 * SvCard - variant/prop-driven classes, a11y roles, and conditional regions.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvBadge from './SvBadge.svelte'
import SvSkeleton from './SvSkeleton.svelte'
import SvCard from './SvCard.svelte'

function mountOn<T extends Record<string, unknown>>(Comp: any, props: T) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvBadge', () => {
  it('applies variant + size classes and pill by default', () => {
    const { target, destroy } = mountOn(SvBadge, { variant: 'success', size: 'sm' })
    try {
      const el = target.querySelector('.sv-badge')!
      expect(el.classList.contains('sv-badge--success')).toBe(true)
      expect(el.classList.contains('sv-badge--sm')).toBe(true)
      expect(el.classList.contains('is-pill')).toBe(true)
    } finally { destroy() }
  })

  it('renders a status dot when dot is set', () => {
    const { target, destroy } = mountOn(SvBadge, { variant: 'danger', dot: true })
    try {
      expect(target.querySelector('.sv-badge__dot')).not.toBeNull()
    } finally { destroy() }
  })
})

describe('SvSkeleton', () => {
  it('renders one box per line for text variant with a shorter last line', () => {
    const { target, destroy } = mountOn(SvSkeleton, { variant: 'text', lines: 3 })
    try {
      const boxes = target.querySelectorAll('.sv-skel__box')
      expect(boxes).toHaveLength(3)
      expect(boxes[2]!.classList.contains('is-last')).toBe(true)
      expect(target.querySelector('.sv-skel')!.getAttribute('aria-busy')).toBe('true')
    } finally { destroy() }
  })

  it('renders a single circle box for circle variant', () => {
    const { target, destroy } = mountOn(SvSkeleton, { variant: 'circle' })
    try {
      const boxes = target.querySelectorAll('.sv-skel__box')
      expect(boxes).toHaveLength(1)
      expect(boxes[0]!.classList.contains('sv-skel__box--circle')).toBe(true)
    } finally { destroy() }
  })
})

describe('SvCard', () => {
  it('renders a header only when title/subtitle/header provided', () => {
    const bare = mountOn(SvCard, {})
    try {
      expect(bare.target.querySelector('.sv-card__header')).toBeNull()
    } finally { bare.destroy() }

    const titled = mountOn(SvCard, { title: 'Revenue', subtitle: 'Last 30 days' })
    try {
      expect(titled.target.querySelector('.sv-card__title')!.textContent).toBe('Revenue')
      expect(titled.target.querySelector('.sv-card__subtitle')!.textContent).toBe('Last 30 days')
    } finally { titled.destroy() }
  })

  it('flush removes body padding via a modifier class', () => {
    const { target, destroy } = mountOn(SvCard, { flush: true })
    try {
      expect(target.querySelector('.sv-card__body')!.classList.contains('is-flush')).toBe(true)
    } finally { destroy() }
  })
})
