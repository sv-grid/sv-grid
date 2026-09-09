<script lang="ts">
  /**
   * 432. Candlestick / OHLC with an ordinal date axis
   * -------------------------------------------------
   * A price chart needs two things a line chart does not.
   *
   * 1. Four numbers per point. `ChartSeries.ohlc` carries them, while
   *    `values` keeps the CLOSES - which is what lets everything generic
   *    keep working: the tooltip, the CSV export, the screen-reader table
   *    and `overlay: 'sma:10'` for the moving average all read `values`.
   *
   * 2. An axis that skips the days the market was shut. `xType: 'time'`
   *    spaces points by real elapsed time, so every weekend opens a hole
   *    three trading days wide. `xType: 'ordinal-time'` spaces sessions
   *    evenly and still labels them by date. Toggle it below.
   *
   * The strip under the plot is the chart's own `brush`: drag the window to
   * pan, drag an edge to resize. Volume stays in the grid rather than in a
   * second chart there, for two reasons. A short strip under a plot reads as
   * a range selector whatever you draw in it, and two charts cannot share a
   * zoom, so the volume fell out of register the moment you zoomed the price.
   *
   * Free, in @svgrid/grid.
   */
  import {
    SvGrid,
    SvChart,
    tableFeatures,
    rowSortingFeature,
    type GridColumns,
    type ChartSpec,
    type OhlcBar,
  } from '@svgrid/grid'

  type Session = { date: string; o: number; h: number; l: number; c: number; volume: number }

  /** 45 trading sessions, weekends skipped. Seeded, so it reads the same every load. */
  function sessions(): Session[] {
    const out: Session[] = []
    const d = new Date(Date.UTC(2026, 0, 5)) // a Monday
    let price = 182
    let seed = 7
    const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5)
    while (out.length < 45) {
      const day = d.getUTCDay()
      if (day !== 0 && day !== 6) {
        const o = price
        const c = Math.max(20, o + next() * 5)
        out.push({
          date: d.toISOString().slice(0, 10),
          o: +o.toFixed(2),
          h: +(Math.max(o, c) + Math.abs(next()) * 2.2).toFixed(2),
          l: +(Math.min(o, c) - Math.abs(next()) * 2.2).toFixed(2),
          c: +c.toFixed(2),
          volume: Math.round(400 + Math.abs(c - o) * 220 + Math.abs(next()) * 300),
        })
        price = c
      }
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return out
  }

  const rows = sessions()
  const features = tableFeatures({ rowSortingFeature })

  // Three columns, not six: the grid sits beside a 640px chart pane, and a
  // a wide table there is just truncated headers.
  const columns: GridColumns<Session> = [
    { field: 'date', header: 'Session', width: 96 },
    { field: 'c', header: 'Close', width: 78, align: 'right' },
    { field: 'volume', header: 'Vol', width: 68, align: 'right' },
  ]

  let mark = $state<'candlestick' | 'ohlc'>('candlestick')
  let axis = $state<'ordinal-time' | 'time'>('ordinal-time')
  let showMa = $state(true)

  const ohlc: OhlcBar[] = rows.map((r) => ({ o: r.o, h: r.h, l: r.l, c: r.c }))
  const dates = rows.map((r) => r.date)

  const price = $derived<ChartSpec>({
    type: mark,
    categories: dates,
    xType: axis,
    height: 188,
    series: [
      {
        label: 'ACME',
        values: rows.map((r) => r.c),
        ohlc,
        ...(showMa ? { overlay: 'sma:10' as const, overlayColor: '#8b5cf6' } : {}),
      },
    ],
  })


  /** Brush strip height, and the pane box the chart is sized to fill. */
  const BRUSH = 74
  let paneW = $state(0)
  let paneH = $state(0)
</script>

<section class="wrap">
  <header class="chrome">
    <div class="seg" role="group" aria-label="Mark">
      <button class:on={mark === 'candlestick'} onclick={() => (mark = 'candlestick')}>Candles</button>
      <button class:on={mark === 'ohlc'} onclick={() => (mark = 'ohlc')}>OHLC</button>
    </div>
    <div class="seg" role="group" aria-label="Date axis">
      <button class:on={axis === 'ordinal-time'} onclick={() => (axis = 'ordinal-time')}>Sessions</button>
      <button class:on={axis === 'time'} onclick={() => (axis = 'time')}>Real time</button>
    </div>
    <label class="chk"><input type="checkbox" bind:checked={showMa} /> 10-day average</label>
    <span class="note">
      Switch to <strong>Real time</strong> and every weekend opens a gap. Drag to zoom.
    </span>
  </header>

  <div class="body">
    <div class="grid-host">
      <SvGrid
        responsive={true}
        data={rows}
        {columns}
        {features}
        getRowId={(r) => r.date}
        sortable
        rowHeight={26}
        containerHeight="100%"
        fitColumns
      />
    </div>

    <div class="pane">
      <!-- Measured box, not the card: its height comes from the parent, so the
           chart cannot push the thing it is sized against. -->
      <div class="pane-fill" bind:clientWidth={paneW} bind:clientHeight={paneH}>
        {#if paneW > 40 && paneH > 140}
          <!-- The strip underneath is the chart's own brush: drag its window to
               pan, drag an edge to resize, and the plot above follows. An earlier
               draft put a separate volume chart there, which read as a range
               selector, did not act like one, and fell out of register with the
               plot the moment you zoomed. Volume lives in the grid instead.

               The brush sits BELOW the plot and is not part of `height`, so its
               strip has to come out of the budget or the pair overflows the
               card. Measured at 83px for a 74px brush, so 9px of chrome. -->
          <SvChart
            spec={price}
            legend={false}
            zoomable
            brush
            brushHeight={BRUSH}
            width={paneW}
            height={paneH - BRUSH - 9}
          />
        {/if}
      </div>
    </div>
  </div>
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
    gap: 10px;
    flex-wrap: wrap;
    flex: none;
  }
  .note {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    font: inherit;
    font-size: 12px;
    padding: 4px 11px;
    border: 0;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .seg button + button {
    border-left: 1px solid var(--sg-border, #e2e8f0);
  }
  .seg button.on {
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
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
  .pane-fill {
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .pane {
    /* 600px is a preference, not a floor: `flex: none` pushed the card off the
       right of the window on a laptop, and the page does not scroll sideways,
       so the part that fell outside was unreachable. */
    flex: 0 1 600px;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
  }
</style>
