/**
 * Week / Day with `resourceField` set: the resource columns come from the
 * rows, not from the events in the visible range. Built from the range, a week
 * with no events had zero resources and so zero day columns (`--cols: 0`, the
 * time axis alone at full width).
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

type Row = { id: number; title: string; start: string; room: string }

function mountWeek(data: Row[], initialView: 'week' | 'day', initialDate: string) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid as any, {
    target,
    props: {
      data,
      columns: [
        { field: 'title', header: 'Title' },
        { field: 'start', header: 'Start' },
        { field: 'room', header: 'Room' },
      ],
      getRowId: (r: Row) => String(r.id),
      containerHeight: 600,
      scheduler: { startField: 'start', titleField: 'title', resourceField: 'room', initialView, initialDate },
    },
  })
  flushSync()
  return { target, destroy: () => (unmount(app), target.remove()) }
}

const ROWS: Row[] = [
  { id: 1, title: 'Standup', start: '2026-10-14T09:00:00', room: 'A' },
  { id: 2, title: 'Review', start: '2026-10-15T13:00:00', room: 'B' },
]

async function columns(target: HTMLElement) {
  for (let i = 0; i < 50 && !target.querySelector('.sv-sched-xinner'); i++) await settle()
  const inner = target.querySelector<HTMLElement>('.sv-sched-xinner')!
  return {
    cols: Number(/--cols:\s*(\d+)/.exec(inner.getAttribute('style') ?? '')?.[1]),
    heads: target.querySelectorAll('.sv-sched-colhead').length,
  }
}

describe('scheduler resource columns', () => {
  it('a week with no events still shows every resource x day', async () => {
    // December has no events; the rows carry rooms A and B.
    const c = mountWeek(ROWS, 'week', '2026-12-02')
    try {
      const { cols, heads } = await columns(c.target)
      expect(cols).toBe(14)
      expect(heads).toBe(14)
    } finally {
      c.destroy()
    }
  })

  it('a day with no events still shows one column per resource', async () => {
    const c = mountWeek(ROWS, 'day', '2026-12-02')
    try {
      expect((await columns(c.target)).cols).toBe(2)
    } finally {
      c.destroy()
    }
  })

  it('the same week with events has the same columns', async () => {
    const c = mountWeek(ROWS, 'week', '2026-10-14')
    try {
      expect((await columns(c.target)).cols).toBe(14)
    } finally {
      c.destroy()
    }
  })

  it('no rows at all falls back to plain day columns, not zero', async () => {
    const c = mountWeek([], 'week', '2026-12-02')
    try {
      const { cols, heads } = await columns(c.target)
      expect(cols).toBe(7)
      expect(heads).toBe(7)
    } finally {
      c.destroy()
    }
  })
})
