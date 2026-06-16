<script lang="ts">
  // <SvGridChart> renders a dependency-free chart from a ChartSpec. Here we
  // aggregate the seed orders into "total revenue by region" with
  // rowsToChartSpec(), then let you flip the chart type live. Click a
  // bar / slice to see the onSelect callback fire.
  import {
    SvGridChart,
    rowsToChartSpec,
    type ChartType,
    type ChartSelection,
  } from '@svgrid/grid'
  import { makeOrders } from './seed'

  const orders = makeOrders(60)
  const TYPES: ChartType[] = ['bar', 'line', 'area', 'pie']
  let type = $state<ChartType>('bar')
  let lastClick = $state<string>('')

  const spec = $derived(
    rowsToChartSpec(orders, {
      type,
      category: 'region',
      value: 'total',
      reduce: 'sum',
      sort: 'value-desc',
      width: 540,
      height: 300,
    }),
  )

  const usd = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`

  function onSelect(sel: ChartSelection) {
    lastClick = `Selected ${sel.category ?? ''}`.trim()
  }
</script>

<div class="flex flex-wrap items-center gap-2 mb-3">
  {#each TYPES as t (t)}
    <button
      type="button"
      class="rounded border px-2.5 py-1 text-xs font-medium capitalize"
      style:border-color="var(--sg-border)"
      style:background={type === t ? 'var(--sg-accent)' : 'transparent'}
      style:color={type === t ? '#fff' : 'var(--sg-fg)'}
      onclick={() => (type = t)}
    >{t}</button>
  {/each}
  {#if lastClick}
    <span class="ml-auto text-xs" style="color: var(--sg-muted);">{lastClick}</span>
  {/if}
</div>

<div class="rounded-lg border p-3" style="border-color: var(--sg-border); background: var(--sg-bg);">
  <SvGridChart {spec} dataLabels formatValue={usd} {onSelect} />
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  <code>rowsToChartSpec</code> reduces 60 orders to total revenue per region;
  <code>&lt;SvGridChart&gt;</code> draws it with no charting dependency. Flip the
  type, hover for the crosshair tooltip, click the legend to toggle a series.
</p>
