<script lang="ts">
  /**
   * 99. Top N / Bottom N filter
   * ---------------------------
   * The "show me the top 10 by revenue" toolbar that every BI tool ships.
   * Pick a metric, pick N, pick top / bottom; the grid filters to those
   * rows ranked by that metric. Composes with the column-menu filters -
   * top-N runs on whatever's already visible, so "top 5 in EMEA" works.
   *
   * Pure user-land: we sort a copy of the data and slice. No library
   * change required.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-community'

  type Sales = {
    id: string
    salesperson: string
    region: 'Americas' | 'EMEA' | 'APAC'
    industry: 'SaaS' | 'Retail' | 'Manufacturing' | 'Finance' | 'Healthcare'
    revenue: number
    deals: number
    pipeline: number
    winRate: number   // 0..1
    avgDealSize: number
  }

  // Seeded data
  let prng = 0xFEEDCAFE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }
  function rangef(min: number, max: number) { return min + rand() * (max - min) }

  const FIRST = ['Ava', 'Liam', 'Noah', 'Emma', 'Olivia', 'Mason', 'Sophia', 'Lucas', 'Mia', 'Ethan',
                 'Charlotte', 'Henry', 'Amelia', 'Wyatt', 'Harper', 'Sebastian', 'Evelyn', 'Owen',
                 'Abigail', 'Carter', 'Scarlett', 'Levi', 'Aria', 'Julian', 'Aurora', 'Hudson']
  const LAST = ['Thompson', 'Park', 'Singh', 'Garcia', 'Chen', 'Rivera', 'Brown', 'Patel', 'Johnson',
                'Wright', 'Khan', 'Sato', 'Volkov', 'Schmidt', 'Andersson', 'Costa', 'Rossi', 'Dubois']
  const REGIONS = ['Americas', 'EMEA', 'APAC'] as const
  const INDUSTRIES = ['SaaS', 'Retail', 'Manufacturing', 'Finance', 'Healthcare'] as const

  let rows = $state<Sales[]>(Array.from({ length: 80 }, (_, i) => {
    const revenue = int(45_000, 980_000)
    const deals   = int(8, 95)
    return {
      id: `S-${(2000 + i).toString()}`,
      salesperson: `${pick(FIRST)} ${pick(LAST)}`,
      region:   pick(REGIONS),
      industry: pick(INDUSTRIES),
      revenue,
      deals,
      pipeline: revenue + int(20_000, 600_000),
      winRate: rangef(0.18, 0.74),
      avgDealSize: Math.round(revenue / deals),
    }
  }))

  // ---- Metric definitions ----------------------------------------------
  type MetricId = 'revenue' | 'deals' | 'pipeline' | 'winRate' | 'avgDealSize'
  type MetricDef = { id: MetricId; label: string; fmt: (n: number) => string }
  const fmtUsd = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}k`
                   : `$${n.toFixed(0)}`
  const METRICS: MetricDef[] = [
    { id: 'revenue',     label: 'Revenue',        fmt: fmtUsd },
    { id: 'deals',       label: 'Deals closed',   fmt: (n) => `${n}` },
    { id: 'pipeline',    label: 'Pipeline',       fmt: fmtUsd },
    { id: 'winRate',     label: 'Win rate',       fmt: (n) => `${(n * 100).toFixed(1)}%` },
    { id: 'avgDealSize', label: 'Avg deal size',  fmt: fmtUsd },
  ]

  // ---- Filter state ----------------------------------------------------
  let enabled = $state(true)
  let metric  = $state<MetricId>('revenue')
  let mode    = $state<'top' | 'bottom'>('top')
  let n       = $state(10)

  // The visible rows: sort by chosen metric and slice. Stays sorted by
  // metric so the user can see the ranking; the grid's own header-sort
  // would clobber the order, so we disable interactive sort.
  const displayed = $derived.by(() => {
    if (!enabled) return rows
    const sorted = rows.slice().sort((a, b) =>
      mode === 'top'
        ? (b[metric] as number) - (a[metric] as number)
        : (a[metric] as number) - (b[metric] as number),
    )
    return sorted.slice(0, n)
  })

  // ---- KPI panel -------------------------------------------------------
  const summary = $derived.by(() => {
    const totalRev = rows.reduce((s, r) => s + r.revenue, 0)
    const visRev = displayed.reduce((s, r) => s + r.revenue, 0)
    return {
      rows: displayed.length,
      total: rows.length,
      coverage: totalRev > 0 ? visRev / totalRev : 0,
      visRev,
    }
  })

  // Sticky quick-pick chips
  const N_OPTIONS = [3, 5, 10, 20, 30]
  function bumpN(d: number) { n = Math.max(1, Math.min(rows.length, n + d)) }

  // ---- Columns ---------------------------------------------------------
  const columns: ColumnDef<typeof features, Sales>[] = [
    { field: 'salesperson', header: 'Salesperson', width: 180, editable: false },
    { field: 'region',      header: 'Region',      width: 100, editable: false },
    { field: 'industry',    header: 'Industry',    width: 130, editable: false },
    { field: 'revenue',     header: 'Revenue',     width: 130, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'deals',       header: 'Deals',       width: 90,  editable: false, align: 'right' },
    { field: 'pipeline',    header: 'Pipeline',    width: 140, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'winRate',     header: 'Win rate',    width: 110, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'percent', maximumFractionDigits: 1 } } },
    { field: 'avgDealSize', header: 'Avg deal',    width: 130, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
  ]
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const currentMetric = $derived(METRICS.find((m) => m.id === metric)!)
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip ---------------------------------------------------- -->
  <div class="kpi-strip shrink-0">
    <div class="kpi">
      <div class="kpi-label">Showing</div>
      <div class="kpi-value">{summary.rows} <span class="kpi-of">/ {summary.total}</span></div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Visible {currentMetric.label}</div>
      <div class="kpi-value">{currentMetric.fmt(displayed.reduce((s, r) => s + (r[metric] as number), 0))}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Revenue coverage</div>
      <div class="kpi-value accent">{(summary.coverage * 100).toFixed(1)}%</div>
      <div class="coverage-bar">
        <span style:width={`${summary.coverage * 100}%`}></span>
      </div>
    </div>
  </div>

  <!-- Top-N bar ---------------------------------------------------- -->
  <div class="topn-bar shrink-0">
    <label class="topn-toggle">
      <input type="checkbox" bind:checked={enabled} />
      <span>Top-N filter</span>
    </label>

    <div class={`topn-controls ${enabled ? '' : 'is-dimmed'}`}>
      <div class="seg">
        <button class={mode === 'top' ? 'is-on' : ''} onclick={() => mode = 'top'}>Top</button>
        <button class={mode === 'bottom' ? 'is-on' : ''} onclick={() => mode = 'bottom'}>Bottom</button>
      </div>

      <div class="n-wrap">
        <button class="step" onclick={() => bumpN(-1)} aria-label="Decrease N">−</button>
        <input class="n-input" type="number" min="1" max={rows.length}
          bind:value={n} />
        <button class="step" onclick={() => bumpN(1)} aria-label="Increase N">+</button>
        <span class="n-quick">
          {#each N_OPTIONS as opt (opt)}
            <button class={n === opt ? 'is-on' : ''} onclick={() => n = opt}>{opt}</button>
          {/each}
        </span>
      </div>

      <span class="by">by</span>
      <select class="metric" bind:value={metric}>
        {#each METRICS as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
      </select>
    </div>

    <div class="topn-summary">
      {#if enabled}
        Showing <strong>{mode === 'top' ? 'top' : 'bottom'} {n}</strong>
        salespeople by <strong>{currentMetric.label}</strong>.
      {:else}
        Showing all {rows.length} salespeople. Toggle the filter to rank.
      {/if}
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={displayed}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  /* KPI strip */
  .kpi-strip { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 10px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 14px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
               color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 22px; font-weight: 700; color: var(--sg-fg, #0f172a);
               font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi-value.accent { color: #6366f1; }
  .kpi-of { font-size: 14px; color: var(--sg-muted, #94a3b8); font-weight: 500; }
  .coverage-bar {
    height: 6px; background: var(--sg-row-hover-bg, rgba(148,163,184,0.15));
    border-radius: 3px; overflow: hidden; margin-top: 6px;
  }
  .coverage-bar span {
    display: block; height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    transition: width 200ms ease-out;
  }

  /* Top-N bar */
  .topn-bar {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    gap: 16px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(180deg, color-mix(in oklab, #6366f1 4%, var(--sg-bg, #fff)), var(--sg-bg, #fff));
    border-radius: 10px; padding: 10px 14px;
  }
  .topn-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 700; color: var(--sg-fg, #0f172a);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .topn-toggle input { accent-color: #6366f1; }

  .topn-controls {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    transition: opacity 150ms;
  }
  .topn-controls.is-dimmed { opacity: 0.3; pointer-events: none; }

  .seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px;
    overflow: hidden;
  }
  .seg button {
    background: var(--sg-bg, #fff); border: 0; cursor: pointer;
    padding: 5px 12px; font-size: 12px; font-weight: 700;
    color: var(--sg-muted, #64748b);
  }
  .seg button.is-on {
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
  }
  .seg button + button { border-left: 1px solid var(--sg-border, #cbd5e1); }

  .n-wrap { display: inline-flex; align-items: center; gap: 6px; }
  .step {
    width: 26px; height: 26px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer;
  }
  .step:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }
  .n-input {
    width: 60px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 4px 8px;
    font-size: 14px; font-variant-numeric: tabular-nums;
    font-weight: 700; text-align: center;
  }
  .n-quick { display: inline-flex; gap: 3px; margin-left: 6px; }
  .n-quick button {
    background: transparent; border: 1px solid transparent;
    color: var(--sg-muted, #64748b);
    border-radius: 999px; padding: 2px 9px;
    font-size: 11px; font-weight: 700; cursor: pointer;
  }
  .n-quick button:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }
  .n-quick button.is-on {
    background: #6366f1; color: #fff; border-color: #6366f1;
  }

  .by { font-size: 11px; color: var(--sg-muted, #64748b);
        font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .metric {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 5px 10px;
    font-size: 13px; font-weight: 600;
    font-family: inherit;
  }
  .topn-summary {
    font-size: 12px; color: var(--sg-muted, #64748b);
    text-align: right;
  }
  .topn-summary strong { color: #6366f1; }
</style>
