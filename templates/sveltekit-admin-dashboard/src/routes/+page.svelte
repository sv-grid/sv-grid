<script lang="ts">
  import { browser } from '$app/environment'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import StatCard from '$lib/StatCard.svelte'
  import { makeOrders, makeCustomers, summarize } from '$lib/data'
  import type { Order } from '$lib/types'

  const orders = makeOrders()
  const customers = makeCustomers()
  const kpis = summarize(orders, customers)

  const usd = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  // Most recent 8 orders for the overview table.
  const recent = $state(
    [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
  )

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order', width: 110 },
    { field: 'customer', header: 'Customer', width: 160 },
    { field: 'product', header: 'Product', width: 150 },
    { field: 'status', header: 'Status', width: 110 },
    {
      field: 'total',
      header: 'Total',
      width: 110,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
    { field: 'date', header: 'Date', width: 120, format: { type: 'date', pattern: 'y-m-d' } },
  ]
</script>

<svelte:head>
  <title>Overview · SvGrid Admin</title>
</svelte:head>

<section class="space-y-6">
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard label="Revenue (paid)" value={usd(kpis.revenue)} hint="all-time, sample data" />
    <StatCard label="MRR" value={usd(kpis.mrr)} hint={`${kpis.customers} active customers`} />
    <StatCard label="Orders" value={kpis.orders.toString()} hint={`${kpis.pending} pending`} />
    <StatCard label="Active customers" value={kpis.customers.toString()} />
  </div>

  <div class="rounded-xl border bg-white p-4 shadow-sm" style="border-color: var(--app-border);">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold" style="color: var(--app-fg);">Recent orders</h2>
      <a class="text-sm font-medium" style="color: var(--app-accent);" href="/orders">View all →</a>
    </div>

    <div style="height: 360px;">
      {#if browser}
        <SvGrid
          data={recent}
          {columns}
          {features}
          filterMode="menu"
          showRowNumbers={false}
          showPagination={false}
          rowHeight={40}
          containerHeight="100%"
          fitColumns={true}
        />
      {:else}
        <!-- Prerendered placeholder: real, crawlable rows for SEO -->
        <ul class="text-sm" style="color: var(--app-muted);">
          {#each recent as o}
            <li class="border-b py-1" style="border-color: var(--app-border);">
              {o.id} · {o.customer} · {o.product} · {usd(o.total)}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>
