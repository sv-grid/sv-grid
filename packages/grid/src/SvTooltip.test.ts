/**
 * Component tests for SvTooltip, exercising the shared createTooltip core: it
 * opens after the show delay on hover, hides on Escape, respects `disabled`, and
 * wires aria-describedby onto the focusable child while open.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync, createRawSnippet } from 'svelte'
import SvTooltip from './SvTooltip.svelte'

const child = createRawSnippet(() => ({ render: () => `<button class="btn">Del</button>` }))

function mountTip(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvTooltip, { target, props: { children: child, ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}
const tip = () => document.body.querySelector<HTMLElement>('.sv-tip')

describe('SvTooltip', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.querySelectorAll('.sv-tip').forEach((n) => n.remove())
  })

  it('shows after the delay on pointerenter and hides on Escape', () => {
    const { target, destroy } = mountTip({ text: 'Delete row', delay: 300 })
    try {
      const anchor = target.querySelector<HTMLElement>('.sv-tip__anchor')!
      expect(tip()).toBeNull()
      anchor.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
      // Nothing yet - still within the delay window.
      flushSync()
      expect(tip()).toBeNull()
      vi.advanceTimersByTime(300)
      flushSync()
      const el = tip()!
      expect(el).not.toBeNull()
      expect(el.getAttribute('role')).toBe('tooltip')
      expect(el.textContent).toContain('Delete row')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      flushSync()
      expect(tip()).toBeNull()
    } finally { destroy() }
  })

  it('does not show while disabled', () => {
    const { target, destroy } = mountTip({ text: 'x', disabled: true })
    try {
      target.querySelector<HTMLElement>('.sv-tip__anchor')!
        .dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
      vi.advanceTimersByTime(500)
      flushSync()
      expect(tip()).toBeNull()
    } finally { destroy() }
  })

  it('wires aria-describedby onto the focusable child while open', () => {
    const { target, destroy } = mountTip({ text: 'Delete row', delay: 100 })
    try {
      target.querySelector<HTMLElement>('.sv-tip__anchor')!
        .dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
      vi.advanceTimersByTime(100)
      flushSync()
      const btn = target.querySelector<HTMLElement>('.btn')!
      const describedby = btn.getAttribute('aria-describedby')
      expect(describedby).toBeTruthy()
      expect(document.getElementById(describedby!)?.getAttribute('role')).toBe('tooltip')
    } finally { destroy() }
  })
})
