/**
 * DOM test: SvBoard renders an enum field's options as columns and each row as a
 * card in its column, with counts and badges. Mounts against the real CRM deals
 * schema so the board <-> sample path is covered.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvBoard from './SvBoard.svelte'
import { getSampleApp } from './studio/samples/index'
import type { EntitySchema } from './schema'

const dealsSchema: EntitySchema = {
  name: 'deals',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text' },
    { field: 'value', type: 'number', label: 'Value ($)' },
    { field: 'stage', type: 'enum', options: [
      { value: 'lead', label: 'Lead', color: '#94a3b8' },
      { value: 'won', label: 'Won', color: '#10b981' },
      { value: 'lost', label: 'Lost', color: '#ef4444' },
    ] },
  ],
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => { if (comp) { unmount(comp); comp = null } if (host) { host.remove(); host = null } })

function render(props: Record<string, unknown>): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvBoard, { target: host, props })
  flushSync()
  return host
}

describe('SvBoard (DOM)', () => {
  it('renders a column per enum option and a card per row', () => {
    const rows = [
      { id: 'd1', title: 'Alpha deal', value: 1000, stage: 'lead' },
      { id: 'd2', title: 'Beta deal', value: 2000, stage: 'won' },
      { id: 'd3', title: 'Gamma deal', value: 500, stage: 'lead' },
    ]
    const el = render({ schema: dealsSchema, rows, groupBy: 'stage', titleField: 'title', badgeField: 'value' })
    const cols = el.querySelectorAll('.sv-board__col')
    expect(cols.length).toBe(3) // lead / won / lost
    // Column titles + counts.
    const titles = [...el.querySelectorAll('.sv-board__coltitle')].map((n) => n.textContent)
    expect(titles).toEqual(['Lead', 'Won', 'Lost'])
    const counts = [...el.querySelectorAll('.sv-board__count')].map((n) => n.textContent)
    expect(counts).toEqual(['2', '1', '0'])
    // Cards + a formatted money badge ($ from the "Value ($)" label).
    const cards = [...el.querySelectorAll('.sv-board__card-title')].map((n) => n.textContent)
    expect(cards).toContain('Alpha deal')
    expect(el.textContent).toContain('$1,000')
  })

  it('mounts against the real CRM deals sample', () => {
    const proj = getSampleApp('crm')!.build()
    const rows = (proj.dataSources!.deals as { seed?: Record<string, unknown>[] }).seed!
    const el = render({ schema: proj.entities.find((e) => e.name === 'deals'), rows, groupBy: 'stage', titleField: 'title', badgeField: 'value', onMove: vi.fn() })
    expect(el.querySelectorAll('.sv-board__col').length).toBe(5) // 5 deal stages
    expect(el.querySelectorAll('.sv-board__card').length).toBe(rows.length)
  })
})
