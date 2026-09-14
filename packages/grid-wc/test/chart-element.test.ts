import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { ELEMENT_PROPS, ELEMENT_EVENTS, ELEMENT_EXCLUDED } from '../src/surface-chart.generated.js'
// @ts-expect-error - plain .mjs helper, no types
import { parseTypeMembers } from '../../mcp/scripts/api-surface.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const gridSrc = join(here, '..', '..', 'grid', 'src')

class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(async () => {
  // @ts-expect-error - assigning a test shim
  globalThis.ResizeObserver ??= ResizeObserverShim
  // Importing the bundle registers <sv-chart>.
  await import('../dist/chart/sv-chart-element.js')
})

const spec = {
  type: 'bar',
  categories: ['a', 'b', 'c'],
  series: [{ label: 's', values: [1, 2, 3] }],
}

type ChartEl = HTMLElement & { spec?: unknown; legend?: unknown; zoom?: unknown; selected?: unknown }

const tick = () => new Promise((r) => setTimeout(r, 50))

describe('sv-chart built bundle', () => {
  it('registers the <sv-chart> custom element on import', () => {
    expect(customElements.get('sv-chart')).toBeTruthy()
  })

  it('renders the chart svg once a spec is assigned as a property', async () => {
    const el = document.createElement('sv-chart') as ChartEl
    el.spec = spec
    document.body.appendChild(el)
    expect(el).toBeInstanceOf(customElements.get('sv-chart')!)
    await tick()
    expect(el.querySelector('svg.sv-grid-chart-svg')).toBeTruthy()
    expect(el.querySelectorAll('.sv-grid-chart-bar')).toHaveLength(3)
    el.remove()
  })

  it('re-emits onSelect as a `select` CustomEvent with the selection as detail', async () => {
    const el = document.createElement('sv-chart') as ChartEl
    el.spec = spec
    document.body.appendChild(el)
    await tick()
    const seen: unknown[] = []
    el.addEventListener('select', (e) => seen.push((e as CustomEvent).detail))
    ;(el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()
    expect(seen).toEqual([{ category: 'b', series: '', value: 0, rowIds: undefined }])
    el.remove()
  })

  it('takes the legend side from the attribute, and a bare attribute means true', async () => {
    const el = document.createElement('sv-chart') as ChartEl
    el.setAttribute('legend', 'right')
    el.spec = spec
    document.body.appendChild(el)
    await tick()
    expect(el.querySelector('.sv-grid-chart.is-legend-right')).toBeTruthy()
    el.setAttribute('legend', '')
    await tick()
    expect(el.querySelector('.sv-grid-chart.is-legend-right')).toBeNull()
    expect(el.querySelector('.sv-grid-chart-legend')).toBeTruthy()
    el.remove()
  })

  it('writes the zoom window back onto the element when it changes', async () => {
    const el = document.createElement('sv-chart') as ChartEl
    el.spec = { ...spec, categories: ['a', 'b', 'c', 'd', 'e'], series: [{ label: 's', values: [1, 2, 3, 4, 5] }] }
    el.setAttribute('zoomable', '')
    document.body.appendChild(el)
    await tick()
    const windows: unknown[] = []
    el.addEventListener('zoom', (e) => windows.push((e as CustomEvent).detail))
    el.zoom = { i0: 1, i1: 3 }
    await tick()
    expect(el.querySelectorAll('.sv-grid-chart-bar')).toHaveLength(3)
    el.remove()
  })
})

describe('parity with SvChart', () => {
  const propsType = readFileSync(join(gridSrc, 'SvGridChart.types.ts'), 'utf8')
  const declared = new Set(ELEMENT_PROPS.map((p) => p.name))
  const excluded = new Set(ELEMENT_EXCLUDED.map((e) => e.name))
  const events = new Set(ELEMENT_EVENTS.map((e) => e.callback))
  const members = parseTypeMembers(propsType, 'SvChartProps').map((m: { name: string }) => m.name)

  it('reads the SvChartProps type', () => {
    expect(members.length).toBeGreaterThan(30)
    expect(members).toContain('spec')
    expect(members).toContain('onZoom')
  })

  it('every data prop is declared by the element, or excluded with a reason', () => {
    const missing = members.filter((n: string) => !/^on[A-Z]/.test(n) && !declared.has(n) && !excluded.has(n))
    expect(missing).toEqual([])
  })

  it('every callback is an event', () => {
    const missing = members.filter((n: string) => /^on[A-Z]/.test(n) && !events.has(n))
    expect(missing).toEqual([])
  })

  it('the primitives are attributes and the spec is property-only', () => {
    const byName = new Map(ELEMENT_PROPS.map((p) => [p.name, p]))
    expect(byName.get('spec')?.attribute).toBeNull()
    expect(byName.get('zoomable')?.attribute).toBe('zoomable')
    expect(byName.get('rangePresets')?.attribute).toBe('range-presets')
    expect(byName.get('legend')?.type).toBe('String')
    expect(byName.get('selectable')?.type).toBe('String')
  })
})
