/**
 * Component tests for SvCalendar. Mounts in jsdom and drives real DOM clicks /
 * keydowns, asserting the emitted selection + navigation. Discriminating: each
 * checks the actual selected value(s), not just that something rendered.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvCalendar from './SvCalendar.svelte'

type Mounted = { target: HTMLElement; destroy: () => void }

function mountCal(props: Record<string, unknown>): Mounted {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvCalendar, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

const dayButton = (target: HTMLElement, label: string) =>
  Array.from(target.querySelectorAll<HTMLButtonElement>('.sv-cal__day')).find(
    (b) => b.textContent?.trim() === label && !b.classList.contains('is-outside'),
  )

describe('SvCalendar render', () => {
  it('renders the seeded month title and a 6x7 grid', () => {
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15) })
    try {
      expect(target.querySelector('.sv-cal__title')?.textContent).toContain('2026')
      const days = target.querySelectorAll('.sv-cal__day')
      expect(days.length).toBe(42) // 6 weeks x 7
    } finally {
      destroy()
    }
  })

  it('renders bare by default, but wraps in SvField chrome when label/error given', () => {
    const bare = mountCal({ value: new Date(2026, 5, 15) })
    try {
      expect(bare.target.querySelector('.sv-field')).toBeNull() // bare
      expect(bare.target.querySelector('.sv-cal')).not.toBeNull()
    } finally { bare.destroy() }
    const chrome = mountCal({ value: new Date(2026, 5, 15), label: 'Start date', error: 'Required', required: true })
    try {
      expect(chrome.target.querySelector('.sv-field')).not.toBeNull()
      expect(chrome.target.querySelector('.sv-field__label')?.textContent).toContain('Start date')
      expect(chrome.target.querySelector('.sv-field__error')?.textContent).toContain('Required')
      expect(chrome.target.querySelector('.sv-cal.sv-cal--invalid')).toBeNull() // invalid not set
    } finally { chrome.destroy() }
  })

  it('marks the selected day', () => {
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15) })
    try {
      const sel = target.querySelector('.sv-cal__day.is-selected')
      expect(sel?.textContent?.trim()).toBe('15')
    } finally {
      destroy()
    }
  })

  it('shows week numbers when enabled', () => {
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15), weekNumbers: true, firstDayOfWeek: 1 })
    try {
      expect(target.querySelectorAll('.sv-cal__wk').length).toBe(6)
    } finally {
      destroy()
    }
  })
})

describe('SvCalendar selection', () => {
  it('emits the clicked day (mode one)', () => {
    let got: Date[] = []
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15), onChange: (d: Date[]) => (got = d) })
    try {
      dayButton(target, '20')!.click()
      flushSync()
      expect(got).toHaveLength(1)
      expect(got[0]!.getDate()).toBe(20)
      expect(got[0]!.getMonth()).toBe(5)
    } finally {
      destroy()
    }
  })

  it('range mode: two clicks emit the inclusive span', () => {
    let got: Date[] = []
    const { destroy } = mountCal({
      value: null,
      selectionMode: 'range',
      displayMode: 'month',
      onChange: (d: Date[]) => (got = d),
    })
    try {
      // Seed view to a known month by selecting from it.
      const cal = mountCal({ value: new Date(2026, 5, 1), selectionMode: 'range', onChange: (d: Date[]) => (got = d) })
      dayButton(cal.target, '3')!.click()
      flushSync()
      dayButton(cal.target, '6')!.click()
      flushSync()
      expect(got.map((d) => d.getDate())).toEqual([3, 4, 5, 6])
      cal.destroy()
    } finally {
      destroy()
    }
  })

  it('does not select a disabled (out-of-range) day', () => {
    let calls = 0
    const { target, destroy } = mountCal({
      value: new Date(2026, 5, 15),
      min: new Date(2026, 5, 10),
      onChange: () => (calls += 1),
    })
    try {
      const five = dayButton(target, '5')
      expect(five?.disabled).toBe(true)
      five?.click()
      flushSync()
      expect(calls).toBe(0)
    } finally {
      destroy()
    }
  })
})

describe('SvCalendar navigation', () => {
  it('prev/next steps the month', () => {
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15) })
    try {
      const [prev, , next] = target.querySelectorAll<HTMLButtonElement>('.sv-cal__nav, .sv-cal__title')
      // next button is the 2nd .sv-cal__nav; grab by aria-label
      target.querySelector<HTMLButtonElement>('[aria-label="Next"]')!.click()
      flushSync()
      expect(target.querySelector('.sv-cal__title')?.textContent?.toLowerCase()).toContain('july')
      target.querySelector<HTMLButtonElement>('[aria-label="Previous"]')!.click()
      target.querySelector<HTMLButtonElement>('[aria-label="Previous"]')!.click()
      flushSync()
      expect(target.querySelector('.sv-cal__title')?.textContent?.toLowerCase()).toContain('may')
      void prev; void next
    } finally {
      destroy()
    }
  })

  it('title drills month -> year -> decade', () => {
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15) })
    try {
      const title = () => target.querySelector<HTMLButtonElement>('.sv-cal__title')!
      title().click() // -> year
      flushSync()
      expect(target.querySelectorAll('.sv-cal__cell').length).toBe(12) // 12 months
      title().click() // -> decade
      flushSync()
      expect(title().textContent).toContain('2020 - 2029')
    } finally {
      destroy()
    }
  })

  it('year mode: clicking a month drills back to that month', () => {
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15) })
    try {
      target.querySelector<HTMLButtonElement>('.sv-cal__title')!.click() // year mode
      flushSync()
      const jan = Array.from(target.querySelectorAll<HTMLButtonElement>('.sv-cal__cell'))[0]!
      jan.click()
      flushSync()
      expect(target.querySelector('.sv-cal__title')?.textContent?.toLowerCase()).toContain('january')
    } finally {
      destroy()
    }
  })

  it('steps the month with animation enabled (animation never blocks navigation)', () => {
    const { target, destroy } = mountCal({ value: new Date(2026, 5, 15), animate: 'slide' })
    try {
      target.querySelector<HTMLButtonElement>('[aria-label="Next"]')!.click()
      flushSync()
      expect(target.querySelector('.sv-cal__title')?.textContent?.toLowerCase()).toContain('july')
    } finally {
      destroy()
    }
  })
})

describe('SvCalendar presets + tooltips', () => {
  it('renders preset buttons and applies a range preset', () => {
    let got: Date[] = []
    const { target, destroy } = mountCal({
      value: null,
      selectionMode: 'range',
      presets: [
        { label: 'First five', value: [new Date(2026, 5, 1), new Date(2026, 5, 5)] },
        { label: 'Just the 10th', value: new Date(2026, 5, 10) },
      ],
      onChange: (d: Date[]) => (got = d),
    })
    try {
      const buttons = Array.from(target.querySelectorAll<HTMLButtonElement>('.sv-cal__preset'))
      expect(buttons.map((b) => b.textContent?.trim())).toEqual(['First five', 'Just the 10th'])
      buttons[0]!.click()
      flushSync()
      expect(got.map((d) => d.getDate())).toEqual([1, 2, 3, 4, 5])
      buttons[1]!.click()
      flushSync()
      expect(got.map((d) => d.getDate())).toEqual([10])
    } finally {
      destroy()
    }
  })

  it('sets a native title tooltip only on matching days', () => {
    const { target, destroy } = mountCal({
      value: new Date(2026, 5, 15),
      dateTooltip: (d: Date) => (d.getDate() === 20 && d.getMonth() === 5 ? 'Release day' : undefined),
    })
    try {
      expect(dayButton(target, '20')?.title).toBe('Release day')
      expect(dayButton(target, '10')?.title).toBe('')
    } finally {
      destroy()
    }
  })
})
