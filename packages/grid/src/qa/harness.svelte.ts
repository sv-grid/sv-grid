/**
 * Shared harness for the API QA suite (`src/qa/*.test.ts`).
 *
 * The QA suite is a sweep over the PUBLIC surface: every `SvGridApi` method,
 * every documented `<SvGrid>` prop, and every `on*` callback, checked against
 * the contract its doc comment / reference page states. The per-feature suites
 * elsewhere in `src/` go deep on one behaviour; this one goes wide, so a member
 * that quietly stops working (or never worked) shows up as a failure here even
 * when no feature suite covers it.
 *
 * `qa.surface.test.ts` is the gate: it parses the `SvGridApi` type and the
 * `Props` callback list and fails when a member is not referenced from this
 * directory, so a new API member cannot ship without a QA case.
 */
import { mount, unmount } from 'svelte'
import { afterEach } from 'vitest'
import SvGrid from '../SvGrid.svelte'
import {
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from '../index'
import type { ColumnDef, SvGridApi } from '../index'

/** The row shape every QA case uses unless it needs something special. */
export type QaRow = {
  id: number
  name: string
  team: string
  salary: number
  active: boolean
}

/** Every feature the grid ships, so one harness covers the whole surface. */
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
  { id: 1, name: 'Ada Lovelace', team: 'Research', salary: 142_000, active: true },
  { id: 2, name: 'Grace Hopper', team: 'Compilers', salary: 158_000, active: true },
  { id: 3, name: 'Alan Turing', team: 'Research', salary: 138_000, active: false },
  { id: 4, name: 'Margaret Hamilton', team: 'Apollo', salary: 165_000, active: true },
  { id: 5, name: 'Linus Torvalds', team: 'Kernel', salary: 175_000, active: false },
  { id: 6, name: 'Barbara Liskov', team: 'Research', salary: 171_000, active: true },
]

export const qaColumns: ColumnDef<QaFeatures, QaRow>[] = [
  { field: 'name', header: 'Name', width: 200, editorType: 'text' },
  { field: 'team', header: 'Team', width: 160, editorType: 'text' },
  { field: 'salary', header: 'Salary', width: 140, editorType: 'number' },
  { field: 'active', header: 'Active', width: 120, editorType: 'checkbox' },
]

/** Row ids that are stable across sorts / filters, for the id-keyed methods. */
export const qaGetRowId = (row: QaRow) => `r${row.id}`

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

/**
 * One macrotask per call. The grid's derived state (`gridStateVersion`) and
 * its mount effects settle within a couple of turns; three is what the
 * existing behavioral suites use, so QA cases inherit the same budget.
 */
export async function flush(turns = 3): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0))
}

/**
 * A longer settle for the lazy-loaded editor chunk: the list editors pull
 * `SvGridDropdown` in with a dynamic import, so microtasks alone never get it
 * mounted - the wait has to yield the macrotask queue and then let the resolved
 * state re-render.
 */
export async function settle(turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise<void>((r) => queueMicrotask(r))
  }
}

/**
 * Pre-import the chunks `<SvGrid>` loads on demand (the cell editor, the list
 * editor's dropdown, the menus overlay). The component assigns them from a
 * `.then()`, so on the FIRST mount in a process the module transform can outlast
 * any fixed number of ticks and the editor cell renders empty. Importing them up
 * front makes those loads resolve from cache instead of racing the test.
 */
let warmed: Promise<unknown> | null = null
function warmLazyChunks(): Promise<unknown> {
  warmed ??= Promise.all([
    import('../SvGridCellEditor.svelte'),
    import('../SvGridDropdown.svelte'),
    import('../GridMenus.svelte'),
  ])
  return warmed
}

/**
 * Poll `predicate` until it is true, or fail after `timeout` ms. For the few
 * assertions that wait on a lazily-mounted chunk rather than a state change.
 */
export async function waitFor(
  predicate: () => boolean,
  { timeout = 1000, label = 'condition' }: { timeout?: number; label?: string } = {},
): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`waitFor timed out after ${timeout}ms: ${label}`)
}

export type QaGrid = {
  api: SvGridApi<QaFeatures, QaRow>
  target: HTMLElement
  /** Reassign props on the mounted component, as a parent re-render would. */
  setProps: (next: Record<string, unknown>) => void
  destroy: () => void
}

/**
 * Mount the real `<SvGrid>` in jsdom and resolve once `onApiReady` has fired.
 * Virtualization is off so every row is in the DOM for the interaction cases.
 * Awaiting the mount is what lets a case destructure `{ api }` up front.
 */
export async function mountQaGrid(
  extraProps: Record<string, unknown> = {},
  /**
   * Defaults to a FRESH copy of `qaRows` per mount. The inline-edit commit
   * path writes into the row object it was given, so a shared fixture would
   * leak one case's edit into the next.
   */
  rows: ReadonlyArray<QaRow> = qaRows.map((r) => ({ ...r })),
  columns: ReadonlyArray<ColumnDef<QaFeatures, QaRow>> = qaColumns,
): Promise<QaGrid> {
  await warmLazyChunks()

  const target = document.createElement('div')
  document.body.appendChild(target)

  let api: SvGridApi<QaFeatures, QaRow> | null = null

  // `$state.raw` + a read-through proxy, rather than `$state({...})`: a deep
  // `$state` object hands the component a PROXY of `data`, and row identity is
  // part of the contract (`applyTransaction({ remove: [rowObject] })` matches by
  // reference). Raw state keeps the values the caller passed while a whole-box
  // reassignment still re-renders the grid, so `setProps` works like a parent
  // re-render without distorting what the component receives.
  let box = $state.raw<Record<string, unknown>>({
    data: rows,
    columns,
    features: qaFeatures,
    rowHeight: 32,
    containerHeight: 480,
    virtualization: false,
    // jsdom reports a zero-width viewport, so the column virtualizer windows
    // out columns a real browser would paint. Off by default here; the prop
    // itself is covered in qa.props.test.ts.
    columnVirtualization: false,
    onApiReady(next: SvGridApi<QaFeatures, QaRow>) {
      api = next
    },
    ...extraProps,
  })

  const props = new Proxy({} as Record<string, unknown>, {
    get: (_t, key: string | symbol) => box[key as string],
    has: (_t, key: string | symbol) => (key as string) in box,
    ownKeys: () => Reflect.ownKeys(box),
    getOwnPropertyDescriptor: (_t, key: string | symbol) => ({
      configurable: true,
      enumerable: true,
      value: box[key as string],
    }),
  })

  const app = mount(SvGrid, { target, props: props as never })
  const destroy = () => {
    unmount(app)
    target.remove()
  }
  cleanups.push(destroy)

  await flush()
  if (!api) throw new Error('onApiReady never fired')

  return {
    api,
    target,
    setProps(next) {
      box = { ...box, ...next }
    },
    destroy,
  }
}

/** Cell text of the rendered body, row-major. Skips banner / spacer rows. */
export function bodyText(target: HTMLElement): string[][] {
  const rows = target.querySelectorAll(
    'tbody tr.sv-grid-row:not(.sv-grid-group-row):not(.sv-grid-row-spacer):not(.sv-grid-empty-row)',
  )
  return [...rows].map((row) =>
    [...row.querySelectorAll('td[data-svgrid-col]')].map(
      (c) => c.textContent?.trim() ?? '',
    ),
  )
}

/** One body cell by its grid coordinates. */
export function cellAt(
  target: HTMLElement,
  rowIndex: number,
  colIndex: number,
): HTMLTableCellElement | null {
  return target.querySelector(
    `td[data-svgrid-row="${rowIndex}"][data-svgrid-col="${colIndex}"]`,
  )
}
