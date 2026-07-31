/**
 * Component tests for SvForm, exercising the shared createForm core: required +
 * custom validation block submit and surface errors, a valid form submits its
 * values, and onChange fires on edits.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvForm from './SvForm.svelte'

function mountForm(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvForm, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}
const submitForm = (target: HTMLElement) => {
  target.querySelector('form.sv-form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  flushSync()
}
const setInput = (target: HTMLElement, id: string, value: string) => {
  const el = target.querySelector<HTMLInputElement>(`#${id}`)!
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  flushSync()
}

const fields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'email', label: 'Email', type: 'email' as const,
    validate: (v: any) => (v && !String(v).includes('@') ? 'Invalid email' : null) },
]

describe('SvForm', () => {
  it('blocks submit and shows an error when a required field is empty', () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields, onSubmit })
    try {
      submitForm(target)
      expect(onSubmit).not.toHaveBeenCalled()
      const err = target.querySelector('.sv-form__error[role="alert"]')
      expect(err?.textContent).toContain('Name is required')
    } finally { destroy() }
  })

  it('submits the collected values when valid', () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields, onSubmit })
    try {
      setInput(target, 'f-name', 'Ada')
      submitForm(target)
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ name: 'Ada' })
    } finally { destroy() }
  })

  it('runs a custom validator', () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields, onSubmit })
    try {
      setInput(target, 'f-name', 'Ada')
      setInput(target, 'f-email', 'nope')
      submitForm(target)
      expect(onSubmit).not.toHaveBeenCalled()
      expect([...target.querySelectorAll('.sv-form__error')].some((e) => e.textContent?.includes('Invalid email'))).toBe(true)
    } finally { destroy() }
  })

  it('fires onChange as fields are edited', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountForm({ fields, onChange })
    try {
      setInput(target, 'f-name', 'A')
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ name: 'A' })
    } finally { destroy() }
  })
})
