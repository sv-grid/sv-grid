/**
 * The Excel-style filter menu's value checklist is an SvListBox, not a div of
 * checkboxes. Two things that used to bite on a high-cardinality live column
 * (10k distinct symbols on a ticking feed):
 *
 *   1. every distinct value mounted a label + focusable checkbox, so the
 *      popover held ~30k nodes and 10k tab stops;
 *   2. the offered values were derived live, so each data tick rebuilt the
 *      distinct-value set, re-sorted it and re-keyed the whole list.
 *
 * The list now windows its rows and snapshots its values when the menu opens.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  splitInTokens,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; symbol: string; team: string }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

const makeRows = (count: number, prefix = 'SYM'): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    symbol: `${prefix}${String(i).padStart(5, '0')}`,
    team: ['A', 'B', 'C'][i % 3]!,
  }))

const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'symbol', header: 'Symbol', width: 200 },
  { field: 'team', header: 'Team', width: 160 },
]
const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(data: Row[]) {
  return new Promise<{
    target: HTMLElement
    api: SvGridApi<typeof features, Row>
    setData: (next: Row[]) => void
    destroy: () => void
  }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const props = $state({
      data,
      columns: cols,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
      },
      rowHeight: 32,
      containerHeight: 400,
      virtualization: true,
      filterMode: 'menu' as const,
      showColumnFilters: true,
      onApiReady(api: SvGridApi<typeof features, Row>) {
        res({
          target,
          api,
          setData: (next: Row[]) => (props.data = next),
          destroy: () => { unmount(app); target.remove() },
        })
      },
    })
    const app = mount(SvGrid, { target, props: props as any })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

/** Open the funnel popover on the first column and return the menu element. */
async function openFilterMenu(target: HTMLElement, columnIndex = 0) {
  const btn = target.querySelectorAll('.sv-grid-col-filter-btn')[
    columnIndex
  ] as HTMLButtonElement
  btn.click()
  // GridMenus is a lazy chunk, so poll until the popover mounts AND its value
  // checklist has rendered.
  //
  // Waiting only for the popover element returns while the listbox is still
  // empty: the chunk arrives, the menu element appears, and the values are
  // snapshotted and windowed in a later flush. Callers then read option counts
  // from a list that has not populated yet. It survives locally because those
  // flushes land in the same task, but under parallel load the gap widens - it
  // failed once that way in a full-suite run. Every caller here opens a menu on
  // a column that has values, so a populated list is the settled state to wait
  // for, and each test's own assertions are unchanged.
  //
  // The 1s default is not enough for the lazy chunk when `test:lib` runs the
  // whole suite with `--coverage`: instrumentation plus parallel load pushes
  // the import past a second and the menu is still null when the clock runs
  // out. The assertions are unchanged - this only waits longer for a dynamic
  // import, so a slow machine reports a real failure rather than a timeout.
  await vi.waitFor(
    () => {
      const menu = target.querySelector('.sv-grid-filter-menu')
      expect(menu).not.toBeNull()
      expect(menu!.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
    },
    { timeout: 5000 },
  )
  return target.querySelector('.sv-grid-filter-menu') as HTMLElement
}

// The LABEL only. The row also carries a trailing match count, which these
// tests are not about - reading the whole row's text would couple them to it.
const labelOf = (el: Element) =>
  (el.querySelector('.sv-listbox__label') ?? el).textContent?.trim() ?? ''

const optionLabels = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll('[role="option"]')).map(labelOf)

const findOption = (menu: HTMLElement, label: string) => {
  const hit = Array.from(menu.querySelectorAll('[role="option"]')).find(
    (el) => labelOf(el) === label,
  )
  if (!hit) throw new Error(`no option labelled "${label}" in [${optionLabels(menu)}]`)
  return hit as HTMLElement
}

describe('filter menu value checklist', () => {
  it('windows a high-cardinality column instead of mounting every value', async () => {
    const rows = makeRows(120)
    const { target, destroy } = await mountGrid(rows)
    await tick()
    const menu = await openFilterMenu(target)

    const list = menu.querySelector('.sv-listbox')
    expect(list).not.toBeNull()
    expect(list!.classList.contains('is-virtual')).toBe(true)

    const rendered = menu.querySelectorAll('[role="option"]').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(60)

    destroy()
  })

  it('is a single tab stop, not one per value', async () => {
    const { target, destroy } = await mountGrid(makeRows(120))
    await tick()
    const menu = await openFilterMenu(target)

    // Roving tabindex: the listbox root is focusable, its options are not.
    expect(menu.querySelectorAll('.sv-listbox[tabindex="0"]').length).toBe(1)
    expect(menu.querySelectorAll('[role="option"][tabindex]').length).toBe(0)
    // No focusable checkbox per row any more.
    expect(menu.querySelectorAll('.sv-listbox input').length).toBe(0)

    destroy()
  })

  it('keeps a short list fully rendered (no fixed-height box)', async () => {
    const { target, destroy } = await mountGrid(makeRows(9))
    await tick()
    const menu = await openFilterMenu(target)

    const list = menu.querySelector('.sv-listbox')!
    expect(list.classList.contains('is-virtual')).toBe(false)
    expect(menu.querySelectorAll('[role="option"]').length).toBe(9)

    destroy()
  })

  it('snapshots the offered values, so a live data tick does not rebuild them', async () => {
    const { target, setData, destroy } = await mountGrid(makeRows(6, 'OLD'))
    await tick()
    const menu = await openFilterMenu(target)
    const before = optionLabels(menu)
    expect(before[0]).toBe('OLD00000')

    // A streaming grid replaces its row array; the open menu must not re-scan.
    setData(makeRows(6, 'NEW'))
    await tick()
    expect(optionLabels(menu)).toEqual(before)

    destroy()
  })

  it('re-reads the values on the next open', async () => {
    const { target, setData, destroy } = await mountGrid(makeRows(6, 'OLD'))
    await tick()
    await openFilterMenu(target)
    setData(makeRows(6, 'NEW'))
    await tick()

    // Close, then reopen: the snapshot is taken fresh.
    ;(target.querySelector('.sv-grid-menu-backdrop') as HTMLElement).click()
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-filter-menu')).toBeNull())
    const reopened = await openFilterMenu(target)
    expect(optionLabels(reopened)[0]).toBe('NEW00000')

    destroy()
  })

  it('unchecking a value filters the rows out', async () => {
    const { target, api, destroy } = await mountGrid(makeRows(9))
    await tick()
    const menu = await openFilterMenu(target)

    const first = menu.querySelector('[role="option"]') as HTMLElement
    expect(first.getAttribute('aria-selected')).toBe('true')
    first.click()
    await tick()

    expect(first.getAttribute('aria-selected')).toBe('false')
    expect(api.getDisplayedRows().length).toBe(8)

    destroy()
  })

  it('an in/notIn box offers a windowed checklist, not a capped datalist', async () => {
    const { target, destroy } = await mountGrid(makeRows(300))
    await tick()
    const menu = await openFilterMenu(target)

    const op = menu.querySelector('.sv-grid-menu-operator-select') as HTMLSelectElement
    op.value = 'in'
    op.dispatchEvent(new Event('change', { bubbles: true }))
    await tick()

    expect(menu.querySelector('datalist')).toBeNull()
    const box = menu.querySelector('.sv-grid-menu-condition-value') as HTMLInputElement
    expect(box.getAttribute('list')).toBeNull()

    box.dispatchEvent(new FocusEvent('focus'))
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-in-suggest')).not.toBeNull())
    const suggest = target.querySelector('.sv-grid-in-suggest') as HTMLElement

    // Uncapped source list, windowed render.
    expect(suggest.querySelector('.sv-listbox')!.classList.contains('is-virtual')).toBe(true)
    expect(suggest.querySelectorAll('[role="option"]').length).toBeLessThan(60)

    destroy()
  })

  it('picking a suggestion replaces the fragment being typed', async () => {
    const { target, destroy } = await mountGrid(makeRows(9))
    await tick()
    const menu = await openFilterMenu(target)

    const op = menu.querySelector('.sv-grid-menu-operator-select') as HTMLSelectElement
    op.value = 'in'
    op.dispatchEvent(new Event('change', { bubbles: true }))
    await tick()

    const box = menu.querySelector('.sv-grid-menu-condition-value') as HTMLInputElement
    box.dispatchEvent(new FocusEvent('focus'))
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-in-suggest')).not.toBeNull())

    // Commit one token, then start typing a second.
    box.value = 'SYM00003, SYM0000'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()

    const suggest = target.querySelector('.sv-grid-in-suggest') as HTMLElement
    expect(optionLabels(suggest).length).toBeGreaterThan(1)

    // Pick another: the fragment is consumed, not left beside it.
    const pick = findOption(suggest, 'SYM00005')
    pick.click()
    await tick()

    expect(splitInTokens(box.value).sort()).toEqual(['SYM00003', 'SYM00005'])
    // ...and both read as selected straight away. A value written by the
    // dropdown has no trailing separator, so anything that mistook the last
    // token for a half-typed fragment would show it unchecked.
    const checked = suggest.querySelectorAll('[role="option"][aria-selected="true"]')
    expect(Array.from(checked).map(labelOf).sort()).toEqual([
      'SYM00003',
      'SYM00005',
    ])

    destroy()
  })

  it('a value whose label contains a comma survives being picked', async () => {
    const rows: Row[] = [
      { id: 1, symbol: 'Aug 17, 2026', team: 'A' },
      { id: 2, symbol: '1,234 - 5,678', team: 'B' },
      { id: 3, symbol: 'plain', team: 'C' },
    ]
    const { target, api, destroy } = await mountGrid(rows)
    await tick()
    const menu = await openFilterMenu(target)

    const op = menu.querySelector('.sv-grid-menu-operator-select') as HTMLSelectElement
    op.value = 'in'
    op.dispatchEvent(new Event('change', { bubbles: true }))
    await tick()

    const box = menu.querySelector('.sv-grid-menu-condition-value') as HTMLInputElement
    box.dispatchEvent(new FocusEvent('focus'))
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-in-suggest')).not.toBeNull())
    const suggest = target.querySelector('.sv-grid-in-suggest') as HTMLElement

    const pick = findOption(suggest, 'Aug 17, 2026')
    pick.click()
    await tick()

    // The comma inside the value must not split it into two filter tokens.
    expect(splitInTokens(box.value)).toEqual(['Aug 17, 2026'])
    expect(api.getDisplayedRows().length).toBe(1)

    destroy()
  })

  it('a search-hidden value stays checked when another is toggled', async () => {
    const { target, api, destroy } = await mountGrid(makeRows(9))
    await tick()
    const menu = await openFilterMenu(target)

    // Uncheck SYM00000 while everything is visible.
    ;(menu.querySelector('[role="option"]') as HTMLElement).click()
    await tick()
    expect(api.getDisplayedRows().length).toBe(8)

    // Narrow to a single value, uncheck it too. The first exclusion must
    // survive - it is only hidden by the search box, not deselected.
    const search = menu.querySelector('.sv-grid-menu-search') as HTMLInputElement
    search.value = 'SYM00005'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await tick()
    expect(menu.querySelectorAll('[role="option"]').length).toBe(1)
    ;(menu.querySelector('[role="option"]') as HTMLElement).click()
    await tick()

    expect(api.getDisplayedRows().length).toBe(7)

    destroy()
  })

  it('shows how many rows each value matches', async () => {
    // 9 rows over teams A/B/C, so three each.
    const { target, destroy } = await mountGrid(makeRows(9))
    await tick()
    const menu = await openFilterMenu(target, 1)
    const rows = Array.from(menu.querySelectorAll('[role="option"]')).map((el) => ({
      label: el.querySelector('.sv-listbox__label')?.textContent?.trim(),
      hint: el.querySelector('.sv-listbox__hint')?.textContent?.trim(),
    }))
    expect(rows).toEqual([
      { label: 'A', hint: '3' },
      { label: 'B', hint: '3' },
      { label: 'C', hint: '3' },
    ])
    destroy()
  })

  it('offers only the values still reachable under the other columns\' filters', async () => {
    // Symbols SYM00000..2 are teams A, B, C in turn. Filtering Symbol down to
    // one row must leave the Team list showing that row's team alone - the
    // list used to be built from the whole dataset, so it offered every team
    // and two of the three were a one-click route to an empty grid.
    const { target, api, destroy } = await mountGrid(makeRows(9))
    await tick()
    api.setFilter('symbol', { operator: 'equals', value: 'SYM00001' })
    await tick()
    expect(api.getDisplayedRows().length).toBe(1)

    const menu = await openFilterMenu(target, 1)
    const labels = optionLabels(menu)
    expect(labels).toEqual(['B'])

    destroy()
  })
})
