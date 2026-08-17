/**
 * DOM: `conditionalStatScope` decides which rows feed the min/max that
 * `colorScale` / `dataBar` scale against (#61).
 *
 * The old default scanned only the current page, so the same value rendered a
 * different bar on page 1 than on page 2. The default is now `filtered`, which
 * ignores the page slice; `visible` keeps the old per-page behaviour for anyone
 * who wants it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
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

type Row = { id: number; v: number }
const features = tableFeatures({ rowSortingFeature })
const columns = [{ field: 'v', header: 'V', width: 120 }]

// Page 1 spans 0..50, page 2 spans 0..100. The value 50 is the page-1 max but
// only mid-range on page 2, so a per-page scale draws it at two different
// widths while a filtered-wide scale draws it identically.
const data: Row[] = [
  { id: 1, v: 0 },
  { id: 2, v: 50 },
  { id: 3, v: 0 },
  { id: 4, v: 100 },
]

const conditionalFormats = [
  { type: 'dataBar', columns: ['v'], color: '#2563eb' },
] as never

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      conditionalFormats,
      pageable: true,
      pageSize: 2,
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
  return { target, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

/** Widths of the rendered data bars, in source order. */
function barWidths(target: HTMLElement): string[] {
  return [...target.querySelectorAll<HTMLElement>('.sv-grid-cf-bar')].map(
    (el) => el.style.width,
  )
}

async function nextPage(target: HTMLElement) {
  const next = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => /next/i.test(b.getAttribute('aria-label') ?? b.title ?? ''),
  )
  expect(next).toBeDefined()
  next!.click()
  await tick()
}

describe('conditionalStatScope', () => {
  it('keeps the scale steady across pages by default (#61)', async () => {
    const { target, destroy } = mountGrid({})
    cleanup = destroy
    await tick()

    // Page 1: 0 and 50 against the full 0..100 range.
    expect(barWidths(target)).toEqual(['0%', '50%'])
    await nextPage(target)
    // Page 2: 0 and 100 against the same range.
    expect(barWidths(target)).toEqual(['0%', '100%'])
  })

  it('rescales per page under scope="visible"', async () => {
    const { target, destroy } = mountGrid({ conditionalStatScope: 'visible' })
    cleanup = destroy
    await tick()

    // Page 1's own max is 50, so 50 fills the bar.
    expect(barWidths(target)).toEqual(['0%', '100%'])
    await nextPage(target)
    expect(barWidths(target)).toEqual(['0%', '100%'])
  })
})
