/**
 * Component tests for the Tier-1 text editors: SvTextInput, SvTextArea and
 * SvOtpInput - value emit, the commit/cancel interaction contract, and OTP
 * auto-advance / paste distribution.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvTextInput from './SvTextInput.svelte'
import SvTextArea from './SvTextArea.svelte'
import SvOtpInput from './SvOtpInput.svelte'
import SvDurationInput from './SvDurationInput.svelte'

function mountOn(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvTextInput', () => {
  it('emits onChange on input', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountOn(SvTextInput, { value: '', onChange })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-text__input')!
      input.value = 'hello'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      expect(onChange).toHaveBeenCalledWith('hello')
    } finally { destroy() }
  })

  it('Enter commits and Escape cancels', () => {
    const onCommit = vi.fn(), onCancel = vi.fn()
    const { target, destroy } = mountOn(SvTextInput, { value: 'abc', onCommit, onCancel })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-text__input')!
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(onCommit).toHaveBeenCalledWith('abc')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(onCancel).toHaveBeenCalled()
    } finally { destroy() }
  })

  it('clearable shows a clear button that empties the value', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountOn(SvTextInput, { value: 'x', clearable: true, onChange })
    try {
      const clear = target.querySelector<HTMLButtonElement>('.sv-text__clear')!
      expect(clear).not.toBeNull()
      clear.click()
      expect(onChange).toHaveBeenCalledWith('')
    } finally { destroy() }
  })
})

describe('SvTextArea', () => {
  it('Ctrl+Enter commits, Escape cancels, Enter alone does not commit', () => {
    const onCommit = vi.fn(), onCancel = vi.fn()
    const { target, destroy } = mountOn(SvTextArea, { value: 'note', onCommit, onCancel })
    try {
      const ta = target.querySelector<HTMLTextAreaElement>('.sv-ta__input')!
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(onCommit).not.toHaveBeenCalled()
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
      expect(onCommit).toHaveBeenCalledWith('note')
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(onCancel).toHaveBeenCalled()
    } finally { destroy() }
  })
})

describe('SvOtpInput', () => {
  it('renders one cell per length', () => {
    const { target, destroy } = mountOn(SvOtpInput, { length: 4 })
    try {
      expect(target.querySelectorAll('.sv-otp__cell')).toHaveLength(4)
    } finally { destroy() }
  })

  it('typing a digit emits onChange and advances focus', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountOn(SvOtpInput, { length: 4, value: '', onChange })
    try {
      const cells = target.querySelectorAll<HTMLInputElement>('.sv-otp__cell')
      cells[0]!.value = '7'
      cells[0]!.dispatchEvent(new Event('input', { bubbles: true }))
      expect(onChange).toHaveBeenCalledWith('7')
      expect(document.activeElement).toBe(cells[1])
    } finally { destroy() }
  })

  it('paste distributes across cells and fires onComplete when full', () => {
    const onChange = vi.fn(), onComplete = vi.fn()
    const { target, destroy } = mountOn(SvOtpInput, { length: 4, value: '', onChange, onComplete })
    try {
      const cells = target.querySelectorAll<HTMLInputElement>('.sv-otp__cell')
      const e = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(e, 'clipboardData', { value: { getData: () => '12ab34' } })
      cells[0]!.dispatchEvent(e)
      // numeric mode strips letters -> '1234'
      expect(onChange).toHaveBeenCalledWith('1234')
      expect(onComplete).toHaveBeenCalledWith('1234')
    } finally { destroy() }
  })
})

describe('SvDurationInput', () => {
  it('parses human input to minutes on blur', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountOn(SvDurationInput, { value: null, onChange })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dur__input')!
      input.dispatchEvent(new Event('focus', { bubbles: true }))
      input.value = '1h 30m'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('blur', { bubbles: true }))
      expect(onChange).toHaveBeenCalledWith(90)
    } finally { destroy() }
  })

  it('formats the external value as h:mm when unfocused', () => {
    const { target, destroy } = mountOn(SvDurationInput, { value: 125 })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dur__input')!
      expect(input.value).toBe('2:05')
    } finally { destroy() }
  })

  it('Enter commits the parsed value', () => {
    const onCommit = vi.fn()
    const { target, destroy } = mountOn(SvDurationInput, { value: null, onCommit })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dur__input')!
      input.dispatchEvent(new Event('focus', { bubbles: true }))
      input.value = '45m'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(onCommit).toHaveBeenCalledWith(45)
    } finally { destroy() }
  })
})
