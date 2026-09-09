<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 433. Box plot + error bars (distribution, not just the average)
   * ---------------------------------------------------------------
   * Every other chart in the gallery answers "how much". These two answer
   * "how spread out", which is the question an average hides.
   *
   * The grid holds one row per request. Two regions come out with almost the
   * same mean response time, so a bar chart puts them side by side; the box
   * plot shows one of them running three times as wide, and the outlier dots
   * are the requests that actually generate complaints.
   *
   * - `boxStats(sample)` reduces a raw sample to a five-number summary with
   *   the usual 1.5 IQR whisker rule. `rowsToBoxSpec(rows, ...)` does it per
   *   group, which is what the grid's own chart panel calls.
   * - `ChartSeries.boxes` carries the summaries; `values` keeps the MEDIANS,
   *   so the tooltip, the CSV export and the screen-reader table all work
   *   with no box-specific code.
   * - `ChartSeries.errors` is separate on purpose: error bars annotate a mark
   *   rather than being one, so the bar chart on the right stays a bar chart
   *   and just grows whiskers.
   *
   * Free, in @svgrid/grid.
   */
  import {
    SvGrid,
    SvChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    boxStats,
    rowsToBoxSpec,
    type GridColumns,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Sample = { id: number; region: string; tier: string; ms: number }

  /** 240 requests across four regions. Seeded, so it reads the same every load. */
  function samples(): Sample[] {
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    // Roughly normal, from the average of three uniforms.
    const bell = () => (rnd() + rnd() + rnd()) / 3
    const shape: Record<string, { mid: number; spread: number; tail: number }> = {
      'eu-west': { mid: 120, spread: 30, tail: 0.02 },
      'us-east': { mid: 140, spread: 34, tail: 0.03 },
      // Same average as us-east, three times the spread. That is the whole
      // point of the chart: the mean cannot tell these two apart.
      'ap-south': { mid: 140, spread: 105, tail: 0.10 },
      'sa-east': { mid: 190, spread: 42, tail: 0.05 },
    }
    const out: Sample[] = []
    let id = 1
    for (const region of Object.keys(shape)) {
      const s = shape[region]!
      for (let i = 0; i < 60; i += 1) {
        // Kept deliberately modest. A handful of 800ms spikes is realistic and
        // the chart draws them correctly, but they stretch the axis to 1000 and
        // squash every box into a smear - which shows off the outlier handling
        // by making the rest of the chart unreadable.
        const spike = rnd() < s.tail ? 150 + rnd() * 130 : 0
        out.push({
          id: id++,
          region,
          tier: i % 3 === 0 ? 'free' : 'paid',
          ms: Math.round(s.mid + (bell() - 0.5) * s.spread * 2 + spike),
        })
      }
    }
    return out
  }
  const rows = samples()

  const columns: GridColumns<Sample> = [
    { field: 'id', header: '#', width: 64, align: 'right' },
    { field: 'region', header: 'Region', width: 120 },
    { field: 'tier', header: 'Tier', width: 90 },
    { field: 'ms', header: 'Response', width: 110, align: 'right', cell: (c) => `${c.getValue()} ms` },
  ]

  let splitByTier = $state(false)

  /** The box plot. One call - this is exactly what the chart panel runs. */
  const spread = $derived<ChartSpec>({
    ...rowsToBoxSpec(rows, {
      category: 'region',
      value: 'ms',
      ...(splitByTier ? { series: 'tier' } : {}),
    }),
    yAxisTitle: 'Response (ms)',
    height: 236,
  })

  /**
   * The same data as a bar chart of the averages, with error bars at one
   * standard deviation. Side by side with the box plot, it shows what the
   * average leaves out: these bars are nearly level.
   */
  const averages = $derived.by<ChartSpec>(() => {
    const regions = [...new Set(rows.map((r) => r.region))]
    const stats = regions.map((region) => {
      const v = rows.filter((r) => r.region === region).map((r) => r.ms)
      const mean = v.reduce((a, b) => a + b, 0) / v.length
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
      return { mean: Math.round(mean), sd: Math.round(sd) }
    })
    return {
      type: 'bar',
      categories: regions,
      series: [
        {
          label: 'Mean',
          values: stats.map((s) => s.mean),
          // A number is a symmetric +/- margin; `{ lo, hi }` sets both ends.
          errors: stats.map((s) => s.sd),
        },
      ],
      yAxisTitle: 'Mean response (ms)',
      height: 236,
    }
  })

  /** Quartiles interpolate between observations, so they land on halves and
   *  quarters of a millisecond. Nobody reads latency to two decimal places. */
  const ms = (n: number) => `${Math.round(n)} ms`

  /** The worst region's summary, spelled out under the charts. */
  const worst = $derived.by(() => {
    const regions = [...new Set(rows.map((r) => r.region))]
    let pick = { region: '', iqr: -1, stats: null as ReturnType<typeof boxStats> }
    for (const region of regions) {
      const b = boxStats(rows.filter((r) => r.region === region).map((r) => r.ms))
      if (b && b.q3 - b.q1 > pick.iqr) pick = { region, iqr: b.q3 - b.q1, stats: b }
    }
    return pick
  })
</script>

<section class="wrap">
  <header class="chrome">
    <label class="chk"><input type="checkbox" bind:checked={splitByTier} /> Split by tier</label>
    <span class="note">
      Both charts read the same rows. <strong>us-east</strong> and <strong>ap-south</strong> have
      almost the same mean, so the bars put them side by side; only the boxes show that one of
      them is three times as spread out.
    </span>
  </header>

  <div class="body">
    <div class="grid-host">
      <SvGrid
        responsive={true}
        data={rows}
        {columns}
        {features}
        getRowId={(r) => String(r.id)}
        sortable
        filterable
        rowHeight={26}
        containerHeight="100%"
        fitColumns
      />
    </div>

    <div class="charts">
      <div class="pane">
        <h3>Distribution</h3>
        <SvChart spec={spread} legend={splitByTier} />
      </div>
      <div class="pane">
        <h3>Mean, +/- 1 standard deviation</h3>
        <SvChart spec={averages} legend={false} />
      </div>
    </div>
  </div>

  {#if worst.stats}
    <footer class="summary">
      <strong>{worst.region}</strong>: median {ms(worst.stats.median)}, quartiles
      {ms(worst.stats.q1)} to {ms(worst.stats.q3)}, whiskers {ms(worst.stats.min)} to
      {ms(worst.stats.max)}{#if worst.stats.outliers?.length}, plus {worst.stats.outliers.length}
        request{worst.stats.outliers.length === 1 ? '' : 's'} past the upper whisker (slowest
        {ms(Math.max(...worst.stats.outliers))}){/if}.
    </footer>
  {/if}
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 10px;
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex: none;
  }
  .note {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
  }
  .body {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 12px;
  }
  .grid-host {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .charts {
    flex: none;
    width: 560px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
  }
  .pane {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
  }
  .pane h3 {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-muted, #64748b);
  }
  .summary {
    flex: none;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    border-top: 1px solid var(--sg-border, #e2e8f0);
    padding-top: 8px;
  }
</style>
