<script lang="ts">
  /**
   * 90. Anomaly highlights - AI-grade outlier detection
   * ---------------------------------------------------
   * Background pass computes per-column outliers and marks every cell
   * with a severity score. The cell snippet paints a coloured halo
   * (warning / outlier / extreme) and exposes a tooltip explaining
   * the rule that fired.
   *
   * Two detectors are wired:
   *
   *   - IQR distance for numeric columns (`salary`, `performance`,
   *     `attempts`). Cells beyond 1.5× IQR are warnings, 3× IQR are
   *     outliers, 6× IQR are extreme.
   *   - Rare-value detection for low-cardinality categoricals
   *     (`status`). Values seen in less than 2% of rows surface as
   *     anomalies regardless of their absolute count.
   *
   * The full anomaly map is computed once via $derived; cell renders
   * read from it in O(1), so toggling row sort / filter doesn't run
   * a fresh scan.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Status = 'active' | 'pending' | 'inactive' | 'flagged' | 'frozen'

  type Account = {
    id: string
    customer: string
    region: 'NA' | 'EMEA' | 'APAC' | 'LATAM'
    status: Status
    /** Number of failed logins in the last 24 h - tail values are anomalies. */
    attempts: number
    /** Monthly transaction volume in USD - skewed; extreme outliers are interesting. */
    volume: number
    /** Performance score 0-100; bimodal so the centre is sparse. */
    performance: number
    /** Salary the customer's primary account holder reports. */
    salary: number
  }

  const REGIONS: Account['region'][] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const CUSTOMERS = [
    'Aurora Trading', 'Helios Holdings', 'Vertex Partners', 'Pacific Industries',
    'Nordic Capital', 'Atlas Logistics', 'Quantum Resources', 'Stellar Networks',
    'Apex Bio', 'Crescent Labs', 'Sigma Capital', 'Pioneer Mining',
    'Cobalt Systems', 'Meridian Materials', 'Polaris Bio', 'Sentinel Capital',
    'Tessera Partners', 'Vanguard Tech', 'Cascade Industries', 'Granite Energy',
  ]

  // Deterministic seed so the anomalies show up in the same cells each load.
  let prng = 0xC0FFEE
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }

  function makeRows(count: number): Account[] {
    const out: Account[] = []
    for (let i = 0; i < count; i++) {
      const r = rnd()
      const status: Status = r < 0.02 ? 'frozen'    // very rare
                          : r < 0.06 ? 'flagged'    // rare
                          : r < 0.15 ? 'inactive'
                          : r < 0.40 ? 'pending'
                          :            'active'
      // Salaries skewed log-normal-ish; throw in a couple monsters at the top.
      const salary = Math.round(50_000 + rnd() ** 2 * 350_000 + (rnd() < 0.02 ? 800_000 : 0))
      // Attempts: most 0-3, a long tail with outliers.
      const attempts = rnd() < 0.07 ? 8 + Math.floor(rnd() * 80) : Math.floor(rnd() * 5)
      // Volume: long-tailed. A few accounts at $20M+.
      const volume = Math.round(1_000 + rnd() ** 3 * 250_000 + (rnd() < 0.03 ? 25_000_000 : 0))
      // Performance: bimodal around 35 / 80, sparse middle.
      const performance = rnd() < 0.5 ? Math.round(20 + rnd() * 30) : Math.round(70 + rnd() * 25)
      out.push({
        id: 'A' + (10_000 + i).toString(36).toUpperCase(),
        customer: CUSTOMERS[i % CUSTOMERS.length]!,
        region: REGIONS[Math.floor(rnd() * REGIONS.length)]!,
        status,
        attempts,
        volume,
        performance,
        salary,
      })
    }
    return out
  }

  let rows = $state<Account[]>(makeRows(120))
  let enabled = $state(true)
  let minSeverity = $state<'warning' | 'outlier' | 'extreme'>('warning')

  // ---- Detectors ---------------------------------------------------------
  type Severity = 'normal' | 'warning' | 'outlier' | 'extreme'
  type AnomalyEntry = { severity: Severity; reason: string }

  const NUMERIC_FIELDS: (keyof Account)[] = ['attempts', 'volume', 'performance', 'salary']
  const RARE_FIELDS:    (keyof Account)[] = ['status']

  /** Tukey-fence severity. `q1 - 1.5*iqr` and `q3 + 1.5*iqr` are warnings;
   *  3× IQR are outliers; 6× IQR are extreme. */
  function iqrSeverity(value: number, q1: number, q3: number): { severity: Severity; reason: string } {
    const iqr = Math.max(1e-9, q3 - q1)
    const center = (q1 + q3) / 2
    const dist = value < q1 ? q1 - value : value > q3 ? value - q3 : 0
    if (dist === 0) return { severity: 'normal', reason: '' }
    const fences = dist / iqr
    const dir = value < center ? 'low' : 'high'
    if (fences >= 6) return { severity: 'extreme', reason: `${fences.toFixed(1)}× IQR ${dir} - extreme tail` }
    if (fences >= 3) return { severity: 'outlier', reason: `${fences.toFixed(1)}× IQR ${dir} - outlier` }
    if (fences >= 1.5) return { severity: 'warning', reason: `${fences.toFixed(1)}× IQR ${dir} - warning band` }
    return { severity: 'normal', reason: '' }
  }

  function quantiles(values: number[]): { q1: number; q3: number } {
    const sorted = values.slice().sort((a, b) => a - b)
    const pick = (p: number) => {
      const ix = p * (sorted.length - 1)
      const lo = Math.floor(ix), hi = Math.ceil(ix)
      if (lo === hi) return sorted[lo]!
      return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (ix - lo)
    }
    return { q1: pick(0.25), q3: pick(0.75) }
  }

  /** Per-cell anomaly map. Re-derives whenever `rows` changes - cell
   *  reads are O(1) lookups. */
  const anomalies = $derived.by(() => {
    const map: Record<string, AnomalyEntry> = {}
    // Numeric: IQR detector per column.
    for (const field of NUMERIC_FIELDS) {
      const values = rows.map((r) => Number((r as Record<string, unknown>)[field])).filter(Number.isFinite)
      if (values.length === 0) continue
      const { q1, q3 } = quantiles(values)
      rows.forEach((row, i) => {
        const v = Number((row as Record<string, unknown>)[field])
        if (!Number.isFinite(v)) return
        const { severity, reason } = iqrSeverity(v, q1, q3)
        if (severity !== 'normal') map[`${i}:${field}`] = { severity, reason }
      })
    }
    // Categorical: rare-value detector. Anything under 2% of the dataset
    // is "anomalous"; under 1% is an outlier; one-of-a-kind is extreme.
    for (const field of RARE_FIELDS) {
      const counts = new Map<string, number>()
      for (const row of rows) {
        const v = String((row as Record<string, unknown>)[field] ?? '')
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      const total = rows.length
      rows.forEach((row, i) => {
        const v = String((row as Record<string, unknown>)[field] ?? '')
        const n = counts.get(v) ?? 0
        const p = n / total
        let severity: Severity = 'normal'
        if (n === 1)      severity = 'extreme'
        else if (p < 0.01) severity = 'outlier'
        else if (p < 0.02) severity = 'warning'
        if (severity !== 'normal') {
          map[`${i}:${field}`] = {
            severity,
            reason: `Rare value "${v}" - only ${n} of ${total} rows (${(p * 100).toFixed(1)}%)`,
          }
        }
      })
    }
    return map
  })

  const SEVERITY_ORDER: Severity[] = ['normal', 'warning', 'outlier', 'extreme']
  function passes(severity: Severity): boolean {
    return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(minSeverity)
  }

  const totalAnomalies = $derived(Object.values(anomalies).filter((a) => passes(a.severity)).length)
  const breakdown = $derived.by(() => {
    let w = 0, o = 0, e = 0
    for (const a of Object.values(anomalies)) {
      if (a.severity === 'warning') w += 1
      else if (a.severity === 'outlier') o += 1
      else if (a.severity === 'extreme') e += 1
    }
    return { w, o, e }
  })

  // ---- Cells -------------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const fmtNum   = new Intl.NumberFormat('en-US')

  const columns: ColumnDef<typeof features, Account>[] = [
    { field: 'id',          header: 'Account',  editorType: 'text',   width: 110, editable: false,
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'id', display: ctx.row.original.id }) },
    { field: 'customer',    header: 'Customer', editorType: 'text',   width: 200,
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'customer', display: ctx.row.original.customer }) },
    { field: 'region',      header: 'Region',   editorType: 'text',   width: 90,
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'region', display: ctx.row.original.region }) },
    { field: 'status',      header: 'Status',   editorType: 'text',   width: 110,
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'status', display: ctx.row.original.status }) },
    { field: 'attempts',    header: 'Login attempts', editorType: 'number', width: 130, align: 'right',
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'attempts', display: fmtNum.format(ctx.row.original.attempts) }) },
    { field: 'volume',      header: 'Monthly volume', editorType: 'number', width: 160, align: 'right',
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'volume', display: fmtMoney.format(ctx.row.original.volume) }) },
    { field: 'performance', header: 'Performance',    editorType: 'number', width: 130, align: 'right',
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'performance', display: ctx.row.original.performance + '%' }) },
    { field: 'salary',      header: 'Reported salary',editorType: 'number', width: 160, align: 'right',
      cell: (ctx) => renderSnippet(Cell, { row: ctx.row, field: 'salary', display: fmtMoney.format(ctx.row.original.salary) }) },
  ]
</script>

{#snippet Cell(props: { row: { index: number }; field: keyof Account; display: string })}
  {@const key = `${props.row.index}:${props.field}`}
  {@const entry = enabled ? anomalies[key] : undefined}
  {@const cls = entry && passes(entry.severity) ? `anomaly anomaly-${entry.severity}` : ''}
  <span class={`anom-cell ${cls}`} title={entry?.reason ?? ''}>
    {props.display}
    {#if entry && passes(entry.severity)}
      <span class="anom-dot" aria-hidden="true"></span>
    {/if}
  </span>
{/snippet}

<section class="ah-shell flex flex-col flex-1 min-h-0 gap-3">
  <div class="ah-toolbar shrink-0">
    <label class="ah-toggle">
      <input type="checkbox" bind:checked={enabled} />
      <span>Anomaly scan</span>
    </label>
    <div class="ah-sev" role="group" aria-label="Minimum severity">
      <span class="ah-sev-label">Minimum severity</span>
      <button type="button" class:on={minSeverity === 'warning'} onclick={() => (minSeverity = 'warning')}>Warning</button>
      <button type="button" class:on={minSeverity === 'outlier'} onclick={() => (minSeverity = 'outlier')}>Outlier</button>
      <button type="button" class:on={minSeverity === 'extreme'} onclick={() => (minSeverity = 'extreme')}>Extreme</button>
    </div>
    <div class="ah-stats">
      <span class="ah-pill ah-pill-w">{breakdown.w} warnings</span>
      <span class="ah-pill ah-pill-o">{breakdown.o} outliers</span>
      <span class="ah-pill ah-pill-e">{breakdown.e} extreme</span>
      <span class="ah-pill ah-pill-total">{totalAnomalies} visible</span>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={false}
    />
  </div>
</section>

<style>
  .ah-shell { height: 100%; }

  .ah-toolbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 8px 14px;
  }
  .ah-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
  .ah-sev {
    display: inline-flex; align-items: center; gap: 4px;
    border-left: 1px solid var(--sg-border, #cbd5e1);
    padding-left: 12px;
  }
  .ah-sev-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); margin-right: 6px; }
  .ah-sev button {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .ah-sev button.on {
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
    border-color: transparent;
    font-weight: 600;
  }

  .ah-stats {
    margin-left: auto;
    display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .ah-pill {
    display: inline-block; padding: 2px 9px; border-radius: 999px;
    font-size: 11px; font-weight: 600;
  }
  .ah-pill-w     { background: #fef3c7; color: #92400e; }
  .ah-pill-o     { background: #fed7aa; color: #9a3412; }
  .ah-pill-e     { background: #fee2e2; color: #991b1b; box-shadow: inset 0 0 0 1px #dc2626; }
  .ah-pill-total { background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  :global([data-theme='dark']) .ah-pill-w { background: rgba(245,158,11,0.20); color: #fbbf24; }
  :global([data-theme='dark']) .ah-pill-o { background: rgba(234,88,12,0.22);  color: #fdba74; }
  :global([data-theme='dark']) .ah-pill-e { background: rgba(239,68,68,0.22);  color: #fca5a5; box-shadow: inset 0 0 0 1px #ef4444; }

  /* Cell tints. The grid cell snippet wraps the value with `.anom-cell`;
     anomaly classes add a halo + corner dot. */
  :global(.anom-cell) {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 1px 3px; border-radius: 4px;
    position: relative;
  }
  :global(.anomaly-warning) { background: rgba(245,158,11,0.16); color: inherit; }
  :global(.anomaly-outlier) { background: rgba(234,88,12,0.22);  color: inherit; box-shadow: inset 0 0 0 1px rgba(234,88,12,0.55); }
  :global(.anomaly-extreme) { background: rgba(239,68,68,0.28);  color: inherit; box-shadow: inset 0 0 0 2px #dc2626; font-weight: 700; }
  :global(.anom-dot) {
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
    opacity: 0.8;
  }
  :global([data-theme='dark'] .anomaly-warning) { background: rgba(245,158,11,0.22); }
  :global([data-theme='dark'] .anomaly-outlier) { background: rgba(234,88,12,0.28); }
  :global([data-theme='dark'] .anomaly-extreme) { background: rgba(239,68,68,0.36); }
</style>
