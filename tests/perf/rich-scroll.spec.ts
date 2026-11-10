/**
 * Scroll cost with plain cells, rich cells and SvGrid Base, interleaved.
 *
 * Drives examples/src/bench/scroll-run.ts (window.__gridBench.runScroll) on
 * the production bench build. Every case runs in a fresh page; the order is
 * round-major (round 1: every case, round 2: every case, ...) so a slow spell
 * on the machine lands on all grids rather than on one.
 *
 *   cd examples && npx vite build --config vite.bench.config.js && npx vite preview --config vite.bench.config.js
 *   SVGRID_BENCH_PORT=4190 RS_AXIS=v RS_THROTTLE=1,4 RS_ROUNDS=5 \
 *     npx playwright test -c playwright.perf.config.ts tests/perf/rich-scroll.spec.ts
 *
 * Per case it reports:
 *   - ms/step: main-thread TaskDuration over the timed steps / steps (Chrome's
 *     counter, which includes style, layout and paint recording);
 *   - frame p95 and frames over 8.3 / 16.7 ms: from a trace of the same steps,
 *     each step cut at its `bstep` user-timing mark, and within it the
 *     longest burst of renderer main-thread tasks (tasks closer than 6 ms
 *     merged) - the frame that carried the scroll;
 *   - style+layout ms and counts per step, built / moved elements per step
 *     over 60 more untimed steps, and the JS heap after GC.
 *
 * Env: RS_CASES (grid:scenario,...), RS_AXIS (v|h), RS_THROTTLE (1,4),
 * RS_ROUNDS, RS_ROWS, RS_STEPS, RS_DELTA, RS_OUT (json path), RS_BURST and
 * RS_PAUSE (timed steps per burst and the idle ms between bursts; see
 * ScrollOptions.burst in scroll-run.ts - 25 / 1500 keeps each burst under the
 * ~2 s after which this laptop moves the main thread to slower cores).
 */
import { test, type CDPSession, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

test.use({ video: 'off' })

const AXIS = (process.env.RS_AXIS ?? 'v') as 'v' | 'h'
const DEFAULT_CASES =
  AXIS === 'v'
    ? 'svgrid:plain,aggrid:plain,svar:plain,tanstack:plain,svgrid:rich,aggrid:rich,svar:rich,tanstack:rich,base-page:base,base-server:base'
    : 'svgrid:richWide,aggrid:richWide,svar:richWide,tanstack:richWide,base-page:base'
const CASES = (process.env.RS_CASES ?? DEFAULT_CASES).split(',').filter(Boolean).map((c) => {
  const [grid, scenario] = c.split(':')
  return { grid: grid!, scenario: scenario! }
})
const THROTTLES = (process.env.RS_THROTTLE ?? '1,4').split(',').map(Number)
const ROUNDS = Number(process.env.RS_ROUNDS ?? 5)
const ROWS = Number(process.env.RS_ROWS ?? (AXIS === 'v' ? 100_000 : 10_000))
const STEPS = Number(process.env.RS_STEPS ?? 150)
const DELTA = Number(process.env.RS_DELTA ?? 60)
const PORT = process.env.SVGRID_BENCH_PORT ?? '4190'
const BURST = Number(process.env.RS_BURST ?? 0)
const PAUSE = Number(process.env.RS_PAUSE ?? 1500)

type Metrics = Record<string, number>
type TraceEvent = { name: string; cat: string; ph: string; ts: number; dur?: number; pid: number; tid: number; args?: Record<string, unknown> }

export type RunOut = {
  grid: string
  scenario: string
  throttle: number
  round: number
  msPerStep: number
  scriptPerStep: number
  styleLayoutPerStep: number
  layoutsPerStep: number
  stylesPerStep: number
  frameP50: number
  frameP95: number
  frameMax: number
  over8: number
  over16: number
  stepP95: number
  builtPerStep: number
  movedPerStep: number
  domRows: number
  domCells: number
  heapDataMB: number
  heapGridMB: number
  heapScrolledMB: number
  error?: string
}

async function collectTrace(cdp: CDPSession): Promise<TraceEvent[]> {
  const events: TraceEvent[] = []
  const onData = (p: { value: TraceEvent[] }) => events.push(...p.value)
  cdp.on('Tracing.dataCollected', onData)
  const done = new Promise<void>((r) => cdp.once('Tracing.tracingComplete', () => r()))
  await cdp.send('Tracing.end')
  await done
  cdp.off('Tracing.dataCollected', onData)
  return events
}

/** Per step: the longest burst of main-thread work (tasks < 6 ms apart merged), and the step's total. */
export function framesFromTrace(events: TraceEvent[]): { frames: number[]; steps: number[] } {
  const marks = events.filter((e) => e.name === 'bstep' && e.cat.includes('user_timing'))
  if (!marks.length) return { frames: [], steps: [] }
  // A `bidle` mark (burst mode) ends the step before it: the pause is not a frame.
  const idles = events.filter((e) => e.name === 'bidle').map((e) => e.ts)
  const { pid, tid } = marks[0]!
  const tasks = events
    .filter((e) => e.pid === pid && e.tid === tid && e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask' && (e.dur ?? 0) > 0)
    .sort((a, b) => a.ts - b.ts)
  const starts = marks.map((m) => m.ts).sort((a, b) => a - b)
  const frames: number[] = []
  const steps: number[] = []
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i]!
    let to = starts[i + 1] ?? from + 40_000
    for (const t of idles) if (t > from && t < to) to = t
    let total = 0
    let burst = 0
    let best = 0
    let lastEnd = -Infinity
    for (const t of tasks) {
      const end = t.ts + t.dur!
      if (end <= from || t.ts >= to) continue
      const s = Math.max(t.ts, from)
      const e = Math.min(end, to)
      const d = e - s
      total += d
      if (s - lastEnd > 6000) burst = 0
      burst += d
      best = Math.max(best, burst)
      lastEnd = e
    }
    frames.push(best / 1000)
    steps.push(total / 1000)
  }
  return { frames, steps }
}

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : NaN
}

async function runCase(page: Page, grid: string, scenario: string, throttle: number, round: number): Promise<RunOut> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  const marks: Record<string, Metrics> = {}
  const heap: Record<string, number> = {}
  let trace: TraceEvent[] = []
  await page.exposeFunction('__benchPhase', async (label: string) => {
    // Trace on before the start counters and off after the end ones, so the
    // trace's own start and flush stay outside the counted window.
    if (label === 'scroll:start') {
      await cdp.send('Tracing.start', { categories: 'toplevel,blink.user_timing', transferMode: 'ReportEvents' })
    }
    const { metrics } = (await cdp.send('Performance.getMetrics')) as { metrics: Array<{ name: string; value: number }> }
    marks[label] = Object.fromEntries(metrics.map((m) => [m.name, m.value]))
    if (label === 'scroll:end') trace = await collectTrace(cdp)
  })
  await page.exposeFunction('__benchHeap', async (label: string) => {
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('HeapProfiler.collectGarbage')
    const { usedSize } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number }
    heap[label] = usedSize / 1048576
  })
  await page.goto(`http://localhost:${PORT}/bench.html`)
  await page.locator('#run').waitFor({ timeout: 60_000 })
  const r = (await page.evaluate(
    async (o) => {
      const bench = (window as unknown as { __gridBench: { runScroll: (h: HTMLElement, o: unknown) => Promise<unknown>; host: HTMLElement } }).__gridBench
      return bench.runScroll(bench.host, o)
    },
    { grid, scenario, rows: ROWS, axis: AXIS, steps: STEPS, delta: DELTA, burst: BURST, pause: PAUSE },
  )) as { error?: string; built: number; moved: number; churnSteps: number; domRows: number; domCells: number }
  const a = marks['scroll:start'] ?? {}
  const b = marks['scroll:end'] ?? {}
  const per = (k: string) => ((b[k] ?? NaN) - (a[k] ?? NaN)) / STEPS
  const { frames, steps } = framesFromTrace(trace)
  return {
    grid,
    scenario,
    throttle,
    round,
    msPerStep: per('TaskDuration') * 1000,
    scriptPerStep: per('ScriptDuration') * 1000,
    styleLayoutPerStep: (per('RecalcStyleDuration') + per('LayoutDuration')) * 1000,
    layoutsPerStep: per('LayoutCount'),
    stylesPerStep: per('RecalcStyleCount'),
    frameP50: q(frames, 0.5),
    frameP95: q(frames, 0.95),
    frameMax: Math.max(...frames),
    over8: frames.filter((f) => f > 8.33).length,
    over16: frames.filter((f) => f > 16.67).length,
    stepP95: q(steps, 0.95),
    builtPerStep: r.built / r.churnSteps,
    movedPerStep: r.moved / r.churnSteps,
    domRows: r.domRows,
    domCells: r.domCells,
    heapDataMB: heap.data ?? NaN,
    heapGridMB: (heap.mounted ?? NaN) - (heap.data ?? NaN),
    heapScrolledMB: (heap.scrolled ?? NaN) - (heap.data ?? NaN),
    error: r.error,
  }
}

test('rich scroll', async ({ browser }) => {
  test.setTimeout(Number(process.env.RS_TIMEOUT_MS ?? 5_400_000))
  const out: RunOut[] = []
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  // Warm the preview server's file cache and the HTTP cache once.
  {
    const p = await context.newPage()
    await p.goto(`http://localhost:${PORT}/bench.html`)
    await p.close()
  }
  for (let round = 1; round <= ROUNDS; round++) {
    for (const throttle of THROTTLES) {
      for (const c of CASES) {
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(String(e)))
        try {
          const r = await runCase(page, c.grid, c.scenario, throttle, round)
          if (!r.error && errors.length) r.error = `page error: ${errors[0]}`
          out.push(r)
          console.log(
            `  r${round} x${throttle} ${(c.grid + ':' + c.scenario).padEnd(22)} ${r.msPerStep.toFixed(2).padStart(6)} ms/step  p95 ${r.frameP95.toFixed(2).padStart(6)}  >8.3 ${String(r.over8).padStart(3)}  >16.7 ${String(r.over16).padStart(3)}  built ${r.builtPerStep.toFixed(1)} moved ${r.movedPerStep.toFixed(1)}  heap ${r.heapGridMB.toFixed(1)} MB${r.error ? '  ERROR ' + r.error : ''}`,
          )
        } finally {
          await page.close()
        }
      }
    }
  }
  await context.close()

  const file = process.env.RS_OUT ?? join(process.cwd(), 'tests', 'perf', `.last-rich-scroll-${AXIS}.json`)
  writeFileSync(file, JSON.stringify({ measuredAt: new Date().toISOString(), axis: AXIS, rows: ROWS, steps: STEPS, delta: DELTA, rounds: ROUNDS, runs: out }, null, 2) + '\n')

  // Median and spread (min-max) per case and throttle.
  const med = (xs: number[]) => q(xs, 0.5)
  const fmt = (xs: number[], d = 2) => `${med(xs).toFixed(d)} (${Math.min(...xs).toFixed(d)}-${Math.max(...xs).toFixed(d)})`
  console.log(`\n  axis ${AXIS}, ${ROWS} rows, ${STEPS} steps of ${DELTA} px, ${ROUNDS} rounds: median (min-max)\n`)
  for (const throttle of THROTTLES) {
    console.log(`  CPU x${throttle}`)
    for (const c of CASES) {
      const rs = out.filter((r) => r.grid === c.grid && r.scenario === c.scenario && r.throttle === throttle && !r.error)
      if (!rs.length) {
        console.log(`    ${(c.grid + ':' + c.scenario).padEnd(22)} no valid runs`)
        continue
      }
      const col = (k: keyof RunOut, d = 2) => fmt(rs.map((r) => r[k] as number), d)
      console.log(
        `    ${(c.grid + ':' + c.scenario).padEnd(22)} ms/step ${col('msPerStep')}  p95 ${col('frameP95')}  >8.3 ${col('over8', 0)}  >16.7 ${col('over16', 0)}  ` +
          `style+layout ${col('styleLayoutPerStep')} (${med(rs.map((r) => r.layoutsPerStep)).toFixed(2)} L, ${med(rs.map((r) => r.stylesPerStep)).toFixed(2)} S)  built ${col('builtPerStep', 1)}  moved ${col('movedPerStep', 1)}  heap ${col('heapGridMB', 1)} MB  rows ${rs[0]!.domRows} cells ${rs[0]!.domCells}`,
      )
    }
  }
})
