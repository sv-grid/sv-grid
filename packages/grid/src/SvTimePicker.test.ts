/**
 * Component tests for SvTimePicker. jsdom lacks real SVG layout, so pointer-drag
 * geometry is exercised lightly; the header/segment/AM-PM/keyboard logic (where
 * the value math lives) is covered directly.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvTimePicker from './SvTimePicker.svelte'

function mountTp(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvTimePicker, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const segs = (t: HTMLElement) => t.querySelectorAll<HTMLButtonElement>('.sv-tp__seg')

describe('SvTimePicker render', () => {
  it('shows the seeded time (24h)', () => {
    const { target, destroy } = mountTp({ value: '14:30' })
    try {
      expect(segs(target)[0]!.textContent!.trim()).toBe('14')
      expect(segs(target)[1]!.textContent!.trim()).toBe('30')
      expect(target.querySelector('.sv-tp__ampm')).toBeNull() // no AM/PM in 24h
    } finally { destroy() }
  })

  it('shows 12-hour display with AM/PM', () => {
    const { target, destroy } = mountTp({ value: '14:30', format: '12-hour' })
    try {
      expect(segs(target)[0]!.textContent!.trim()).toBe('02') // 14 -> 2 PM
      const ampm = target.querySelectorAll<HTMLButtonElement>('.sv-tp__ampm button')
      expect(ampm[1]!.classList.contains('is-active')).toBe(true) // PM active
    } finally { destroy() }
  })

  it('renders 24 hour ticks (two rings) in 24h and 12 in 12h', () => {
    const a = mountTp({ value: '10:00' })
    try {
      expect(a.target.querySelectorAll('.sv-tp__num').length).toBe(24)
    } finally { a.destroy() }
    const b = mountTp({ value: '10:00', format: '12-hour' })
    try {
      expect(b.target.querySelectorAll('.sv-tp__num').length).toBe(12)
    } finally { b.destroy() }
  })
})

describe('SvTimePicker interaction', () => {
  it('AM/PM toggle shifts the hour by 12 and emits', () => {
    let got: Date | null = null
    const { target, destroy } = mountTp({ value: '02:15', format: '12-hour', onChange: (d: Date) => (got = d) })
    try {
      const pm = target.querySelectorAll<HTMLButtonElement>('.sv-tp__ampm button')[1]!
      pm.click()
      flushSync()
      expect(got).not.toBeNull()
      expect((got as unknown as Date).getHours()).toBe(14) // 2 AM -> 2 PM
      expect((got as unknown as Date).getMinutes()).toBe(15)
    } finally { destroy() }
  })

  it('keyboard bumps the selected field', () => {
    let got: Date | null = null
    const { target, destroy } = mountTp({ value: '10:00', selection: 'minute', minuteInterval: 15, onChange: (d: Date) => (got = d) })
    try {
      const dial = target.querySelector<SVGSVGElement>('.sv-tp__dial')!
      dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
      flushSync()
      expect((got as unknown as Date).getMinutes()).toBe(15) // +interval
    } finally { destroy() }
  })

  it('clicking the minute segment switches the active dial', () => {
    const { target, destroy } = mountTp({ value: '10:00' })
    try {
      segs(target)[1]!.click()
      flushSync()
      expect(segs(target)[1]!.classList.contains('is-active')).toBe(true)
      // minute dial shows 00,05,...,55 (12 labels)
      expect(target.querySelectorAll('.sv-tp__num').length).toBe(12)
    } finally { destroy() }
  })

  it('Now sets the current time', () => {
    let got: Date | null = null
    const { target, destroy } = mountTp({ value: '00:00', footer: true, onChange: (d: Date) => (got = d) })
    try {
      target.querySelector<HTMLButtonElement>('.sv-tp__now')!.click()
      flushSync()
      expect(got).not.toBeNull()
      const now = new Date()
      expect((got as unknown as Date).getHours()).toBe(now.getHours())
    } finally { destroy() }
  })
})
