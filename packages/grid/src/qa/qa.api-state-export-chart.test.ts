/**
 * QA sweep: view state (`getState` / `setState` / `refresh`), the runtime option
 * overrides (`setOption` / `getOption` / `resetOptions`), the free exporters and
 * the integrated-chart members.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flush, mountQaGrid, qaRows } from './harness.svelte'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('QA: api.getState / setState / refresh', () => {
  it('getState snapshots every documented key', async () => {
    const { api } = await mountQaGrid()
    const state = api.getState()
    expect(Object.keys(state).sort()).toEqual(
      [
        'columnFilters',
        'columnOrder',
        'columnPinning',
        'columnWidths',
        'facetFilters',
        'globalFilter',
        'grouping',
        'hiddenColumns',
        'pagination',
        'sorting',
      ].sort(),
    )
    expect(state.sorting).toEqual([])
    expect(state.grouping).toEqual([])
    expect(state.pagination).toEqual({ pageIndex: 0, pageSize: 10 })
    expect(state.columnOrder).toEqual(['name', 'team', 'salary', 'active'])
    expect(state.hiddenColumns).toEqual([])
    expect(state.globalFilter).toBe('')
  })

  it('omits advancedFilter until one is set, so old snapshots round-trip', async () => {
    const { api } = await mountQaGrid()
    expect('advancedFilter' in api.getState()).toBe(false)
    api.setAdvancedFilter({ kind: 'const', value: true })
    await flush()
    expect(api.getState().advancedFilter).toEqual({ kind: 'const', value: true })
  })

  it('round-trips a full view through setState', async () => {
    const first = await mountQaGrid({ showPagination: true, pageSize: 10 })
    first.api.setSort('salary', 'desc')
    first.api.setFilter('team', { operator: 'contains', value: 'e' })
    first.api.setFacetFilter('name', ['Ada Lovelace', 'Grace Hopper'])
    first.api.setColumnWidth('name', 250)
    first.api.setColumnPinning({ left: ['name'] })
    first.api.setColumnOrder(['salary', 'name', 'team', 'active'])
    first.api.setColumnVisible('active', false)
    await flush()
    const saved = JSON.parse(JSON.stringify(first.api.getState()))

    const second = await mountQaGrid({ showPagination: true, pageSize: 10 })
    second.api.setState(saved)
    await flush()
    expect(JSON.parse(JSON.stringify(second.api.getState()))).toEqual(saved)
  })

  it('applies only the keys present in a partial snapshot', async () => {
    const { api } = await mountQaGrid()
    api.setSort('salary', 'desc')
    api.setColumnVisible('team', false)
    await flush()

    api.setState({ sorting: [] })
    await flush()
    expect(api.getState().sorting).toEqual([])
    // The hidden column is untouched: `hiddenColumns` was not in the snapshot.
    expect(api.isColumnVisible('team')).toBe(false)
  })

  it('setState drops grouping by columns that no longer exist', async () => {
    const { api } = await mountQaGrid()
    api.setState({ grouping: ['team', 'ghost'] })
    await flush()
    expect(api.getState().grouping).toEqual(['team'])
  })

  it('setState({ advancedFilter: null }) clears while an absent key leaves it', async () => {
    const { api } = await mountQaGrid()
    api.setAdvancedFilter({ kind: 'const', value: true })
    await flush()
    api.setState({ sorting: [] })
    await flush()
    expect(api.getAdvancedFilter()).not.toBeNull()

    api.setState({ advancedFilter: null })
    await flush()
    expect(api.getAdvancedFilter()).toBeNull()
  })

  it('refresh recomputes the pipeline without changing the view', async () => {
    const { api } = await mountQaGrid()
    api.setSort('salary', 'asc')
    await flush()
    const before = api.getState()
    expect(() => api.refresh()).not.toThrow()
    await flush()
    expect(api.getState()).toEqual(before)
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
  })
})

describe('QA: api.setOption / getOption / resetOptions', () => {
  it('getOption reads the incoming prop', async () => {
    const { api } = await mountQaGrid({ showPagination: true, pageSize: 25 })
    expect(api.getOption('showPagination')).toBe(true)
    expect(api.getOption('pageSize')).toBe(25)
  })

  it('setOption overrides a prop at runtime and the grid re-renders', async () => {
    const { api, target } = await mountQaGrid()
    expect(target.querySelectorAll('tbody .sv-grid-row-number-cell').length).toBe(0)
    api.setOption('showRowNumbers', true)
    await flush()
    expect(api.getOption('showRowNumbers')).toBe(true)
    expect(target.querySelectorAll('tbody .sv-grid-row-number-cell').length).toBe(
      qaRows.length,
    )
  })

  it('setOption(key, undefined) clears the override and falls back to the prop', async () => {
    const { api } = await mountQaGrid({ emptyMessage: 'From the prop' })
    api.setOption('emptyMessage', 'From the override')
    await flush()
    expect(api.getOption('emptyMessage')).toBe('From the override')

    api.setOption('emptyMessage', undefined)
    await flush()
    expect(api.getOption('emptyMessage')).toBe('From the prop')
  })

  it('resetOptions drops every override at once', async () => {
    const { api } = await mountQaGrid({ emptyMessage: 'From the prop' })
    api.setOption('emptyMessage', 'override')
    api.setOption('showRowNumbers', true)
    await flush()

    api.resetOptions()
    await flush()
    expect(api.getOption('emptyMessage')).toBe('From the prop')
    expect(api.getOption('showRowNumbers')).toBeUndefined()
  })

  it('turns sorting on at runtime through the sortable shortcut', async () => {
    const { api } = await mountQaGrid()
    api.setOption('sortable', true)
    await flush()
    api.setSort('salary', 'asc')
    await flush()
    expect(api.getDisplayedRows()[0]!.salary).toBe(138_000)
  })
})

describe('QA: the free exporters', () => {
  it('exportCsv serializes the current view and skips the download when asked', async () => {
    const { api } = await mountQaGrid()
    const text = await api.exportCsv({ download: false })
    const lines = text.replace('﻿', '').split('\r\n')
    expect(lines[0]).toBe('Name,Team,Salary,Active')
    expect(lines[1]).toBe('Ada Lovelace,Research,142000,true')
    expect(lines).toHaveLength(qaRows.length + 1)
  })

  it('exportCsv honours the current filter, and rows:"all" ignores it', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    const filtered = await api.exportCsv({ download: false })
    expect(filtered.replace('﻿', '').split('\r\n')).toHaveLength(2)

    const all = await api.exportCsv({ download: false, rows: 'all' })
    expect(all.replace('﻿', '').split('\r\n')).toHaveLength(qaRows.length + 1)
  })

  it('exportCsv can restrict the columns', async () => {
    const { api } = await mountQaGrid()
    const text = await api.exportCsv({ download: false, columns: ['name'] })
    expect(text.replace('﻿', '').split('\r\n')[0]).toBe('Name')
  })

  it('exportTsv uses tabs', async () => {
    const { api } = await mountQaGrid()
    const text = await api.exportTsv({ download: false })
    expect(text.replace('﻿', '').split('\r\n')[0]).toBe('Name\tTeam\tSalary\tActive')
  })

  it('exportJson emits an array of field/value objects', async () => {
    const { api } = await mountQaGrid()
    const parsed = JSON.parse(await api.exportJson({ download: false }))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(qaRows.length)
    expect(parsed[0]).toMatchObject({ name: 'Ada Lovelace', team: 'Research' })
  })

  it('copyToClipboard writes TSV by default and markdown on request', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { api } = await mountQaGrid()

    const tsv = await api.copyToClipboard()
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(tsv.split('\r\n')[0]).toBe('Name\tTeam\tSalary\tActive')

    const md = await api.copyToClipboard({ format: 'markdown' })
    expect(md.split('\n')[0]).toBe('| Name | Team | Salary | Active |')
  })

  it('copyToClipboard can copy only the checked rows', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { api } = await mountQaGrid({ getRowId: (r: { id: number }) => `r${r.id}` })
    api.selectRows(['r2'])
    await flush()
    const text = await api.copyToClipboard({ rows: 'selected' })
    expect(text.split('\r\n')).toHaveLength(2)
    expect(text).toContain('Grace Hopper')
  })
})

describe('QA: the integrated-chart members', () => {
  it('openChart / closeChart drive the panel when charting is on', async () => {
    const { api, target } = await mountQaGrid({ charting: true })
    api.openChart()
    await flush()
    expect(api.getState().chart?.open).toBe(true)
    expect(target.querySelector('.sv-grid-chart-panel')).not.toBeNull()

    api.closeChart()
    await flush()
    expect(api.getState().chart?.open).toBe(false)
  })

  it('configureChart sets the axes and getChartSpec reflects them', async () => {
    const { api } = await mountQaGrid({ charting: true })
    api.configureChart({
      type: 'bar',
      dimension: 'team',
      measure: 'salary',
      reduce: 'sum',
    })
    await flush()
    const spec = api.getChartSpec()
    expect(spec).not.toBeNull()
    expect(spec!.type).toBe('bar')
    expect(api.getState().chart).toMatchObject({
      open: true,
      type: 'bar',
      dimension: 'team',
      measure: 'salary',
      reduce: 'sum',
    })
  })

  it('configureChart({ open: false }) configures without opening the panel', async () => {
    const { api } = await mountQaGrid({ charting: true })
    api.configureChart({ open: false, type: 'line', dimension: 'team', measure: 'salary' })
    await flush()
    expect(api.getState().chart).toMatchObject({ open: false, type: 'line' })
  })

  it('chartRange selects the cells and opens the panel', async () => {
    const { api } = await mountQaGrid({ charting: true, enableCellSelection: true })
    api.chartRange([[0, 1, 2, 2]])
    await flush()
    expect(api.getSelected()).toEqual([[0, 1, 2, 2]])
    expect(api.getState().chart?.open).toBe(true)
  })

  it('chartRange with no argument just opens the panel', async () => {
    const { api } = await mountQaGrid({ charting: true })
    api.chartRange()
    await flush()
    expect(api.getState().chart?.open).toBe(true)
    expect(api.getSelected()).toEqual([])
  })

  it('configureChart is inert while charting is off, and getChartSpec is null', async () => {
    const { api } = await mountQaGrid()
    api.configureChart({ type: 'bar', dimension: 'team', measure: 'salary' })
    await flush()
    expect(api.getChartSpec()).toBeNull()
    // The chart block is omitted from the view state entirely.
    expect(api.getState().chart).toBeUndefined()
  })

  it('setChartAiHandler registers a handler and null removes it', async () => {
    const handler = vi.fn(async () => ({ type: 'bar' }))
    const { api, target } = await mountQaGrid({ charting: true })
    api.setChartAiHandler(handler)
    api.openChart()
    await flush()
    // The panel offers its AI button only once a handler is registered.
    expect(target.querySelector('.sv-grid-chart-ai-btn')).not.toBeNull()

    api.setChartAiHandler(null)
    await flush()
    expect(target.querySelector('.sv-grid-chart-ai-btn')).toBeNull()
  })
})
