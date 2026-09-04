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
import { runAll, type GridResult } from './run'

const params = new URLSearchParams(location.search)
const DEFAULTS = {
  rows: Number(params.get('rows') ?? 100_000),
  repeats: Number(params.get('repeats') ?? 3),
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
        ? `<tr><td>${r.grid}</td><td colspan="8" class="err">failed: ${r.error}</td></tr>`
        : `<tr>
             <td><strong>${r.grid}</strong><br><span class="dim">${r.version} · ${r.license}</span></td>
             <td>${n(r.mount)}</td>
             <td>${n(r.sortText)}</td>
             <td>${n(r.sortNumber)}</td>
             <td>${n(r.filter)}</td>
             <td>${n(r.scrollP95)}</td>
             <td>${r.scrollDropped}/180</td>
             <td>${r.domRows}</td>
           </tr>`,
    )
    .join('')
  out.innerHTML = `
    <table>
      <thead><tr>
        <th>Grid</th><th>Mount (ms)</th><th>Sort text (ms)</th><th>Sort number (ms)</th>
        <th>Filter (ms)</th><th>Scroll p95 (ms)</th><th>Dropped</th><th>DOM rows</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">
      Lower is better except DOM rows, which shows virtualization is on - a grid
      holding every row in the DOM would show the full row count. Scroll is
      rAF-driven so p95 cannot fall below the display refresh; the dropped
      column is the jank signal. The filter row is indicative only: the two
      grids' single-column filter APIs differ enough that this drives AG Grid's
      quick filter, which searches every column and so does more work.
    </p>`
}

async function run() {
  runBtn.disabled = true
  status.textContent = `Running ${DEFAULTS.grids.join(', ')} at ${DEFAULTS.rows.toLocaleString()} rows...`
  out.innerHTML = ''
  try {
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
;(window as unknown as { __gridBench?: unknown }).__gridBench = { run, runAll, host, DEFAULTS }

document.getElementById('config')!.textContent =
  `${DEFAULTS.rows.toLocaleString()} rows · ${DEFAULTS.repeats} repeats · ${DEFAULTS.grids.join(', ')}`
