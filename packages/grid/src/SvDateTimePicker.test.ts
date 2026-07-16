/**
 * Component tests for SvDateTimePicker: the masked input round-trips through the
 * token engine, the dropdown portals to <body> with DATE/TIME tabs, and picking
 * a day preserves the time (and vice versa).
 */
import { describe, expect, it, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvDateTimePicker from './SvDateTimePicker.svelte'

function mountDtp(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvDateTimePicker, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

// The panel portals to <body>, so query the document, not the mount target.
const panel = () => document.querySelector<HTMLElement>('.sv-dtp__panel')

afterEach(() => {
  document.querySelectorAll('.sv-dtp__panel').forEach((n) => n.remove())
})

describe('SvDateTimePicker input', () => {
  it('formats the initial value with the mask', () => {
    const { target, destroy } = mountDtp({ value: new Date(2026, 5, 7, 9, 4), formatString: 'yyyy-MM-dd HH:mm' })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dtp__input')!
      expect(input.value).toBe('2026-06-07 09:04')
    } finally { destroy() }
  })

  it('parses typed text on blur and emits a Date', () => {
    let got: Date | null | undefined
    const { target, destroy } = mountDtp({
      value: null, formatString: 'yyyy-MM-dd HH:mm', onChange: (d: Date | null) => (got = d),
    })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dtp__input')!
      input.value = '2026-06-07 14:30'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new FocusEvent('blur'))
      flushSync()
      expect(got).toBeInstanceOf(Date)
      expect(got!.getFullYear()).toBe(2026)
      expect(got!.getHours()).toBe(14)
      expect(got!.getMinutes()).toBe(30)
    } finally { destroy() }
  })

  it('reverts invalid text back to the last good value', () => {
    const { target, destroy } = mountDtp({ value: new Date(2026, 5, 7, 9, 0), formatString: 'yyyy-MM-dd HH:mm' })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dtp__input')!
      input.value = 'garbage'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new FocusEvent('blur'))
      flushSync()
      expect(input.value).toBe('2026-06-07 09:00')
    } finally { destroy() }
  })

  it('clamps to max', () => {
    let got: Date | null | undefined
    const { target, destroy } = mountDtp({
      value: null, formatString: 'yyyy-MM-dd HH:mm', max: new Date(2026, 5, 10, 0, 0),
      onChange: (d: Date | null) => (got = d),
    })
    try {
      const input = target.querySelector<HTMLInputElement>('.sv-dtp__input')!
      input.value = '2026-12-31 23:59'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new FocusEvent('blur'))
      flushSync()
      expect(got!.getTime()).toBe(new Date(2026, 5, 10, 0, 0).getTime())
    } finally { destroy() }
  })

  it('clear button nulls a nullable value', () => {
    let got: Date | null | undefined = new Date()
    const { target, destroy } = mountDtp({
      value: new Date(2026, 5, 7), nullable: true, onChange: (d: Date | null) => (got = d),
    })
    try {
      target.querySelector<HTMLButtonElement>('.sv-dtp__clear')!.click()
      flushSync()
      expect(got).toBeNull()
    } finally { destroy() }
  })
})

describe('SvDateTimePicker dropdown', () => {
  it('opens a portalled panel with DATE and TIME tabs', () => {
    const { target, destroy } = mountDtp({ value: new Date(2026, 5, 7, 9, 0) })
    try {
      target.querySelector<HTMLButtonElement>('.sv-dtp__toggle')!.click()
      flushSync()
      expect(panel()).not.toBeNull()
      const tabs = panel()!.querySelectorAll('[role="tab"]')
      expect(tabs.length).toBe(2)
      expect(tabs[0]!.textContent).toBe('DATE')
      expect(tabs[1]!.textContent).toBe('TIME')
    } finally { destroy() }
  })

  it('picking a calendar day preserves the time', () => {
    let got: Date | null | undefined
    const { target, destroy } = mountDtp({
      value: new Date(2026, 5, 7, 9, 45), onChange: (d: Date | null) => (got = d),
    })
    try {
      target.querySelector<HTMLButtonElement>('.sv-dtp__toggle')!.click()
      flushSync()
      const day20 = Array.from(panel()!.querySelectorAll<HTMLButtonElement>('.sv-cal__day')).find(
        (b) => b.textContent?.trim() === '20' && !b.classList.contains('is-outside'),
      )!
      day20.click()
      flushSync()
      expect(got!.getDate()).toBe(20)
      expect(got!.getHours()).toBe(9) // time preserved
      expect(got!.getMinutes()).toBe(45)
    } finally { destroy() }
  })

  it('honors dropDownDisplayMode=calendar (no tabs, calendar only)', () => {
    const { target, destroy } = mountDtp({ value: new Date(2026, 5, 7), dropDownDisplayMode: 'calendar' })
    try {
      target.querySelector<HTMLButtonElement>('.sv-dtp__toggle')!.click()
      flushSync()
      expect(panel()!.querySelectorAll('[role="tab"]').length).toBe(0)
      expect(panel()!.querySelector('.sv-cal')).not.toBeNull()
      expect(panel()!.querySelector('.sv-tp')).toBeNull()
    } finally { destroy() }
  })
})
