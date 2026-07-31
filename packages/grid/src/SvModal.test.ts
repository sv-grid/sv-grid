/**
 * Component tests for SvModal: dialog semantics, scroll lock, and Escape /
 * backdrop dismissal - all inherited from the shared createOverlay core (which
 * SvDrawer shares), plus the modal's title wiring and closeOnEsc opt-out.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvModal from './SvModal.svelte'

function mountModal(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvModal, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const dialog = () => document.body.querySelector<HTMLElement>('.sv-modal')

describe('SvModal', () => {
  it('renders nothing when closed', () => {
    const { destroy } = mountModal({ open: false })
    try {
      expect(dialog()).toBeNull()
    } finally { destroy() }
  })

  it('renders a modal dialog with the title wired to aria-labelledby', () => {
    const { destroy } = mountModal({ open: true, title: 'Edit row' })
    try {
      const el = dialog()!
      expect(el.getAttribute('role')).toBe('dialog')
      expect(el.getAttribute('aria-modal')).toBe('true')
      expect(el.getAttribute('tabindex')).toBe('-1')
      const labelledby = el.getAttribute('aria-labelledby')
      expect(labelledby).toBeTruthy()
      expect(document.getElementById(labelledby!)?.textContent).toBe('Edit row')
    } finally { destroy() }
  })

  it('locks body scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto'
    const { destroy } = mountModal({ open: true })
    try {
      expect(document.body.style.overflow).toBe('hidden')
    } finally {
      destroy()
      flushSync()
      expect(document.body.style.overflow).toBe('auto')
    }
  })

  it('closes on Escape and fires onClose', () => {
    let closed = 0
    const { destroy } = mountModal({ open: true, onClose: () => closed++ })
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      flushSync()
      expect(closed).toBe(1)
      expect(dialog()).toBeNull()
    } finally { destroy() }
  })

  it('does not close on Escape when closeOnEsc is false', () => {
    const { destroy } = mountModal({ open: true, closeOnEsc: false })
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      flushSync()
      expect(dialog()).not.toBeNull()
    } finally { destroy() }
  })

  it('dismisses on outside (backdrop) pointerdown', () => {
    const { destroy } = mountModal({ open: true })
    try {
      const backdrop = document.body.querySelector<HTMLElement>('.sv-modal__backdrop')!
      backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      flushSync()
      expect(dialog()).toBeNull()
    } finally { destroy() }
  })
})
