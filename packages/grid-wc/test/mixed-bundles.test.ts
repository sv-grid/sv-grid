import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Three element builds on ONE page: <sv-grid>, <sv-grid-shadow> and <sv-chart>.
 *
 * The docs pair <sv-grid> with <sv-chart> (rowsToChartSpec), so a page loading
 * more than one build is the normal case. Each build used to inject an unkeyed
 * `style[data-svgrid-grid-wc]` and skip if one existed, and all three wrote the
 * same CSS global. The first bundle's <style> blocked the others and the last
 * one's CSS won the global, so the chart painted a solid black area and showed
 * its hidden data table. Real-browser coverage: test/mixed.html.
 */
class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type CssMap = Record<string, string>
const cssMap = () => (globalThis as { __SVGRID_WC_CSS_BY_BUILD__?: CssMap }).__SVGRID_WC_CSS_BY_BUILD__ ?? {}

beforeAll(async () => {
  // @ts-expect-error - assigning a test shim
  globalThis.ResizeObserver ??= ResizeObserverShim
  // Grid first, chart last: the order that used to leave the chart unstyled.
  await import('../dist/sv-grid-element.js')
  await import('../dist/shadow/sv-grid-shadow-element.js')
  await import('../dist/chart/sv-chart-element.js')
})

describe('grid, shadow and chart bundles on one page', () => {
  it('registers all three elements', () => {
    expect(customElements.get('sv-grid')).toBeTruthy()
    expect(customElements.get('sv-grid-shadow')).toBeTruthy()
    expect(customElements.get('sv-chart')).toBeTruthy()
  })

  it('keeps one CSS global entry per build, none overwriting another', () => {
    const map = cssMap()
    expect(Object.keys(map).sort()).toEqual(['chart', 'grid', 'shadow'])
    for (const css of Object.values(map)) expect(css.length).toBeGreaterThan(1000)
    // The chart build's sheet is its own, not the grid's.
    expect(map.chart).not.toBe(map.grid)
  })

  it("injects the chart's head <style> even though the grid's loaded first", () => {
    const chart = document.querySelector('style[data-svgrid-grid-wc="chart"]')
    expect(chart).toBeTruthy()
    expect(chart!.textContent).toBe(cssMap().chart)
    expect(document.querySelector('style[data-svgrid-grid-wc="grid"]')!.textContent).toBe(cssMap().grid)
  })

  it('does not duplicate a sheet another build already injected verbatim', () => {
    // The grid and shadow builds compile the same grid CSS; one head copy
    // serves both. A different sheet (the chart's) still gets its own.
    const texts = [...document.querySelectorAll('style[data-svgrid-grid-wc]')].map((s) => s.textContent)
    expect(new Set(texts).size).toBe(texts.length)
    if (cssMap().shadow === cssMap().grid) {
      expect(document.querySelector('style[data-svgrid-grid-wc="shadow"]')).toBeNull()
    } else {
      expect(document.querySelector('style[data-svgrid-grid-wc="shadow"]')).toBeTruthy()
    }
  })
})
