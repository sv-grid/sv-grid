<script lang="ts">
  // Sparklines are headless: buildSparkline() returns paths + bar rects and we
  // draw the tiny SVG ourselves inside a renderSnippet cell. Two flavors here -
  // an area trend and a win/loss bar strip - both fed by toSparklineValues().
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    buildSparkline,
    toSparklineValues,
    type ColumnDef,
    type SparklineType,
  } from 'sv-grid-core'

  type Stock = { symbol: string; last: number; trend: number[]; result: number[] }

  const data: Stock[] = [
    { symbol: 'ACME', last: 182.4, trend: [120, 132, 128, 140, 150, 148, 160, 182], result: [1, 1, -1, 1, 1, -1, 1, 1] },
    { symbol: 'GLBX', last: 64.1, trend: [90, 84, 80, 78, 70, 66, 68, 64], result: [-1, -1, 1, -1, -1, 1, -1, -1] },
    { symbol: 'INIT', last: 251.0, trend: [200, 210, 208, 225, 240, 238, 246, 251], result: [1, 1, -1, 1, 1, -1, 1, 1] },
    { symbol: 'HOOLI', last: 47.8, trend: [60, 55, 58, 52, 49, 51, 46, 48], result: [-1, 1, -1, -1, 1, -1, 1, -1] },
    { symbol: 'STRK', last: 318.6, trend: [280, 290, 300, 296, 310, 305, 314, 318], result: [1, 1, -1, 1, -1, 1, 1, 1] },
    { symbol: 'WONK', last: 12.3, trend: [18, 16, 15, 14, 13, 14, 12, 12], result: [-1, -1, -1, 1, -1, 1, -1, 1] },
  ]

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Stock>[] = [
    { field: 'symbol', header: 'Symbol', width: 100 },
    { field: 'last', header: 'Last', width: 90, align: 'right',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'trend', header: 'Trend (area)', width: 140, sortable: false,
      cell: (ctx) => renderSnippet(Spark, { values: toSparklineValues(ctx.getValue()), type: 'area' }) },
    { field: 'result', header: 'Win / loss', width: 140, sortable: false,
      cell: (ctx) => renderSnippet(Spark, { values: toSparklineValues(ctx.getValue()), type: 'winloss' }) },
  ]
</script>

{#snippet Spark(p: { values: number[]; type: SparklineType })}
  {@const geo = buildSparkline(p.values, { type: p.type, width: 110, height: 26 })}
  {#if geo}
    <svg width={geo.width} height={geo.height} viewBox={`0 0 ${geo.width} ${geo.height}`} role="img" aria-label="sparkline">
      {#if geo.areaPath}
        <path d={geo.areaPath} fill={geo.color} opacity="0.18" />
      {/if}
      {#if geo.linePath}
        <path d={geo.linePath} fill="none" stroke={geo.color} stroke-width={geo.lineWidth} stroke-linejoin="round" />
      {/if}
      {#each geo.bars as b, i (i)}
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="0.5" fill={b.negative ? geo.negativeColor : geo.color} />
      {/each}
      {#if geo.lastPoint}
        <circle cx={geo.lastPoint.x} cy={geo.lastPoint.y} r="2" fill={geo.color} />
      {/if}
    </svg>
  {/if}
{/snippet}

<div style="height: 300px;">
  <SvGrid
    {data}
    {columns}
    {features}
    fitColumns
    rowHeight={40}
    containerHeight="100%"
  />
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  <code>toSparklineValues</code> cleans each row's array, <code>buildSparkline</code>
  lays out the geometry, and the snippet draws the <code>&lt;svg&gt;</code>: an area
  trend with an end-cap dot, and a win/loss bar strip (red for losses).
</p>
