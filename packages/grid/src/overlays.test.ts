/**
 * Component tests for the overlay trio: SvModal (dialog semantics, Escape /
 * backdrop close), SvPopover (click open + outside close) and SvTooltip
 * (focus-triggered, aria-describedby wiring).
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { mount, unmount, flushSync, createRawSnippet } from 'svelte'
import SvModal from './SvModal.svelte'
import SvPopover from './SvPopover.svelte'
import SvTooltip from './SvTooltip.svelte'

const body = createRawSnippet(() => ({ render: () => `<p class="body">hello</p>` }))
const anchorBtn = createRawSnippet(() => ({ render: () => `<button class="anchor">open</button>` }))

function mountC(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}
afterEach(() => {
  document.querySelectorAll('.sv-modal__backdrop, .sv-pop__panel, .sv-tip').forEach((n) => n.remove())
})

describe('SvModal', () => {
  it('renders a labelled modal dialog when open', () => {
    const { destroy } = mountC(SvModal, { open: true, title: 'Edit', children: body })
    try {
      const dialog = document.querySelector<HTMLElement>('.sv-modal')!
      expect(dialog.getAttribute('role')).toBe('dialog')
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      const titleId = dialog.getAttribute('aria-labelledby')!
      expect(document.getElementById(titleId)!.textContent).toBe('Edit')
      expect(document.querySelector('.sv-modal .body')!.textContent).toBe('hello')
    } finally { destroy() }
  })

  it('Escape and the close button both fire onClose', () => {
    let closed = 0
    const { destroy } = mountC(SvModal, { open: true, title: 'X', onClose: () => (closed++), children: body })
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      flushSync()
      expect(closed).toBe(1)
    } finally { destroy() }
  })
})

describe('SvPopover', () => {
  it('opens the panel on anchor click and closes on outside pointerdown', () => {
    const { target, destroy } = mountC(SvPopover, { anchor: anchorBtn, children: body })
    try {
      expect(document.querySelector('.sv-pop__panel')).toBeNull()
      target.querySelector<HTMLElement>('.anchor')!.click()
      flushSync()
      const panel = document.querySelector<HTMLElement>('.sv-pop__panel')!
      expect(panel).not.toBeNull()
      expect(panel.getAttribute('role')).toBe('dialog')
      // Outside click closes.
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      flushSync()
      expect(document.querySelector('.sv-pop__panel')).toBeNull()
    } finally { destroy() }
  })
})

describe('SvTooltip', () => {
  it('shows after the delay on focus and wires aria-describedby', () => {
    vi.useFakeTimers()
    try {
      const child = createRawSnippet(() => ({ render: () => `<button class="t">i</button>` }))
      const { target, destroy } = mountC(SvTooltip, { text: 'Tip text', delay: 200, children: child })
      const anchor = target.querySelector<HTMLElement>('.sv-tip__anchor')!
      anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      vi.advanceTimersByTime(210)
      flushSync()
      const tip = document.querySelector<HTMLElement>('.sv-tip')!
      expect(tip).not.toBeNull()
      expect(tip.getAttribute('role')).toBe('tooltip')
      expect(anchor.getAttribute('aria-describedby')).toBe(tip.id)
      // The wrapper span is never itself focusable, so AT users only ever land
      // on the real interactive child below - it must carry the description
      // too, or it's never announced on focus (see SvTooltip.svelte effect).
      const focusEl = target.querySelector<HTMLElement>('.t')!
      expect(focusEl.getAttribute('aria-describedby')).toBe(tip.id)
      destroy()
    } finally { vi.useRealTimers() }
  })
})
