/**
 * Component tests for SvProgress + SvCircularProgress: progressbar ARIA,
 * determinate fill width / ring offset, and indeterminate (no valuenow).
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvProgress from './SvProgress.svelte'
import SvCircularProgress from './SvCircularProgress.svelte'

function mountC(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvProgress', () => {
  it('exposes progressbar ARIA + fill width for a determinate value', () => {
    const { target, destroy } = mountC(SvProgress, { value: 40, max: 200, showLabel: true })
    try {
      const bar = target.querySelector<HTMLElement>('[role="progressbar"]')!
      expect(bar.getAttribute('aria-valuemin')).toBe('0')
      expect(bar.getAttribute('aria-valuemax')).toBe('200')
      expect(bar.getAttribute('aria-valuenow')).toBe('40')
      expect(target.querySelector<HTMLElement>('.sv-prog__fill')!.style.width).toBe('20%')
      expect(target.querySelector('.sv-prog__label')!.textContent).toBe('20%')
    } finally { destroy() }
  })

  it('indeterminate drops valuenow and animates', () => {
    const { target, destroy } = mountC(SvProgress, { indeterminate: true })
    try {
      const bar = target.querySelector<HTMLElement>('[role="progressbar"]')!
      expect(bar.getAttribute('aria-valuenow')).toBeNull()
      expect(target.querySelector('.sv-prog__fill.is-indeterminate')).not.toBeNull()
    } finally { destroy() }
  })
})

describe('SvCircularProgress', () => {
  it('sets the ring dashoffset from the value', () => {
    const { target, destroy } = mountC(SvCircularProgress, { value: 75, size: 48, thickness: 4, showLabel: true })
    try {
      const bar = target.querySelector<HTMLElement>('[role="progressbar"]')!
      expect(bar.getAttribute('aria-valuenow')).toBe('75')
      const arc = target.querySelector<SVGCircleElement>('.sv-circ__arc')!
      const circ = 2 * Math.PI * ((48 - 4) / 2)
      expect(Number(arc.getAttribute('stroke-dasharray'))).toBeCloseTo(circ, 3)
      // 75% -> 25% of the circumference remains as offset.
      expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(circ * 0.25, 3)
      expect(target.querySelector('.sv-circ__label')!.textContent).toBe('75%')
    } finally { destroy() }
  })
})
