/**
 * Component tests for SvDateRangeInput: the field renders the formatted range,
 * the two-month range calendar portals to <body>, picking a range emits
 * [start, end], and the shared editor contract (label / error) is wired.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvDateRangeInput from './SvDateRangeInput.svelte'

function mountDri(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvDateRangeInput, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

// The calendar panel portals to <body>, so query the document.
const panel = () => document.querySelector<HTMLElement>('.sv-dri__panel')

afterEach(() => {
  document.querySelectorAll('.sv-dri__panel').forEach((n) => n.remove())
})

describe('SvDateRangeInput', () => {
  it('formats the initial [start, end] range with the "to" separator', () => {
    const { target, destroy } = mountDri({
      value: [new Date(2026, 5, 1), new Date(2026, 5, 7)],
      formatString: 'yyyy-MM-dd',
    })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dri__input')!
      expect(input.value).toBe('2026-06-01 to 2026-06-07')
    } finally { destroy() }
  })

  it('shows the placeholder when empty and opens the calendar on click', () => {
    const { target, destroy } = mountDri({ value: null, placeholder: 'Pick a range' })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dri__input')!
      expect(input.value).toBe('')
      expect(input.placeholder).toBe('Pick a range')
      expect(panel()).toBeNull()
      input.click()
      flushSync()
      expect(panel()).not.toBeNull()
      // The portalled panel embeds a range-mode SvCalendar.
      expect(panel()!.querySelector('.sv-cal')).not.toBeNull()
    } finally { destroy() }
  })

  it('wires the shared editor contract (label + aria-invalid + error text)', () => {
    const { target, destroy } = mountDri({
      value: null, label: 'Period', required: true, invalid: true, error: 'Required',
    })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dri__input')!
      const labelEl = target.querySelector<HTMLLabelElement>('.sv-field__label')!
      expect(labelEl.textContent).toContain('Period')
      expect(labelEl.getAttribute('for')).toBe(input.id)
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(input.getAttribute('aria-required')).toBe('true')
      const err = target.querySelector<HTMLElement>('.sv-field__error')!
      expect(err.textContent).toBe('Required')
      expect(err.id).toBe(input.getAttribute('aria-describedby'))
    } finally { destroy() }
  })

  it('localizes the "to" separator via messages', () => {
    const { target, destroy } = mountDri({
      value: [new Date(2026, 5, 1), new Date(2026, 5, 7)],
      formatString: 'dd/MM/yyyy',
      messages: { to: 'au' },
    })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dri__input')!
      expect(input.value).toBe('01/06/2026 au 07/06/2026')
    } finally { destroy() }
  })
})
