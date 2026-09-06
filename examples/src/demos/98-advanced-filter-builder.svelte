<script lang="ts">
  /**
   * 98. Advanced filter builder (visual query builder)
   * --------------------------------------------------
   * A Notion / Linear style filter panel, built on SvGrid's OWN advanced
   * filter rather than a bespoke one.
   *
   * The grid keeps the whole dataset (`data={allRows}`) and filters itself:
   * `<SvAdvancedFilter>` writes a predicate expression through
   * `api.setAdvancedFilter()`, and the grid applies it after its global,
   * column and facet filters. That ordering matters - swapping `data` for a
   * pre-filtered array (the obvious shortcut, and what this demo used to do)
   * silently breaks the row count, the facet value lists, exports and saved
   * views, because the grid no longer knows what it is not showing you.
   *
   * A preset is just an expression, so "saved view" is one call. The last one
   * below is only expressible with the real engine: it compares each row to an
   * aggregate over the rows that survived the other filters.
   *
   * Requires `enableAdvancedFilter()` from @svgrid/enterprise.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type GridPredicateExpr,
    type SvGridApi,
  } from '@svgrid/grid'
  import { SvAdvancedFilter, enableAdvancedFilter } from '@svgrid/enterprise'

  enableAdvancedFilter()

  type Row = {
    id: string
    company: string
    region: 'Americas' | 'EMEA' | 'APAC'
    industry: 'SaaS' | 'Manufacturing' | 'Retail' | 'Healthcare' | 'Finance'
    arr: number
    seats: number
    churnRisk: 'low' | 'medium' | 'high'
    contractEnd: string
    healthScore: number
  }

  // ---- Seed data ---------------------------------------------------------
  let prng = 0xDEC0DE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const REGIONS = ['Americas', 'EMEA', 'APAC'] as const
  const INDUSTRIES = ['SaaS', 'Manufacturing', 'Retail', 'Healthcare', 'Finance'] as const
  const RISKS = ['low', 'medium', 'high'] as const
  const COMPANY_NAMES = [
    'Helios', 'Vertex', 'Atlas', 'Quantum', 'Stellar', 'Apex', 'Crescent', 'Sigma',
    'Pioneer', 'Aurora', 'Granite', 'Cobalt', 'Meridian', 'Polaris', 'Sentinel', 'Tessera',
    'Cascade', 'Beacon', 'Wavelength', 'Lumen', 'Echo', 'Cipher', 'Nimbus', 'Caldera',
    'Sterling', 'Onyx', 'Slate', 'Ember', 'Verdant', 'Halcyon',
  ]
  const SUFFIXES = ['Labs', 'Group', 'Holdings', 'Industries', 'Systems', 'Capital', 'Partners', 'Networks']

  let allRows: Row[] = Array.from({ length: 250 }, (_, i) => {
    const yearOffset = int(0, 18) // contract ends 0-18 months from now
    const d = new Date(); d.setMonth(d.getMonth() + yearOffset)
    return {
      id: `ACC-${(1000 + i).toString()}`,
      company:    `${pick(COMPANY_NAMES)} ${pick(SUFFIXES)}`,
      region:     pick(REGIONS),
      industry:   pick(INDUSTRIES),
      arr:        int(5_000, 480_000),
      seats:      int(3, 240),
      churnRisk:  pick(RISKS),
      contractEnd:d.toISOString().slice(0, 10),
      healthScore: int(15, 99),
    }
  })

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // `editorType` is what tells the filter UI which operators a column offers -
  // numeric ranges for ARR, date comparison for contractEnd, text for the rest.
  const columns: GridColumns<Row> = [
    { field: 'id',          header: 'Account',      width: 110, editable: false },
    { field: 'company',     header: 'Company',      width: 200, editable: false },
    { field: 'region',      header: 'Region',       width: 110, editable: false },
    { field: 'industry',    header: 'Industry',     width: 130, editable: false },
    { field: 'arr',         header: 'ARR',          width: 130, align: 'right', editable: false, editorType: 'number',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'seats',       header: 'Seats',        width:  90, align: 'right', editable: false, editorType: 'number' },
    { field: 'churnRisk',   header: 'Churn risk',   width: 110, editable: false,
      cellClass: (ctx) => `risk-${ctx.getValue()}` },
    { field: 'contractEnd', header: 'Contract end', width: 130, editable: false, editorType: 'date' },
    { field: 'healthScore', header: 'Health',       width: 110, align: 'right', editable: false, editorType: 'number' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let matches = $state(allRows.length)
  let activePreset = $state<string | null>(null)
  // Bound to the panel, so a preset drives what the panel SHOWS as well as what
  // the grid filters. Calling api.setAdvancedFilter() directly would filter the
  // grid while the panel kept displaying its own stale draft.
  let expression = $state<GridPredicateExpr | null>(null)

  function refreshStats() {
    matches = api?.getDisplayedRows().length ?? allRows.length
  }

  function applyPreset(name: string, expr: GridPredicateExpr) {
    activePreset = name
    expression = expr
    api?.setAdvancedFilter(expr)
    queueMicrotask(refreshStats)
  }

  function clearAll() {
    activePreset = null
    expression = null
    api?.clearAdvancedFilter()
    queueMicrotask(refreshStats)
  }

  // ---- Presets, written directly as predicate expressions ----------------
  const isoInDays = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  const PRESETS: Array<{ name: string; label: string; expr: GridPredicateExpr }> = [
    {
      name: 'at-risk',
      label: 'At-risk EMEA accounts',
      expr: {
        kind: 'and',
        parts: [
          { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' },
          { kind: 'cmp', column: 'churnRisk', op: 'in', value: ['medium', 'high'] },
          { kind: 'cmp', column: 'arr', op: 'greaterThan', value: '50000' },
        ],
      },
    },
    {
      name: 'expiring',
      label: 'Expiring contracts (90 days)',
      // This demo used to carry a bespoke "within N days" operator. A date
      // range says the same thing with the standard set: ISO dates compare
      // lexicographically, so `between` orders them chronologically.
      expr: {
        kind: 'and',
        parts: [
          { kind: 'cmp', column: 'contractEnd', op: 'between', value: isoInDays(0), valueTo: isoInDays(90) },
          { kind: 'cmp', column: 'healthScore', op: 'lessThan', value: '60' },
        ],
      },
    },
    {
      name: 'top',
      label: 'Top accounts (ARR or seats)',
      expr: {
        kind: 'or',
        parts: [
          { kind: 'cmp', column: 'arr', op: 'greaterThan', value: '300000' },
          { kind: 'cmp', column: 'seats', op: 'greaterThan', value: '150' },
        ],
      },
    },
    {
      name: 'nested',
      label: 'EMEA, or big APAC at risk',
      // A group nested inside the top-level OR. The flat builder could not show
      // this - it fell back to text mode - so open the Builder tab on this one
      // to see the nested group with its own AND.
      expr: {
        kind: 'or',
        parts: [
          { kind: 'cmp', column: 'region', op: 'equals', value: 'EMEA' },
          {
            kind: 'and',
            parts: [
              { kind: 'cmp', column: 'region', op: 'equals', value: 'APAC' },
              { kind: 'cmp', column: 'arr', op: 'greaterThan', value: '250000' },
              { kind: 'cmp', column: 'churnRisk', op: 'equals', value: 'high' },
            ],
          },
        ],
      },
    },
    {
      name: 'above-average',
      label: 'ARR above the current average',
      // Not expressible as a column filter at all: it compares each row to an
      // aggregate over the rows still showing. The engine folds that average
      // once per filter change rather than once per row.
      expr: {
        kind: 'scalarCmp',
        left: { kind: 'col', id: 'arr' },
        op: '>',
        right: { kind: 'agg', fn: 'avg', column: 'arr' },
      },
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Presets bar --------------------------------------------------- -->
  <div class="preset-bar shrink-0">
    <span class="preset-label">Quick views:</span>
    {#each PRESETS as p (p.name)}
      <button
        class={`preset ${activePreset === p.name ? 'is-on' : ''}`}
        onclick={() => applyPreset(p.name, p.expr)}
      >{p.label}</button>
    {/each}
    <button class="preset" onclick={clearAll}>Clear</button>
    <div class="preset-spacer"></div>
    <div class="match-stat">
      Matches: <strong>{matches}</strong> / {allRows.length}
    </div>
  </div>

  <!-- The grid's own filter panel ----------------------------------- -->
  {#if api}
    <div class="builder shrink-0">
      <SvAdvancedFilter
        {api}
        bind:expression
        onApply={() => {
          activePreset = null
          queueMicrotask(refreshStats)
        }}
      />
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid
      columnResize
      data={allRows}
      {columns}
      {features}
      onApiReady={(a) => { api = a; refreshStats() }}
      onAdvancedFilterChange={(expr) => {
        // The grid can clear the filter itself, from the toolbar chip. Without
        // this the grid would unfilter while the panel kept showing "Active"
        // and this counter kept the old number.
        expression = expr
        if (expr == null) activePreset = null
        queueMicrotask(refreshStats)
      }}
      containerHeight="100%"
    />
  </div>
</section>

<style>
  /* ---- Preset bar ---- */
  .preset-bar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 12px;
  }
  .preset-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
  }
  .preset {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 999px; padding: 4px 12px; font-size: 12px;
    font-weight: 600; cursor: pointer;
  }
  .preset:hover {
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 8%, transparent);
    border-color: var(--sg-accent, #6366f1);
  }
  .preset.is-on {
    background: var(--sg-accent, #6366f1);
    border-color: var(--sg-accent, #6366f1);
    color: var(--sg-on-accent, #fff);
  }
  .preset-spacer { flex: 1; }
  .match-stat {
    font-size: 13px; color: var(--sg-fg, #0f172a);
    font-variant-numeric: tabular-nums;
  }
  .match-stat strong { color: var(--sg-accent, #6366f1); font-size: 16px; }

  /* ---- Builder shell ---- */
  .builder {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(180deg, color-mix(in oklab, var(--sg-accent, #6366f1) 4%, var(--sg-bg, #fff)), var(--sg-bg, #fff));
    border-radius: 10px; padding: 10px 12px;
  }

  /* ---- Risk pills, set via cellClass ---- */
  :global(.risk-high) { color: #dc2626; font-weight: 600; }
  :global(.risk-medium) { color: #d97706; font-weight: 600; }
  :global(.risk-low) { color: #059669; }
</style>
