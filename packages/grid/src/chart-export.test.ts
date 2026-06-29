import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chartToSvgString,
  chartToPngBlob,
  downloadChartSvg,
  downloadChartPng,
} from './chart-export'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Build a small but realistic chart SVG matching the structure
 * chart-export expects: `svg.sv-grid-chart-svg` with a viewBox, an
 * interaction hit layer (`.sv-grid-chart-hit`) that the exporter must
 * strip, plus a few themed nodes.
 */
function makeChartSvg(opts: { viewBox?: string } = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
  svg.setAttribute('class', 'sv-grid-chart-svg')
  svg.setAttribute('viewBox', opts.viewBox ?? '0 0 400 250')

  const axis = document.createElementNS(SVG_NS, 'text')
  axis.setAttribute('class', 'sv-grid-chart-axis')
  axis.textContent = 'A'
  svg.appendChild(axis)

  const hit = document.createElementNS(SVG_NS, 'rect')
  hit.setAttribute('class', 'sv-grid-chart-hit')
  svg.appendChild(hit)

  const bar = document.createElementNS(SVG_NS, 'rect')
  bar.setAttribute('class', 'sv-grid-chart-bar')
  svg.appendChild(bar)

  return svg
}

describe('chartToSvgString', () => {
  it('serializes the chart svg passed directly as an SVGSVGElement', () => {
    const svg = makeChartSvg()
    const out = chartToSvgString(svg)
    expect(out).toContain('<svg')
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('resolves the inner svg.sv-grid-chart-svg from a wrapping element', () => {
    const wrap = document.createElement('div')
    wrap.appendChild(makeChartSvg())
    const out = chartToSvgString(wrap)
    expect(out).toContain('<svg')
  })

  it('falls back to a plain inner <svg> when the class svg is absent', () => {
    const wrap = document.createElement('div')
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
    svg.setAttribute('viewBox', '0 0 100 100')
    wrap.appendChild(svg)
    const out = chartToSvgString(wrap)
    expect(out).toContain('<svg')
  })

  it('throws when no <svg> can be found', () => {
    const div = document.createElement('div')
    expect(() => chartToSvgString(div)).toThrow(/no <svg> found/)
  })

  it('inlines a <style> block with concrete theme colors', () => {
    const out = chartToSvgString(makeChartSvg())
    expect(out).toContain('<style')
    expect(out).toContain('.sv-grid-chart-axis')
    expect(out).toContain('.sv-grid-chart-datalabel')
    expect(out).toContain('.sv-grid-chart-donut-total')
    // default fallbacks used when no --sg-* vars are set in jsdom
    expect(out).toContain('#0f172a') // --sg-fg fallback
    expect(out).toContain('#64748b') // --sg-muted fallback
    expect(out).toContain('#e2e8f0') // --sg-border fallback
  })

  it('strips interaction-only hit layers from the export', () => {
    const out = chartToSvgString(makeChartSvg())
    expect(out).not.toContain('sv-grid-chart-hit')
    // but keeps the real content
    expect(out).toContain('sv-grid-chart-bar')
  })

  it('sets width/height from the viewBox and inserts a background rect', () => {
    const out = chartToSvgString(makeChartSvg({ viewBox: '0 0 400 250' }))
    expect(out).toContain('width="400"')
    expect(out).toContain('height="250"')
    // background rect spans the full size with the default --sg-bg fallback
    expect(out).toMatch(/<rect[^>]*fill="#ffffff"/)
  })

  it('honors a custom background option over the theme default', () => {
    const out = chartToSvgString(makeChartSvg(), { background: 'tomato' })
    expect(out).toMatch(/<rect[^>]*fill="tomato"/)
    expect(out).not.toContain('fill="#ffffff"')
  })

  it('falls back to client size / defaults when no usable viewBox', () => {
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
    svg.setAttribute('class', 'sv-grid-chart-svg')
    // No viewBox attribute => baseVal width 0; jsdom clientWidth is 0 too,
    // so the exporter uses its 520x300 hard fallback.
    const out = chartToSvgString(svg)
    expect(out).toContain('width="520"')
    expect(out).toContain('height="300"')
  })

  it('reads --sg-* css variables when present on the element', () => {
    const svg = makeChartSvg()
    svg.style.setProperty('--sg-fg', '#112233')
    svg.style.setProperty('--sg-muted', '#445566')
    document.body.appendChild(svg)
    try {
      const out = chartToSvgString(svg)
      expect(out).toContain('#112233')
      expect(out).toContain('#445566')
    } finally {
      svg.remove()
    }
  })
})

describe('downloadChartSvg', () => {
  let createSpy: ReturnType<typeof vi.spyOn>
  let revokeSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:fake-url')
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    clickSpy = vi.fn()
    // jsdom anchors don't navigate; stub click to observe the download.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('creates a blob url, triggers an anchor download, then revokes', () => {
    downloadChartSvg(makeChartSvg(), 'my-chart.svg')

    expect(createSpy).toHaveBeenCalledTimes(1)
    const blob = createSpy.mock.calls[0]![0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/svg+xml')
    expect(clickSpy).toHaveBeenCalledTimes(1)

    // revoke is scheduled on a timer
    expect(revokeSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url')
  })

  it('removes the temporary anchor from the DOM after clicking', () => {
    const before = document.querySelectorAll('a').length
    downloadChartSvg(makeChartSvg())
    expect(document.querySelectorAll('a').length).toBe(before)
  })

  it('uses the default filename when none is given', () => {
    let captured: string | undefined
    vi.spyOn(HTMLAnchorElement.prototype, 'download', 'set').mockImplementation(
      function (this: HTMLAnchorElement, v: string) {
        captured = v
      },
    )
    downloadChartSvg(makeChartSvg())
    expect(captured).toBe('chart.svg')
  })
})

describe('chartToPngBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubImage(behavior: 'load' | 'error') {
    // jsdom's Image never fires load/error for a blob: src, so replace it
    // with a controllable fake that triggers the chosen callback.
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private _src = ''
      set src(_v: string) {
        this._src = _v
        queueMicrotask(() => {
          if (behavior === 'load') this.onload?.()
          else this.onerror?.()
        })
      }
      get src() {
        return this._src
      }
    }
    vi.stubGlobal('Image', FakeImage)
  }

  it('rejects when the SVG image fails to rasterize', async () => {
    stubImage('error')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await expect(chartToPngBlob(makeChartSvg())).rejects.toThrow(
      /failed to rasterize/,
    )
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })

  it('rejects when a 2d canvas context is unavailable', async () => {
    stubImage('load')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      null as never,
    )

    await expect(chartToPngBlob(makeChartSvg())).rejects.toThrow(
      /canvas 2d context unavailable/,
    )
  })

  it('resolves a PNG blob once drawImage + toBlob succeed', async () => {
    stubImage('load')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      cb(new Blob(['png-bytes'], { type: 'image/png' }))
    } as never)

    const blob = await chartToPngBlob(makeChartSvg({ viewBox: '0 0 400 250' }), {
      scale: 3,
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    expect(drawImage).toHaveBeenCalledTimes(1)
  })

  it('rejects when toBlob yields null', async () => {
    stubImage('load')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      cb(null)
    } as never)

    await expect(chartToPngBlob(makeChartSvg())).rejects.toThrow(/toBlob failed/)
  })

  it('scales the canvas by options.scale (default 2)', async () => {
    stubImage('load')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never)

    let canvasW = -1
    let canvasH = -1
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      canvasW = this.width
      canvasH = this.height
      cb(new Blob([], { type: 'image/png' }))
    } as never)

    // viewBox 400x250, default scale 2 => 800x500
    await chartToPngBlob(makeChartSvg({ viewBox: '0 0 400 250' }))
    expect(canvasW).toBe(800)
    expect(canvasH).toBe(500)
  })

  it('falls back to the 520x300 default size when there is no viewBox', async () => {
    stubImage('load')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never)

    let canvasW = -1
    let canvasH = -1
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      canvasW = this.width
      canvasH = this.height
      cb(new Blob([], { type: 'image/png' }))
    } as never)

    // No viewBox + jsdom clientWidth 0 => 520x300 hard fallback, scale 2.
    const noVb = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
    noVb.setAttribute('class', 'sv-grid-chart-svg')
    await chartToPngBlob(noVb)
    expect(canvasW).toBe(1040)
    expect(canvasH).toBe(600)
  })
})

describe('downloadChartPng', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('rasterizes then downloads via an anchor and revokes the url', async () => {
    vi.useFakeTimers()
    // Make chartToPngBlob succeed.
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:png-url')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      cb(new Blob(['p'], { type: 'image/png' }))
    } as never)
    const click = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
    let filename: string | undefined
    vi.spyOn(HTMLAnchorElement.prototype, 'download', 'set').mockImplementation(
      function (this: HTMLAnchorElement, v: string) {
        filename = v
      },
    )

    const p = downloadChartPng(makeChartSvg(), 'pic.png')
    // flush the microtask-driven image onload + promise chain
    await vi.runAllTimersAsync()
    await p

    expect(click).toHaveBeenCalledTimes(1)
    expect(filename).toBe('pic.png')
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith('blob:png-url')
  })
})
