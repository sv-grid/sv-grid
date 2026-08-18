/**
 * Component tests for SvButtonGroup: single-select radio semantics, multi-select
 * toggle set, roving tabindex, and the shared editor contract wiring.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvButtonGroup from './SvButtonGroup.svelte'

function mountBg(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvButtonGroup, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const items = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

describe('SvButtonGroup', () => {
  it('single mode uses radiogroup/radio semantics and checks the value', () => {
    const { target, destroy } = mountBg({ items, value: 'week', mode: 'single' })
    try {
      const group = target.querySelector<HTMLElement>('.sv-bg')!
      expect(group.getAttribute('role')).toBe('radiogroup')
      const btns = [...target.querySelectorAll<HTMLButtonElement>('.sv-bg__btn')]
      expect(btns.map((b) => b.getAttribute('role'))).toEqual(['radio', 'radio', 'radio'])
      expect(btns[1]!.getAttribute('aria-checked')).toBe('true')
      // Roving tabindex: only the checked/active button is tabbable.
      expect(btns[1]!.tabIndex).toBe(0)
      expect(btns[0]!.tabIndex).toBe(-1)
    } finally { destroy() }
  })

  it('single mode emits a scalar on click', () => {
    let got: unknown
    const { target, destroy } = mountBg({ items, value: 'day', mode: 'single', onChange: (v: unknown) => (got = v) })
    try {
      const btns = target.querySelectorAll<HTMLButtonElement>('.sv-bg__btn')
      btns[2]!.click()
      flushSync()
      expect(got).toBe('month')
    } finally { destroy() }
  })

  it('multiple mode toggles a set and uses aria-pressed', () => {
    let got: unknown
    const { target, destroy } = mountBg({ items, value: ['day'], mode: 'multiple', onChange: (v: unknown) => (got = v) })
    try {
      const group = target.querySelector<HTMLElement>('.sv-bg')!
      expect(group.getAttribute('role')).toBe('group')
      const btns = target.querySelectorAll<HTMLButtonElement>('.sv-bg__btn')
      expect(btns[0]!.getAttribute('aria-pressed')).toBe('true')
      btns[1]!.click()
      flushSync()
      expect(got).toEqual(['day', 'week'])
    } finally { destroy() }
  })

  it('wires label + aria-invalid via the editor contract', () => {
    const { target, destroy } = mountBg({ items, value: null, mode: 'single', label: 'View', invalid: true, error: 'Pick one' })
    try {
      const group = target.querySelector<HTMLElement>('.sv-bg')!
      expect(group.getAttribute('aria-invalid')).toBe('true')
      expect(target.querySelector('.sv-field__label')!.textContent).toContain('View')
      expect(target.querySelector('.sv-field__error')!.textContent).toBe('Pick one')
    } finally { destroy() }
  })
})
