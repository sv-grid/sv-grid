/**
 * Component tests for the app-UI set: SvPagination, SvBreadcrumb, SvStepper,
 * SvAvatar, SvContextMenu - semantics, active/current state, and interaction.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvPagination from './SvPagination.svelte'
import SvBreadcrumb from './SvBreadcrumb.svelte'
import SvStepper from './SvStepper.svelte'
import SvAvatar from './SvAvatar.svelte'
import SvContextMenu from './SvContextMenu.svelte'

function mountOn(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvPagination', () => {
  it('marks the current page with aria-current and disables prev on page 1', () => {
    const { target, destroy } = mountOn(SvPagination, { page: 1, pageCount: 10 })
    try {
      const active = target.querySelector('.sv-pg__btn.is-active')!
      expect(active.getAttribute('aria-current')).toBe('page')
      expect(active.textContent).toBe('1')
      const prev = target.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')!
      expect(prev.disabled).toBe(true)
    } finally { destroy() }
  })

  it('emits the page number on click', () => {
    let got: number | undefined
    const { target, destroy } = mountOn(SvPagination, { page: 1, pageCount: 10, onChange: (n: number) => (got = n) })
    try {
      const next = target.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!
      next.click()
      flushSync()
      expect(got).toBe(2)
    } finally { destroy() }
  })
})

describe('SvBreadcrumb', () => {
  const items = [{ label: 'Home', href: '/' }, { label: 'Orders', href: '/orders' }, { label: '#1024' }]

  it('renders links for non-last crumbs and marks the last as current', () => {
    const { target, destroy } = mountOn(SvBreadcrumb, { items })
    try {
      expect(target.querySelectorAll('a.sv-bc__link')).toHaveLength(2)
      expect(target.querySelector('[aria-current="page"]')!.textContent).toContain('#1024')
    } finally { destroy() }
  })

  it('collapses the middle when over maxItems', () => {
    const many = [
      { label: 'A', href: '/a' }, { label: 'B', href: '/b' }, { label: 'C', href: '/c' },
      { label: 'D', href: '/d' }, { label: 'E' },
    ]
    const { target, destroy } = mountOn(SvBreadcrumb, { items: many, maxItems: 3 })
    try {
      expect(target.querySelector('.sv-bc__ellipsis')).not.toBeNull()
      target.querySelector<HTMLButtonElement>('.sv-bc__ellipsis')!.click()
      flushSync()
      expect(target.querySelector('.sv-bc__ellipsis')).toBeNull() // expanded
    } finally { destroy() }
  })
})

describe('SvStepper', () => {
  const steps = [{ label: 'Cart' }, { label: 'Shipping' }, { label: 'Pay' }]

  it('flags the active step and completes earlier ones', () => {
    const { target, destroy } = mountOn(SvStepper, { steps, current: 1 })
    try {
      const items = target.querySelectorAll('.sv-step__item')
      expect(items[0]!.classList.contains('is-complete')).toBe(true)
      expect(items[1]!.classList.contains('is-active')).toBe(true)
      expect(items[2]!.classList.contains('is-upcoming')).toBe(true)
      expect(target.querySelector('[aria-current="step"]')).not.toBeNull()
    } finally { destroy() }
  })

  it('disables upcoming steps in linear mode', () => {
    const { target, destroy } = mountOn(SvStepper, { steps, current: 1, linear: true })
    try {
      const btns = target.querySelectorAll<HTMLButtonElement>('.sv-step__btn')
      expect(btns[2]!.disabled).toBe(true) // upcoming, not reachable
      expect(btns[0]!.disabled).toBe(false) // completed, reachable
    } finally { destroy() }
  })
})

describe('SvAvatar', () => {
  it('renders initials with an img role when there is no src', () => {
    const { target, destroy } = mountOn(SvAvatar, { name: 'Ada Lovelace' })
    try {
      const el = target.querySelector('.sv-avatar')!
      expect(el.getAttribute('role')).toBe('img')
      expect(el.getAttribute('aria-label')).toBe('Ada Lovelace')
      expect(target.querySelector('.sv-avatar__initials')!.textContent).toBe('AL')
    } finally { destroy() }
  })

  it('renders a status dot when status is set', () => {
    const { target, destroy } = mountOn(SvAvatar, { name: 'X', status: 'online' })
    try {
      expect(target.querySelector('.sv-avatar__status.is-online')).not.toBeNull()
    } finally { destroy() }
  })
})

describe('SvContextMenu', () => {
  it('opens a menu at the pointer on contextmenu and closes on Escape', () => {
    const items = [{ label: 'Copy' }, { label: 'Delete' }]
    const { target, destroy } = mountOn(SvContextMenu, { items })
    try {
      const zone = target.querySelector('.sv-ctx__zone')!
      zone.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }))
      flushSync()
      expect(document.body.querySelector('.sv-ctx')).not.toBeNull()
      expect(document.body.querySelectorAll('[role="menuitem"]').length).toBe(2)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      flushSync()
      expect(document.body.querySelector('.sv-ctx')).toBeNull()
    } finally { destroy() }
  })
})
