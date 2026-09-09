import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount, createRawSnippet } from 'svelte'
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

describe('dense charts (more categories than pixels)', () => {
  const line = (n: number): ChartSpec => ({
    type: 'line',
    categories: Array.from({ length: n }, (_, i) => `c${i}`),
    series: [{ label: 's', values: Array.from({ length: n }, (_, i) => Math.sin(i / 7) * 50 + 60) }],
    width: 800,
    height: 400,
  })

  it('draws a dot and a hit rect per point while there is room', () => {
    const el = render(line(40)) // 800px / 40 = 20px a category
    expect(el.querySelectorAll('.sv-grid-chart-dot').length).toBe(40)
    expect(el.querySelectorAll('.sv-grid-chart-cat-hit').length).toBe(40)
  })

  it('collapses the dots and the hit layer once categories go sub-pixel', () => {
    // 800px / 5000 = 0.16px a category. Per-category machinery here is not just
    // slow, it is useless: the dots overlap into a smear and a hit rect is
    // narrower than the pointer.
    const el = render(line(5000))
    expect(el.querySelectorAll('.sv-grid-chart-dot').length).toBe(0)
    const hits = el.querySelectorAll('.sv-grid-chart-cat-hit')
    expect(hits.length).toBe(1)
    expect(hits[0]!.getAttribute('data-dense')).toBe('true')
    // The line itself is still drawn in full - this is about the marks on it,
    // not about dropping data.
    expect(el.querySelector('.sv-grid-chart-linepath')).toBeTruthy()
  })

  it('keeps the aria-label off the render path when dense', () => {
    // Each per-category rect labels itself by calling catRows(), so 5000 rects
    // meant 5000 tooltip-row computations before anything was hovered.
    const el = render(line(5000))
    const label = el.querySelector('.sv-grid-chart-cat-hit')!.getAttribute('aria-label')!
    expect(label).toContain('5000 points')
    expect(label).toContain('Arrow keys')
  })

  it('caps the screen-reader table and says so in the caption', () => {
    const el = render(line(5000))
    const rows = el.querySelectorAll('.sv-grid-chart-sr-only tbody tr')
    expect(rows.length).toBe(1000)
    expect(el.querySelector('.sv-grid-chart-sr-only caption')!.textContent).toContain('first 1000 of 5000')
  })

  it('leaves a small chart entirely alone', () => {
    const el = render(line(40))
    expect(el.querySelector('.sv-grid-chart-sr-only tbody')!.children.length).toBe(40)
    expect(el.querySelector('.sv-grid-chart-sr-only caption')!.textContent).not.toContain('first')
    expect(el.querySelector('[data-dense]')).toBeNull()
  })

  it('does not collapse a bar chart, whose marks ARE the data', () => {
    // Dropping dots loses nothing because the line still shows the shape.
    // Dropping bars would draw an empty chart, so density only governs the
    // dot / hit / label / table layers, never the marks themselves.
    //
    // 1200 rather than 5000 only because jsdom takes seconds to build that many
    // <rect> nodes; 1200 at 800px is already 0.67px a bar, well inside dense.
    const el = render({ ...line(1200), type: 'bar' })
    expect(el.querySelectorAll('.sv-grid-chart-bar').length).toBe(1200)
    expect(el.querySelector('[data-dense]')).toBeTruthy()
  })
})

describe('custom-series seam (underlay / overlay snippets)', () => {
  const spec: ChartSpec = {
    type: 'bar',
    categories: ['a', 'b', 'c'],
    series: [{ label: 's', values: [10, 20, 30] }],
    width: 500,
    height: 300,
  }

  it('renders both snippets inside the chart svg', () => {
    const el = render(spec, {
      underlay: createRawSnippet(() => ({ render: () => `<rect class="my-under" />` })),
      overlay: createRawSnippet(() => ({ render: () => `<rect class="my-over" />` })),
    })
    expect(el.querySelector('.sv-grid-chart-svg .my-under')).toBeTruthy()
    expect(el.querySelector('.sv-grid-chart-svg .my-over')).toBeTruthy()
  })

  it('puts the underlay beneath the bars and the overlay above them', () => {
    const el = render(spec, {
      underlay: createRawSnippet(() => ({ render: () => `<rect class="my-under" />` })),
      overlay: createRawSnippet(() => ({ render: () => `<rect class="my-over" />` })),
    })
    // SVG paints in document order, so position IS z-order.
    const nodes = [...el.querySelectorAll('.sv-grid-chart-svg *')]
    const under = nodes.findIndex((n) => n.classList.contains('my-under'))
    const bar = nodes.findIndex((n) => n.classList.contains('sv-grid-chart-bar'))
    const over = nodes.findIndex((n) => n.classList.contains('my-over'))
    expect(under).toBeGreaterThanOrEqual(0)
    expect(under).toBeLessThan(bar)
    expect(bar).toBeLessThan(over)
  })

  it('keeps the hit layer above the overlay, so tooltips still work', () => {
    // A custom mark must not be able to swallow the tooltips, the keyboard
    // navigation or the drill clicks.
    const el = render(spec, {
      overlay: createRawSnippet(() => ({ render: () => `<rect class="my-over" />` })),
    })
    const nodes = [...el.querySelectorAll('.sv-grid-chart-svg *')]
    const over = nodes.findIndex((n) => n.classList.contains('my-over'))
    const hit = nodes.findIndex((n) => n.classList.contains('sv-grid-chart-cat-hit'))
    expect(hit).toBeGreaterThan(over)
  })

  it('draws nothing extra when no snippet is passed', () => {
    const el = render(spec)
    expect(el.querySelector('.my-over')).toBeNull()
    expect(el.querySelector('.sv-grid-chart-bar')).toBeTruthy()
  })
})
