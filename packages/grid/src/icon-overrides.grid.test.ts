/**
 * DOM: the `icons` prop replaces the grid's own glyphs, one name at a time.
 *
 * The contract these lock in:
 *   - per-name fallback. Overriding one icon must not blank the others; that
 *     cliff is the whole reason `icons` is a map and not a single snippet.
 *   - an override reaches the lazily-imported column menu, not just the parts
 *     of the grid that render eagerly.
 *   - overriding a filter operator does NOT repaint the pin menu, which shared
 *     its glyphs before this feature.
 *   - defaults are untouched when `icons` is absent.
 *
 * jsdom does not compute `transform`, so the rotation contract is asserted as
 * the class hook the CSS keys off (`.sv-grid-icon` on the wrapper, as a direct
 * child of the toggle) rather than as a computed style. The rotation itself is
 * browser-only verification.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
  rowSortingFeature,
} from './index'
import type { ColumnDef } from './index'

type Row = { id: number; name: string }
const features = tableFeatures({ rowSortingFeature })
const cols: ColumnDef<typeof features, Row>[] = [{ field: 'name', header: 'Name', width: 160 }]
const data: Row[] = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `n${i}` }))

const tick = () => new Promise<void>((r) => queueMicrotask(r))

/** A marker icon that is trivially findable in the DOM. */
const mark = (id: string) =>
  createRawSnippet(() => ({
    render: () => `<svg data-icon="${id}"><path d="M0 0" /></svg>`,
  }))

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns: cols,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 240,
      virtualization: false,
      ...props,
    } as never,
  })
  return { target, app, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

describe('icons prop', () => {
  it('renders the built-in glyphs when no icons are passed', async () => {
    const { target, destroy } = mountGrid({ showColumnMenu: true })
    cleanup = destroy
    await tick()
    // The header menu button draws a real <svg> from the built-in catalogue.
    const menuBtn = target.querySelector('.sv-grid-col-menu-btn')
    expect(menuBtn).not.toBeNull()
    expect(menuBtn!.querySelector('svg.sv-grid-icon')).not.toBeNull()
    expect(target.querySelector('[data-icon]')).toBeNull()
  })

  it('replaces one icon and leaves the rest alone', async () => {
    const { target, destroy } = mountGrid({
      showColumnMenu: true,
      showFilterRow: true,
      icons: { menu: mark('m') },
    })
    cleanup = destroy
    await tick()

    const menuBtn = target.querySelector('.sv-grid-col-menu-btn')!
    // The override is there...
    expect(menuBtn.querySelector('[data-icon="m"]')).not.toBeNull()
    // ...and the built-in it replaced is not drawn alongside it.
    expect(menuBtn.querySelector('svg.sv-grid-icon')).toBeNull()
    // An unset name still renders its built-in. This is the assertion that a
    // single catch-all snippet could not satisfy.
    expect(target.querySelectorAll('svg.sv-grid-icon').length).toBeGreaterThan(0)
  })

  it('wraps an override in the icon box the CSS keys off', async () => {
    const { target, destroy } = mountGrid({ showColumnMenu: true, icons: { menu: mark('m') } })
    cleanup = destroy
    await tick()
    const wrapper = target.querySelector('[data-icon="m"]')!.parentElement!
    expect(wrapper.classList.contains('sv-grid-icon')).toBe(true)
    expect(wrapper.classList.contains('sv-grid-icon-custom')).toBe(true)
  })

  it('reaches the lazily-imported column menu', async () => {
    const { target, destroy } = mountGrid({
      showColumnMenu: true,
      icons: { 'sort-asc': mark('sa') },
    })
    cleanup = destroy
    await tick()
    ;(target.querySelector('.sv-grid-col-menu-btn') as HTMLElement).click()
    // GridMenus arrives through a dynamic import(), so poll rather than
    // guessing a tick count.
    await vi.waitFor(() => {
      expect(target.querySelector('[data-icon="sa"]')).not.toBeNull()
    })
  })

  it('does not repaint the pin menu when a filter operator is overridden', async () => {
    const { target, destroy } = mountGrid({
      showColumnMenu: true,
      // The pin section is hidden while columns are virtualized, and that
      // defaults to on. This is COLUMN virtualization, not the row
      // `virtualization: false` the shared helper sets.
      columnVirtualization: false,
      icons: { 'op-startsWith': mark('sw') },
    })
    cleanup = destroy
    await tick()
    ;(target.querySelector('.sv-grid-col-menu-btn') as HTMLElement).click()

    // Assert the item is really there before asserting about its icon -
    // a conditional check here would pass just as happily if the pin menu
    // stopped rendering at all.
    const pinLeft = await vi.waitFor(() => {
      const el = [...target.querySelectorAll('.sv-grid-menu-item')].find((e) =>
        e.textContent?.includes('Pin to left'),
      )
      expect(el).toBeTruthy()
      return el!
    })

    // Pin borrowed `op-startsWith` before this feature; it must not follow
    // that override now.
    expect(pinLeft.querySelector('[data-icon="sw"]')).toBeNull()
    expect(pinLeft.querySelector('svg.sv-grid-icon')).not.toBeNull()
  })

  it('overrides the pager arrows through GridFooter', async () => {
    const { target, destroy } = mountGrid({
      showPagination: true,
      pageSize: 5,
      icons: { 'page-next': mark('pn') },
    })
    cleanup = destroy
    await tick()
    const hit = target.querySelector('[data-icon="pn"]')
    expect(hit).not.toBeNull()
    // Still a real pager button, and its label is untouched: icons and
    // localeText are independent axes.
    const btn = hit!.closest('.sv-grid-pagination-btn')
    expect(btn).not.toBeNull()
    expect(btn!.getAttribute('aria-label')).toBe('Next page')
  })

  it('picks up icons set after mount through api.setOption', async () => {
    let api: { setOption: (k: string, v: unknown) => void } | undefined
    const { target, destroy } = mountGrid({
      showColumnMenu: true,
      onApiReady: (a: typeof api) => (api = a),
    })
    cleanup = destroy
    await tick()
    expect(target.querySelector('[data-icon="rt"]')).toBeNull()

    api!.setOption('icons', { menu: mark('rt') })
    flushSync()
    await tick()
    expect(target.querySelector('[data-icon="rt"]')).not.toBeNull()
  })
})
