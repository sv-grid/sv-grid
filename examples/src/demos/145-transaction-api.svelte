<!-- Documented in: docs/help/rows/transactions.md -->
<script lang="ts">
  /**
   * 145. Transaction API
   * --------------------
   * `api.applyTransaction({ add, update, remove })` applies a batch of row
   * mutations in ONE data update - the high-frequency / streaming path. Far
   * cheaper than calling addRow / setCellValue per row, and `update` /
   * `remove`-by-id match on `getRowId`.
   *
   *   api.applyTransaction({
   *     add:    [newOrder],
   *     update: [{ ...order, price: next }],   // matched by id
   *     remove: ['ORD-1001'],                  // by id (or row ref)
   *   })
   */
  import { SvGrid, tableFeatures, type ColumnDef, type SvGridApi } from 'sv-grid-core'

  const features = tableFeatures({})

  type Order = { id: string; symbol: string; side: 'BUY' | 'SELL'; qty: number; price: number; ts: string }

  const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'META', 'GOOG']
  let nextId = 1000
  let seed = 0x1234
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  function newOrder(): Order {
    return {
      id: `ORD-${nextId++}`,
      symbol: SYMBOLS[Math.floor(rnd() * SYMBOLS.length)]!,
      side: rnd() > 0.5 ? 'BUY' : 'SELL',
      qty: Math.round(10 + rnd() * 990),
      price: Math.round((50 + rnd() * 450) * 100) / 100,
      ts: new Date().toLocaleTimeString(),
    }
  }

  const seedRows: Order[] = Array.from({ length: 40 }, newOrder)
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let running = $state(true)
  let applied = $state({ added: 0, updated: 0, removed: 0 })
  let liveRows = $state(seedRows.length)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order', width: 120 },
    { field: 'symbol', header: 'Symbol', width: 100 },
    { field: 'side', header: 'Side', width: 90 },
    { field: 'qty', header: 'Qty', width: 100, align: 'right' },
    { field: 'price', header: 'Price', width: 120, align: 'right', format: { type: 'currency', currency: 'USD' } },
    { field: 'ts', header: 'Updated', width: 130 },
  ]

  function tick() {
    if (!api) return
    // The grid owns the data after mount; read it back via the API.
    const rows = api.getData()
    // update prices on a handful of existing rows (matched by id)
    const update = rows
      .filter(() => rnd() < 0.12)
      .slice(0, 6)
      .map((o) => ({ ...o, price: Math.round(o.price * (0.96 + rnd() * 0.08) * 100) / 100, ts: new Date().toLocaleTimeString() }))
    // add 1-2 new orders
    const add = Array.from({ length: 1 + Math.floor(rnd() * 2) }, newOrder)
    // remove a couple of the oldest once the book gets large
    const remove = rows.length > 60 ? rows.slice(0, 2).map((o) => o.id) : []
    const r = api.applyTransaction({ add, update, remove })
    applied = {
      added: applied.added + r.added,
      updated: applied.updated + r.updated,
      removed: applied.removed + r.removed,
    }
    liveRows = api.getData().length
  }

  $effect(() => {
    if (!running) return
    const h = setInterval(tick, 600)
    return () => clearInterval(h)
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Batched streaming via <code>api.applyTransaction</code>
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-3 text-xs" style="color: var(--sg-muted);">
      <button type="button" class="tx-btn" onclick={() => (running = !running)}>
        {running ? 'Pause' : 'Resume'}
      </button>
      <button type="button" class="tx-btn" onclick={tick} disabled={running}>Step</button>
      <span><strong style="color: var(--sg-fg)">{liveRows}</strong> live rows</span>
      <span style="color: #16a34a">+{applied.added} added</span>
      <span style="color: #2563eb">~{applied.updated} updated</span>
      <span style="color: #dc2626">-{applied.removed} removed</span>
      <span>· one re-render per batch, matched by <code>getRowId</code></span>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={seedRows}
      columns={columns}
      features={features}
      getRowId={(o) => o.id}
      selectionMode="none"
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(a) => (api = a)}
    />
  </div>
</section>

<style>
  .tx-btn {
    padding: 4px 12px;
    border: 1px solid var(--sg-border);
    border-radius: 6px;
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-size: 12px;
    cursor: pointer;
  }
  .tx-btn:disabled { opacity: 0.5; cursor: default; }
</style>
