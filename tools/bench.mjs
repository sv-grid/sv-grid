/**
 * Engine benchmark suite.
 *
 * This exists because docs/help/benchmarks.md published a full table of timings
 * and told readers to reproduce them with `pnpm bench` - and there was no such
 * script, and no CI step behind the "regressions over 10% fail CI" claim it
 * also made. Numbers on a benchmark page are worth exactly as much as the
 * command that regenerates them.
 *
 * Runs against the BUILT `@svgrid/grid/core` (packages/grid/dist/headless.js),
 * not src/, for the same reason check-node-entry.mjs does: that is what a
 * consumer imports, so the bench doubles as a smoke test of the published
 * entry. Run `pnpm --filter @svgrid/grid build` first.
 *
 * Two kinds of number, and the difference is the whole design:
 *
 *   Wall-clock  - reported, never gated. A shared CI runner is far too noisy to
 *                 fail a build on, and a flaky perf gate gets switched off
 *                 within a month of landing.
 *   Work counts - gated. "How many times did the sort comparator resolve a
 *                 column" is identical on every machine, and it is precisely
 *                 what regressed. See tools/bench/counters.mjs.
 *
 * Usage:
 *   pnpm bench                      human table
 *   pnpm bench --json               machine-readable, for trend tracking
 *   pnpm bench --baseline=old.json  adds a delta column
 *   pnpm bench --check              fail if a gated counter regressed
 *   pnpm bench --write-baseline     regenerate tools/bench/baseline.json
 *   pnpm bench --case=sort-1col     run one case
 *
 * Heap figures need --expose-gc (the `bench` script passes it); without it the
 * heap column reads "n/a" rather than reporting a number it cannot trust.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildCases } from './bench/cases.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BASELINE_PATH = join(HERE, 'bench', 'baseline.json')

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const valueOf = (f) => {
  const hit = argv.find((a) => a.startsWith(f + '='))
  return hit ? hit.slice(f.length + 1) : null
}

const JSON_OUT = has('--json')
const CHECK = has('--check')
const WRITE_BASELINE = has('--write-baseline')
const ONLY = valueOf('--case')
const BASELINE_ARG = valueOf('--baseline')

/** Median of 5 after one warm-up. Median, not mean: one GC pause should not
 *  move the number, and with 5 samples a single outlier cannot. */
const RUNS = Number(valueOf('--runs') ?? 5)

const log = (...a) => { if (!JSON_OUT) console.log(...a) }

// ---- load the built engine ------------------------------------------------

const distEntry = join(ROOT, 'packages', 'grid', 'dist', 'headless.js')
const distFormat = join(ROOT, 'packages', 'grid', 'dist', 'export-format.js')
if (!existsSync(distEntry)) {
  console.error(
    `bench: no built engine at ${distEntry}\n` +
    `Run \`pnpm --filter @svgrid/grid build\` first - the bench measures the\n` +
    `published entry, not src/, so there is nothing meaningful to run without it.`,
  )
  process.exit(1)
}

const core = await import(pathToFileURL(distEntry).href)
const format = existsSync(distFormat) ? await import(pathToFileURL(distFormat).href) : {}
// The Excel filter surface: what <SvGrid> actually compiles filters through.
const distFiltering = join(ROOT, 'packages', 'grid', 'dist', 'filtering', 'excel-filters.js')
const filtering = existsSync(distFiltering) ? await import(pathToFileURL(distFiltering).href) : {}
const api = { ...core, ...format, ...filtering }

// ---- measurement ----------------------------------------------------------

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function timeCase(make) {
  const fn = await make()
  await fn() // warm-up: first call pays for JIT and any lazy memo build
  const samples = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    await fn()
    samples.push(performance.now() - t0)
  }
  return { ms: median(samples), min: Math.min(...samples), max: Math.max(...samples) }
}

const canGc = typeof globalThis.gc === 'function'

async function heapCase(make) {
  if (!canGc) return null
  const fn = await make()
  globalThis.gc()
  const before = process.memoryUsage().heapUsed
  const keep = await fn()
  globalThis.gc()
  const after = process.memoryUsage().heapUsed
  // `keep` is referenced so the optimiser cannot discard the work we just paid
  // for before the second reading is taken.
  if (keep === -1) console.log('unreachable')
  return { bytes: Math.max(0, after - before) }
}

// ---- run ------------------------------------------------------------------

const cases = buildCases(api).filter((c) => !ONLY || c.id === ONLY)
if (ONLY && cases.length === 0) {
  console.error(`bench: no case with id "${ONLY}"`)
  process.exit(1)
}

const results = {}

if (ONLY) {
  // Leaf mode: one case, in this process. This is what the parent spawns.
  for (const c of cases) {
    const entry = { label: c.label }
    if (c.time) entry.time = await timeCase(c.time)
    if (c.counts) entry.counts = await c.counts()
    if (c.heap) entry.heap = await heapCase(c.heap)
    results[c.id] = entry
    log(`  ran ${c.id}`)
  }
} else {
  // Every case runs in a FRESH process.
  //
  // They used to share one, and that made every number depend on case order:
  // each case builds its own 100k-row tables, so a case running eighth carried
  // seven predecessors' heap. Grouping measured 169 ms in a full run and 51 ms
  // on its own - a 3x error, in the direction that flatters whatever ran first.
  // Forcing a GC between cases did not fix it, because the problem is a warmed,
  // fragmented heap and V8's accumulated state rather than uncollected garbage.
  //
  // A process per case costs a few seconds of startup and buys numbers that
  // mean the same thing whether you run one case or all of them.
  const { execFileSync } = await import('node:child_process')
  for (const c of cases) {
    log(`  running ${c.id}...`)
    const argv = [
      ...process.execArgv,
      fileURLToPath(import.meta.url),
      `--case=${c.id}`,
      '--json',
      `--runs=${RUNS}`,
    ]
    try {
      const out = execFileSync(process.execPath, argv, { encoding: 'utf-8', maxBuffer: 8 << 20 })
      Object.assign(results, JSON.parse(out).results)
    } catch (err) {
      console.error(`bench: case "${c.id}" failed to run\n${err.stderr || err.message}`)
      process.exit(1)
    }
  }
}

// ---- output ---------------------------------------------------------------

const payload = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  rows: 100_000,
  runs: RUNS,
  results,
}

if (JSON_OUT) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
}

let baseline = null
const baselinePath = BASELINE_ARG ? join(ROOT, BASELINE_ARG) : BASELINE_PATH
if ((BASELINE_ARG || CHECK) && existsSync(baselinePath)) {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
}

if (!JSON_OUT) {
  const pad = (s, n) => String(s).padEnd(n)
  const rpad = (s, n) => String(s).padStart(n)
  log('')
  log(`  ${pad('case', 56)} ${rpad('median', 10)} ${rpad('min', 9)} ${rpad('max', 9)}`)
  log(`  ${'-'.repeat(56)} ${'-'.repeat(10)} ${'-'.repeat(9)} ${'-'.repeat(9)}`)
  for (const [id, r] of Object.entries(results)) {
    if (!r.time) continue
    const prev = baseline?.results?.[id]?.time?.ms
    const delta = prev != null ? `   (${prev.toFixed(1)} ms before, ${(((r.time.ms - prev) / prev) * 100).toFixed(0)}%)` : ''
    log(`  ${pad(r.label, 56)} ${rpad(r.time.ms.toFixed(1) + ' ms', 10)} ${rpad(r.time.min.toFixed(1), 9)} ${rpad(r.time.max.toFixed(1), 9)}${delta}`)
  }

  const withCounts = Object.entries(results).filter(([, r]) => r.counts && Object.keys(r.counts).length)
  if (withCounts.length) {
    log('')
    log('  Work counters (machine-independent, these are what CI gates)')
    for (const [id, r] of withCounts) {
      for (const [k, v] of Object.entries(r.counts)) {
        const prev = baseline?.results?.[id]?.counts?.[k]
        log(`    ${pad(id + ' / ' + k, 52)} ${rpad(v.toLocaleString(), 14)}${prev != null && prev !== v ? `   was ${prev.toLocaleString()}` : ''}`)
      }
    }
  }

  const withHeap = Object.entries(results).filter(([, r]) => r.heap)
  if (withHeap.length) {
    log('')
    log('  Retained heap')
    for (const [, r] of withHeap) {
      log(`    ${pad(r.label, 52)} ${rpad((r.heap.bytes / 1024 / 1024).toFixed(1) + ' MB', 14)}`)
    }
  } else if (!canGc) {
    log('')
    log('  Retained heap: n/a (re-run with --expose-gc to measure)')
  }
  log('')
}

if (WRITE_BASELINE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n')
  log(`  wrote ${BASELINE_PATH.slice(ROOT.length + 1)}`)
  log('  Say why in the commit message - a baseline that moves without a reason')
  log('  is a baseline nobody trusts.')
}

// ---- gate -----------------------------------------------------------------

if (CHECK) {
  const failures = []
  for (const c of cases) {
    if (!c.gate && !c.requires) continue
    const counts = results[c.id]?.counts ?? {}

    // A gated counter that never fired is the SUCCESS case: `getAllCells` is
    // budgeted at zero precisely so that it stops being called at all, and an
    // absent key is how zero looks. Proving the stage actually ran is a
    // separate question, which `requires` answers - without it, a stage that
    // silently stopped executing would satisfy every budget by doing nothing.
    for (const key of c.requires ?? []) {
      if (!(counts[key] > 0)) {
        failures.push(
          `${c.id}: expected "${key}" to be recorded at least once - the stage did not run, ` +
          `so its budgets below prove nothing`,
        )
      }
    }

    for (const [key, rule] of Object.entries(c.gate ?? {})) {
      const actual = counts[key] ?? 0
      if (rule.max != null && actual > rule.max) {
        failures.push(`${c.id}: ${key} = ${actual.toLocaleString()}, budget ${rule.max.toLocaleString()}`)
      }
    }
  }

  if (failures.length) {
    console.error('\nWork-counter budget exceeded:')
    for (const f of failures) console.error('  - ' + f)
    console.error(
      '\nThese count algorithmic work, not elapsed time, so this is a real\n' +
      'regression rather than a noisy runner. Usual causes: a per-row or\n' +
      'per-comparison lookup that used to be hoisted, or a cache key that\n' +
      'picked up a state slice its pipeline does not read.\n' +
      'Budgets live in tools/bench/cases.mjs under each case\'s `gate`.',
    )
    process.exit(1)
  }
  log('  All gated counters within budget.')
}
