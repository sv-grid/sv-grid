/**
 * SvPhoneInput follows its bound value when the app clears it: a form reset
 * sets value to '' and the number on screen has to go with it. The sync used
 * to react only to values that start with a dial code, so '' left the old
 * number showing.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvPhoneInput from './SvPhoneInput.svelte'

describe('SvPhoneInput clears from outside', () => {
  it('empties the number when the bound value is set to an empty string', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const props = $state({ value: '+13125550148' })
    const app = mount(SvPhoneInput, { target, props })
    flushSync()
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-phone__number')!
      expect(input.value).not.toBe('')
      props.value = ''
      flushSync()
      expect(input.value).toBe('')
    } finally {
      unmount(app)
      target.remove()
    }
  })
})
