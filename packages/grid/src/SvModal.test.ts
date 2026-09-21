/**
 * Component tests for SvModal: dialog semantics, scroll lock, and Escape /
 * backdrop dismissal - all inherited from the shared createOverlay core (which
 * SvDrawer shares), plus the modal's title wiring and closeOnEsc opt-out.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync, createRawSnippet } from 'svelte'
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

  it('takes an exact width over the size preset', () => {
    const { destroy } = mountModal({ open: true, size: 'sm', width: 440 })
    try {
      const el = dialog()!
      expect(el.classList.contains('sv-modal--sm')).toBe(true)
      expect(el.style.width).toBe('440px')
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

  it('focuses the first body control on open, not the header Close (x)', async () => {
    // The close x is the first focusable in DOM order; the trap's plain "first
    // focusable" sent focus there, so Enter dismissed the dialog at once and
    // the focus ring pointed at "close". Focus must land on the content.
    // (The trap focuses on the next microtask, so let it run.)
    const body = createRawSnippet(() => ({
      render: () => `<button type="button" class="probe-ok">OK</button>`,
    }))
    const { destroy } = mountModal({ open: true, title: 'Edit row', children: body })
    try {
      flushSync()
      await new Promise((r) => setTimeout(r, 0))
      const active = document.activeElement as HTMLElement
      expect(active?.classList.contains('sv-modal__x')).toBe(false)
      expect(active?.classList.contains('probe-ok')).toBe(true)
    } finally { destroy() }
  })

  it('falls back to the panel, still not the Close (x), when the body has no control', async () => {
    const { destroy } = mountModal({ open: true, title: 'Empty' })
    try {
      flushSync()
      await new Promise((r) => setTimeout(r, 0))
      const active = document.activeElement as HTMLElement
      expect(active?.classList.contains('sv-modal__x')).toBe(false)
      expect(active?.classList.contains('sv-modal')).toBe(true)
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
