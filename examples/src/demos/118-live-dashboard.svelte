<script lang="ts">
  /**
   * 118. Live transactions dashboard - 10M rows, server-side
   * --------------------------------------------------------
   * A trading-desk style dashboard over a 10,000,000-row transaction
   * stream that lives "behind an API":
   *
   *   - PAGING is server-side. The grid only ever holds one page; the
   *     pager drives `mockEndpoint(query)`. Default (unsorted/unfiltered)
   *     pages are generated on demand from a deterministic PRNG, so any
   *     page of 10M is instant - nothing is materialised up front.
   *
   *   - SORTING + FILTERING round-trip to the mock endpoint (the grid runs
   *     in `externalSort` / `externalFilter` mode). They scan an indexed
   *     50k-row "shard" so the UI stays responsive; the headline 10M is the
   *     unfiltered total.
   *
   *   - LIVE UPDATES tick every second: a burst of fresh transactions feeds
   *     the KPI counters, the throughput chart, and the live "tail" at the
   *     top of page 1. New rows flash as they stream in.
   *
   *   - CHARTS (pure inline SVG, no dependency): a 60-second throughput area
   *     chart plus status + region distribution bars.
   *
   * Swap `mockEndpoint` for `fetch('/api/transactions?...')` and the wiring
   * is identical.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { createPrng } from '../shared/mock-api'

  // ---- Domain model ----------------------------------------------------

  type TxnType = 'transfer' | 'payment' | 'deposit' | 'withdrawal' | 'fee'
  type TxnStatus = 'settled' | 'pending' | 'failed' | 'reversed'
  type TxnChannel = 'api' | 'web' | 'mobile' | 'wire' | 'ach'
  type TxnRegion = 'NA' | 'EMEA' | 'APAC' | 'LATAM'

  type Transaction = {
    id: string
    timestamp: string
    accountId: string
    counterparty: string
    type: TxnType
    amount: number
    currency: 'USD' | 'EUR' | 'GBP'
    status: TxnStatus
    channel: TxnChannel
    region: TxnRegion
  }

  const TOTAL_START = 10_000_000
  /** Rows actually materialised for the filter/sort "index". Default paging
   *  generates on demand, so it spans the full 10M without this cost. */
  const SHARD_SIZE = 50_000
  const PAGE_SIZES = [25, 50, 100] as const
  const NETWORK_LATENCY = { min: 40, max: 120 }

  const TYPES: readonly TxnType[] = ['transfer', 'payment', 'deposit', 'withdrawal', 'fee']
  const STATUSES: readonly TxnStatus[] = ['settled', 'pending', 'failed', 'reversed']
  const CHANNELS: readonly TxnChannel[] = ['api', 'web', 'mobile', 'wire', 'ach']
  const REGIONS: readonly TxnRegion[] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const CURRENCIES: readonly Transaction['currency'][] = ['USD', 'EUR', 'GBP']

  const COUNTERPARTIES = [
    'Helios Holdings', 'Vertex Partners', 'Pacific Industries', 'Nordic Capital',
    'Atlas Trading', 'Quantum Logistics', 'Stellar Resources', 'Apex Networks',
    'Crescent Bio', 'Sigma Energy', 'Pioneer Materials', 'Aurora Labs',
    'Granite Mining', 'Cobalt Group', 'Meridian Trust', 'Polaris Systems',
    'Sentinel Dynamics', 'Tessera Capital', 'Vanguard Partners', 'Cascade Bio',
  ]

  // ---- Deterministic on-demand generator -------------------------------

  function genTxn(index: number, isoOverride?: string): Transaction {
    const prng = createPrng(0xa5f00d ^ (index * 2654435761))
    const dayOffset = Math.floor((index / TOTAL_START) * 365)
    const minuteOfDay = prng.int(0, 24 * 60 - 1)
    const date = new Date(Date.UTC(2026, 5, 10) - dayOffset * 86_400_000)
    date.setUTCMinutes(minuteOfDay)
    const iso = date.toISOString().slice(0, 19)
    const type = prng.pick(TYPES)
    const direction = type === 'deposit' ? 1 : type === 'withdrawal' || type === 'fee' ? -1 : prng.pick([-1, 1])
    const magnitude = Math.round(prng.next() * prng.next() * 250_000)
    const amount = direction * magnitude
    const roll = prng.next()
    const status: TxnStatus =
      roll < 0.86 ? 'settled' : roll < 0.94 ? 'pending' : roll < 0.99 ? 'failed' : 'reversed'
    return {
      id: `TXN-${(index + 100_000).toString(36).toUpperCase()}-${prng.int(0x100, 0xfff).toString(16).toUpperCase()}`,
      timestamp: isoOverride ?? iso,
      accountId: `ACC-${prng.int(10000, 99999)}`,
      counterparty: prng.pick(COUNTERPARTIES),
      type,
      amount,
      currency: prng.pick(CURRENCIES),
      status,
      channel: prng.pick(CHANNELS),
      region: prng.pick(REGIONS),
    }
  }

  // The scannable shard (materialised once) backs sort + filter.
  const SHARD: Transaction[] = (() => {
    const out = new Array<Transaction>(SHARD_SIZE)
    for (let i = 0; i < SHARD_SIZE; i += 1) out[i] = genTxn(i)
    return out
  })()

  // ---- Query model -----------------------------------------------------

  type SortClause = { id: string; desc: boolean }
  type GridFilter = { id: string; operator: string; value: string; selectedValues?: string[] }
  type ServerQuery = {
    search: string
    region: TxnRegion | ''
    statuses: TxnStatus[]
    sort: SortClause[]
    columnFilters: GridFilter[]
    page: number
    pageSize: number
  }
  type ServerResult = { rows: Transaction[]; total: number }

  function mockEndpoint(q: ServerQuery, liveTotalNow: number): ServerResult {
    const search = q.search.trim().toLowerCase()
    const statusSet = new Set(q.statuses)
    const colFilters = q.columnFilters.filter(
      (f) => f.operator === 'isBlank' || (f.value ?? '').length > 0 || (f.selectedValues && f.selectedValues.length),
    )
    const hasFilter = search !== '' || q.region !== '' || statusSet.size > 0 || colFilters.length > 0
    const hasSort = q.sort.length > 0

    // FAST PATH: page straight out of the 10M space, generating on demand.
    if (!hasFilter && !hasSort) {
      const start = q.page * q.pageSize
      const end = Math.min(start + q.pageSize, liveTotalNow)
      const rows: Transaction[] = []
      for (let i = start; i < end; i += 1) rows.push(i < SHARD_SIZE ? SHARD[i]! : genTxn(i))
      return { rows, total: liveTotalNow }
    }

    // FILTER / SORT PATH: scan the indexed shard.
    const passes = (t: Transaction): boolean => {
      if (search) {
        const hay = `${t.id} ${t.accountId} ${t.counterparty}`.toLowerCase()
        if (!hay.includes(search)) return false
      }
      if (q.region && t.region !== q.region) return false
      if (statusSet.size && !statusSet.has(t.status)) return false
      for (const f of colFilters) {
        const raw = (t as unknown as Record<string, unknown>)[f.id]
        if (f.selectedValues && f.selectedValues.length && !f.selectedValues.includes(String(raw ?? ''))) return false
        const v = (f.value ?? '').toLowerCase()
        if (v) {
          const text = String(raw ?? '').toLowerCase()
          switch (f.operator) {
            case 'contains': if (!text.includes(v)) return false; break
            case 'equals': if (text !== v) return false; break
            case 'startsWith': if (!text.startsWith(v)) return false; break
            case 'greaterThan': if (Number(raw) <= Number(f.value)) return false; break
            case 'lessThan': if (Number(raw) >= Number(f.value)) return false; break
          }
        }
      }
      return true
    }

    const matched = hasFilter ? SHARD.filter(passes) : SHARD.slice()
    if (hasSort) {
      matched.sort((a, b) => {
        for (const c of q.sort) {
          const av = (a as unknown as Record<string, unknown>)[c.id]
          const bv = (b as unknown as Record<string, unknown>)[c.id]
          let r: number
          if (typeof av === 'number' && typeof bv === 'number') r = av - bv
          else { const as = String(av ?? ''), bs = String(bv ?? ''); r = as < bs ? -1 : as > bs ? 1 : 0 }
          if (r !== 0) return c.desc ? -r : r
        }
        return 0
      })
    }
    const start = q.page * q.pageSize
    return { rows: matched.slice(start, start + q.pageSize), total: matched.length }
  }

  // ---- State -----------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let search = $state('')
  let region = $state<TxnRegion | ''>('')
  let statusFilter = $state<TxnStatus[]>([])
  let sortClauses = $state<SortClause[]>([])
  let columnFilters = $state<GridFilter[]>([])
  let page = $state(0)
  let pageSize = $state(50)

  let pageRows = $state.raw<Transaction[]>([])
  let total = $state(TOTAL_START)
  let loading = $state(false)

  let gridApi: SvGridApi<typeof features, Transaction> | null = $state(null)

  // Network/latency stats
  let requests = $state(0)
  let lastLatency = $state(0)
  let avgLatency = $state(0)
  let latencySum = 0

  // Live stream
  let liveTotal = $state(TOTAL_START)
  let liveEnabled = $state(true)
  let tps = $state(0)

  // Seed distributions + chart from a sample so nothing starts empty.
  const SEED = (() => {
    const sc: Record<TxnStatus, number> = { settled: 0, pending: 0, failed: 0, reversed: 0 }
    const rc: Record<TxnRegion, number> = { NA: 0, EMEA: 0, APAC: 0, LATAM: 0 }
    for (let i = 0; i < 4000; i += 1) { const t = SHARD[i]!; sc[t.status] += 1; rc[t.region] += 1 }
    const ser = Array.from({ length: 44 }, () => 10 + Math.floor(Math.random() * 42))
    return { sc, rc, ser, vol: ser.map((c) => c * 1400) }
  })()

  let series = $state<number[]>(SEED.ser)     // throughput per second (last 60)
  let volSeries = $state<number[]>(SEED.vol)  // volume per second (last 60)
  let statusCounts = $state<Record<TxnStatus, number>>(SEED.sc)
  let regionCounts = $state<Record<TxnRegion, number>>(SEED.rc)
  let liveTail = $state.raw<Transaction[]>([])
  let flashIds = $state.raw<Set<string>>(new Set())
  let liveCounter = 0

  // ---- Derived ---------------------------------------------------------

  const isDefaultQuery = $derived(
    !search && !region && statusFilter.length === 0 && columnFilters.length === 0 && sortClauses.length === 0,
  )
  const displayedRows = $derived.by<Transaction[]>(() => {
    if (isDefaultQuery && page === 0 && liveEnabled && liveTail.length) {
      return [...liveTail, ...pageRows].slice(0, pageSize)
    }
    return pageRows
  })
  const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)))
  const rowFrom = $derived(total === 0 ? 0 : page * pageSize + 1)
  const rowTo = $derived(Math.min((page + 1) * pageSize, total))
  const volume1m = $derived(volSeries.reduce((a, b) => a + b, 0))
  const statusTotal = $derived(STATUSES.reduce((a, s) => a + statusCounts[s], 0) || 1)
  const regionTotal = $derived(REGIONS.reduce((a, r) => a + regionCounts[r], 0) || 1)
  const settleRate = $derived(Math.round((statusCounts.settled / statusTotal) * 1000) / 10)

  const chart = $derived.by(() => {
    const s = series
    const n = s.length
    if (n < 2) return { line: '', area: '', max: 0 }
    const max = Math.max(10, ...s)
    const pts = s.map((v, i) => [(i / (n - 1)) * 100, 38 - (v / max) * 34] as const)
    const line = 'M' + pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L')
    const area = `${line} L100,40 L0,40 Z`
    return { line, area, max }
  })

  // ---- Server round-trip ----------------------------------------------

  let queryGen = 0
  function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

  async function runQuery(): Promise<void> {
    const gen = ++queryGen
    loading = true
    const latency = NETWORK_LATENCY.min + Math.random() * (NETWORK_LATENCY.max - NETWORK_LATENCY.min)
    await sleep(latency)
    if (gen !== queryGen) return
    const res = mockEndpoint(
      { search, region, statuses: statusFilter, sort: sortClauses, columnFilters, page, pageSize },
      liveTotal,
    )
    if (gen !== queryGen) return
    pageRows = res.rows
    total = res.total
    loading = false
    const ms = Math.round(latency)
    requests += 1
    lastLatency = ms
    latencySum += ms
    avgLatency = Math.round(latencySum / requests)
  }

  // Re-query whenever any server-affecting input changes (debounced).
  let lastKey = ''
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  $effect(() => {
    const key = JSON.stringify({ search, region, statusFilter, sortClauses, columnFilters, page, pageSize })
    if (key === lastKey) return
    lastKey = key
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => void runQuery(), 110)
  })

  // ---- Live stream: one burst per second -------------------------------

  $effect(() => {
    const id = setInterval(() => {
      if (!liveEnabled) return
      const burst = 8 + Math.floor(Math.random() * 54)
      const now = new Date().toISOString().slice(0, 19)
      const fresh: Transaction[] = []
      let vol = 0
      const nextStatus = { ...statusCounts }
      const nextRegion = { ...regionCounts }
      for (let k = 0; k < burst; k += 1) {
        liveCounter += 1
        const t = genTxn(TOTAL_START + liveCounter, now)
        fresh.push(t)
        vol += Math.abs(t.amount)
        nextStatus[t.status] += 1
        nextRegion[t.region] += 1
      }
      liveTotal += burst
      tps = burst
      series = [...series, burst].slice(-60)
      volSeries = [...volSeries, vol].slice(-60)
      statusCounts = nextStatus
      regionCounts = nextRegion
      liveTail = [...fresh.reverse(), ...liveTail].slice(0, 120)
      // Flash the new rows briefly.
      const ids = new Set(fresh.map((t) => t.id))
      flashIds = ids
      setTimeout(() => { if (flashIds === ids) flashIds = new Set() }, 1100)
      // Keep the default-view total ticking up live.
      if (isDefaultQuery) total = liveTotal
    }, 1000)
    return () => clearInterval(id)
  })

  // ---- Handlers --------------------------------------------------------

  function resetPage() { page = 0 }
  function toggleStatus(s: TxnStatus) {
    statusFilter = statusFilter.includes(s) ? statusFilter.filter((x) => x !== s) : [...statusFilter, s]
    resetPage()
  }
  function clearAll() {
    search = ''; region = ''; statusFilter = []; columnFilters = []; sortClauses = []; page = 0
    gridApi?.clearAllFilters(); gridApi?.clearSort()
  }
  function goTo(p: number) { page = Math.max(0, Math.min(p, pageCount - 1)) }

  // ---- Formatters ------------------------------------------------------

  function fmtAmount(amount: number, currency: string): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
  }
  function fmtTimestamp(iso: string): string {
    const d = new Date(iso + 'Z')
    return `${d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}  ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }
  function compact(n: number): string {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
    return String(Math.round(n))
  }

  const STATUS_COLOR: Record<TxnStatus, string> = {
    settled: '#22c55e', pending: '#f59e0b', failed: '#ef4444', reversed: '#94a3b8',
  }

  function rowClass(ctx: { row: Transaction }) {
    return flashIds.has(ctx.row.id) ? 'live-new' : ''
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(p: { txn: Transaction })}<span class="mono">{p.txn.id}</span>{/snippet}
{#snippet TsCell(p: { txn: Transaction })}<span class="mono ts">{fmtTimestamp(p.txn.timestamp)}</span>{/snippet}
{#snippet AmountCell(p: { txn: Transaction })}
  {@const pos = p.txn.amount >= 0}
  <span class={`amt ${pos ? 'amt-pos' : 'amt-neg'}`}>{pos ? '+' : '−'}{fmtAmount(Math.abs(p.txn.amount), p.txn.currency)}</span>
{/snippet}
{#snippet TypeCell(p: { txn: Transaction })}<span class={`type-pill type-${p.txn.type}`}>{p.txn.type}</span>{/snippet}
{#snippet StatusCell(p: { txn: Transaction })}
  <span class={`status-pill status-${p.txn.status}`}><span class="status-dot"></span>{p.txn.status}</span>
{/snippet}
{#snippet ChannelCell(p: { txn: Transaction })}<span class="channel">{p.txn.channel}</span>{/snippet}
{#snippet PlainCell(p: { txn: Transaction; field: keyof Transaction })}<span>{p.txn[p.field]}</span>{/snippet}

<!-- ───────────────────── DASHBOARD ───────────────────── -->

<section class="dash flex flex-col flex-1 min-h-0 gap-3">
  <!-- Header -->
  <header class="dash-head">
    <div class="dash-title">
      <span class="dash-name">Transaction Stream</span>
      <span class={`live-badge ${liveEnabled ? 'on' : ''}`}>
        <span class="live-dot"></span>{liveEnabled ? 'LIVE' : 'PAUSED'}
      </span>
    </div>
    <button class="dash-toggle" onclick={() => (liveEnabled = !liveEnabled)}>
      {liveEnabled ? 'Pause stream' : 'Resume stream'}
    </button>
  </header>

  <!-- KPI strip -->
  <div class="kpi-strip">
    <div class="kpi">
      <div class="kpi-label">Total events</div>
      <div class="kpi-value tabular-nums">{compact(liveTotal)}</div>
      <div class="kpi-foot">{liveTotal.toLocaleString()} on the server</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Throughput</div>
      <div class="kpi-value tabular-nums accent">{tps}<span class="kpi-unit">/s</span></div>
      <div class="kpi-foot">{compact(series.reduce((a, b) => a + b, 0))} in last {series.length}s</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Volume · 60s</div>
      <div class="kpi-value tabular-nums">${compact(volume1m)}</div>
      <div class="kpi-foot">gross moved</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Settle rate</div>
      <div class="kpi-value tabular-nums pos">{settleRate}%</div>
      <div class="kpi-foot">{compact(statusCounts.settled)} settled</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Latency</div>
      <div class="kpi-value tabular-nums">{avgLatency}<span class="kpi-unit">ms</span></div>
      <div class="kpi-foot">{requests.toLocaleString()} req · last {lastLatency}ms</div>
    </div>
  </div>

  <!-- Charts -->
  <div class="chart-row">
    <div class="chart-card throughput">
      <div class="chart-head">
        <span class="chart-title">Throughput · txns/sec</span>
        <span class="chart-now tabular-nums">{tps}<span class="chart-now-unit">/s</span></span>
      </div>
      <svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="thrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--sg-accent, #6366f1)" stop-opacity="0.34" />
            <stop offset="100%" stop-color="var(--sg-accent, #6366f1)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d={chart.area} fill="url(#thrFill)" />
        <path d={chart.line} fill="none" stroke="var(--sg-accent, #6366f1)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      </svg>
      <div class="chart-foot"><span>peak {chart.max}/s</span><span>last 60 seconds</span></div>
    </div>

    <div class="chart-card dist">
      <div class="chart-head"><span class="chart-title">Status mix</span></div>
      <div class="stack">
        {#each STATUSES as s (s)}
          {@const w = (statusCounts[s] / statusTotal) * 100}
          <div class="stack-seg" style={`width:${w}%; background:${STATUS_COLOR[s]};`} title={`${s}: ${Math.round(w)}%`}></div>
        {/each}
      </div>
      <div class="legend">
        {#each STATUSES as s (s)}
          <span class="legend-item">
            <span class="legend-dot" style={`background:${STATUS_COLOR[s]};`}></span>
            {s}<b class="tabular-nums">{Math.round((statusCounts[s] / statusTotal) * 100)}%</b>
          </span>
        {/each}
      </div>
      <div class="chart-title region-title">Region</div>
      <div class="rbars">
        {#each REGIONS as r (r)}
          {@const w = (regionCounts[r] / regionTotal) * 100}
          <div class="rbar">
            <span class="rbar-label">{r}</span>
            <span class="rbar-track"><span class="rbar-fill" style={`width:${w}%;`}></span></span>
            <span class="rbar-val tabular-nums">{Math.round(w)}%</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="toolbar">
    <input type="search" bind:value={search} oninput={resetPage} placeholder="Search id / account / counterparty…" class="t-search" />
    <select bind:value={region} onchange={resetPage} class="t-select">
      <option value="">All regions</option>
      {#each REGIONS as r (r)}<option value={r}>{r}</option>{/each}
    </select>
    <span class="chip-row">
      {#each STATUSES as s (s)}
        <button type="button" class="chip" class:chip-active={statusFilter.includes(s)}
          style={statusFilter.includes(s) ? `box-shadow: inset 0 0 0 2px ${STATUS_COLOR[s]};` : ''}
          onclick={() => toggleStatus(s)}>
          <span class="chip-dot" style={`background:${STATUS_COLOR[s]};`}></span>{s}
        </button>
      {/each}
    </span>
    <button type="button" class="t-btn" onclick={clearAll}>Clear all</button>
  </div>

  <!-- Grid -->
  <div class="grid-wrap flex-1 min-h-0">
    {#if loading}<div class="grid-loading"><span class="spinner"></span></div>{/if}
    <SvGrid
      data={displayedRows}
      columns={[
        { field: 'id', header: 'Transaction', width: 200, editable: false, cell: (ctx) => renderSnippet(IdCell, { txn: ctx.row.original }) },
        { field: 'timestamp', header: 'When (UTC)', width: 150, editable: false, cell: (ctx) => renderSnippet(TsCell, { txn: ctx.row.original }) },
        { field: 'accountId', header: 'Account', width: 130, editable: false, cell: (ctx) => renderSnippet(PlainCell, { txn: ctx.row.original, field: 'accountId' }) },
        { field: 'counterparty', header: 'Counterparty', width: 190, editable: false, cell: (ctx) => renderSnippet(PlainCell, { txn: ctx.row.original, field: 'counterparty' }) },
        { field: 'type', header: 'Type', width: 120, editable: false, cell: (ctx) => renderSnippet(TypeCell, { txn: ctx.row.original }) },
        { field: 'amount', header: 'Amount', editorType: 'number', width: 150, align: 'right', editable: false, cell: (ctx) => renderSnippet(AmountCell, { txn: ctx.row.original }) },
        { field: 'status', header: 'Status', width: 130, editable: false, cell: (ctx) => renderSnippet(StatusCell, { txn: ctx.row.original }) },
        { field: 'channel', header: 'Channel', width: 110, editable: false, cell: (ctx) => renderSnippet(ChannelCell, { txn: ctx.row.original }) },
        { field: 'region', header: 'Region', width: 100, editable: false, cell: (ctx) => renderSnippet(PlainCell, { txn: ctx.row.original, field: 'region' }) },
      ] satisfies ColumnDef<typeof features, Transaction>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      virtualization={false}
      externalSort={true}
      externalFilter={true}
      rowClass={rowClass}
      onSortingChange={(next) => { sortClauses = next; resetPage() }}
      onFiltersChange={(next) => { columnFilters = next.columns; resetPage() }}
      onApiReady={(next) => (gridApi = next)}
    />
  </div>

  <!-- Pager -->
  <div class="pager">
    <div class="pager-info tabular-nums">
      {#if isDefaultQuery && liveTail.length}<span class="pager-live">live tail · </span>{/if}
      rows <b>{rowFrom.toLocaleString()}–{rowTo.toLocaleString()}</b> of <b>{total.toLocaleString()}</b>
    </div>
    <div class="pager-ctrls">
      <button class="pg-btn" disabled={page === 0} onclick={() => goTo(0)} aria-label="First page">«</button>
      <button class="pg-btn" disabled={page === 0} onclick={() => goTo(page - 1)} aria-label="Previous page">‹</button>
      <span class="pg-pos tabular-nums">Page <b>{(page + 1).toLocaleString()}</b> / {pageCount.toLocaleString()}</span>
      <button class="pg-btn" disabled={page >= pageCount - 1} onclick={() => goTo(page + 1)} aria-label="Next page">›</button>
      <button class="pg-btn" disabled={page >= pageCount - 1} onclick={() => goTo(pageCount - 1)} aria-label="Last page">»</button>
      <select class="pg-size" bind:value={pageSize} onchange={resetPage}>
        {#each PAGE_SIZES as ps (ps)}<option value={ps}>{ps} / page</option>{/each}
      </select>
    </div>
  </div>
</section>

<style>
  .dash { position: relative; }

  /* ─── Header ─────────────────────────────────────────────────── */
  .dash-head { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .dash-title { display: inline-flex; align-items: center; gap: 12px; }
  .dash-name { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: var(--sg-fg, #0f172a); }
  .live-badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
    padding: 3px 9px; border-radius: 999px; text-transform: uppercase;
    background: color-mix(in srgb, var(--sg-muted, #94a3b8) 18%, transparent); color: var(--sg-muted, #64748b);
  }
  .live-badge.on { background: color-mix(in srgb, #ef4444 16%, transparent); color: #ef4444; }
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .live-badge.on .live-dot { animation: pulse 1.3s ease-out infinite; }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
    70% { box-shadow: 0 0 0 7px rgba(239,68,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  }
  .dash-toggle {
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border-radius: 7px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .dash-toggle:hover { background: var(--sg-header-bg, #f1f5f9); }

  /* ─── KPI strip ──────────────────────────────────────────────── */
  .kpi-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; flex-shrink: 0; }
  .kpi { border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff); border-radius: 12px; padding: 11px 14px; }
  .kpi-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); margin-bottom: 5px; }
  .kpi-value { font-size: 23px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; color: var(--sg-fg, #0f172a); }
  .kpi-unit { font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); margin-left: 2px; }
  .kpi-value.accent { color: var(--sg-accent, #6366f1); }
  .kpi-value.pos { color: #16a34a; }
  :global([data-theme='dark']) .kpi-value.pos { color: #4ade80; }
  .kpi-foot { margin-top: 6px; font-size: 11px; color: var(--sg-muted, #64748b); }

  /* ─── Charts ─────────────────────────────────────────────────── */
  .chart-row { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; flex-shrink: 0; height: 152px; }
  .chart-card { border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .chart-head { display: flex; align-items: center; justify-content: space-between; }
  .chart-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #64748b); }
  .chart-now { font-size: 18px; font-weight: 800; color: var(--sg-accent, #6366f1); letter-spacing: -0.02em; }
  .chart-now-unit { font-size: 11px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .spark { flex: 1 1 auto; width: 100%; min-height: 0; margin: 6px 0 2px; display: block; }
  .chart-foot { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--sg-muted, #64748b); }

  .dist { gap: 2px; }
  .stack { display: flex; height: 14px; border-radius: 5px; overflow: hidden; margin: 8px 0 8px; background: var(--sg-header-bg, #f1f5f9); }
  .stack-seg { height: 100%; transition: width 0.4s ease; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--sg-fg, #334155); }
  .legend-item { display: inline-flex; align-items: center; gap: 5px; text-transform: capitalize; }
  .legend-item b { color: var(--sg-muted, #64748b); font-weight: 600; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .region-title { margin-top: 9px; }
  .rbars { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
  .rbar { display: grid; grid-template-columns: 40px 1fr 32px; align-items: center; gap: 8px; font-size: 11px; color: var(--sg-muted, #64748b); }
  .rbar-track { height: 6px; border-radius: 999px; background: var(--sg-header-bg, #f1f5f9); overflow: hidden; }
  .rbar-fill { display: block; height: 100%; border-radius: 999px; background: var(--sg-accent, #6366f1); transition: width 0.4s ease; }
  .rbar-val { text-align: right; color: var(--sg-fg, #334155); font-weight: 600; }

  /* ─── Toolbar ────────────────────────────────────────────────── */
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex-shrink: 0; }
  .t-search, .t-select {
    border: 1px solid var(--sg-input-border, #cbd5e1); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #1e293b);
    border-radius: 7px; padding: 6px 10px; font-size: 13px;
  }
  .t-search { width: 280px; }
  .chip-row { display: inline-flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #1e293b);
    border-radius: 999px; padding: 4px 12px; font-size: 11.5px; font-weight: 500; cursor: pointer; text-transform: capitalize;
    transition: transform 80ms;
  }
  .chip:hover { transform: translateY(-1px); }
  .chip-active { font-weight: 600; border-color: transparent; }
  .chip-dot { width: 7px; height: 7px; border-radius: 50%; }
  .t-btn {
    margin-left: auto; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #1e293b);
    border-radius: 7px; padding: 5px 12px; font-size: 12px; cursor: pointer;
  }
  .t-btn:hover { background: var(--sg-header-bg, #f1f5f9); }

  /* ─── Grid ───────────────────────────────────────────────────── */
  .grid-wrap { position: relative; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; overflow: hidden; }
  .grid-loading {
    position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--sg-bg, #fff) 55%, transparent); backdrop-filter: blur(1px);
  }
  .spinner { width: 26px; height: 26px; border-radius: 50%; border: 3px solid color-mix(in srgb, var(--sg-accent, #6366f1) 25%, transparent); border-top-color: var(--sg-accent, #6366f1); animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  :global(.live-new td) { animation: flash-row 1.1s ease-out; }
  @keyframes flash-row {
    0% { background: color-mix(in srgb, var(--sg-accent, #6366f1) 22%, transparent); }
    100% { background: transparent; }
  }

  /* ─── Pager ──────────────────────────────────────────────────── */
  .pager {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff); border-radius: 12px; padding: 8px 12px;
  }
  .pager-info { font-size: 12px; color: var(--sg-muted, #64748b); }
  .pager-info b { color: var(--sg-fg, #0f172a); font-weight: 700; }
  .pager-live { color: #ef4444; font-weight: 700; }
  .pager-ctrls { display: inline-flex; align-items: center; gap: 6px; }
  .pg-btn {
    min-width: 30px; height: 30px; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border-radius: 7px; font-size: 15px; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  }
  .pg-btn:hover:not(:disabled) { background: var(--sg-header-bg, #f1f5f9); }
  .pg-btn:disabled { opacity: 0.4; cursor: default; }
  .pg-pos { font-size: 12px; color: var(--sg-muted, #64748b); padding: 0 6px; }
  .pg-pos b { color: var(--sg-fg, #0f172a); }
  .pg-size { border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); border-radius: 7px; padding: 5px 8px; font-size: 12px; margin-left: 4px; }

  /* ─── Cell pills (shared with the original) ──────────────────── */
  :global(.type-pill) { display: inline-block; padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; text-transform: lowercase; }
  :global(.type-transfer) { background: #dbeafe; color: #1d4ed8; }
  :global(.type-payment) { background: #ede9fe; color: #5b21b6; }
  :global(.type-deposit) { background: #dcfce7; color: #166534; }
  :global(.type-withdrawal) { background: #fef3c7; color: #92400e; }
  :global(.type-fee) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .type-transfer) { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .type-payment) { background: rgba(139,92,246,.18); color: #c4b5fd; }
  :global([data-theme='dark'] .type-deposit) { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .type-withdrawal) { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .type-fee) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.status-pill) { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
  :global(.status-dot) { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  :global(.status-settled) { background: #dcfce7; color: #166534; }
  :global(.status-pending) { background: #fef3c7; color: #92400e; }
  :global(.status-failed) { background: #fee2e2; color: #b91c1c; }
  :global(.status-reversed) { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark'] .status-settled) { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .status-pending) { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .status-failed) { background: rgba(239,68,68,.18); color: #f87171; }
  :global([data-theme='dark'] .status-reversed) { background: rgba(148,163,184,.18); color: #cbd5e1; }

  :global(.channel) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--sg-muted, #64748b); text-transform: uppercase; letter-spacing: 0.05em; }
  :global(.amt) { font-variant-numeric: tabular-nums; font-weight: 600; }
  :global(.amt-pos) { color: #16a34a; }
  :global(.amt-neg) { color: #dc2626; }
  :global([data-theme='dark'] .amt-pos) { color: #4ade80; }
  :global([data-theme='dark'] .amt-neg) { color: #f87171; }
  :global(.mono) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; letter-spacing: 0.02em; }
  :global(.ts) { color: var(--sg-muted, #64748b); }
</style>
