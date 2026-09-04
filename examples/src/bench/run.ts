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
import { loadAdapters, painted, type BenchRow, type GridAdapter } from './adapters'

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

async function timed(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now()
  await fn()
  return performance.now() - t0
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
  domRows: number
  error?: string
}

/** Scroll for `frames` frames, returning the frame-interval distribution. */
async function measureScroll(adapter: GridAdapter, frames: number) {
  const deltas: number[] = []
  for (let i = 0; i < 20; i++) await adapter.scrollBy(60) // warm the virtualizer
  let last = performance.now()
  for (let i = 0; i < frames; i++) {
    await adapter.scrollBy(60)
    const now = performance.now()
    deltas.push(now - last)
    last = now
  }
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
      mounts.push(await timed(() => a.mount(cell, rows)))
      if (i < repeats - 1) a.destroy()
      else adapter = a
    }

    const sortText: number[] = []
    const sortNumber: number[] = []
    const filter: number[] = []
    for (let i = 0; i < repeats; i++) {
      sortText.push(await timed(() => adapter!.sort('name', i % 2 === 0)))
      sortNumber.push(await timed(() => adapter!.sort('amount', i % 2 === 0)))
      filter.push(await timed(() => adapter!.filter('region', i % 2 === 0 ? 'EMEA' : 'APAC')))
      await adapter.filter('region', '')
    }

    const scroll = await measureScroll(adapter, 180)
    const domRows = adapter.domRowCount()

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
  opts: { rows: number; repeats: number; grids: string[] },
): Promise<GridResult[]> {
  const rows = makeRows(opts.rows)
  const results: GridResult[] = []
  for (const key of opts.grids) {
    results.push(await runOne(key, host, rows, opts.repeats))
  }
  return results
}
