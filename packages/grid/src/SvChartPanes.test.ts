import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvChartPanes from './SvChartPanes.svelte'
import type { ChartSpec, OhlcBar } from './chart-types'

let app: ReturnType<typeof mount> | null = null
let target: HTMLElement | null = null
afterEach(() => {
  if (app) unmount(app)
  app = null
  target?.remove()
  target = null
})

const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64]
const bars: OhlcBar[] = closes.map((c, i) => ({ o: i ? closes[i - 1]! : c, h: c + 1, l: c - 1, c }))
const price: ChartSpec = {
  type: 'candlestick',
  categories: closes.map((_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`),
  series: [{ label: 'ACME', values: closes, ohlc: bars, volumes: closes.map((_, i) => 100 + i) }],
  xType: 'ordinal-time',
  width: 600,
  height: 240,
}

function render(props: Record<string, unknown>) {
  target = document.createElement('div')
  document.body.appendChild(target)
  app = mount(SvChartPanes, { target, props: props as never })
  flushSync()
  return target
}

describe('SvChartPanes', () => {
  it('stacks the price chart over one pane per indicator, x labels on the last pane only', () => {
    const el = render({ spec: price, indicators: [{ kind: 'volume' }, { kind: 'rsi', params: { period: 5 } }] })
    expect(el.querySelectorAll('.sv-grid-chart-svg')).toHaveLength(3)
    const panes = [...el.querySelectorAll('.sv-chart-pane.is-indicator')]
    expect(panes.map((p) => p.getAttribute('data-indicator'))).toEqual(['volume', 'rsi'])
    expect(panes.map((p) => p.querySelector('.sv-chart-pane-title')!.textContent)).toEqual(['Volume', 'RSI 5'])
    // Category (x) labels: none on the main chart and the volume pane, some on the RSI pane.
    const xLabels = (root: Element) => root.querySelectorAll('text.sv-grid-chart-axis.is-x, .sv-grid-chart-xlabel').length
    const [main, vol, rsi] = [el.querySelector('.sv-chart-pane.is-main')!, panes[0]!, panes[1]!]
    expect(xLabels(rsi)).toBeGreaterThan(0)
    expect(xLabels(main)).toBe(0)
    expect(xLabels(vol)).toBe(0)
    // The volume pane draws bars, the RSI pane a line with its 30 / 70 lines.
    expect(vol.querySelectorAll('.sv-grid-chart-bar').length).toBe(20)
    expect(rsi.querySelectorAll('.sv-grid-chart-refline').length).toBe(2)
  })

  it('shares the crosshair across the stack through a private sync group', () => {
    const el = render({ spec: price, indicators: [{ kind: 'volume' }] })
    const main = el.querySelector('.sv-chart-pane.is-main')!
    ;(main.querySelectorAll('.sv-grid-chart-cat-hit')[3] as SVGElement).dispatchEvent(new FocusEvent('focus'))
    flushSync()
    expect(main.querySelector('.sv-grid-chart-crosshair')).toBeTruthy()
    expect(el.querySelector('.sv-chart-pane.is-indicator .sv-grid-chart-crosshair')).toBeTruthy()
  })

  it('with no indicators it is one chart with its own x labels', () => {
    const el = render({ spec: price })
    expect(el.querySelectorAll('.sv-grid-chart-svg')).toHaveLength(1)
    expect(el.querySelectorAll('text.sv-grid-chart-axis.is-x, .sv-grid-chart-xlabel').length).toBeGreaterThan(0)
  })
})
