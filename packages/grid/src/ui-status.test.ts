/**
 * Component tests for the Tier-1 status/display batch: SvAlert, SvEmptyState,
 * SvDivider, SvChip, SvStat, SvTimeline.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvAlert from './SvAlert.svelte'
import SvEmptyState from './SvEmptyState.svelte'
import SvDivider from './SvDivider.svelte'
import SvChip from './SvChip.svelte'
import SvStat from './SvStat.svelte'
import SvTimeline from './SvTimeline.svelte'

function mountOn(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvAlert', () => {
  it('applies the variant class and uses role=alert for danger', () => {
    const { target, destroy } = mountOn(SvAlert, { variant: 'danger', title: 'Failed' })
    try {
      const el = target.querySelector('.sv-alert')!
      expect(el.classList.contains('sv-alert--danger')).toBe(true)
      expect(el.getAttribute('role')).toBe('alert')
      expect(target.querySelector('.sv-alert__title')!.textContent).toBe('Failed')
    } finally { destroy() }
  })

  it('dismissible: the x removes the alert and fires onDismiss', () => {
    const onDismiss = vi.fn()
    const { target, destroy } = mountOn(SvAlert, { dismissible: true, onDismiss })
    try {
      target.querySelector<HTMLButtonElement>('.sv-alert__x')!.click()
      flushSync()
      expect(onDismiss).toHaveBeenCalled()
      expect(target.querySelector('.sv-alert')).toBeNull()
    } finally { destroy() }
  })
})

describe('SvEmptyState', () => {
  it('renders title, description and a default icon', () => {
    const { target, destroy } = mountOn(SvEmptyState, { title: 'Nothing here', description: 'Add one.' })
    try {
      expect(target.querySelector('.sv-empty__title')!.textContent).toBe('Nothing here')
      expect(target.querySelector('.sv-empty__desc')!.textContent).toBe('Add one.')
      expect(target.querySelector('.sv-empty__icon svg')).not.toBeNull()
    } finally { destroy() }
  })
})

describe('SvDivider', () => {
  it('is a horizontal separator by default', () => {
    const { target, destroy } = mountOn(SvDivider, {})
    try {
      const el = target.querySelector('.sv-divider')!
      expect(el.getAttribute('role')).toBe('separator')
      expect(el.classList.contains('sv-divider--h')).toBe(true)
    } finally { destroy() }
  })

  it('renders a label and the has-label class', () => {
    const { target, destroy } = mountOn(SvDivider, { label: 'OR' })
    try {
      const el = target.querySelector('.sv-divider')!
      expect(el.classList.contains('has-label')).toBe(true)
      expect(target.querySelector('.sv-divider__label')!.textContent).toBe('OR')
    } finally { destroy() }
  })

  it('vertical orientation sets aria-orientation', () => {
    const { target, destroy } = mountOn(SvDivider, { orientation: 'vertical' })
    try {
      const el = target.querySelector('.sv-divider')!
      expect(el.classList.contains('sv-divider--v')).toBe(true)
      expect(el.getAttribute('aria-orientation')).toBe('vertical')
    } finally { destroy() }
  })
})

describe('SvChip', () => {
  it('removable: the x fires onRemove', () => {
    const onRemove = vi.fn()
    const { target, destroy } = mountOn(SvChip, { removable: true, onRemove, variant: 'accent' })
    try {
      expect(target.querySelector('.sv-chip')!.classList.contains('sv-chip--accent')).toBe(true)
      target.querySelector<HTMLButtonElement>('.sv-chip__x')!.click()
      expect(onRemove).toHaveBeenCalled()
    } finally { destroy() }
  })

  it('onClick makes the label a button', () => {
    const onClick = vi.fn()
    const { target, destroy } = mountOn(SvChip, { onClick })
    try {
      const btn = target.querySelector<HTMLButtonElement>('.sv-chip__label--btn')!
      expect(btn).not.toBeNull()
      btn.click()
      expect(onClick).toHaveBeenCalled()
    } finally { destroy() }
  })
})

describe('SvStat', () => {
  it('renders the value and infers an up/good trend from a positive delta', () => {
    const { target, destroy } = mountOn(SvStat, { label: 'Revenue', value: '$48k', delta: 12.4 })
    try {
      expect(target.querySelector('.sv-stat__value')!.textContent).toBe('$48k')
      const delta = target.querySelector('.sv-stat__delta')!
      expect(delta.textContent).toContain('+12.4%')
      expect(delta.classList.contains('is-good')).toBe(true)
    } finally { destroy() }
  })

  it('invert makes a downward delta good (e.g. error rate)', () => {
    const { target, destroy } = mountOn(SvStat, { label: 'Errors', value: '0.4%', delta: -20, invert: true })
    try {
      const delta = target.querySelector('.sv-stat__delta')!
      expect(delta.classList.contains('is-good')).toBe(true)
    } finally { destroy() }
  })
})

describe('SvTimeline', () => {
  it('renders an entry per item with title/time/description', () => {
    const items = [
      { title: 'Placed', time: '09:12' },
      { title: 'Shipped', time: '14:40', description: 'Left the warehouse' },
    ]
    const { target, destroy } = mountOn(SvTimeline, { items })
    try {
      expect(target.querySelectorAll('.sv-timeline__item')).toHaveLength(2)
      expect([...target.querySelectorAll('.sv-timeline__title')].map((t) => t.textContent)).toEqual(['Placed', 'Shipped'])
      expect(target.querySelector('.sv-timeline__desc')!.textContent).toBe('Left the warehouse')
    } finally { destroy() }
  })
})
