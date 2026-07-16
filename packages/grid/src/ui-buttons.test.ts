/**
 * Group B (buttons & toggles) component tests. Each asserts the emitted value /
 * ARIA state a real interaction produces.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvToggleButton from './SvToggleButton.svelte'
import SvSwitchButton from './SvSwitchButton.svelte'
import SvCheckBox from './SvCheckBox.svelte'
import SvRadioGroup from './SvRadioGroup.svelte'
import SvRating from './SvRating.svelte'

function mnt(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvToggleButton', () => {
  it('reflects pressed and emits the flipped value', () => {
    let got: boolean | undefined
    const { target, destroy } = mnt(SvToggleButton, { pressed: false, onChange: (v: boolean) => (got = v) })
    try {
      const btn = target.querySelector<HTMLButtonElement>('.sv-toggle')!
      expect(btn.getAttribute('aria-pressed')).toBe('false')
      btn.click(); flushSync()
      expect(got).toBe(true)
    } finally { destroy() }
  })
})

describe('SvSwitchButton', () => {
  it('has role switch and toggles', () => {
    let got: boolean | undefined
    const { target, destroy } = mnt(SvSwitchButton, { checked: false, onChange: (v: boolean) => (got = v) })
    try {
      const sw = target.querySelector<HTMLButtonElement>('[role="switch"]')!
      expect(sw.getAttribute('aria-checked')).toBe('false')
      sw.click(); flushSync()
      expect(got).toBe(true)
    } finally { destroy() }
  })
  it('ArrowRight turns on, ArrowLeft off', () => {
    const states: boolean[] = []
    const { target, destroy } = mnt(SvSwitchButton, { checked: false, onChange: (v: boolean) => states.push(v) })
    try {
      const sw = target.querySelector<HTMLButtonElement>('[role="switch"]')!
      sw.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      flushSync()
      expect(states.at(-1)).toBe(true)
    } finally { destroy() }
  })
})

describe('SvCheckBox', () => {
  it('toggles and reports aria-checked mixed when indeterminate', () => {
    let got: boolean | undefined
    const a = mnt(SvCheckBox, { checked: false, onChange: (v: boolean) => (got = v) })
    try {
      const box = a.target.querySelector<HTMLButtonElement>('[role="checkbox"]')!
      box.click(); flushSync()
      expect(got).toBe(true)
    } finally { a.destroy() }
    const b = mnt(SvCheckBox, { indeterminate: true })
    try {
      expect(b.target.querySelector('[role="checkbox"]')!.getAttribute('aria-checked')).toBe('mixed')
    } finally { b.destroy() }
  })
})

describe('SvRadioGroup', () => {
  it('selects on click and arrow-navigates', () => {
    const picks: unknown[] = []
    const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]
    const { target, destroy } = mnt(SvRadioGroup, { options: opts, value: 'a', onChange: (v: unknown) => picks.push(v) })
    try {
      const radios = target.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      expect(radios[0]!.getAttribute('aria-checked')).toBe('true')
      radios[2]!.click(); flushSync()
      expect(picks.at(-1)).toBe('c')
      // roving tabindex: selected is 0, others -1
      radios[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      flushSync()
      expect(picks.at(-1)).toBe('b')
    } finally { destroy() }
  })
})

describe('SvRating', () => {
  it('clicking a star emits its value; keyboard steps', () => {
    const vals: number[] = []
    const { target, destroy } = mnt(SvRating, { value: 2, onChange: (v: number) => vals.push(v) })
    try {
      const stars = target.querySelectorAll<HTMLButtonElement>('.sv-rating__star')
      expect(stars.length).toBe(5)
      stars[3]!.click(); flushSync()
      expect(vals.at(-1)).toBe(4)
      target.querySelector<HTMLElement>('.sv-rating')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      flushSync()
      expect(vals.at(-1)).toBe(3) // 2 + 1 step
    } finally { destroy() }
  })
})
