/** Group E (slider + gauge) component tests. */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSlider from './SvSlider.svelte'
import SvGauge from './SvGauge.svelte'

function mnt(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvSlider', () => {
  it('single: arrow keys step within bounds', () => {
    let got: any
    const { target, destroy } = mnt(SvSlider, { value: 50, min: 0, max: 100, step: 5, onChange: (v: any) => (got = v) })
    try {
      const thumb = target.querySelector<HTMLElement>('[role="slider"]')!
      expect(thumb.getAttribute('aria-valuenow')).toBe('50')
      thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      flushSync()
      expect(got).toBe(55)
      thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
      flushSync()
      expect(got).toBe(0)
    } finally { destroy() }
  })
  it('range: two thumbs, low thumb capped at high value', () => {
    let got: any
    const { target, destroy } = mnt(SvSlider, { value: [20, 80], range: true, min: 0, max: 100, step: 10, onChange: (v: any) => (got = v) })
    try {
      const thumbs = target.querySelectorAll<HTMLElement>('[role="slider"]')
      expect(thumbs.length).toBe(2)
      thumbs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      flushSync()
      expect(got).toEqual([30, 80])
    } finally { destroy() }
  })
})

describe('SvGauge', () => {
  it('exposes a meter role with clamped value + label', () => {
    const { target, destroy } = mnt(SvGauge, { value: 150, min: 0, max: 100 })
    try {
      const meter = target.querySelector('[role="meter"]')!
      expect(meter.getAttribute('aria-valuenow')).toBe('100') // clamped to max
      expect(target.querySelector('.sv-gauge__label')!.textContent).toContain('100')
    } finally { destroy() }
  })
  it('renders one path per band when bands are given', () => {
    const { target, destroy } = mnt(SvGauge, {
      value: 50, bands: [{ from: 0, to: 50, color: '#16a34a' }, { from: 50, to: 100, color: '#dc2626' }],
    })
    try {
      // track + 2 bands = 3 paths, no value arc
      expect(target.querySelectorAll('path').length).toBe(3)
    } finally { destroy() }
  })
})
