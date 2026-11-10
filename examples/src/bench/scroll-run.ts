/**
 * Scroll scenarios: plain text, rich cells (rich.ts) and SvGrid Base
 * (base-bench.ts), on either axis, for tests/perf/rich-scroll.spec.ts.
 *
 * One call mounts one grid on one scenario in the page it runs in, scrolls it
 * through `steps` timed steps and returns what the DOM did. The main-thread
 * cost is read by the spec, from Chrome's counters at the `scroll:start` /
 * `scroll:end` phase marks and from a trace over the same steps: every step
 * starts with a `bstep` user-timing mark, so the trace can be cut into steps.
 *
 * A step writes the scroller's position and waits two frames, as the main
 * suite's scrollBy does; a horizontal step that reaches the end turns round,
 * so a long run keeps moving the column window rather than jumping back.
 */
import { loadAdapters, painted, settle, ROW_HEIGHT, type BenchColumn, type GridAdapter } from './adapters'
import { domInsertions, heap, makeRows, phase, releaseLastSvelteEvent, waitScrollable } from './run'

/**
 * 'base.<fieldType>' is the per-type ablation: Base with the primary field,
 * Amount and Account, and eight copies of one field type's column, so the
 * difference to 'base.text' is eight cells of that type per row.
 */
export type Scenario = 'plain' | 'rich' | 'richWide' | 'base' | `base.${string}`

export type ScrollOptions = {
  grid: string
  scenario: Scenario
  rows: number
  axis: 'v' | 'h'
  steps: number
  /** Pixels per step. */
  delta: number
  /**
   * Timed steps per burst; 0 or unset runs them back to back. This laptop
   * moves a busy browser main thread to slower cores after 2-3 s of
   * scrolling, so a long run measures the second half on other hardware.
   * Short bursts with an idle `pause` (ms) between them keep every step on
   * the same footing.
   */
  burst?: number
  pause?: number
}

export type ScrollResult = {
  grid: string
  scenario: Scenario
  axis: 'v' | 'h'
  steps: number
  domRows: number
  domCells: number
  built: number
  moved: number
  churnSteps: number
  movedBy: number
  error?: string
}

const CHURN_STEPS = 60

async function scenarioData(s: Scenario, n: number): Promise<{ rows: Array<Record<string, unknown>>; columns?: BenchColumn[] }> {
  if (s === 'plain') return { rows: makeRows(n) as unknown as Array<Record<string, unknown>> }
  if (s === 'base') {
    const { makeBaseRows } = await import('./base-bench')
    return { rows: makeBaseRows(n) }
  }
  if (s.startsWith('base.')) {
    const { makeBaseRows, BASE_COLUMNS } = await import('./base-bench')
    const type = s.slice(5)
    const rows = makeBaseRows(n)
    const src = BASE_COLUMNS.find((c) => c.fieldType === type)
    if (!src) throw new Error(`no field type ${type} in BASE_COLUMNS`)
    const keep = BASE_COLUMNS.filter((c) => c.field === 'name' || c.field === 'amount' || c.field === 'account')
    // A copy of a link field links one way: eight inverses on one field of Accounts would fight.
    const props = src.fieldProps && 'inverse' in src.fieldProps ? { ...src.fieldProps, inverse: undefined } : src.fieldProps
    const copies = Array.from({ length: 8 }, (_, k) => ({ ...src, fieldProps: props, field: `${src.field}__${k}`, header: `${src.header} ${k + 1}` }))
    for (const r of rows) for (const c of copies) r[c.field] = r[src.field]
    return { rows, columns: [...keep, ...copies] as unknown as BenchColumn[] }
  }
  const { makeRichRows, richColumns } = await import('./rich')
  const repeat = s === 'richWide' ? 5 : 1
  return { rows: makeRichRows(n, repeat), columns: richColumns(repeat) }
}

/** The Base adapter: SvBase over the every-field-type table, rows in the page or paged. */
export async function baseAdapter(mode: 'page' | 'server'): Promise<GridAdapter> {
  const [{ mount, unmount }, { default: BenchBase }] = await Promise.all([import('svelte'), import('./BenchBase.svelte')])
  let app: Record<string, unknown> | null = null
  let host: HTMLElement | null = null
  const handle: { scroller?: () => HTMLElement | null } = {}
  const bodyRows = () => Array.from(host?.querySelectorAll('tbody.sv-grid-body tr.sv-grid-row:not(.sv-grid-row-spacer)') ?? [])
  return {
    name: `SvGrid Base (${mode === 'page' ? 'rows in page' : 'serverRows'})`,
    version: 'workspace',
    license: 'commercial',
    async mount(el, rows, columns) {
      host = el
      app = mount(BenchBase, { target: el, props: { rows, mode, handle, columns: columns as never } }) as Record<string, unknown>
      const first = String((rows[0] as { name?: unknown })?.name ?? '')
      await settle(() => bodyRows().some((tr) => tr.querySelector('td[data-col-id="name"]')?.textContent?.trim() === first), `base ${mode} mount`)
    },
    scroller: () => handle.scroller?.() ?? null,
    domCellCount: () => host?.querySelectorAll('tbody td[data-col-id]').length ?? 0,
    async sort() {},
    async filter() {},
    async scrollBy(dy) {
      const el = handle.scroller?.()
      if (el) el.scrollTop += dy
      await painted()
    },
    topValues(field, count) {
      return bodyRows().slice(0, count).map((tr) => (tr.querySelector(`td[data-col-id="${field}"]`)?.textContent ?? '').trim())
    },
    domRowCount: () => bodyRows().length,
    destroy() {
      if (app) unmount(app as never)
      for (const key of Object.keys(handle)) delete handle[key as keyof typeof handle]
      app = null
      host = null
    },
  }
}

export async function loadScenarioAdapters(): Promise<Record<string, () => Promise<GridAdapter>>> {
  return { ...(await loadAdapters()), 'base-page': () => baseAdapter('page'), 'base-server': () => baseAdapter('server') }
}

let mounted: GridAdapter | null = null

/**
 * Mount `grid` on `scenario` and leave it mounted (for profiling scripts and
 * the screencast check, which drive the scroll themselves).
 */
export async function mountScenario(host: HTMLElement, o: Pick<ScrollOptions, 'grid' | 'scenario' | 'rows'>): Promise<GridAdapter> {
  const make = (await loadScenarioAdapters())[o.grid]
  if (!make) throw new Error(`no adapter "${o.grid}"`)
  const { rows, columns } = await scenarioData(o.scenario, o.rows)
  host.innerHTML = ''
  const cell = document.createElement('div')
  cell.style.cssText = 'height:100%;width:100%'
  host.appendChild(cell)
  const adapter = await make()
  await adapter.mount(cell, rows as never, columns)
  mounted = adapter
  return adapter
}

export function unmountScenario(): void {
  mounted?.destroy()
  mounted = null
}

export async function runScroll(host: HTMLElement, o: ScrollOptions): Promise<ScrollResult> {
  const out: ScrollResult = { grid: o.grid, scenario: o.scenario, axis: o.axis, steps: o.steps, domRows: 0, domCells: 0, built: 0, moved: 0, churnSteps: CHURN_STEPS, movedBy: 0 }
  try {
    await heap('data')
    const adapter = await mountScenario(host, o)
    // The first row's id (or Base's name) on top: mounted means painted with data.
    if (adapter.topValues && !o.scenario.startsWith('base')) {
      await settle(() => adapter.topValues!('id', 1)[0] === '1', `${o.grid} top row`, 15_000)
    }
    await heap('mounted')
    const el = adapter.scroller?.()
    if (!el) throw new Error(`${o.grid}: no scroller`)
    await waitScrollable(adapter, o.axis === 'v' ? 'top' : 'left')
    let dir = 1
    // Read once: a scrollWidth read per step forces a layout and was charged to the grid.
    const max = el.scrollWidth - el.clientWidth
    const step = async () => {
      performance.mark('bstep')
      if (o.axis === 'v') {
        el.scrollTop += o.delta
      } else {
        if ((dir > 0 && el.scrollLeft + o.delta > max) || (dir < 0 && el.scrollLeft - o.delta < 0)) dir = -dir
        el.scrollLeft += dir * o.delta
      }
      await painted()
    }
    const from = o.axis === 'v' ? el.scrollTop : el.scrollLeft
    for (let i = 0; i < 20; i++) await step() // warm the virtualizer
    out.movedBy = (o.axis === 'v' ? el.scrollTop : el.scrollLeft) - from
    if (!(Math.abs(out.movedBy) > 0)) throw new Error(`${o.grid}: the body did not scroll`)
    const burst = o.burst ?? 0
    const rest = () => new Promise<void>((r) => setTimeout(r, o.pause ?? 1500))
    if (burst > 0) await rest()
    await phase('scroll:start')
    for (let i = 0; i < o.steps; i++) {
      if (burst > 0 && i > 0 && i % burst === 0) {
        // Ends the previous step's frame window (see framesFromTrace).
        performance.mark('bidle')
        await rest()
      }
      await step()
    }
    await phase('scroll:end')
    out.domRows = adapter.domRowCount()
    out.domCells = adapter.domCellCount?.() ?? 0
    const ins = domInsertions(host)
    for (let i = 0; i < CHURN_STEPS; i++) await step()
    const churn = ins.stop()
    out.built = churn.built
    out.moved = churn.moved
    await heap('scrolled')
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err)
  } finally {
    unmountScenario()
    await releaseLastSvelteEvent()
  }
  return out
}

export { ROW_HEIGHT }
