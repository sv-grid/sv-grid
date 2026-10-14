/**
 * `scheduler.allDay`: a date field without a time places each record on its
 * day, as an all-day bar with no time, and a bare 'YYYY-MM-DD' is that day
 * where the user is (not midnight UTC, the evening before west of UTC).
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import { enableSchedulerView } from './scheduler'

enableSchedulerView()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r))

function mountCalendar(allDay: boolean) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid as any, {
    target,
    props: {
      data: [{ id: 1, task: 'Docs page', due: '2026-10-14' }],
      columns: [
        { field: 'task', header: 'Task' },
        { field: 'due', header: 'Due' },
      ],
      getRowId: (r: { id: number }) => String(r.id),
      containerHeight: 600,
      scheduler: { startField: 'due', titleField: 'task', initialView: 'month', initialDate: '2026-10-01', allDay },
    },
  })
  flushSync()
  return { target, destroy: () => (unmount(app), target.remove()) }
}

describe('scheduler allDay', () => {
  it('draws a date-only record on its day with no time', async () => {
    const c = mountCalendar(true)
    try {
      for (let i = 0; i < 50 && !c.target.querySelector('.sv-sched-bar'); i++) await settle()
      const bar = c.target.querySelector<HTMLElement>('.sv-sched-bar')!
      expect(bar.querySelector('.sv-sched-bar-title')?.textContent).toBe('Docs page')
      expect(bar.querySelector('.sv-sched-bar-time')).toBeNull()
      // 14 October 2026 is a Wednesday: the fourth column of a Sunday-first week.
      expect(bar.style.left).toContain('42.857')
    } finally {
      c.destroy()
    }
  })

  it('without it, the same value is a timed event', async () => {
    const c = mountCalendar(false)
    try {
      for (let i = 0; i < 50 && !c.target.querySelector('.sv-sched-bar'); i++) await settle()
      expect(c.target.querySelector('.sv-sched-bar .sv-sched-bar-time')).not.toBeNull()
    } finally {
      c.destroy()
    }
  })
})
