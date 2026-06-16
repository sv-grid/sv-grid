<script lang="ts">
  /**
   * 80. Cell types showcase - Vendor scorecard
   * ------------------------------------------
   * Real procurement use case (annual vendor review) wired through every
   * cell type SvGrid ships:
   *
   *   Built-in editors: text, number (currency), date, checkbox, list, chips
   *   Custom snippets:  color swatch (brand), 5-star rating (performance),
   *                     mood feedback (sentiment), progress bar (delivery
   *                     against commitments), status badge, owner avatar.
   *
   * Snippet columns set `editable: false` so the grid doesn't try to start
   * an editor on click - the snippet's own controls handle writes through
   * `api.setCellValue`. Inner click handlers stop propagation so the cell
   * click doesn't fight the snippet input. The result: every cell type
   * usable in the same row, no edit-mode flicker.
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

  type Mood = 'positive' | 'neutral' | 'concerned' | 'critical' | null
  type Status = 'active' | 'under_review' | 'at_risk' | 'sunset'
  type Tier = 'strategic' | 'preferred' | 'approved' | 'trial'

  type Vendor = {
    id: string
    name: string                  // text
    contractValueUSD: number      // currency
    renewalDate: string           // date
    ndaOnFile: boolean            // checkbox
    tier: Tier                    // list
    categories: string[]          // chips
    brandColor: string            // color picker
    performance: number           // 5-star rating (0-5)
    sentiment: Mood               // mood feedback
    commitmentsMet: number        // progress bar (0-100)
    status: Status                // status badge
    accountManager: string        // avatar
  }

  const TIER_OPTIONS = ['strategic', 'preferred', 'approved', 'trial'] as const
  const STATUS_OPTIONS: readonly Status[] = ['active', 'under_review', 'at_risk', 'sunset'] as const
  const CATEGORY_OPTIONS = [
    'cloud', 'security', 'observability', 'data', 'devtools', 'finance',
    'analytics', 'collaboration', 'compliance', 'identity', 'ml/ai', 'networking',
  ]
  const MOODS: { id: NonNullable<Mood>; glyph: string; label: string }[] = [
    { id: 'positive',  glyph: '😊', label: 'Positive review' },
    { id: 'neutral',   glyph: '😐', label: 'Neutral' },
    { id: 'concerned', glyph: '😟', label: 'Concerned' },
    { id: 'critical',  glyph: '😠', label: 'Critical concerns' },
  ]
  const TIER_LABEL: Record<Tier, string> = {
    strategic: 'Strategic', preferred: 'Preferred', approved: 'Approved', trial: 'Trial',
  }
  const STATUS_LABEL: Record<Status, string> = {
    active: 'Active', under_review: 'Under review', at_risk: 'At risk', sunset: 'Sunset',
  }

  let rows = $state<Vendor[]>([
    { id: 'v01', name: 'Helios Cloud',          contractValueUSD: 1_240_000, renewalDate: '2026-09-30', ndaOnFile: true,  tier: 'strategic', categories: ['cloud','security','observability'], brandColor: '#ef4444', performance: 4, sentiment: 'positive',  commitmentsMet: 92, status: 'active',       accountManager: 'Priya Nair' },
    { id: 'v02', name: 'Vertex Observability',  contractValueUSD:   485_000, renewalDate: '2026-07-15', ndaOnFile: true,  tier: 'preferred', categories: ['observability','analytics'],       brandColor: '#0ea5e9', performance: 5, sentiment: 'positive',  commitmentsMet: 98, status: 'active',       accountManager: 'Jordan Wu' },
    { id: 'v03', name: 'Atlas Identity',        contractValueUSD:   320_000, renewalDate: '2026-11-01', ndaOnFile: true,  tier: 'strategic', categories: ['identity','security','compliance'], brandColor: '#a855f7', performance: 4, sentiment: 'neutral',   commitmentsMet: 78, status: 'under_review', accountManager: 'Sasha Park' },
    { id: 'v04', name: 'Nordic DataWarehouse',  contractValueUSD:   215_000, renewalDate: '2026-06-22', ndaOnFile: true,  tier: 'preferred', categories: ['data','analytics'],                 brandColor: '#10b981', performance: 3, sentiment: 'neutral',   commitmentsMet: 65, status: 'under_review', accountManager: 'Avery Mehta' },
    { id: 'v05', name: 'Pacific DevTools',      contractValueUSD:   148_000, renewalDate: '2026-08-12', ndaOnFile: false, tier: 'approved',  categories: ['devtools','collaboration'],         brandColor: '#f59e0b', performance: 3, sentiment: 'neutral',   commitmentsMet: 70, status: 'active',       accountManager: 'Drew Olsen' },
    { id: 'v06', name: 'Quantum ML Platform',   contractValueUSD:    92_500, renewalDate: '2026-07-04', ndaOnFile: true,  tier: 'approved',  categories: ['ml/ai','data'],                     brandColor: '#6366f1', performance: 4, sentiment: 'positive',  commitmentsMet: 88, status: 'active',       accountManager: 'Casey Singh' },
    { id: 'v07', name: 'Sigma Finance Suite',   contractValueUSD:    74_000, renewalDate: '2026-12-31', ndaOnFile: true,  tier: 'preferred', categories: ['finance','compliance'],             brandColor: '#dc2626', performance: 2, sentiment: 'concerned', commitmentsMet: 42, status: 'at_risk',      accountManager: 'Jamie Chen' },
    { id: 'v08', name: 'Crescent Compliance',   contractValueUSD:    58_500, renewalDate: '2026-08-30', ndaOnFile: true,  tier: 'approved',  categories: ['compliance','security'],            brandColor: '#0284c7', performance: 4, sentiment: 'positive',  commitmentsMet: 95, status: 'active',       accountManager: 'Robin Diaz' },
    { id: 'v09', name: 'Stellar Networks',      contractValueUSD:    36_200, renewalDate: '2026-09-20', ndaOnFile: false, tier: 'trial',     categories: ['networking'],                       brandColor: '#16a34a', performance: 1, sentiment: 'critical',  commitmentsMet: 18, status: 'at_risk',      accountManager: 'Sasha Park' },
    { id: 'v10', name: 'Apex Bio Analytics',    contractValueUSD:    24_750, renewalDate: '2026-10-15', ndaOnFile: false, tier: 'trial',     categories: ['analytics','ml/ai'],                brandColor: '#ec4899', performance: 3, sentiment: 'neutral',   commitmentsMet: 55, status: 'under_review', accountManager: 'Casey Singh' },
    { id: 'v11', name: 'Pioneer Storage',       contractValueUSD:    19_900, renewalDate: '2026-05-30', ndaOnFile: true,  tier: 'approved',  categories: ['cloud','data'],                     brandColor: '#475569', performance: 2, sentiment: 'concerned', commitmentsMet: 38, status: 'sunset',       accountManager: 'Drew Olsen' },
    { id: 'v12', name: 'Aurora Collaboration',  contractValueUSD:    11_400, renewalDate: '2026-06-01', ndaOnFile: true,  tier: 'approved',  categories: ['collaboration','devtools'],         brandColor: '#7c3aed', performance: 5, sentiment: 'positive',  commitmentsMet: 100, status: 'active',      accountManager: 'Jamie Chen' },
  ])

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })
  let api = $state<SvGridApi<typeof features, Vendor> | null>(null)
  let groupBy = $state<string[]>([])

  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }

  // ---- KPI derivations ---------------------------------------------------

  const totalSpend = $derived(rows.reduce((a, r) => a + r.contractValueUSD, 0))
  const avgPerf    = $derived(rows.reduce((a, r) => a + r.performance, 0) / rows.length)
  const atRiskN    = $derived(rows.filter((r) => r.status === 'at_risk').length)
  const strategicN = $derived(rows.filter((r) => r.tier === 'strategic').length)
  const ndaGapN    = $derived(rows.filter((r) => !r.ndaOnFile).length)

  const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const fmtNum = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

  // ---- Columns -----------------------------------------------------------

  // Every column is editable. Built-in editors handle each cell type;
  // a `cell` snippet adds the polished read-only display where the raw
  // value would look bland (chips, badges, swatches, etc.).
  const SENTIMENT_OPTIONS = MOODS.map((m) => ({ value: m.id, label: `${m.glyph} ${m.label}` }))
  const STATUS_DROPDOWN = STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))
  const TIER_DROPDOWN = TIER_OPTIONS.map((t) => ({ value: t, label: TIER_LABEL[t] }))
  const MANAGERS = Array.from(new Set(rows.map((r) => r.accountManager))).sort()

  const columns: ColumnDef<typeof features, Vendor>[] = [
    { field: 'name', header: 'Vendor', editorType: 'text', width: 180 },
    { field: 'contractValueUSD', header: 'Annual contract', editorType: 'number', width: 150,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'renewalDate', header: 'Renewal', editorType: 'date', width: 130,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'ndaOnFile', header: 'NDA', editorType: 'checkbox', width: 70 },
    { field: 'tier', header: 'Tier',
      editorType: 'list', editorOptions: TIER_DROPDOWN, width: 130,
      cell: (ctx) => renderSnippet(TierCell, { row: ctx.row.original }) },
    { field: 'categories', header: 'Categories',
      editorType: 'chips', editorOptions: CATEGORY_OPTIONS, editorMultiple: true, width: 260,
      cell: (ctx) => renderSnippet(CategoriesCell, { row: ctx.row.original }) },
    { field: 'brandColor', header: 'Brand',
      editorType: 'color', width: 130,
      cell: (ctx) => renderSnippet(BrandCell, { row: ctx.row.original }) },
    { field: 'performance', header: 'Performance',
      editorType: 'rating', width: 150,
      cell: (ctx) => renderSnippet(PerformanceCell, { row: ctx.row.original }) },
    { field: 'sentiment', header: 'Sentiment',
      editorType: 'list', editorOptions: SENTIMENT_OPTIONS, width: 170,
      cell: (ctx) => renderSnippet(SentimentCell, { row: ctx.row.original }) },
    { field: 'commitmentsMet', header: 'Commitments met',
      editorType: 'number', width: 180,
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
      cell: (ctx) => renderSnippet(CommitmentsCell, { row: ctx.row.original }) },
    { field: 'status', header: 'Status',
      editorType: 'list', editorOptions: STATUS_DROPDOWN, width: 150,
      cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
    { field: 'accountManager', header: 'Account manager',
      editorType: 'list', editorOptions: MANAGERS, width: 200,
      cell: (ctx) => renderSnippet(OwnerCell, { row: ctx.row.original }) },
  ]

  function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
  }
  function avatarColor(name: string): string {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
    return `hsl(${h % 360}deg 65% 50%)`
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet TierCell(props: { row: Vendor })}
  <span class={`vs-tier vs-tier-${props.row.tier}`}>{TIER_LABEL[props.row.tier]}</span>
{/snippet}

{#snippet CategoriesCell(props: { row: Vendor })}
  <span class="vs-tags">
    {#each props.row.categories as t (t)}
      <span class="vs-tag">{t}</span>
    {/each}
  </span>
{/snippet}

{#snippet BrandCell(props: { row: Vendor })}
  <span class="vs-brand">
    <span class="vs-brand-chip" style={`background: ${props.row.brandColor}`}></span>
    <code class="vs-brand-hex">{props.row.brandColor}</code>
  </span>
{/snippet}

{#snippet PerformanceCell(props: { row: Vendor })}
  <span class="vs-stars" aria-label={`${props.row.performance} of 5`}>
    {#each [1,2,3,4,5] as n (n)}
      <span class={`vs-star ${props.row.performance >= n ? 'vs-star-on' : ''}`} aria-hidden="true">★</span>
    {/each}
  </span>
{/snippet}

{#snippet SentimentCell(props: { row: Vendor })}
  {@const m = MOODS.find((x) => x.id === props.row.sentiment)}
  <span class="vs-mood-display" title={m?.label ?? 'Not set'}>
    {#if m}
      <span class="vs-mood-glyph">{m.glyph}</span>
      <span class="vs-mood-text">{m.label}</span>
    {:else}
      <span class="vs-mood-empty">Not set</span>
    {/if}
  </span>
{/snippet}

{#snippet CommitmentsCell(props: { row: Vendor })}
  <span class="vs-progress">
    <span class="vs-progress-bar">
      <span class="vs-progress-fill"
        style={`width: ${props.row.commitmentsMet}%; background: ${
          props.row.commitmentsMet >= 80 ? '#16a34a'
          : props.row.commitmentsMet >= 60 ? '#0ea5e9'
          : props.row.commitmentsMet >= 40 ? '#f59e0b'
          : '#dc2626'
        }`}></span>
    </span>
    <span class="vs-progress-pct tabular-nums">{props.row.commitmentsMet}%</span>
  </span>
{/snippet}

{#snippet StatusCell(props: { row: Vendor })}
  <span class={`vs-status-pill vs-status-${props.row.status}`}>{STATUS_LABEL[props.row.status]}</span>
{/snippet}

{#snippet OwnerCell(props: { row: Vendor })}
  <span class="vs-owner">
    <span class="vs-avatar" style={`background: ${avatarColor(props.row.accountManager)}`}>{initials(props.row.accountManager)}</span>
    <span class="vs-owner-name">{props.row.accountManager}</span>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="vs-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="vs-kpi-strip shrink-0">
    <div class="vs-kpi">
      <div class="vs-kpi-label">Annual spend</div>
      <div class="vs-kpi-value tabular-nums">{fmtUSD.format(totalSpend)}</div>
      <div class="vs-kpi-foot">{rows.length} active vendors</div>
    </div>
    <div class="vs-kpi">
      <div class="vs-kpi-label">Avg performance</div>
      <div class="vs-kpi-value tabular-nums">{fmtNum.format(avgPerf)}<span class="vs-kpi-unit"> / 5</span></div>
      <div class="vs-kpi-foot">last quarterly review</div>
    </div>
    <div class="vs-kpi vs-kpi-warn">
      <div class="vs-kpi-label">At risk</div>
      <div class="vs-kpi-value tabular-nums">{atRiskN}</div>
      <div class="vs-kpi-foot">flagged for procurement</div>
    </div>
    <div class="vs-kpi">
      <div class="vs-kpi-label">Strategic</div>
      <div class="vs-kpi-value tabular-nums">{strategicN}</div>
      <div class="vs-kpi-foot">tier-1 partners</div>
    </div>
    <div class="vs-kpi vs-kpi-warn">
      <div class="vs-kpi-label">NDA gaps</div>
      <div class="vs-kpi-value tabular-nums">{ndaGapN}</div>
      <div class="vs-kpi-foot">legal follow-up</div>
    </div>
  </div>

  <!-- Group / instruction strip -->
  <div class="vs-toolbar shrink-0">
    <span class="vs-toolbar-label">Group by:</span>
    <button type="button" class="vs-btn {groupBy.length === 0 ? 'vs-btn-on' : ''}" onclick={() => applyGroup([])}>None</button>
    <button type="button" class="vs-btn {groupBy.join() === 'tier' ? 'vs-btn-on' : ''}" onclick={() => applyGroup(['tier'])}>Tier</button>
    <button type="button" class="vs-btn {groupBy.join() === 'status' ? 'vs-btn-on' : ''}" onclick={() => applyGroup(['status'])}>Status</button>
    <button type="button" class="vs-btn {groupBy.join() === 'accountManager' ? 'vs-btn-on' : ''}" onclick={() => applyGroup(['accountManager'])}>Account manager</button>
    <span class="vs-toolbar-hint">
      Every cell type sv-grid ships, in one realistic enterprise grid. Built-in editors (text, currency, date, checkbox, list, chips) are double-click-to-edit; the rest are direct controls.
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showGroupingControls={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .vs-shell { height: 100%; }

  /* KPI strip */
  .vs-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .vs-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .vs-kpi-warn { border-left: 3px solid #f59e0b; }
  .vs-kpi-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .vs-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--sg-fg, #0f172a); }
  .vs-kpi-unit  { font-size: 12px; font-weight: 500; color: var(--sg-muted, #94a3b8); }
  .vs-kpi-foot  { font-size: 11px; color: var(--sg-muted, #94a3b8); }

  /* Toolbar */
  .vs-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; }
  .vs-toolbar-label { font-weight: 600; color: var(--sg-fg, #0f172a); }
  .vs-toolbar-hint  { margin-left: auto; color: var(--sg-muted, #64748b); font-size: 12px; max-width: 60%; text-align: right; }
  .vs-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 13px;
    cursor: pointer;
  }
  .vs-btn:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .vs-btn-on {
    background: var(--sg-accent, #2563eb);
    color: #fff;
    border-color: transparent;
    font-weight: 600;
  }

  /* Tier pills */
  :global(.vs-tier) {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  :global(.vs-tier-strategic) { background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; }
  :global(.vs-tier-preferred) { background: #dbeafe; color: #1e3a8a; }
  :global(.vs-tier-approved)  { background: #f1f5f9; color: #334155; }
  :global(.vs-tier-trial)     { background: #fef3c7; color: #92400e; }
  :global([data-theme='dark'] .vs-tier-preferred) { background: rgba(59,130,246,0.20); color: #93c5fd; }
  :global([data-theme='dark'] .vs-tier-approved)  { background: rgba(148,163,184,0.18); color: #cbd5e1; }
  :global([data-theme='dark'] .vs-tier-trial)     { background: rgba(245,158,11,0.20); color: #fbbf24; }

  /* Category chips */
  :global(.vs-tags) { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  :global(.vs-tag) {
    display: inline-block; padding: 1px 8px; border-radius: 999px;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #0f172a);
    font-size: 11px;
    border: 1px solid var(--sg-border, #e2e8f0);
  }

  /* Brand color (read-only display; editor handles edit mode) */
  :global(.vs-brand) {
    display: inline-flex; align-items: center; gap: 8px;
  }
  :global(.vs-brand-chip) {
    width: 22px; height: 22px; border-radius: 6px;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18);
  }
  :global(.vs-brand-hex) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }

  /* Star rating (read-only display) */
  :global(.vs-stars) { display: inline-flex; gap: 2px; }
  :global(.vs-star)  {
    color: #cbd5e1; font-size: 18px; line-height: 1;
  }
  :global(.vs-star-on) { color: #f59e0b; }

  /* Mood feedback (read-only display) */
  :global(.vs-mood-display) {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px;
    color: var(--sg-fg, #0f172a);
  }
  :global(.vs-mood-glyph) { font-size: 16px; line-height: 1; }
  :global(.vs-mood-text)  { color: var(--sg-muted, #64748b); }
  :global(.vs-mood-empty) {
    font-size: 11px; color: var(--sg-muted, #94a3b8);
    font-style: italic;
  }

  /* Progress bar (read-only display) */
  :global(.vs-progress) {
    display: inline-flex; align-items: center; gap: 8px; width: 100%;
  }
  :global(.vs-progress-bar) {
    flex: 1; min-width: 50px;
    height: 8px; border-radius: 999px;
    background: var(--sg-header-bg, #f1f5f9);
    overflow: hidden;
  }
  :global(.vs-progress-fill) { display: block; height: 100%; border-radius: 999px; transition: width 120ms linear; }
  :global(.vs-progress-pct) { font-size: 11px; font-weight: 700; color: var(--sg-muted, #64748b); min-width: 36px; text-align: right; }

  /* Status badge (read-only display) */
  :global(.vs-status-pill) {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  }
  :global(.vs-status-active)        { background: #dcfce7; color: #166534; }
  :global(.vs-status-under_review)  { background: #fef3c7; color: #92400e; }
  :global(.vs-status-at_risk)       { background: #fee2e2; color: #991b1b; box-shadow: inset 0 0 0 1px #dc2626; }
  :global(.vs-status-sunset)        { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark'] .vs-status-active)       { background: rgba(34,197,94,0.18); color: #4ade80; }
  :global([data-theme='dark'] .vs-status-under_review) { background: rgba(245,158,11,0.20); color: #fbbf24; }
  :global([data-theme='dark'] .vs-status-at_risk)      { background: rgba(239,68,68,0.22); color: #fca5a5; box-shadow: inset 0 0 0 1px #ef4444; }
  :global([data-theme='dark'] .vs-status-sunset)       { background: rgba(148,163,184,0.18); color: #cbd5e1; }

  /* Owner / account manager avatar */
  :global(.vs-owner) { display: inline-flex; align-items: center; gap: 8px; }
  :global(.vs-avatar) {
    width: 28px; height: 28px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 11px;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22);
    flex-shrink: 0;
  }
  :global(.vs-owner-name) { font-size: 13px; color: var(--sg-fg, #0f172a); }
</style>
