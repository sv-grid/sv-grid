/**
 * Built-in integrated charting (`charting` prop on <SvGrid>): the docked chart
 * panel, its live derivation from displayed rows + selection, and the
 * chart-click -> grid cross-filter loop.
 */
import { describe, expect, it } from 'vitest'
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

  it('serializes chart data to CSV and shows an Export menu (PNG/SVG/CSV/Copy)', async () => {
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
      expect(items).toEqual(['PNG image', 'SVG vector', 'CSV data', 'Copy to clipboard'])
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
