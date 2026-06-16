# Benchmark harness

> Measure grid time-to-first-paint at every (row count × column count)
> you care about. Run on your branch, your machine, your data shape.
> Use the output to track regressions and to justify "this dataset
> needs server-side pagination".

## When

You're answering:

- "How slow does this get at 100k × 50?"
- "Did my refactor regress paint time?"
- "At what dataset size should I cut over to server-side pagination?"

The same matrix runs in CI as a perf gate, and locally before a PR.

## The harness

The pattern: a tiny `<SvGrid>` mounted in an off-screen probe div,
wrapped in `performance.now()` brackets. The probe unmounts between
measurements so each cell starts from a clean state.

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures,
    rowSortingFeature, columnFilteringFeature, rowSelectionFeature,
    type ColumnDef,
  } from 'sv-grid-core'

  const ROW_SIZES = [100, 1_000, 10_000, 50_000, 100_000] as const
  const COL_SIZES = [5, 10, 20, 50] as const

  type Cell = { rows: number; cols: number; ms: number | null }
  const matrix = $state<Cell[][]>(ROW_SIZES.map((r) =>
    COL_SIZES.map((c) => ({ rows: r, cols: c, ms: null })),
  ))
  let busy = $state(false)
  let running = $state<{ r: number; c: number } | null>(null)

  type Row = Record<string, unknown> & { __id: number }
  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  /** Deterministic seeded data so the same matrix is reproducible. */
  function makeData(rows: number, cols: number) {
    let prng = 0xABCDEF >>> 0
    const rnd = () => (prng = (prng * 1664525 + 1013904223) >>> 0) / 0xFFFFFFFF
    const columns: ColumnDef<typeof features, Row>[] = []
    for (let i = 0; i < cols; i += 1)
      columns.push({ field: `c${i}` as keyof Row & string, header: `Col ${i + 1}`, width: 100 })
    const data: Row[] = new Array(rows)
    for (let i = 0; i < rows; i += 1) {
      const r: Row = { __id: i }
      for (let j = 0; j < cols; j += 1) r[`c${j}`] = Math.round(rnd() * 10000)
      data[i] = r
    }
    return { data, columns }
  }

  /** The off-screen probe. The grid mounts here for measurement. */
  type Probe = { data: Row[]; columns: ColumnDef<typeof features, Row>[] } | null
  let probe = $state<Probe>(null)

  async function runOne(rIdx: number, cIdx: number) {
    busy = true
    running = { r: rIdx, c: cIdx }
    matrix[rIdx]![cIdx]!.ms = null
    probe = null
    await new Promise((r) => requestAnimationFrame(() => r(null)))

    const { rows, cols } = matrix[rIdx]![cIdx]!
    // Generate data BEFORE the timer so the allocation doesn't
    // pollute the time-to-paint number. Yield once after so the
    // status-cell repaint doesn't get blocked by the alloc.
    const { data, columns } = makeData(rows, cols)
    await new Promise((r) => requestAnimationFrame(() => r(null)))

    const t0 = performance.now()
    probe = { data, columns }
    // One rAF = first paint with the new grid mounted. That's
    // "time to first paint".
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const t1 = performance.now()

    matrix[rIdx]![cIdx]!.ms = Math.round((t1 - t0) * 10) / 10
    running = null
    busy = false
  }

  async function runAll() {
    if (busy) return
    busy = true
    for (let r = 0; r < ROW_SIZES.length; r += 1)
      for (let c = 0; c < COL_SIZES.length; c += 1)
        await runOne(r, c)
    busy = false
  }

  function heatColor(ms: number | null): string {
    if (ms === null) return 'transparent'
    if (ms < 16)   return 'rgba(34,197,94,0.45)'
    if (ms < 50)   return 'rgba(132,204,22,0.55)'
    if (ms < 100)  return 'rgba(245,158,11,0.55)'
    if (ms < 250)  return 'rgba(249,115,22,0.65)'
    return 'rgba(239,68,68,0.75)'
  }
</script>

<button onclick={runAll} disabled={busy}>{busy ? 'Running…' : 'Run all'}</button>

<table>
  <thead>
    <tr><th></th>
      {#each COL_SIZES as c (c)}<th>{c} cols</th>{/each}
    </tr>
  </thead>
  <tbody>
    {#each matrix as row, rIdx (rIdx)}
      <tr>
        <th>{ROW_SIZES[rIdx]?.toLocaleString()} rows</th>
        {#each row as cell, cIdx (cIdx)}
          <td style="background: {heatColor(cell.ms)}">
            <button onclick={() => !busy && runOne(rIdx, cIdx)} disabled={busy}>
              {cell.ms === null ? '-' : cell.ms < 10 ? cell.ms.toFixed(1) + ' ms' : Math.round(cell.ms) + ' ms'}
            </button>
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<!-- The off-screen probe. Mount target for measured timing brackets. -->
<div style="position: fixed; left: -9999px; top: -9999px; width: 800px; height: 400px; visibility: hidden;">
  {#if probe}
    <SvGrid
      data={probe.data}
      columns={probe.columns}
      features={features}
      showRowSelection={false}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={false}
      rowHeight={26}
      containerHeight="400px"
      fitColumns={false}
    />
  {/if}
</div>
```

## What the timing actually captures

- **`t0` is recorded JUST BEFORE** `probe = {...}` triggers a Svelte
  re-render. Data allocation happened before `t0`, on purpose.
- **`t1` is recorded AFTER one rAF.** The browser fires rAF callbacks
  right before the paint, so by the time `t1` runs, the new grid is
  mounted and its first frame is on screen.
- The number is **time to first paint with this dataset mounted**, NOT
  time to first interaction. Hovering and clicking happen on
  subsequent frames; those are virtually free if the grid virtualises.

The off-screen probe has `visibility: hidden` but real width / height
so the browser still computes layout - paint cost is real.

## Reading the matrix

Suggested thresholds for an internal "is this still good?" gauge:

| Size      | Healthy        | Server-side recommended above |
| --------- | -------------- | ----------------------------- |
| 100×5     | < 16 ms        | -                             |
| 1k×10     | < 50 ms        | -                             |
| 10k×20    | < 100 ms       | -                             |
| 50k×20    | < 250 ms       | dataset > 50k                 |
| 100k×50   | < 1 s          | absolutely yes                |

If a "healthy" cell jumps red between branches, you regressed
something - bisect with a smaller matrix.

## Run in CI

The same harness runs headless in Playwright. Mount the matrix page,
click "Run all", read the cells, fail the job if any cell exceeds the
threshold:

```ts
test('grid time-to-first-paint regression gate', async ({ page }) => {
  await page.goto('/dev/stress-matrix')
  await page.getByRole('button', { name: /Run all/ }).click()
  await page.waitForFunction(() => !document.querySelector('button[disabled]'))
  const cells = await page.locator('td button').allTextContents()
  // Smoke-check: every cell now has a number, none are placeholders.
  expect(cells.every((c) => /\d/.test(c))).toBe(true)
  // Project-specific gates here:
  //   expect(parseFloat(cells[0])).toBeLessThan(20)
  //   ...
})
```

## Demo

The runnable companion: [Demo 134 - Stress matrix (gallery)](https://svgrid.com/#/demos/134-stress-matrix) - this harness wrapped in a page, ready to click on your machine.

## See also

- [Profiling with a FPS HUD](./profiling-with-fps-hud.md) - the matching live tool
- [Bundle size reference](../reference/bundle-size.md) - the per-feature cost
- [Million rows recipe](./million-rows.md) - the engineering for very large grids
