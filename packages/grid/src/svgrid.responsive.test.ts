/**
 * Responsive (narrow-container) mode: below the breakpoint the grid un-pins
 * columns, drops `hideBelow` columns, and marks the scroll container.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGrid from './SvGrid.svelte'

afterEach(() => { document.body.innerHTML = '' })

/** Force a narrow measured width so `viewportWidth` reads < breakpoint. */
function withWidth(px: number, fn: () => void) {
  const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => px })
  try { fn() } finally {
    if (desc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', desc)
    else delete (HTMLElement.prototype as any).clientWidth
  }
}

const data = [{ id: 1, a: 'x', b: 'y', c: 'z' }]
const columns = [
  { field: 'a', header: 'A', width: 120 },
  { field: 'b', header: 'B', width: 120 },
  { field: 'c', header: 'C', width: 120, hideBelow: 500 },
]

function render(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid as any, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvGrid responsive mode', () => {
  it('un-pins columns, hides hideBelow columns and marks the container when narrow', () => {
    withWidth(400, () => {
      const { target, destroy } = render({ data, columns, initialColumnPinning: { left: ['a'] }, responsive: true, containerHeight: 300 })
      try {
        const container = target.querySelector('.sv-grid-container')!
        expect(container.classList.contains('sv-grid-narrow')).toBe(true)
        // pinning is suspended -> no sticky pinned cells
        expect(target.querySelectorAll('[data-pinned]')).toHaveLength(0)
        // column c (hideBelow 500, width 400) is dropped; a + b stay
        expect(target.querySelector('[data-col-id="a"]')).not.toBeNull()
        expect(target.querySelector('[data-col-id="c"]')).toBeNull()
      } finally { destroy() }
    })
  })

  it('keeps pinning + all columns on a wide container', () => {
    withWidth(1000, () => {
      const { target, destroy } = render({ data, columns, initialColumnPinning: { left: ['a'] }, responsive: true, containerHeight: 300 })
      try {
        expect(target.querySelector('.sv-grid-container')!.classList.contains('sv-grid-narrow')).toBe(false)
        expect(target.querySelectorAll('[data-pinned]').length).toBeGreaterThan(0) // 'a' still pinned
        expect(target.querySelector('[data-col-id="c"]')).not.toBeNull() // 500 < 1000 -> shown
      } finally { destroy() }
    })
  })

  it('does nothing without the responsive prop', () => {
    withWidth(400, () => {
      const { target, destroy } = render({ data, columns, initialColumnPinning: { left: ['a'] }, containerHeight: 300 })
      try {
        expect(target.querySelector('.sv-grid-container')!.classList.contains('sv-grid-narrow')).toBe(false)
        expect(target.querySelectorAll('[data-pinned]').length).toBeGreaterThan(0)
      } finally { destroy() }
    })
  })
})
