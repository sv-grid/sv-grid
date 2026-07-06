<!--
  title: Service uptime board
  author: SvGrid team
  github: sv-grid
  tags: filtering, custom cells, data bars
  discussion: 0
-->
<script lang="ts">
  /**
   * An ops-style status board: each service shows a health badge, an uptime
   * percentage, and a latency data-bar rendered as an in-cell <div>. Use the
   * column filters to narrow by region or status. Self-contained.
   */
  import {
    SvGrid,
    renderSnippet,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Service = { id: number; name: string; region: string; status: 'Operational' | 'Degraded' | 'Down'; uptime: number; latency: number }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const rows: Service[] = [
    { id: 1, name: 'API Gateway',   region: 'us-east',  status: 'Operational', uptime: 99.98, latency: 42 },
    { id: 2, name: 'Auth Service',  region: 'us-east',  status: 'Operational', uptime: 99.95, latency: 61 },
    { id: 3, name: 'Payments',      region: 'eu-west',  status: 'Degraded',    uptime: 99.4,  latency: 187 },
    { id: 4, name: 'Search',        region: 'ap-south', status: 'Operational', uptime: 99.9,  latency: 88 },
    { id: 5, name: 'Notifications', region: 'eu-west',  status: 'Down',        uptime: 96.2,  latency: 0 },
    { id: 6, name: 'Media CDN',     region: 'us-west',  status: 'Operational', uptime: 100,   latency: 24 },
    { id: 7, name: 'Analytics',     region: 'ap-south', status: 'Degraded',    uptime: 99.1,  latency: 240 },
    { id: 8, name: 'Webhooks',      region: 'us-west',  status: 'Operational', uptime: 99.7,  latency: 73 },
  ]

  const TONE: Record<string, string> = { Operational: 'ok', Degraded: 'warn', Down: 'bad' }
  const MAX_LATENCY = 260

  const columns: ColumnDef<typeof features, Service>[] = [
    { field: 'name', header: 'Service', width: 160 },
    { field: 'region', header: 'Region', width: 120 },
    { field: 'status', header: 'Status', width: 140, cell: (ctx) => renderSnippet(Status, { v: String(ctx.getValue()) }) },
    { field: 'uptime', header: 'Uptime', width: 110, align: 'right', format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } } },
    { field: 'latency', header: 'p95 latency', width: 170, cell: (ctx) => renderSnippet(Latency, { v: Number(ctx.getValue()) }) },
  ]
</script>

{#snippet Status(p: { v: string })}
  <span class="st st-{TONE[p.v] ?? 'ok'}"><span class="dot"></span>{p.v}</span>
{/snippet}

{#snippet Latency(p: { v: number })}
  <span class="lat">
    <span class="lat-bar"><span class="lat-fill" style={`width:${Math.min(100, (p.v / MAX_LATENCY) * 100)}%`}></span></span>
    <span class="lat-n">{p.v} ms</span>
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">
    Filter by region or status from the column menus. A community-contributed demo.
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid data={rows} columns={columns} features={features} filterMode="menu" showRowNumbers={false} showPagination={false} rowHeight={38} containerHeight="100%" fitColumns={true} />
  </div>
</section>

<style>
  .st { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
  .st .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  .st-ok { color: #16a34a; }
  .st-warn { color: #d97706; }
  .st-bad { color: #dc2626; }
  .lat { display: inline-flex; align-items: center; gap: 8px; width: 100%; }
  .lat-bar { flex: 1; height: 6px; border-radius: 999px; background: color-mix(in oklab, var(--sg-muted) 22%, transparent); overflow: hidden; }
  .lat-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #22c55e, #f59e0b, #ef4444); }
  .lat-n { font-size: 11px; color: var(--sg-muted); font-variant-numeric: tabular-nums; min-width: 46px; text-align: right; }
</style>
