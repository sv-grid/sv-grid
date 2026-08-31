<script lang="ts">
  /**
   * 33. Server-side & infinite scroll - 1M event audit log
   * ------------------------------------------------------
   * A one-million-row transaction log that lives "behind an API". The
   * grid mounts with NO data; chunks are pulled in as the user scrolls
   * past their position. Sort, filter, and search round-trip to the
   * mock endpoint - so we're never sorting 1M rows in the browser.
   *
   * Anatomy:
   *
   *   - `rows` is a sparse, fixed-length array of `Transaction | null`.
   *     The length equals the server-side match count (1M at rest,
   *     fewer when a filter narrows the set). Unloaded slots are
   *     `null`, and the cell snippets render skeleton bars for them.
   *
   *   - A scroll listener attached to the grid's scroll container
   *     converts the current `scrollTop` into a chunk range and asks
   *     the mock API for any chunks that aren't already loaded. Two
   *     chunks of look-ahead keeps placeholder flashes off-screen at
   *     reasonable scroll speeds.
   *
   *   - Sort / filter / search changes wipe the cache (`rows`,
   *     `loadedChunks`, `pendingChunks`) and re-fetch chunk 0. The
   *     debounced `mockApi.query()` cancels any in-flight chunk fetch
   *     so old results can't paint over fresh ones.
   *
   *   - A floating "Network" panel surfaces the last ten requests
   *     (chunk index, status, latency) plus aggregate stats from the
   *     mock API helper.
   *
   * Replace `mockEndpoint` with `fetch('/api/transactions?...')` and
   * the rest of the wiring stays exactly the same.
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
    timestamp: string          // ISO yyyy-mm-ddThh:mm:ss
    accountId: string
    counterparty: string
    type: TxnType
    amount: number             // in the txn's currency, can be negative for outgoing
    currency: 'USD' | 'EUR' | 'GBP'
    status: TxnStatus
    channel: TxnChannel
    region: TxnRegion
  }

  /**
   * The grid builds an internal Row object for every entry in the
   * `data` prop (each with ~9 method closures for selection /
   * expansion / cell lookup). At 1,000,000 the per-mount cost is
   * 3-5 seconds and every chunk update - which assigns a fresh
   * array reference - pays the same cost again. 100,000 keeps the
   * row-model build under ~250 ms while still giving the
   * "scrolls forever" feeling. The CHUNK_SIZE / latency story
   * stays identical regardless of total - what makes the demo
   * convincing is the chunked load + cancel + cache logic, not the
   * literal row count.
   */
  const TOTAL_ROWS = 100_000
  const CHUNK_SIZE = 200
  /** Chunks of look-ahead beyond the viewport once scrolling has settled.
   *  During fast scroll we drop to 0 so we don't queue chunks the user
   *  is already flying past. */
  const PREFETCH_CHUNKS = 1
  /** Coalesce scroll events for this many ms before deciding which
   *  chunks to fetch. Long enough to collapse a fast wheel-flick into a
   *  single fetch pass, short enough to feel responsive. */
  const SCROLL_DEBOUNCE_MS = 90
  /** Velocity threshold (px / ms) above which we treat the user as
   *  flying past rows - fetch only the current viewport, skip prefetch. */
  const FAST_SCROLL_PX_PER_MS = 3
  const NETWORK_LATENCY = { min: 50, max: 140 }

  /**
   * Single placeholder Transaction reused for every unloaded slot. The
   * grid reads `row[field]` directly inside `getColumnBaseValue`, so
   * `null` entries would throw a TypeError before the cell snippet ever
   * had a chance to render its skeleton. Pointing every slot at one
   * frozen object means a million unloaded rows cost ~8 MB of pointers,
   * not 8 MB × per-object overhead. The empty `id` field is the marker
   * cell snippets use to choose skeleton vs real content.
   */
  const PLACEHOLDER: Transaction = Object.freeze({
    id: '',
    timestamp: '',
    accountId: '',
    counterparty: '',
    type: 'transfer',
    amount: 0,
    currency: 'USD',
    status: 'settled',
    channel: 'api',
    region: 'NA',
  })

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

  // ---- Synthetic "remote" data generator -------------------------------

  /**
   * The "remote" dataset is generated once at module load and cached in
   * `ALL_TXNS`. We tried "compute on demand" first, but sort + filter
   * pass through the comparator millions of times and rebuilding a
   * Transaction inside every comparison made the demo unusably slow.
   * 100k rows * ~150 bytes = ~15 MB of static data - well within
   * what a demo-page browser can afford in exchange for snappy sort.
   */
  function buildTransaction(index: number): Transaction {
    const prng = createPrng(0xA5F00D ^ (index * 2654435761))
    // Spread the dataset across the last 365 days so the timestamp sort
    // is meaningful regardless of which slice the user is looking at.
    const dayOffset = Math.floor((index / TOTAL_ROWS) * 365)
    const minuteOfDay = prng.int(0, 24 * 60 - 1)
    const date = new Date(Date.UTC(2025, 5, 1) - dayOffset * 86_400_000)
    date.setUTCMinutes(minuteOfDay)
    const iso = date.toISOString().slice(0, 19)
    const type = prng.pick(TYPES)
    const direction = type === 'deposit' ? 1 : type === 'withdrawal' || type === 'fee' ? -1 : prng.pick([-1, 1])
    const magnitude = Math.round(prng.next() * prng.next() * 250_000) // bias toward small
    const amount = direction * magnitude
    const statusRoll = prng.next()
    const status: TxnStatus =
      statusRoll < 0.86 ? 'settled' : statusRoll < 0.94 ? 'pending' : statusRoll < 0.99 ? 'failed' : 'reversed'
    return {
      id: `TXN-${(index + 100_000).toString(36).toUpperCase()}-${prng.int(0x100, 0xfff).toString(16).toUpperCase()}`,
      timestamp: iso,
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

  /**
   * Pre-materialise the entire "remote" dataset. Done once at module
   * load so subsequent sort / filter passes just iterate a flat array
   * (the slow path was rebuilding a row per comparison - N log N
   * `buildTransaction` calls in a sort).
   */
  const ALL_TXNS: Transaction[] = (() => {
    const out = new Array<Transaction>(TOTAL_ROWS)
    for (let i = 0; i < TOTAL_ROWS; i += 1) out[i] = buildTransaction(i)
    return out
  })()

  function transactionAt(index: number): Transaction {
    return ALL_TXNS[index]!
  }

  // ---- Query types -----------------------------------------------------

  type SortClause = { id: string; desc: boolean }

  type GridFilter = {
    id: string
    operator: string
    value: string
    selectedValues?: Array<string>
  }

  type ServerQuery = {
    /** Free-text search (account id, counterparty, txn id). */
    search: string
    /** Region scope. Empty string = all. */
    region: TxnRegion | ''
    /** Status filter chips. Empty array = all. */
    statuses: TxnStatus[]
    /** Grid sort clauses (server pushes the sort). */
    sort: SortClause[]
    /** Grid-driven per-column filters. */
    columnFilters: GridFilter[]
    /** Inclusive row range to return [start, end). */
    rangeStart: number
    rangeEnd: number
  }

  type ServerResult = {
    rows: Transaction[]
    total: number
    /** Echoed back so the caller can ignore out-of-order responses. */
    rangeStart: number
    rangeEnd: number
  }

  // ---- Mock endpoint ---------------------------------------------------

  /**
   * Iterate the "remote" dataset, applying filters + sort + slice. This
   * is intentionally O(N) per call so the demo can show realistic
   * latency on a million-row scan. A real server would push the predicate
   * down to a database index.
   */
  function mockEndpoint(query: ServerQuery): ServerResult {
    const search = query.search.trim().toLowerCase()
    const statuses = new Set(query.statuses)
    const regionFilter = query.region

    const colFilters = query.columnFilters
      .filter((f) => f.operator === 'isBlank' || (f.value ?? '').length > 0 || (f.selectedValues && f.selectedValues.length))

    // First pass: count matches and (when sort/filter is active) materialise
    // the matching index list. For the unfiltered, unsorted case we can
    // skip materialising and just compute indices directly inside the slice.
    const passes = (txn: Transaction): boolean => {
      if (search) {
        const hay = `${txn.id} ${txn.accountId} ${txn.counterparty}`.toLowerCase()
        if (!hay.includes(search)) return false
      }
      if (regionFilter && txn.region !== regionFilter) return false
      if (statuses.size && !statuses.has(txn.status)) return false
      for (const f of colFilters) {
        const raw = (txn as unknown as Record<string, unknown>)[f.id]
        if (f.selectedValues && f.selectedValues.length) {
          if (!f.selectedValues.includes(String(raw ?? ''))) return false
        }
        const v = (f.value ?? '').toLowerCase()
        if (v) {
          const text = String(raw ?? '').toLowerCase()
          switch (f.operator) {
            case 'contains':    if (!text.includes(v)) return false; break
            case 'equals':      if (text !== v) return false; break
            case 'startsWith':  if (!text.startsWith(v)) return false; break
            case 'greaterThan': if (Number(raw) <= Number(f.value)) return false; break
            case 'lessThan':    if (Number(raw) >= Number(f.value)) return false; break
            case 'isBlank':     if (!(raw === null || raw === undefined || String(raw) === '')) return false; break
          }
        }
      }
      return true
    }

    const hasFilter =
      search !== '' || regionFilter !== '' || statuses.size > 0 || colFilters.length > 0
    const hasSort = query.sort.length > 0

    // FAST PATH: no filter, no sort. We can slice the cached universe
    // directly - O(chunk) instead of O(N).
    if (!hasFilter && !hasSort) {
      const start = Math.max(0, query.rangeStart)
      const end = Math.min(TOTAL_ROWS, query.rangeEnd)
      return {
        rows: ALL_TXNS.slice(start, end),
        total: TOTAL_ROWS,
        rangeStart: start,
        rangeEnd: end,
      }
    }

    // FILTERED PATH: collect matching Transaction objects directly so
    // the sort comparator just reads fields off them - previously the
    // comparator rebuilt a Transaction per call, which was O(N log N)
    // calls to a PRNG-heavy generator and made sort feel frozen.
    const matched: Transaction[] = []
    if (hasFilter) {
      for (let i = 0; i < TOTAL_ROWS; i += 1) {
        const txn = ALL_TXNS[i]!
        if (passes(txn)) matched.push(txn)
      }
    } else {
      // No filter but sort is set - start from the full set.
      for (let i = 0; i < TOTAL_ROWS; i += 1) matched.push(ALL_TXNS[i]!)
    }

    if (hasSort) {
      matched.sort((ta, tb) => {
        for (const clause of query.sort) {
          const av = (ta as unknown as Record<string, unknown>)[clause.id]
          const bv = (tb as unknown as Record<string, unknown>)[clause.id]
          let r: number
          if (typeof av === 'number' && typeof bv === 'number') r = av - bv
          else {
            const as = String(av ?? '')
            const bs = String(bv ?? '')
            r = as < bs ? -1 : as > bs ? 1 : 0
          }
          if (r !== 0) return clause.desc ? -r : r
        }
        return 0
      })
    }

    const total = matched.length
    const start = Math.max(0, query.rangeStart)
    const end = Math.min(total, query.rangeEnd)
    const rows: Transaction[] = new Array(Math.max(0, end - start))
    for (let i = start; i < end; i += 1) rows[i - start] = matched[i]!
    return { rows, total, rangeStart: start, rangeEnd: end }
  }

  // Wrap the endpoint in the shared mock-API helper so we get debounce,
  // abort, latency simulation, and stats for free.
  /**
   * Chunk fetcher. We do NOT route this through `createMockApi` because
   * that helper has search-style cancel-on-new-call semantics - every
   * new `.query()` aborts the previous, which would cancel every
   * still-in-flight chunk every time the user scrolls past another
   * chunk boundary. For chunk loading we want PARALLEL requests with
   * a per-generation cancel guard instead. `cacheGeneration` does
   * the same job as a shared AbortController without forcing chunks
   * to serialize.
   */
  let apiStats = $state({ requests: 0, cancelled: 0, lastLatencyMs: 0, avgLatencyMs: 0, inFlight: false })
  let latencySum = 0

  function pickLatency(): number {
    return NETWORK_LATENCY.min + Math.random() * (NETWORK_LATENCY.max - NETWORK_LATENCY.min)
  }

  async function fetchChunk(query: ServerQuery, generation: number): Promise<ServerResult | null> {
    const wait = pickLatency()
    await new Promise<void>((res) => setTimeout(res, wait))
    if (generation !== cacheGeneration) return null
    return mockEndpoint(query)
  }

  // ---- Reactive state --------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let rows = $state.raw<Transaction[]>(new Array(TOTAL_ROWS).fill(PLACEHOLDER))
  let totalRows = $state(TOTAL_ROWS)
  let loadedChunks = $state.raw<Set<number>>(new Set<number>())
  let pendingChunks = $state.raw<Set<number>>(new Set<number>())
  type NetEntry = {
    chunk: number
    rangeStart: number
    rangeEnd: number
    status: 'ok' | 'cancelled' | 'error'
    elapsedMs: number
    ts: number
  }
  let networkLog = $state.raw<Array<NetEntry>>([])

  let search = $state('')
  let region = $state<TxnRegion | ''>('')
  let statusFilter = $state<TxnStatus[]>([])
  let sortClauses = $state<SortClause[]>([])
  let columnFilters = $state<GridFilter[]>([])

  let gridApi: SvGridApi<typeof features, Transaction> | null = $state(null)
  let gridWrapperEl: HTMLDivElement | null = $state(null)

  // Sequence number stamped on every chunk fetch so an old response
  // landing late can detect that the cache was wiped under it and drop
  // itself instead of writing stale rows into the new array.
  let cacheGeneration = 0

  // ---- Cache wipe & re-seed --------------------------------------------

  function resetCache(): void {
    // Bumping the generation invalidates every chunk that's currently
    // mid-fetch - when its setTimeout resolves it'll see the changed
    // generation and drop its result on the floor.
    cacheGeneration += 1
    rows = new Array(totalRows).fill(PLACEHOLDER)
    loadedChunks = new Set()
    pendingChunks = new Set()
    void requestChunk(0)
  }

  /** Map a row index → chunk index. */
  function chunkOf(rowIndex: number): number {
    return Math.floor(rowIndex / CHUNK_SIZE)
  }

  async function requestChunk(chunkIndex: number): Promise<void> {
    if (loadedChunks.has(chunkIndex) || pendingChunks.has(chunkIndex)) return
    pendingChunks = new Set(pendingChunks).add(chunkIndex)
    apiStats = { ...apiStats, inFlight: true }
    const generation = cacheGeneration
    const rangeStart = chunkIndex * CHUNK_SIZE
    const rangeEnd = Math.min(rangeStart + CHUNK_SIZE, totalRows)
    const ts = performance.now()
    try {
      const result = await fetchChunk(
        {
          search, region, statuses: statusFilter,
          sort: sortClauses, columnFilters,
          rangeStart, rangeEnd,
        },
        generation,
      )
      if (!result) {
        // Generation mismatch - cache was wiped under us. Log as a
        // cancellation so the network panel makes it visible.
        const cancelEntry: NetEntry = {
          chunk: chunkIndex, rangeStart, rangeEnd, status: 'cancelled',
          elapsedMs: Math.round(performance.now() - ts), ts: Date.now(),
        }
        networkLog = [cancelEntry, ...networkLog].slice(0, 12)
        apiStats = { ...apiStats, cancelled: apiStats.cancelled + 1 }
        return
      }
      // The user scrolled past this chunk while it was in flight. Drop
      // the result rather than paint rows the user can no longer see -
      // the next visible-chunks pass will re-request it if needed.
      if (abortedChunks.has(chunkIndex)) {
        abortedChunks.delete(chunkIndex)
        const cancelEntry: NetEntry = {
          chunk: chunkIndex, rangeStart, rangeEnd, status: 'cancelled',
          elapsedMs: Math.round(performance.now() - ts), ts: Date.now(),
        }
        networkLog = [cancelEntry, ...networkLog].slice(0, 12)
        apiStats = { ...apiStats, cancelled: apiStats.cancelled + 1 }
        return
      }
      // Adopt the authoritative total from the server. Filters may have
      // narrowed it from 1M to a few hundred.
      if (result.total !== totalRows) {
        totalRows = result.total
        rows = new Array(totalRows).fill(PLACEHOLDER)
      }
      const next = rows.slice()
      for (let i = 0; i < result.rows.length; i += 1) {
        next[result.rangeStart + i] = result.rows[i]!
      }
      rows = next
      loadedChunks = new Set(loadedChunks).add(chunkIndex)
      const elapsed = Math.round(performance.now() - ts)
      const okEntry: NetEntry = {
        chunk: chunkIndex, rangeStart, rangeEnd, status: 'ok',
        elapsedMs: elapsed, ts: Date.now(),
      }
      networkLog = [okEntry, ...networkLog].slice(0, 12)
      latencySum += elapsed
      const newRequests = apiStats.requests + 1
      apiStats = {
        ...apiStats,
        requests: newRequests,
        lastLatencyMs: elapsed,
        avgLatencyMs: Math.round(latencySum / newRequests),
      }
    } catch (err) {
      const errEntry: NetEntry = {
        chunk: chunkIndex, rangeStart, rangeEnd, status: 'error',
        elapsedMs: Math.round(performance.now() - ts), ts: Date.now(),
      }
      networkLog = [errEntry, ...networkLog].slice(0, 12)
    } finally {
      const nextPending = new Set(pendingChunks)
      nextPending.delete(chunkIndex)
      pendingChunks = nextPending
      if (nextPending.size === 0) {
        apiStats = { ...apiStats, inFlight: false }
      }
    }
  }

  // ---- Scroll-driven chunk fetcher --------------------------------------

  let scrollContainer: HTMLElement | null = null
  /** Chunks whose in-flight response should be dropped on arrival because
   *  the user has scrolled away. Their slots stay placeholder until the
   *  next pass requests them again. */
  let abortedChunks = new Set<number>()

  /**
   * Resolve `.sv-grid-container` from inside our wrapper once it
   * mounts. SvGrid is a child component, so its container may not be
   * in the DOM the instant the parent's `bind:this` fires - we poll
   * with `requestAnimationFrame` until it appears (or the effect
   * tears down). Without the retry, slow Svelte mount orders left
   * `scrollContainer` permanently null and only the FIRST chunk
   * ever loaded - every subsequent scroll did nothing.
   */
  $effect(() => {
    if (!gridWrapperEl) return
    let cancelled = false
    let attachedEl: HTMLElement | null = null
    let attachedListener: ((event: Event) => void) | null = null

    // Scroll-throttling state. Kept local to the effect so it resets
    // cleanly on every mount.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let lastScrollTop = 0
    let lastScrollTime = performance.now()
    let lastVelocityPxPerMs = 0

    function scheduleFetch(): void {
      if (!scrollContainer) return
      const now = performance.now()
      const top = scrollContainer.scrollTop
      const dt = Math.max(1, now - lastScrollTime)
      // Exponential smoothing of velocity (60 / 40 mix) so a single
      // jittery rAF doesn't yo-yo the "fast scroll" decision.
      const instant = Math.abs(top - lastScrollTop) / dt
      lastVelocityPxPerMs = lastVelocityPxPerMs * 0.4 + instant * 0.6
      lastScrollTop = top
      lastScrollTime = now

      // While scroll is hot, only fetch the strict viewport. Once the
      // debounce timer fires (= scroll has gone quiet for ~90 ms), do a
      // settled pass that includes prefetch.
      fetchVisibleChunks({
        viewportOnly: lastVelocityPxPerMs > FAST_SCROLL_PX_PER_MS,
      })
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        lastVelocityPxPerMs = 0
        fetchVisibleChunks({ viewportOnly: false })
      }, SCROLL_DEBOUNCE_MS)
    }

    function tryAttach(): void {
      if (cancelled) return
      const el = gridWrapperEl!.querySelector<HTMLElement>('.sv-grid-container')
      if (!el) {
        requestAnimationFrame(tryAttach)
        return
      }
      scrollContainer = el
      attachedEl = el
      lastScrollTop = el.scrollTop
      lastScrollTime = performance.now()
      el.addEventListener('scroll', scheduleFetch, { passive: true })
      attachedListener = scheduleFetch
      // Kick off the initial settled pass. The grid may report a 0
      // clientHeight on the first paint - if so, keep deferring until
      // layout completes, otherwise the visible-chunk math computes an
      // empty range and the user sees no data until they scroll.
      function kickInitial() {
        if (cancelled || !scrollContainer) return
        if (scrollContainer.clientHeight === 0 || totalRows === 0) {
          requestAnimationFrame(kickInitial)
          return
        }
        fetchVisibleChunks({ viewportOnly: false })
      }
      requestAnimationFrame(kickInitial)
    }

    tryAttach()

    return () => {
      cancelled = true
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      if (attachedEl && attachedListener) {
        attachedEl.removeEventListener('scroll', attachedListener)
      }
      scrollContainer = null
    }
  })

  function fetchVisibleChunks(opts: { viewportOnly: boolean }): void {
    if (!scrollContainer) return
    const ROW_HEIGHT = 36
    const top = scrollContainer.scrollTop
    const height = scrollContainer.clientHeight
    const firstVisibleRow = Math.max(0, Math.floor(top / ROW_HEIGHT))
    const lastVisibleRow = Math.min(totalRows - 1, Math.floor((top + height) / ROW_HEIGHT))
    const maxChunk = Math.floor((totalRows - 1) / CHUNK_SIZE)
    // Look-behind is always 0 on a fast scroll. Look-ahead is 0 too -
    // we only want what's actually on screen until the user pauses.
    const lookBehind = opts.viewportOnly ? 0 : 1
    const lookAhead = opts.viewportOnly ? 0 : PREFETCH_CHUNKS
    const firstChunk = Math.max(0, chunkOf(firstVisibleRow) - lookBehind)
    const lastChunk = Math.min(maxChunk, chunkOf(lastVisibleRow) + lookAhead)

    const wanted = new Set<number>()
    for (let c = firstChunk; c <= lastChunk; c += 1) wanted.add(c)

    // Cancel any in-flight chunk the user has scrolled past - its
    // response will land in `requestChunk`'s post-await guard and be
    // discarded instead of being written into `rows`. This is the bit
    // that stops "still loading after the user has gone elsewhere".
    if (pendingChunks.size) {
      for (const c of pendingChunks) {
        if (!wanted.has(c)) abortedChunks.add(c)
      }
    }

    for (const c of wanted) {
      // If we'd previously marked this chunk as aborted but the user
      // scrolled back to it before it landed, un-abort it so we use
      // the in-flight result instead of firing a duplicate.
      abortedChunks.delete(c)
      void requestChunk(c)
    }
  }

  // ---- Query change → cache wipe ---------------------------------------

  let lastQueryKey = ''
  $effect(() => {
    // Build a stable signature of every server-affecting input so the
    // effect only fires on actual change (not just reference churn).
    const key = JSON.stringify({
      search, region, statusFilter, sortClauses, columnFilters,
    })
    if (key === lastQueryKey) return
    lastQueryKey = key
    resetCache()
  })

  // ---- KPI derivations --------------------------------------------------

  const loadedCount = $derived(loadedChunks.size * CHUNK_SIZE)
  const inFlight = $derived(pendingChunks.size > 0)

  // ---- Toolbar helpers -------------------------------------------------

  function toggleStatus(status: TxnStatus): void {
    statusFilter = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status]
  }

  function clearAllFilters(): void {
    search = ''
    region = ''
    statusFilter = []
    columnFilters = []
    sortClauses = []
    gridApi?.clearAllFilters()
    gridApi?.clearSort()
  }

  // ---- Formatters ------------------------------------------------------

  function fmtAmount(amount: number, currency: string): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
  }

  function fmtTimestamp(iso: string): string {
    // The data is already ISO; render as "Jun 03 14:32" for compactness.
    const d = new Date(iso + 'Z')
    const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${date}  ${time}`
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

<!-- Snippets read `rows[i]` directly (instead of taking the row as a
     prop) so they pick up freshly-loaded chunks on the same render
     pass. The grid's row models get cached across data updates when
     the data length is stable, so `ctx.row.original` would otherwise
     keep pointing at the stale PLACEHOLDER until the user scrolled
     enough to evict the row from the virtual window. Reading the
     reactive `rows` state inside the snippet body makes the cells
     reactively re-render whenever a chunk lands. -->

{#snippet SkeletonCell()}
  <span class="sk-bar" aria-hidden="true"></span>
{/snippet}

{#snippet IdCell(props: { i: number })}
  {@const r = rows[props.i]}
  {#if r && r.id}
    <span class="mono">{r.id}</span>
  {:else}
    {@render SkeletonCell()}
  {/if}
{/snippet}

{#snippet TsCell(props: { i: number })}
  {@const r = rows[props.i]}
  {#if r && r.id}
    <span class="mono ts">{fmtTimestamp(r.timestamp)}</span>
  {:else}
    {@render SkeletonCell()}
  {/if}
{/snippet}

{#snippet AmountCell(props: { i: number })}
  {@const r = rows[props.i]}
  {#if r && r.id}
    {@const positive = r.amount >= 0}
    <span class={`amt ${positive ? 'amt-pos' : 'amt-neg'}`}>
      {positive ? '+' : '−'}{fmtAmount(Math.abs(r.amount), r.currency)}
    </span>
  {:else}
    {@render SkeletonCell()}
  {/if}
{/snippet}

{#snippet TypeCell(props: { i: number })}
  {@const r = rows[props.i]}
  {#if r && r.id}
    <span class={`type-pill type-${r.type}`}>{r.type}</span>
  {:else}
    {@render SkeletonCell()}
  {/if}
{/snippet}

{#snippet StatusCell(props: { i: number })}
  {@const r = rows[props.i]}
  {#if r && r.id}
    <span class={`status-pill status-${r.status}`}>
      <span class="status-dot"></span>{r.status}
    </span>
  {:else}
    {@render SkeletonCell()}
  {/if}
{/snippet}

{#snippet ChannelCell(props: { i: number })}
  {@const r = rows[props.i]}
  {#if r && r.id}
    <span class="channel">{r.channel}</span>
  {:else}
    {@render SkeletonCell()}
  {/if}
{/snippet}

{#snippet PlainCell(props: { i: number; field: keyof Transaction })}
  {@const r = rows[props.i]}
  {#if r && r.id}
    <span>{r[props.field]}</span>
  {:else}
    {@render SkeletonCell()}
  {/if}
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="srv-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="srv-kpi-strip">
    <div class="srv-kpi">
      <div class="srv-kpi-label">Total matches</div>
      <div class="srv-kpi-value tabular-nums">{totalRows.toLocaleString()}</div>
      <div class="srv-kpi-foot">events on the server</div>
    </div>
    <div class="srv-kpi">
      <div class="srv-kpi-label">Loaded</div>
      <div class="srv-kpi-value tabular-nums">{Math.min(loadedCount, totalRows).toLocaleString()}</div>
      <div class="srv-kpi-foot">{loadedChunks.size} of {Math.ceil(totalRows / CHUNK_SIZE).toLocaleString()} chunks</div>
    </div>
    <div class="srv-kpi">
      <div class="srv-kpi-label">Requests</div>
      <div class="srv-kpi-value tabular-nums">{apiStats.requests.toLocaleString()}</div>
      <div class="srv-kpi-foot">{apiStats.cancelled.toLocaleString()} cancelled</div>
    </div>
    <div class="srv-kpi">
      <div class="srv-kpi-label">Avg latency</div>
      <div class="srv-kpi-value tabular-nums">{apiStats.avgLatencyMs} ms</div>
      <div class="srv-kpi-foot">last {apiStats.lastLatencyMs} ms · {inFlight ? 'fetching…' : 'idle'}</div>
    </div>
    <div class="srv-kpi">
      <div class="srv-kpi-label">Stream</div>
      <div class={`srv-kpi-value tabular-nums ${inFlight ? 'srv-up' : ''}`}>{inFlight ? 'LIVE' : 'IDLE'}</div>
      <div class="srv-kpi-foot">
        <span class={inFlight ? 'srv-pulse-dot' : ''}></span>
        chunk = {CHUNK_SIZE} rows
      </div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="srv-toolbar">
    <input
      type="search"
      bind:value={search}
      placeholder="Search id / account / counterparty…"
      class="srv-search"
    />
    <select bind:value={region} class="srv-select">
      <option value="">All regions</option>
      {#each REGIONS as r (r)}<option value={r}>{r}</option>{/each}
    </select>
    <span class="srv-chip-row">
      {#each STATUSES as s (s)}
        <button
          type="button"
          class={`srv-chip srv-chip-status-${s}`}
          class:srv-chip-active={statusFilter.includes(s)}
          onclick={() => toggleStatus(s)}
        >{s}</button>
      {/each}
    </span>
    <button
      type="button"
      class="srv-btn"
      onclick={clearAllFilters}
    >Clear all</button>
  </div>

  <!-- Grid -->
  <div class="flex-1 min-h-0 srv-grid-wrap" bind:this={gridWrapperEl}>
    <SvGrid
      data={rows as Transaction[]}
      columns={[
        {
          field: 'id', header: 'Transaction', width: 200, editable: false,
          cell: (ctx) => renderSnippet(IdCell, { i: ctx.row.index }),
        },
        {
          field: 'timestamp', header: 'When (UTC)', width: 150, editable: false,
          cell: (ctx) => renderSnippet(TsCell, { i: ctx.row.index }),
        },
        {
          field: 'accountId', header: 'Account', width: 130, editable: false,
          cell: (ctx) => renderSnippet(PlainCell, { i: ctx.row.index, field: 'accountId' }),
        },
        {
          field: 'counterparty', header: 'Counterparty', width: 200, editable: false,
          cell: (ctx) => renderSnippet(PlainCell, { i: ctx.row.index, field: 'counterparty' }),
        },
        {
          field: 'type', header: 'Type', width: 120, editable: false,
          cell: (ctx) => renderSnippet(TypeCell, { i: ctx.row.index }),
        },
        {
          field: 'amount', header: 'Amount', editorType: 'number', width: 150, editable: false,
          cell: (ctx) => renderSnippet(AmountCell, { i: ctx.row.index }),
        },
        {
          field: 'status', header: 'Status', width: 130, editable: false,
          cell: (ctx) => renderSnippet(StatusCell, { i: ctx.row.index }),
        },
        {
          field: 'channel', header: 'Channel', width: 110, editable: false,
          cell: (ctx) => renderSnippet(ChannelCell, { i: ctx.row.index }),
        },
        {
          field: 'region', header: 'Region', width: 100, editable: false,
          cell: (ctx) => renderSnippet(PlainCell, { i: ctx.row.index, field: 'region' }),
        },
      ] satisfies ColumnDef<typeof features, Transaction>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={false}
      externalSort={true}
      externalFilter={true}
      onSortingChange={(next) => (sortClauses = next)}
      onFiltersChange={(next) => (columnFilters = next.columns)}
      onApiReady={(next) => (gridApi = next)}
    />
  </div>

  <!-- Floating network panel -->
  <div class="srv-net" aria-live="polite">
    <div class="srv-net-head">
      <span>Network</span>
      <span class="srv-net-stats tabular-nums">
        {apiStats.requests} req · avg {apiStats.avgLatencyMs} ms
      </span>
    </div>
    <div class="srv-net-list">
      {#each networkLog as entry (entry.ts)}
        <div class={`srv-net-row srv-net-${entry.status}`}>
          <span class="srv-net-status-dot"></span>
          <span class="mono srv-net-chunk">#{entry.chunk}</span>
          <span class="srv-net-range tabular-nums">
            {entry.rangeStart.toLocaleString()}–{entry.rangeEnd.toLocaleString()}
          </span>
          <span class="srv-net-ms tabular-nums">{entry.elapsedMs} ms</span>
        </div>
      {:else}
        <div class="srv-net-empty">No requests yet</div>
      {/each}
    </div>
  </div>
</section>

<style>
  .srv-shell {
    position: relative;
  }

  /* ─── KPI strip ──────────────────────────────────────────────── */
  .srv-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .srv-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .srv-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .srv-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .srv-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    display: flex; align-items: center; gap: 4px;
  }
  .srv-up { color: #16a34a; }
  :global([data-theme='dark']) .srv-up { color: #4ade80; }
  .srv-pulse-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: #16a34a; animation: srv-dot 1.4s ease-out infinite;
  }
  @keyframes srv-dot {
    0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.45); }
    70%  { box-shadow: 0 0 0 7px rgba(22,163,74,0); }
    100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
  }

  /* ─── Toolbar ────────────────────────────────────────────────── */
  .srv-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .srv-search,
  .srv-select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 13px;
  }
  .srv-search { width: 280px; }
  .srv-chip-row { display: inline-flex; gap: 6px; flex-wrap: wrap; }
  .srv-chip {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    padding: 3px 12px;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 80ms;
  }
  .srv-chip:hover { transform: translateY(-1px); }
  .srv-chip-active {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--sg-accent, #2563eb) inset;
    font-weight: 600;
  }
  .srv-btn {
    margin-left: auto;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer;
  }
  .srv-btn:hover { background: var(--sg-header-bg, #f1f5f9); }

  /* ─── Status / type / channel pills (cells) ──────────────────── */
  :global(.type-pill) {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: lowercase;
  }
  :global(.type-transfer)   { background: #dbeafe; color: #1d4ed8; }
  :global(.type-payment)    { background: #ede9fe; color: #5b21b6; }
  :global(.type-deposit)    { background: #dcfce7; color: #166534; }
  :global(.type-withdrawal) { background: #fef3c7; color: #92400e; }
  :global(.type-fee)        { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .type-transfer)   { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .type-payment)    { background: rgba(139,92,246,.18); color: #c4b5fd; }
  :global([data-theme='dark'] .type-deposit)    { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .type-withdrawal) { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .type-fee)        { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.status-pill) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.status-dot) {
    display: inline-block;
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
  }
  :global(.status-settled)  { background: #dcfce7; color: #166534; }
  :global(.status-pending)  { background: #fef3c7; color: #92400e; }
  :global(.status-failed)   { background: #fee2e2; color: #b91c1c; }
  :global(.status-reversed) { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark'] .status-settled)  { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .status-pending)  { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .status-failed)   { background: rgba(239,68,68,.18); color: #f87171; }
  :global([data-theme='dark'] .status-reversed) { background: rgba(148,163,184,.18); color: #cbd5e1; }

  /* Toolbar chip versions echo the cell pill colors. */
  .srv-chip-status-settled  { color: #166534; }
  .srv-chip-status-pending  { color: #92400e; }
  .srv-chip-status-failed   { color: #b91c1c; }
  .srv-chip-status-reversed { color: #475569; }

  :global(.channel) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.amt) {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  :global(.amt-pos) { color: #16a34a; }
  :global(.amt-neg) { color: #dc2626; }
  :global([data-theme='dark'] .amt-pos) { color: #4ade80; }
  :global([data-theme='dark'] .amt-neg) { color: #f87171; }

  :global(.mono) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
  }
  :global(.ts) { color: var(--sg-muted, #64748b); }

  /* ─── Skeleton placeholders for unloaded rows ────────────────── */
  :global(.sk-bar) {
    display: inline-block;
    width: 70%;
    height: 10px;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      var(--sg-border, #e2e8f0) 0%,
      color-mix(in srgb, var(--sg-border, #e2e8f0) 60%, transparent) 50%,
      var(--sg-border, #e2e8f0) 100%
    );
    background-size: 200% 100%;
    animation: sk-shimmer 1.4s linear infinite;
    vertical-align: middle;
  }
  @keyframes sk-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ─── Floating network panel ─────────────────────────────────── */
  .srv-net {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 280px;
    max-height: 260px;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    z-index: 30;
    overflow: hidden;
    font-size: 11px;
    color: var(--sg-fg, #1e293b);
  }
  /* Phone: a 280px panel floating over a 360px-wide grid hides half of it.
     Put it in the flow under the grid instead. */
  @media (max-width: 639px) {
    .srv-net {
      position: static;
      width: auto;
      max-height: none;
      flex-shrink: 0;
      margin-top: 8px;
      box-shadow: none;
    }
  }
  .srv-net-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .srv-net-stats { color: var(--sg-muted, #64748b); font-weight: 500; }
  .srv-net-list {
    flex: 1 1 auto;
    overflow: auto;
    padding: 4px 0;
  }
  .srv-net-row {
    display: grid;
    grid-template-columns: 12px 60px 1fr auto;
    gap: 6px;
    align-items: center;
    padding: 4px 12px;
  }
  .srv-net-status-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--sg-muted, #94a3b8);
  }
  .srv-net-ok   .srv-net-status-dot { background: #16a34a; }
  .srv-net-cancelled .srv-net-status-dot { background: #ca8a04; }
  .srv-net-error .srv-net-status-dot { background: #dc2626; }
  .srv-net-chunk { color: var(--sg-muted, #64748b); }
  .srv-net-range { color: var(--sg-fg, #1e293b); }
  .srv-net-ms { color: var(--sg-muted, #64748b); }
  .srv-net-empty {
    padding: 12px;
    color: var(--sg-muted, #64748b);
    text-align: center;
    font-style: italic;
  }

  .srv-grid-wrap {
    position: relative;
  }
</style>
