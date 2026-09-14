/**
 * DOM test: the designer's Chart view draws the same layout the table shows,
 * in the measure's format. The table wrote "$469,662" while the chart read
 * "470k": the bridge never received the value chip's format. Now the axis
 * reads "$470k", the tooltip "$469,662", and the axis is named after the one
 * measure.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvPivotDesigner from './SvPivotDesigner.svelte'
import type { PivotField, PivotLayout } from './pivot-designer'

type Row = { region: string; quarter: string; revenue: number; units: number }
const rows: Row[] = [
  { region: 'EMEA', quarter: 'Q1', revenue: 469662, units: 40 },
  { region: 'EMEA', quarter: 'Q2', revenue: 97692, units: 12 },
  { region: 'APAC', quarter: 'Q1', revenue: 508153, units: 51 },
  { region: 'APAC', quarter: 'Q2', revenue: 107652, units: 9 },
]
const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
const fields: PivotField<Row>[] = [
  { field: 'region', label: 'Region', kind: 'dimension' },
  { field: 'quarter', label: 'Quarter', kind: 'dimension' },
  { field: 'revenue', label: 'Revenue', kind: 'measure', format: money },
  { field: 'units', label: 'Units', kind: 'measure', format: { type: 'number' } },
]

// jsdom lacks ResizeObserver; the chart's autosize wiring touches it on mount
// and the enterprise dom project has no shared setup.
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => { if (comp) { unmount(comp); comp = null } if (host) { host.remove(); host = null } })

function render(layout: PivotLayout): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvPivotDesigner, { target: host, props: { data: rows, fields, layout, chartable: true, defaultView: 'chart', expandable: false } as never })
  flushSync()
  return host
}

describe('SvPivotDesigner chart view (DOM)', () => {
  it('charts the layout in the measure format with the measure on the axis', () => {
    const el = render({ rows: ['region'], cols: ['quarter'], values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: money }], filters: [] })
    expect(el.querySelector('.pvd-chart svg')).toBeTruthy()
    const ticks = [...el.querySelectorAll('.pvd-chart text.sv-grid-chart-axis')].map((t) => t.textContent ?? '')
    expect(ticks.some((t) => /^\$\d/.test(t))).toBe(true)
    expect([...el.querySelectorAll('.pvd-chart text.sv-grid-chart-axis-title')].map((t) => t.textContent)).toContain('Revenue')
    // Series are the column-axis values, categories the row-axis values.
    expect([...el.querySelectorAll('.pvd-chart .sv-grid-chart-legend-item')].map((b) => b.textContent!.trim())).toEqual(['Q1', 'Q2'])
    expect(ticks).toEqual(expect.arrayContaining(['EMEA', 'APAC']))
  })

  it('offers every shape a pivot can take, with the switches each one uses, and the chart toolbar', () => {
    const el = render({ rows: ['region'], cols: ['quarter'], values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: money }], filters: [] })
    const select = el.querySelector('.pvd-select[aria-label="Chart type"]') as HTMLSelectElement
    const values = [...select.options].map((o) => o.value)
    expect(values).toEqual(expect.arrayContaining(['bar', 'line', 'radar', 'heatmap', 'waterfall', 'stream', 'nightingale']))
    expect(values).not.toContain('scatter')
    expect(values).not.toContain('candlestick')
    // Bar: Stacked, 100% and Horizontal; the chart carries its export toolbar.
    const toggles = () => [...el.querySelectorAll('.pvd-toggle')].map((l) => l.textContent!.trim()).filter((t) => /Stacked|100%|Horizontal/.test(t))
    expect(toggles()).toEqual(['Stacked', '100%', 'Horizontal'])
    expect(el.querySelector('.pvd-chart .sv-grid-chart-toolbar')).toBeTruthy()
    const box = (label: string) => [...el.querySelectorAll('.pvd-toggle')].find((l) => l.textContent!.includes(label))!.querySelector('input') as HTMLInputElement
    box('100%').checked = true
    box('100%').dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    const axis = [...el.querySelectorAll('.pvd-chart text.sv-grid-chart-axis')].map((t) => t.textContent)
    expect(axis).toContain('100%')
    box('Horizontal').checked = true
    box('Horizontal').dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    // Horizontal: the categories run down the axis on the left, so the bars are wider than tall.
    const bar = el.querySelector('.pvd-chart rect.sv-grid-chart-bar')!
    expect(Number(bar.getAttribute('width'))).toBeGreaterThan(Number(bar.getAttribute('height')))
    // A radar has no stacking switch at all.
    select.value = 'radar'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    expect(toggles()).toEqual([])
    expect(el.querySelector('.pvd-chart .sv-grid-chart-radar-poly')).toBeTruthy()
  })

  it('formats plainly when the measures disagree', () => {
    const el = render({ rows: ['region'], cols: [], values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: money }, { field: 'units', agg: 'sum', label: 'Units', format: { type: 'number' } }], filters: [] })
    const ticks = [...el.querySelectorAll('.pvd-chart text.sv-grid-chart-axis')].map((t) => t.textContent ?? '')
    expect(ticks.some((t) => /^\$/.test(t))).toBe(false)
    expect(el.querySelector('.pvd-chart text.sv-grid-chart-axis-title')).toBeNull()
  })
})
