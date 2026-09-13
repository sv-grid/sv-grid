/**
 * QA sweep: the sort, filter, grouping and expansion members of `SvGridApi`.
 *
 * Row order / row count is read back through `getDisplayedRows()`, so each case
 * checks what the body actually shows rather than an internal state object.
 */
import { describe, expect, it, vi } from 'vitest'
import { flush, mountQaGrid, qaRows, settle } from './harness.svelte'
import type { ColumnDef } from '../index'
import type { QaFeatures, QaRow } from './harness.svelte'

const names = (rows: ReadonlyArray<QaRow>) => rows.map((r) => r.name)

describe('QA: api.setSort / api.clearSort', () => {
  it("setSort(id, 'asc' | 'desc') re-orders the displayed rows", async () => {
    const { api } = await mountQaGrid()
    api.setSort('salary', 'asc')
    await flush()
    expect(api.getDisplayedRows().map((r) => r.salary)).toEqual([
      138_000, 142_000, 158_000, 165_000, 171_000, 175_000,
    ])
    api.setSort('salary', 'desc')
    await flush()
    expect(api.getDisplayedRows().map((r) => r.salary)).toEqual([
      175_000, 171_000, 165_000, 158_000, 142_000, 138_000,
    ])
  })

  it('setSort replaces any existing sort rather than stacking', async () => {
    const { api } = await mountQaGrid()
    api.setSort('team', 'asc')
    await flush()
    api.setSort('salary', 'desc')
    await flush()
    expect(api.getState().sorting).toEqual([{ id: 'salary', desc: true }])
  })

  it('setSort(id, null) clears that column and restores source order', async () => {
    const { api } = await mountQaGrid()
    api.setSort('salary', 'asc')
    await flush()
    api.setSort('salary', null)
    await flush()
    expect(api.getState().sorting).toEqual([])
    expect(names(api.getDisplayedRows())).toEqual(names(qaRows))
  })

  it('clearSort drops every clause', async () => {
    const { api } = await mountQaGrid()
    api.setSort('salary', 'asc')
    await flush()
    api.clearSort()
    await flush()
    expect(api.getState().sorting).toEqual([])
    expect(names(api.getDisplayedRows())).toEqual(names(qaRows))
  })

  it("honours a column's sortable:false opt-out", async () => {
    const { api } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'salary', header: 'Salary', width: 140, sortable: false },
    ] as ColumnDef<QaFeatures, QaRow>[])
    api.setSort('salary', 'asc')
    await flush()
    expect(api.getState().sorting).toEqual([])
  })

  it('fires onSortingChange when the user clicks a sort header', async () => {
    const onSortingChange = vi.fn()
    const { target } = await mountQaGrid({ onSortingChange })
    const header = target.querySelector<HTMLElement>('[data-svgrid-header-col="salary"] .sv-grid-header-label')
    header!.click()
    await flush()
    expect(onSortingChange).toHaveBeenCalledWith([{ id: 'salary', desc: false }])
  })
})

describe('QA: api.setFilter / clearFilter / clearAllFilters / getFilters', () => {
  it('contains / equals / startsWith narrow the displayed rows', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('team', { operator: 'contains', value: 'Res' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual([
      'Ada Lovelace',
      'Alan Turing',
      'Barbara Liskov',
    ])

    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Linus Torvalds'])

    api.setFilter('team', { operator: 'startsWith', value: 'Comp' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Grace Hopper'])
  })

  it('greaterThan / lessThan compare numerically', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('salary', { operator: 'greaterThan', value: '165000' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Linus Torvalds', 'Barbara Liskov'])

    api.setFilter('salary', { operator: 'lessThan', value: '142000' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Alan Turing'])
  })

  it('between uses valueTo as the upper bound', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('salary', { operator: 'between', value: '140000', valueTo: '160000' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Ada Lovelace', 'Grace Hopper'])
    expect(api.getFilters().salary).toEqual({
      operator: 'between',
      value: '140000',
      valueTo: '160000',
    })
  })

  it('isBlank / isNotBlank split on empty cells', async () => {
    const rows: QaRow[] = [
      { id: 1, name: 'A', team: '', salary: 1, active: true },
      { id: 2, name: 'B', team: 'Kernel', salary: 2, active: true },
    ]
    const { api } = await mountQaGrid({}, rows)
    api.setFilter('team', { operator: 'isBlank' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['A'])
    api.setFilter('team', { operator: 'isNotBlank' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['B'])
  })

  it('a second condition joined by AND / OR filters on both', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('salary', {
      operator: 'greaterThan',
      value: '140000',
      operator2: 'lessThan',
      value2: '160000',
      join: 'AND',
    })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Ada Lovelace', 'Grace Hopper'])

    api.setFilter('team', {
      operator: 'equals',
      value: 'Kernel',
      operator2: 'equals',
      value2: 'Apollo',
      join: 'OR',
    })
    api.setFilter('salary', null)
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Margaret Hamilton', 'Linus Torvalds'])
  })

  it('setFilter(id, null) clears that column', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    api.setFilter('team', null)
    await flush()
    expect(api.getFilters()).toEqual({})
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
  })

  it('clearFilter clears one column and leaves the others alone', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('team', { operator: 'contains', value: 'Res' })
    api.setFilter('salary', { operator: 'greaterThan', value: '140000' })
    await flush()
    api.clearFilter('salary')
    await flush()
    expect(Object.keys(api.getFilters())).toEqual(['team'])
    expect(names(api.getDisplayedRows())).toEqual([
      'Ada Lovelace',
      'Alan Turing',
      'Barbara Liskov',
    ])
  })

  it('clearAllFilters wipes column, facet, global and advanced surfaces', async () => {
    const { api } = await mountQaGrid({ filterMode: 'global' })
    api.setFilter('team', { operator: 'contains', value: 'Res' })
    api.setFacetFilter('name', ['Ada Lovelace'])
    api.setAdvancedFilter({ kind: 'const', value: true })
    api.setState({ globalFilter: 'Ada' })
    await flush()

    api.clearAllFilters()
    await flush()
    const state = api.getState()
    expect(api.getFilters()).toEqual({})
    expect(state.facetFilters).toEqual({})
    expect(state.globalFilter).toBe('')
    expect(api.getAdvancedFilter()).toBeNull()
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
  })

  it('getFilters hands back a snapshot a caller cannot write through', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('team', { operator: 'contains', value: 'Res' })
    await flush()
    const snapshot = api.getFilters()
    snapshot.team!.value = 'mutated'
    expect(api.getFilters().team!.value).toBe('Res')
  })

  it("honours a column's filterable:false opt-out", async () => {
    const { api } = await mountQaGrid({}, undefined, [
      { field: 'name', header: 'Name', width: 200 },
      { field: 'team', header: 'Team', width: 160, filterable: false },
    ] as ColumnDef<QaFeatures, QaRow>[])
    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(api.getFilters()).toEqual({})
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
  })

  it('fires onFiltersChange with the global + column surfaces', async () => {
    const onFiltersChange = vi.fn()
    const { api } = await mountQaGrid({ onFiltersChange })
    api.setFilter('team', { operator: 'equals', value: 'Kernel' })
    await flush()
    expect(onFiltersChange).toHaveBeenCalled()
    const payload = onFiltersChange.mock.calls.at(-1)![0]
    expect(payload.global).toBe('')
    expect(payload.columns).toEqual([
      expect.objectContaining({ id: 'team', operator: 'equals', value: 'Kernel' }),
    ])
  })
})

describe('QA: api.setFacetFilter', () => {
  it('keeps only rows whose value is in the set', async () => {
    const { api } = await mountQaGrid()
    api.setFacetFilter('team', ['Research', 'Kernel'])
    await flush()
    expect(names(api.getDisplayedRows())).toEqual([
      'Ada Lovelace',
      'Alan Turing',
      'Linus Torvalds',
      'Barbara Liskov',
    ])
    expect(api.getState().facetFilters).toEqual({ team: ['Research', 'Kernel'] })
  })

  it('an empty array or null clears it', async () => {
    const { api } = await mountQaGrid()
    api.setFacetFilter('team', ['Research'])
    await flush()
    api.setFacetFilter('team', [])
    await flush()
    expect(api.getDisplayedRows().length).toBe(qaRows.length)

    api.setFacetFilter('team', ['Research'])
    await flush()
    api.setFacetFilter('team', null)
    await flush()
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
    expect(api.getState().facetFilters).toEqual({})
  })

  it('composes with a column operator filter', async () => {
    const { api } = await mountQaGrid()
    api.setFacetFilter('team', ['Research'])
    api.setFilter('salary', { operator: 'greaterThan', value: '140000' })
    await flush()
    expect(names(api.getDisplayedRows())).toEqual(['Ada Lovelace', 'Barbara Liskov'])
  })
})

describe('QA: the advanced-filter members without an engine registered', () => {
  const expr = { kind: 'cmp', column: 'team', op: 'equals', value: 'Kernel' } as const

  it('setAdvancedFilter stores the expression and getAdvancedFilter reads it back', async () => {
    const { api } = await mountQaGrid()
    api.setAdvancedFilter(expr)
    await flush()
    expect(api.getAdvancedFilter()).toEqual(expr)
  })

  it('isAdvancedFilterActive stays false and no rows are dropped without an engine', async () => {
    const { api } = await mountQaGrid()
    api.setAdvancedFilter(expr)
    await flush()
    expect(api.isAdvancedFilterActive()).toBe(false)
    expect(api.getDisplayedRows().length).toBe(qaRows.length)
  })

  it('clearAdvancedFilter clears it and leaves other surfaces untouched', async () => {
    const { api } = await mountQaGrid()
    api.setFilter('team', { operator: 'contains', value: 'Res' })
    api.setAdvancedFilter(expr)
    await flush()
    api.clearAdvancedFilter()
    await flush()
    expect(api.getAdvancedFilter()).toBeNull()
    expect(Object.keys(api.getFilters())).toEqual(['team'])
  })

  it('setAdvancedFilter(null) is the same as clearing', async () => {
    const { api } = await mountQaGrid()
    api.setAdvancedFilter(expr)
    await flush()
    api.setAdvancedFilter(null)
    await flush()
    expect(api.getAdvancedFilter()).toBeNull()
  })

  it('fires onAdvancedFilterChange with the new expression', async () => {
    const onAdvancedFilterChange = vi.fn()
    const { api } = await mountQaGrid({ onAdvancedFilterChange })
    api.setAdvancedFilter(expr)
    await flush()
    expect(onAdvancedFilterChange).toHaveBeenCalledWith(expr)
  })
})

describe('QA: api.setGroupBy / setRowExpanded / expandAllGroups / collapseAllGroups', () => {
  it('setGroupBy buckets the rows under banner rows', async () => {
    const { api, target } = await mountQaGrid()
    api.setGroupBy(['team'])
    await flush()
    expect(api.getState().grouping).toEqual(['team'])
    // Four distinct teams: Research, Compilers, Apollo, Kernel.
    const banners = target.querySelectorAll('tr.sv-grid-group-row')
    expect(banners.length).toBe(4)
  })

  it('setGroupBy([]) ungroups', async () => {
    const { api, target } = await mountQaGrid()
    api.setGroupBy(['team'])
    await flush()
    api.setGroupBy([])
    await flush()
    expect(api.getState().grouping).toEqual([])
    expect(target.querySelectorAll('tr.sv-grid-group-row').length).toBe(0)
  })

  it('expandAllGroups reveals the leaf rows, collapseAllGroups hides them again', async () => {
    const { api } = await mountQaGrid()
    api.setGroupBy(['team'])
    await flush()
    // Collapsed by default: getDisplayedRows counts data rows only.
    expect(api.getDisplayedRows().length).toBe(0)

    api.expandAllGroups()
    await flush()
    expect(api.getDisplayedRows().length).toBe(qaRows.length)

    api.collapseAllGroups()
    await flush()
    expect(api.getDisplayedRows().length).toBe(0)
  })

  it('setRowExpanded opens one group by its row id', async () => {
    const { api } = await mountQaGrid()
    api.setGroupBy(['team'])
    await flush()

    // Group row ids are `group_<columnId>_<value>`, as documented in the
    // `<SvGrid>` reference under `expanded`.
    api.setRowExpanded('group_team_Research', true)
    await flush()
    expect(api.getDisplayedRows().map((r) => r.team)).toEqual([
      'Research',
      'Research',
      'Research',
    ])

    api.setRowExpanded('group_team_Research', false)
    await flush()
    expect(api.getDisplayedRows().length).toBe(0)
  })

  it('fires onExpandedChange with the full next map', async () => {
    const onExpandedChange = vi.fn()
    const { api } = await mountQaGrid({ onExpandedChange })
    api.setGroupBy(['team'])
    await flush()
    api.expandAllGroups()
    await flush()
    expect(onExpandedChange).toHaveBeenCalled()
    const map = onExpandedChange.mock.calls.at(-1)![0]
    expect(Object.values(map).every((v) => v === true)).toBe(true)
    expect(Object.keys(map).length).toBe(4)
    expect(Object.keys(map)).toContain('group_team_Research')

    api.collapseAllGroups()
    await flush()
    expect(onExpandedChange.mock.calls.at(-1)![0]).toEqual({})
  })
})

describe('QA: api.refreshEditorOptions', () => {
  it('drops the cache so an async editorOptions source refetches', async () => {
    const editorOptions = vi.fn(async () => ['Research', 'Kernel'])
    const { api } = await mountQaGrid({ enableInlineEditing: true }, undefined, [
      { field: 'name', header: 'Name', width: 200, editorType: 'text' },
      {
        field: 'team',
        header: 'Team',
        width: 160,
        editorType: 'select',
        editorOptions,
      },
    ] as ColumnDef<QaFeatures, QaRow>[])

    // Async sources are cached per column + row, so reopening the SAME cell is
    // the case that must not refetch.
    api.startEditing(0, 'team')
    await settle()
    expect(editorOptions).toHaveBeenCalledTimes(1)
    api.stopEditing(true)
    await settle()

    api.startEditing(0, 'team')
    await settle()
    expect(editorOptions).toHaveBeenCalledTimes(1)
    api.stopEditing(true)
    await settle()

    api.refreshEditorOptions('team')
    api.startEditing(0, 'team')
    await settle()
    expect(editorOptions).toHaveBeenCalledTimes(2)
    api.stopEditing(true)
    await settle()

    // No argument clears every column's cache.
    api.refreshEditorOptions()
    api.startEditing(0, 'team')
    await settle()
    expect(editorOptions).toHaveBeenCalledTimes(3)
    api.stopEditing(true)
  })
})
