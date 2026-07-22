/**
 * Component tests for SvToaster: renders the queue, and swipe-to-dismiss.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvToaster from './SvToaster.svelte'
import { toast, clearToasts, toastStore } from './toast-store.svelte'

function mountToaster() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvToaster, { target, props: {} })
  flushSync()
  return { destroy: () => { unmount(app); target.remove() } }
}

const toastEl = () => document.body.querySelector<HTMLElement>('.sv-toast')

afterEach(() => {
  clearToasts()
  document.body.innerHTML = ''
})

describe('SvToaster', () => {
  it('renders a queued toast', () => {
    const { destroy } = mountToaster()
    try {
      toast('Saved', { duration: 0 })
      flushSync()
      expect(toastEl()).not.toBeNull()
      expect(toastEl()!.textContent).toContain('Saved')
    } finally { destroy() }
  })

  it('swiping a toast past the threshold dismisses it', () => {
    const { destroy } = mountToaster()
    try {
      toast('Swipe me', { duration: 0 })
      flushSync()
      const el = toastEl()!
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }))
      el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 220 })) // dx 120 > 60
      el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 220 }))
      flushSync()
      expect(toastStore.toasts).toHaveLength(0)
      expect(toastEl()).toBeNull()
    } finally { destroy() }
  })

  it('a small swipe does not dismiss', () => {
    const { destroy } = mountToaster()
    try {
      toast('Keep me', { duration: 0 })
      flushSync()
      const el = toastEl()!
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }))
      el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 130 })) // dx 30 < 60
      el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 130 }))
      flushSync()
      expect(toastStore.toasts).toHaveLength(1)
    } finally { destroy() }
  })
})
