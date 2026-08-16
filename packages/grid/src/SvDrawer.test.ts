/**
 * Component tests for SvDrawer: dialog semantics, side variants, focus trap,
 * scroll lock, and Escape / backdrop dismissal - all inherited from the shared
 * a11y primitives.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvDrawer from './SvDrawer.svelte'

function mountDrawer(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvDrawer, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const dialog = () => document.body.querySelector<HTMLElement>('.sv-drawer')

// Closing plays a 260ms exit keyframe (`is-leaving`) before the panel unmounts,
// so dismissal assertions have to let that timer run. Fake timers keep it instant.
const EXIT_MS = 260
function runExitAnimation() {
  vi.advanceTimersByTime(EXIT_MS)
  flushSync()
}

afterEach(() => { vi.useRealTimers() })

describe('SvDrawer', () => {
  it('renders nothing when closed', () => {
    const { destroy } = mountDrawer({ open: false })
    try {
      expect(dialog()).toBeNull()
    } finally { destroy() }
  })

  it('renders a modal dialog with the title wired to aria-labelledby', () => {
    const { destroy } = mountDrawer({ open: true, title: 'Filters' })
    try {
      const el = dialog()!
      expect(el.getAttribute('role')).toBe('dialog')
      expect(el.getAttribute('aria-modal')).toBe('true')
      const labelledby = el.getAttribute('aria-labelledby')
      expect(labelledby).toBeTruthy()
      expect(document.getElementById(labelledby!)?.textContent).toBe('Filters')
    } finally { destroy() }
  })

  it('applies the side modifier class', () => {
    const { destroy } = mountDrawer({ open: true, side: 'left' })
    try {
      expect(dialog()!.classList.contains('sv-drawer--left')).toBe(true)
    } finally { destroy() }
  })

  it('locks body scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto'
    const { destroy } = mountDrawer({ open: true })
    try {
      expect(document.body.style.overflow).toBe('hidden')
    } finally {
      destroy()
      flushSync()
      expect(document.body.style.overflow).toBe('auto')
    }
  })

  it('closes on Escape and fires onClose', () => {
    vi.useFakeTimers()
    let closed = 0
    const { destroy } = mountDrawer({ open: true, onClose: () => closed++ })
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      flushSync()
      expect(closed).toBe(1)
      expect(dialog()!.classList.contains('is-leaving')).toBe(true) // exit keyframe first
      runExitAnimation()
      expect(dialog()).toBeNull()
    } finally { destroy() }
  })

  it('does not close on Escape when closeOnEsc is false', () => {
    const { destroy } = mountDrawer({ open: true, closeOnEsc: false })
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      flushSync()
      expect(dialog()).not.toBeNull()
    } finally { destroy() }
  })

  it('dismisses on outside (backdrop) pointerdown', () => {
    vi.useFakeTimers()
    const { destroy } = mountDrawer({ open: true })
    try {
      const backdrop = document.body.querySelector<HTMLElement>('.sv-drawer__backdrop')!
      backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      flushSync()
      runExitAnimation()
      expect(dialog()).toBeNull()
    } finally { destroy() }
  })

  // ---- Mobile bottom-sheet (Track D) -------------------------------------
  it('sheet mode renders bottom-anchored with a grab handle', () => {
    const { destroy } = mountDrawer({ open: true, sheet: true, side: 'right' })
    try {
      const el = dialog()!
      expect(el.classList.contains('is-sheet')).toBe(true)
      expect(el.classList.contains('sv-drawer--bottom')).toBe(true) // sheet overrides side
      expect(document.body.querySelector('.sv-drawer__grab')).not.toBeNull()
    } finally { destroy() }
  })

  it('swiping the grab handle down past the threshold closes the sheet', () => {
    vi.useFakeTimers()
    let closed = 0
    const { destroy } = mountDrawer({ open: true, sheet: true, onClose: () => closed++ })
    try {
      const grab = document.body.querySelector<HTMLElement>('.sv-drawer__grab')!
      grab.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }))
      grab.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 220 })) // dy = 120 > 80
      grab.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 220 }))
      flushSync()
      expect(closed).toBe(1)
      runExitAnimation()
      expect(dialog()).toBeNull()
    } finally { destroy() }
  })

  it('a small swipe snaps back without closing', () => {
    const { destroy } = mountDrawer({ open: true, sheet: true })
    try {
      const grab = document.body.querySelector<HTMLElement>('.sv-drawer__grab')!
      grab.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }))
      grab.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 140 })) // dy = 40 < 80
      grab.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 140 }))
      flushSync()
      expect(dialog()).not.toBeNull()
    } finally { destroy() }
  })
})
