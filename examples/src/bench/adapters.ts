/**
 * Grid adapters for the comparison harness.
 *
 * One interface, one implementation per grid, so the harness never knows which
 * grid it is driving. That is the point: a benchmark written by a grid vendor
 * is only worth reading if the method is auditable and someone else can add
 * their own grid and rerun it. Adding one means writing an adapter here - about
 * 40 lines - and nothing else.
 *
 * Rules the adapters must follow, so the comparison stays fair:
 *
 *   1. Same data objects. Every grid receives the SAME array instance.
 *   2. Same visible work. Virtualization on where the grid supports it, the
 *      same columns, the same row height, the same container size.
 *   3. No preprocessing outside the timed region that another grid has to do
 *      inside it. If one grid needs an index built, that build is timed.
 *   4. `settled()` must resolve only once rows are actually in the DOM and
 *      painted, not when a promise resolves internally.
 *
 * Adapters are loaded lazily so a grid's bundle cost is paid only when it is
 * actually being measured, and one grid failing to load cannot break the rest.
 */

export type BenchRow = {
  id: number
  name: string
  region: string
  status: string
  amount: number
  qty: number
  orderedAt: string
  active: boolean
  note: string
}

export type GridAdapter = {
  /** Display name, used in the results table. */
  name: string
  /** Version string, read from the package at runtime where possible. */
  version: string
  /** Licence, so the table says what a reader is allowed to reuse. */
  license: string
  /** Create the grid inside `host` with `rows`. Resolves when rows are painted. */
  mount(host: HTMLElement, rows: BenchRow[]): Promise<void>
  /** Sort by one column. Resolves when the new order is painted. */
  sort(field: keyof BenchRow, desc: boolean): Promise<void>
  /** Substring-filter one column. Resolves when the result is painted. */
  filter(field: keyof BenchRow, value: string): Promise<void>
  /** Scroll the body by `dy` px. Resolves on the next painted frame. */
  scrollBy(dy: number): Promise<void>
  /** How many row elements are currently in the DOM. Proves virtualization. */
  domRowCount(): number
  /** Tear down and release. */
  destroy(): void
}

/** One animation frame, then a second so what was scheduled has painted. */
export const painted = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

/**
 * Wait until the grid's DOM actually reflects a change, then one frame.
 *
 * `painted()` waits two fixed frames, which puts a ~33ms floor under every
 * measurement no matter how fast the grid is - re-applying an identical filter,
 * where nothing recomputes at all, measured 33.7ms. Both grids paid it equally,
 * so the comparison stayed fair, but it compressed every ratio toward 1 and hid
 * real differences underneath it.
 *
 * A MutationObserver resolves as soon as the rows change instead. The trailing
 * frame is still there so the browser has laid out and painted what we saw.
 * Falls back to `painted()` if nothing mutates, which is the correct answer for
 * an operation that genuinely changed nothing.
 */
export function domSettled(host: HTMLElement, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      observer.disconnect()
      clearTimeout(timer)
      requestAnimationFrame(() => resolve())
    }
    const observer = new MutationObserver(finish)
    observer.observe(host, { childList: true, subtree: true, characterData: true })
    const timer = setTimeout(finish, timeoutMs)
    // A change that produces no mutation still has to settle, so give it the
    // old two-frame path as a floor rather than hanging until the timeout.
    void painted().then(() => {
      if (!done) finish()
    })
  })
}

/**
 * Poll until `check` passes, then one frame so what we saw has painted.
 *
 * Checks BEFORE waiting. It used to await two frames first and only then look,
 * which put the same ~33ms floor under every mount that `painted()` put under
 * sort and filter - and mount is where it mattered most, because a grid whose
 * rows are in the DOM the moment `mount()` returns measured 33ms of pure
 * waiting. Direct instrumentation put sv-grid's synchronous mount at 29ms while
 * the harness reported 81ms.
 */
export async function settle(check: () => boolean, label: string, timeoutMs = 30_000): Promise<void> {
  const deadline = performance.now() + timeoutMs
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
  for (;;) {
    if (check()) {
      await frame()
      return
    }
    await frame()
    if (performance.now() > deadline) throw new Error(`settle timed out: ${label}`)
  }
}

export const COLUMNS: Array<{ field: keyof BenchRow; header: string; type: 'text' | 'number' }> = [
  { field: 'id', header: 'ID', type: 'number' },
  { field: 'name', header: 'Name', type: 'text' },
  { field: 'region', header: 'Region', type: 'text' },
  { field: 'status', header: 'Status', type: 'text' },
  { field: 'amount', header: 'Amount', type: 'number' },
  { field: 'qty', header: 'Qty', type: 'number' },
  { field: 'orderedAt', header: 'Ordered', type: 'text' },
  { field: 'active', header: 'Active', type: 'text' },
  { field: 'note', header: 'Note', type: 'text' },
]

export const ROW_HEIGHT = 32

// ---------------------------------------------------------------------------
// sv-grid
// ---------------------------------------------------------------------------

export async function svgridAdapter(): Promise<GridAdapter> {
  const [{ mount, unmount }, pkg] = await Promise.all([
    import('svelte'),
    // Relative path, not the `@svgrid/grid/package.json` subpath: the exports
    // map declares it, but Vite does not resolve it through the workspace link.
    import('../../../packages/grid/package.json'),
  ])
  const { default: BenchSvGrid } = await import('./BenchSvGrid.svelte')

  let app: Record<string, unknown> | null = null
  let host: HTMLElement | null = null
  // The component writes its imperative handle here on mount.
  const handle: {
    setSort?: (field: string | null, desc: boolean) => void
    setFilter?: (field: string | null, value: string) => void
    scroller?: () => HTMLElement | null
  } = {}

  return {
    name: 'sv-grid',
    version: (pkg as { default?: { version?: string }; version?: string }).default?.version
      ?? (pkg as { version?: string }).version
      ?? 'workspace',
    license: 'MIT',
    async mount(el, rows) {
      host = el
      app = mount(BenchSvGrid, {
        target: el,
        props: { rows, columns: COLUMNS, rowHeight: ROW_HEIGHT, handle },
      }) as Record<string, unknown>
      await settle(() => el.querySelectorAll('tr.sv-grid-row').length > 0, 'sv-grid mount')
    },
    async sort(field, desc) {
      handle.setSort?.(field as string, desc)
      await domSettled(host!)
    },
    async filter(field, value) {
      handle.setFilter?.(field as string, value)
      await domSettled(host!)
    },
    async scrollBy(dy) {
      const el = handle.scroller?.()
      if (el) el.scrollTop += dy
      await painted()
    },
    domRowCount() {
      return host?.querySelectorAll('tr.sv-grid-row').length ?? 0
    },
    destroy() {
      if (app) unmount(app as never)
      app = null
      host = null
    },
  }
}

// ---------------------------------------------------------------------------
// AG Grid Community
// ---------------------------------------------------------------------------

export async function agGridAdapter(): Promise<GridAdapter> {
  // `ag-grid-community` neither exposes ./package.json in its exports map nor
  // re-exports its internal VERSION constant, so the version is read from the
  // installed manifest by relative path. A benchmark that cannot say which
  // version it measured is not reproducible.
  const [ag, agPkg] = await Promise.all([
    import('ag-grid-community'),
    import('../../node_modules/ag-grid-community/package.json'),
  ])
  const { createGrid, ModuleRegistry, AllCommunityModule, themeQuartz } = ag as unknown as {
    createGrid: (el: HTMLElement, opts: Record<string, unknown>) => {
      setGridOption: (k: string, v: unknown) => void
      destroy: () => void
    }
    ModuleRegistry: { registerModules: (m: unknown[]) => void }
    AllCommunityModule: unknown
    themeQuartz: unknown
  }
  ModuleRegistry.registerModules([AllCommunityModule])

  let api: { setGridOption: (k: string, v: unknown) => void; destroy: () => void } | null = null
  let host: HTMLElement | null = null

  const rowNodes = () => host?.querySelectorAll('.ag-center-cols-container .ag-row') ?? []

  return {
    name: 'AG Grid Community',
    version: (agPkg as { default?: { version?: string }; version?: string }).default?.version
      ?? (agPkg as { version?: string }).version
      ?? 'unknown',
    license: 'MIT',
    async mount(el, rows) {
      host = el
      el.style.height = '100%'
      api = createGrid(el, {
        theme: themeQuartz,
        rowData: rows,
        rowHeight: ROW_HEIGHT,
        // Match sv-grid: both axes virtualized, no extra features enabled.
        columnDefs: COLUMNS.map((c) => ({
          field: c.field as string,
          headerName: c.header,
          sortable: true,
          filter: true,
          // Fixed widths so neither grid pays for auto-sizing the other skips.
          width: 140,
        })),
        animateRows: false,
        suppressColumnVirtualisation: false,
      })
      await settle(() => rowNodes().length > 0, 'ag-grid mount')
    },
    async sort(field, desc) {
      api?.setGridOption(
        'columnDefs',
        COLUMNS.map((c) => ({
          field: c.field as string,
          headerName: c.header,
          sortable: true,
          filter: true,
          width: 140,
          sort: c.field === field ? (desc ? 'desc' : 'asc') : null,
        })),
      )
      await domSettled(host!)
    },
    async filter(field, value) {
      api?.setGridOption('quickFilterText', value)
      void field
      await domSettled(host!)
    },
    async scrollBy(dy) {
      const el = host?.querySelector<HTMLElement>('.ag-body-viewport')
      if (el) el.scrollTop += dy
      await painted()
    },
    domRowCount() {
      return rowNodes().length
    },
    destroy() {
      api?.destroy()
      api = null
      host = null
    },
  }
}

export const ADAPTERS: Record<string, () => Promise<GridAdapter>> = {
  svgrid: svgridAdapter,
  aggrid: agGridAdapter,
}

/**
 * Local, uncommitted adapters.
 *
 * Drop an `adapters.local.ts` next to this file exporting
 * `{ LOCAL_ADAPTERS: Record<string, () => Promise<GridAdapter>> }` and it is
 * merged in automatically. `import.meta.glob` rather than a direct import so
 * the absence of the file is not a build error.
 *
 * This exists because not every grid can be committed to a public comparison.
 * Some are licensed in ways that restrict using them to produce competitive
 * claims, and evaluating one privately is a different thing from publishing the
 * result. Keep those here: the file is gitignored, so measurements you can take
 * are not limited to results you can publish.
 */
const LOCAL_MODULES = import.meta.glob('./adapters.local.ts', { eager: false })

export async function loadAdapters(): Promise<Record<string, () => Promise<GridAdapter>>> {
  const out = { ...ADAPTERS }
  for (const load of Object.values(LOCAL_MODULES)) {
    try {
      const mod = (await load()) as { LOCAL_ADAPTERS?: Record<string, () => Promise<GridAdapter>> }
      Object.assign(out, mod.LOCAL_ADAPTERS ?? {})
    } catch {
      // A local adapter that fails to load must not take the suite with it.
    }
  }
  return out
}
