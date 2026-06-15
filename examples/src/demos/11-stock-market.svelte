<script lang="ts">
  /**
   * 11. Stock market - live updates
   * -------------------------------
   * Simulates a fast-moving market feed. A 500 ms interval randomly walks
   * each symbol's last price, bid/ask, and cumulative volume. Cells flash
   * green on an up-tick, red on a down-tick.
   *
   * Implementation notes:
   *   - Rows are kept in `$state.raw` so the grid sees a single new array
   *     reference per tick instead of one mutation per cell.
   *   - A `pulses` map keyed by `${symbol}:${col}` is set when the cell
   *     changes. A 320 ms CSS animation reads `data-pulse="up|down"` on the
   *     cell DOM node and tints the background. The map is GC'd by the same
   *     tick that wrote the entry - old keys are dropped, not appended.
   *   - "Pause" stops the interval. Sort and selection still work paused.
   *
   * Replace `tick()` with your WebSocket onMessage handler; the rest of the
   * grid wiring stays the same.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'
  import { getStockBrand, readableMarkColor } from '../shared/stock-logos'

  type Stock = {
    symbol: string
    name: string
    sector: string
    last: number
    change: number
    pctChange: number
    bid: number
    ask: number
    volume: number
    open: number
    high: number
    low: number
    // Fundamentals - don't tick, but worth showing alongside the live quotes.
    week52High: number
    week52Low: number
    marketCapB: number   // billions USD
    peRatio: number
    eps: number
    divYield: number     // %
  }

  const features = tableFeatures({ rowSortingFeature })

  type SeedRow = {
    symbol: string
    name: string
    sector: string
    price: number
    /** 52w high as a multiplier on `price` */
    h52: number
    /** 52w low as a multiplier on `price` */
    l52: number
    /** Market cap in billions USD */
    capB: number
    pe: number
    eps: number
    /** Dividend yield % */
    yld: number
  }
  const SEED: SeedRow[] = [
    { symbol: 'AAPL', name: 'Apple Inc.',                sector: 'Technology',    price: 187.42, h52: 1.16, l52: 0.85, capB: 2870, pe: 31.4, eps: 5.96, yld: 0.51 },
    { symbol: 'MSFT', name: 'Microsoft Corp.',           sector: 'Technology',    price: 412.11, h52: 1.10, l52: 0.78, capB: 3060, pe: 36.1, eps: 11.42, yld: 0.72 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.',              sector: 'Technology',    price: 905.34, h52: 1.05, l52: 0.43, capB: 2230, pe: 73.8, eps: 12.27, yld: 0.02 },
    { symbol: 'GOOG', name: 'Alphabet Inc. Class C',     sector: 'Technology',    price: 158.20, h52: 1.12, l52: 0.74, capB: 1980, pe: 27.5, eps: 5.76, yld: 0.51 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.',           sector: 'Consumer',      price: 182.95, h52: 1.08, l52: 0.65, capB: 1900, pe: 60.2, eps: 3.04, yld: 0 },
    { symbol: 'META', name: 'Meta Platforms Inc.',       sector: 'Technology',    price: 492.85, h52: 1.07, l52: 0.50, capB: 1260, pe: 32.7, eps: 15.10, yld: 0.40 },
    { symbol: 'TSLA', name: 'Tesla Inc.',                sector: 'Automotive',    price: 174.30, h52: 1.65, l52: 0.78, capB: 555,  pe: 47.6, eps: 3.66, yld: 0 },
    { symbol: 'BRK.B',name: 'Berkshire Hathaway B',      sector: 'Financials',    price: 405.66, h52: 1.07, l52: 0.85, capB: 880,  pe: 9.4,  eps: 43.21, yld: 0 },
    { symbol: 'JPM',  name: 'JPMorgan Chase & Co.',      sector: 'Financials',    price: 201.14, h52: 1.04, l52: 0.71, capB: 580,  pe: 11.7, eps: 17.20, yld: 2.27 },
    { symbol: 'V',    name: 'Visa Inc.',                 sector: 'Financials',    price: 273.40, h52: 1.05, l52: 0.85, capB: 555,  pe: 30.4, eps: 8.99, yld: 0.76 },
    { symbol: 'UNH',  name: 'UnitedHealth Group Inc.',   sector: 'Healthcare',    price: 522.78, h52: 1.10, l52: 0.83, capB: 484,  pe: 21.3, eps: 24.58, yld: 1.61 },
    { symbol: 'XOM',  name: 'Exxon Mobil Corp.',         sector: 'Energy',        price: 113.05, h52: 1.10, l52: 0.84, capB: 450,  pe: 13.8, eps: 8.19, yld: 3.36 },
    { symbol: 'JNJ',  name: 'Johnson & Johnson',         sector: 'Healthcare',    price: 152.66, h52: 1.12, l52: 0.92, capB: 367,  pe: 27.2, eps: 5.61, yld: 3.21 },
    { symbol: 'WMT',  name: 'Walmart Inc.',              sector: 'Consumer',      price: 68.50,  h52: 1.07, l52: 0.78, capB: 552,  pe: 30.2, eps: 2.27, yld: 1.21 },
    { symbol: 'PG',   name: 'Procter & Gamble Co.',      sector: 'Consumer',      price: 165.20, h52: 1.05, l52: 0.85, capB: 391,  pe: 27.3, eps: 6.05, yld: 2.33 },
    { symbol: 'HD',   name: 'Home Depot Inc.',           sector: 'Consumer',      price: 348.10, h52: 1.10, l52: 0.78, capB: 346,  pe: 23.5, eps: 14.81, yld: 2.59 },
    { symbol: 'BAC',  name: 'Bank of America Corp.',     sector: 'Financials',    price: 39.95,  h52: 1.10, l52: 0.62, capB: 318,  pe: 12.8, eps: 3.12, yld: 2.40 },
    { symbol: 'ADBE', name: 'Adobe Inc.',                sector: 'Technology',    price: 472.30, h52: 1.45, l52: 0.86, capB: 213,  pe: 41.6, eps: 11.35, yld: 0 },
    { symbol: 'NFLX', name: 'Netflix Inc.',              sector: 'Communication', price: 612.45, h52: 1.10, l52: 0.55, capB: 265,  pe: 47.0, eps: 13.03, yld: 0 },
    { symbol: 'CRM',  name: 'Salesforce Inc.',           sector: 'Technology',    price: 263.10, h52: 1.30, l52: 0.74, capB: 255,  pe: 45.2, eps: 5.82, yld: 0.61 },
    { symbol: 'CVX',  name: 'Chevron Corp.',             sector: 'Energy',        price: 151.20, h52: 1.15, l52: 0.92, capB: 281,  pe: 14.0, eps: 10.81, yld: 4.32 },
    { symbol: 'KO',   name: 'Coca-Cola Co.',             sector: 'Consumer',      price: 62.80,  h52: 1.07, l52: 0.84, capB: 271,  pe: 25.0, eps: 2.51, yld: 3.10 },
    { symbol: 'PEP',  name: 'PepsiCo Inc.',              sector: 'Consumer',      price: 170.40, h52: 1.11, l52: 0.92, capB: 234,  pe: 25.7, eps: 6.63, yld: 3.18 },
    { symbol: 'COST', name: 'Costco Wholesale Corp.',    sector: 'Consumer',      price: 828.55, h52: 1.08, l52: 0.61, capB: 367,  pe: 51.8, eps: 16.00, yld: 0.55 },
    { symbol: 'AVGO', name: 'Broadcom Inc.',             sector: 'Technology',    price: 1389.20,h52: 1.05, l52: 0.55, capB: 644,  pe: 53.4, eps: 26.00, yld: 1.51 },
  ]

  function initialRows(): Stock[] {
    return SEED.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      last: s.price,
      change: 0,
      pctChange: 0,
      bid: round(s.price - 0.05, 2),
      ask: round(s.price + 0.05, 2),
      volume: Math.floor(50_000 + Math.random() * 950_000),
      open: s.price,
      high: s.price,
      low: s.price,
      week52High: round(s.price * s.h52, 2),
      week52Low:  round(s.price * s.l52, 2),
      marketCapB: s.capB,
      peRatio: s.pe,
      eps: s.eps,
      divYield: s.yld,
    }))
  }

  function round(n: number, places: number): number {
    const p = 10 ** places
    return Math.round(n * p) / p
  }

  let rows = $state.raw<Stock[]>(initialRows())
  let pulses = $state.raw<Record<string, 'up' | 'down'>>({})
  let paused = $state(false)
  let tickIntervalMs = $state(500)
  let ticks = $state(0)

  // The columns that should flash on change. Avoids re-pulsing static columns
  // like Symbol or Name.
  const PULSED_COLS = ['last', 'change', 'pctChange', 'bid', 'ask', 'volume', 'high', 'low']

  function tick() {
    const nextPulses: Record<string, 'up' | 'down'> = {}
    const nextRows = rows.map((row) => {
      // ~70% of symbols move per tick - keeps the list lively without flooding.
      if (Math.random() < 0.3) return row
      const drift = (Math.random() - 0.5) * row.last * 0.004 // up to ±0.2%
      const newLast = Math.max(round(row.last + drift, 2), 0.01)
      if (newLast === row.last) return row
      const direction: 'up' | 'down' = newLast > row.last ? 'up' : 'down'
      const change = round(newLast - row.open, 2)
      const pctChange = round((change / row.open) * 100, 2)
      const spread = Math.max(round(row.last * 0.0005, 2), 0.01)
      const next: Stock = {
        ...row,
        last: newLast,
        change,
        pctChange,
        bid: round(newLast - spread, 2),
        ask: round(newLast + spread, 2),
        volume: row.volume + Math.floor(100 + Math.random() * 5_000),
        high: Math.max(row.high, newLast),
        low: Math.min(row.low, newLast),
      }
      for (const col of PULSED_COLS) nextPulses[`${row.symbol}:${col}`] = direction
      return next
    })
    rows = nextRows
    pulses = nextPulses
    ticks += 1
  }

  $effect(() => {
    if (paused) return
    const id = setInterval(tick, tickIntervalMs)
    return () => clearInterval(id)
  })

  function pulseClass(row: Stock, colId: string): 'sv-pulse-up' | 'sv-pulse-down' | '' {
    const dir = pulses[`${row.symbol}:${colId}`]
    return dir === 'up' ? 'sv-pulse-up' : dir === 'down' ? 'sv-pulse-down' : ''
  }
</script>

{#snippet PulsedNumber(props: { row: Stock; colId: string; value: string; align?: 'right' })}
  <span class={`sv-tick ${pulseClass(props.row, props.colId)}`}>{props.value}</span>
{/snippet}

{#snippet SymbolCell(props: { row: Stock })}
  {@const brand = getStockBrand(props.row.symbol)}
  <span class="sv-symbol">
    <span
      class="sv-logo"
      style:background={brand.bg}
      style:color={brand.fg ?? '#fff'}
      aria-hidden="true"
    >
      {#if brand.svg}
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d={brand.svg} />
        </svg>
      {:else}
        <span class="sv-logo-mark" style:color={readableMarkColor(brand.bg)}>{brand.mark}</span>
      {/if}
    </span>
    <span class="sv-symbol-text">{props.row.symbol}</span>
  </span>
{/snippet}

{#snippet ChangeCell(props: { row: Stock })}
  {@const positive = props.row.change >= 0}
  <span class={`sv-tick ${pulseClass(props.row, 'change')} ${positive ? 'sv-change-up' : 'sv-change-down'}`}>
    <svg class="sv-arrow" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      {#if positive}
        <path d="M6 2 L11 9 L1 9 Z" fill="currentColor" />
      {:else}
        <path d="M6 10 L1 3 L11 3 Z" fill="currentColor" />
      {/if}
    </svg>
    {Math.abs(props.row.change).toFixed(2)}
  </span>
{/snippet}

{#snippet PctChangeCell(props: { row: Stock })}
  {@const positive = props.row.pctChange >= 0}
  <span class={`sv-tick ${pulseClass(props.row, 'pctChange')} ${positive ? 'sv-change-up' : 'sv-change-down'}`}>
    {positive ? '+' : ''}{props.row.pctChange.toFixed(2)}%
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <button
      type="button"
      onclick={() => (paused = !paused)}
      class="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {paused ? '▶ Resume' : '⏸ Pause'}
    </button>
    <label class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
      Tick interval:
      <select
        bind:value={tickIntervalMs}
        class="rounded border border-slate-300 dark:border-slate-600 px-2 py-1"
      >
        <option value={100}>100 ms (firehose)</option>
        <option value={250}>250 ms (live)</option>
        <option value={500}>500 ms (smooth)</option>
        <option value={1000}>1 s (calm)</option>
      </select>
    </label>
    <span class="ml-auto text-slate-500 dark:text-slate-400 tabular-nums">
      {ticks.toLocaleString()} ticks · {rows.length} symbols
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={[
        {
          field: 'symbol', header: 'Symbol', width: 130,
          cell: (ctx) => renderSnippet(SymbolCell, { row: ctx.row.original }),
        },
        { field: 'name',   header: 'Name',   width: 220 },
        { field: 'sector', header: 'Sector', width: 130 },
        {
          field: 'last', header: 'Last', editorType: 'number', width: 110,
          format: { type: 'currency', currency: 'USD' },
          cell: (ctx) => renderSnippet(PulsedNumber, {
            row: ctx.row.original,
            colId: 'last',
            value: `$${ctx.row.original.last.toFixed(2)}`,
          }),
        },
        {
          field: 'change', header: 'Chg', editorType: 'number', width: 90,
          cell: (ctx) => renderSnippet(ChangeCell, { row: ctx.row.original }),
        },
        {
          field: 'pctChange', header: 'Chg %', editorType: 'number', width: 95,
          cell: (ctx) => renderSnippet(PctChangeCell, { row: ctx.row.original }),
        },
        {
          field: 'bid', header: 'Bid', editorType: 'number', width: 90,
          cell: (ctx) => renderSnippet(PulsedNumber, {
            row: ctx.row.original,
            colId: 'bid',
            value: ctx.row.original.bid.toFixed(2),
          }),
        },
        {
          field: 'ask', header: 'Ask', editorType: 'number', width: 90,
          cell: (ctx) => renderSnippet(PulsedNumber, {
            row: ctx.row.original,
            colId: 'ask',
            value: ctx.row.original.ask.toFixed(2),
          }),
        },
        {
          field: 'volume', header: 'Volume', editorType: 'number', width: 125,
          cell: (ctx) => renderSnippet(PulsedNumber, {
            row: ctx.row.original,
            colId: 'volume',
            value: ctx.row.original.volume.toLocaleString(),
          }),
        },
        {
          field: 'open', header: 'Open', editorType: 'number', width: 90,
          format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } },
        },
        {
          field: 'high', header: 'High', editorType: 'number', width: 90,
          cell: (ctx) => renderSnippet(PulsedNumber, {
            row: ctx.row.original,
            colId: 'high',
            value: ctx.row.original.high.toFixed(2),
          }),
        },
        {
          field: 'low', header: 'Low', editorType: 'number', width: 90,
          cell: (ctx) => renderSnippet(PulsedNumber, {
            row: ctx.row.original,
            colId: 'low',
            value: ctx.row.original.low.toFixed(2),
          }),
        },
        {
          field: 'week52High', header: '52w High', editorType: 'number', width: 110,
          format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } },
        },
        {
          field: 'week52Low', header: '52w Low', editorType: 'number', width: 110,
          format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } },
        },
        {
          field: 'marketCapB', header: 'Mkt Cap', editorType: 'number', width: 120,
          cell: (ctx) => {
            const v = ctx.row.original.marketCapB
            const display = v >= 1000 ? `${(v / 1000).toFixed(2)} T` : `${v.toFixed(0)} B`
            return display
          },
        },
        {
          field: 'peRatio', header: 'P/E', editorType: 'number', width: 80,
          format: { type: 'number', options: { minimumFractionDigits: 1, maximumFractionDigits: 1 } },
        },
        {
          field: 'eps', header: 'EPS', editorType: 'number', width: 90,
          format: { type: 'currency', currency: 'USD', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } },
        },
        {
          field: 'divYield', header: 'Div Yield', editorType: 'number', width: 100,
          cell: (ctx) => `${ctx.row.original.divYield.toFixed(2)}%`,
        },
      ] satisfies ColumnDef<typeof features, Stock>[]}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
    />
  </div>
</section>

<style>
  /* Flash on cell change. The animation lives 320 ms; subsequent ticks
   * either re-trigger it (same direction) or replace it with the opposite
   * tint. Background-only - leaves the cell's text color untouched. */
  :global(.sv-tick) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 2px;
    border-radius: 3px;
    font-variant-numeric: tabular-nums;
  }
  :global(.sv-arrow) {
    flex-shrink: 0;
  }
  :global(.sv-symbol) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 100%;
  }
  :global(.sv-logo) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    flex-shrink: 0;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  }
  :global(.sv-logo svg) {
    display: block;
  }
  :global(.sv-logo-mark) {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  :global(.sv-symbol-text) {
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  :global(.sv-pulse-up) {
    animation: sv-pulse-up 320ms ease-out;
  }
  :global(.sv-pulse-down) {
    animation: sv-pulse-down 320ms ease-out;
  }
  :global(.sv-change-up) {
    color: #16a34a;
    font-weight: 600;
  }
  :global(.sv-change-down) {
    color: #dc2626;
    font-weight: 600;
  }
  :global(:where([data-theme='dark']) .sv-change-up) {
    color: #4ade80;
  }
  :global(:where([data-theme='dark']) .sv-change-down) {
    color: #f87171;
  }
  @keyframes sv-pulse-up {
    0%   { background: rgba(34, 197, 94, 0.55); }
    100% { background: transparent; }
  }
  @keyframes sv-pulse-down {
    0%   { background: rgba(239, 68, 68, 0.55); }
    100% { background: transparent; }
  }
</style>
