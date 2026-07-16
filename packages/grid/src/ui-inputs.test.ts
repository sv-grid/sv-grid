/** Group C (text inputs) component tests. */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvNumberInput from './SvNumberInput.svelte'
import SvPasswordInput from './SvPasswordInput.svelte'
import SvMaskedInput from './SvMaskedInput.svelte'
import SvPhoneInput from './SvPhoneInput.svelte'

function mnt(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvNumberInput', () => {
  it('clamps to max on commit', () => {
    let got: number | null | undefined
    const { target, destroy } = mnt(SvNumberInput, { value: 5, min: 0, max: 10, step: 2, onChange: (v: number | null) => (got = v) })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-num__input')!
      input.dispatchEvent(new FocusEvent('focus'))
      input.value = '99'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new FocusEvent('blur'))
      flushSync()
      expect(got).toBe(10)
    } finally { destroy() }
  })
  it('ArrowDown steps down by step from the current value', () => {
    let got: number | null | undefined
    const { target, destroy } = mnt(SvNumberInput, { value: 8, min: 0, max: 10, step: 2, onChange: (v: number | null) => (got = v) })
    try {
      target.querySelector<HTMLInputElement>('.sv-num__input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      flushSync()
      expect(got).toBe(6)
    } finally { destroy() }
  })
})

describe('SvPasswordInput', () => {
  it('reveal toggle flips the input type', () => {
    const { target, destroy } = mnt(SvPasswordInput, { value: 'secret' })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-pw__input')!
      expect(input.type).toBe('password')
      target.querySelector<HTMLButtonElement>('.sv-pw__eye')!.click()
      flushSync()
      expect(target.querySelector<HTMLInputElement>('.sv-pw__input')!.type).toBe('text')
    } finally { destroy() }
  })
  it('computes a strength score', () => {
    const { target, destroy } = mnt(SvPasswordInput, { value: 'Abcdef1!', showStrength: true })
    try {
      expect(target.querySelector('.sv-pw__strength')!.textContent).toBe('Strong')
    } finally { destroy() }
  })
})

describe('SvMaskedInput', () => {
  it('formats input to the mask and reports raw', () => {
    let raw = ''
    let masked = ''
    const { target, destroy } = mnt(SvMaskedInput, {
      mask: '(###) ###-####',
      onChange: (m: string, r: string) => { masked = m; raw = r },
    })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-masked')!
      input.value = '1234567890'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(masked).toBe('(123) 456-7890')
      expect(raw).toBe('1234567890')
    } finally { destroy() }
  })
})

describe('SvPhoneInput', () => {
  it('emits E.164 with dial code and national digits', () => {
    let out = ''
    const { target, destroy } = mnt(SvPhoneInput, { country: 'US', onChange: (v: string) => (out = v) })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-phone__number')!
      input.value = '(415) 555-1234'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(out).toBe('+14155551234')
    } finally { destroy() }
  })
})
