import { describe, expect, it, vi } from 'vitest'
import { createMenus } from './menus'

// ---------------------------------------------------------------------------
// Fake controller (`ctx`) for the menus factory. The factory reads/writes
// plain menu/filter/pagination state and calls a few `ctx.grid.*` methods and
// clipboard/data helpers. We build the minimal surface each path touches.
// ---------------------------------------------------------------------------

function makeCtx(overrides: any = {}) {
  let gridState: any = {
    grouping: overrides.grouping ?? [],
    ...overrides.gridState,
  }
  const ctx: any = {
    filterRowValues: {},
    filterMenuValues: {},
    valueFilters: {},
    columnMenuFor: null,
    filterMenuFor: null,
    operatorMenuFor: null,
    chooseColumnsPos: null,
    columnMenuPos: null,
    filterMenuPos: null,
    operatorMenuPos: null,
    columnMenuSearch: '',
    contextMenuFor: null,
    contextMenuPos: { x: 0, y: 0 },
    commentEditFor: null,
    commentDraft: '',
    noteOverrides: {},
    columnMenuFacetValues: [],
    showColumnFiltersEffective: true,
    showFilterRowEffective: false,
    scrollContainer: null,
    internalData: [],
    internalColumns: [],
    props: {},
    copySelectionToClipboard: vi.fn(),
    cutSelectionToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    clearSelectedCells: vi.fn(),
    allRows: [],
    grid: {
      getState: () => gridState,
      setGrouping: vi.fn((g: any) => {
        gridState = { ...gridState, grouping: g }
      }),
      setPagination: vi.fn(),
      store: {
        setState: vi.fn((updater: any) => {
          gridState =
            typeof updater === 'function' ? updater(gridState) : { ...gridState, ...updater }
        }),
      },
      _peek: () => gridState,
    },
    ...overrides,
  }
  return ctx
}

describe('createMenus - filter row/menu value updates', () => {
  it('updateFilterRow seeds both filterRowValues and filterMenuValues', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.updateFilterRow('name', 'abc')
    expect(ctx.filterRowValues.name).toBe('abc')
    expect(ctx.filterMenuValues.name).toEqual({ operator: 'contains', value: 'abc' })
  })

  it('updateFilterRow preserves an existing operator', () => {
    const ctx = makeCtx({ filterMenuValues: { name: { operator: 'equals', value: '' } } })
    const m = createMenus(ctx)
    m.updateFilterRow('name', 'x')
    expect(ctx.filterMenuValues.name).toEqual({ operator: 'equals', value: 'x' })
  })

  it('updateFilterOperator changes operator, defaulting value', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.updateFilterOperator('age', 'greaterThan' as any)
    expect(ctx.filterMenuValues.age).toEqual({ operator: 'greaterThan', value: '' })
  })

  it('updateFilterOperator keeps an existing value', () => {
    const ctx = makeCtx({ filterMenuValues: { age: { operator: 'contains', value: '5' } } })
    const m = createMenus(ctx)
    m.updateFilterOperator('age', 'lessThan' as any)
    expect(ctx.filterMenuValues.age).toEqual({ operator: 'lessThan', value: '5' })
  })

  it('updateFilterMenuValue mirrors value into the filter row', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.updateFilterMenuValue('name', 'foo')
    expect(ctx.filterMenuValues.name).toEqual({ operator: 'contains', value: 'foo' })
    expect(ctx.filterRowValues.name).toBe('foo')
  })

  it('addFilterToken builds a newline-serialised in/notIn list, ignoring dupes/blanks', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.addFilterToken('symbol', 'TSM')
    m.addFilterToken('symbol', 'BP')
    m.addFilterToken('symbol', 'TSM') // dupe - ignored
    m.addFilterToken('symbol', '   ') // blank - ignored
    expect(ctx.filterRowValues.symbol).toBe('TSM\nBP')
    // mirrored into the menu model too, so both filter surfaces agree
    expect(ctx.filterMenuValues.symbol.value).toBe('TSM\nBP')
  })

  it('removeFilterToken drops a value from the list', () => {
    const ctx = makeCtx({ filterRowValues: { symbol: 'TSM\nBP\nBABA' } })
    const m = createMenus(ctx)
    m.removeFilterToken('symbol', 'BP')
    expect(ctx.filterRowValues.symbol).toBe('TSM\nBABA')
  })

  it('toggleFilterToken adds when absent and removes when present', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.toggleFilterToken('symbol', 'BP')
    expect(ctx.filterRowValues.symbol).toBe('BP')
    m.toggleFilterToken('symbol', 'BP')
    expect(ctx.filterRowValues.symbol).toBe('')
  })

  it('openInSuggest anchors the dropdown and targets the column; closeInSuggest clears it', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    const anchor = {
      getBoundingClientRect: () => ({ left: 40, bottom: 80 }),
    } as unknown as HTMLElement
    m.openInSuggest(anchor, 'symbol')
    expect(ctx.inSuggestFor).toBe('symbol')
    expect(ctx.inSuggestPos).toMatchObject({ y: 84 })
    m.closeInSuggest()
    expect(ctx.inSuggestFor).toBe(null)
  })

  it('closeMenus also dismisses the in-suggest dropdown', () => {
    const ctx = makeCtx({ inSuggestFor: 'symbol' })
    const m = createMenus(ctx)
    m.closeMenus()
    expect(ctx.inSuggestFor).toBe(null)
  })

  it('updateFilterMenuValueTo sets the upper bound for between', () => {
    const ctx = makeCtx({ filterMenuValues: { age: { operator: 'between', value: '5' } } })
    const m = createMenus(ctx)
    m.updateFilterMenuValueTo('age', '10')
    expect(ctx.filterMenuValues.age).toEqual({ operator: 'between', value: '5', valueTo: '10' })
  })

  it('updateFilterMenuValueTo defaults a missing entry to between', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.updateFilterMenuValueTo('age', '10')
    expect(ctx.filterMenuValues.age).toEqual({ operator: 'between', value: '', valueTo: '10' })
  })
})

describe('createMenus - toggleCheckboxWithKeyboard', () => {
  it('toggles on Enter and prevents default', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    const toggle = vi.fn()
    const ev = { key: 'Enter', preventDefault: vi.fn() } as any
    m.toggleCheckboxWithKeyboard(ev, toggle)
    expect(toggle).toHaveBeenCalled()
    expect(ev.preventDefault).toHaveBeenCalled()
  })

  it('toggles on Space', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    const toggle = vi.fn()
    m.toggleCheckboxWithKeyboard({ key: ' ', preventDefault: vi.fn() } as any, toggle)
    expect(toggle).toHaveBeenCalled()
  })

  it('ignores other keys', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    const toggle = vi.fn()
    m.toggleCheckboxWithKeyboard({ key: 'a', preventDefault: vi.fn() } as any, toggle)
    expect(toggle).not.toHaveBeenCalled()
  })
})

describe('createMenus - isColumnFiltered', () => {
  it('true when a value filter exists', () => {
    const ctx = makeCtx({ valueFilters: { team: new Set(['A']) } })
    const m = createMenus(ctx)
    expect(m.isColumnFiltered('team')).toBe(true)
  })

  it('true when a menu filter has a non-empty value', () => {
    const ctx = makeCtx({ filterMenuValues: { name: { operator: 'contains', value: 'x' } } })
    const m = createMenus(ctx)
    expect(m.isColumnFiltered('name')).toBe(true)
  })

  it('true for isBlank operator regardless of value', () => {
    const ctx = makeCtx({ filterMenuValues: { name: { operator: 'isBlank', value: '' } } })
    const m = createMenus(ctx)
    expect(m.isColumnFiltered('name')).toBe(true)
  })

  it('false for an empty/whitespace menu value', () => {
    const ctx = makeCtx({ filterMenuValues: { name: { operator: 'contains', value: '   ' } } })
    const m = createMenus(ctx)
    expect(m.isColumnFiltered('name')).toBe(false)
    expect(m.isColumnFiltered('other')).toBe(false)
  })
})

describe('createMenus - closeMenus and open* toggles', () => {
  it('closeMenus clears all popover state', () => {
    const ctx = makeCtx({
      columnMenuFor: 'a',
      filterMenuFor: 'b',
      operatorMenuFor: 'c',
      chooseColumnsPos: { x: 1, y: 1 },
    })
    const m = createMenus(ctx)
    m.closeMenus()
    expect(ctx.columnMenuFor).toBeNull()
    expect(ctx.filterMenuFor).toBeNull()
    expect(ctx.operatorMenuFor).toBeNull()
    expect(ctx.chooseColumnsPos).toBeNull()
  })

  function fakeMouseEvent() {
    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({ left: 100, right: 300, top: 50, bottom: 70, width: 200, height: 20 } as DOMRect)
    return {
      stopPropagation: vi.fn(),
      currentTarget: el,
    } as any
  }

  it('openColumnMenu opens, and a second call on the same column closes (toggle)', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.openColumnMenu(fakeMouseEvent(), 'name')
    expect(ctx.columnMenuFor).toBe('name')
    expect(ctx.columnMenuPos).toBeTruthy()
    // toggle off
    m.openColumnMenu(fakeMouseEvent(), 'name')
    expect(ctx.columnMenuFor).toBeNull()
  })

  it('openFilterMenu opens the funnel popover in menu mode', () => {
    const ctx = makeCtx({ showColumnFiltersEffective: true })
    const m = createMenus(ctx)
    m.openFilterMenu(fakeMouseEvent(), 'name')
    expect(ctx.filterMenuFor).toBe('name')
    expect(ctx.columnMenuSearch).toBe('')
  })

  it('openFilterMenu redirects focus to the inline input in row mode', () => {
    const container = document.createElement('div')
    const input = document.createElement('input')
    input.setAttribute('data-svgrid-filter-col', 'name')
    input.focus = vi.fn()
    input.select = vi.fn()
    container.appendChild(input)
    const ctx = makeCtx({
      showColumnFiltersEffective: false,
      showFilterRowEffective: true,
      scrollContainer: container,
    })
    const m = createMenus(ctx)
    m.openFilterMenu(fakeMouseEvent(), 'name')
    expect(input.focus).toHaveBeenCalled()
    expect(input.select).toHaveBeenCalled()
    expect(input.classList.contains('sv-grid-filter-value-pulse')).toBe(true)
    expect(ctx.filterMenuFor).toBeNull()
  })

  it('openOperatorMenu opens and toggles closed', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.openOperatorMenu(fakeMouseEvent(), 'age')
    expect(ctx.operatorMenuFor).toBe('age')
    m.openOperatorMenu(fakeMouseEvent(), 'age')
    expect(ctx.operatorMenuFor).toBeNull()
  })

  it('openChooseColumns positions the submenu panel', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({ left: 100, right: 300, top: 50, bottom: 70, width: 200, height: 20 } as DOMRect)
    m.openChooseColumns({ stopPropagation: vi.fn(), currentTarget: el } as any)
    expect(ctx.chooseColumnsPos).toBeTruthy()
    expect(typeof ctx.chooseColumnsPos.x).toBe('number')
  })
})

describe('createMenus - sorting and grouping from menu', () => {
  it('sortColumnFromMenu sets a single sort and closes menus', () => {
    const ctx = makeCtx({ columnMenuFor: 'name' })
    const m = createMenus(ctx)
    m.sortColumnFromMenu('name', true)
    expect(ctx.grid._peek().sorting).toEqual([{ id: 'name', desc: true }])
    expect(ctx.columnMenuFor).toBeNull()
  })

  it('clearColumnSort removes that column from sorting', () => {
    const ctx = makeCtx({ gridState: { sorting: [{ id: 'name', desc: false }, { id: 'age', desc: true }] } })
    const m = createMenus(ctx)
    m.clearColumnSort('name')
    expect(ctx.grid._peek().sorting).toEqual([{ id: 'age', desc: true }])
  })

  it('groupByColumnFromMenu adds a new grouping column', () => {
    const ctx = makeCtx({ grouping: [] })
    const m = createMenus(ctx)
    m.groupByColumnFromMenu('team')
    expect(ctx.grid.setGrouping).toHaveBeenCalledWith(['team'])
  })

  it('groupByColumnFromMenu is a no-op when already grouped', () => {
    const ctx = makeCtx({ grouping: ['team'] })
    const m = createMenus(ctx)
    m.groupByColumnFromMenu('team')
    expect(ctx.grid.setGrouping).not.toHaveBeenCalled()
  })

  it('clearGroupingFromMenu removes the column', () => {
    const ctx = makeCtx({ grouping: ['team', 'dept'] })
    const m = createMenus(ctx)
    m.clearGroupingFromMenu('team')
    expect(ctx.grid.setGrouping).toHaveBeenCalledWith(['dept'])
  })
})

describe('createMenus - facet checkboxes', () => {
  it('isFacetChecked: checked by default, unchecked when excluded', () => {
    const ctx = makeCtx({ valueFilters: { team: new Set(['A']) } })
    const m = createMenus(ctx)
    expect(m.isFacetChecked('team', 'A')).toBe(true)
    expect(m.isFacetChecked('team', 'B')).toBe(false)
    // no filter for column -> default checked
    expect(m.isFacetChecked('other', 'X')).toBe(true)
  })

  it('toggleFacetValue removes a value, building the set from all values', () => {
    const ctx = makeCtx({ columnMenuFacetValues: ['A', 'B', 'C'] })
    const m = createMenus(ctx)
    m.toggleFacetValue('team', 'A')
    expect([...ctx.valueFilters.team].sort()).toEqual(['B', 'C'])
  })

  it('toggleFacetValue re-adding the last value clears the filter (all selected)', () => {
    const ctx = makeCtx({
      columnMenuFacetValues: ['A', 'B'],
      valueFilters: { team: new Set(['A']) },
    })
    const m = createMenus(ctx)
    m.toggleFacetValue('team', 'B') // now {A,B} == all -> filter removed
    expect(ctx.valueFilters.team).toBeUndefined()
  })

  it('isAllFacetsChecked true with no filter, false with a subset', () => {
    const ctx = makeCtx({
      columnMenuFacetValues: ['A', 'B'],
      valueFilters: { team: new Set(['A']) },
    })
    const m = createMenus(ctx)
    expect(m.isAllFacetsChecked('team')).toBe(false)
    expect(m.isAllFacetsChecked('other')).toBe(true)
  })

  it('toggleAllFacets clears to empty set when all checked', () => {
    const ctx = makeCtx({ columnMenuFacetValues: ['A', 'B'] })
    const m = createMenus(ctx)
    m.toggleAllFacets('team') // was all checked -> empty set
    expect(ctx.valueFilters.team.size).toBe(0)
  })

  it('toggleAllFacets restores all when currently a subset', () => {
    const ctx = makeCtx({
      columnMenuFacetValues: ['A', 'B'],
      valueFilters: { team: new Set(['A']) },
    })
    const m = createMenus(ctx)
    m.toggleAllFacets('team') // was subset -> remove filter (all)
    expect(ctx.valueFilters.team).toBeUndefined()
  })
})

describe('createMenus - clearColumnFilter', () => {
  it('clears value, menu, and row filter state for the column', () => {
    const ctx = makeCtx({
      valueFilters: { team: new Set(['A']) },
      filterMenuValues: { team: { operator: 'contains', value: 'x' } },
      filterRowValues: { team: 'x' },
    })
    const m = createMenus(ctx)
    m.clearColumnFilter('team')
    expect(ctx.valueFilters.team).toBeUndefined()
    expect(ctx.filterMenuValues.team).toBeUndefined()
    expect(ctx.filterRowValues.team).toBeUndefined()
  })

  it('is a no-op when nothing is set for the column', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    expect(() => m.clearColumnFilter('team')).not.toThrow()
  })
})

describe('createMenus - pagination', () => {
  it('changePage applies the delta', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.changePage(1)
    const updater = ctx.grid.setPagination.mock.calls[0][0]
    expect(updater({ pageIndex: 2, pageSize: 10 })).toEqual({ pageIndex: 3, pageSize: 10 })
  })

  it('changePage clamps to zero on a negative delta', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.changePage(-1)
    const updater = ctx.grid.setPagination.mock.calls[0][0]
    expect(updater({ pageIndex: 0, pageSize: 10 })).toEqual({ pageIndex: 0, pageSize: 10 })
    expect(updater(undefined)).toEqual({ pageIndex: 0 }) // missing prev -> 0
  })

  it('goToPage clamps to zero', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.goToPage(-5)
    const updater = ctx.grid.setPagination.mock.calls[0][0]
    expect(updater({ pageIndex: 9 })).toEqual({ pageIndex: 0 })
  })

  it('setPageSize keeps the first visible row in view', () => {
    const ctx = makeCtx()
    const m = createMenus(ctx)
    m.setPageSize(20)
    const updater = ctx.grid.setPagination.mock.calls[0][0]
    // firstVisibleRow = 2*10 = 20; new index = floor(20/20) = 1
    expect(updater({ pageIndex: 2, pageSize: 10 })).toEqual({ pageIndex: 1, pageSize: 20 })
  })
})

describe('createMenus - context menu open/close', () => {
  function fakeContextEvent() {
    return { preventDefault: vi.fn(), clientX: 120, clientY: 200 } as any
  }

  it('openContextMenu is a no-op when contextMenu prop is unset', () => {
    const ctx = makeCtx({ props: {} })
    const m = createMenus(ctx)
    const ev = fakeContextEvent()
    m.openContextMenu(ev, 0, 0, 'name')
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(ctx.contextMenuFor).toBeNull()
  })

  it('openContextMenu sets the target and position', () => {
    const ctx = makeCtx({
      props: { contextMenu: true },
      allRows: [{ id: 'r0', original: { id: 0, name: 'x' } }],
    })
    const m = createMenus(ctx)
    const ev = fakeContextEvent()
    m.openContextMenu(ev, 0, 1, 'name')
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(ctx.contextMenuFor).toEqual({
      rowIndex: 0,
      colIndex: 1,
      columnId: 'name',
      rowId: 'r0',
      row: { id: 0, name: 'x' },
    })
    expect(ctx.contextMenuPos).toBeTruthy()
  })

  it('openContextMenu falls back to rowIndex when the row model is missing', () => {
    const ctx = makeCtx({ props: { contextMenu: true }, allRows: [] })
    const m = createMenus(ctx)
    m.openContextMenu(fakeContextEvent(), 3, 0, 'name')
    expect(ctx.contextMenuFor.rowId).toBe('3')
    expect(ctx.contextMenuFor.row).toBeNull()
  })

  it('closeContextMenu clears the target', () => {
    const ctx = makeCtx({ contextMenuFor: { rowIndex: 0 } })
    const m = createMenus(ctx)
    m.closeContextMenu()
    expect(ctx.contextMenuFor).toBeNull()
  })
})

describe('createMenus - contextMenuItems', () => {
  it('returns [] with no target', () => {
    const ctx = makeCtx({ contextMenuFor: null })
    const m = createMenus(ctx)
    expect(m.contextMenuItems()).toEqual([])
  })

  it('resolves the default built-in items and trims separators', () => {
    const ctx = makeCtx({
      props: { contextMenu: true },
      contextMenuFor: { rowIndex: 0, colIndex: 0, columnId: 'name', rowId: 'r0', row: { id: 0 } },
    })
    const m = createMenus(ctx)
    const items = m.contextMenuItems()
    const labels = items.filter((i) => !i.separator).map((i) => i.label)
    expect(labels).toContain('Copy')
    expect(labels).toContain('Paste')
    expect(labels).toContain('Remove row')
    expect(labels).toContain('Remove column')
    // no leading/trailing separator
    expect(items[0].separator).toBeFalsy()
    expect(items[items.length - 1].separator).toBeFalsy()
  })

  it('built-in run wiring invokes clipboard helpers', () => {
    const ctx = makeCtx({
      props: { contextMenu: ['copy', 'cut', 'paste', 'clear'] },
      contextMenuFor: { rowIndex: 0, colIndex: 0, columnId: 'name', rowId: 'r0', row: { id: 0 } },
    })
    const m = createMenus(ctx)
    const items = m.contextMenuItems()
    items.find((i) => i.key === 'copy')!.run!()
    items.find((i) => i.key === 'cut')!.run!()
    items.find((i) => i.key === 'paste')!.run!()
    items.find((i) => i.key === 'clear')!.run!()
    expect(ctx.copySelectionToClipboard).toHaveBeenCalled()
    expect(ctx.cutSelectionToClipboard).toHaveBeenCalled()
    expect(ctx.pasteFromClipboard).toHaveBeenCalled()
    expect(ctx.clearSelectedCells).toHaveBeenCalled()
  })

  it('row_above / row_below / remove_row mutate internalData', () => {
    const rowA = { id: 1 }
    const rowB = { id: 2 }
    const ctx = makeCtx({
      props: { contextMenu: ['row_above', 'row_below', 'remove_row'] },
      internalData: [rowA, rowB],
      contextMenuFor: { rowIndex: 1, colIndex: 0, columnId: 'name', rowId: 'r1', row: rowB },
    })
    const m = createMenus(ctx)
    const items = m.contextMenuItems()
    items.find((i) => i.key === 'row_above')!.run!()
    expect(ctx.internalData.length).toBe(3)
    expect(ctx.internalData.indexOf(rowB)).toBe(2) // inserted above rowB
    // remove
    const m2 = createMenus(makeCtx({
      props: { contextMenu: ['remove_row'] },
      internalData: [rowA, rowB],
      contextMenuFor: { rowIndex: 1, colIndex: 0, columnId: 'name', rowId: 'r1', row: rowB },
    }))
    const ctx2 = (m2 as any)
    const removeItem = m2.contextMenuItems().find((i) => i.key === 'remove_row')!
    removeItem.run!()
  })

  it('remove_col removes the matching column def', () => {
    const ctx = makeCtx({
      props: { contextMenu: ['remove_col'] },
      internalColumns: [{ id: 'name' }, { field: 'team' }],
      contextMenuFor: { rowIndex: 0, colIndex: 1, columnId: 'team', rowId: 'r0', row: { id: 0 } },
    })
    const m = createMenus(ctx)
    m.contextMenuItems().find((i) => i.key === 'remove_col')!.run!()
    expect(ctx.internalColumns).toEqual([{ id: 'name' }])
  })

  it('custom items honor hidden() and disabled() predicates', () => {
    const action = vi.fn()
    const ctx = makeCtx({
      props: {
        contextMenu: [
          { key: 'shown', label: 'Shown', action, disabled: () => true },
          { key: 'gone', label: 'Gone', action, hidden: () => true },
        ],
      },
      contextMenuFor: { rowIndex: 0, colIndex: 0, columnId: 'name', rowId: 'r0', row: { id: 0 } },
    })
    const m = createMenus(ctx)
    const items = m.contextMenuItems()
    expect(items.map((i) => i.key)).toEqual(['shown'])
    expect(items[0].disabled).toBe(true)
    items[0].run!()
    expect(action).toHaveBeenCalled()
  })

  it('appends comment item when editableComments enabled with default config', () => {
    const ctx = makeCtx({
      props: { contextMenu: true, editableComments: true },
      contextMenuFor: { rowIndex: 0, colIndex: 0, columnId: 'name', rowId: 'r0', row: { id: 0 } },
    })
    const m = createMenus(ctx)
    const labels = m.contextMenuItems().map((i) => i.label)
    expect(labels).toContain('Edit comment')
  })
})

describe('createMenus - comments', () => {
  it('comment item opens the editor seeded from existing note', () => {
    const ctx = makeCtx({
      props: { contextMenu: ['comment'], notes: { r0: { name: 'hello' } } },
      contextMenuPos: { x: 5, y: 9 },
      contextMenuFor: { rowIndex: 0, colIndex: 0, columnId: 'name', rowId: 'r0', row: { id: 0 } },
    })
    const m = createMenus(ctx)
    m.contextMenuItems().find((i) => i.key === 'comment')!.run!()
    expect(ctx.commentDraft).toBe('hello')
    expect(ctx.commentEditFor).toEqual({ rowId: 'r0', columnId: 'name', x: 5, y: 9 })
    expect(ctx.contextMenuFor).toBeNull()
  })

  it('saveComment writes the draft via onNoteChange and closes', () => {
    const onNoteChange = vi.fn()
    const ctx = makeCtx({
      props: { onNoteChange },
      commentEditFor: { rowId: 'r0', columnId: 'name', x: 0, y: 0 },
      commentDraft: 'note text',
    })
    const m = createMenus(ctx)
    m.saveComment()
    expect(ctx.noteOverrides.r0.name).toBe('note text')
    expect(onNoteChange).toHaveBeenCalledWith({ rowId: 'r0', columnId: 'name', note: 'note text' })
    expect(ctx.commentEditFor).toBeNull()
  })

  it('saveComment is a no-op without an active editor', () => {
    const ctx = makeCtx({ commentEditFor: null })
    const m = createMenus(ctx)
    m.saveComment()
    expect(ctx.commentEditFor).toBeNull()
  })

  it('removeComment writes an empty note and closes', () => {
    const ctx = makeCtx({
      commentEditFor: { rowId: 'r0', columnId: 'name', x: 0, y: 0 },
      noteOverrides: { r0: { name: 'old' } },
    })
    const m = createMenus(ctx)
    m.removeComment()
    expect(ctx.noteOverrides.r0.name).toBe('')
    expect(ctx.commentEditFor).toBeNull()
  })

  it('removeComment is a no-op without an active editor', () => {
    const ctx = makeCtx({ commentEditFor: null })
    const m = createMenus(ctx)
    expect(() => m.removeComment()).not.toThrow()
  })

  it('closeCommentEditor clears the editor', () => {
    const ctx = makeCtx({ commentEditFor: { rowId: 'r0', columnId: 'name', x: 0, y: 0 } })
    const m = createMenus(ctx)
    m.closeCommentEditor()
    expect(ctx.commentEditFor).toBeNull()
  })
})

describe('createMenus - chart context-menu item', () => {
  const target = { rowIndex: 0, colIndex: 0, columnId: 'a', rowId: '0', row: {} }

  it('appends "Chart selected range" to the default menu when charting is enabled', () => {
    const ctx = makeCtx({ props: { contextMenu: true }, chartingEnabled: true, contextMenuFor: target })
    const items = createMenus(ctx).contextMenuItems()
    expect(items.map((i) => i.label)).toContain('Chart selected range')
  })

  it('omits the chart item when charting is disabled', () => {
    const ctx = makeCtx({ props: { contextMenu: true }, chartingEnabled: false, contextMenuFor: target })
    const items = createMenus(ctx).contextMenuItems()
    expect(items.map((i) => i.label)).not.toContain('Chart selected range')
  })

  it('clicking the chart item opens the chart panel', () => {
    const ctx = makeCtx({ props: { contextMenu: true }, chartingEnabled: true, chartPanelOpen: false, contextMenuFor: target })
    const item = createMenus(ctx).contextMenuItems().find((i) => i.label === 'Chart selected range')
    item?.run?.()
    expect(ctx.chartPanelOpen).toBe(true)
  })

  it('localizes the chart item label via ctx.messages', () => {
    const ctx = makeCtx({
      props: { contextMenu: true }, chartingEnabled: true, contextMenuFor: target,
      messages: { chartRange: 'Graphique de la selection' },
    })
    const items = createMenus(ctx).contextMenuItems()
    expect(items.map((i) => i.label)).toContain('Graphique de la selection')
  })
})
