import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, createRawSnippet, flushSync } from 'svelte'
import SvGridChart from './SvGridChart.svelte'
import type { ChartSpec } from './chart'

let app: ReturnType<typeof mount> | null = null
let target: HTMLElement | null = null

function render(spec: ChartSpec, extra: Record<string, unknown> = {}) {
  target = document.createElement('div')
  document.body.appendChild(target)
  app = mount(SvGridChart, { target, props: { spec, ...extra } as any })
  // bind:this lands in an effect, so a handler that needs the element (the
  // tooltip reads the wrapper's box) must see one flush first.
  flushSync()
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

  it('a waterfall tooltip and table read the drawn totals, not the zeros in the data', () => {
    const el = render({
      type: 'waterfall',
      categories: ['Revenue', 'Cost', 'Gross'],
      series: [{ label: 'FY', values: [4300, -1840, 0] }],
      waterfallTotals: [true, false, true],
    })
    ;(el.querySelectorAll('.sv-grid-chart-cat-hit')[2] as SVGElement).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    flushSync()
    const rows = [...el.querySelectorAll('.sv-grid-chart-tooltip-row')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('2,460')
    const cells = [...el.querySelectorAll('.sv-grid-chart-sr-only tbody td')].map((td) => td.textContent)
    expect(cells).toEqual(['Revenue', '4,300', 'Cost', '-1,840', 'Gross', '2,460'])
  })

  it('a gauge writes a symbol unit against the number and a word unit after a space', () => {
    const el = render({ type: 'gauge', categories: [], series: [], gaugeValue: 99.2, gaugeMin: 99, gaugeMax: 100, gaugeUnit: '%' })
    expect(el.querySelector('.sv-grid-chart-gauge-value')!.textContent).toBe('99.2%')
    unmount(app!); app = null
    const ms = render({ type: 'gauge', categories: [], series: [], gaugeValue: 480, gaugeMin: 0, gaugeMax: 500, gaugeUnit: 'ms' })
    expect(ms.querySelector('.sv-grid-chart-gauge-value')!.textContent).toBe('480 ms')
  })

  it('a calendar cell names its day in words', () => {
    const el = render({ type: 'calendar', categories: [], series: [], calendarValues: [{ date: '2026-04-07', value: 193 }, { date: '2026-04-08', value: 12 }] })
    const cell = [...el.querySelectorAll('.sv-grid-chart-calendar-cell')].find((c) => c.getAttribute('aria-label')?.startsWith('Apr 7, 2026')) as SVGElement
    expect(cell).toBeTruthy()
    cell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-tooltip-title')!.textContent).toBe('Apr 7, 2026')
  })

  it('a heat map writes its cell values when the spec asks for data labels', () => {
    const spec: ChartSpec = { type: 'heatmap', categories: ['00', '01'], series: [{ label: 'Mon', values: [4, 9] }], dataLabels: { show: true }, width: 400, height: 200 }
    const el = render(spec)
    expect([...el.querySelectorAll('.sv-grid-chart-heatlabel')].map((t) => t.textContent)).toEqual(['4', '9'])
    unmount(app!); app = null
    const off = render({ ...spec, dataLabels: { show: false } })
    expect(off.querySelectorAll('.sv-grid-chart-heatlabel')).toHaveLength(0)
  })

  it('a series on the right axis reads in that axis format in the tooltip, the table and its labels', () => {
    const el = render(
      {
        type: 'bar',
        categories: ['Jan', 'Feb'],
        series: [
          { label: 'Revenue', values: [2.1, 2.3] },
          { label: 'Margin', values: [0.29, 0.31], type: 'line', axis: 'right' },
        ],
        valueFormat: 'currency',
        y2Axis: { format: 'percent' },
      },
      { dataLabels: true },
    )
    ;(el.querySelectorAll('.sv-grid-chart-cat-hit')[0] as SVGElement).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    flushSync()
    const rows = [...el.querySelectorAll('.sv-grid-chart-tooltip-row')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim())
    expect(rows.some((r) => r.includes('$2.1') || r.includes('$2'))).toBe(true)
    expect(rows.some((r) => r.includes('29%'))).toBe(true)
    expect(rows.some((r) => r.includes('$0.29'))).toBe(false)
    const cells = [...el.querySelectorAll('.sv-grid-chart-sr-only tbody tr')][0]!.querySelectorAll('td')
    expect(cells[2]!.textContent).toBe('29%')
    const labels = [...el.querySelectorAll('.sv-grid-chart-datalabel')].map((l) => l.textContent)
    expect(labels).toContain('29%')
    expect(labels).not.toContain('$0.29')
  })

  it('a scatter point selects on click and on Enter, and the selection dims the rest', () => {
    const changes: unknown[] = []
    const picks: unknown[] = []
    const el = render(
      {
        type: 'scatter',
        categories: [],
        series: [{ label: 'Stores', values: [], points: [{ x: 1, y: 10, label: 'A' }, { x: 2, y: 20, label: 'B' }, { x: 3, y: 30, label: 'C' }] }],
      },
      { selectable: true, onSelectionChange: (s: unknown) => changes.push(s), onSelect: (s: unknown) => picks.push(s) },
    )
    const dots = el.querySelectorAll('.sv-grid-chart-scatter')
    expect(dots[1]!.getAttribute('role')).toBe('button')
    ;(dots[1] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(changes).toEqual([[{ category: 'B', series: 'Stores', index: 1 }]])
    expect(picks).toEqual([{ category: 'B', series: 'Stores', value: 20, rowIds: undefined }])
    expect(dots[1]!.classList.contains('is-selected')).toBe(true)
    expect((dots[0] as SVGElement).style.opacity).toBe('0.35')
    ;(dots[2] as SVGElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    flushSync()
    expect(changes[1]).toEqual([{ category: 'C', series: 'Stores', index: 2 }])
    expect(dots[1]!.classList.contains('is-selected')).toBe(false)
    expect(dots[2]!.classList.contains('is-selected')).toBe(true)
  })

  it('a drilled chart shows its breadcrumb with the toolbar off', () => {
    const tree = { name: 'All', children: [{ name: 'Blink', children: [{ name: 'Chrome', value: 6 }, { name: 'Edge', value: 2 }] }, { name: 'Gecko', value: 3 }] }
    const el = render({ type: 'sunburst', categories: [], series: [], tree }, { drillable: true, toolbar: false })
    expect(el.querySelector('.sv-grid-chart-toolbar')).toBeNull()
    const blink = [...el.querySelectorAll('.sv-grid-chart-arc')].find((a) => a.getAttribute('aria-label')?.startsWith('Blink')) as SVGElement
    blink.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    const crumbs = el.querySelector('.sv-grid-chart-crumbs')!
    expect(crumbs).not.toBeNull()
    expect(el.querySelector('.sv-grid-chart-toolbar.is-crumbs-only')).not.toBeNull()
    expect(crumbs.textContent!.replace(/\s+/g, ' ').trim()).toBe('All / Blink')
    ;(crumbs.querySelector('button') as HTMLButtonElement).click()
    flushSync()
    expect(el.querySelector('.sv-grid-chart-toolbar')).toBeNull()
  })

  it('a double-click isolates a legend chip and a second double-click clears it, leaving nothing hidden', () => {
    const el = render({ type: 'line', categories: ['a', 'b'], series: [{ label: 'x', values: [1, 2] }, { label: 'y', values: [2, 3] }, { label: 'z', values: [3, 4] }] }, { legend: true })
    const chips = () => [...el.querySelectorAll('.sv-grid-chart-legend-item')] as HTMLButtonElement[]
    const dbl = (chip: HTMLElement) => {
      chip.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
      chip.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }))
      chip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))
      flushSync()
    }
    const off = () => chips().map((c) => c.classList.contains('is-off'))
    dbl(chips()[1]!)
    expect(chips()[1]!.classList.contains('is-isolated')).toBe(true)
    // Isolation dims the other chips without marking them off: nothing was hidden by hand.
    expect(off()).toEqual([false, false, false])
    expect(el.querySelectorAll('.sv-grid-chart-linepath')).toHaveLength(1)
    dbl(chips()[1]!)
    expect(chips().some((c) => c.classList.contains('is-isolated'))).toBe(false)
    expect(off()).toEqual([false, false, false])
    expect(el.querySelectorAll('.sv-grid-chart-linepath')).toHaveLength(3)
    // Isolating one chip while another is isolated moves the isolation.
    dbl(chips()[0]!)
    dbl(chips()[2]!)
    expect(chips()[2]!.classList.contains('is-isolated')).toBe(true)
    expect(off()).toEqual([false, false, false])
    expect(el.querySelectorAll('.sv-grid-chart-linepath')).toHaveLength(1)
  })

  it('a range area draws its band at a stronger fill with thin edges', () => {
    const el = render({
      type: 'range-area',
      categories: ['a', 'b', 'c'],
      series: [{ label: 'band', values: [10, 12, 11], lowValues: [4, 5, 3] }],
    })
    expect(el.querySelector('.sv-grid-chart-area')!.getAttribute('fill-opacity')).toBe('0.35')
    expect(el.querySelector('.sv-grid-chart-linepath')!.getAttribute('stroke-width')).toBe('1')
    unmount(app!); app = null
    const plain = render({ type: 'area', categories: ['a', 'b', 'c'], series: [{ label: 's', values: [10, 12, 11] }] })
    expect(plain.querySelector('.sv-grid-chart-area')!.getAttribute('fill-opacity')).toBe('0.15')
    expect(plain.querySelector('.sv-grid-chart-linepath')!.getAttribute('stroke-width')).toBe('2')
  })

  it('writes a date category out in the tooltip and the crosshair pill', () => {
    const el = render(
      {
        type: 'line',
        xType: 'time',
        categories: ['2025-05-01', '2025-06-01', '2025-07-01'],
        series: [{ label: 'Free', values: [1, 2, 3] }],
      },
      { crosshairLabels: true },
    )
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement
    hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 }))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-tooltip-title')!.textContent).toBe('Jun 2025')
    expect(el.querySelector('.sv-grid-chart-crosshair-label text')!.textContent).toBe('Jun 2025')
    unmount(app!); app = null
    // Daily data reads the full date; a plain category axis is left alone.
    const daily = render({ type: 'line', xType: 'time', categories: ['2025-06-01', '2025-06-02'], series: [{ label: 's', values: [1, 2] }] })
    ;(daily.querySelectorAll('.sv-grid-chart-cat-hit')[0] as SVGElement).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    flushSync()
    expect(daily.querySelector('.sv-grid-chart-tooltip-title')!.textContent).toBe('Jun 1, 2025')
    unmount(app!); app = null
    const plain = render({ type: 'line', categories: ['2025-06-01', '2025-06-02'], series: [{ label: 's', values: [1, 2] }] })
    ;(plain.querySelectorAll('.sv-grid-chart-cat-hit')[0] as SVGElement).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    flushSync()
    expect(plain.querySelector('.sv-grid-chart-tooltip-title')!.textContent).toBe('2025-06-01')
  })

  it('reads a gap as an empty cell, never as "NaN" or as 0', () => {
    const el = render({
      type: 'line',
      categories: ['Jan', 'Feb', 'Mar'],
      series: [
        { label: 'Actual', values: [10, Number.NaN, 12] },
        { label: 'Forecast', values: [null as unknown as number, 11, Number.NaN] },
      ],
    })
    const cells = [...el.querySelectorAll('.sv-grid-chart-sr-only tbody td')].map((td) => td.textContent)
    expect(cells).toEqual(['Jan', '10', '', 'Feb', '', '11', 'Mar', '12', ''])
    expect(el.querySelector('.sv-grid-chart-sr-only')!.textContent).not.toContain('NaN')
  })

  it('hides the screen-reader table behind a clipped wrapper, not by styling the table itself', () => {
    // A table ignores width / height / overflow: hidden as a clip (they are
    // minimums on a table box), so a 1000-row table styled visually-hidden
    // still stood 17,000px tall and every scroll container around a chart
    // grew by that much. The clip has to be on a block element around it.
    const el = render(line(5000))
    const table = el.querySelector('table')!
    expect(table.classList.contains('sv-grid-chart-sr-only')).toBe(false)
    const wrapper = table.parentElement!
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.classList.contains('sv-grid-chart-sr-only')).toBe(true)
    // The svg still points at the table by id.
    const svg = el.querySelector('svg')!
    expect(svg.getAttribute('aria-describedby')).toBe(table.id)
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

describe('interactive annotations', () => {
  const spec: ChartSpec = {
    type: 'bar',
    categories: ['a', 'b', 'c'],
    series: [{ label: 's', values: [10, 20, 30] }],
    width: 500,
    height: 300,
  }
  const noted: ChartSpec = { ...spec, annotations: [{ at: { category: 'b' }, label: 'deploy' }] }

  it('shows no toggle unless asked for', () => {
    const el = render(spec, { toolbar: true })
    expect([...el.querySelectorAll('.sv-grid-chart-tool')].some((b) => b.textContent?.includes('Annotate'))).toBe(false)
  })

  it('adds an Annotate toggle, off to begin with', () => {
    const el = render(spec, { annotatable: true })
    const btn = [...el.querySelectorAll('.sv-grid-chart-tool')].find((b) => b.textContent?.includes('Annotate'))!
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('reports the data point picked, not a pixel', () => {
    const seen: unknown[] = []
    const el = render(spec, { annotatable: true, onAnnotate: (a: unknown) => seen.push(a) })
    const btn = [...el.querySelectorAll('.sv-grid-chart-tool')].find((b) => b.textContent?.includes('Annotate'))! as HTMLButtonElement
    btn.click()
    flushSync()
    ;(el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    // Anchored to a category, so the note survives a re-layout, a re-sort or a
    // zoom - which a pixel would not.
    expect(seen).toEqual([{ category: 'b', index: 1, value: 20 }])
  })

  it('takes over the drill gesture rather than firing both', () => {
    const drills: unknown[] = []
    const notes: unknown[] = []
    const el = render(spec, {
      annotatable: true,
      onSelect: (s: unknown) => drills.push(s),
      onAnnotate: (a: unknown) => notes.push(a),
    })
    const hit = () => (el.querySelectorAll('.sv-grid-chart-cat-hit')[0] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    hit()
    flushSync()
    expect(drills).toHaveLength(1)
    expect(notes).toHaveLength(0)

    const btn = [...el.querySelectorAll('.sv-grid-chart-tool')].find((b) => b.textContent?.includes('Annotate'))! as HTMLButtonElement
    btn.click()
    flushSync()
    hit()
    flushSync()
    expect(notes).toHaveLength(1)
    expect(drills).toHaveLength(1) // not both
  })

  it('makes existing markers removable, by mouse and by keyboard', () => {
    const removed: number[] = []
    const el = render(noted, { annotatable: true, onAnnotationRemove: (i: number) => removed.push(i) })
    const marker = () => el.querySelector('.sv-grid-chart-annotation-marker') as SVGElement
    // Inert until the mode is on.
    expect(marker().getAttribute('role')).toBeNull()
    marker().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(removed).toEqual([])

    const btn = [...el.querySelectorAll('.sv-grid-chart-tool')].find((b) => b.textContent?.includes('Annotate'))! as HTMLButtonElement
    btn.click()
    flushSync()
    expect(marker().getAttribute('role')).toBe('button')
    expect(marker().getAttribute('tabindex')).toBe('0')
    marker().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(removed).toEqual([0])

    marker().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    flushSync()
    expect(removed).toEqual([0, 0])
  })

  it('renders annotations normally when the mode is off', () => {
    const el = render(noted)
    expect(el.querySelectorAll('.sv-grid-chart-annotation-marker')).toHaveLength(1)
    expect(el.querySelector('.sv-grid-chart-annotation-label')!.textContent).toBe('deploy')
  })

  it('a pin carries its initial in the head and the whole label beside it', () => {
    // The head used to hold truncate(label, 2): "O…" for "Outage", and no
    // label anywhere else, so a pinned event read as a letter and a dot.
    const el = render({ ...spec, annotations: [{ at: { category: 'b' }, label: 'Outage', shape: 'pin', placement: 'bottom' }] })
    expect(el.querySelector('.sv-grid-chart-annotation-flagtext')!.textContent).toBe('O')
    expect(el.querySelector('.sv-grid-chart-annotation-label')!.textContent).toBe('Outage')
  })
})

describe('SvGridChart wave 1: axes, frame, legend, tooltip, labels', () => {
  const base: ChartSpec = {
    type: 'line',
    categories: ['Jan', 'Feb', 'Mar', 'Apr'],
    series: [
      { label: 'Sales', values: [40, 90, 60, 120] },
      { label: 'Cost', values: [20, 30, 25, 50] },
    ],
  }
  const remount = () => {
    if (app) unmount(app)
    app = null
  }

  it('draws the title, subtitle and caption from the spec', () => {
    const el = render({ ...base, title: 'Revenue', subtitle: 'FY26', caption: 'Source: finance' })
    expect(el.querySelector('.sv-grid-chart-title')!.textContent).toBe('Revenue')
    expect(el.querySelector('.sv-grid-chart-subtitle')!.textContent).toBe('FY26')
    expect(el.querySelector('.sv-grid-chart-caption')!.textContent).toBe('Source: finance')
  })

  it('draws no gridlines when the axis turns them off, and x gridlines when asked', () => {
    const off = render({ ...base, yAxis: { gridLines: false } })
    // Only the zero line survives (it is an axis, not a gridline).
    expect(off.querySelectorAll('.sv-grid-chart-gridline:not(.is-zero)')).toHaveLength(0)
    remount()
    const on = render({ ...base, xAxis: { gridLines: true } })
    // 4 x ticks + the y gridlines.
    expect(on.querySelectorAll('.sv-grid-chart-gridline').length).toBeGreaterThan(4)
  })

  it('rotates the x labels by the configured angle', () => {
    const el = render({ ...base, xAxis: { labelRotation: -90 } })
    const t = el.querySelector('text.sv-grid-chart-axis[transform]') as SVGElement
    expect(t).toBeTruthy()
    expect(t.getAttribute('transform')!.startsWith('rotate(-90')).toBe(true)
  })

  it('paints a reference band beneath the marks', () => {
    const el = render({ ...base, referenceBands: [{ from: 50, to: 100, label: 'target' }] })
    const band = el.querySelector('.sv-grid-chart-refband') as SVGRectElement
    expect(band).toBeTruthy()
    const nodes = [...el.querySelectorAll('.sv-grid-chart-svg *')]
    expect(nodes.indexOf(band)).toBeLessThan(nodes.findIndex((n) => n.classList.contains('sv-grid-chart-linepath')))
    expect([...el.querySelectorAll('.sv-grid-chart-reflabel')].some((n) => n.textContent === 'target')).toBe(true)
  })

  it('draws non-circle markers as paths and honours per-point markers', () => {
    const el = render({
      ...base,
      series: [{ label: 'a', values: [1, 2, 3, 4], marker: 'square', markers: [null, { shape: 'none' }, { shape: 'diamond' }, null] }],
    })
    const dots = el.querySelectorAll('.sv-grid-chart-dot')
    expect(dots).toHaveLength(3)
    expect([...dots].every((d) => d.tagName.toLowerCase() === 'path')).toBe(true)
  })

  it('applies stroke width, dash and gradient from the series', () => {
    const el = render({
      ...base,
      type: 'area',
      series: [{ label: 'a', values: [1, 2, 3, 4], strokeWidth: 4, dash: [4, 2], gradient: true }],
    })
    const line = el.querySelector('.sv-grid-chart-linepath')!
    expect(line.getAttribute('stroke-width')).toBe('4')
    expect(line.getAttribute('stroke-dasharray')).toBe('4 2')
    expect(el.querySelector('linearGradient')).toBeTruthy()
    expect(el.querySelector('.sv-grid-chart-area')!.getAttribute('fill')!.startsWith('url(#')).toBe(true)
  })

  it('places the legend on the side or on top through a wrapper class', () => {
    const left = render(base, { legend: 'left' })
    expect(left.querySelector('.sv-grid-chart')!.classList.contains('is-legend-left')).toBe(true)
    expect(left.querySelector('.sv-grid-chart-legend')!.classList.contains('is-vertical')).toBe(true)
    remount()
    const top = render(base, { legend: 'top' })
    expect(top.querySelector('.sv-grid-chart')!.classList.contains('is-legend-top')).toBe(true)
    expect(top.querySelector('.sv-grid-chart-legend')!.classList.contains('is-vertical')).toBe(false)
  })

  it('renders a custom legend item through the snippet', () => {
    const el = render(base, {
      legendItem: createRawSnippet((get: () => { label: string }) => ({ render: () => `<i class="my-item">${get().label}</i>` })),
    })
    const items = el.querySelectorAll('.sv-grid-chart-legend-item .my-item')
    expect(items).toHaveLength(2)
    expect(items[0]!.textContent).toBe('Sales')
    expect(el.querySelector('.sv-grid-chart-swatch')).toBeNull()
  })

  it('renders a custom tooltip through the snippet, with the hovered context', () => {
    const el = render(base, {
      tooltip: createRawSnippet((get: () => { category: string; rows: Array<{ label?: string }> }) => ({
        render: () => `<b class="my-tip">${get().category}:${get().rows.length}</b>`,
      })),
    })
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement
    // jsdom does not deliver delegated mousemove; focus takes the same path.
    hit.dispatchEvent(new FocusEvent('focus'))
    flushSync()
    const tip = el.querySelector('.sv-grid-chart-tooltip')!
    expect(tip.classList.contains('is-custom')).toBe(true)
    expect(tip.querySelector('.my-tip')!.textContent).toBe('Feb:2')
  })

  it('tooltipFormat rewrites the title and rows of the default tooltip', () => {
    const el = render(base, {
      tooltipFormat: (ctx: { category: string }) => ({ title: `Month ${ctx.category}`, rows: [{ value: 'only this' }] }),
    })
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[2] as SVGElement
    // jsdom does not deliver delegated mousemove; focus takes the same path.
    hit.dispatchEvent(new FocusEvent('focus'))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-tooltip-title')!.textContent).toBe('Month Mar')
    expect(el.querySelectorAll('.sv-grid-chart-tooltip-row')).toHaveLength(1)
    expect(el.querySelector('.sv-grid-chart-tooltip-row-value')!.textContent).toBe('only this')
  })

  it('data labels take a config object: formatter and placement', () => {
    const el = render({ ...base, type: 'bar', series: [{ label: 'a', values: [10, 20, 30, 40] }] }, {
      dataLabels: { formatter: (v: number) => `${v}!`, placement: 'inside', hideOverlap: false },
    })
    const labels = [...el.querySelectorAll('.sv-grid-chart-datalabel')]
    expect(labels).toHaveLength(4)
    expect(labels[0]!.textContent).toBe('10!')
    expect(labels.every((l) => l.classList.contains('on-bar'))).toBe(true)
  })

  it('hides overlapping data labels by default and keeps them all when told to', () => {
    // 40 points across a narrow chart: the labels cannot all fit.
    const dense: ChartSpec = {
      type: 'line',
      categories: Array.from({ length: 40 }, (_, i) => `c${i}`),
      series: [{ label: 'a', values: Array.from({ length: 40 }, (_, i) => 100 + (i % 3)) }],
      width: 300,
      height: 200,
    }
    const thinned = render(dense, { dataLabels: true })
    const kept = thinned.querySelectorAll('.sv-grid-chart-datalabel').length
    expect(kept).toBeGreaterThan(0)
    expect(kept).toBeLessThan(40)
    remount()
    const all = render(dense, { dataLabels: { hideOverlap: false } })
    expect(all.querySelectorAll('.sv-grid-chart-datalabel')).toHaveLength(40)
  })

  it('wraps the marks in a clip group so a pinned axis cuts values off at the plot edge', () => {
    const el = render({ ...base, yAxis: { max: 80 } })
    const g = el.querySelector('.sv-grid-chart-marks') as SVGGElement
    expect(g.getAttribute('clip-path')!.startsWith('url(#')).toBe(true)
    expect(el.querySelector('clipPath rect')).toBeTruthy()
    expect(g.querySelector('.sv-grid-chart-linepath')).toBeTruthy()
  })
})

describe('SvGridChart wave 2: the new families render and respond', () => {
  it('a sunburst draws one arc per node, focusable, with a tooltip and a key-only legend', () => {
    const el = render({
      type: 'sunburst',
      categories: [],
      series: [],
      tree: { name: 'root', children: [{ name: 'A', children: [{ name: 'A1', value: 3 }, { name: 'A2', value: 1 }] }, { name: 'B', value: 4 }] },
    }, { onSelect: () => {} })
    const arcs = el.querySelectorAll('.sv-grid-chart-arc')
    expect(arcs).toHaveLength(4)
    expect(arcs[0]!.getAttribute('role')).toBe('button')
    ;(arcs[1] as SVGElement).dispatchEvent(new FocusEvent('focus'))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-tooltip')).toBeTruthy()
    const chips = el.querySelectorAll('.sv-grid-chart-legend-item')
    expect(chips).toHaveLength(2)
    expect((chips[0] as HTMLButtonElement).disabled).toBe(true)
    // The screen-reader table lists the node paths.
    expect(el.querySelector('.sv-grid-chart-sr-only tbody')!.textContent).toContain('A / A1')
  })

  it('a radial bar lists categories in the legend and toggles one off', () => {
    const el = render({ type: 'radial-bar', categories: ['a', 'b', 'c'], series: [{ label: 's', values: [1, 2, 3] }] })
    expect(el.querySelectorAll('.sv-grid-chart-arc')).toHaveLength(3)
    expect(el.querySelectorAll('.sv-grid-chart-arc-track')).toHaveLength(3)
    const chips = el.querySelectorAll('.sv-grid-chart-legend-item')
    expect([...chips].map((c) => c.textContent?.trim())).toEqual(['a', 'b', 'c'])
    ;(chips[0] as HTMLButtonElement).click()
    flushSync()
    // A toggled-off category draws no arc (its value is zeroed).
    expect(el.querySelectorAll('.sv-grid-chart-arc')).toHaveLength(2)
  })

  it('radial columns draw polar rings and category labels; a chord draws ribbons', () => {
    const el = render({ type: 'radial-column', categories: ['a', 'b', 'c'], series: [{ label: 's', values: [1, 2, 3] }] })
    expect(el.querySelectorAll('.sv-grid-chart-arc')).toHaveLength(3)
    expect(el.querySelectorAll('circle.sv-grid-chart-gridline').length).toBeGreaterThan(0)
    expect([...el.querySelectorAll('text.sv-grid-chart-axis')].map((t) => t.textContent)).toEqual(['a', 'b', 'c'])
    unmount(app!); app = null
    const chord = render({
      type: 'chord', categories: [], series: [],
      sankeyNodes: [{ id: 'x' }, { id: 'y' }], sankeyLinks: [{ source: 'x', target: 'y', value: 2 }],
    })
    expect(chord.querySelectorAll('.sv-grid-chart-ribbon')).toHaveLength(1)
    expect(chord.querySelectorAll('.sv-grid-chart-arc')).toHaveLength(2)
  })

  it('lollipops and dumbbells draw stems with dots and no bars', () => {
    const el = render({ type: 'lollipop', categories: ['a', 'b'], series: [{ label: 's', values: [3, 5] }] })
    expect(el.querySelectorAll('.sv-grid-chart-stem')).toHaveLength(2)
    expect(el.querySelectorAll('.sv-grid-chart-stem circle')).toHaveLength(2)
    expect(el.querySelectorAll('.sv-grid-chart-bar')).toHaveLength(0)
    unmount(app!); app = null
    const db = render({ type: 'dumbbell', categories: ['a', 'b'], series: [{ label: 's', values: [3, 5], lowValues: [1, 2] }] })
    expect(db.querySelectorAll('.sv-grid-chart-stem circle')).toHaveLength(4)
    // The category tooltip reads the range.
    ;(db.querySelectorAll('.sv-grid-chart-cat-hit')[0] as SVGElement).dispatchEvent(new FocusEvent('focus'))
    flushSync()
    expect(db.querySelector('.sv-grid-chart-tooltip-row-value')!.textContent).toBe('1 to 3')
  })

  it('a bullet draws ranges, the measure bar and the target tick per row', () => {
    const el = render({
      type: 'bullet', categories: ['Revenue', 'Profit'],
      series: [{ label: 'Actual', values: [270, 23], targets: [250, 26] }],
      bulletRanges: [{ from: 0, to: 150, color: '#eee' }, { from: 150, to: 300, color: '#ddd' }],
    })
    expect(el.querySelectorAll('.sv-grid-chart-bullet')).toHaveLength(2)
    expect(el.querySelectorAll('.sv-grid-chart-bullet-target')).toHaveLength(2)
    expect(el.querySelectorAll('.sv-grid-chart-bullet rect')).toHaveLength(6)
    expect(el.querySelector('.sv-grid-chart-sr-only tbody')!.textContent).toContain('250')
  })

  it('hollow candles fill by the body direction', () => {
    const ohlc = [{ o: 10, h: 12, l: 9, c: 11 }, { o: 11, h: 12, l: 9, c: 10 }]
    const el = render({ type: 'candlestick', categories: ['a', 'b'], series: [{ label: 'p', values: [11, 10], ohlc }], candleStyle: 'hollow' })
    const bodies = el.querySelectorAll('.sv-grid-chart-candle')
    expect(bodies[0]!.getAttribute('fill')).toBe('none')
    expect(bodies[1]!.getAttribute('fill')).not.toBe('none')
  })

  it('a histogram draws touching bars and a brush is refused for the polar types', () => {
    const el = render({ type: 'histogram', categories: ['5', '15', '25'], series: [{ label: 'n', values: [2, 5, 1] }], binEdges: [0, 10, 20, 30], xType: 'number' })
    const bars = [...el.querySelectorAll('.sv-grid-chart-bar')]
    expect(bars).toHaveLength(3)
    const x0 = Number(bars[0]!.getAttribute('x')) + Number(bars[0]!.getAttribute('width'))
    expect(Math.abs(x0 - Number(bars[1]!.getAttribute('x')))).toBeLessThanOrEqual(1)
    unmount(app!); app = null
    const polar = render({ type: 'nightingale', categories: ['a', 'b'], series: [{ label: 's', values: [1, 2] }] }, { brush: true })
    expect(polar.querySelector('.sv-grid-chart-brush')).toBeNull()
  })
})

describe('SvGridChart wave 3: zoom API, sync, menu, keyboard, selection, drilldown, motion', () => {
  const ts: ChartSpec = {
    type: 'line',
    categories: Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)),
    series: [
      { label: 'a', values: Array.from({ length: 30 }, (_, i) => 10 + i) },
      { label: 'b', values: Array.from({ length: 30 }, (_, i) => 40 - i) },
    ],
    xType: 'ordinal-time',
  }

  it('zoomTo / resetZoom narrow and restore the axis, and report through onZoom', () => {
    const seen: unknown[] = []
    target = document.createElement('div')
    document.body.appendChild(target)
    app = mount(SvGridChart, { target, props: { spec: ts, zoomable: true, onZoom: (w: unknown) => seen.push(w) } as any })
    flushSync()
    const hits = () => target!.querySelectorAll('.sv-grid-chart-cat-hit').length
    const before = hits()
    ;(app as unknown as { zoomTo: (w: unknown) => void }).zoomTo({ i0: 5, i1: 9 })
    flushSync()
    expect(hits()).toBe(5)
    expect(seen).toEqual([{ i0: 5, i1: 9 }])
    ;(app as unknown as { resetZoom: () => void }).resetZoom()
    flushSync()
    expect(hits()).toBe(before)
    expect(seen[1]).toBeNull()
  })

  it('range presets show for a time axis and apply a window', () => {
    const el = render(ts, { rangePresets: true, zoomable: true })
    const btns = [...el.querySelectorAll('.sv-grid-chart-preset')].map((b) => b.textContent)
    expect(btns).toEqual(['1W', '1M', '3M', '6M', 'YTD', '1Y', 'All'])
    const hits = () => el.querySelectorAll('.sv-grid-chart-cat-hit').length
    ;(el.querySelector('.sv-grid-chart-preset') as HTMLButtonElement).click()
    flushSync()
    expect(hits()).toBe(8)
    ;([...el.querySelectorAll('.sv-grid-chart-preset')].find((b) => b.textContent === 'All') as HTMLButtonElement).click()
    flushSync()
    expect(hits()).toBe(30)
  })

  it('two charts in a syncGroup share the crosshair', () => {
    const a = render(ts, { syncGroup: 'g1' })
    const t2 = document.createElement('div')
    document.body.appendChild(t2)
    const app2 = mount(SvGridChart, { target: t2, props: { spec: ts, syncGroup: 'g1' } as any })
    flushSync()
    try {
      ;(a.querySelectorAll('.sv-grid-chart-cat-hit')[3] as SVGElement).dispatchEvent(new FocusEvent('focus'))
      flushSync()
      expect(a.querySelector('.sv-grid-chart-crosshair')).toBeTruthy()
      expect(t2.querySelector('.sv-grid-chart-crosshair')).toBeTruthy()
      ;(a.querySelectorAll('.sv-grid-chart-cat-hit')[3] as SVGElement).dispatchEvent(new FocusEvent('blur'))
      flushSync()
      expect(t2.querySelector('.sv-grid-chart-crosshair')).toBeNull()
    } finally {
      unmount(app2)
      t2.remove()
    }
  })

  it('opens a context menu on right-click with the built-in and custom items', async () => {
    const el = render(ts, { contextMenu: [{ label: 'Explain this', onSelect: () => {} }], zoomable: true })
    el.querySelector('.sv-grid-chart-svg')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50, cancelable: true }))
    await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-menu')).toBeTruthy() })
    const labels = [...document.querySelectorAll('.sv-grid-chart-menu [role="menuitem"]')].map((n) => n.textContent?.trim())
    expect(labels).toContain('Download PNG')
    expect(labels).toContain('Download CSV')
    expect(labels).toContain('Explain this')
    expect(labels).toContain('Series')
    document.querySelector('.sv-grid-chart-menu')?.remove()
  })

  it('Shift+F10 on a focused category opens the menu built for that point', async () => {
    const seen: unknown[] = []
    const el = render(ts, { contextMenu: (t: unknown) => { seen.push(t); return [{ label: 'Custom', onSelect: () => {} }] } })
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[4] as SVGElement
    hit.dispatchEvent(new FocusEvent('focus'))
    flushSync()
    // Step onto series b so the target carries a series and a value.
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    flushSync()
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }))
    await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-menu')).toBeTruthy() })
    expect(seen.at(-1)).toEqual({ category: '2026-01-05', index: 4, series: 'b', value: 36 })
    document.querySelector('.sv-grid-chart-menu')?.remove()
  })

  it('arrow keys step series and the live region announces the point', () => {
    const el = render(ts)
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[2] as SVGElement
    hit.dispatchEvent(new FocusEvent('focus'))
    flushSync()
    const live = () => el.querySelector('.sv-grid-chart-live')!.textContent
    // A date category is read out the way the tooltip writes it.
    expect(live()).toContain('Jan 3, 2026')
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    flushSync()
    expect(live()).toBe('a: 12 at Jan 3, 2026')
    // The tooltip narrows to that series.
    expect(el.querySelectorAll('.sv-grid-chart-tooltip-row')).toHaveLength(1)
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    flushSync()
    expect(live()).toBe('b: 38 at Jan 3, 2026')
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    flushSync()
    expect(el.querySelectorAll('.sv-grid-chart-tooltip-row')).toHaveLength(2)
  })

  it('selectable charts track clicked points, dim the rest and report changes', () => {
    const changes: unknown[] = []
    const el = render({ type: 'bar', categories: ['a', 'b', 'c'], series: [{ label: 's', values: [1, 2, 3] }] }, {
      selectable: true, onSelectionChange: (s: unknown) => changes.push(s),
    })
    const bars = el.querySelectorAll('.sv-grid-chart-bar')
    ;(bars[1] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(changes).toEqual([[{ category: 'b', series: 's', index: 1 }]])
    expect(bars[1]!.classList.contains('is-selected')).toBe(true)
    expect((bars[0] as SVGElement).style.opacity).toBe('0.35')
    // Ctrl-click adds; a plain click replaces.
    ;(bars[2] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    flushSync()
    expect(changes[1]).toHaveLength(2)
    ;(bars[0] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(changes[2]).toEqual([{ category: 'a', series: 's', index: 0 }])
  })

  it('a grouped axis repeats its labels, and a click selects one bar, not every bar with that label', () => {
    // Q1..Q4 under 2025 and again under 2026: the label names two bars, the
    // index names one. A ref without an index (an older caller's `selected`)
    // still matches by label.
    const changes: unknown[] = []
    const el = render(
      {
        type: 'bar',
        categories: ['Q1', 'Q2', 'Q1', 'Q2'],
        categoryGroups: [{ label: '2025', span: 2 }, { label: '2026', span: 2 }],
        series: [{ label: 's', values: [1, 2, 3, 4] }],
      },
      { selectable: true, onSelectionChange: (s: unknown) => changes.push(s) },
    )
    const hits = el.querySelectorAll('.sv-grid-chart-cat-hit')
    ;(hits[3] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(changes).toEqual([[{ category: 'Q2', series: 's', index: 3 }]])
    const bars = el.querySelectorAll('.sv-grid-chart-bar')
    expect([...bars].map((b) => b.classList.contains('is-selected'))).toEqual([false, false, false, true])
    expect((bars[1] as SVGElement).style.opacity).toBe('0.35')
    unmount(app!); app = null
    const legacy = render(
      { type: 'bar', categories: ['Q1', 'Q2', 'Q1', 'Q2'], series: [{ label: 's', values: [1, 2, 3, 4] }] },
      { selectable: true, selected: [{ category: 'Q2', series: 's' }] },
    )
    expect(legacy.querySelectorAll('.sv-grid-chart-bar.is-selected')).toHaveLength(2)
  })

  it('a click on the category hit zone selects a point, not a bare category', () => {
    // In a browser the hit zones sit above the bars, so every "bar click"
    // arrives here. A single-series chart resolves to its one series; with
    // several, the series the keyboard stepped onto wins.
    const changes: unknown[] = []
    const el = render({ type: 'bar', categories: ['a', 'b'], series: [{ label: 'only', values: [1, 2] }] }, {
      selectable: true, onSelectionChange: (sel: unknown) => changes.push(sel),
    })
    const hits = el.querySelectorAll('.sv-grid-chart-cat-hit')
    ;(hits[1] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(changes).toEqual([[{ category: 'b', series: 'only', index: 1 }]])
    expect(el.querySelectorAll('.sv-grid-chart-bar.is-selected')).toHaveLength(1)
    unmount(app!); app = null
    const multi = render({ type: 'bar', categories: ['a', 'b'], series: [{ label: 's1', values: [1, 2] }, { label: 's2', values: [3, 4] }] }, {
      selectable: true, onSelectionChange: (sel: unknown) => changes.push(sel),
    })
    const hit = multi.querySelectorAll('.sv-grid-chart-cat-hit')[0] as SVGElement
    hit.dispatchEvent(new FocusEvent('focus'))
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    flushSync()
    expect(changes[1]).toEqual([{ category: 'a', series: 's2', index: 0 }])
  })

  it('a drillable sunburst descends on click and the breadcrumb climbs back', () => {
    const paths: string[][] = []
    const el = render({
      type: 'sunburst', categories: [], series: [],
      tree: { name: 'All', children: [{ name: 'A', children: [{ name: 'A1', value: 3 }, { name: 'A2', value: 1 }] }, { name: 'B', value: 4 }] },
    }, { drillable: true, onSelect: () => paths.push(['leaf']) })
    expect(el.querySelectorAll('.sv-grid-chart-arc')).toHaveLength(4)
    const a = [...el.querySelectorAll('.sv-grid-chart-arc')].find((n) => n.getAttribute('aria-label')?.startsWith('A:'))! as SVGElement
    expect(a.classList.contains('is-drillable')).toBe(true)
    a.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    // Only A's children are drawn now, and the crumb reads All / A.
    expect(el.querySelectorAll('.sv-grid-chart-arc')).toHaveLength(2)
    expect(el.querySelector('.sv-grid-chart-crumbs')!.textContent).toContain('All')
    expect(el.querySelector('.sv-grid-chart-crumb.is-current')!.textContent).toBe('A')
    // A leaf click selects instead of drilling.
    ;(el.querySelector('.sv-grid-chart-arc') as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(paths).toEqual([['leaf']])
    ;(el.querySelector('.sv-grid-chart-crumb') as HTMLButtonElement).click()
    flushSync()
    expect(el.querySelectorAll('.sv-grid-chart-arc')).toHaveLength(4)
  })

  it('a drillable pie draws the tree level by level and descends on a slice click', () => {
    const selects: unknown[] = []
    const el = render({
      type: 'pie', categories: [], series: [],
      tree: { name: 'All', children: [
        { name: 'A', children: [{ name: 'A1', value: 3, color: '#123456' }, { name: 'A2', value: 1 }] },
        { name: 'B', value: 4 },
        { name: 'C', children: [{ name: 'C1', value: 2 }] },
      ] },
    }, { drillable: true, legend: true, onSelect: (sel: unknown) => selects.push(sel) })
    const slices = () => [...el.querySelectorAll('.sv-grid-chart-slice')] as SVGElement[]
    // Top level: A (4), B (4), C (2); A and C drill, B is a leaf.
    expect(slices()).toHaveLength(3)
    expect(slices().map((n) => n.classList.contains('is-drillable'))).toEqual([true, false, true])
    expect([...el.querySelectorAll('.sv-grid-chart-legend-item')].map((n) => n.textContent?.trim())).toEqual(['A', 'B', 'C'])
    expect(el.querySelector('.sv-grid-chart-sr-table, table')!.textContent).toContain('A')
    slices()[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(slices()).toHaveLength(2)
    expect(el.querySelector('.sv-grid-chart-crumb.is-current')!.textContent).toBe('A')
    // A node colour from the tree reaches its slice.
    expect(slices()[0]!.getAttribute('fill')).toBe('#123456')
    // A leaf selects instead of drilling.
    slices()[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(selects).toEqual([{ category: 'A2', series: 'A2', value: 1, rowIds: undefined }])
    expect(slices()).toHaveLength(2)
    ;(el.querySelector('.sv-grid-chart-crumb') as HTMLButtonElement).click()
    flushSync()
    expect(slices()).toHaveLength(3)
  })

  it('the enter effect and the update tween respect the animate prop', () => {
    const grow = render({ type: 'bar', categories: ['a'], series: [{ label: 's', values: [1] }] }, { animate: { enter: 'grow' } })
    expect(grow.querySelector('.sv-grid-chart-marks')!.classList.contains('is-enter-grow')).toBe(true)
    unmount(app!); app = null
    const wipe = render({ type: 'bar', categories: ['a'], series: [{ label: 's', values: [1] }] }, { animate: { enter: 'wipe' } })
    expect(wipe.querySelector('clipPath rect')!.classList.contains('sv-grid-chart-wipe')).toBe(true)
    unmount(app!); app = null
    const none = render({ type: 'bar', categories: ['a'], series: [{ label: 's', values: [1] }] }, { animate: { enter: 'none' } })
    expect(none.querySelector('.sv-grid-chart-marks')!.classList.contains('is-enter-none')).toBe(true)
  })
})

describe('SvGridChart wave 4: last price, flags, bands, drawings, panes', () => {
  const cats = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']
  const priced: ChartSpec = {
    type: 'line',
    categories: cats,
    series: [{ label: 'p', values: [10, 12, 11, 15, 13], overlay: 'bb:3:2' }],
    lastPriceLine: true,
    annotations: [{ at: { category: '2026-01-02' }, label: 'E', shape: 'flag', text: 'Earnings call' }],
    width: 600,
    height: 300,
  }

  it('draws the last-price pill, the Bollinger band and a flag that tells its text on hover', () => {
    const el = render(priced)
    const pill = el.querySelector('.sv-grid-chart-refpill')!
    expect(pill).toBeTruthy()
    expect(pill.querySelector('text')!.textContent).toBe('13')
    expect(pill.querySelector('rect')!.getAttribute('fill')).toBe('#ef4444')
    expect(el.querySelector('.sv-grid-chart-overlay-band')).toBeTruthy()
    const flag = el.querySelector('.sv-grid-chart-annotation-marker.has-text')!
    expect(flag.getAttribute('role')).toBe('img')
    expect(flag.getAttribute('aria-label')).toBe('E: Earnings call')
    expect(flag.querySelector('.sv-grid-chart-annotation-flagtext')!.textContent).toBe('E')
    flag.dispatchEvent(new FocusEvent('focus'))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-tooltip')!.textContent).toContain('Earnings call')
    flag.dispatchEvent(new FocusEvent('blur'))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-tooltip')).toBeNull()
  })

  it('renders the drawings from the spec: a trend line, a ray with its value, six fib levels, an arrowhead, a note', () => {
    const el = render({
      ...priced,
      annotations: [],
      drawings: [
        { id: 't', kind: 'trend', points: [{ x: '2026-01-01', y: 10 }, { x: '2026-01-05', y: 13 }] },
        { id: 'r', kind: 'hray', points: [{ x: '2026-01-03', y: 12 }] },
        { id: 'f', kind: 'fib', points: [{ x: '2026-01-01', y: 10 }, { x: '2026-01-04', y: 15 }] },
        { id: 'a', kind: 'arrow', points: [{ x: '2026-01-02', y: 12 }, { x: '2026-01-04', y: 15 }], color: '#f00' },
        { id: 'n', kind: 'text', points: [{ x: '2026-01-03', y: 14 }], text: 'breakout' },
      ],
    })
    expect(el.querySelectorAll('.sv-grid-chart-drawing')).toHaveLength(5)
    expect(el.querySelector('.sv-grid-chart-drawing.is-hray .sv-grid-chart-drawing-label')!.textContent).toBe('12')
    expect(el.querySelectorAll('.sv-grid-chart-drawing.is-fib .sv-grid-chart-drawing-label')).toHaveLength(6)
    expect(el.querySelector('.sv-grid-chart-drawing.is-arrow path')!.getAttribute('fill')).toBe('#f00')
    expect(el.querySelector('.sv-grid-chart-drawing-text')!.textContent).toBe('breakout')
    // Not drawable: nothing is focusable and there are no tools.
    expect(el.querySelector('.sv-grid-chart-drawing[tabindex]')).toBeNull()
    expect(el.querySelector('.sv-grid-chart-drawtools')).toBeNull()
  })

  it('drawable: the toolbar offers the tools, a selected drawing grows handles and Delete removes it', () => {
    const changes: unknown[] = []
    const el = render({
      ...priced,
      annotations: [],
      drawings: [{ id: 't', kind: 'trend', points: [{ x: '2026-01-01', y: 10 }, { x: '2026-01-05', y: 13 }] }],
    }, { drawable: ['trend', 'hray'], onDrawingsChange: (d: unknown) => changes.push(d) })
    const tools = [...el.querySelectorAll('.sv-grid-chart-drawtool')].map((b) => b.textContent)
    expect(tools).toEqual(['Trend', 'Ray'])
    const drawing = el.querySelector('.sv-grid-chart-drawing') as SVGElement
    expect(drawing.getAttribute('role')).toBe('button')
    drawing.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(drawing.classList.contains('is-selected')).toBe(true)
    expect(el.querySelectorAll('.sv-grid-chart-drawing-handle')).toHaveLength(2)
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    flushSync()
    expect(changes).toEqual([[]])
    // The Clear button empties the list too.
    ;([...el.querySelectorAll('.sv-grid-chart-tool')].find((b) => b.textContent === 'Clear') as HTMLButtonElement).click()
    expect(changes).toHaveLength(2)
  })

  it('drawable: the text tool opens an inline box at the click, Enter keeps the note and Escape drops it', () => {
    const changes: unknown[][] = []
    const el = render({ ...priced, annotations: [] }, { drawable: true, onDrawingsChange: (d: unknown[]) => changes.push(d) })
    // jsdom has no layout; give the svg a box so a client point maps 1:1 to the 600x300 viewBox.
    const svg = el.querySelector('.sv-grid-chart-svg') as SVGSVGElement
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0, toJSON: () => ({}) })
    ;([...el.querySelectorAll('.sv-grid-chart-drawtool')].find((b) => b.textContent === 'Text') as HTMLButtonElement).click()
    flushSync()
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 150 }))
    flushSync()
    const box = el.querySelector('.sv-grid-chart-textdraft') as HTMLInputElement
    expect(box).toBeTruthy()
    expect(document.activeElement).toBe(box)
    box.value = 'breakout'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-textdraft')).toBeNull()
    expect(changes).toHaveLength(1)
    const note = changes[0]![0] as { kind: string; text: string; points: Array<{ x: unknown; y: number }> }
    expect(note.kind).toBe('text')
    expect(note.text).toBe('breakout')
    // Anchored in data space: a category label and a value inside the axis.
    expect(cats).toContain(note.points[0]!.x)
    expect(note.points[0]!.y).toBeGreaterThan(9)
    expect(note.points[0]!.y).toBeLessThan(16)
    // Escape on an empty box drops it without a change.
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 150 }))
    flushSync()
    const again = el.querySelector('.sv-grid-chart-textdraft') as HTMLInputElement
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-textdraft')).toBeNull()
    expect(changes).toHaveLength(1)
  })

  it('drawable: picking a tool turns the plot crosshair and the category click stops selecting', () => {
    const selects: unknown[] = []
    const el = render({ ...priced, annotations: [] }, { drawable: true, onSelect: (s: unknown) => selects.push(s) })
    const btn = [...el.querySelectorAll('.sv-grid-chart-drawtool')].find((b) => b.textContent === 'Trend') as HTMLButtonElement
    btn.click()
    flushSync()
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(el.querySelector('.sv-grid-chart-svg')!.classList.contains('is-drawing')).toBe(true)
    ;(el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushSync()
    expect(selects).toEqual([])
    // Escape drops the tool.
    el.querySelector('.sv-grid-chart-svg')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    flushSync()
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('SvGridChart wave 5: callouts, visible, crosshair pills', () => {
  const pie: ChartSpec = {
    type: 'pie',
    categories: ['Alpha', 'Beta', 'Gamma', 'Sliver'],
    series: [{ label: 'share', values: [50, 30, 19.5, 0.5] }],
  }

  it('dataLabels placement outside draws a leader and a label per slice and drops the inside percent', () => {
    const el = render(pie, { dataLabels: { placement: 'outside' } })
    expect(el.querySelectorAll('.sv-grid-chart-callout')).toHaveLength(3)
    const texts = [...el.querySelectorAll('.sv-grid-chart-callout-label')].map((n) => n.textContent)
    expect(texts).toEqual(['Alpha 50%', 'Beta 30%', 'Gamma 20%'])
    expect(el.querySelector('.sv-grid-chart-datalabel')).toBeNull()
    const anchors = [...el.querySelectorAll('.sv-grid-chart-callout-label')].map((n) => n.getAttribute('text-anchor'))
    expect(anchors).toContain('start')
    expect(anchors).toContain('end')
  })

  it('the spec carries its own dataLabels and the formatter writes the callout text', () => {
    const el = render(
      { ...pie, dataLabels: { placement: 'outside', formatter: (v: number, ctx: { category: string }) => `${ctx.category}=${v}` } },
    )
    expect([...el.querySelectorAll('.sv-grid-chart-callout-label')].map((n) => n.textContent)).toEqual(['Alpha=50', 'Beta=30', 'Gamma=19.5'])
    // The prop wins over the spec.
    unmount(app!); app = null
    const inside = render({ ...pie, dataLabels: { placement: 'outside' } }, { dataLabels: true })
    expect(inside.querySelector('.sv-grid-chart-callout')).toBeNull()
    expect(inside.querySelectorAll('.sv-grid-chart-datalabel').length).toBeGreaterThan(0)
  })

  it('series.visible false starts the series hidden and the legend chip toggles it back', () => {
    const el = render({
      type: 'line',
      categories: ['a', 'b', 'c'],
      series: [
        { label: 'shown', values: [1, 2, 3] },
        { label: 'muted', values: [3, 2, 1], visible: false },
      ],
    }, { legend: true })
    expect(el.querySelectorAll('.sv-grid-chart-linepath')).toHaveLength(1)
    const chip = [...el.querySelectorAll('.sv-grid-chart-legend-item')].find((n) => n.textContent?.trim() === 'muted') as HTMLElement
    expect(chip.classList.contains('is-off')).toBe(true)
    chip.click()
    flushSync()
    expect(el.querySelectorAll('.sv-grid-chart-linepath')).toHaveLength(2)
  })

  it('crosshairLabels pins the hovered category on the x axis and the value under the pointer on the y axis', () => {
    const spec: ChartSpec = { type: 'line', categories: ['Jan', 'Feb', 'Mar'], series: [{ label: 'v', values: [10, 20, 30] }] }
    const el = render(spec)
    const svg = el.querySelector('.sv-grid-chart-svg') as SVGSVGElement
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0, toJSON: () => ({}) })
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement
    hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300, clientY: 150 }))
    flushSync()
    const pills = [...el.querySelectorAll('.sv-grid-chart-crosshair-label text')].map((n) => n.textContent)
    expect(pills[0]).toBe('Feb')
    expect(pills).toHaveLength(2)
    expect(Number(pills[1])).toBeGreaterThan(0)
    expect(Number(pills[1])).toBeLessThanOrEqual(30)
    hit.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    flushSync()
    expect(el.querySelector('.sv-grid-chart-crosshair-label')).toBeNull()
    // Off by prop: the crosshair line stays, the pills go.
    unmount(app!); app = null
    const bare = render(spec, { crosshairLabels: false })
    ;(bare.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement).dispatchEvent(new FocusEvent('focus'))
    flushSync()
    expect(bare.querySelector('.sv-grid-chart-crosshair')).toBeTruthy()
    expect(bare.querySelector('.sv-grid-chart-crosshair-label')).toBeNull()
  })
})

describe('SvGridChart wave 5: series labels and responsive rules', () => {
  const spec: ChartSpec = {
    type: 'line',
    categories: ['a', 'b', 'c'],
    series: [{ label: 'North', values: [1, 2, 3] }, { label: 'South', values: [3, 2, 1] }],
    seriesLabels: true,
  }

  it('draws one end label per line in the series colour and dims it with the series', () => {
    const el = render(spec, { legend: true })
    const labels = () => [...el.querySelectorAll('.sv-grid-chart-serieslabel')] as SVGTextElement[]
    expect(labels().map((n) => n.textContent)).toEqual(['North', 'South'])
    expect(labels()[0]!.getAttribute('fill')).toBe(el.querySelector('.sv-grid-chart-linepath')!.getAttribute('stroke'))
    // Hiding a series through the legend drops its label with the line.
    ;([...el.querySelectorAll('.sv-grid-chart-legend-item')].find((n) => n.textContent?.trim() === 'South') as HTMLElement).click()
    flushSync()
    expect(labels().map((n) => n.textContent)).toEqual(['North'])
  })

  it('a responsive rule patches the drawn spec and moves or hides the legend by the rendered width', () => {
    const rules = [
      { maxWidth: 400, spec: { seriesLabels: false }, legend: false as const },
      { minWidth: 401, legend: 'right' as const },
    ]
    const wide = render({ ...spec, responsive: rules }, { legend: true, width: 700 })
    expect(wide.querySelectorAll('.sv-grid-chart-serieslabel')).toHaveLength(2)
    expect(wide.querySelector('.sv-grid-chart')!.classList.contains('is-legend-right')).toBe(true)
    unmount(app!); app = null
    const narrow = render({ ...spec, responsive: rules }, { legend: true, width: 320 })
    expect(narrow.querySelectorAll('.sv-grid-chart-serieslabel')).toHaveLength(0)
    expect(narrow.querySelector('.sv-grid-chart-legend')).toBeNull()
  })
})

describe('SvGridChart accessibility: roving marks, keyboard zoom, brush, localeText', () => {
  const key = (el: Element, key: string, init: KeyboardEventInit = {}) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
    flushSync()
  }
  const tabs = (el: HTMLElement, sel: string) => [...el.querySelectorAll(sel)].map((n) => n.getAttribute('tabindex'))

  it('a pie is one Tab stop: the slices rove and the arrow keys walk them', () => {
    const el = render({ type: 'pie', categories: ['a', 'b', 'c', 'd'], series: [{ label: 's', values: [4, 3, 2, 1] }] })
    expect(tabs(el, '.sv-grid-chart-slice')).toEqual(['0', '-1', '-1', '-1'])
    const slices = () => [...el.querySelectorAll('.sv-grid-chart-slice')] as SVGElement[]
    expect(slices().map((n) => n.getAttribute('role'))).toEqual(['img', 'img', 'img', 'img'])
    slices()[0]!.focus()
    key(slices()[0]!, 'ArrowRight')
    expect(tabs(el, '.sv-grid-chart-slice')).toEqual(['-1', '0', '-1', '-1'])
    expect(document.activeElement).toBe(slices()[1])
    key(slices()[1]!, 'End')
    expect(tabs(el, '.sv-grid-chart-slice')).toEqual(['-1', '-1', '-1', '0'])
    key(slices()[3]!, 'ArrowRight')
    expect(tabs(el, '.sv-grid-chart-slice')).toEqual(['-1', '-1', '-1', '0'])
    key(slices()[3]!, 'Home')
    expect(document.activeElement).toBe(slices()[0])
    // The focused slice raises its tooltip, like a hovered one.
    expect(el.querySelector('.sv-grid-chart-tooltip')?.textContent).toContain('a')
  })

  it('Enter on a roved slice selects when the chart is selectable, and the role says so', () => {
    const picked: unknown[] = []
    const el = render({ type: 'pie', categories: ['a', 'b'], series: [{ label: 's', values: [1, 2] }] }, { onSelect: (s: unknown) => picked.push(s) })
    const slices = [...el.querySelectorAll('.sv-grid-chart-slice')] as SVGElement[]
    expect(slices[0]!.getAttribute('role')).toBe('button')
    key(slices[1]!, 'Enter')
    expect(picked).toEqual([{ category: 'b', series: 'b', value: 2, rowIds: undefined }])
  })

  it('a heat map and a calendar draw their ramp and no series legend', () => {
    const heat = render({ type: 'heatmap', categories: ['c1', 'c2'], series: [{ label: 'r1', values: [1, 2] }, { label: 'r2', values: [3, 4] }] }, { legend: true })
    expect(heat.querySelector('.sv-grid-chart-legend')).toBeNull()
    expect(heat.querySelectorAll('.sv-grid-chart-heatcell').length).toBe(4)
    unmount(app!); app = null
    const bars = render({ type: 'bar', categories: ['c1', 'c2'], series: [{ label: 'r1', values: [1, 2] }, { label: 'r2', values: [3, 4] }] }, { legend: true })
    expect(bars.querySelectorAll('.sv-grid-chart-legend-item')).toHaveLength(2)
  })

  it('a heat map walks its cells in two dimensions: Right is the next column, Down the next row', () => {
    const el = render({
      type: 'heatmap',
      categories: ['c1', 'c2', 'c3'],
      series: [{ label: 'r1', values: [1, 2, 3] }, { label: 'r2', values: [4, 5, 6] }],
    })
    const cells = () => [...el.querySelectorAll('.sv-grid-chart-heatcell')] as SVGElement[]
    expect(cells()).toHaveLength(6)
    expect(tabs(el, '.sv-grid-chart-heatcell').filter((t) => t === '0')).toHaveLength(1)
    cells()[0]!.focus()
    key(cells()[0]!, 'ArrowRight')
    expect(document.activeElement).toBe(cells()[1])
    key(cells()[1]!, 'ArrowDown')
    expect(document.activeElement).toBe(cells()[4])
    expect(cells()[4]!.getAttribute('aria-label')).toBe('r2 c2: 5')
    key(cells()[4]!, 'ArrowUp')
    expect(document.activeElement).toBe(cells()[1])
  })

  it('tree map cells, funnel segments, sankey nodes, scatter and radar dots are focusable and named', () => {
    const tree = render({ type: 'treemap', categories: [], series: [], tree: { name: 'r', children: [{ name: 'A', value: 3 }, { name: 'B', value: 1 }] } })
    expect(tabs(tree, '.sv-grid-chart-treemap-cell')).toEqual(['0', '-1'])
    unmount(app!); app = null
    const funnel = render({ type: 'funnel', categories: ['Visit', 'Sign up'], series: [{ label: 'n', values: [100, 40] }] })
    expect(tabs(funnel, '.sv-grid-chart-funnel-seg')).toEqual(['0', '-1'])
    expect(funnel.querySelector('.sv-grid-chart-funnel-seg')!.getAttribute('aria-label')).toBe('Visit: 100')
    unmount(app!); app = null
    const sankey = render({ type: 'sankey', categories: [], series: [], sankeyNodes: [{ id: 'a' }, { id: 'b' }], sankeyLinks: [{ source: 'a', target: 'b', value: 5 }] })
    expect(tabs(sankey, '.sv-grid-chart-sankey-node')).toEqual(['0', '-1'])
    expect(sankey.querySelector('.sv-grid-chart-sankey-node')!.getAttribute('aria-label')).toBe('a: in 0, out 5')
    unmount(app!); app = null
    const scatter = render({ type: 'scatter', categories: [], series: [{ label: 'pts', values: [], points: [{ x: 1, y: 2, label: 'p1' }, { x: 3, y: 4 }] }] })
    expect(tabs(scatter, '.sv-grid-chart-scatter')).toEqual(['0', '-1'])
    expect(scatter.querySelector('.sv-grid-chart-scatter')!.getAttribute('aria-label')).toBe('p1: 1, 2')
    unmount(app!); app = null
    const radar = render({ type: 'radar', categories: ['Speed', 'Range'], series: [{ label: 'A', values: [1, 2] }, { label: 'B', values: [2, 1] }] })
    expect(tabs(radar, '.sv-grid-chart-radar-dot')).toEqual(['0', '-1', '-1', '-1'])
    expect(radar.querySelector('.sv-grid-chart-radar-dot')!.getAttribute('aria-label')).toBe('A Speed: 1')
  })

  it('+ / - / 0 zoom a focused category from the keyboard and Shift + arrows pan the window', async () => {
    const cats = Array.from({ length: 20 }, (_, i) => `c${i}`)
    const zooms: unknown[] = []
    const el = render(
      { type: 'line', categories: cats, series: [{ label: 'v', values: cats.map((_, i) => i) }] },
      { zoomable: true, onZoom: (z: unknown) => zooms.push(z) },
    )
    const hits = () => [...el.querySelectorAll('.sv-grid-chart-cat-hit')] as SVGElement[]
    expect(hits()).toHaveLength(20)
    key(hits()[10]!, '+')
    expect(hits().length).toBeLessThan(20)
    const first = zooms[0] as { i0: number; i1: number }
    expect(first.i0).toBeLessThanOrEqual(10)
    expect(first.i1).toBeGreaterThanOrEqual(10)
    await new Promise((r) => setTimeout(r, 0))
    // Focus followed the same category into the narrower window.
    expect(document.activeElement?.getAttribute('data-cat-index')).toBe(String(10 - first.i0))
    key(document.activeElement!, 'ArrowRight', { shiftKey: true })
    const panned = zooms[1] as { i0: number; i1: number }
    expect(panned.i0).toBeGreaterThan(first.i0)
    expect(panned.i1 - panned.i0).toBe(first.i1 - first.i0)
    await new Promise((r) => setTimeout(r, 0))
    key(document.activeElement!, '-')
    const wider = zooms[2] as { i0: number; i1: number } | null
    expect(wider === null || wider.i1 - wider.i0 > panned.i1 - panned.i0).toBe(true)
    key(document.activeElement!, '0')
    expect(zooms[zooms.length - 1]).toBeNull()
    expect(hits()).toHaveLength(20)
  })

  it('the brush strip keeps its whole height for the mini-map: no title, labels or marks inherited from the spec', () => {
    // A title and subtitle alone reserved 45 of the strip's 88 pixels, and
    // the mini-map was a five-pixel smear under an empty band.
    const cats = Array.from({ length: 30 }, (_, i) => `d${i}`)
    const spec: ChartSpec = {
      type: 'line', categories: cats, width: 600,
      series: [{ label: 'v', values: cats.map((_, i) => 10 + (i % 7) * 5) }],
      title: 'A title', subtitle: 'and a subtitle', caption: 'and a caption',
      seriesLabels: true, dataLabels: { show: true },
      referenceBands: [{ from: 'd3', to: 'd5', axis: 'x', label: 'band' }],
      annotations: [{ at: { category: 'd10' }, label: 'note' }],
    }
    const el = render(spec, { zoomable: true, brush: true, brushHeight: 88 })
    const brush = el.querySelector('.sv-grid-chart-brush') as SVGElement
    const window = brush.querySelector('.sv-grid-chart-brush-window')!
    // The window rect spans the strip, not a sliver at its foot.
    expect(Number(window.getAttribute('height'))).toBeGreaterThan(50)
    expect(Number(window.getAttribute('y'))).toBeLessThan(20)
    // Nothing but the mini-map is drawn in it.
    expect(brush.querySelectorAll('text').length).toBe(0)
    expect(brush.querySelector('path')).toBeTruthy()
  })

  it('the brush is a slider: arrows pan and resize the window, Home / End push it to the ends, 0 resets', () => {
    const cats = Array.from({ length: 30 }, (_, i) => `d${i}`)
    const el = render({ type: 'line', categories: cats, series: [{ label: 'v', values: cats.map((_, i) => i) }] }, { zoomable: true, brush: true })
    const brush = el.querySelector('.sv-grid-chart-brush') as SVGElement
    expect(brush.getAttribute('role')).toBe('slider')
    expect(brush.getAttribute('tabindex')).toBe('0')
    expect(brush.getAttribute('aria-valuemax')).toBe('29')
    expect(brush.getAttribute('aria-valuetext')).toBe('d0 to d29')
    const hits = () => el.querySelectorAll('.sv-grid-chart-cat-hit').length
    key(brush, 'ArrowUp')
    const narrowed = hits()
    expect(narrowed).toBeLessThan(30)
    expect(brush.getAttribute('aria-valuetext')).not.toBe('d0 to d29')
    key(brush, 'End')
    expect(brush.getAttribute('aria-valuetext')).toMatch(/ to d29$/)
    expect(hits()).toBe(narrowed)
    key(brush, 'ArrowLeft')
    expect(brush.getAttribute('aria-valuetext')).not.toMatch(/ to d29$/)
    key(brush, 'Home')
    expect(brush.getAttribute('aria-valuetext')).toMatch(/^d0 to /)
    key(brush, '0')
    expect(hits()).toBe(30)
    expect(brush.getAttribute('aria-valuenow')).toBe('0')
  })

  it('localeText translates the toolbar, the legend hints, the image label and the data table', () => {
    const el = render(
      { type: 'bar', categories: ['a'], series: [{ label: 's', values: [1] }] },
      { toolbar: true, legend: true, localeText: { png: 'Bild', downloadPng: 'Als PNG speichern', chartLabel: 'Diagramm ({type})', dataTable: 'Daten: {type}', hideSeries: 'Ausblenden', isolateHint: 'Doppelklick isoliert' } },
    )
    const png = [...el.querySelectorAll('.sv-grid-chart-tool')].find((b) => b.textContent?.trim() === 'Bild') as HTMLButtonElement
    expect(png).toBeTruthy()
    expect(png.getAttribute('title')).toBe('Als PNG speichern')
    expect(el.querySelector('.sv-grid-chart-svg')!.getAttribute('aria-label')).toBe('Diagramm (bar)')
    expect(el.querySelector('caption')!.textContent!.trim()).toBe('Daten: bar')
    expect(el.querySelector('.sv-grid-chart-legend-item')!.getAttribute('title')).toBe('Ausblenden s \u00b7 Doppelklick isoliert')
    // Unset keys stay English.
    expect([...el.querySelectorAll('.sv-grid-chart-tool')].some((b) => b.textContent?.trim() === 'SVG')).toBe(true)
    expect(el.querySelector('.sv-grid-chart-toolbar')!.getAttribute('role')).toBe('toolbar')
  })
})

describe('SvGridChart overlays in the tooltip', () => {
  it('lists the regression value at the category with its R-squared, and a moving average without one', () => {
    const el = render({
      type: 'line',
      categories: ['a', 'b', 'c', 'd', 'e', 'f'],
      series: [
        { label: 'sales', values: [1, 2, 3, 4, 5, 6], overlay: 'poly:2' },
        { label: 'cost', values: [2, 2, 2, 2, 2, 2], overlay: 'sma:2' },
      ],
    })
    ;(el.querySelectorAll('.sv-grid-chart-cat-hit')[3] as SVGElement).dispatchEvent(new FocusEvent('focus'))
    flushSync()
    const rows = [...el.querySelectorAll('.sv-grid-chart-tooltip-row')].map((r) => r.textContent?.replace(/\s+/g, ' ').trim())
    expect(rows.some((r) => /sales poly 2.*4.*R\u00b2 1\.00/.test(r ?? ''))).toBe(true)
    expect(rows.some((r) => /cost SMA 2.*2$/.test(r ?? '') && !/R\u00b2/.test(r ?? ''))).toBe(true)
  })
})

describe('SvGridChart hover highlight and onHover', () => {
  const spec: ChartSpec = {
    type: 'line',
    categories: ['a', 'b', 'c'],
    series: [{ label: 'high', values: [90, 90, 90] }, { label: 'low', values: [10, 10, 10] }],
    width: 600,
    height: 300,
  }
  const mock = (el: HTMLElement) => {
    const svg = el.querySelector('.sv-grid-chart-svg') as SVGSVGElement
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0, toJSON: () => ({}) })
    return svg
  }
  const lineOpacity = (el: HTMLElement) =>
    [...el.querySelectorAll('.sv-grid-chart-linepath')].map((n) => (n.parentElement as HTMLElement).style.opacity)
  const move = (el: Element, clientX: number, clientY: number) => {
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }))
    flushSync()
  }
  const yOfLine = (el: HTMLElement, label: string) => {
    // The line's first point y from its path, mapped to client space (1:1 here).
    const geoPath = [...el.querySelectorAll('.sv-grid-chart-linepath')].map((n) => n.getAttribute('d')!)
    const idx = label === 'high' ? 0 : 1
    return Number(/M[\d.]+,([\d.]+)/.exec(geoPath[idx]!)![1])
  }

  it('hovering near a line dims the other series and reports the point once', () => {
    const points: unknown[] = []
    const el = render(spec, { onHover: (p: unknown) => points.push(p) })
    mock(el)
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement
    move(hit, 300, yOfLine(el, 'high') + 4)
    expect(lineOpacity(el)).toEqual(['1', '0.18'])
    move(hit, 301, yOfLine(el, 'high') + 4)
    expect(points).toEqual([{ category: 'b', index: 1, series: undefined, value: undefined }].map((x) => ({ ...x, series: null, value: null })))
    hit.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    flushSync()
    expect(lineOpacity(el)).toEqual(['1', '1'])
    expect(points[points.length - 1]).toBeNull()
    expect(points).toHaveLength(2)
  })

  it('a pointer far from every mark dims nothing, and hoverHighlight false never dims but still reports', () => {
    const el = render(spec)
    mock(el)
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[1] as SVGElement
    const mid = (yOfLine(el, 'high') + yOfLine(el, 'low')) / 2
    move(hit, 300, mid)
    expect(lineOpacity(el)).toEqual(['1', '1'])
    unmount(app!); app = null
    const points: unknown[] = []
    const off = render(spec, { hoverHighlight: false, onHover: (p: unknown) => points.push(p) })
    mock(off)
    const hit2 = off.querySelectorAll('.sv-grid-chart-cat-hit')[2] as SVGElement
    move(hit2, 500, yOfLine(off, 'low') + 2)
    expect(lineOpacity(off)).toEqual(['1', '1'])
    expect(points).toEqual([{ category: 'c', index: 2, series: null, value: null }])
  })

  it('single tooltip mode names the nearest series in the report', () => {
    const points: Array<{ series: string | null; value: number | null }> = []
    const el = render(spec, { tooltipMode: 'single', onHover: (p: { series: string | null; value: number | null }) => points.push(p) })
    mock(el)
    const hit = el.querySelectorAll('.sv-grid-chart-cat-hit')[0] as SVGElement
    move(hit, 100, yOfLine(el, 'low') + 3)
    expect(points[0]).toEqual({ category: 'a', index: 0, series: 'low', value: 10 })
    expect(lineOpacity(el)).toEqual(['0.18', '1'])
  })
})

describe('SvGridChart tooltip position and sticky tooltips', () => {
  const spec: ChartSpec = {
    type: 'bar',
    categories: ['a', 'b', 'c'],
    series: [{ label: 's', values: [1, 2, 3] }],
    width: 600,
    height: 300,
  }
  const mock = (el: HTMLElement) => {
    const box = { left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }
    ;(el.querySelector('.sv-grid-chart-svg') as SVGSVGElement).getBoundingClientRect = () => box
    ;(el.querySelector('.sv-grid-chart') as HTMLElement).getBoundingClientRect = () => box
  }
  const hover = (el: HTMLElement, i: number, x = 300, y = 150) => {
    el.querySelectorAll('.sv-grid-chart-cat-hit')[i]!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }))
    flushSync()
  }
  const tipEl = (el: HTMLElement) => el.querySelector('.sv-grid-chart-tooltip') as HTMLElement | null

  it('a corner position pins the tooltip at the plot corner without the follow transform', () => {
    const el = render(spec, { tooltipPosition: 'top-right' })
    mock(el)
    hover(el, 1)
    const t = tipEl(el)!
    expect(t.classList.contains('is-fixed')).toBe(true)
    expect(t.classList.contains('is-right')).toBe(true)
    expect(t.classList.contains('is-below')).toBe(false)
    // At the plot's top-right corner (inset 8px), not at the pointer.
    const plotRight = Number(/x="([\d.]+)"/.exec(el.querySelectorAll('.sv-grid-chart-cat-hit')[2]!.outerHTML)![1]) + Number(el.querySelectorAll('.sv-grid-chart-cat-hit')[2]!.getAttribute('width'))
    expect(parseFloat(t.style.left)).toBeCloseTo(plotRight - 8, 0)
    expect(parseFloat(t.style.top)).toBeLessThan(60)
    hover(el, 0, 100, 250)
    expect(parseFloat(tipEl(el)!.style.left)).toBeCloseTo(plotRight - 8, 0)
  })

  it('sticky pins on click, survives the pointer leaving, and releases on Escape or a second click', () => {
    const el = render(spec, { tooltipSticky: true })
    mock(el)
    const hits = el.querySelectorAll('.sv-grid-chart-cat-hit')
    hover(el, 1)
    hits[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 150 }))
    flushSync()
    expect(tipEl(el)!.classList.contains('is-pinned')).toBe(true)
    const title = tipEl(el)!.querySelector('.sv-grid-chart-tooltip-title')!.textContent
    expect(title).toBe('b')
    hits[1]!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    flushSync()
    expect(tipEl(el)).toBeTruthy()
    // Another category does not move a pinned tooltip.
    hover(el, 2, 500, 150)
    expect(tipEl(el)!.querySelector('.sv-grid-chart-tooltip-title')!.textContent).toBe('b')
    el.querySelector('.sv-grid-chart-svg')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    flushSync()
    expect(tipEl(el)).toBeNull()
    // Pin again, then release with a second click on the same category.
    hover(el, 0, 100, 150)
    hits[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 150 }))
    flushSync()
    expect(tipEl(el)!.classList.contains('is-pinned')).toBe(true)
    hits[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 150 }))
    flushSync()
    expect(tipEl(el)).toBeNull()
  })

  it('a pointer down outside the chart releases a pinned tooltip', () => {
    const el = render(spec, { tooltipSticky: true })
    mock(el)
    hover(el, 1)
    el.querySelectorAll('.sv-grid-chart-cat-hit')[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 150 }))
    flushSync()
    expect(tipEl(el)!.classList.contains('is-pinned')).toBe(true)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    flushSync()
    expect(tipEl(el)).toBeNull()
  })
})

describe('SvGridChart data-label leaders and rotation', () => {
  it('draws a leader per pushed label and rotates the text', () => {
    const el = render(
      {
        type: 'bar',
        categories: Array.from({ length: 12 }, (_, i) => `c${i}`),
        series: [{ label: 's', values: Array.from({ length: 12 }, (_, i) => 1000 + i) }],
        width: 260,
        height: 200,
      },
      { dataLabels: { connector: true, rotation: -30 } },
    )
    expect(el.querySelectorAll('.sv-grid-chart-datalabel-leader').length).toBeGreaterThan(0)
    const t = el.querySelector('.sv-grid-chart-datalabel') as SVGTextElement
    expect(t.getAttribute('transform')).toMatch(/^rotate\(-30 /)
  })
})

describe('SvGridChart spec.style', () => {
  it('lands on the host as custom properties and a font, and stays off when unset', () => {
    const el = render({
      type: 'bar',
      categories: ['a'],
      series: [{ label: 's', values: [1] }],
      style: { background: '#101820', textColor: '#f4f4f4', fontSize: 14, fontFamily: 'Georgia, serif' },
    })
    const host = el.querySelector('.sv-grid-chart') as HTMLElement
    expect(host.style.getPropertyValue('--sg-chart-bg')).toBe('#101820')
    expect(host.style.getPropertyValue('--sg-fg')).toBe('#f4f4f4')
    expect(host.style.getPropertyValue('--sg-chart-font-scale')).toBe('1.167')
    expect(host.style.fontFamily).toBe('Georgia, serif')
    unmount(app!); app = null
    const plain = render({ type: 'bar', categories: ['a'], series: [{ label: 's', values: [1] }] })
    expect((plain.querySelector('.sv-grid-chart') as HTMLElement).getAttribute('style')).toBeNull()
  })
})

describe('SvGridChart dev diagnostics', () => {
  it('warns once per spec object about what is off, and not at all for a clean spec', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const bad = { type: 'bar', categories: ['a', 'b'], series: [{ label: 's', values: [1] }], serie: [] } as unknown as ChartSpec
      const el = render(bad)
      await vi.waitFor(() => expect(warn).toHaveBeenCalled())
      const msgs = warn.mock.calls.map((c) => String(c[0]))
      expect(msgs.some((m) => m.includes('[SvChart] serie:') && m.includes('did you mean "series"'))).toBe(true)
      expect(msgs.some((m) => m.includes('series[0].values: 1 values for 2 categories'))).toBe(true)
      const count = warn.mock.calls.length
      // The same object again: nothing new.
      unmount(app!); app = null
      render(bad)
      await new Promise((r) => setTimeout(r, 20))
      expect(warn.mock.calls.length).toBe(count)
      unmount(app!); app = null
      warn.mockClear()
      render({ type: 'bar', categories: ['a', 'b'], series: [{ label: 's', values: [1, 2] }] })
      await new Promise((r) => setTimeout(r, 20))
      expect(warn).not.toHaveBeenCalled()
      void el
    } finally {
      warn.mockRestore()
    }
  })
})

describe('SvGridChart describe', () => {
  const spec: ChartSpec = {
    type: 'line',
    categories: ['Jan', 'Feb', 'Mar'],
    series: [{ label: 'Revenue', values: [100, 120, 150] }],
  }

  it('sets aria-description and the caption from the summary, and the menu copies it', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { written.push(t) } }, configurable: true })
    const el = render(spec, { contextMenu: true })
    const svg = el.querySelector('.sv-grid-chart-svg')!
    await vi.waitFor(() => expect(svg.getAttribute('aria-description')).toContain('Revenue rises 50%'))
    expect(el.querySelector('caption')!.textContent).toContain('Revenue rises 50% from 100 at Jan to 150 at Mar.')
    svg.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50, cancelable: true }))
    await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-menu')).toBeTruthy() })
    const item = [...document.querySelectorAll('.sv-grid-chart-menu [role="menuitem"]')].find((n) => n.textContent?.trim() === 'Describe chart') as HTMLElement
    expect(item).toBeTruthy()
    item.click()
    await vi.waitFor(() => expect(written).toEqual(['Revenue rises 50% from 100 at Jan to 150 at Mar.']))
    await vi.waitFor(() => expect(el.querySelector('.sv-grid-chart-live')!.textContent).toContain('Description copied'))
    document.querySelector('.sv-grid-chart-menu')?.remove()
  })

  it('describe false leaves the description and the menu item out', async () => {
    const el = render(spec, { describe: false, contextMenu: true })
    await new Promise((r) => setTimeout(r, 30))
    expect(el.querySelector('.sv-grid-chart-svg')!.getAttribute('aria-description')).toBeNull()
    el.querySelector('.sv-grid-chart-svg')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50, cancelable: true }))
    await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-menu')).toBeTruthy() })
    const labels = [...document.querySelectorAll('.sv-grid-chart-menu [role="menuitem"]')].map((n) => n.textContent?.trim())
    expect(labels).not.toContain('Describe chart')
    document.querySelector('.sv-grid-chart-menu')?.remove()
  })
})

describe('SvGridChart live', () => {
  it('skips the enter effect and the update tween while animate is on', () => {
    const spec: ChartSpec = { type: 'bar', categories: ['a'], series: [{ label: 's', values: [1] }] }
    const el = render(spec, { animate: { enter: 'grow' }, live: true })
    expect(el.querySelector('.sv-grid-chart-marks')!.classList.contains('is-enter-none')).toBe(true)
    expect(el.querySelector('.sv-grid-chart-marks')!.classList.contains('is-enter-grow')).toBe(false)
    unmount(app!); app = null
    // Without live the same props grow in.
    const plain = render(spec, { animate: { enter: 'grow' } })
    expect(plain.querySelector('.sv-grid-chart-marks')!.classList.contains('is-enter-grow')).toBe(true)
  })
})
