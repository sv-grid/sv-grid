<script lang="ts">
  /**
   * 89. Group Panel - drag & drop grouping
   * --------------------------------------
   * A DevExpress / Kendo / AG Grid-style "drag a column here to group"
   * panel. Drag chips from the palette into the panel to group by that
   * column; drag chips inside the panel to reorder grouping levels;
   * click a chip's × to ungroup. Everything is driven by the grid's
   * imperative API - `api.setGroupBy(columnIds)` - so the same demo
   * works against any data shape with no library changes.
   *
   * The dataset is a multi-region SaaS pipeline so the multi-level
   * grouping is meaningful: try Region → Stage → Owner.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Deal = {
    id: string
    region: 'Americas' | 'EMEA' | 'APAC'
    country: string
    industry: 'SaaS' | 'Manufacturing' | 'Retail' | 'Healthcare' | 'Finance'
    stage: 'Prospecting' | 'Qualifying' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'
    owner: string
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    arr: number
    seats: number
  }

  // Tiny seeded RNG so the demo is identical on every reload.
  let prng = 0xCAFEBABE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const COUNTRIES_BY_REGION = {
    Americas: ['United States', 'Canada', 'Mexico', 'Brazil', 'Argentina'],
    EMEA:     ['United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'UAE', 'South Africa'],
    APAC:     ['Japan', 'Australia', 'Singapore', 'India', 'South Korea'],
  } as const
  const INDUSTRIES: Deal['industry'][] = ['SaaS', 'Manufacturing', 'Retail', 'Healthcare', 'Finance']
  const STAGES: Deal['stage'][] = ['Prospecting', 'Qualifying', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
  const OWNERS = [
    'Ava Thompson', 'Liam Park', 'Noah Singh', 'Emma Garcia', 'Olivia Chen',
    'Mason Rivera', 'Sophia Brown', 'Lucas Patel', 'Mia Johnson', 'Ethan Wright',
  ]
  const QUARTERS: Deal['quarter'][] = ['Q1', 'Q2', 'Q3', 'Q4']

  let rows = $state<Deal[]>(Array.from({ length: 280 }, (_, i) => {
    const region = pick(['Americas', 'EMEA', 'APAC'] as const)
    return {
      id:       `D-${(20_000 + i).toString()}`,
      region,
      country:  pick(COUNTRIES_BY_REGION[region]),
      industry: pick(INDUSTRIES),
      stage:    pick(STAGES),
      owner:    pick(OWNERS),
      quarter:  pick(QUARTERS),
      arr:      int(5_000, 480_000),
      seats:    int(3, 240),
    }
  }))

  const features = tableFeatures({
    rowSortingFeature, columnGroupingFeature, rowExpandingFeature, columnFilteringFeature,
  })

  // Columns that are eligible for grouping. (We exclude the numeric
  // metrics and the id since grouping by a unique key is pointless.)
  type Groupable = {
    id: string
    label: string
    accent: string  // chip tint - distinct per dimension so multi-level grouping is scannable
  }
  const GROUPABLE: Groupable[] = [
    { id: 'region',   label: 'Region',   accent: '#6366f1' },
    { id: 'country',  label: 'Country',  accent: '#0ea5e9' },
    { id: 'industry', label: 'Industry', accent: '#14b8a6' },
    { id: 'stage',    label: 'Stage',    accent: '#f59e0b' },
    { id: 'owner',    label: 'Owner',    accent: '#ec4899' },
    { id: 'quarter',  label: 'Quarter',  accent: '#8b5cf6' },
  ]
  const accentFor = (id: string) => GROUPABLE.find((g) => g.id === id)?.accent ?? '#94a3b8'
  const labelFor  = (id: string) => GROUPABLE.find((g) => g.id === id)?.label ?? id

  let api = $state<SvGridApi<typeof features, Deal> | null>(null)
  let grouping = $state<string[]>(['region', 'stage'])
  // Push current grouping into the grid whenever it changes. We dedupe
  // on a serialised key because setGroupBy mutates the grid's TanStack
  // state, which surfaces back through the wrapper's reactive plumbing
  // and would otherwise re-trigger this effect → infinite loop.
  let lastGroupingKey = ''
  $effect(() => {
    if (!api) return
    const key = grouping.join('|')
    if (key === lastGroupingKey) return
    lastGroupingKey = key
    api.setGroupBy(grouping)
  })

  // Pool of chips not currently in the panel.
  const palette = $derived(GROUPABLE.filter((g) => !grouping.includes(g.id)))

  // Drag state - all three slots use a single `dragId`. `dropTarget`
  // is the position in the panel where the chip would land if dropped now.
  let dragId      = $state<string | null>(null)
  let dropTarget  = $state<number | null>(null)
  let panelHot    = $state(false)  // entire panel highlights when something is being dragged

  function onDragStart(event: DragEvent, columnId: string) {
    dragId = columnId
    event.dataTransfer?.setData('text/plain', columnId)
    event.dataTransfer!.effectAllowed = 'move'
  }
  function onDragEnd() {
    dragId = null
    dropTarget = null
    panelHot = false
  }
  function onPanelDragOver(event: DragEvent) {
    if (!dragId) return
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'move'
    panelHot = true
    // If no chip-target is hovered, drop at the end.
    if (dropTarget === null) dropTarget = grouping.length
  }
  function onPanelDragLeave(event: DragEvent) {
    // Ignore leaves into child chips - only when leaving the panel itself.
    if (event.currentTarget === event.target) {
      panelHot = false
      dropTarget = null
    }
  }
  function onChipDragOver(event: DragEvent, atIndex: number) {
    if (!dragId) return
    event.preventDefault()
    event.stopPropagation()
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    // Place before this chip if cursor is in its left half, otherwise after.
    const before = event.clientX < rect.left + rect.width / 2
    dropTarget = before ? atIndex : atIndex + 1
    panelHot = true
  }
  function onPanelDrop(event: DragEvent) {
    event.preventDefault()
    if (!dragId) return
    const existing = grouping.indexOf(dragId)
    let target = dropTarget ?? grouping.length
    const next = grouping.slice()
    if (existing >= 0) {
      next.splice(existing, 1)
      if (existing < target) target--
    }
    next.splice(target, 0, dragId)
    grouping = next
    onDragEnd()
  }
  function onPaletteDrop(event: DragEvent) {
    // Dropping back onto the palette ungroups.
    event.preventDefault()
    if (!dragId) { onDragEnd(); return }
    grouping = grouping.filter((id) => id !== dragId)
    onDragEnd()
  }
  function removeChip(columnId: string) {
    grouping = grouping.filter((id) => id !== columnId)
  }
  function clearGrouping() { grouping = [] }
  function expandAll()   { api?.expandAllGroups() }
  function collapseAll() { api?.collapseAllGroups() }

  // Live KPIs for the strip - read from the grid's displayed rows so
  // they reflect the current grouping / filter state.
  let kpiTick = $state(0)
  $effect(() => {
    // re-derive after every grouping change once the grid has applied it
    const _ = grouping.length
    queueMicrotask(() => kpiTick++)
  })
  const totals = $derived.by(() => {
    const _ = kpiTick
    const all = rows
    const totalARR = all.reduce((s, r) => s + r.arr, 0)
    const won = all.filter((r) => r.stage === 'Closed Won')
    const winRate = all.length ? won.length / all.length : 0
    const avgARR = all.length ? totalARR / all.length : 0
    return {
      deals: all.length,
      arr: totalARR,
      won: won.length,
      winRate,
      avgARR,
      groupedBy: grouping.length,
    }
  })

  const usd = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}k`
                   : `$${n.toFixed(0)}`

  const columns: ColumnDef<typeof features, Deal>[] = [
    { field: 'id',       header: 'Deal',      width: 100, editable: false },
    { field: 'region',   header: 'Region',    width: 110,
      cellClass: (ctx) => `region-${String(ctx.getValue()).toLowerCase()}` },
    { field: 'country',  header: 'Country',   width: 150 },
    { field: 'industry', header: 'Industry',  width: 130 },
    { field: 'stage',    header: 'Stage',     width: 140,
      cellClass: (ctx) => {
        const v = String(ctx.getValue())
        const tone =
          v === 'Closed Won'  ? 'won' :
          v === 'Closed Lost' ? 'lost' :
          v === 'Negotiation' ? 'hot'  :
          v === 'Proposal'    ? 'warm' : 'cool'
        return `stage-cell stage-${tone}`
      } },
    { field: 'owner',    header: 'Owner',     width: 160 },
    { field: 'quarter',  header: 'Quarter',   width: 90 },
    { field: 'arr',      header: 'ARR',       width: 120, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'seats',    header: 'Seats',     width: 90,  align: 'right' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip ------------------------------------------------------------ -->
  <div class="kpi-strip shrink-0">
    <div class="kpi"><div class="kpi-label">Deals</div><div class="kpi-value">{totals.deals}</div></div>
    <div class="kpi"><div class="kpi-label">Total ARR</div><div class="kpi-value">{usd(totals.arr)}</div></div>
    <div class="kpi"><div class="kpi-label">Avg ARR</div><div class="kpi-value">{usd(totals.avgARR)}</div></div>
    <div class="kpi"><div class="kpi-label">Closed Won</div><div class="kpi-value">{totals.won}</div></div>
    <div class="kpi"><div class="kpi-label">Win rate</div><div class="kpi-value">{(totals.winRate * 100).toFixed(0)}%</div></div>
    <div class="kpi"><div class="kpi-label">Grouped by</div><div class="kpi-value accent">{totals.groupedBy} level{totals.groupedBy === 1 ? '' : 's'}</div></div>
  </div>

  <!-- Group panel ---------------------------------------------------------- -->
  <div class="gp-wrap shrink-0">
    <div class="gp-row">
      <div class="gp-label">Group panel</div>
      <div
        class="gp-panel"
        class:is-hot={panelHot}
        class:is-empty={grouping.length === 0}
        ondragover={onPanelDragOver}
        ondragleave={onPanelDragLeave}
        ondrop={onPanelDrop}
        role="list"
        aria-label="Active grouping"
      >
        {#if grouping.length === 0}
          <span class="gp-empty">Drag a chip here to group by it. Drop more to nest.</span>
        {:else}
          {#each grouping as columnId, i (columnId)}
            {#if dragId && dropTarget === i}
              <span class="gp-insert"></span>
            {/if}
            <span
              class="gp-chip is-active"
              role="listitem"
              draggable="true"
              style:--chip={accentFor(columnId)}
              ondragstart={(e) => onDragStart(e, columnId)}
              ondragend={onDragEnd}
              ondragover={(e) => onChipDragOver(e, i)}
            >
              <span class="gp-chip-step">{i + 1}</span>
              <span class="gp-chip-label">{labelFor(columnId)}</span>
              <button type="button" class="gp-chip-x"
                aria-label="Remove {labelFor(columnId)} grouping"
                onclick={() => removeChip(columnId)}>×</button>
            </span>
          {/each}
          {#if dragId && dropTarget === grouping.length}
            <span class="gp-insert"></span>
          {/if}
        {/if}
      </div>

      <div class="gp-actions">
        <button type="button" class="gp-btn" onclick={expandAll}   disabled={grouping.length === 0}>Expand</button>
        <button type="button" class="gp-btn" onclick={collapseAll} disabled={grouping.length === 0}>Collapse</button>
        <button type="button" class="gp-btn danger" onclick={clearGrouping} disabled={grouping.length === 0}>Clear</button>
      </div>
    </div>

    <div class="gp-row">
      <div class="gp-label muted">Available</div>
      <div
        class="gp-palette"
        ondragover={(e) => { if (dragId) e.preventDefault() }}
        ondrop={onPaletteDrop}
        role="list"
        aria-label="Available columns for grouping"
      >
        {#if palette.length === 0}
          <span class="gp-empty">All groupable columns are in use.</span>
        {:else}
          {#each palette as g (g.id)}
            <span
              class="gp-chip"
              role="listitem"
              draggable="true"
              style:--chip={g.accent}
              ondragstart={(e) => onDragStart(e, g.id)}
              ondragend={onDragEnd}
            >
              <span class="gp-chip-grip" aria-hidden="true">⋮⋮</span>
              <span class="gp-chip-label">{g.label}</span>
            </span>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- Grid ----------------------------------------------------------------- -->
  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={true}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  /* ---- KPI strip ----------------------------------------------------- */
  .kpi-strip {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;
  }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 12px;
  }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
               color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 18px; font-weight: 700; color: var(--sg-fg, #0f172a);
               font-variant-numeric: tabular-nums; line-height: 1.2; margin-top: 2px; }
  .kpi-value.accent { color: var(--sg-accent, #6366f1); }

  /* ---- Group panel --------------------------------------------------- */
  .gp-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(180deg,
      color-mix(in oklab, var(--sg-accent, #6366f1) 4%, var(--sg-bg, #fff)),
      var(--sg-bg, #fff));
    border-radius: 10px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .gp-row { display: flex; align-items: center; gap: 12px; }
  .gp-label {
    flex-shrink: 0; min-width: 90px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-fg, #0f172a);
  }
  .gp-label.muted { color: var(--sg-muted, #64748b); font-weight: 600; }

  .gp-panel {
    flex: 1; min-width: 0;
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    min-height: 38px; padding: 4px 8px;
    border: 1.5px dashed color-mix(in oklab, var(--sg-accent, #6366f1) 35%, transparent);
    border-radius: 8px;
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 3%, transparent);
    transition: background 120ms, border-color 120ms, box-shadow 120ms;
  }
  .gp-panel.is-hot {
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 9%, transparent);
    border-color: var(--sg-accent, #6366f1); border-style: solid;
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--sg-accent, #6366f1) 18%, transparent);
  }
  .gp-panel.is-empty .gp-empty { color: var(--sg-muted, #64748b); }
  .gp-empty { font-size: 12px; font-style: italic; padding: 0 4px; }

  .gp-palette {
    flex: 1; min-width: 0;
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    padding: 2px 0;
  }

  .gp-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 8px 4px 4px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--chip, #94a3b8) 12%, var(--sg-bg, #fff));
    border: 1px solid color-mix(in oklab, var(--chip, #94a3b8) 35%, transparent);
    color: color-mix(in oklab, var(--chip, #94a3b8) 60%, var(--sg-fg, #0f172a));
    font-size: 12px; font-weight: 600;
    cursor: grab; user-select: none;
    transition: transform 120ms, box-shadow 120ms;
  }
  .gp-chip:hover {
    box-shadow: 0 4px 10px color-mix(in oklab, var(--chip, #94a3b8) 24%, transparent);
    transform: translateY(-1px);
  }
  .gp-chip:active { cursor: grabbing; }
  .gp-chip.is-active {
    background: color-mix(in oklab, var(--chip, #94a3b8) 18%, var(--sg-bg, #fff));
    border-color: color-mix(in oklab, var(--chip, #94a3b8) 55%, transparent);
  }
  .gp-chip-step {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px;
    background: var(--chip, #94a3b8); color: #fff;
    border-radius: 999px;
    font-size: 10px; font-weight: 800;
  }
  .gp-chip-grip {
    color: color-mix(in oklab, var(--chip, #94a3b8) 60%, transparent);
    font-size: 11px; letter-spacing: -2px; cursor: grab;
  }
  .gp-chip-label { padding: 0 2px; }
  .gp-chip-x {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 999px;
    background: transparent; border: 0; cursor: pointer;
    color: inherit; font-size: 14px; line-height: 1;
    opacity: 0.55;
  }
  .gp-chip-x:hover { opacity: 1; background: color-mix(in oklab, var(--chip, #94a3b8) 25%, transparent); }

  .gp-insert {
    display: inline-block;
    width: 3px; height: 22px;
    background: var(--sg-accent, #6366f1);
    border-radius: 2px;
    box-shadow: 0 0 6px var(--sg-accent, #6366f1);
    animation: gp-pulse 600ms ease-in-out infinite alternate;
  }
  @keyframes gp-pulse { from { opacity: 0.55; } to { opacity: 1; } }

  .gp-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .gp-btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px; font-weight: 600;
    cursor: pointer;
  }
  .gp-btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.1)); }
  .gp-btn:disabled { opacity: 0.45; cursor: default; }
  .gp-btn.danger { color: #b91c1c; border-color: #fecaca; }
  .gp-btn.danger:hover:not(:disabled) { background: #fef2f2; }

  /* ---- In-grid decoration ------------------------------------------- */
  :global(td.stage-cell) {
    font-weight: 700; letter-spacing: 0.02em;
  }
  :global(td.stage-won)  { color: #166534; background: color-mix(in oklab, #16a34a 10%, transparent); }
  :global(td.stage-lost) { color: #991b1b; background: color-mix(in oklab, #dc2626 10%, transparent); }
  :global(td.stage-hot)  { color: #92400e; background: color-mix(in oklab, #f59e0b 10%, transparent); }
  :global(td.stage-warm) { color: #9a3412; background: color-mix(in oklab, #f97316 10%, transparent); }
  :global(td.stage-cool) { color: #3730a3; background: color-mix(in oklab, #6366f1 8%, transparent); }

  :global(td.region-americas) { color: #6366f1; font-weight: 600; }
  :global(td.region-emea)     { color: #14b8a6; font-weight: 600; }
  :global(td.region-apac)     { color: #ec4899; font-weight: 600; }
  /* Phone: the row is label + drop zone + Expand/Collapse/Clear. The buttons keep
     their width (and the shared layer gives them a 40px touch target), which left
     the drop zone 14px wide with its chips painting over everything. Give the zone
     a line of its own and let the chips keep their size. */
  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    .gp-row { flex-wrap: wrap; }
    .gp-panel { flex-basis: 100%; }
    .gp-chip { flex-shrink: 0; }
  }
</style>
