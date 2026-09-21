<!-- Documented in: docs/help/real-time.md -->
<script lang="ts">
  /**
   * 495. Market blotter - 100,000 instruments on a WebSocket feed
   * -------------------------------------------------------------
   * A trading blotter at the row count a desk actually has, sorted by the
   * column that moves (% change), with the feed pushing tens of thousands
   * of price updates a second. The grid stays sorted while it ticks.
   *
   * How the feed reaches the grid:
   *   - Ticks arrive over a WebSocket as JSON batches. In the gallery a mock
   *     socket runs in the page; add `?ws=ws://localhost:8787` to the URL to
   *     point it at `node tools/tick-server.mjs` (the same message format)
   *     or at your own feed.
   *   - Nothing touches grid state from the socket handler. Ticks land in a
   *     Map keyed by instrument id, so a symbol that ticks five times in one
   *     frame is one update, and one animation frame later the whole batch
   *     goes through `api.applyTransaction({ update })` as a single data
   *     change. One pipeline run per frame, whatever the message rate.
   *   - The rows are `$state.raw`: the grid sees a new array reference per
   *     frame, reuses the 99,000 row objects that did not change, and repairs
   *     the sort around the ones that did instead of re-sorting 100k rows.
   *   - `cellFlash` on Last with a direction class from `cellClass`: the grid
   *     restarts the animation only when that row's value changed, so a row
   *     scrolling into a recycled cell never flashes.
   *
   * The frame-time readout is the same measurement the benchmarks page uses
   * for scroll: p95 of the gaps between animation frames over the last three
   * seconds. Lower is better; 16.7 ms is one frame at 60 Hz.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'
  import { createPrng } from '../shared/mock-api'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- Instruments ---------------------------------------------------------
  type Instrument = {
    id: number
    symbol: string
    name: string
    sector: string
    last: number
    open: number
    change: number
    pct: number
    bid: number
    ask: number
    volume: number
    direction: 'up' | 'down' | null
    /** Rolling last prices for the sparkline; replaced, never mutated. */
    trail: number[]
  }

  const ROW_COUNT = 100_000
  const TRAIL = 12
  const SECTORS = ['Technology', 'Financials', 'Healthcare', 'Energy', 'Consumer', 'Industrials', 'Materials', 'Utilities', 'Communication', 'Real Estate']
  const WORDS_A = ['Nordic', 'Pacific', 'Atlas', 'Vertex', 'Quantum', 'Helios', 'Stellar', 'Apex', 'Crescent', 'Sigma', 'Pioneer', 'Aurora', 'Granite', 'Cobalt', 'Meridian', 'Polaris', 'Sentinel', 'Vantage', 'Cascade', 'Frontier', 'Lumen', 'Beacon', 'Orion', 'Summit', 'Redwood', 'Keystone', 'Everest', 'Kestrel', 'Nimbus', 'Onyx', 'Trident', 'Wexford']
  const WORDS_B = ['Bio', 'Energy', 'Materials', 'Logistics', 'Dynamics', 'Robotics', 'Analytics', 'Semiconductor', 'Pharma', 'Mining', 'Aerospace', 'Digital', 'Capital', 'Metals', 'Renewables', 'Health', 'Foods', 'Grid', 'Cloud', 'Data', 'Motors', 'Chemical', 'Software', 'Devices', 'Freight', 'Payments', 'Media', 'Security', 'Optics', 'Marine', 'Networks', 'Systems']
  const WORDS_C = ['Holdings', 'Group', 'Partners', 'Corp', 'Inc', 'Industries', 'Technologies', 'Labs', 'Ventures', 'Trust', 'Global', 'Enterprises', 'Solutions', 'Company', 'International', 'Resources']

  const round2 = (n: number) => Math.round(n * 100) / 100

  /** A unique 4- or 5-letter ticker from the row index: base-26, no collisions. */
  function tickerOf(i: number): string {
    let n = i
    let s = ''
    do {
      s = String.fromCharCode(65 + (n % 26)) + s
      n = Math.floor(n / 26)
    } while (n > 0)
    return s.padStart(4, 'A')
  }

  function seed(): Instrument[] {
    const rng = createPrng(0x100c)
    const out = new Array<Instrument>(ROW_COUNT)
    for (let i = 0; i < ROW_COUNT; i++) {
      const open = round2(5 + rng.next() * 495)
      const last = round2(open * (0.97 + rng.next() * 0.06))
      const spread = Math.max(round2(last * 0.0005), 0.01)
      const trail = new Array<number>(TRAIL)
      for (let t = 0; t < TRAIL; t++) trail[t] = round2(open * (0.985 + rng.next() * 0.03))
      trail[TRAIL - 1] = last
      out[i] = {
        id: i + 1,
        symbol: tickerOf(i),
        name: `${WORDS_A[(rng.next() * WORDS_A.length) | 0]} ${WORDS_B[(rng.next() * WORDS_B.length) | 0]} ${WORDS_C[(rng.next() * WORDS_C.length) | 0]}`,
        sector: SECTORS[(rng.next() * SECTORS.length) | 0]!,
        last,
        open,
        change: round2(last - open),
        pct: round2(((last - open) / open) * 100),
        bid: round2(last - spread),
        ask: round2(last + spread),
        volume: Math.floor(10_000 + rng.next() * 5_000_000),
        direction: null,
        trail,
      }
    }
    return out
  }

  // $state.raw on purpose: the feed replaces the array through
  // applyTransaction, it never mutates a row, so there is nothing for a deep
  // proxy over 100,000 rows to track and no reason to pay for one.
  let rows = $state.raw<Instrument[]>(seed())
  let api = $state<SvGridApi<typeof features, Instrument> | null>(null)

  // ---- The feed ------------------------------------------------------------
  /** One message: a batch of [id, last] pairs, the shape tools/tick-server.mjs sends. */
  type TickMessage = { t: Array<[id: number, last: number]> }

  type Rate = '1k' | '10k' | '50k'
  const RATES: Record<Rate, number> = { '1k': 1_000, '10k': 10_000, '50k': 50_000 }
  let rate = $state<Rate>('10k')
  let running = $state(true)

  /**
   * The in-page stand-in for a socket server: the same `onmessage` surface
   * and the same JSON, emitted every 16 ms in batches sized to the rate.
   * Prices random-walk so the sort has real work to do.
   */
  function mockSocket(onmessage: (data: string) => void) {
    const rng = createPrng(0xfeed)
    let timer: ReturnType<typeof setInterval> | null = null
    let lastAt = performance.now()
    const tick = () => {
      const now = performance.now()
      const due = Math.round((RATES[rate] * (now - lastAt)) / 1000)
      lastAt = now
      if (!running || due <= 0) return
      const t: Array<[number, number]> = new Array(due)
      for (let i = 0; i < due; i++) {
        const id = 1 + ((rng.next() * ROW_COUNT) | 0)
        const drift = 1 + (rng.next() - 0.5) * 0.004
        // The walk is relative to the last price the page knows, read from
        // the current rows so the mock behaves like a server tracking state.
        const row = current[id - 1]
        t[i] = [id, Math.max(round2((row?.last ?? 100) * drift), 0.01)]
      }
      onmessage(JSON.stringify({ t } satisfies TickMessage))
    }
    timer = setInterval(tick, 16)
    return { close: () => { if (timer) clearInterval(timer) } }
  }

  /** The rows as of the last flush, read by the mock to random-walk from. */
  let current: Instrument[] = rows

  // Ticks between frames. Keyed by id: a symbol that ticks five times in a
  // frame is one update with its latest price.
  const pending = new Map<number, number>()
  let frame: number | null = null
  let received = 0

  function onMessage(data: string) {
    const msg = JSON.parse(data) as TickMessage
    for (const [id, last] of msg.t) pending.set(id, last)
    received += msg.t.length
    if (frame === null) frame = requestAnimationFrame(flush)
  }

  let applied = $state(0)
  let appliedPerSecond = $state(0)
  let appliedWindow: Array<[at: number, n: number]> = []

  function flush() {
    frame = null
    if (!api || pending.size === 0) return
    const update: Instrument[] = []
    for (const [id, last] of pending) {
      const row = current[id - 1]
      if (!row) continue
      const spread = Math.max(round2(last * 0.0005), 0.01)
      const trail = row.trail.length >= TRAIL ? [...row.trail.slice(1), last] : [...row.trail, last]
      update.push({
        ...row,
        last,
        change: round2(last - row.open),
        pct: round2(((last - row.open) / row.open) * 100),
        bid: round2(last - spread),
        ask: round2(last + spread),
        volume: row.volume + 100,
        direction: last > row.last ? 'up' : last < row.last ? 'down' : row.direction,
        trail,
      })
    }
    pending.clear()
    // One transaction, one data change, one pipeline run.
    api.applyTransaction({ update })
    current = api.getData() as Instrument[]
    applied += update.length
    const now = performance.now()
    appliedWindow.push([now, update.length])
    while (appliedWindow.length && appliedWindow[0]![0] < now - 1000) appliedWindow.shift()
    appliedPerSecond = appliedWindow.reduce((a, [, n]) => a + n, 0)
  }

  // ---- Frame-time readout --------------------------------------------------
  let p95 = $state(0)
  let overBudget = $state(0)

  $effect(() => {
    const wsUrl = new URLSearchParams(location.search).get('ws')
    let socket: { close(): void }
    if (wsUrl) {
      const ws = new WebSocket(wsUrl)
      ws.onmessage = (e) => onMessage(String(e.data))
      socket = ws
    } else {
      socket = mockSocket(onMessage)
    }

    // Frame gaps over the last three seconds, p95 and the count over one
    // 60 Hz frame. Sampled from rAF, so it measures the page, not the feed.
    const gaps: Array<[at: number, gap: number]> = []
    let last = performance.now()
    let raf = 0
    let sinceReport = 0
    const sample = () => {
      const now = performance.now()
      gaps.push([now, now - last])
      last = now
      while (gaps.length && gaps[0]![0] < now - 3000) gaps.shift()
      if (++sinceReport >= 30) {
        sinceReport = 0
        const sorted = gaps.map((g) => g[1]).sort((a, b) => a - b)
        p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
        overBudget = sorted.filter((g) => g > 1000 / 60).length
      }
      raf = requestAnimationFrame(sample)
    }
    raf = requestAnimationFrame(sample)

    return () => {
      socket.close()
      cancelAnimationFrame(raf)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  })

  // ---- Columns -------------------------------------------------------------
  const money = { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } } as const
  const columns: GridColumns<Instrument> = [
    { field: 'symbol', header: 'Symbol', width: 96, editable: false },
    { field: 'name', header: 'Name', width: 240, editable: false, hideBelow: 700 },
    { field: 'sector', header: 'Sector', width: 130, editable: false, hideBelow: 900 },
    {
      field: 'last',
      header: 'Last',
      width: 110,
      editable: false,
      editorType: 'number',
      format: money,
      // The grid re-adds `tick` when this row's Last changes, restarting the
      // animation; the direction class picks the colour it fades from.
      cellFlash: { className: 'tick' },
      cellClass: (ctx) => (ctx.row.original.direction === 'up' ? 'tick-up' : ctx.row.original.direction === 'down' ? 'tick-down' : ''),
    },
    {
      field: 'pct',
      header: 'Chg %',
      width: 100,
      editable: false,
      editorType: 'number',
      format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' } },
      cellClass: (ctx) => (ctx.row.original.pct >= 0 ? 'profit' : 'loss'),
    },
    { field: 'change', header: 'Chg', width: 96, editable: false, editorType: 'number', format: money, hideBelow: 700, cellClass: (ctx) => (ctx.row.original.change >= 0 ? 'profit' : 'loss') },
    { field: 'trail', header: 'Trail', width: 120, editable: false, sortable: false, filterable: false, sparkline: { type: 'line', color: 'currentColor', lastPoint: true }, cellClass: (ctx) => (ctx.row.original.pct >= 0 ? 'profit' : 'loss'), hideBelow: 900 },
    { field: 'bid', header: 'Bid', width: 100, editable: false, editorType: 'number', format: money, hideBelow: 1100 },
    { field: 'ask', header: 'Ask', width: 100, editable: false, editorType: 'number', format: money, hideBelow: 1100 },
    { field: 'volume', header: 'Volume', width: 120, editable: false, editorType: 'number', format: { type: 'number', options: { maximumFractionDigits: 0 } } },
  ]

  const fmt = (n: number) => n.toLocaleString('en-US')
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="seg" role="group" aria-label="Feed rate, updates per second">
      {#each Object.keys(RATES) as r (r)}
        <button type="button" class:is-on={rate === r} aria-pressed={rate === r} onclick={() => (rate = r as Rate)}>{r}/s</button>
      {/each}
    </div>
    <div class="actions">
      <button type="button" class="btn" onclick={() => (running = !running)}>{running ? 'Pause feed' : 'Resume feed'}</button>
    </div>
    <span class="note">
      {fmt(ROW_COUNT)} instruments sorted by % change while the feed ticks. Ticks arrive over a socket in
      batches, wait in a map for the next animation frame, and go through one
      <code>applyTransaction</code> per frame; the grid repairs the sort around the rows that changed.
      Add <code>?ws=ws://localhost:8787</code> to the URL to read from <code>node tools/tick-server.mjs</code>.
    </span>
  </header>
  <div class="body">
    <div class="gridpane">
      <SvGrid
        data={rows}
        {columns}
        {features}
        getRowId={(r) => String(r.id)}
        initialSorting={[{ id: 'pct', desc: true }]}
        initialColumnPinning={{ left: ['symbol'] }}
        sortable
        filterable
        showColumnFilters={false}
        selectionMode="cell"
        columnResize
        rowHeight={30}
        containerHeight="100%"
        onApiReady={(a) => (api = a)}
      />
    </div>
  </div>
  <footer class="foot">
    <span class="stat"><span class="stat-label">Rows</span><strong data-testid="blotter-rows">{fmt(rows.length)}</strong></span>
    <span class="stat"><span class="stat-label">Updates applied / s</span><strong data-testid="blotter-rate">{fmt(appliedPerSecond)}</strong></span>
    <span class="stat"><span class="stat-label">Applied</span><strong>{fmt(applied)}</strong></span>
    <span class="stat" class:err={p95 > 1000 / 60}><span class="stat-label">Frame p95, last 3 s</span><strong data-testid="blotter-p95">{p95.toFixed(1)} ms</strong></span>
    <span class="stat"><span class="stat-label">Frames over 16.7 ms</span><strong>{overBudget}</strong></span>
    <span class="stat muted">Sorted by Chg % while ticking</span>
  </footer>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  :global(.profit) { color: var(--sg-success, #16a34a); }
  :global(.loss) { color: var(--sg-danger, #dc2626); }
  :global(.tick.tick-up) { animation: blotter-up 400ms ease-out; }
  :global(.tick.tick-down) { animation: blotter-down 400ms ease-out; }
  @keyframes blotter-up { from { background-color: color-mix(in oklab, var(--sg-success, #16a34a) 28%, transparent); } to { background-color: transparent; } }
  @keyframes blotter-down { from { background-color: color-mix(in oklab, var(--sg-danger, #dc2626) 28%, transparent); } to { background-color: transparent; } }
  @media (prefers-reduced-motion: reduce) {
    :global(.tick.tick-up), :global(.tick.tick-down) { animation: none; }
  }
</style>
