<script lang="ts">
  /**
   * 406. Chart a selection from the context menu
   * --------------------------------------------
   * With integrated charting enabled, the right-click menu gains a "Chart
   * selected range" item: select a block of cells, right-click, and the chart
   * panel opens scoped to that range - the Excel "chart this" gesture, built in.
   *
   * The docked panel reserves its own gutter, so opening the chart SHRINKS the
   * grid rather than covering rows. The grid itself is dressed up with custom
   * cell renderers (product badge, category chip, rating, status pill),
   * in-cell sparklines, and declarative conditional formatting (gradient data
   * bars, heat scales, trend arrows) - all still fully chartable.
   *
   * Renderer: @svgrid/grid.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    type GridColumns,
    type ConditionalFormat,
  } from '@svgrid/grid'

  const features = tableFeatures({})

  type Row = {
    id: number
    product: string
    sku: string
    category: string
    trend: number[]
    revenue: number
    cost: number
    profit: number
    margin: number
    growth: number
    units: number
    rating: number
    status: 'Live' | 'Beta' | 'Sunset'
  }

  // Deterministic pseudo-random so the demo is stable across reloads.
  let seed = 0x9e3779b1
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff)

  const CATS = [
    { name: 'Analytics', color: '#6366f1' },
    { name: 'Infrastructure', color: '#0ea5e9' },
    { name: 'Security', color: '#ef4444' },
    { name: 'Collaboration', color: '#22c55e' },
    { name: 'Data', color: '#f59e0b' },
  ]
  const NAMES = [
    'Atlas', 'Beacon', 'Cobalt', 'Delta', 'Ember', 'Flux', 'Grid', 'Harbor',
    'Ion', 'Jet', 'Kepler', 'Lumen', 'Meridian', 'Nova', 'Onyx', 'Pulse',
    'Quartz', 'Relay', 'Summit', 'Titan', 'Umbra', 'Vertex', 'Warp', 'Xenon',
    'Yield', 'Zephyr', 'Aurora', 'Basalt', 'Cirrus', 'Drift', 'Echo', 'Forge',
    'Glint', 'Halo', 'Isle', 'Jade',
  ]
  const KINDS = ['Cloud', 'Engine', 'Suite', 'Core', 'Studio', 'Edge', 'Hub', 'Stack']
  const STATUSES: Row['status'][] = ['Live', 'Live', 'Live', 'Beta', 'Sunset']

  function spark(base: number): number[] {
    const out: number[] = []
    let v = base
    for (let i = 0; i < 14; i += 1) {
      v += (rnd() - 0.45) * base * 0.16
      out.push(Math.max(1, Math.round(v)))
    }
    return out
  }

  const data: Row[] = NAMES.map((name, id) => {
    const cat = CATS[id % CATS.length]!
    const revenue = Math.round(40_000 + rnd() * 460_000)
    const cost = Math.round(revenue * (0.35 + rnd() * 0.4))
    const profit = revenue - cost
    const units = Math.round(revenue / (120 + rnd() * 260))
    return {
      id,
      product: `${name} ${KINDS[id % KINDS.length]}`,
      sku: `SV-${cat.name.slice(0, 2).toUpperCase()}-${String(1000 + id)}`,
      category: cat.name,
      trend: spark(revenue / 10),
      revenue,
      cost,
      profit,
      margin: Math.round((profit / revenue) * 100),
      growth: Math.round((rnd() - 0.4) * 70),
      units,
      rating: Math.round((2.5 + rnd() * 2.5) * 2) / 2,
      status: STATUSES[Math.floor(rnd() * STATUSES.length)]!,
    }
  })

  const catColor = (name: string) => CATS.find((c) => c.name === name)?.color ?? '#64748b'
  const STATUS_COLOR: Record<string, string> = { Live: '#22c55e', Beta: '#f59e0b', Sunset: '#94a3b8' }
  const statusColor = (v: string) => STATUS_COLOR[v] ?? '#94a3b8'
  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const

  const columns: GridColumns<Row> = [
    {
      field: 'product',
      header: 'Product',
      width: 220,
      cell: (ctx) => renderSnippet(ProductCell, { row: ctx.row.original }),
    },
    {
      field: 'category',
      header: 'Category',
      width: 150,
      cell: (ctx) => renderSnippet(CategoryChip, { value: String(ctx.getValue()) }),
    },
    {
      field: 'trend',
      header: 'Revenue trend',
      width: 150,
      align: 'center',
      sparkline: { type: 'area', color: '#6366f1' },
    },
    { field: 'revenue', header: 'Revenue', width: 160, align: 'right', cellDataType: 'number', format: money },
    { field: 'cost', header: 'Cost', width: 140, align: 'right', cellDataType: 'number', format: money },
    { field: 'profit', header: 'Profit', width: 150, align: 'right', cellDataType: 'number', format: money },
    { field: 'margin', header: 'Margin %', width: 130, align: 'center', cellDataType: 'number' },
    { field: 'growth', header: 'Growth %', width: 130, align: 'right', cellDataType: 'number' },
    { field: 'units', header: 'Units', width: 120, align: 'right', cellDataType: 'number', format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    {
      field: 'rating',
      header: 'Rating',
      width: 130,
      align: 'center',
      cell: (ctx) => renderSnippet(RatingStars, { value: Number(ctx.getValue()) }),
    },
    {
      field: 'status',
      header: 'Status',
      width: 120,
      align: 'center',
      cell: (ctx) => renderSnippet(StatusPill, { value: String(ctx.getValue()) }),
    },
  ]

  const conditionalFormats: ConditionalFormat<Row>[] = [
    { type: 'dataBar', columns: ['revenue'], color: '#6366f1', gradient: true },
    { type: 'colorScale', columns: ['profit'], min: '#ef4444', mid: '#f8fafc', max: '#22c55e', zeroCentred: true },
    { type: 'colorScale', columns: ['margin'], mode: 'alpha', base: '#0ea5e9', minValue: 0, maxValue: 80, tooltip: 'percent' },
    { type: 'iconSet', columns: ['growth'], set: 'arrows', thresholds: [0, 12] },
    { type: 'rule', columns: ['growth'], when: ({ value }) => Number(value) < 0, color: '#dc2626', fontWeight: 700 },
    { type: 'dataBar', columns: ['units'], color: '#94a3b8' },
  ]
</script>

{#snippet ProductCell(props: { row: Row })}
  {@const c = catColor(props.row.category)}
  <span class="pc">
    <span class="pc-badge" style="background: linear-gradient(135deg, {c}, color-mix(in srgb, {c} 55%, #0f172a));">
      {props.row.product.charAt(0)}
    </span>
    <span class="pc-text">
      <span class="pc-name">{props.row.product}</span>
      <span class="pc-sku">{props.row.sku}</span>
    </span>
  </span>
{/snippet}

{#snippet CategoryChip(props: { value: string })}
  {@const c = catColor(props.value)}
  <span class="chip" style="color: {c}; background: color-mix(in srgb, {c} 16%, transparent); border-color: color-mix(in srgb, {c} 40%, transparent);">
    <span class="chip-dot" style="background: {c};"></span>{props.value}
  </span>
{/snippet}

{#snippet RatingStars(props: { value: number })}
  <span class="stars" title="{props.value} / 5" aria-label="{props.value} out of 5">
    {#each [0, 1, 2, 3, 4] as i (i)}
      {@const fill = Math.max(0, Math.min(1, props.value - i))}
      <span class="star">
        <span class="star-bg">★</span>
        <span class="star-fg" style="width: {fill * 100}%">★</span>
      </span>
    {/each}
  </span>
{/snippet}

{#snippet StatusPill(props: { value: string })}
  {@const c = statusColor(props.value)}
  <span class="status" style="color: {c}; background: color-mix(in srgb, {c} 15%, transparent);">
    <span class="status-dot" style="background: {c};"></span>{props.value}
  </span>
{/snippet}

<div class="cc-demo">
  <header class="cc-head">
    <h2>Chart from the context menu</h2>
    <p>Select a block of cells (drag across a measure column), then right-click and choose <strong>Chart selected range</strong>. The docked chart panel now shrinks the grid instead of covering it.</p>
  </header>

  <div class="cc-grid">
    <SvGrid
      columnResize
      {data}
      {columns}
      {features}
      {conditionalFormats}
      getRowId={(r) => String(r.id)}
      charting={{ defaultOpen: true, position: 'right', width: 380 }}
      enableCellSelection={true}
      selectionMode="cell"
      contextMenu={true}
      zebraRows={true}
      rowHeight={44}
      containerHeight="100%" />
  </div>

  <p class="cc-hint">The chart scopes to your selection and updates as you filter or sort the grid. Drag the panel edge to resize - the grid reflows to match.</p>
</div>

<style>
  .cc-demo { display: flex; flex-direction: column; gap: 14px; height: 100%; min-height: 0; font-family: var(--sg-font, inherit); color: inherit; }
  .cc-head { flex: 0 0 auto; }
  .cc-head h2 { margin: 0 0 3px; font-size: 18px; }
  .cc-head p { margin: 0; opacity: 0.65; font-size: 13px; max-width: 72ch; line-height: 1.5; }
  .cc-grid { flex: 1 1 auto; min-height: 0; }
  .cc-hint { flex: 0 0 auto; margin: 0; font-size: 12px; opacity: 0.65; }

  /* Product badge + name/SKU */
  .pc { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
  .pc-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; flex: 0 0 auto; border-radius: 8px;
    color: #fff; font-weight: 700; font-size: 13px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .pc-text { display: inline-flex; flex-direction: column; min-width: 0; line-height: 1.25; }
  .pc-name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pc-sku { font-size: 10.5px; letter-spacing: 0.03em; opacity: 0.55; font-variant-numeric: tabular-nums; }

  /* Category chip */
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 9px 2px 7px; border-radius: 999px;
    font-size: 11.5px; font-weight: 600; border: 1px solid transparent;
  }
  .chip-dot { width: 6px; height: 6px; border-radius: 50%; }

  /* Rating stars (fractional fill via clipped overlay) */
  .stars { display: inline-flex; gap: 1px; }
  .star { position: relative; display: inline-block; width: 14px; height: 16px; line-height: 16px; font-size: 14px; }
  .star-bg { color: color-mix(in srgb, currentColor 22%, transparent); }
  .star-fg { position: absolute; inset: 0; overflow: hidden; color: #f59e0b; white-space: nowrap; }

  /* Status pill */
  .status {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
  }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent); }
</style>
