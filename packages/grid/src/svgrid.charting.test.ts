/**
 * Built-in integrated charting (`charting` prop on <SvGrid>): the docked chart
 * panel, its live derivation from displayed rows + selection, and the
 * chart-click -> grid cross-filter loop.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  chartSpecToCsv,
  formatChartValue,
  buildChart,
} from './index'
import type { ChartAggregateRequest, ColumnDef, SvGridApi } from './index'

type Person = { id: number; name: string; team: string; age: number; salary: number }

const features = tableFeatures({ columnFilteringFeature, rowSelectionFeature, rowSortingFeature })

const people: Person[] = [
  { id: 1, name: 'Ada', team: 'Research', age: 38, salary: 120 },
  { id: 2, name: 'Grace', team: 'Compilers', age: 42, salary: 150 },
  { id: 3, name: 'Alan', team: 'Research', age: 41, salary: 130 },
  { id: 4, name: 'Margaret', team: 'Apollo', age: 35, salary: 160 },
  { id: 5, name: 'Linus', team: 'Kernel', age: 54, salary: 175 },
  { id: 6, name: 'Donald', team: 'Research', age: 86, salary: 110 },
]

const columns: ColumnDef<typeof features, Person>[] = [
  { field: 'name', header: 'Name', width: 160 },
  { field: 'team', header: 'Team', width: 160 },
  { field: 'age', header: 'Age', width: 100, cellDataType: 'number' },
  { field: 'salary', header: 'Salary', width: 100, cellDataType: 'number' },
]

type MountResult = { api: SvGridApi<typeof features, Person>; target: HTMLElement; destroy: () => void }

function mountGrid(overrides: Record<string, unknown> = {}): Promise<MountResult> {
  return new Promise((resolve, reject) => {
    const target = document.createElement('div')
    target.style.width = '1000px'
    target.style.height = '600px'
    document.body.appendChild(target)
    const app = mount(SvGrid, {
      target,
      props: {
        data: people,
        columns,
        features,
        _rowModels: {
          coreRowModel: createCoreRowModel(),
          filteredRowModel: createFilteredRowModel(),
          sortedRowModel: createSortedRowModel(sortFns),
        },
        rowHeight: 36,
        containerHeight: 480,
        virtualization: false,
        onApiReady(api: SvGridApi<typeof features, Person>) {
          resolve({ api, target, destroy: () => { unmount(app); target.remove() } })
        },
        ...overrides,
      } as any,
    })
    queueMicrotask(() => reject(new Error('onApiReady never fired')))
  })
}

// A macrotask boundary: drains all pending microtasks (Svelte effects, the chart
// panel's lazy import() + its .then, and the follow-up flush) so the docked panel
// is mounted before assertions. The panel is loaded lazily as its own chunk.
const tick = () => new Promise((r) => setTimeout(r))

describe('SvGrid built-in charting', () => {
  it('derives a chart spec from all displayed rows (default dimension + measure)', async () => {
    const { api, destroy } = await mountGrid({ charting: true })
    await tick() // the chart engine loads lazily; ready a tick after mount
    try {
      const spec = api.getChartSpec()
      expect(spec).not.toBeNull()
      expect(spec!.type).toBe('bar')
      // Default dimension is the first text column (name), one category per row.
      expect(spec!.categories.length).toBe(people.length)
    } finally {
      destroy()
    }
  })

  it('re-derives the chart when the grid is filtered (auto-refresh)', async () => {
    const { api, destroy } = await mountGrid({ charting: true })
    try {
      // Filter to the Research team (3 people) via the same facet-filter state
      // the chart's own cross-filter writes.
      api.setFacetFilter('team', ['Research'])
      await tick()
      const spec = api.getChartSpec()
      expect(spec!.categories.length).toBe(3)
    } finally {
      destroy()
    }
  })

  it('scopes the chart to the selected cell range', async () => {
    const { api, destroy } = await mountGrid({ charting: true })
    try {
      // Select the first two rows across all columns.
      api.selectCells([[0, 0, 1, 2]])
      await tick()
      const spec = api.getChartSpec()
      expect(spec!.categories.length).toBe(2)
    } finally {
      destroy()
    }
  })

  it('renders the docked panel with an <svg> when open', async () => {
    const { target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      const panel = target.querySelector('.sv-grid-chart-panel')
      expect(panel).toBeTruthy()
      expect(panel!.querySelector('svg')).toBeTruthy()
    } finally {
      destroy()
    }
  })

  it('pops the docked panel out into a floating window, maximizes, and docks back', async () => {
    const { target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      const panel = () => target.querySelector('.sv-grid-chart-panel')!
      const click = (label: string) => {
        const btn = target.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
        expect(btn).toBeTruthy()
        btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }
      // Starts docked.
      expect(panel().classList.contains('is-floating')).toBe(false)
      // Pop out -> floating window.
      click('Pop out chart')
      await tick()
      expect(panel().classList.contains('is-floating')).toBe(true)
      // Maximize -> fills the grid.
      click('Maximize')
      await tick()
      expect(panel().classList.contains('is-maximized')).toBe(true)
      // Dock back -> re-docked, not floating, not maximized.
      click('Dock chart')
      await tick()
      expect(panel().classList.contains('is-floating')).toBe(false)
      expect(panel().classList.contains('is-maximized')).toBe(false)
    } finally {
      destroy()
    }
  })

  it('adds a second chart, shows a tab strip, and persists both charts in view state', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      // One chart, no tab strip yet.
      expect(target.querySelectorAll('.sv-grid-chart-tab').length).toBe(0)
      // Add a chart.
      const add = target.querySelector<HTMLButtonElement>('[aria-label="Add chart"]')
      expect(add).toBeTruthy()
      add!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      // Now two tabs; the second is active.
      const tabs = target.querySelectorAll('.sv-grid-chart-tab')
      expect(tabs.length).toBe(2)
      expect(tabs[1]!.classList.contains('is-active')).toBe(true)
      // View state carries both charts + the active index.
      const state = api.getState() as any
      expect(state.charts.length).toBe(2)
      expect(state.chartActive).toBe(1)
      // Removing a chart drops back to a single chart (tab strip disappears).
      target.querySelector<HTMLButtonElement>('.sv-grid-chart-tab.is-active .sv-grid-chart-tab-x')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect(target.querySelectorAll('.sv-grid-chart-tab').length).toBe(0)
      expect((api.getState() as any).charts.length).toBe(1)
    } finally {
      destroy()
    }
  })

  it('keeps each chart\'s own type when switching tabs', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      // Chart 1 -> line.
      const typeSel = () => target.querySelector<HTMLSelectElement>('.sv-grid-chart-controls select')!
      typeSel().value = 'line'
      typeSel().dispatchEvent(new Event('change', { bubbles: true }))
      await tick()
      expect(api.getChartSpec()!.type).toBe('line')
      // Add Chart 2 (defaults to bar).
      target.querySelector<HTMLButtonElement>('[aria-label="Add chart"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect(api.getChartSpec()!.type).toBe('bar')
      // Switch back to Chart 1 -> still line.
      target.querySelectorAll<HTMLButtonElement>('.sv-grid-chart-tab-label')[0]!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect(api.getChartSpec()!.type).toBe('line')
    } finally {
      destroy()
    }
  })

  it('configureChart applies a config to the active chart (resolving field names)', async () => {
    const { api, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      api.configureChart({ type: 'line', dimension: 'team', measure: 'salary', reduce: 'avg' })
      await tick()
      const spec = api.getChartSpec()
      expect(spec!.type).toBe('line')
      // salary aggregated by team -> one category per distinct team.
      expect(spec!.categories.length).toBeGreaterThan(0)
    } finally {
      destroy()
    }
  })

  it('shows an Explain button beside Chart it when an explain handler is registered, and Describe copies the summary', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      api.setChartAiHandler(async () => null)
      await tick()
      // No explain handler yet: the AI row has no Explain button.
      target.querySelector<HTMLButtonElement>('[aria-label="Chart with AI"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect(target.querySelector('.sv-grid-chart-explain-btn')).toBeFalsy()
      api.setChartExplainHandler(async () => ({ summary: 'Salary rises across teams.', insights: ['Engineering leads.', 'Sales trails.'] }))
      await tick()
      const btn = target.querySelector<HTMLButtonElement>('.sv-grid-chart-explain-btn')
      expect(btn).toBeTruthy()
      btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
      await tick()
      expect(target.querySelector('.sv-grid-chart-ai-msg')!.textContent).toBe('Salary rises across teams. Engineering leads. Sales trails.')
      // The export menu's Describe item copies chartSummary of the panel's spec.
      const written: string[] = []
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { written.push(t) } }, configurable: true })
      target.querySelector<HTMLButtonElement>('[aria-label="Export chart"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      const item = [...target.querySelectorAll('.sv-grid-chart-export-menu [role="menuitem"]')].find((n) => n.textContent === 'Describe chart') as HTMLButtonElement
      item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 20))
      await tick()
      expect(written).toHaveLength(1)
      expect(written[0]).toMatch(/rises|falls|holds/)
      expect(target.querySelector('.sv-grid-chart-ai-msg')!.textContent).toBe(written[0])
    } finally {
      destroy()
    }
  })

  it('shows an AI button only when a chart-AI handler is registered, and applies its result', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      // No handler -> no AI button.
      expect(target.querySelector('[aria-label="Chart with AI"]')).toBeFalsy()
      // Register a deterministic handler (stands in for enterprise's aiChart).
      api.setChartAiHandler(async () => ({
        type: 'line',
        dimension: 'team',
        series: null,
        measure: 'salary',
        reduce: 'avg',
        stacked: false,
        rationale: 'line of avg salary by team',
      }))
      await tick()
      const aiBtn = target.querySelector<HTMLButtonElement>('[aria-label="Chart with AI"]')
      expect(aiBtn).toBeTruthy()
      // Open the prompt row, type a query, submit.
      aiBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      const input = target.querySelector<HTMLInputElement>('.sv-grid-chart-ai-input')!
      input.value = 'average salary by team as a line'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      const form = target.querySelector<HTMLFormElement>('.sv-grid-chart-ai-row')!
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      // Let the async handler resolve.
      await new Promise((r) => setTimeout(r, 0))
      await tick()
      expect(api.getChartSpec()!.type).toBe('line')
    } finally {
      destroy()
    }
  })

  it('toggles a logarithmic value axis (configureChart + panel toggle present)', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      api.configureChart({ dimension: 'team', measure: 'salary' })
      await tick()
      expect(api.getChartSpec()!.yScale).not.toBe('log')
      api.configureChart({ logScale: true })
      await tick()
      expect(api.getChartSpec()!.yScale).toBe('log')
      const labels = [...target.querySelectorAll('.sv-grid-chart-toggle')].map((l) => l.textContent?.trim())
      expect(labels).toContain('Log scale')
    } finally {
      destroy()
    }
  })

  it('offers a date axis only when the group-by column is date-like', async () => {
    // Non-date dimension -> no Date axis toggle.
    const a = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      const labels = [...a.target.querySelectorAll('.sv-grid-chart-toggle')].map((l) => l.textContent?.trim())
      expect(labels).not.toContain('Date axis')
    } finally {
      a.destroy()
    }
    // Date dimension -> Date axis toggle appears and drives xType: 'time'.
    const dateColumns = [
      { field: 'day', header: 'Day', width: 120, cellDataType: 'date' },
      { field: 'channel', header: 'Channel', width: 120 },
      { field: 'signups', header: 'Signups', width: 100, cellDataType: 'number' },
    ]
    const dateData = [
      { id: 1, day: '2026-01-01', channel: 'Organic', signups: 10 },
      { id: 2, day: '2026-01-02', channel: 'Organic', signups: 20 },
      { id: 3, day: '2026-01-03', channel: 'Paid', signups: 30 },
    ]
    const b = await mountGrid({
      data: dateData,
      columns: dateColumns,
      charting: { defaultOpen: true, dimension: 'day', measures: 'signups' },
    })
    try {
      await tick()
      const labels = [...b.target.querySelectorAll('.sv-grid-chart-toggle')].map((l) => l.textContent?.trim())
      expect(labels).toContain('Date axis')
      b.api.configureChart({ timeAxis: true })
      await tick()
      expect(b.api.getChartSpec()!.xType).toBe('time')
    } finally {
      b.destroy()
    }
  })

  it('configureChart takes the new reducers and a calendar bucket, and the panel offers both', async () => {
    const dateColumns = [
      { field: 'day', header: 'Day', width: 120, cellDataType: 'date' },
      { field: 'signups', header: 'Signups', width: 100, cellDataType: 'number' },
    ]
    const dateData = [
      { id: 1, day: '2026-01-05', signups: 10 },
      { id: 2, day: '2026-01-20', signups: 30 },
      { id: 3, day: '2026-02-03', signups: 7 },
      { id: 4, day: '2026-02-17', signups: 9 },
    ]
    const { api, target, destroy } = await mountGrid({
      data: dateData,
      columns: dateColumns,
      charting: { defaultOpen: true, dimension: 'day', measures: 'signups' },
    })
    try {
      await tick()
      // The Aggregate select lists the extended reducers and a Bucket select
      // appears for a date dimension.
      const selects = [...target.querySelectorAll('.sv-grid-chart-ctl select')]
      const options = (label: string) => {
        const ctl = [...target.querySelectorAll('.sv-grid-chart-ctl')].find((c) => c.querySelector('.sv-grid-chart-ctl-lbl')?.textContent === label)
        return [...(ctl?.querySelectorAll('option') ?? [])].map((o) => o.textContent)
      }
      expect(selects.length).toBeGreaterThan(0)
      expect(options('Aggregate')).toContain('Median')
      expect(options('Aggregate')).toContain('Distinct count')
      expect(options('Bucket')).toEqual(['Exact', 'Day', 'Week', 'Month', 'Quarter', 'Year'])

      api.configureChart({ reduce: 'median', bucket: 'month' })
      await tick()
      const spec = api.getChartSpec()!
      expect(spec.categories).toEqual(['2026-01-01', '2026-02-01'])
      expect(spec.series[0]!.values).toEqual([20, 8])
      expect(spec.xType).toBe('ordinal-time')
      expect(spec.yAxisTitle).toBe('Median of Signups')

      // The bucket round-trips through the saved grid state.
      const state = api.getState() as { charts?: Array<{ bucket?: string }> }
      expect(state.charts?.[0]?.bucket).toBe('month')
      api.configureChart({ bucket: null, reduce: 'max' })
      await tick()
      expect(api.getChartSpec()!.categories).toHaveLength(4)
      api.setState(state as never)
      await tick()
      expect(api.getChartSpec()!.categories).toEqual(['2026-01-01', '2026-02-01'])
    } finally {
      destroy()
    }
  })

  it('serializes chart data to CSV and shows an Export menu (PNG/SVG/PDF/CSV/Copy/Print/Describe)', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      api.configureChart({ dimension: 'team', series: 'name', measure: 'salary' })
      await tick()
      const csv = chartSpecToCsv(api.getChartSpec()!)
      const [header, ...rows] = csv.split('\n')
      expect(header!.startsWith('Category,')).toBe(true)
      expect(rows.length).toBeGreaterThan(0)
      // Export button + menu.
      const btn = target.querySelector<HTMLButtonElement>('[aria-label="Export chart"]')
      expect(btn).toBeTruthy()
      btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      const items = [...target.querySelectorAll('.sv-grid-chart-export-menu button')].map((b) => b.textContent)
      expect(items).toEqual(['PNG image', 'SVG vector', 'PDF document', 'CSV data', 'Copy to clipboard', 'Print', 'Describe chart'])
    } finally {
      destroy()
    }
  })

  it('buildChart emits a grouped category-axis tier from categoryGroups', () => {
    const geo = buildChart({
      type: 'bar',
      categories: ['USA', 'Canada', 'Japan', 'India'],
      series: [{ label: 'Rev', values: [10, 20, 30, 40] }],
      categoryGroups: [{ label: 'Americas', span: 2 }, { label: 'APAC', span: 2 }],
    })
    expect(geo.categoryGroupTicks.map((g) => g.label)).toEqual(['Americas', 'APAC'])
    // Groups tile the axis edge-to-edge (first group's right = second's left).
    expect(geo.categoryGroupTicks[0]!.x1).toBe(geo.categoryGroupTicks[1]!.x0)
    // Ignored when the spans don't cover every leaf.
    const bad = buildChart({
      type: 'bar',
      categories: ['A', 'B', 'C'],
      series: [{ label: 'x', values: [1, 2, 3] }],
      categoryGroups: [{ label: 'G', span: 2 }],
    })
    expect(bad.categoryGroupTicks.length).toBe(0)
  })

  it('formatChartValue renders currency / percent / compact', () => {
    expect(formatChartValue(1500, 'currency')).toBe('$1.5k')
    expect(formatChartValue(-2_000_000, 'currency')).toBe('-$2M')
    expect(formatChartValue(0.25, 'percent')).toBe('25%')
    expect(formatChartValue(1500)).toBe('1.5k')
    expect(formatChartValue(1500, 'number')).toBe('1.5k')
  })

  it('formats through Intl once a locale or currency is set, and not before', () => {
    // The whole point of the opt-in: an existing chart keeps byte-identical
    // labels. Intl's own compact form for en-US is '1.5K', capitalised, so
    // routing everything through it would restyle every axis already shipped.
    expect(formatChartValue(1500, 'currency', {})).toBe('$1.5k')
    expect(formatChartValue(1500, 'currency', { locale: undefined, currency: undefined })).toBe('$1.5k')

    // A currency alone is enough - the symbol is the thing that was wrong.
    const eur = formatChartValue(1500, 'currency', { currency: 'EUR', locale: 'en-US' })
    expect(eur).toContain('€')
    expect(eur).not.toContain('$')
    // A currency with no minor unit still renders (JPY has 0 decimals).
    expect(formatChartValue(2500, 'currency', { currency: 'JPY', locale: 'en-US' })).toContain('¥')

    // A locale alone localizes the separators and the compact suffix.
    const de = formatChartValue(1500, 'number', { locale: 'de-DE' })
    expect(de).not.toBe('1.5k')
    expect(formatChartValue(1234, 'number', { locale: 'en-US' })).toBe('1.2K')

    // `style: 'currency'` throws with no code, so a locale-only currency chart
    // must still draw rather than take the whole grid down.
    expect(() => formatChartValue(1500, 'currency', { locale: 'de-DE' })).not.toThrow()

    expect(formatChartValue(0.25, 'percent', { locale: 'en-US' })).toBe('25%')
    expect(formatChartValue(Number.NaN, 'currency', { currency: 'EUR' })).toBe('')
  })

  it("inherits the grid's localization.locale, and charting.locale overrides it", async () => {
    // A chart of localized data reading in a different locale is the kind of bug
    // nobody thinks to check, so the grid's own locale is the default.
    {
      const { api, destroy } = await mountGrid({ charting: true, localization: { locale: 'de-DE' } })
      try {
        api.configureChart({ dimension: 'team', measure: 'salary', reduce: 'sum' })
        await tick()
        expect(api.getChartSpec()!.locale).toBe('de-DE')
      } finally { destroy() }
    }
    {
      const { api, destroy } = await mountGrid({
        charting: { locale: 'ja-JP', currency: 'JPY' },
        localization: { locale: 'de-DE' },
      })
      try {
        api.configureChart({ dimension: 'team', measure: 'salary', reduce: 'sum' })
        await tick()
        const spec = api.getChartSpec()!
        expect(spec.locale).toBe('ja-JP')
        expect(spec.currency).toBe('JPY')
      } finally { destroy() }
    }
    {
      // No localization anywhere: the spec stays locale-free, which is what
      // keeps every existing chart rendering exactly as it did.
      const { api, destroy } = await mountGrid({ charting: true })
      try {
        api.configureChart({ dimension: 'team', measure: 'salary', reduce: 'sum' })
        await tick()
        expect(api.getChartSpec()!.locale).toBeUndefined()
        expect(api.getChartSpec()!.currency).toBeUndefined()
      } finally { destroy() }
    }
  })

  it('applies valueFormat, logScale and timeAxis to the row-reading types too', async () => {
    // These three return a spec built directly from the rows, on a path that
    // used to skip the block applying these settings. So `valueFormat` on a
    // gauge silently did nothing while the same setting on a bar chart worked,
    // which reads as the setting being broken rather than type-specific.
    const { api, destroy } = await mountGrid({ charting: true })
    try {
      api.configureChart({
        type: 'gauge', measure: 'salary', reduce: 'avg', valueFormat: 'currency',
      })
      await tick()
      expect(api.getChartSpec()!.valueFormat).toBe('currency')

      api.configureChart({
        type: 'boxplot', dimension: 'team', measure: 'salary', logScale: true,
      })
      await tick()
      expect(api.getChartSpec()!.yScale).toBe('log')

      // And the aggregated path still gets them, which is the half that
      // always worked.
      api.configureChart({
        type: 'bar', dimension: 'team', measure: 'salary', valueFormat: 'currency',
      })
      await tick()
      expect(api.getChartSpec()!.valueFormat).toBe('currency')
    } finally {
      destroy()
    }
  })

  it('builds the row-reading types through the panel: scatter, gauge, box plot', async () => {
    // These three do not go through `rowsToChartSpec`, so their dispatch is the
    // one bit of chart wiring a bar-chart test never touches. It lives in the
    // lazy engine to keep the controller out of the base bundle, which is
    // exactly the kind of move that can silently stop building a spec.
    const { api, destroy } = await mountGrid({ charting: true })
    try {
      api.configureChart({ type: 'boxplot', dimension: 'team', measure: 'salary' })
      await tick()
      const box = api.getChartSpec()!
      expect(box.type).toBe('boxplot')
      expect(box.series[0]!.boxes!.length).toBe(box.categories.length)
      expect(box.series[0]!.boxes!.some((b) => b && Number.isFinite(b.median))).toBe(true)

      api.configureChart({ type: 'gauge', measure: 'salary', reduce: 'avg' })
      await tick()
      expect(api.getChartSpec()!.type).toBe('gauge')
      expect(api.getChartSpec()!.gaugeValue).toBeGreaterThan(0)

      api.configureChart({ type: 'scatter', dimension: 'team', measure: 'age' })
      await tick()
      const scatter = api.getChartSpec()
      // Whatever the Y measure resolves to, the one thing that must never
      // happen is falling through and drawing a BAR chart under a "Scatter"
      // label. Asserted unconditionally: a `if (scatter)` here would pass by
      // doing nothing the day the dispatch stops building a spec.
      expect(scatter === null || scatter.type === 'scatter').toBe(true)
      expect(scatter?.type).not.toBe('bar')

      // Back to a bar chart: the fall-through still works after the early
      // returns above.
      api.configureChart({ type: 'bar', dimension: 'team', measure: 'salary', reduce: 'sum' })
      await tick()
      expect(api.getChartSpec()!.type).toBe('bar')
      expect(api.getChartSpec()!.series[0]!.values.length).toBeGreaterThan(0)
    } finally {
      destroy()
    }
  })

  it('the localized format reaches the axis ticks, not just the helper', () => {
    const geo = buildChart({
      type: 'bar',
      categories: ['a', 'b'],
      series: [{ label: 'Revenue', values: [1500, 3000] }],
      valueFormat: 'currency',
      currency: 'EUR',
      locale: 'en-US',
      width: 400,
      height: 300,
    })
    expect(geo.yTicks.length).toBeGreaterThan(0)
    expect(geo.yTicks.some((t) => t.label.includes('€'))).toBe(true)
    expect(geo.yTicks.every((t) => !t.label.includes('$'))).toBe(true)
  })

  it('applies a value format and an auto y-axis title to the spec', async () => {
    const { api, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      api.configureChart({ dimension: 'team', measure: 'salary', reduce: 'sum', valueFormat: 'currency' })
      await tick()
      const spec = api.getChartSpec()!
      expect(spec.valueFormat).toBe('currency')
      expect(spec.yAxisTitle).toBe('Sum of Salary')
    } finally {
      destroy()
    }
  })

  it('defaults the value format from the measure column format', async () => {
    const cols = [
      { field: 'team', header: 'Team', width: 120 },
      { field: 'salary', header: 'Salary', width: 120, cellDataType: 'number', format: { type: 'currency', currency: 'USD' } },
    ]
    const { api, destroy } = await mountGrid({
      columns: cols,
      charting: { defaultOpen: true, dimension: 'team', measures: 'salary' },
    })
    try {
      await tick()
      expect(api.getChartSpec()!.valueFormat).toBe('currency')
    } finally {
      destroy()
    }
  })

  it('splits into one series per distinct value of the `series` field', async () => {
    const { api, destroy } = await mountGrid({ charting: { dimension: 'team', series: 'name', measures: 'age' } })
    await tick() // the chart engine loads lazily; ready a tick after mount
    try {
      const spec = api.getChartSpec()
      // categories = distinct teams (4); one series per distinct name (6).
      expect(spec!.series.length).toBe(6)
    } finally {
      destroy()
    }
  })

  it('plots one series per measure with `measures[]`', async () => {
    const { api, destroy } = await mountGrid({ charting: { dimension: 'team', measures: ['age', 'salary'] } })
    await tick() // the chart engine loads lazily; ready a tick after mount
    try {
      const spec = api.getChartSpec()
      expect(spec!.series.length).toBe(2)
    } finally {
      destroy()
    }
  })

  it('marks the spec stacked when config.stacked is set', async () => {
    const { api, destroy } = await mountGrid({ charting: { dimension: 'team', series: 'name', measures: 'age', stacked: true } })
    await tick() // the chart engine loads lazily; ready a tick after mount
    try {
      expect(api.getChartSpec()!.stacked).toBe(true)
    } finally {
      destroy()
    }
  })

  it('renders a custom `buildSpec` chart that stays live with the grid', async () => {
    const { api, destroy } = await mountGrid({
      charting: { defaultOpen: true, buildSpec: (rows: unknown[]) => ({ type: 'bar', categories: ['All'], series: [{ label: 'Count', values: [rows.length] }] }) },
    })
    try {
      await tick()
      // The custom spec reflects all displayed rows...
      expect(api.getChartSpec()!.series[0]!.values[0]).toBe(people.length)
      // ...and re-derives when the grid is filtered (auto-refresh through buildSpec).
      api.setFacetFilter('team', ['Research'])
      await tick()
      expect(api.getChartSpec()!.series[0]!.values[0]).toBe(3)
    } finally {
      destroy()
    }
  })

  it('maps a multi-column cell selection to dimension + split-by + measures (column-exact)', async () => {
    const { api, destroy } = await mountGrid({ charting: true })
    try {
      // Select columns 1..3 (team, age, salary) across the first two rows:
      // team -> dimension, no 2nd text col, age+salary -> measures.
      api.selectCells([[0, 1, 1, 3]])
      await tick()
      const spec = api.getChartSpec()
      // Two numeric columns in the span -> two series.
      expect(spec!.series.length).toBe(2)
    } finally {
      destroy()
    }
  })


  it('passes zoom, presets, sync and menu config through to the chart, and the window survives tabs and state', async () => {
    const dateColumns = [
      { field: 'day', header: 'Day', width: 120, cellDataType: 'date' },
      { field: 'signups', header: 'Signups', width: 100, cellDataType: 'number' },
    ]
    const dateData = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      day: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      signups: 10 + (i % 7),
    }))
    const { api, target, destroy } = await mountGrid({
      data: dateData,
      columns: dateColumns,
      charting: {
        defaultOpen: true, dimension: 'day', measures: 'signups', defaultType: 'line', timeAxis: true,
        zoom: { wheel: true }, rangePresets: true, syncTabs: true, contextMenu: [{ label: 'Explain', onSelect: () => {} }],
      },
    })
    try {
      await tick()
      const hits = () => target.querySelectorAll('.sv-grid-chart-cat-hit').length
      expect(hits()).toBe(40)
      // The presets came through and the pointer-zoom class with them.
      const presets = [...target.querySelectorAll<HTMLButtonElement>('.sv-grid-chart-preset')]
      expect(presets.map((b) => b.textContent)).toContain('1W')
      presets.find((b) => b.textContent === '1W')!.click()
      await tick()
      expect(hits()).toBe(8)
      // The window is on the tab, so it is part of the saved state.
      const state = api.getState() as { charts: Array<{ zoom?: { i0: number; i1: number } | null }> }
      expect(state.charts[0]!.zoom).toEqual({ i0: 32, i1: 39 })
      // A second tab joins the same sync group and opens at that window.
      target.querySelector<HTMLButtonElement>('[aria-label="Add chart"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      await tick()
      expect(target.querySelectorAll('.sv-grid-chart-tab.is-active').length).toBe(1)
      expect(hits()).toBe(8)
      // Restoring the saved state restores the window; a bad one is dropped.
      api.setState({ ...state, charts: [{ ...state.charts[0], zoom: { i0: 'x' } }] } as never)
      await tick()
      expect(hits()).toBe(40)
      api.setState(state as never)
      await tick()
      expect(hits()).toBe(8)
    } finally {
      destroy()
    }
  })


  it('the builder opens from the panel with a live thumbnail per type, and a card switches the chart', { timeout: 20_000 }, async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      const build = target.querySelector<HTMLButtonElement>('.sv-grid-chart-build-btn')
      expect(build).toBeTruthy()
      build!.click()
      // The builder is a lazy chunk; wait for the modal.
      await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-builder')).toBeTruthy() })
      await tick()
      const cards = document.querySelectorAll('.sv-grid-chart-builder-card')
      expect(cards.length).toBeGreaterThan(20)
      // Every card holds a rendered chart svg, not an empty frame.
      expect(document.querySelectorAll('.sv-grid-chart-builder-card .sv-grid-chart-svg').length).toBe(cards.length)
      const line = [...cards].find((c) => c.querySelector('.sv-grid-chart-builder-card-label')?.textContent === 'Line') as HTMLButtonElement
      line.click()
      await tick()
      expect(api.getChartSpec()?.type).toBe('line')
      expect(line.getAttribute('aria-pressed')).toBe('true')
      // Escape closes the modal.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await tick()
    } finally {
      document.querySelector('.sv-modal__backdrop')?.remove()
      destroy()
    }
  })

  it('the Format tab writes a title through the format state and it survives a data change', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      api.configureChart({ format: { title: 'Head count', yAxis: { max: 50 }, legend: 'right' } })
      await tick()
      expect(api.getChartSpec()?.title).toBe('Head count')
      expect(api.getChartSpec()?.yAxis?.max).toBe(50)
      expect(target.querySelector('.sv-grid-chart.is-legend-right')).toBeTruthy()
      // The format is part of the saved view and keeps applying to new rows.
      const state = api.getState() as { charts?: Array<{ format?: { title?: string } }> }
      expect(state.charts?.[0]?.format?.title).toBe('Head count')
      api.addRow({ id: 99, name: 'Zed', team: 'Ops', age: 30, salary: 10 } as Person)
      await tick()
      expect(api.getChartSpec()?.title).toBe('Head count')
      api.configureChart({ format: null })
      await tick()
      expect(api.getChartSpec()?.title).toBeUndefined()
    } finally {
      destroy()
    }
  })

  it('the Format tab writes series labels, crosshair pills, a compact rule, a stack group and a style through configureChart', { timeout: 20_000 }, async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      api.configureChart({ series: 'team', format: { seriesLabels: true, crosshairLabels: false, compactBelow: 300, series: { Research: { stack: 'g' } }, style: { fontSize: 14 } } })
      await tick()
      const spec = api.getChartSpec()!
      expect(spec.seriesLabels).toBe(true)
      expect(spec.responsive?.at(-1)).toMatchObject({ maxWidth: 300, legend: false })
      expect(spec.series.find((s) => s.label === 'Research')?.stack).toBe('g')
      expect(spec.style).toEqual({ fontSize: 14 })
      // The style lands on the host and the crosshair pills are off.
      const host = target.querySelector<HTMLElement>('.sv-grid-chart')!
      expect(host.getAttribute('style')).toContain('--sg-chart-font-scale')
      ;(target.querySelector('.sv-grid-chart-cat-hit') as SVGElement).dispatchEvent(new FocusEvent('focus'))
      await tick()
      expect(target.querySelector('.sv-grid-chart-crosshair')).toBeTruthy()
      expect(target.querySelector('.sv-grid-chart-crosshair-label')).toBeNull()
      api.configureChart({ format: { crosshairLabels: true } })
      await tick()
      ;(target.querySelector('.sv-grid-chart-cat-hit') as SVGElement).dispatchEvent(new FocusEvent('focus'))
      await tick()
      expect(target.querySelector('.sv-grid-chart-crosshair-label')).toBeTruthy()
      api.configureChart({ format: { seriesLabels: true, crosshairLabels: false, compactBelow: 300, series: { Research: { stack: 'g' } }, style: { fontSize: 14 } } })
      await tick()
      // The builder's Format tab shows the same fields.
      target.querySelector<HTMLButtonElement>('.sv-grid-chart-build-btn')!.click()
      await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-builder')).toBeTruthy() })
      const formatTab = [...document.querySelectorAll<HTMLButtonElement>('.sv-grid-chart-builder [role="tab"]')].find((b) => b.textContent?.trim() === 'Format')!
      formatTab.click()
      await tick()
      const rows = [...document.querySelectorAll('.sv-grid-chart-builder-row')].map((r) => r.querySelector('span')?.textContent)
      expect(rows).toEqual(expect.arrayContaining(['Series labels', 'Crosshair labels', 'Compact under', 'Font size']))
      const stackInput = document.querySelector<HTMLInputElement>('.sv-grid-chart-builder-series[data-series="Research"] input[type="text"]')
      expect(stackInput?.value).toBe('g')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await tick()
    } finally {
      document.querySelector('.sv-modal__backdrop')?.remove()
      destroy()
    }
  })

  it('the builder Data tab renders the panel pickers and both write the same tab', { timeout: 20_000 }, async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      api.configureChart({ dimension: 'team', measure: 'salary' })
      await tick()
      const research = () => { const s = api.getChartSpec()!; return s.series[0]!.values[s.categories.indexOf('Research')] }
      expect(research()).toBe(360)
      target.querySelector<HTMLButtonElement>('.sv-grid-chart-build-btn')!.click()
      await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-builder')).toBeTruthy() })
      const dataTab = [...document.querySelectorAll<HTMLButtonElement>('.sv-grid-chart-builder [role="tab"]')].find((b) => b.textContent?.trim() === 'Data')!
      dataTab.click()
      await tick()
      const form = document.querySelector('.sv-grid-chart-controls[data-scope="builder"]')!
      expect(form).toBeTruthy()
      expect(form.classList.contains('is-form')).toBe(true)
      const lbl = (root: Element, label: string) => [...root.querySelectorAll('.sv-grid-chart-ctl')].find((c) => c.querySelector('.sv-grid-chart-ctl-lbl')?.textContent === label)
      // No Type select in the builder (the gallery picks it), the rest is there.
      expect(lbl(form, 'Type')).toBeUndefined()
      expect(lbl(form, 'Group by')).toBeTruthy()
      const reduce = lbl(form, 'Aggregate')!.querySelector('select')!
      reduce.value = 'avg'
      reduce.dispatchEvent(new Event('change', { bubbles: true }))
      await tick()
      expect(research()).toBe(120) // the average of 120 / 130 / 110
      const panel = target.querySelector('.sv-grid-chart-controls[data-scope="panel"]')!
      expect(lbl(panel, 'Aggregate')!.querySelector('select')!.value).toBe('avg')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await tick()
    } finally {
      document.querySelector('.sv-modal__backdrop')?.remove()
      destroy()
    }
  })

  it('localization.text relabels the panel and the builder; unset keys stay English', { timeout: 20_000 }, async () => {
    const { target, destroy } = await mountGrid({
      charting: { defaultOpen: true },
      localization: { text: { chartPanelTitle: 'Diagramm', chartGroupBy: 'Gruppieren nach', chartTypeBar: 'Balken', chartAdd: 'Diagramm hinzufügen', chartBuilderTitle: 'Diagramm-Editor', chartBuilderTabData: 'Daten', noRows: 'Keine Zeilen' } },
    })
    try {
      await tick()
      expect(target.querySelector('.sv-grid-chart-title')!.textContent).toBe('Diagramm')
      expect(target.querySelector('[aria-label="Diagramm hinzufügen"]')).toBeTruthy()
      const labels = [...target.querySelectorAll('.sv-grid-chart-ctl-lbl')].map((l) => l.textContent)
      expect(labels).toContain('Gruppieren nach')
      expect(labels).toContain('Aggregate')
      const typeSel = target.querySelector<HTMLSelectElement>('.sv-grid-chart-controls select')!
      const options = [...typeSel.options].map((o) => o.textContent)
      expect(options).toContain('Balken')
      expect(options).toContain('Line')
      target.querySelector<HTMLButtonElement>('.sv-grid-chart-build-btn')!.click()
      await vi.waitFor(() => { expect(document.querySelector('.sv-grid-chart-builder')).toBeTruthy() })
      const tabs = [...document.querySelectorAll('.sv-grid-chart-builder [role="tab"]')].map((b) => b.textContent?.trim())
      expect(tabs).toEqual(['Type', 'Daten', 'Format'])
      expect(document.querySelector('.sv-grid-chart-builder-card-label')!.textContent).toBe('Balken')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await tick()
    } finally {
      document.querySelector('.sv-modal__backdrop')?.remove()
      destroy()
    }
  })

  it('saves a chart under a name, applies it to another tab, and round-trips it through the view state and the popover', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      api.configureChart({ type: 'line', reduce: 'avg', logScale: true, format: { title: 'Average pay' } })
      api.saveChart('Avg pay')
      expect(api.getSavedCharts().map((s) => s.name)).toEqual(['Avg pay'])
      // A second tab starts as a bar; the saved chart makes it the line, title kept.
      api.configureChart({ type: 'bar', reduce: 'sum', logScale: false, format: null })
      target.querySelector<HTMLButtonElement>('[aria-label="Add chart"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect(api.getChartSpec()!.type).toBe('bar')
      expect(api.applySavedChart('Avg pay')).toBe(true)
      expect(api.applySavedChart('nope')).toBe(false)
      await tick()
      expect(api.getChartSpec()!.type).toBe('line')
      expect(api.getChartSpec()!.title).toBe('Average pay')
      expect(api.getChartSpec()!.yScale).toBe('log')
      expect(target.querySelector('.sv-grid-chart-tab.is-active .sv-grid-chart-tab-label')!.textContent).toBe('Chart 2')
      // The saved list travels with the state, and only when there is one.
      const state = api.getState() as { savedCharts?: Array<{ name: string; tab: { type: string } }> }
      expect(state.savedCharts?.[0]).toMatchObject({ name: 'Avg pay', tab: { type: 'line', reduce: 'avg' } })
      api.removeSavedChart('Avg pay')
      expect((api.getState() as { savedCharts?: unknown }).savedCharts).toBeUndefined()
      api.setState({ ...state } as never)
      await tick()
      expect(api.getSavedCharts().map((s) => s.name)).toEqual(['Avg pay'])
      // configureChart({ saved }) applies it first, then the other keys on top.
      api.configureChart({ saved: 'Avg pay', type: 'area' })
      await tick()
      expect(api.getChartSpec()!.type).toBe('area')
      expect(api.getChartSpec()!.title).toBe('Average pay')
      // The popover: lists, saves, applies and removes.
      target.querySelector<HTMLButtonElement>('.sv-grid-chart-saved-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect([...target.querySelectorAll('.sv-grid-chart-saved-apply')].map((b) => b.textContent)).toEqual(['Avg pay'])
      const name = target.querySelector<HTMLInputElement>('.sv-grid-chart-saved-name')!
      name.value = 'Area'
      name.dispatchEvent(new Event('input', { bubbles: true }))
      await tick()
      target.querySelector<HTMLFormElement>('.sv-grid-chart-saved-row')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await tick()
      expect(api.getSavedCharts().map((s) => s.name)).toEqual(['Avg pay', 'Area'])
      target.querySelector<HTMLButtonElement>('.sv-grid-chart-saved-x')!.click()
      await tick()
      expect(api.getSavedCharts().map((s) => s.name)).toEqual(['Area'])
      target.querySelector<HTMLButtonElement>('.sv-grid-chart-saved-apply')!.click()
      await tick()
      expect(target.querySelector('.sv-grid-chart-saved-menu')).toBeNull()
      expect(api.getChartSpec()!.type).toBe('area')
      // Escape closes the popover and hands focus back to its button; the
      // export menu closes the same way.
      const savedBtn = target.querySelector<HTMLButtonElement>('.sv-grid-chart-saved-btn')!
      savedBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect(target.querySelector('.sv-grid-chart-saved-menu')).not.toBeNull()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await tick()
      expect(target.querySelector('.sv-grid-chart-saved-menu')).toBeNull()
      expect(document.activeElement).toBe(savedBtn)
      target.querySelector<HTMLButtonElement>('[aria-label="Export chart"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      expect(target.querySelector('.sv-grid-chart-export-menu')).not.toBeNull()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await tick()
      expect(target.querySelector('.sv-grid-chart-export-menu')).toBeNull()
    } finally {
      destroy()
    }
  })

  it('an unlinked chart keeps its spec across a data change and relinks on demand', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      const before = api.getChartSpec()!
      const link = target.querySelector<HTMLButtonElement>('.sv-grid-chart-link-btn')!
      expect(link.getAttribute('aria-pressed')).toBe('false')
      link.click()
      await tick()
      expect(link.getAttribute('aria-pressed')).toBe('true')
      api.setFacetFilter('team', [people[0]!.team])
      await tick()
      expect(api.getChartSpec()!.categories).toEqual(before.categories)
      // The freeze round-trips through the saved state.
      const state = api.getState() as { charts?: Array<{ frozen?: { spec: unknown } | null }> }
      expect(state.charts?.[0]?.frozen?.spec).toBeTruthy()
      link.click()
      await tick()
      expect(api.getChartSpec()!.categories.length).toBeLessThan(before.categories.length)
    } finally {
      destroy()
    }
  })

  it('fires onChartCreated for the first chart and each added tab, and onChartChanged once per burst', async () => {
    vi.useFakeTimers()
    const created: unknown[] = []
    const changed: unknown[] = []
    try {
      const { api, target, destroy } = await mountGrid({
        charting: { defaultOpen: true, onChartCreated: (i: unknown) => created.push(i), onChartChanged: (i: unknown) => changed.push(i) },
      })
      try {
        await vi.advanceTimersByTimeAsync(10)
        expect(created).toHaveLength(1)
        expect(created[0]).toMatchObject({ index: 0, title: 'Chart 1', type: 'bar' })
        await vi.advanceTimersByTimeAsync(200)
        const n = changed.length
        expect(n).toBeGreaterThanOrEqual(1)
        // Three quick picker changes collapse into one change event.
        api.configureChart({ type: 'line' })
        api.configureChart({ type: 'area' })
        api.configureChart({ reduce: 'avg' })
        await vi.advanceTimersByTimeAsync(10)
        expect(changed).toHaveLength(n)
        await vi.advanceTimersByTimeAsync(200)
        expect(changed).toHaveLength(n + 1)
        expect(changed[n]).toMatchObject({ index: 0, type: 'area' })
        expect((changed[n] as { spec: { type: string } }).spec.type).toBe('area')
        target.querySelector<HTMLButtonElement>('[aria-label="Add chart"]')!.click()
        await vi.advanceTimersByTimeAsync(10)
        expect(created).toHaveLength(2)
        expect(created[1]).toMatchObject({ index: 1, title: 'Chart 2' })
      } finally {
        destroy()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('a candlestick chart from the panel guesses the price columns, rolls up by week, and stacks the indicator panes', async () => {
    const priceColumns = [
      { field: 'day', header: 'Day', width: 120, cellDataType: 'date' },
      { field: 'open', header: 'Open', width: 80, cellDataType: 'number' },
      { field: 'high', header: 'High', width: 80, cellDataType: 'number' },
      { field: 'low', header: 'Low', width: 80, cellDataType: 'number' },
      { field: 'close', header: 'Close', width: 80, cellDataType: 'number' },
      { field: 'volume', header: 'Volume', width: 80, cellDataType: 'number' },
    ]
    const priceData = Array.from({ length: 30 }, (_, i) => {
      const c = 100 + Math.sin(i / 4) * 10 + i
      return { id: i + 1, day: new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10), open: c - 1, high: c + 2, low: c - 3, close: c, volume: 1000 + i * 10 }
    })
    const { api, target, destroy } = await mountGrid({
      data: priceData, columns: priceColumns,
      charting: { defaultOpen: true, defaultType: 'candlestick' },
    })
    try {
      await tick()
      const spec = api.getChartSpec()!
      expect(spec.type).toBe('candlestick')
      expect(spec.series[0]!.ohlc).toHaveLength(30)
      expect(spec.series[0]!.volumes).toHaveLength(30)
      expect(spec.lastPriceLine).toBe(true)
      // The pickers show the guessed columns and the indicator chips.
      const labels = [...target.querySelectorAll('.sv-grid-chart-ctl-lbl')].map((l) => l.textContent)
      expect(labels).toEqual(expect.arrayContaining(['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Indicators']))
      expect(labels).not.toContain('Aggregate')
      const chip = (name: string) => [...target.querySelectorAll<HTMLButtonElement>('.sv-grid-chart-chip')].find((b) => b.textContent === name)!
      chip('Volume').click()
      chip('RSI').click()
      chip('Bollinger').click()
      await tick()
      expect(target.querySelectorAll('.sv-chart-pane.is-indicator')).toHaveLength(2)
      expect(api.getChartSpec()!.series[0]!.overlay).toBe('bb:20:2')
      // Weekly roll-up through the bucket picker.
      api.configureChart({ bucket: 'week' })
      await tick()
      expect(api.getChartSpec()!.categories.length).toBeLessThan(10)
      // It all round-trips.
      const state = api.getState() as { charts?: Array<{ indicators?: string[]; ohlc?: unknown }> }
      expect(state.charts?.[0]?.indicators).toEqual(['volume', 'rsi', 'bb'])
      api.configureChart({ indicators: [], ohlc: { close: 'open' }, bucket: null })
      await tick()
      expect(target.querySelectorAll('.sv-chart-pane.is-indicator')).toHaveLength(0)
      expect(api.getChartSpec()!.series[0]!.ohlc![0]!.c).toBe(api.getChartSpec()!.series[0]!.ohlc![0]!.o)
    } finally {
      destroy()
    }
  })

  it('round-trips the chart config through getState / setState', async () => {
    const a = await mountGrid({ charting: true })
    try {
      a.api.openChart()
      a.api.setState({ ...a.api.getState(), chart: { open: true, type: 'line', dimension: 'team', series: null, measure: 'salary', reduce: 'avg', stacked: false } } as any)
      await tick()
      const state = a.api.getState() as any
      expect(state.chart).toBeTruthy()
      expect(state.chart.type).toBe('line')
      expect(state.chart.reduce).toBe('avg')
      const spec = a.api.getChartSpec()
      expect(spec!.type).toBe('line')
    } finally {
      a.destroy()
    }
  })

  it('charts server-side buckets from getAggregate and refetches on filter change', async () => {
    let calls = 0
    let lastFilter: any = null
    const { api, destroy } = await mountGrid({
      charting: {
        getAggregate: async (req: ChartAggregateRequest) => {
          calls += 1
          lastFilter = req.filterModel
          return [
            { category: 'A', value: 10 },
            { category: 'B', value: 20 },
          ]
        },
      },
    })
    try {
      await new Promise((r) => setTimeout(r, 15))
      const spec = api.getChartSpec()
      expect(spec).not.toBeNull()
      expect(spec!.categories).toEqual(['A', 'B'])
      expect(spec!.series[0]!.values).toEqual([10, 20])
      expect(calls).toBeGreaterThan(0)
      // A filter change re-runs the server aggregation with the new filter.
      const before = calls
      api.setFacetFilter('team', ['Research'])
      await new Promise((r) => setTimeout(r, 15))
      expect(calls).toBeGreaterThan(before)
      expect(lastFilter.facets.team).toEqual(['Research'])
    } finally {
      destroy()
    }
  })

  it('cross-filters the grid when a chart category is clicked', async () => {
    const { api, target, destroy } = await mountGrid({ charting: { defaultOpen: true } })
    try {
      await tick()
      expect(api.getDisplayedRows().length).toBe(people.length)
      // The full-height hit rect for the first category carries data-cat-index=0.
      const hit = target.querySelector<SVGElement>('.sv-grid-chart-panel svg [data-cat-index="0"]')
      expect(hit).toBeTruthy()
      hit!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await tick()
      // Clicking one category (a distinct name) filters the grid to that row.
      expect(api.getDisplayedRows().length).toBe(1)
    } finally {
      destroy()
    }
  })
})
