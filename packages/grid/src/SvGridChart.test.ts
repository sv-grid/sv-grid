import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGridChart from './SvGridChart.svelte'
import type { ChartSpec } from './chart'

let app: ReturnType<typeof mount> | null = null
let target: HTMLElement | null = null

function render(spec: ChartSpec, extra: Record<string, unknown> = {}) {
  target = document.createElement('div')
  document.body.appendChild(target)
  app = mount(SvGridChart, { target, props: { spec, ...extra } as any })
  return target
}

afterEach(() => {
  if (app) unmount(app)
  if (target) target.remove()
  app = null
  target = null
})

describe('SvGridChart legend overflow', () => {
  const many: ChartSpec = {
    type: 'bar',
    categories: ['A', 'B'],
    series: Array.from({ length: 14 }, (_, i) => ({ label: `S${i}`, values: [i, i + 1] })),
  }

  it('collapses to the first 10 chips with a "+N more" toggle', () => {
    const el = render(many)
    const chips = el.querySelectorAll('.sv-grid-chart-legend-item')
    expect(chips.length).toBe(10)
    const more = el.querySelector('.sv-grid-chart-legend-more') as HTMLButtonElement
    expect(more).toBeTruthy()
    expect(more.textContent).toContain('+4 more')
  })

  it('expands to show every series when "+N more" is clicked', async () => {
    const el = render(many)
    const more = el.querySelector('.sv-grid-chart-legend-more') as HTMLButtonElement
    more.click()
    await Promise.resolve()
    expect(el.querySelectorAll('.sv-grid-chart-legend-item').length).toBe(14)
    expect(el.querySelector('.sv-grid-chart-legend-more')!.textContent).toContain('Show less')
  })

  it('shows no overflow toggle for <= 10 series', () => {
    const el = render({ type: 'bar', categories: ['A'], series: [{ label: 's', values: [1] }] })
    expect(el.querySelector('.sv-grid-chart-legend-more')).toBeNull()
  })
})

describe('SvGridChart horizontal bars', () => {
  it('renders left category labels and a bottom value axis', () => {
    const el = render({
      type: 'bar',
      orientation: 'horizontal',
      categories: ['Ada', 'Grace'],
      series: [{ label: 'rev', values: [10, 30] }],
    })
    const bars = el.querySelectorAll('.sv-grid-chart-bar')
    expect(bars.length).toBe(2)
    // category labels appear as axis text
    const axisText = [...el.querySelectorAll('.sv-grid-chart-axis')].map((n) => n.textContent)
    expect(axisText).toContain('Ada')
    expect(axisText).toContain('Grace')
  })
})

describe('SvGridChart candlesticks', () => {
  const bars = [
    { o: 100, h: 110, l: 95, c: 105 },
    { o: 105, h: 108, l: 99, c: 101 },
  ]
  const priced = (type: 'candlestick' | 'ohlc'): ChartSpec => ({
    type,
    categories: ['2026-03-02', '2026-03-03'],
    series: [{ label: 'ACME', values: bars.map((b) => b.c), ohlc: bars }],
  })

  it('draws a body and a wick per bar', () => {
    const el = render(priced('candlestick'))
    expect(el.querySelectorAll('rect.sv-grid-chart-candle')).toHaveLength(2)
    expect(el.querySelectorAll('line.sv-grid-chart-wick')).toHaveLength(2)
  })

  it('a rising candle is hollow, a falling one filled', () => {
    const el = render(priced('candlestick'))
    const [up, down] = [...el.querySelectorAll('rect.sv-grid-chart-candle')]
    expect(up!.getAttribute('fill')).toBe('none')
    expect(down!.getAttribute('fill')).not.toBe('none')
  })

  it('ohlc draws three ticks per bar and no body', () => {
    const el = render(priced('ohlc'))
    expect(el.querySelectorAll('line.sv-grid-chart-ohlc')).toHaveLength(6)
    expect(el.querySelectorAll('rect.sv-grid-chart-candle')).toHaveLength(0)
  })

  it('gives a screen reader the four real prices, not just the closes', () => {
    const el = render(priced('candlestick'))
    const head = [...el.querySelectorAll('th')].map((t) => t.textContent)
    expect(head).toEqual(['Date', 'Series', 'Open', 'High', 'Low', 'Close'])
  })
})
