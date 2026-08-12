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

  it('clicking the dismiss (x) button removes the toast', () => {
    const { destroy } = mountToaster()
    try {
      toast('Close me', { duration: 0 })
      flushSync()
      const x = document.body.querySelector<HTMLButtonElement>('.sv-toast__x')!
      expect(x).not.toBeNull()
      x.click()
      flushSync()
      expect(toastStore.toasts).toHaveLength(0)
      expect(toastEl()).toBeNull()
    } finally { destroy() }
  })

  it('a press that starts on the dismiss button does not begin a swipe', () => {
    // The swipe handler must ignore presses on the toast's own controls,
    // otherwise pointer-capture on the toast swallows the button's click.
    const { destroy } = mountToaster()
    try {
      toast('Keep me', { duration: 0 })
      flushSync()
      const el = toastEl()!
      const x = el.querySelector<HTMLButtonElement>('.sv-toast__x')!
      x.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, button: 0 }))
      el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 240 })) // dx 140 > 60
      el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 240 }))
      flushSync()
      // No swipe was started, so the toast survives (the click path owns dismiss).
      expect(toastStore.toasts).toHaveLength(1)
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
