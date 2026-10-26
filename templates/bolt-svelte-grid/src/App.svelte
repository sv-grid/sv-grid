<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { makeOrders, REGIONS, STATUSES, type Order } from './lib/orders'

  // Light/dark. The preset in app.css declares both palettes, so writing
  // data-theme on <html> is all it takes; index.html already restored the
  // saved choice before this runs.
  let theme = $state(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  $effect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // Storage blocked (private mode). The toggle still works for this tab.
    }
  })

  let orders = $state<Order[]>(makeOrders())
  let selected = $state<Order[]>([])
  let groupBy = $state<string[]>([])

  const revenue = $derived(orders.reduce((sum, o) => (o.status === 'Refunded' ? sum : sum + o.amount), 0))
  const selectedTotal = $derived(selected.reduce((sum, o) => sum + o.amount, 0))
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  // `field` is checked against Order, so a typo is a type error, not an empty column.
  const columns: GridColumns<Order> = [
    { field: 'id', header: 'Order', width: 110 },
    { field: 'customer', header: 'Customer', editorType: 'text', width: 170 },
    { field: 'region', header: 'Region', editorType: 'select', editorOptions: REGIONS, width: 150 },
    { field: 'product', header: 'Product', width: 150 },
    { field: 'status', header: 'Status', editorType: 'select', editorOptions: STATUSES, width: 120 },
    { field: 'quantity', header: 'Qty', editorType: 'number', align: 'right', width: 80, aggregate: 'sum' },
    {
      field: 'amount',
      header: 'Amount',
      editorType: 'number',
      align: 'right',
      width: 130,
      aggregate: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'orderedOn', header: 'Ordered', editorType: 'date', width: 130 },
    { field: 'priority', header: 'Priority', editorType: 'checkbox', align: 'center', width: 90 },
  ]

  // The grid does not write into your array; it reports the edit and you
  // apply it. This is where a save call to your backend goes.
  function applyEdit(event: { columnId: string; newValue: unknown; row: Order }) {
    orders = orders.map((o) => (o.id === event.row.id ? { ...o, [event.columnId]: event.newValue } : o))
  }

  const groupings: Array<[string, string[]]> = [
    ['No grouping', []],
    ['By status', ['status']],
    ['By region', ['region']],
    ['Region, then status', ['region', 'status']],
  ]
</script>

<main>
  <header>
    <div>
      <h1>Orders</h1>
      <p>Sort, filter, double-click a cell to edit, tick rows to total them.</p>
    </div>
    <button type="button" class="ghost" onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  </header>

  <section class="stats" aria-label="Summary">
    <div><span>Orders</span><strong>{orders.length}</strong></div>
    <div><span>Revenue (excl. refunds)</span><strong>{usd.format(revenue)}</strong></div>
    <div><span>Selected</span><strong>{selected.length ? `${selected.length} · ${usd.format(selectedTotal)}` : 'none'}</strong></div>
  </section>

  <div class="toolbar" role="group" aria-label="Group rows">
    {#each groupings as [label, value] (label)}
      <button type="button" class:active={groupBy.join() === value.join()} onclick={() => (groupBy = value)}>
        {label}
      </button>
    {/each}
  </div>

  <div class="grid-shell">
    <SvGrid
      data={orders}
      {columns}
      getRowId={(row) => row.id}
      sortable
      filterable
      editable
      groupable
      {groupBy}
      pageable
      pageSize={25}
      pageSizeOptions={[25, 50, 100]}
      showRowSelection
      onRowSelectionChange={(_selection, rows) => (selected = rows)}
      onCellValueChange={applyEdit}
      containerHeight="100%"
    />
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100vh;
    box-sizing: border-box;
    padding: 24px;
    max-width: 1280px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 22px;
  }
  header p {
    margin: 0;
    color: var(--sg-muted);
    font-size: 14px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .stats div {
    border: 1px solid var(--sg-border);
    border-radius: var(--sg-radius, 8px);
    padding: 12px 14px;
    background: var(--sg-bg-subtle, var(--sg-bg));
  }
  .stats span {
    display: block;
    font-size: 12px;
    color: var(--sg-muted);
  }
  .stats strong {
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  button {
    font: inherit;
    font-size: 13px;
    padding: 6px 12px;
    border-radius: var(--sg-radius, 6px);
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    cursor: pointer;
  }
  button.active {
    border-color: var(--sg-accent);
    color: var(--sg-accent);
  }
  .grid-shell {
    flex: 1;
    min-height: 360px;
  }
  @media (max-width: 640px) {
    main {
      padding: 16px;
      height: auto;
      min-height: 100vh;
    }
    .grid-shell {
      height: 520px;
      flex: none;
    }
  }
</style>
