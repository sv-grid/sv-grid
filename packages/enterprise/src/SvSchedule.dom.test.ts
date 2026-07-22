/**
 * DOM test: SvSchedule renders a month grid anchored to the earliest event, places
 * each dated row as an event chip on its day, and paginates months.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSchedule from './SvSchedule.svelte'
import type { EntitySchema } from './schema'

const schema: EntitySchema = {
  name: 'events',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text' },
    { field: 'startAt', type: 'datetime' },
    { field: 'category', type: 'enum', options: [
      { value: 'conf', label: 'Conference', color: '#6366f1' },
      { value: 'workshop', label: 'Workshop', color: '#10b981' },
    ] },
  ],
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => { if (comp) { unmount(comp); comp = null } if (host) { host.remove(); host = null } })
function render(props: Record<string, unknown>): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvSchedule, { target: host, props })
  flushSync()
  return host
}

describe('SvSchedule (DOM)', () => {
  const rows = [
    { id: 'e1', name: 'Svelte Summit', startAt: '2026-09-12T09:00:00Z', category: 'conf' },
    { id: 'e2', name: 'A11y Workshop', startAt: '2026-09-20T10:00:00Z', category: 'workshop' },
  ]

  it('anchors to the earliest event month and renders its events', () => {
    const el = render({ schema, rows, dateField: 'startAt', titleField: 'name', colorField: 'category' })
    expect(el.querySelector('.sv-sched__month')?.textContent).toContain('September 2026')
    expect(el.querySelectorAll('.sv-sched__cell').length).toBe(42) // 6 weeks
    const evs = [...el.querySelectorAll('.sv-sched__ev')].map((n) => n.textContent?.trim())
    expect(evs).toContain('Svelte Summit')
    expect(evs).toContain('A11y Workshop')
  })

  it('paginates to the next month (events drop off)', () => {
    const el = render({ schema, rows, dateField: 'startAt', titleField: 'name' })
    el.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!.click()
    flushSync()
    expect(el.querySelector('.sv-sched__month')?.textContent).toContain('October 2026')
    expect(el.querySelectorAll('.sv-sched__ev').length).toBe(0)
  })
})
