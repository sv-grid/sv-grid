<!-- Documented in: docs/help/server/server-transactions.md -->
<script lang="ts">
  /**
   * 470. Server transactions (live feed)
   * ------------------------------------
   * A socket-style feed of changes the server already made, applied to the
   * grid without a refetch: a price tick patches the loaded row in place
   * (`updateRowData`, with a cell flash), a new order lands at the top of its
   * warehouse and a shipped one leaves (`applyTransactionAsync`, batched and
   * addressed by route). Every result carries a status, and the log shows
   * them: `applied`, `cancelled` when the veto is on, `storeNotFound` for a
   * warehouse whose level is not cached.
   *
   * The row model is Enterprise; the datasource contract it runs on is free.
   */
  import { SvGrid, renderComponent, tableFeatures, type GridColumns, type ServerDataSource } from '@svgrid/grid'
  import {
    setLicenseKey,
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    type ServerRowModelState,
    type ServerRowModelGridRow,
    type ServerTransaction,
    type ServerTransactionResult,
  } from '@svgrid/enterprise'
  import { createPrng } from '../shared/mock-api'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({})

  // ---- The server ----------------------------------------------------------
  type Order = {
    id: string
    warehouse: string
    customer: string
    sku: string
    qty: number
    price: number
    amount: number
    status: 'open' | 'packed' | 'shipped'
    updated: string
    /** Set by the server on group rows: how many orders the warehouse holds. */
    childCount?: number
  }
  const WAREHOUSES = ['North', 'South', 'West']
  const CUSTOMERS = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Stark Industries', 'Wonka', 'Cyberdyne', 'Tyrell']
  const SKUS = ['DESK-01', 'CHAIR-14', 'LAMP-07', 'MON-27', 'CAB-03', 'BOARD-12', 'DOCK-2', 'CABLE-8']
  const rng = createPrng(0x5eed)
  const clock = () => new Date().toTimeString().slice(0, 8)
  let seq = 1
  function makeOrder(warehouse: string): Order {
    const qty = rng.int(1, 12)
    const price = rng.int(20, 900)
    return {
      id: `ORD-${(seq++).toString().padStart(5, '0')}`,
      warehouse,
      customer: rng.pick(CUSTOMERS),
      sku: rng.pick(SKUS),
      qty,
      price,
      amount: qty * price,
      status: rng.pick(['open', 'open', 'packed', 'shipped'] as const),
      updated: clock(),
    }
  }
  // 600 orders per warehouse, newest first.
  const DB = new Map<string, Order[]>(WAREHOUSES.map((w) => [w, Array.from({ length: 600 }, () => makeOrder(w)).reverse()]))

  let requests = $state(0)
  const source: ServerDataSource<Order> = {
    async getRows(req) {
      requests += 1
      await new Promise((r) => setTimeout(r, 180))
      const keys = req.groupKeys ?? []
      if ((req.groupBy?.length ?? 0) > keys.length) {
        // The warehouse level: one row per warehouse with its sums.
        const rows = WAREHOUSES.map((w) => {
          const orders = DB.get(w)!
          return {
            warehouse: w,
            qty: orders.reduce((n, o) => n + o.qty, 0),
            amount: orders.reduce((n, o) => n + o.amount, 0),
            childCount: orders.length,
          } as unknown as Order
        })
        return { rows, rowCount: rows.length }
      }
      const orders = DB.get(keys[0]!) ?? []
      return { rows: orders.slice(req.startRow, req.endRow), rowCount: orders.length }
    },
  }

  // ---- The model ---------------------------------------------------------
  type Row = ServerRowModelGridRow<Order>
  type LogEntry = { seq: number; at: string; kind: string; route: string; status: string; detail: string }
  let view = $state<ServerRowModelState<Order>>()
  let log = $state<LogEntry[]>([])
  let logSeq = 0
  let vetoAdds = $state(false)
  const counts = $state({ applied: 0, cancelled: 0, storeNotFound: 0, ticks: 0 })
  function record(kind: string, route: string[], result: ServerTransactionResult | null, detail: string) {
    const status = result?.status ?? 'patched'
    if (result && status in counts) counts[status as 'applied' | 'cancelled' | 'storeNotFound'] += 1
    log = [{ seq: logSeq++, at: clock(), kind, route: route[0] ?? 'top level', status, detail }, ...log].slice(0, 40)
  }

  const ctl = createServerRowModel<Order>(source, {
    groupBy: ['warehouse'],
    aggregations: [
      { col: 'amount', fn: 'sum' },
      { col: 'qty', fn: 'sum' },
    ],
    getRowId: (o) => o.id,
    childCount: (o) => o.childCount,
    // West, the last group, opens on arrival; North and South stay closed at
    // the top of the list, so the feed's adds for them come back storeNotFound
    // until they are opened (a warehouse collapsed again drops its level,
    // purgeClosedGroups).
    isGroupOpenByDefault: (route) => route[0] === 'West',
    purgeClosedGroups: true,
    blockSize: 100,
    skeletonRows: 3,
    // Batched: the feed's transactions are queued and applied together.
    asyncTransactionWaitMs: 500,
    isApplyTransaction: (tx: ServerTransaction<Order>) => !(vetoAdds && tx.add?.length),
    onAsyncTransactionsFlushed: (results) => {
      flushes += 1
      queued = Math.max(0, queued - results.length)
      lastFlush = `${results.length} in the last flush`
    },
    onChange: (s) => {
      view = s
      // The feed starts once the first level is on screen; before that
      // every tick would find nothing to patch and no level to add to.
      if (!started && s.gridRows.some((r) => r.__group?.kind === 'leaf')) {
        started = true
        start()
      }
    },
  })
  ctl.refresh()
  $effect(() => () => {
    stop()
    ctl.dispose()
  })

  // ---- The feed ------------------------------------------------------------
  type Rate = 'slow' | 'normal' | 'fast'
  const RATES: Record<Rate, number> = { slow: 1500, normal: 600, fast: 200 }
  let rate = $state<Rate>('normal')
  let running = $state(true)
  let started = false
  let flushes = $state(0)
  let queued = $state(0)
  let lastFlush = $state('')
  let timer: ReturnType<typeof setTimeout> | null = null
  const RATE_LABEL: Record<Rate, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' }
  function setRate(next: Rate) {
    rate = next
    // Takes effect now, not after the current wait runs out.
    if (running) {
      stop()
      start()
    }
  }

  function tick() {
    const roll = Math.random()
    const warehouse = WAREHOUSES[Math.floor(Math.random() * WAREHOUSES.length)]!
    const orders = DB.get(warehouse)!
    if (roll < 0.55) {
      // A price tick on a row the grid holds: the server changed it, the
      // client patches the loaded copy. No request, no batching, one flash.
      const loaded = (ctl.getRows() as Row[]).filter((r) => r.__group?.kind === 'leaf')
      if (loaded.length) {
        const row = loaded[Math.floor(Math.random() * loaded.length)]! as Order
        const price = Math.max(10, row.price + Math.round((Math.random() - 0.5) * 60))
        const patch = { price, amount: price * row.qty, updated: clock() }
        const server = DB.get(row.warehouse)!.find((o) => o.id === row.id)
        if (server) Object.assign(server, patch)
        counts.ticks += 1
        ctl.updateRowData(row.id, patch)
        record('tick', [row.warehouse], null, `${row.id} price ${price}`)
      }
    } else if (roll < 0.82) {
      // A new order: the server has it, the client places it at the top of
      // its warehouse without re-reading the level.
      const order = makeOrder(warehouse)
      order.updated = clock()
      orders.unshift(order)
      queued += 1
      ctl.applyTransactionAsync({ route: [warehouse], add: [order], addIndex: 0 }, (result) =>
        record('add', [warehouse], result, `${order.id} ${order.customer}`),
      )
    } else {
      // Shipped and gone: removed by id at its route.
      const i = orders.findIndex((o) => o.status === 'shipped')
      if (i >= 0) {
        const [gone] = orders.splice(i, 1)
        queued += 1
        ctl.applyTransactionAsync({ route: [warehouse], remove: [gone!.id] }, (result) =>
          record('remove', [warehouse], result, `${gone!.id} shipped`),
        )
      }
    }
    if (running) timer = setTimeout(tick, RATES[rate])
  }
  function start() {
    if (timer) return
    running = true
    timer = setTimeout(tick, RATES[rate])
  }
  function stop() {
    running = false
    if (timer) clearTimeout(timer)
    timer = null
  }

  // ---- Columns --------------------------------------------------------------
  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const columns: GridColumns<Row> = [
    {
      id: 'group',
      header: 'Warehouse / customer',
      width: 190,
      sortable: false,
      filterable: false,
      fieldFn: (row) => serverGroupText(row, 'customer'),
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original,
          onToggle: () => ctl.group.onToggle(ctx.row.original),
          leafField: 'customer',
        }),
    },
    { field: 'id', header: 'Order', width: 100, formatter: ({ value, row }) => (row?.original.__group?.kind === 'leaf' ? String(value) : '') },
    { field: 'qty', header: 'Qty', width: 64, align: 'right', format: { type: 'number' }, cellFlash: true },
    { field: 'price', header: 'Price', width: 90, align: 'right', format: usd, cellFlash: true },
    { field: 'amount', header: 'Amount', width: 110, align: 'right', format: usd, cellFlash: true },
    { field: 'status', header: 'Status', width: 90 },
  ]
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="seg rate-seg" role="group" aria-label="Feed rate">
      {#each Object.keys(RATES) as r (r)}
        <button type="button" class:is-on={rate === r} aria-pressed={rate === r} onclick={() => setRate(r as Rate)}>{RATE_LABEL[r as Rate]}</button>
      {/each}
    </div>
    <div class="actions">
      <button type="button" class="btn" onclick={() => (running ? stop() : start())} title={running ? 'Stop the feed; the queue drains at the next flush' : 'Resume the feed'}>{running ? 'Pause feed' : 'Resume feed'}</button>
      <button type="button" class="btn" disabled={queued === 0} onclick={() => ctl.flushAsyncTransactions()} title="Apply the queued transactions now instead of at the next batch">Flush now</button>
      <button type="button" class="btn" onclick={() => ctl.refresh({ route: [] })} title="Transactions do not recompute the warehouse sums; a refresh of the top level does">Refresh totals</button>
    </div>
    <label class="chk"><input type="checkbox" bind:checked={vetoAdds} /> Veto adds</label>
    <span class="note">
      The server changes orders on its own and pushes what it did. A price tick patches the loaded row
      (<code>updateRowData</code>); a new or shipped order is a transaction at its warehouse's route,
      batched every 500 ms, and the count beside the warehouse follows it while the sums wait for
      <em>Refresh totals</em>. North and South are closed: adds for them come back <code>storeNotFound</code>
      until you open them, and a warehouse collapsed again drops its level.
    </span>
  </header>
  <div class="body">
    <div class="gridpane">
      <SvGrid
        responsive={true}
        columnResize
        fitColumns
        rowModel={ctl}
        stickyGroupRows
        {columns}
        {features}
        selectionMode="none"
        rowHeight={32}
        containerHeight="100%"
      />
    </div>
    <aside class="log" aria-label="Transaction log">
      <div class="log-head">Transactions <span class="muted">newest first</span></div>
      {#each log as e (e.seq)}
        <div class="log-row" class:is-bad={e.status === 'storeNotFound' || e.status === 'cancelled'}>
          <span class="log-kind">{e.kind}</span>
          <span class="log-route">{e.route}</span>
          <span class="log-status">{e.status}</span>
          <span class="log-detail" title={`${e.at} ${e.detail}`}>{e.detail}</span>
        </div>
      {/each}
      {#if !log.length}<div class="muted log-empty">Waiting for the feed.</div>{/if}
    </aside>
  </div>
  <footer class="foot">
    <span class="stat"><span class="stat-label">Ticks</span><strong>{counts.ticks}</strong></span>
    <span class="stat"><span class="stat-label">Applied</span><strong>{counts.applied}</strong></span>
    <span class="stat"><span class="stat-label">Cancelled</span><strong>{counts.cancelled}</strong></span>
    <span class="stat"><span class="stat-label">Store not found</span><strong>{counts.storeNotFound}</strong></span>
    <span class="stat"><span class="stat-label">Queued</span><strong>{queued}</strong></span>
    <span class="stat"><span class="stat-label">Flushes</span><strong>{flushes}</strong>{#if lastFlush}<span class="muted">{lastFlush}</span>{/if}</span>
    <span class="stat"><span class="stat-label">Requests</span><strong>{requests}</strong></span>
    <span class="stat"><span class="stat-label">On screen</span><strong>{(view?.gridRows.length ?? 0).toLocaleString()}</strong> rows</span>
    {#if view?.error}<span class="stat err">{String((view.error as Error).message ?? view.error)}</span>{/if}
  </footer>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  .log-row { grid-template-columns: 50px 44px 92px 1fr; }
  .log-row.is-bad .log-status { color: var(--sg-danger, #b91c1c); }
  .log-status { font-size: 11px; }
  .log-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sg-muted, #64748b); }
</style>
