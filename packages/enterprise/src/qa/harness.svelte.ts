/**
 * Shared harness for the enterprise API QA suite (`src/qa/*.test.ts`).
 *
 * Mirrors `packages/grid/src/qa/harness.svelte.ts`, with one deliberate
 * difference: these cases mount the REAL `<SvGrid>` from `@svgrid/grid` and
 * install enterprise onto the api that component hands back. The existing
 * enterprise tests mostly build a hand-written api stub, which cannot catch the
 * one failure mode that matters most here - enterprise expecting something of
 * the grid api that the grid api does not actually provide.
 */
import { mount, unmount } from 'svelte'
import { afterEach } from 'vitest'
import {
  SvGrid,
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from '@svgrid/grid'
import type { ColumnDef, SvGridApi } from '@svgrid/grid'
import { installEnterprise, type EnterpriseGridApi } from '../install'
import { setLicenseKey } from '../license'

// jsdom ships none of the layout observers the grid touches in its mount
// effects, and this package has no shared test setup (the grid package does).
// The existing enterprise dom tests each stub what they need; mounting the whole
// grid needs all three.
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = function () {}
}

export type QaRow = {
  id: number
  region: string
  product: string
  amount: number
  shipped: boolean
}

export const qaFeatures = tableFeatures({
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
})

export type QaFeatures = typeof qaFeatures

export const qaRows: QaRow[] = [
  { id: 1, region: 'EMEA', product: 'Widget', amount: 1200, shipped: true },
  { id: 2, region: 'EMEA', product: 'Gadget', amount: 800, shipped: false },
  { id: 3, region: 'NA', product: 'Widget', amount: 2400, shipped: true },
  { id: 4, region: 'NA', product: 'Gadget', amount: 1600, shipped: true },
  { id: 5, region: 'APAC', product: 'Widget', amount: 400, shipped: false },
]

export const qaColumns: ColumnDef<QaFeatures, QaRow>[] = [
  { field: 'region', header: 'Region', width: 140 },
  { field: 'product', header: 'Product', width: 140 },
  {
    field: 'amount',
    header: 'Amount',
    width: 140,
    editorType: 'number',
    format: { type: 'currency', currency: 'USD', locales: 'en-US' },
  },
  { field: 'shipped', header: 'Shipped', width: 120, editorType: 'checkbox' },
]

export const qaGetRowId = (row: QaRow) => `r${row.id}`

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

export async function flush(turns = 3): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0))
}

export type QaGrid = {
  /** The api AFTER `installEnterprise` - the same object the grid handed over. */
  pro: EnterpriseGridApi<QaFeatures, QaRow>
  /** The same object, before the enterprise members are considered. */
  api: SvGridApi<QaFeatures, QaRow>
  target: HTMLElement
  destroy: () => void
}

/**
 * Mount the grid, install enterprise, and hand back both views of the api.
 * A dev license is set first: the methods work either way, but an unlicensed
 * grid also paints a watermark and logs a nudge, which is noise here (the
 * license surface has its own QA cases).
 */
export async function mountProGrid(
  extraProps: Record<string, unknown> = {},
  rows: ReadonlyArray<QaRow> = qaRows.map((r) => ({ ...r })),
  columns: ReadonlyArray<ColumnDef<QaFeatures, QaRow>> = qaColumns,
): Promise<QaGrid> {
  setLicenseKey('SVENTERPRISE-QA-TEST')

  const target = document.createElement('div')
  document.body.appendChild(target)

  let api: SvGridApi<QaFeatures, QaRow> | null = null
  const props: Record<string, unknown> = {
    data: rows,
    columns,
    features: qaFeatures,
    rowHeight: 32,
    containerHeight: 480,
    virtualization: false,
    columnVirtualization: false,
    onApiReady(next: SvGridApi<QaFeatures, QaRow>) {
      api = next
    },
    ...extraProps,
  }

  const app = mount(SvGrid, { target, props: props as never })
  const destroy = () => {
    unmount(app)
    target.remove()
  }
  cleanups.push(destroy)

  await flush()
  if (!api) throw new Error('onApiReady never fired')

  return { pro: installEnterprise(api), api, target, destroy }
}
