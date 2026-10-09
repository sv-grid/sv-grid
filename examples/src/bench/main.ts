/**
 * Entry point for /bench.html - the grid comparison harness.
 *
 * Exposes `window.__gridBench` so a Playwright spec can drive the same code a
 * human clicking "Run" would, rather than the two drifting apart.
 */
// No stylesheet imports here on purpose. sv-grid's CSS is imported for side
// effects by SvGrid.svelte itself, and AG Grid 35 injects its own via the
// Theming API (`theme: themeQuartz`) - loading the legacy ag-grid.css
// alongside that is explicitly unsupported and would skew the mount number.
import { loadAdapters } from './adapters'
import { makeRows, makeWideRows, runAll, runWide, wideColumns, WIDE_JUMPS, WIDE_SCROLL_FRAMES, type GridResult, type WideResult } from './run'

const params = new URLSearchParams(location.search)
// suite=wide runs the many-columns suite (runWide) instead of the main one.
const SUITE = params.get('suite') === 'wide' ? 'wide' : 'main'
const DEFAULTS = {
  rows: Number(params.get('rows') ?? (SUITE === 'wide' ? 500 : 100_000)),
  cols: Number(params.get('cols') ?? 1_000),
  repeats: Number(params.get('repeats') ?? 3),
  // Ticks for the main suite's live-feed case. Fewer for very large row
  // counts, where one grid's 180 ticks can take most of an hour.
  ticks: Number(params.get('ticks') ?? 180),
  grids: (params.get('grids') ?? 'svgrid,aggrid').split(',').filter(Boolean),
}

const host = document.getElementById('stage') as HTMLElement
const out = document.getElementById('out') as HTMLElement
const status = document.getElementById('status') as HTMLElement
const runBtn = document.getElementById('run') as HTMLButtonElement

function render(results: GridResult[]) {
  const n = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-')
  const rows = results
    .map((r) =>
      r.error
        ? `<tr><td>${r.grid}</td><td colspan="10" class="err">failed: ${r.error}</td></tr>`
        : `<tr>
             <td><strong>${r.grid}</strong><br><span class="dim">${r.version} · ${r.license}</span></td>
             <td>${n(r.mount)}</td>
             <td>${n(r.sortText)}</td>
             <td>${n(r.sortNumber)}</td>
             <td>${n(r.filter)}</td>
             <td>${n(r.scrollP95)}</td>
             <td>${r.scrollDropped}/180</td>
             <td>${n(r.tickP95)}${r.tickSortHeld ? '' : ' <span class="err">(order not kept)</span>'}</td>
             <td>${r.tickOverBudget}/${r.ticks}</td>
             <td>${r.domRows}</td>
           </tr>`,
    )
    .join('')
  out.innerHTML = `
    <table>
      <thead><tr>
        <th>Grid</th><th>Mount (ms)</th><th>Sort text (ms)</th><th>Sort number (ms)</th>
        <th>Filter (ms)</th><th>Scroll p95 (ms)</th><th>Dropped</th>
        <th>Tick p95 (ms)</th><th>Ticks over 16.7 ms</th><th>DOM rows</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">
      Lower is better except DOM rows, which shows virtualization is on - a grid
      holding every row in the DOM would show the full row count. Scroll is
      rAF-driven so p95 cannot fall below the display refresh; the dropped
      column is the jank signal. The filter row is indicative only: the two
      grids' single-column filter APIs differ enough that this drives AG Grid's
      quick filter, which searches every column and so does more work. A tick
      replaces 1,000 rows' amounts in a new array against a grid sorted by
      amount, on each grid's own update path, timed until the cells paint;
      180 ticks, p95 and the count that missed one 60 Hz frame.
    </p>`
}

function renderWide(results: WideResult[]) {
  const n = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-')
  const rows = results
    .map((r) =>
      r.error
        ? `<tr><td>${r.grid}</td><td colspan="7" class="err">failed: ${r.error}</td></tr>`
        : `<tr>
             <td><strong>${r.grid}</strong><br><span class="dim">${r.version} · ${r.license}</span></td>
             <td>${n(r.mount)}</td>
             <td>${n(r.hScrollP95)}</td>
             <td>${r.hScrollDropped}/${WIDE_SCROLL_FRAMES}</td>
             <td>${n(r.jumpP50)}</td>
             <td>${n(r.jumpP90)}</td>
             <td>${r.domCells.toLocaleString()}</td>
           </tr>`,
    )
    .join('')
  out.innerHTML = `
    <table>
      <thead><tr>
        <th>Grid</th><th>Mount (ms)</th><th>H-scroll p95 (ms)</th><th>Dropped</th>
        <th>Far jump p50 (ms)</th><th>Far jump p90 (ms)</th><th>DOM cells</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">
      ${DEFAULTS.rows.toLocaleString()} rows x ${DEFAULTS.cols.toLocaleString()} number columns, 140 px each.
      H-scroll moves the body 120 px right per frame for ${WIDE_SCROLL_FRAMES} frames and reports the
      frame-interval p95 and the frames over 1.5x the median. A far jump sets scrollLeft to a seeded random
      offset (${WIDE_JUMPS} of them, the same for every grid) and is timed until a cell of the column at the
      viewport centre is in the DOM and painted, which is what dragging the scrollbar thumb asks for.
      DOM cells shows whether the grid virtualizes columns: without it, every column of every row in view
      is in the DOM.
    </p>`
}

async function run() {
  runBtn.disabled = true
  status.textContent =
    SUITE === 'wide'
      ? `Running ${DEFAULTS.grids.join(', ')} at ${DEFAULTS.rows.toLocaleString()} rows x ${DEFAULTS.cols.toLocaleString()} columns...`
      : `Running ${DEFAULTS.grids.join(', ')} at ${DEFAULTS.rows.toLocaleString()} rows...`
  out.innerHTML = ''
  try {
    if (SUITE === 'wide') {
      const wide = await runWide(host, DEFAULTS)
      renderWide(wide)
      status.textContent = 'Done.'
      ;(window as unknown as { __gridBenchResults?: WideResult[] }).__gridBenchResults = wide
      return
    }
    const results = await runAll(host, DEFAULTS)
    render(results)
    status.textContent = 'Done.'
    ;(window as unknown as { __gridBenchResults?: GridResult[] }).__gridBenchResults = results
  } catch (err) {
    status.textContent = `Failed: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    runBtn.disabled = false
    host.innerHTML = ''
  }
}

runBtn.addEventListener('click', () => void run())
// The adapters and data builders too, so a profiling script can mount one grid
// on the production build, where modules cannot be imported by path.
;(window as unknown as { __gridBench?: unknown }).__gridBench = { run, runAll, runWide, host, DEFAULTS, SUITE, loadAdapters, makeRows, makeWideRows, wideColumns }

document.getElementById('config')!.textContent =
  SUITE === 'wide'
    ? `${DEFAULTS.rows.toLocaleString()} rows x ${DEFAULTS.cols.toLocaleString()} columns · ${DEFAULTS.repeats} repeats · ${DEFAULTS.grids.join(', ')}`
    : `${DEFAULTS.rows.toLocaleString()} rows · ${DEFAULTS.repeats} repeats · ${DEFAULTS.grids.join(', ')}`
