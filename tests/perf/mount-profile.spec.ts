/**
 * CPU profile of a large grid mount, to find where first-paint time actually
 * goes before optimising anything.
 *
 * Written because the obvious guess was wrong. First paint at 100k x 100 costs
 * ~570ms of grid time, and the assumption was that per-cell work dominated -
 * but column virtualization means only a few hundred cells ever render, which
 * is nowhere near enough to explain it. Rather than optimise the wrong thing
 * twice, this samples the real thing.
 *
 * Not a gate and not part of `pnpm bench:dom`'s reported output - it is a
 * diagnostic you run when you want to know what to fix next:
 *
 *   npx playwright test tests/perf/mount-profile.spec.ts --project=perf
 */
import { test } from '@playwright/test'

type Node = {
  id: number
  callFrame: { functionName: string; url: string; lineNumber: number }
  hitCount?: number
  children?: number[]
}

/** Start a CPU profile, run `body`, print the top self-time frames. */
async function profile(
  page: import('@playwright/test').Page,
  label: string,
  body: () => Promise<void>,
  top = 22,
) {
  const client = await page.context().newCDPSession(page)
  await client.send('Profiler.enable')
  await client.send('Profiler.setSamplingInterval', { interval: 100 })
  await client.send('Profiler.start')
  await body()
  const { profile: p } = (await client.send('Profiler.stop')) as {
    profile: { nodes: Node[]; startTime: number; endTime: number }
  }

  const self = new Map<string, number>()
  let total = 0
  for (const n of p.nodes) {
    const hits = n.hitCount ?? 0
    if (!hits) continue
    total += hits
    const f = n.callFrame
    const file = f.url.split('/').slice(-1)[0] ?? ''
    self.set(
      `${f.functionName || '(anonymous)'}  ${file}:${f.lineNumber + 1}`,
      (self.get(`${f.functionName || '(anonymous)'}  ${file}:${f.lineNumber + 1}`) ?? 0) + hits,
    )
  }
  const windowMs = (p.endTime - p.startTime) / 1000
  console.log(`\n  ${label}. Window ${windowMs.toFixed(0)} ms, ${total} samples.`)
  console.log(`    ${'self ms'.padStart(8)} ${'%'.padStart(6)}  function`)
  for (const [name, hits] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    const ms = ((hits / total) * windowMs).toFixed(0)
    console.log(`    ${ms.padStart(8)} ${((hits / total) * 100).toFixed(1).padStart(6)}  ${name}`)
  }
  console.log('')
}

test('where does a 100k x 100 mount spend its time', async ({ page }) => {
  test.setTimeout(300_000)

  await page.goto('http://localhost:5174/#/06-large-dataset')
  await page.locator('tr.sv-grid-row').first().waitFor({ timeout: 120_000 })

  const client = await page.context().newCDPSession(page)
  await client.send('Profiler.enable')
  // 100us sampling: fine enough to separate callees on a ~600ms window without
  // the profiler itself distorting the measurement.
  await client.send('Profiler.setSamplingInterval', { interval: 100 })
  await client.send('Profiler.start')

  await page.evaluate(async () => {
    const button = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === '100k × 100',
    ) as HTMLButtonElement
    button.click()
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    const deadline = performance.now() + 120_000
    for (;;) {
      await frame()
      if (
        document.body.innerText.includes('100,000 rows') &&
        document.querySelectorAll('tr.sv-grid-row').length > 0
      ) {
        await frame()
        return
      }
      if (performance.now() > deadline) throw new Error('timed out')
    }
  })

  const { profile } = (await client.send('Profiler.stop')) as {
    profile: { nodes: Node[]; startTime: number; endTime: number; samples?: number[] }
  }

  // Self time per function, from hit counts. `samples` plus the node table is
  // enough - no need for the timeDeltas, since every sample is one interval.
  const byId = new Map<number, Node>()
  for (const n of profile.nodes) byId.set(n.id, n)

  const self = new Map<string, number>()
  let total = 0
  for (const n of profile.nodes) {
    const hits = n.hitCount ?? 0
    if (!hits) continue
    total += hits
    const f = n.callFrame
    const file = f.url.split('/').slice(-1)[0] ?? ''
    const name = `${f.functionName || '(anonymous)'}  ${file}:${f.lineNumber + 1}`
    self.set(name, (self.get(name) ?? 0) + hits)
  }

  const ranked = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
  const ms = (hits: number) => ((hits / total) * (profile.endTime - profile.startTime) / 1000).toFixed(0)

  console.log(`\n  Mount profile, 100k x 100. Window ${((profile.endTime - profile.startTime) / 1000).toFixed(0)} ms, ${total} samples.\n`)
  console.log(`    ${'self ms'.padStart(8)} ${'%'.padStart(6)}  function`)
  for (const [name, hits] of ranked) {
    console.log(`    ${ms(hits).padStart(8)} ${((hits / total) * 100).toFixed(1).padStart(6)}  ${name}`)
  }
  console.log('')
})

test('where does a 100k text sort spend its time', async ({ page }) => {
  test.setTimeout(600_000)

  // Drive the comparison harness rather than a demo: it mounts a bare grid with
  // no toolbar or extra features, so a sort profile is not contaminated by
  // whatever else a demo page happens to render.
  await page.goto('http://localhost:5174/bench.html?rows=100000&repeats=1&grids=svgrid')
  await page.locator('#run').waitFor({ timeout: 60_000 })

  // Mount once, outside the profiled region.
  await page.evaluate(async () => {
    const b = (window as unknown as {
      __gridBench: {
        runAll: (h: HTMLElement, o: { rows: number; repeats: number; grids: string[] }) => Promise<unknown>
        host: HTMLElement
      }
    }).__gridBench
    const mod = await import('/src/bench/run.ts')
    const adapters = await import('/src/bench/adapters.ts')
    const rows = (mod as { makeRows: (n: number) => unknown[] }).makeRows(100_000)
    const a = await (adapters as { svgridAdapter: () => Promise<Record<string, Function>> }).svgridAdapter()
    b.host.innerHTML = ''
    const cell = document.createElement('div')
    cell.style.cssText = 'height:100%;width:100%'
    b.host.appendChild(cell)
    await a.mount!(cell, rows)
    ;(window as unknown as { __a: unknown }).__a = a
  })

  await profile(page, 'Text-column sort, 100k rows', async () => {
    await page.evaluate(async () => {
      const a = (window as unknown as { __a: { sort: (f: string, d: boolean) => Promise<void> } }).__a
      // Several alternating sorts so the sample count is meaningful.
      for (let i = 0; i < 4; i++) await a.sort('name', i % 2 === 0)
    })
  })
})

test('where does a 100k mount spend its time (pre-built data)', async ({ page }) => {
  test.setTimeout(600_000)

  // The demo-driven profile above is dominated by the demo inventing its data.
  // This one uses the comparison harness, which builds rows ONCE up front, so
  // what is sampled is the grid's own mount - the number the head-to-head
  // measures and the one worth optimising.
  await page.goto('http://localhost:5174/bench.html?rows=100000&repeats=1&grids=svgrid')
  await page.locator('#run').waitFor({ timeout: 60_000 })

  // Warm the module graph and build the rows outside the profiled region.
  await page.evaluate(async () => {
    const run = await import('/src/bench/run.ts')
    const adapters = await import('/src/bench/adapters.ts')
    const w = window as unknown as { __rows: unknown[]; __make: () => Promise<Record<string, Function>> }
    w.__rows = (run as { makeRows: (n: number) => unknown[] }).makeRows(100_000)
    w.__make = (adapters as { svgridAdapter: () => Promise<Record<string, Function>> }).svgridAdapter
    const warm = await w.__make()
    const cell = document.createElement('div')
    cell.style.cssText = 'height:520px;width:1000px'
    document.getElementById('stage')!.appendChild(cell)
    await warm.mount!(cell, w.__rows)
    warm.destroy!()
    document.getElementById('stage')!.innerHTML = ''
  })

  await profile(page, 'Mount, 100k x 9, data already built', async () => {
    await page.evaluate(async () => {
      const w = window as unknown as { __rows: unknown[]; __make: () => Promise<Record<string, Function>> }
      // Several mounts so there are enough samples to rank.
      for (let i = 0; i < 6; i++) {
        const stage = document.getElementById('stage')!
        stage.innerHTML = ''
        const cell = document.createElement('div')
        cell.style.cssText = 'height:520px;width:1000px'
        stage.appendChild(cell)
        const a = await w.__make()
        await a.mount!(cell, w.__rows)
        a.destroy!()
      }
    })
  })
})

test('where does a 100k filter spend its time', async ({ page }) => {
  test.setTimeout(600_000)

  // The engine filters 100k rows in ~4ms (`pnpm bench --case=filter-1op`), but
  // the same filter through <SvGrid> costs ~130ms in a browser. This finds the
  // other ~126ms, which is wrapper + render rather than the row pipeline.
  await page.goto('http://localhost:5174/bench.html?rows=100000&repeats=1&grids=svgrid')
  await page.locator('#run').waitFor({ timeout: 60_000 })

  await page.evaluate(async () => {
    const run = await import('/src/bench/run.ts')
    const adapters = await import('/src/bench/adapters.ts')
    const rows = (run as { makeRows: (n: number) => unknown[] }).makeRows(100_000)
    const a = await (adapters as { svgridAdapter: () => Promise<Record<string, Function>> }).svgridAdapter()
    const stage = document.getElementById('stage')!
    stage.innerHTML = ''
    const cell = document.createElement('div')
    cell.style.cssText = 'height:520px;width:1000px'
    stage.appendChild(cell)
    await a.mount!(cell, rows)
    ;(window as unknown as { __a: unknown }).__a = a
  })

  await profile(page, 'Filter one column, 100k rows', async () => {
    await page.evaluate(async () => {
      const a = (window as unknown as { __a: { filter: (f: string, v: string) => Promise<void> } }).__a
      const values = ['EMEA', 'APAC', 'AMER', '']
      for (let i = 0; i < 8; i++) await a.filter('region', values[i % values.length]!)
    })
  })
})

test('where does a 100k NUMERIC sort spend its time', async ({ page }) => {
  test.setTimeout(600_000)

  // The numeric sort costs ~32ms in the engine and ~133ms in a browser. Text
  // sorting has collation to hide behind; numeric does not, so this isolates
  // the ~100ms of wrapper + render that every data operation pays.
  await page.goto('http://localhost:5174/bench.html?rows=100000&repeats=1&grids=svgrid')
  await page.locator('#run').waitFor({ timeout: 60_000 })

  await page.evaluate(async () => {
    const run = await import('/src/bench/run.ts')
    const adapters = await import('/src/bench/adapters.ts')
    const rows = (run as { makeRows: (n: number) => unknown[] }).makeRows(100_000)
    const a = await (adapters as { svgridAdapter: () => Promise<Record<string, Function>> }).svgridAdapter()
    const stage = document.getElementById('stage')!
    stage.innerHTML = ''
    const cell = document.createElement('div')
    cell.style.cssText = 'height:520px;width:1000px'
    stage.appendChild(cell)
    await a.mount!(cell, rows)
    ;(window as unknown as { __a: unknown }).__a = a
  })

  await profile(page, 'Numeric-column sort, 100k rows', async () => {
    await page.evaluate(async () => {
      const a = (window as unknown as { __a: { sort: (f: string, d: boolean) => Promise<void> } }).__a
      for (let i = 0; i < 6; i++) await a.sort('amount', i % 2 === 0)
    })
  }, 26)
})

test('filter cost breakdown: pipeline versus render', async ({ page }) => {
  test.setTimeout(600_000)

  // The profiler's source maps stop being useful once every candidate is an
  // anonymous closure in a compiled Svelte component. Ablation answers the
  // question instead: filter to a value matching ~20% of rows, then to one
  // matching NONE (pipeline runs, almost nothing renders), then re-apply an
  // identical filter (nothing should recompute at all).
  await page.goto('http://localhost:5174/bench.html?rows=100000&repeats=1&grids=svgrid')
  await page.locator('#run').waitFor({ timeout: 60_000 })

  const out = await page.evaluate(async () => {
    const run = await import('/src/bench/run.ts')
    const adapters = await import('/src/bench/adapters.ts')
    const rows = (run as { makeRows: (n: number) => unknown[] }).makeRows(100_000)
    const a = await (adapters as { svgridAdapter: () => Promise<Record<string, Function>> }).svgridAdapter()
    const stage = document.getElementById('stage')!
    stage.innerHTML = ''
    const cell = document.createElement('div')
    cell.style.cssText = 'height:520px;width:1000px'
    stage.appendChild(cell)
    await a.mount!(cell, rows)

    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    const painted = async () => { await frame(); await frame() }

    /** Time a filter apply, separating the synchronous burst from the frames. */
    async function measure(value: string) {
      const t0 = performance.now()
      await (a.filter as (f: string, v: string) => Promise<void>)('region', value)
      const total = performance.now() - t0
      return total
    }

    const median = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s[s.length >> 1]! }

    // Warm.
    for (const v of ['EMEA', 'APAC', '']) await measure(v)

    const matches: number[] = []
    const noMatch: number[] = []
    const repeat: number[] = []
    for (let i = 0; i < 7; i++) {
      matches.push(await measure(i % 2 === 0 ? 'EMEA' : 'APAC'))
      noMatch.push(await measure('ZZZZ-nothing-matches'))
      await measure('EMEA')
      repeat.push(await measure('EMEA')) // identical value, second time
      await measure('')
    }
    await painted()

    const domRows = () => document.querySelectorAll('tr.sv-grid-row').length
    await measure('ZZZZ-nothing-matches')
    const emptyRows = domRows()
    await measure('')
    const fullRows = domRows()

    return {
      matches: median(matches),
      noMatch: median(noMatch),
      repeat: median(repeat),
      emptyRows,
      fullRows,
    }
  })

  console.log('\n  Filter cost breakdown, 100k rows\n')
  console.log(`    matches ~20% of rows          ${out.matches.toFixed(1).padStart(8)} ms   (${out.fullRows} rows rendered)`)
  console.log(`    matches nothing               ${out.noMatch.toFixed(1).padStart(8)} ms   (${out.emptyRows} rows rendered)`)
  console.log(`    re-applying an identical value${out.repeat.toFixed(1).padStart(8)} ms`)
  console.log('\n    "matches nothing" still runs the whole pipeline but renders no')
  console.log('    rows, so the gap between the first two lines is render. The third')
  console.log('    line should be near zero - anything else is recompute that the')
  console.log('    value did not change.\n')
})

test('mount phase split: svelte create versus settle', async ({ page }) => {
  test.setTimeout(600_000)

  // Sampled profiles keep attributing anonymous closures to the wrong source
  // lines in this codebase, so measure phases directly instead. Svelte's
  // `mount()` is synchronous for the initial render, so the split is:
  //   create  - component construction + initial render + effects
  //   settle  - everything after, until rows are actually in the DOM
  await page.goto('http://localhost:5174/bench.html?rows=100000&repeats=1&grids=svgrid')
  await page.locator('#run').waitFor({ timeout: 60_000 })

  const out = await page.evaluate(async () => {
    const runMod = await import('/src/bench/run.ts')
    const svelte = await import('/src/bench/svelte-bridge.ts')
    const { default: BenchSvGrid } = await import('/src/bench/BenchSvGrid.svelte')
    const adapters = await import('/src/bench/adapters.ts')
    const COLUMNS = (adapters as { COLUMNS: unknown[] }).COLUMNS
    const rows = (runMod as { makeRows: (n: number) => unknown[] }).makeRows(100_000)

    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

    async function once(rowCount: number, colCount = 9) {
      const data = rows.slice(0, rowCount)
      const cols = (COLUMNS as unknown[]).slice(0, colCount)
      const stage = document.getElementById('stage')!
      stage.innerHTML = ''
      const cell = document.createElement('div')
      cell.style.cssText = 'height:520px;width:1000px'
      stage.appendChild(cell)

      const handle: Record<string, unknown> = {}
      const t0 = performance.now()
      const app = (svelte as { mount: (c: unknown, o: unknown) => unknown }).mount(BenchSvGrid, {
        target: cell,
        props: { rows: data, columns: cols, rowHeight: 32, handle },
      })
      const created = performance.now() - t0

      // Rows may already be present (SSR-shaped first render) or arrive after
      // the first effect flush; wait either way.
      let guard = 0
      while (cell.querySelectorAll('tr.sv-grid-row').length === 0 && guard++ < 600) await frame()
      const settled = performance.now() - t0
      const domRows = cell.querySelectorAll('tr.sv-grid-row').length
      ;(svelte as { unmount: (a: unknown) => void }).unmount(app)
      return { created, settled, domRows }
    }

    // MINIMUM, not median, over many samples. Noise on a developer workstation
    // only ever ADDS time - a scheduler hiccup cannot make a mount finish
    // sooner - so the fastest sample is the cleanest estimate of the real cost,
    // and it is far more stable across runs than a median. Baseline drift of
    // 30% between runs was swamping the changes being measured.
    const best = (xs: number[]) => Math.min(...xs)
    const results: Record<string, { created: number; settled: number; domRows: number }> = {}
    for (const spec of [[1000,1],[1000,3],[1000,6],[1000,9],[100000,9]] as Array<[number,number]>) {
      const [n, cc] = spec
      await once(n, cc) // warm
      const c: number[] = []
      const s: number[] = []
      let domRows = 0
      for (let i = 0; i < 15; i++) {
        const r = await once(n, cc)
        c.push(r.created); s.push(r.settled); domRows = r.domRows
      }
      results[`${n} rows x ${cc} cols`] = { created: best(c), settled: best(s), domRows }
    }
    return results
  })

  console.log('\n  Mount phases (sv-grid)\n')
  console.log(`    ${'rows'.padStart(8)} ${'mount() call'.padStart(14)} ${'until rows in DOM'.padStart(19)} ${'DOM rows'.padStart(9)}`)
  for (const [rows, r] of Object.entries(out)) {
    console.log(
      `    ${rows.padStart(8)} ${(r.created.toFixed(1) + ' ms').padStart(14)} ` +
      `${(r.settled.toFixed(1) + ' ms').padStart(19)} ${String(r.domRows).padStart(9)}`,
    )
  }
  console.log('\n    "mount() call" is synchronous component construction + first')
  console.log('    render. The remainder is effects settling and paint.\n')
})

test('framework floor: a bare Svelte table of the same size', async ({ page }) => {
  test.setTimeout(600_000)

  // <SvGrid> spends ~11ms mounting 252 cells even with every attribute, class,
  // handler and a11y binding stripped. This measures what Svelte costs to
  // create the same number of plain <td>s with nothing on them. If the two are
  // close, the remaining mount time is the framework's floor and no amount of
  // template tuning moves it.
  await page.goto('http://localhost:5174/bench.html?rows=1000&repeats=1&grids=svgrid')
  await page.locator('#run').waitFor({ timeout: 60_000 })

  const out = await page.evaluate(async () => {
    const runMod = await import('/src/bench/run.ts')
    const svelte = await import('/src/bench/svelte-bridge.ts')
    const { default: BareTable } = await import('/src/bench/BareTable.svelte')
    const rows = (runMod as { makeRows: (n: number) => Record<string, unknown>[] }).makeRows(28)
    const allFields = ['id', 'name', 'region', 'status', 'amount', 'qty', 'orderedAt', 'active', 'note']

    function once(colCount: number) {
      const fields = allFields.slice(0, colCount)
      const stage = document.getElementById('stage')!
      stage.innerHTML = ''
      const cell = document.createElement('div')
      stage.appendChild(cell)
      const t0 = performance.now()
      const app = (svelte as { mount: (c: unknown, o: unknown) => unknown }).mount(BareTable, {
        target: cell,
        props: { rows, fields },
      })
      const ms = performance.now() - t0
      const tds = cell.querySelectorAll('td').length
      ;(svelte as { unmount: (a: unknown) => void }).unmount(app)
      return { ms, tds }
    }

    const results: Record<string, { ms: number; tds: number }> = {}
    for (const cc of [1, 3, 6, 9]) {
      once(cc)
      const samples: number[] = []
      let tds = 0
      for (let i = 0; i < 15; i++) { const r = once(cc); samples.push(r.ms); tds = r.tds }
      results[`28 rows x ${cc} cols`] = { ms: Math.min(...samples), tds }
    }
    return results
  })

  console.log('\n  Bare Svelte table (no grid), minimum of 15\n')
  for (const [k, v] of Object.entries(out)) {
    console.log(`    ${k.padEnd(20)} ${(v.ms.toFixed(2) + ' ms').padStart(10)}   ${String(v.tds).padStart(4)} tds`)
  }
  console.log('')
})
