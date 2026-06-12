/**
 * Tests for the unlicensed soft-gate watermark + console nudge.
 *   - The watermark reads "www.svgrid.com" and sits in the bottom-right of the
 *     grid root.
 *   - It fades out and is removed after 5 seconds.
 *   - The console nudge names the commercial license + sales contact.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emitUnlicensedNudge, dismissUnlicensedNudge } from './watermark'

const WATERMARK_ATTR = 'data-sv-grid-pro-watermark'

function makeGridRoot(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'sv-grid-root'
  document.body.appendChild(el)
  return el
}

function flushMicrotasks() {
  return Promise.resolve()
}

describe('unlicensed watermark', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    dismissUnlicensedNudge()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('attaches a "www.svgrid.com" watermark to the grid bottom-right', async () => {
    const grid = makeGridRoot()
    emitUnlicensedNudge()
    await flushMicrotasks()

    const mark = grid.querySelector(`[${WATERMARK_ATTR}]`) as HTMLAnchorElement | null
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe('www.svgrid.com')
    expect(mark!.href).toContain('svgrid.com')
    expect(mark!.style.position).toBe('absolute')
    expect(mark!.style.bottom).toBe('6px')
    expect(mark!.style.right).toBe('8px')
    // The grid gets a positioning context so the absolute watermark anchors.
    expect(grid.style.position).toBe('relative')
  })

  it('fades out and removes the watermark after ~5 seconds', async () => {
    const grid = makeGridRoot()
    emitUnlicensedNudge()
    await flushMicrotasks()

    const mark = grid.querySelector(`[${WATERMARK_ATTR}]`) as HTMLElement
    expect(mark.style.opacity).toBe('1')

    // After 5s the fade starts...
    vi.advanceTimersByTime(5000)
    expect(mark.style.opacity).toBe('0')

    // ...and after the fade transition the node is gone.
    vi.advanceTimersByTime(700)
    expect(grid.querySelector(`[${WATERMARK_ATTR}]`)).toBeNull()
  })

  it('does not re-add the watermark after it has faded out', async () => {
    const grid = makeGridRoot()
    emitUnlicensedNudge()
    await flushMicrotasks()
    vi.advanceTimersByTime(5700)
    expect(grid.querySelector(`[${WATERMARK_ATTR}]`)).toBeNull()

    // A later DOM mutation must not bring it back (grid is marked "nudged").
    document.body.appendChild(document.createElement('span'))
    await flushMicrotasks()
    expect(grid.querySelector(`[${WATERMARK_ATTR}]`)).toBeNull()
  })

  it('logs a one-time commercial-license console nudge', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      emitUnlicensedNudge()
      const msg = spy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(msg).toContain('Commercial version which requires a license')
      expect(msg).toContain('sales@jqwidgets.com')
      // One-time: a second call does not log again.
      const callsAfterFirst = spy.mock.calls.length
      emitUnlicensedNudge()
      expect(spy.mock.calls.length).toBe(callsAfterFirst)
    } finally {
      spy.mockRestore()
    }
  })
})
