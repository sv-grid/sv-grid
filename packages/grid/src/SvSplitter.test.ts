/**
 * Component tests for SvSplitter: the separator carries WAI-ARIA separator
 * semantics, keyboard resize clamps to [min, max], and RTL flips the horizontal
 * arrow direction.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSplitter from './SvSplitter.svelte'

function mountSp(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvSplitter, { target, props: props as any })
  flushSync()
  const sep = target.querySelector<HTMLElement>('.sv-split__sep')!
  return { target, sep, destroy: () => { unmount(app); target.remove() } }
}
const key = (sep: HTMLElement, k: string) => sep.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))

describe('SvSplitter', () => {
  it('exposes separator semantics with valuemin/max/now', () => {
    const { sep, destroy } = mountSp({ fraction: 0.5, min: 0.2, max: 0.8 })
    try {
      expect(sep.getAttribute('role')).toBe('separator')
      // Horizontal split -> a vertical separator line.
      expect(sep.getAttribute('aria-orientation')).toBe('vertical')
      expect(sep.getAttribute('aria-valuemin')).toBe('20')
      expect(sep.getAttribute('aria-valuemax')).toBe('80')
      expect(sep.getAttribute('aria-valuenow')).toBe('50')
      expect(sep.tabIndex).toBe(0)
    } finally { destroy() }
  })

  it('ArrowRight grows the first pane; Home/End jump to the bounds', () => {
    let got: number | undefined
    const { sep, destroy } = mountSp({ fraction: 0.5, step: 0.1, min: 0.2, max: 0.8, onChange: (f: number) => (got = f) })
    try {
      key(sep, 'ArrowRight'); flushSync()
      expect(got).toBeCloseTo(0.6, 5)
      key(sep, 'End'); flushSync()
      expect(got).toBeCloseTo(0.8, 5)
      key(sep, 'Home'); flushSync()
      expect(got).toBeCloseTo(0.2, 5)
    } finally { destroy() }
  })

  it('RTL flips the horizontal arrow direction', () => {
    let got: number | undefined
    const { sep, destroy } = mountSp({ fraction: 0.5, step: 0.1, dir: 'rtl', onChange: (f: number) => (got = f) })
    try {
      key(sep, 'ArrowRight'); flushSync()
      expect(got).toBeCloseTo(0.4, 5) // Right shrinks the first (right-anchored) pane under RTL
    } finally { destroy() }
  })
})
