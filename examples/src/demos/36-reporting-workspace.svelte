<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 36. Reporting / analytics workspace
   * -----------------------------------
   * A sales pipeline through a reporting lens: group rows by one or
   * two dimensions, see live aggregates per numeric column, switch
   * aggregators (sum / avg / min / max / count), save the whole view
   * under a name, and restore it later from a sidebar.
   *
   * What this demo proves to a buyer:
   *
   *   1. **The grid IS the reporting surface.** Group-by is a built-in
   *      table feature, not a bolt-on. The same grid you use for ops
   *      becomes the pivot view by passing a `grouping` array.
   *
   *   2. **Aggregators are configurable per column.** A revenue column
   *      probably wants `sum`, a probability column wants `avg`, a
   *      deal id wants `count`. The user picks per column inside the
   *      panel - no code change to add a new aggregator.
   *
   *   3. **Saved views with localStorage persistence.** Three starter
   *      views ship by default ("Pipeline by region", "Owner
   *      performance", "Stage by region"). Users can save their own -
   *      named, time-stamped, restorable, removable. Built on the
   *      shared `createSavedViews` helper so other demos can reuse it.
   *
   *   4. **Live KPI strip** recomputes whenever the grouping / filter
   *      state changes, so the workspace feels reactive instead of
   *      "click apply to refresh."
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { createSavedViews } from '../shared/saved-views'

  // ---- Domain ----------------------------------------------------------

  type Region = 'NA' | 'EMEA' | 'APAC' | 'LATAM'
  type Stage =
    | 'discovery' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  type Segment = 'SMB' | 'Mid' | 'Enterprise'

  type Deal = {
    id: string
    customer: string
    owner: string
    region: Region
    segment: Segment
    stage: Stage
    amount: number
    probability: number
    forecast: number      // amount * probability / 100
    contractMonths: number
    closeDate: string
  }

  type Aggregator = 'sum' | 'avg' | 'min' | 'max' | 'count'

  type ViewState = {
    groupBy: string[]
    aggregators: Record<string, Aggregator>
    sortClauses: Array<{ id: string; desc: boolean }>
  }

  // ---- Seeds -----------------------------------------------------------

  const REGIONS: readonly Region[] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const STAGES: readonly Stage[] = [
    'discovery', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost',
  ]
  const SEGMENTS: readonly Segment[] = ['SMB', 'Mid', 'Enterprise']
  const OWNERS = [
    'Sasha Park', 'Jamie Chen', 'Robin Diaz', 'Casey Singh',
    'Drew Olsen', 'Avery Mehta', 'Quinn Tran', 'Reese Khan',
  ]
  const COMPANIES = [
    'Nordic Holdings', 'Pacific Industries', 'Atlas Logistics', 'Helios Group',
    'Vertex Trust', 'Quantum Resources', 'Stellar Networks', 'Apex Bio',
    'Crescent Labs', 'Sigma Capital', 'Pioneer Mining', 'Aurora Trading',
    'Granite Energy', 'Cobalt Systems', 'Meridian Materials', 'Polaris Bio',
    'Sentinel Capital', 'Tessera Partners', 'Vanguard Tech', 'Cascade Industries',
    'Beacon Mobility', 'Citadel Data', 'Frontier Foods', 'Lumen Health',
  ]

  let prng = 0x4D45474150
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedDeals(n: number): Deal[] {
    const out: Deal[] = []
    for (let i = 0; i < n; i += 1) {
      const stage = pick(STAGES)
      const amount = Math.round((10_000 + rnd() * 990_000) / 1000) * 1000
      // Probability roughly tracks stage progress.
      const stageProbability: Record<Stage, number> = {
        discovery: 10, qualified: 25, proposal: 50, negotiation: 75,
        closed_won: 100, closed_lost: 0,
      }
      const baseProb = stageProbability[stage]
      const probability = Math.max(0, Math.min(100, baseProb + Math.round((rnd() - 0.5) * 15)))
      const monthOffset = Math.floor(rnd() * 9) - 1
      const date = new Date()
      date.setMonth(date.getMonth() + monthOffset)
      date.setDate(1 + Math.floor(rnd() * 28))
      out.push({
        id: `DL-${(100_000 + i).toString(36).toUpperCase()}`,
        customer: pick(COMPANIES),
        owner: pick(OWNERS),
        region: pick(REGIONS),
        segment: pick(SEGMENTS),
        stage,
        amount,
        probability,
        forecast: Math.round((amount * probability) / 100),
        contractMonths: pick([12, 24, 36, 48]),
        closeDate: date.toISOString().slice(0, 10),
      })
    }
    return out
  }

  // ---- State -----------------------------------------------------------

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  const deals = $state<Deal[]>(seedDeals(300))

  // Dimensions a user can group by.
  const GROUPABLE: ReadonlyArray<{ id: string; label: string }> = [
    { id: 'region', label: 'Region' },
    { id: 'segment', label: 'Segment' },
    { id: 'stage', label: 'Stage' },
    { id: 'owner', label: 'Owner' },
  ]
  // Numeric columns the user can aggregate.
  const AGGREGABLE: ReadonlyArray<{ id: string; label: string; defaultAgg: Aggregator }> = [
    { id: 'amount',         label: 'Amount',         defaultAgg: 'sum' },
    { id: 'forecast',       label: 'Forecast',       defaultAgg: 'sum' },
    { id: 'probability',    label: 'Probability',    defaultAgg: 'avg' },
    { id: 'contractMonths', label: 'Contract',       defaultAgg: 'avg' },
  ]
  const AGG_OPTIONS: ReadonlyArray<{ id: Aggregator; label: string; emoji: string }> = [
    { id: 'sum',   label: 'Sum',   emoji: 'Σ' },
    { id: 'avg',   label: 'Avg',   emoji: '∅' },
    { id: 'min',   label: 'Min',   emoji: '↓' },
    { id: 'max',   label: 'Max',   emoji: '↑' },
    { id: 'count', label: 'Count', emoji: '#' },
  ]

  function defaultAggregators(): Record<string, Aggregator> {
    const map: Record<string, Aggregator> = {}
    for (const col of AGGREGABLE) map[col.id] = col.defaultAgg
    return map
  }

  let groupBy = $state<string[]>(['region'])
  let aggregators = $state<Record<string, Aggregator>>(defaultAggregators())
  let sortClauses = $state<Array<{ id: string; desc: boolean }>>([])
  let api = $state<SvGridApi<typeof features, Deal> | null>(null)
  let viewName = $state('')

  // ---- Saved views ----------------------------------------------------

  // svelte-ignore state_referenced_locally
  const views = createSavedViews<ViewState>({
    storageKey: 'sv-grid:reporting-views',
    defaults: [
      {
        name: 'Pipeline by region',
        builtIn: true,
        state: {
          groupBy: ['region'],
          aggregators: { amount: 'sum', forecast: 'sum', probability: 'avg', contractMonths: 'avg' },
          sortClauses: [],
        },
      },
      {
        name: 'Owner performance',
        builtIn: true,
        state: {
          groupBy: ['owner'],
          aggregators: { amount: 'sum', forecast: 'sum', probability: 'avg', contractMonths: 'count' },
          sortClauses: [{ id: 'forecast', desc: true }],
        },
      },
      {
        name: 'Stage × region',
        builtIn: true,
        state: {
          groupBy: ['stage', 'region'],
          aggregators: { amount: 'sum', forecast: 'sum', probability: 'avg', contractMonths: 'avg' },
          sortClauses: [],
        },
      },
    ],
  })
  let viewListVersion = $state(0)
  const viewList = $derived.by(() => {
    viewListVersion
    return views.list()
  })

  function loadView(id: string): void {
    const v = views.get(id)
    if (!v) return
    groupBy = [...v.state.groupBy]
    aggregators = { ...defaultAggregators(), ...v.state.aggregators }
    sortClauses = v.state.sortClauses.map((c) => ({ ...c }))
    api?.setGroupBy([...v.state.groupBy])
    viewName = v.builtIn ? '' : v.name
  }
  function saveCurrentView(): void {
    const name = viewName.trim()
    if (!name) return
    views.save(name, {
      groupBy: [...groupBy],
      aggregators: { ...aggregators },
      sortClauses: sortClauses.map((c) => ({ ...c })),
    })
    viewListVersion += 1
  }
  function removeView(id: string): void {
    if (views.remove(id)) viewListVersion += 1
  }

  // ---- Aggregation ----------------------------------------------------

  /**
   * Walk every deal once and bucket the numerics by the group keys
   * we're aggregating over. Returned as a Map keyed by the group-row
   * key so the grid's group rows can render their totals without
   * re-scanning.
   */
  type Aggregates = {
    count: number
    sums: Record<string, number>
    mins: Record<string, number>
    maxs: Record<string, number>
  }

  function emptyAgg(): Aggregates {
    return { count: 0, sums: {}, mins: {}, maxs: {} }
  }

  function fold(acc: Aggregates, deal: Deal): void {
    acc.count += 1
    for (const col of AGGREGABLE) {
      const n = deal[col.id as keyof Deal] as unknown as number
      if (typeof n !== 'number' || !Number.isFinite(n)) continue
      acc.sums[col.id] = (acc.sums[col.id] ?? 0) + n
      acc.mins[col.id] = Math.min(acc.mins[col.id] ?? n, n)
      acc.maxs[col.id] = Math.max(acc.maxs[col.id] ?? n, n)
    }
  }

  function applyAggregator(
    acc: Aggregates,
    columnId: string,
    aggregator: Aggregator,
  ): number {
    if (aggregator === 'count') return acc.count
    const sum = acc.sums[columnId] ?? 0
    const min = acc.mins[columnId]
    const max = acc.maxs[columnId]
    switch (aggregator) {
      case 'sum': return sum
      case 'avg': return acc.count ? sum / acc.count : 0
      case 'min': return min ?? 0
      case 'max': return max ?? 0
    }
  }

  /** key("region:NA") → totals across all deals in NA. */
  const groupAggregates = $derived.by(() => {
    const map = new Map<string, Aggregates>()
    // Grand total bucket too - keyed by ''.
    const grand = emptyAgg()
    map.set('', grand)
    for (const deal of deals) {
      fold(grand, deal)
      // Cumulative key reflects every prefix of group-by levels so a
      // row at the bottom level rolls up through every parent.
      let key = ''
      for (const dim of groupBy) {
        const v = (deal as unknown as Record<string, unknown>)[dim]
        key = key ? `${key}|${dim}:${String(v)}` : `${dim}:${String(v)}`
        let bucket = map.get(key)
        if (!bucket) {
          bucket = emptyAgg()
          map.set(key, bucket)
        }
        fold(bucket, deal)
      }
    }
    return map
  })

  // Headline KPIs (always computed from the grand bucket).
  const kpis = $derived.by(() => {
    const grand = groupAggregates.get('') ?? emptyAgg()
    const totalAmount = grand.sums.amount ?? 0
    const totalForecast = grand.sums.forecast ?? 0
    const wonCount = deals.filter((d) => d.stage === 'closed_won').length
    const avgProb = grand.count ? (grand.sums.probability ?? 0) / grand.count : 0
    const wonAmount = deals
      .filter((d) => d.stage === 'closed_won')
      .reduce((s, d) => s + d.amount, 0)
    return {
      totalAmount, totalForecast, wonAmount,
      avgProb,
      conversionRate: deals.length ? (wonCount / deals.length) * 100 : 0,
      activeCount: deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length,
    }
  })

  // ---- Toggles --------------------------------------------------------

  function toggleGroupBy(dim: string): void {
    if (groupBy.includes(dim)) {
      groupBy = groupBy.filter((d) => d !== dim)
    } else if (groupBy.length >= 2) {
      groupBy = [groupBy[1]!, dim]
    } else {
      groupBy = [...groupBy, dim]
    }
    api?.setGroupBy([...groupBy])
  }

  function setAggregator(columnId: string, aggregator: Aggregator): void {
    aggregators = { ...aggregators, [columnId]: aggregator }
  }

  // ---- Formatters ------------------------------------------------------

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
  function fmtMoneyShort(n: number): string {
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }
  function fmtPct(n: number): string {
    return `${n.toFixed(1)}%`
  }
  function fmtAggValue(columnId: string, aggregator: Aggregator, value: number): string {
    if (aggregator === 'count') return value.toLocaleString()
    if (columnId === 'amount' || columnId === 'forecast') return fmtMoneyShort(value)
    if (columnId === 'probability') return fmtPct(value)
    return value.toFixed(1)
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet RegionCell(props: { row: Deal })}
  <span class={`rw-region rw-region-${props.row.region}`}>{props.row.region}</span>
{/snippet}

{#snippet StageCell(props: { row: Deal })}
  <span class={`rw-stage rw-stage-${props.row.stage}`}>
    {props.row.stage.replace('_', ' ')}
  </span>
{/snippet}

{#snippet SegmentCell(props: { row: Deal })}
  <span class={`rw-segment rw-segment-${props.row.segment}`}>{props.row.segment}</span>
{/snippet}

{#snippet AmountCell(props: { row: Deal })}
  <span class="rw-num">{fmtMoney(props.row.amount)}</span>
{/snippet}

{#snippet ForecastCell(props: { row: Deal })}
  <span class="rw-num rw-num-em">{fmtMoney(props.row.forecast)}</span>
{/snippet}

{#snippet ProbCell(props: { row: Deal })}
  <span class="rw-prob">
    <span class="rw-prob-bar"><span class="rw-prob-fill" style={`width: ${props.row.probability}%`}></span></span>
    <span class="tabular-nums">{props.row.probability}%</span>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="rw-shell flex flex-1 min-h-0 gap-3">
  <!-- ───── LEFT SIDEBAR: saved views + aggregators ───── -->
  <aside class="rw-sidebar">
    <header class="rw-side-head">
      <span>Reporting workspace</span>
    </header>

    <section class="rw-side-block">
      <h3>Group by</h3>
      <div class="rw-chip-grid">
        {#each GROUPABLE as dim (dim.id)}
          <button
            type="button"
            class="rw-chip"
            class:rw-chip-active={groupBy.includes(dim.id)}
            onclick={() => toggleGroupBy(dim.id)}
          >
            {#if groupBy.includes(dim.id)}
              <span class="rw-chip-order">{groupBy.indexOf(dim.id) + 1}</span>
            {/if}
            {dim.label}
          </button>
        {/each}
      </div>
      <p class="rw-hint">Pick 1 or 2 dimensions. Order matters: dim 1 is the outer group.</p>
    </section>

    <section class="rw-side-block">
      <h3>Aggregators</h3>
      <div class="rw-agg-grid">
        {#each AGGREGABLE as col (col.id)}
          <div class="rw-agg-row">
            <span class="rw-agg-label">{col.label}</span>
            <span class="rw-agg-buttons">
              {#each AGG_OPTIONS as opt (opt.id)}
                <button
                  type="button"
                  class="rw-agg-btn"
                  class:rw-agg-active={aggregators[col.id] === opt.id}
                  onclick={() => setAggregator(col.id, opt.id)}
                  title={opt.label}
                >{opt.emoji}</button>
              {/each}
            </span>
          </div>
        {/each}
      </div>
    </section>

    <section class="rw-side-block rw-side-views">
      <h3>Saved views</h3>
      <div class="rw-save-row">
        <input
          type="text"
          bind:value={viewName}
          placeholder="Name this view…"
          class="rw-save-input"
        />
        <button
          type="button"
          class="rw-save-btn"
          onclick={saveCurrentView}
          disabled={!viewName.trim()}
        >Save</button>
      </div>
      <div class="rw-view-list">
        {#each viewList as view (view.id)}
          <div class="rw-view-row">
            <button
              type="button"
              class="rw-view-name"
              onclick={() => loadView(view.id)}
              title="Load this view"
            >
              {#if view.builtIn}<span class="rw-view-builtin">★</span>{/if}
              {view.name}
            </button>
            {#if !view.builtIn}
              <button
                type="button"
                class="rw-view-del"
                onclick={() => removeView(view.id)}
                title="Delete view"
              >✕</button>
            {/if}
          </div>
        {:else}
          <div class="rw-view-empty">Save the current view to get started.</div>
        {/each}
      </div>
    </section>
  </aside>

  <!-- ───── RIGHT: KPI strip + grid + summary panel ───── -->
  <div class="rw-main flex flex-col flex-1 min-h-0 gap-3">
    <div class="rw-kpi-strip">
      <div class="rw-kpi">
        <div class="rw-kpi-label">Pipeline amount</div>
        <div class="rw-kpi-value tabular-nums">{fmtMoneyShort(kpis.totalAmount)}</div>
        <div class="rw-kpi-foot">{deals.length} deals</div>
      </div>
      <div class="rw-kpi">
        <div class="rw-kpi-label">Weighted forecast</div>
        <div class="rw-kpi-value tabular-nums">{fmtMoneyShort(kpis.totalForecast)}</div>
        <div class="rw-kpi-foot">avg prob {fmtPct(kpis.avgProb)}</div>
      </div>
      <div class="rw-kpi">
        <div class="rw-kpi-label">Won (closed_won)</div>
        <div class="rw-kpi-value tabular-nums">{fmtMoneyShort(kpis.wonAmount)}</div>
        <div class="rw-kpi-foot">{fmtPct(kpis.conversionRate)} conversion</div>
      </div>
      <div class="rw-kpi">
        <div class="rw-kpi-label">Active</div>
        <div class="rw-kpi-value tabular-nums">{kpis.activeCount.toLocaleString()}</div>
        <div class="rw-kpi-foot">in-flight deals</div>
      </div>
      <div class="rw-kpi">
        <div class="rw-kpi-label">View</div>
        <div class="rw-kpi-value rw-view-shape">{groupBy.length === 0 ? 'Flat' : groupBy.join(' › ')}</div>
        <div class="rw-kpi-foot">{Object.values(aggregators).filter((a) => a !== 'sum').length} non-sum aggs</div>
      </div>
    </div>

    <div class="flex-1 min-h-0">
      <SvGrid
        data={deals}
        columns={[
          { field: 'customer', header: 'Customer', width: 200, editable: false },
          { field: 'owner', header: 'Owner', width: 160, editable: false },
          { field: 'region', header: 'Region', width: 100, editable: false,
            cell: (ctx) => renderSnippet(RegionCell, { row: ctx.row.original }) },
          { field: 'segment', header: 'Segment', width: 110, editable: false,
            cell: (ctx) => renderSnippet(SegmentCell, { row: ctx.row.original }) },
          { field: 'stage', header: 'Stage', width: 140, editable: false,
            cell: (ctx) => renderSnippet(StageCell, { row: ctx.row.original }) },
          { field: 'amount', header: 'Amount', editorType: 'number', width: 130, editable: false,
            cell: (ctx) => renderSnippet(AmountCell, { row: ctx.row.original }) },
          { field: 'forecast', header: 'Forecast', editorType: 'number', width: 130, editable: false,
            cell: (ctx) => renderSnippet(ForecastCell, { row: ctx.row.original }) },
          { field: 'probability', header: 'Win %', editorType: 'number', width: 130, editable: false,
            cell: (ctx) => renderSnippet(ProbCell, { row: ctx.row.original }) },
          { field: 'contractMonths', header: 'Months', editorType: 'number', width: 90, editable: false },
          { field: 'closeDate', header: 'Close', editorType: 'date', width: 120, editable: false },
        ] satisfies ColumnDef<typeof features, Deal>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        showGroupingControls={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(next) => {
          api = next
          next.setGroupBy([...groupBy])
          // Expand the first group so the workspace opens on data, not
          // on a stack of closed group rows.
          queueMicrotask(() => {
            const first = groupBy[0]
            if (!first) return
            const firstRow = deals[0] as Record<string, unknown> | undefined
            const firstVal = firstRow?.[first]
            if (firstVal != null) next.setRowExpanded(`${first}:${firstVal}`, true)
          })
        }}
        onSortingChange={(next) => (sortClauses = next)}
      />
    </div>

    <!-- Aggregate summary strip below the grid -->
    <div class="rw-agg-summary">
      <div class="rw-agg-summary-head">Summary · {groupBy.length === 0 ? 'all deals' : groupBy.join(' › ')}</div>
      <div class="rw-agg-summary-list">
        {#each AGGREGABLE as col (col.id)}
          {@const agg = aggregators[col.id] ?? col.defaultAgg}
          {@const grand = groupAggregates.get('')}
          {@const value = grand ? applyAggregator(grand, col.id, agg) : 0}
          <div class="rw-agg-card">
            <div class="rw-agg-card-label">{col.label}</div>
            <div class="rw-agg-card-value tabular-nums">{fmtAggValue(col.id, agg, value)}</div>
            <div class="rw-agg-card-meta">{agg}</div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .rw-shell {
    height: 100%;
  }

  /* ─── Sidebar ────────────────────────────────────────────────── */
  .rw-sidebar {
    width: 280px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .rw-side-head {
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .rw-side-block {
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .rw-side-block h3 {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin: 0 0 8px 0;
  }
  .rw-hint {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    margin: 8px 0 0 0;
  }

  /* ─── Group-by chips ─────────────────────────────────────────── */
  .rw-chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .rw-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    transition: transform 80ms;
  }
  .rw-chip:hover { transform: translateY(-1px); }
  .rw-chip-active {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: #fff;
  }
  .rw-chip-order {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px; height: 16px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.25);
    font-size: 10px;
    font-weight: 700;
  }

  /* ─── Aggregator buttons ─────────────────────────────────────── */
  .rw-agg-grid { display: flex; flex-direction: column; gap: 8px; }
  .rw-agg-row { display: flex; align-items: center; gap: 8px; }
  .rw-agg-label { flex: 1 1 0; font-size: 12px; color: var(--sg-fg, #1e293b); }
  .rw-agg-buttons {
    display: inline-flex;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 6px;
    padding: 2px;
  }
  .rw-agg-btn {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    width: 24px; height: 22px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border-radius: 4px;
  }
  .rw-agg-active {
    background: var(--sg-bg, #ffffff);
    color: var(--sg-accent, #2563eb);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  /* ─── Saved-views panel ──────────────────────────────────────── */
  .rw-side-views { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .rw-save-row { display: flex; gap: 6px; margin-bottom: 8px; }
  .rw-save-input {
    flex: 1 1 0;
    min-width: 0;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 3px 8px;
    font-size: 12px;
  }
  .rw-save-btn {
    border: 0;
    background: var(--sg-accent, #2563eb);
    color: #fff;
    border-radius: 5px;
    padding: 3px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .rw-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .rw-view-list {
    flex: 1 1 0;
    overflow: auto;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    padding-top: 4px;
  }
  .rw-view-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
  }
  .rw-view-name {
    flex: 1 1 0;
    text-align: left;
    background: transparent;
    border: 0;
    color: var(--sg-fg, #1e293b);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 4px;
  }
  .rw-view-name:hover { background: var(--sg-header-bg, #f1f5f9); }
  .rw-view-builtin { color: #ca8a04; margin-right: 4px; }
  .rw-view-del {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
  }
  .rw-view-del:hover { color: #dc2626; }
  .rw-view-empty {
    padding: 12px 6px;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }

  /* ─── KPI strip ──────────────────────────────────────────────── */
  .rw-main { min-width: 0; }
  .rw-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .rw-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .rw-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .rw-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .rw-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .rw-view-shape {
    font-size: 16px;
    color: var(--sg-accent, #2563eb);
    text-transform: capitalize;
  }

  /* ─── Cells ──────────────────────────────────────────────────── */
  :global(.rw-region) {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  :global(.rw-region-NA)    { background: #dbeafe; color: #1d4ed8; }
  :global(.rw-region-EMEA)  { background: #fce7f3; color: #9d174d; }
  :global(.rw-region-APAC)  { background: #ccfbf1; color: #115e59; }
  :global(.rw-region-LATAM) { background: #ffedd5; color: #9a3412; }
  :global([data-theme='dark'] .rw-region-NA)    { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .rw-region-EMEA)  { background: rgba(236,72,153,.18); color: #f9a8d4; }
  :global([data-theme='dark'] .rw-region-APAC)  { background: rgba(20,184,166,.18); color: #5eead4; }
  :global([data-theme='dark'] .rw-region-LATAM) { background: rgba(249,115,22,.18); color: #fdba74; }

  :global(.rw-stage) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.rw-stage-discovery)   { background: #e0e7ff; color: #3730a3; }
  :global(.rw-stage-qualified)   { background: #dbeafe; color: #1d4ed8; }
  :global(.rw-stage-proposal)    { background: #fef3c7; color: #92400e; }
  :global(.rw-stage-negotiation) { background: #fde68a; color: #78350f; }
  :global(.rw-stage-closed_won)  { background: #dcfce7; color: #166534; }
  :global(.rw-stage-closed_lost) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .rw-stage-discovery)   { background: rgba(99,102,241,.18); color: #a5b4fc; }
  :global([data-theme='dark'] .rw-stage-qualified)   { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .rw-stage-proposal)    { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .rw-stage-negotiation) { background: rgba(217,119,6,.18); color: #fcd34d; }
  :global([data-theme='dark'] .rw-stage-closed_won)  { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .rw-stage-closed_lost) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.rw-segment) {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  :global(.rw-segment-SMB)         { background: #e2e8f0; color: #475569; }
  :global(.rw-segment-Mid)         { background: #dbeafe; color: #1d4ed8; }
  :global(.rw-segment-Enterprise)  { background: #ede9fe; color: #5b21b6; }
  :global([data-theme='dark'] .rw-segment-SMB)        { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global([data-theme='dark'] .rw-segment-Mid)        { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .rw-segment-Enterprise) { background: rgba(139,92,246,.18); color: #c4b5fd; }

  :global(.rw-num) { font-variant-numeric: tabular-nums; font-weight: 600; }
  :global(.rw-num-em) { color: var(--sg-accent, #2563eb); }

  :global(.rw-prob) { display: inline-flex; align-items: center; gap: 6px; }
  :global(.rw-prob-bar) {
    position: relative;
    width: 60px; height: 6px;
    background: var(--sg-border, #e2e8f0);
    border-radius: 3px; overflow: hidden;
  }
  :global(.rw-prob-fill) {
    position: absolute; inset: 0 auto 0 0;
    background: linear-gradient(90deg, #2563eb, #22d3ee);
  }

  /* ─── Summary strip ─────────────────────────────────────────── */
  .rw-agg-summary {
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .rw-agg-summary-head {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 8px;
  }
  .rw-agg-summary-list {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .rw-agg-card {
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .rw-agg-card-label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sg-muted, #64748b);
  }
  .rw-agg-card-value {
    font-size: 18px;
    font-weight: 700;
    margin-top: 2px;
    line-height: 1.1;
  }
  .rw-agg-card-meta {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
