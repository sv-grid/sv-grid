/**
 * Grid comparison harness.
 *
 * Runs the same operations against any grid that provides an adapter, on the
 * same data, in the same container, and reports the numbers side by side.
 *
 * Why this exists in the open, in the repository, rather than as a slide: a
 * benchmark published by a grid vendor is worth nothing unless the method is
 * auditable and a reader can add their own grid and rerun it. Everything here
 * is deliberately boring - no clever warmup tricks, no cherry-picked
 * operation set, and the adapters are the first thing to read if you suspect
 * the comparison is rigged.
 *
 * Known limits, stated up front because they bound what the numbers mean:
 *
 *   - Filtering is not strictly like for like. sv-grid filters one column with
 *     a `contains` operator; AG Grid's equivalent single-column API differs
 *     enough that the harness uses its quick filter, which searches every
 *     column. That is MORE work than sv-grid does, so read the filter row as
 *     indicative only. It is labelled in the output.
 *   - Every grid renders with its own default theme and cell renderers. Making
 *     them pixel-identical would mean disabling things people actually ship.
 *   - One browser, one machine, one dataset shape.
 *
 * Open /bench.html in the examples app, or drive it headlessly with
 * `pnpm bench:compare`.
 */
import { loadAdapters, painted, settle, type BenchColumn, type BenchRow, type GridAdapter } from './adapters'

// ---- data -----------------------------------------------------------------

/** mulberry32 - same generator as tools/bench, so both harnesses agree. */
function rng(seed = 0x56671d) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REGIONS = ['EMEA', 'APAC', 'AMER', 'LATAM', 'ANZ']
const STATUSES = ['open', 'pending', 'shipped', 'closed', 'cancelled']
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']

export function makeRows(count: number): BenchRow[] {
  const rand = rng()
  const out = new Array<BenchRow>(count)
  for (let i = 0; i < count; i++) {
    const r = rand()
    out[i] = {
      id: i + 1,
      name: WORDS[(rand() * WORDS.length) | 0]! + '-' + ((rand() * 9999) | 0),
      region: REGIONS[(rand() * REGIONS.length) | 0]!,
      status: STATUSES[(rand() * STATUSES.length) | 0]!,
      amount: Math.round(r * 100000) / 100,
      qty: 1 + ((rand() * 500) | 0),
      orderedAt: new Date(Date.UTC(2020 + ((rand() * 6) | 0), (rand() * 12) | 0, 1 + ((rand() * 28) | 0)))
        .toISOString()
        .slice(0, 10),
      active: rand() > 0.5,
      note: WORDS[(rand() * WORDS.length) | 0]! + ' ' + WORDS[(rand() * WORDS.length) | 0]!,
    }
  }
  return out
}

// ---- measurement ----------------------------------------------------------

/**
 * Fastest sample, not the median.
 *
 * Noise on a developer workstation only ever ADDS time - a scheduler hiccup, a
 * GC pause or a background process cannot make an operation finish sooner - so
 * the minimum is the cleanest estimate of what the machine can actually do, and
 * it is far more stable run to run. Medians on this box drifted 30% between
 * consecutive runs, which was larger than most of the differences being
 * measured. Applied identically to every grid, so it cannot favour one.
 */
const best = (xs: number[]) => Math.min(...xs)

/**
 * Phase marks for a driver that can read the browser's own counters.
 *
 * Frame intervals cannot tell a 4 ms frame from a 15 ms one: rAF fires at the
 * display rate (60 Hz headless), so every scroll frame reads as one or two
 * refresh intervals whatever the grid did. The Playwright specs expose
 * `window.__benchPhase` and read Chrome's main-thread task, script, style and
 * layout totals at each mark, which gives the work a frame or a jump cost.
 * Opening bench.html by hand there is no hook and the marks do nothing.
 */
async function phase(label: string): Promise<void> {
  const hook = (globalThis as { __benchPhase?: (label: string) => Promise<void> }).__benchPhase
  if (hook) await hook(label)
}

async function timed(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now()
  await fn()
  return performance.now() - t0
}

/** A cell's text as a number, the way the amount check always read it. */
const asNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ''))

/**
 * Wait until the top row shows what the operation should produce.
 *
 * The adapters resolve on the grid's first DOM change plus a frame. A grid
 * that paints in stages - SVAR draws its rows first and their cells a frame
 * or more later - was timed at its first stage: right after a sort it had two
 * rows on screen with no cells in them. Every timed step now also waits for
 * the top row to show the expected value, which costs nothing for a grid that
 * already shows it. An adapter without topValues() is timed as before.
 */
async function untilTop(adapter: GridAdapter, field: string, accept: (text: string) => boolean, label: string) {
  if (!adapter.topValues) return
  const deadline = performance.now() + 15_000
  for (;;) {
    const top = adapter.topValues(field, 1)[0]
    if (top !== undefined && top !== '' && accept(top)) return
    if (performance.now() > deadline) throw new Error(`${adapter.name}: ${label} - the top row shows "${top}"`)
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }
}

/**
 * The values a text column's first row may show after a sort. The grids do
 * not share a text order - collation, plain code units, or a natural order
 * that puts "a-9" before "a-10" - so each order's first value is accepted.
 */
const naturalCollator = new Intl.Collator(undefined, { numeric: true })
function textExtremes(rows: Array<Record<string, unknown>>, field: string, desc: boolean): Set<string> {
  const orders: Array<(a: string, b: string) => number> = [
    (a, b) => a.localeCompare(b),
    (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    (a, b) => naturalCollator.compare(a, b),
  ]
  const out = new Set<string>()
  for (const cmp of orders) {
    let best = String(rows[0]?.[field] ?? '')
    for (let i = 1; i < rows.length; i++) {
      const v = String(rows[i]![field] ?? '')
      const c = cmp(v, best)
      if (desc ? c > 0 : c < 0) best = v
    }
    out.add(best)
  }
  return out
}

/** The first value of a numeric column after a sort, among the rows `keep` lets through. */
function numberExtreme(rows: Array<Record<string, unknown>>, field: string, desc: boolean, keep: (row: Record<string, unknown>) => boolean = () => true): number {
  let best = desc ? -Infinity : Infinity
  for (const row of rows) {
    if (!keep(row)) continue
    const v = Number(row[field])
    if (desc ? v > best : v < best) best = v
  }
  return best
}

export type GridResult = {
  grid: string
  version: string
  license: string
  mount: number
  sortText: number
  sortNumber: number
  filter: number
  scrollP95: number
  scrollDropped: number
  /** p95 wall time of one tick (TICK_ROWS rows replaced, sorted by that column), ms. */
  tickP95: number
  /** Ticks, of `ticks`, that took longer than one 60 Hz frame. */
  tickOverBudget: number
  /** Ticks measured: TICK_FRAMES unless the run asked for fewer (`?ticks=`). */
  ticks: number
  /** Whether the first rows were still in sorted order after the ticks. */
  tickSortHeld: boolean
  domRows: number
  error?: string
}

/** Rows replaced per tick, ticks per measurement, and the frame budget a tick is held to. */
export const TICK_ROWS = 1_000
export const TICK_FRAMES = 180
const FRAME_BUDGET_MS = 1000 / 60

/**
 * A live feed against a grid sorted by the column that ticks.
 *
 * Each tick replaces TICK_ROWS row objects (new `amount`, everything else
 * the same object) in a fresh copy of the array and hands it to the adapter
 * on the grid's own update path; the tick's time runs until the changed
 * cells are painted. Sorted by `amount` first, so every tick has to keep
 * the order current, which is what a blotter asks of a grid. p95 rather
 * than mean for the same reason as the scroll figure: one long tick a
 * second is the stutter a user sees.
 */
async function measureTicks(adapter: GridAdapter, rows: BenchRow[], frames: number) {
  // An adapter without an update path (a local one written before the tick
  // case existed) reports n/a rather than failing the whole run.
  if (!adapter.update) return { p95: NaN, overBudget: NaN, sortHeld: false }
  const update = adapter.update.bind(adapter)
  // Back to the top: the checks below read the first rows on screen, and the
  // scroll case left every grid somewhere down the list.
  const scroller = adapter.scroller?.()
  if (scroller) {
    scroller.scrollTop = 0
    await painted()
  }
  await adapter.sort('amount', true)
  let current = rows
  // Seeded, so every grid ticks the same rows to the same values.
  let seed = 0x7a11
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff)
  const tick = () => {
    const next = current.slice()
    const changed: BenchRow[] = []
    const picked = new Set<number>()
    while (picked.size < TICK_ROWS) picked.add((rand() * next.length) | 0)
    for (const at of picked) {
      const row = { ...next[at]!, amount: Math.round(rand() * 1_000_00) / 100 }
      next[at] = row
      changed.push(row)
    }
    current = next
    return { next, changed }
  }
  for (let i = 0; i < 10; i++) {
    const t = tick()
    await update(t.next, t.changed) // warm-up
  }
  const times: number[] = []
  for (let i = 0; i < frames; i++) {
    const t = tick()
    // The new top amount, worked out before the clock starts.
    const top = numberExtreme(t.next as Array<Record<string, unknown>>, 'amount', true)
    times.push(await timed(async () => {
      await update(t.next, t.changed)
      await untilTop(adapter, 'amount', (text) => asNumber(text) === top, 'tick')
    }))
  }
  const sorted = [...times].sort((a, b) => a - b)
  // The order must have held, or the grid did less than the others and its
  // number is not comparable. Descending by amount: each row >= the next.
  const top = adapter.firstRowAmounts?.(5) ?? []
  const sortHeld = top.length >= 2 && top.every((v, i) => i === 0 || (Number.isFinite(v) && v <= top[i - 1]!))
  return {
    p95: sorted[Math.floor(sorted.length * 0.95)]!,
    overBudget: times.filter((d) => d > FRAME_BUDGET_MS).length,
    sortHeld,
  }
}

/**
 * The body must actually have moved. A frame-rate measurement of a grid that
 * is not scrolling reads as a perfect score: the sv-grid adapter pointed at an
 * element the grid does not render, and its scroll row was the frame rate of a
 * grid standing still.
 */
function assertScrolled(adapter: GridAdapter, axis: 'top' | 'left', from: number) {
  const el = adapter.scroller?.()
  if (!el) return // an adapter without scroller() cannot be checked; its scrollBy stands
  const now = axis === 'top' ? el.scrollTop : el.scrollLeft
  if (!(now > from)) throw new Error(`${adapter.name}: the body did not scroll (${axis} stayed at ${now})`)
}

/**
 * Wait, untimed, until the body can scroll on `axis`. A grid can paint its
 * first rows before it has measured its viewport: SVAR keeps
 * overflow: hidden until its ResizeObserver has run, and sets scrollLeft
 * back from its own state meanwhile, so a scroll started at once moved
 * nothing. Mount is still timed to first rows; this only keeps the scroll
 * measurements from starting on a grid that is not ready to scroll.
 */
async function waitScrollable(adapter: GridAdapter, axis: 'top' | 'left') {
  const el = adapter.scroller?.()
  if (!el) return
  await settle(() => {
    const cs = getComputedStyle(el)
    const overflow = axis === 'top' ? cs.overflowY : cs.overflowX
    const room = axis === 'top' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth
    return room > 0 && overflow !== 'hidden' && overflow !== 'visible'
  }, `${adapter.name} scrollable (${axis})`, 10_000)
}

/** Scroll for `frames` frames, returning the frame-interval distribution. */
async function measureScroll(adapter: GridAdapter, frames: number) {
  const deltas: number[] = []
  await waitScrollable(adapter, 'top')
  const startTop = adapter.scroller?.()?.scrollTop ?? 0
  for (let i = 0; i < 20; i++) await adapter.scrollBy(60) // warm the virtualizer
  assertScrolled(adapter, 'top', startTop)
  await phase('vscroll:start')
  let last = performance.now()
  for (let i = 0; i < frames; i++) {
    await adapter.scrollBy(60)
    const now = performance.now()
    deltas.push(now - last)
    last = now
  }
  await phase('vscroll:end')
  const sorted = [...deltas].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]!
  return {
    p95: sorted[Math.floor(sorted.length * 0.95)]!,
    dropped: deltas.filter((d) => d > p50 * 1.5).length,
  }
}

export async function runOne(
  key: string,
  host: HTMLElement,
  rows: BenchRow[],
  repeats: number,
  tickFrames: number = TICK_FRAMES,
): Promise<GridResult> {
  const make = (await loadAdapters())[key]
  if (!make) throw new Error(`no adapter "${key}"`)

  let adapter: GridAdapter | null = null
  try {
    adapter = await make()

    // Mount is measured on a fresh container each repeat: a second mount into a
    // warm container would measure a different thing than a user's first paint.
    const mounts: number[] = []
    for (let i = 0; i < repeats; i++) {
      host.innerHTML = ''
      const cell = document.createElement('div')
      cell.style.cssText = 'height:100%;width:100%'
      host.appendChild(cell)
      const a = await make()
      const firstId = rows[0]?.id
      mounts.push(await timed(async () => {
        await a.mount(cell, rows)
        await untilTop(a, 'id', (text) => asNumber(text) === firstId, 'mount')
      }))
      if (i < repeats - 1) a.destroy()
      else adapter = a
    }

    const sortText: number[] = []
    const sortNumber: number[] = []
    const filter: number[] = []
    const all = rows as unknown as Array<Record<string, unknown>>
    for (let i = 0; i < repeats; i++) {
      const desc = i % 2 === 0
      const region = desc ? 'EMEA' : 'APAC'
      // Expected first rows, worked out before each clock starts.
      const firstName = textExtremes(all, 'name', desc)
      const firstAmount = numberExtreme(all, 'amount', desc)
      // The filter keeps the amount sort the step before applied.
      const firstFiltered = numberExtreme(all, 'amount', desc, (row) => String(row.region).includes(region))
      const a = adapter!
      sortText.push(await timed(async () => {
        await a.sort('name', desc)
        await untilTop(a, 'name', (text) => firstName.has(text), 'text sort')
      }))
      sortNumber.push(await timed(async () => {
        await a.sort('amount', desc)
        await untilTop(a, 'amount', (text) => asNumber(text) === firstAmount, 'number sort')
      }))
      filter.push(await timed(async () => {
        await a.filter('region', region)
        await untilTop(a, 'amount', (text) => asNumber(text) === firstFiltered, 'filter')
      }))
      await adapter.filter('region', '')
    }

    const scroll = await measureScroll(adapter, 180)
    const domRows = adapter.domRowCount()
    // Last, and after the scroll, on the same mounted grid: sorting for the
    // ticks changes nothing the earlier measurements read.
    const ticks = await measureTicks(adapter, rows, tickFrames)

    return {
      grid: adapter.name,
      version: adapter.version,
      license: adapter.license,
      mount: best(mounts),
      sortText: best(sortText),
      sortNumber: best(sortNumber),
      filter: best(filter),
      scrollP95: scroll.p95,
      scrollDropped: scroll.dropped,
      tickP95: ticks.p95,
      tickOverBudget: ticks.overBudget,
      ticks: tickFrames,
      tickSortHeld: ticks.sortHeld,
      domRows,
    }
  } catch (err) {
    return {
      grid: key,
      version: '-',
      license: '-',
      mount: NaN,
      sortText: NaN,
      sortNumber: NaN,
      filter: NaN,
      scrollP95: NaN,
      scrollDropped: NaN,
      tickP95: NaN,
      tickOverBudget: NaN,
      ticks: tickFrames,
      tickSortHeld: false,
      domRows: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    adapter?.destroy()
    await painted()
  }
}

export async function runAll(
  host: HTMLElement,
  opts: { rows: number; repeats: number; grids: string[]; ticks?: number },
): Promise<GridResult[]> {
  const rows = makeRows(opts.rows)
  const results: GridResult[] = []
  for (const key of opts.grids) {
    results.push(await runOne(key, host, rows, opts.repeats, opts.ticks ?? TICK_FRAMES))
  }
  return results
}

// ---- wide grids -------------------------------------------------------------
//
// Many columns, few rows: what column virtualization is for. Every column is a
// number column 140 px wide (the width every adapter already gives its
// columns), so the same scroll offset shows the same columns in every grid.

export const WIDE_COLUMN_WIDTH = 140

export function wideColumns(count: number): BenchColumn[] {
  return Array.from({ length: count }, (_, c) => ({ field: `c${c}`, header: `C${c}`, type: 'number' as const }))
}

export function makeWideRows(rows: number, cols: number): Array<Record<string, number>> {
  const rand = rng(0x31d3)
  const out = new Array<Record<string, number>>(rows)
  for (let r = 0; r < rows; r++) {
    const row: Record<string, number> = { id: r + 1 }
    for (let c = 0; c < cols; c++) row[`c${c}`] = Math.round(rand() * 100000) / 100
    out[r] = row
  }
  return out
}

export type WideResult = {
  grid: string
  version: string
  license: string
  rows: number
  cols: number
  mount: number
  /** p95 frame interval while scrolling 120 px right per frame, ms. */
  hScrollP95: number
  hScrollDropped: number
  /** A far jump (seeded random scrollLeft) until the column at the viewport centre is painted, ms. */
  jumpP50: number
  jumpP90: number
  /** Body cells in the DOM after the run. Without column virtualization it is rows in view x every column. */
  domCells: number
  error?: string
}

export const WIDE_SCROLL_FRAMES = 180
export const WIDE_JUMPS = 30

async function measureHScroll(adapter: GridAdapter, frames: number) {
  const el = adapter.scroller?.()
  if (!el) throw new Error(`${adapter.name}: no scroller()`)
  await waitScrollable(adapter, 'left')
  const startLeft = el.scrollLeft
  for (let i = 0; i < 20; i++) {
    el.scrollLeft += 120
    await painted()
  }
  assertScrolled(adapter, 'left', startLeft)
  const deltas: number[] = []
  await phase('hscroll:start')
  let last = performance.now()
  for (let i = 0; i < frames; i++) {
    el.scrollLeft += 120
    await painted()
    const now = performance.now()
    deltas.push(now - last)
    last = now
  }
  await phase('hscroll:end')
  const sorted = [...deltas].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]!
  return { p95: sorted[Math.floor(sorted.length * 0.95)]!, dropped: deltas.filter((d) => d > p50 * 1.5).length }
}

/**
 * Far jumps, as a fast drag of the horizontal scrollbar produces: each one
 * lands on columns nowhere near the ones on screen. Timed from setting
 * scrollLeft until a body cell of the column at the viewport centre is in the
 * DOM, then one frame so it has painted. A grid that keeps every column in
 * the DOM passes the check at once; it paid for that at mount and in memory.
 */
async function measureJumps(adapter: GridAdapter, cols: number, jumps: number) {
  const el = adapter.scroller?.()
  if (!el || !adapter.hasCellFor) throw new Error(`${adapter.name}: no scroller() / hasCellFor()`)
  const has = adapter.hasCellFor.bind(adapter)
  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) throw new Error(`${adapter.name}: the body has no horizontal overflow`)
  const rand = rng(0x5eed)
  const times: number[] = []
  await phase('jumps:start')
  for (let i = 0; i < jumps; i++) {
    const x = Math.round(rand() * max)
    const centre = Math.min(cols - 1, Math.floor((x + el.clientWidth / 2) / WIDE_COLUMN_WIDTH))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const t0 = performance.now()
    el.scrollLeft = x
    await settle(() => has(`c${centre}`), `${adapter.name} jump to c${centre}`, 10_000)
    times.push(performance.now() - t0)
  }
  await phase('jumps:end')
  const sorted = [...times].sort((a, b) => a - b)
  return { p50: sorted[Math.floor(sorted.length * 0.5)]!, p90: sorted[Math.floor(sorted.length * 0.9)]! }
}

export async function runWideOne(
  key: string,
  host: HTMLElement,
  data: Array<Record<string, number>>,
  columns: BenchColumn[],
  repeats: number,
): Promise<WideResult> {
  const make = (await loadAdapters())[key]
  if (!make) throw new Error(`no adapter "${key}"`)
  let adapter: GridAdapter | null = null
  try {
    const mounts: number[] = []
    for (let i = 0; i < repeats; i++) {
      host.innerHTML = ''
      const cell = document.createElement('div')
      cell.style.cssText = 'height:100%;width:100%'
      host.appendChild(cell)
      const a = await make()
      mounts.push(await timed(() => a.mount(cell, data, columns)))
      if (i < repeats - 1) a.destroy()
      else adapter = a
    }
    const a = adapter!
    const h = await measureHScroll(a, WIDE_SCROLL_FRAMES)
    const j = await measureJumps(a, columns.length, WIDE_JUMPS)
    return {
      grid: a.name,
      version: a.version,
      license: a.license,
      rows: data.length,
      cols: columns.length,
      mount: best(mounts),
      hScrollP95: h.p95,
      hScrollDropped: h.dropped,
      jumpP50: j.p50,
      jumpP90: j.p90,
      domCells: a.domCellCount?.() ?? NaN,
    }
  } catch (err) {
    return {
      grid: adapter?.name ?? key,
      version: adapter?.version ?? '-',
      license: adapter?.license ?? '-',
      rows: data.length,
      cols: columns.length,
      mount: NaN,
      hScrollP95: NaN,
      hScrollDropped: NaN,
      jumpP50: NaN,
      jumpP90: NaN,
      domCells: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    adapter?.destroy()
    await painted()
  }
}

export async function runWide(
  host: HTMLElement,
  opts: { rows: number; cols: number; repeats: number; grids: string[] },
): Promise<WideResult[]> {
  const columns = wideColumns(opts.cols)
  const data = makeWideRows(opts.rows, opts.cols)
  const results: WideResult[] = []
  for (const key of opts.grids) results.push(await runWideOne(key, host, data, columns, opts.repeats))
  return results
}
