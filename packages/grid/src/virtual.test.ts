/**
 * Tests for the fixed-row windowing helper and SvListBox `virtual` mode: a huge
 * option set renders only a small window (plus spacer rows), and itemTemplate
 * customizes the row.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync, createRawSnippet } from 'svelte'
import SvListBox from './SvListBox.svelte'
import { virtualRange, scrollToIndex } from './virtual'

describe('virtualRange', () => {
  it('returns the visible window + spacer heights for a fixed-row list', () => {
    const r = virtualRange({ scrollTop: 0, viewportHeight: 320, rowHeight: 32, count: 1000, overscan: 2 })
    expect(r.start).toBe(0)
    expect(r.totalHeight).toBe(32000)
    expect(r.padTop).toBe(0)
    // ~10 visible + 2 overscan.
    expect(r.end).toBeLessThanOrEqual(14)
    expect(r.padBottom).toBe((1000 - r.end) * 32)
  })
  it('scrolls the window when scrolled down', () => {
    const r = virtualRange({ scrollTop: 3200, viewportHeight: 320, rowHeight: 32, count: 1000, overscan: 2 })
    expect(r.start).toBe(98) // floor(3200/32)=100, minus overscan 2
    expect(r.padTop).toBe(98 * 32)
  })
  it('handles empty + zero-height gracefully', () => {
    expect(virtualRange({ scrollTop: 0, viewportHeight: 100, rowHeight: 32, count: 0 })).toMatchObject({ start: 0, end: 0, totalHeight: 0 })
    expect(virtualRange({ scrollTop: 0, viewportHeight: 100, rowHeight: 0, count: 5 }).totalHeight).toBe(0)
  })
})

describe('scrollToIndex', () => {
  it('scrolls up to an item above and down to an item below the viewport', () => {
    expect(scrollToIndex(2, 320, 320, 32)).toBe(64)          // item 2 above -> its top
    expect(scrollToIndex(20, 0, 320, 32)).toBe(20 * 32 + 32 - 320) // item 20 below -> bottom-align
    expect(scrollToIndex(5, 100, 320, 32)).toBe(100)         // already visible -> unchanged
  })
})

describe('SvListBox virtual', () => {
  it('renders only a small window of a huge list', () => {
    const options = Array.from({ length: 5000 }, (_, i) => ({ value: i, label: `Item ${i}` }))
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvListBox, { target, props: { options, virtual: true } as any })
    flushSync()
    try {
      const rendered = target.querySelectorAll('.sv-listbox__opt').length
      expect(rendered).toBeGreaterThan(0)
      expect(rendered).toBeLessThan(60) // nowhere near 5000
      // Virtual mode is a JS-driven scroller: one clipped viewport holds the
      // windowed rows (moved by `scrollOffset`, not native scroll) plus a custom
      // scrollbar - so there is no native async-scroll gap to flash blank.
      expect(target.querySelector('.sv-listbox__vp')).not.toBeNull()
      expect(target.querySelector('.sv-listbox__sb')).not.toBeNull()
    } finally { unmount(app); target.remove() }
  })

  it('windows a GROUPED list too (group headings render inside the window)', () => {
    const roles = ['Eng', 'Design', 'Ops']
    const options = Array.from({ length: 3000 }, (_, i) => ({ value: i, label: `User ${i}`, group: roles[i % 3] }))
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvListBox, { target, props: { options, virtual: true } as any })
    flushSync()
    try {
      const rendered = target.querySelectorAll('.sv-listbox__opt').length
      expect(rendered).toBeGreaterThan(0)
      expect(rendered).toBeLessThan(60) // grouped list is windowed, not fully rendered
      expect(target.querySelector('.sv-listbox__vp')).not.toBeNull()
    } finally { unmount(app); target.remove() }
  })

  it('renders a custom itemTemplate per option', () => {
    const options = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }]
    const itemTemplate = createRawSnippet((opt: () => { label: string }) => ({
      render: () => `<span class="tpl">${opt().label.toUpperCase()}</span>`,
    }))
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvListBox, { target, props: { options, itemTemplate } as any })
    flushSync()
    try {
      const tpls = [...target.querySelectorAll('.tpl')].map((n) => n.textContent)
      expect(tpls).toEqual(['APPLE', 'BANANA'])
    } finally { unmount(app); target.remove() }
  })
})
