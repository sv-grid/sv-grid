<script lang="ts">
  /**
   * 54. Columns hierarchy + manager
   * --------------------------------
   * A real production pattern for grids with too many columns to fit
   * comfortably on screen. The left panel exposes the column tree
   * itself: every group has a chevron + checkbox, every leaf has a
   * checkbox. Toggle a group's chevron to "collapse it into a single
   * summary column" - the children disappear from the grid, replaced
   * by one synthetic column showing the group's most-load-bearing
   * value. Toggle a checkbox to hide / show a leaf or an entire
   * subtree.
   *
   * What the demo proves:
   *
   *   1. **Real nested column-group headers** - the grid renders one
   *      `<tr>` per depth, with proper colSpan. Same machinery the
   *      pivot demo uses.
   *
   *   2. **Dynamic column trees.** The columns prop is a $derived
   *      computed from a small `treeState` $state. Every checkbox
   *      and chevron in the side panel triggers a re-derivation; the
   *      grid swaps its column tree in place.
   *
   *   3. **Group "summary" columns.** When a group is collapsed,
   *      rather than hiding it outright, the demo emits one synthetic
   *      column with a summary cell snippet. This is the pattern
   *      every reporting grid eventually wants.
   *
   *   4. **Reorder via the side panel.** Drag a leaf chip between
   *      siblings within a group; the column order updates live.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type Stage = 'qualify' | 'discover' | 'propose' | 'negotiate' | 'won' | 'lost'
  type Health = 'green' | 'yellow' | 'red'

  type Deal = {
    id: string
    company: string
    industry: string
    region: 'NA' | 'EMEA' | 'APAC' | 'LATAM'
    stage: Stage
    owner: string
    age: number
    arr: number
    probability: number
    currency: 'USD' | 'EUR' | 'GBP'
    lastTouch: string
    nextStep: string
    health: Health
  }

  // ---- Seed -----------------------------------------------------------

  const COMPANIES = [
    'Northwind Logistics', 'Helios Holdings', 'Vertex Trust', 'Pacific Industries',
    'Atlas Group', 'Stellar Networks', 'Quantum Bio', 'Apex Resources',
    'Crescent Labs', 'Polaris Systems', 'Aurora Materials', 'Sigma Capital',
    'Pioneer Mining', 'Granite Markets', 'Cobalt Engineering', 'Sentinel Health',
    'Tessera Energy', 'Vanguard Foods', 'Cascade Bio', 'Meridian Retail',
  ]
  const INDUSTRIES = ['SaaS', 'Manufacturing', 'Logistics', 'Financial Services', 'Healthcare', 'Energy']
  const REGIONS: readonly Deal['region'][] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const STAGES: readonly Stage[] = ['qualify', 'discover', 'propose', 'negotiate', 'won', 'lost']
  const OWNERS = ['S. Park', 'J. Chen', 'R. Diaz', 'C. Singh', 'D. Olsen', 'M. Tran']
  const NEXT_STEPS = [
    'Schedule discovery call', 'Send ROI brief', 'Walk through pricing',
    'Resolve legal redlines', 'Kickoff onboarding', 'Loss debrief',
  ]
  const CURRENCIES: readonly Deal['currency'][] = ['USD', 'EUR', 'GBP']
  const HEALTHS: readonly Health[] = ['green', 'yellow', 'red']

  let prng = 0xC0FFEE54 >>> 0
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seed(): Deal[] {
    return COMPANIES.map((c, i) => ({
      id: `D-${1000 + i}`,
      company: c,
      industry: pick(INDUSTRIES),
      region: pick(REGIONS),
      stage: pick(STAGES),
      owner: pick(OWNERS),
      age: 3 + Math.floor(rnd() * 60),
      arr: Math.round((50_000 + rnd() * 950_000) / 1000) * 1000,
      probability: 5 + Math.floor(rnd() * 95),
      currency: pick(CURRENCIES),
      lastTouch: new Date(Date.now() - Math.floor(rnd() * 60) * 86_400_000).toISOString().slice(0, 10),
      nextStep: pick(NEXT_STEPS),
      health: pick(HEALTHS),
    }))
  }

  // ---- Column hierarchy state ----------------------------------------

  type LeafSpec = {
    id: string
    field: keyof Deal & string
    label: string
    width: number
    align?: 'right' | 'center'
  }
  type GroupSpec = {
    id: string
    label: string
    leaves: LeafSpec[]
    /** Cell snippet to render when the group is collapsed - we hand
     *  the row to the snippet so it can pick the most-load-bearing
     *  value for the column. */
    summaryLabel: string
  }

  const GROUPS: GroupSpec[] = [
    {
      id: 'account',
      label: 'Account',
      summaryLabel: 'Account',
      leaves: [
        { id: 'company',  field: 'company',  label: 'Company',  width: 200 },
        { id: 'industry', field: 'industry', label: 'Industry', width: 130 },
        { id: 'region',   field: 'region',   label: 'Region',   width: 90  },
      ],
    },
    {
      id: 'pipeline',
      label: 'Pipeline',
      summaryLabel: 'Pipeline',
      leaves: [
        { id: 'stage',  field: 'stage',  label: 'Stage',  width: 110 },
        { id: 'owner',  field: 'owner',  label: 'Owner',  width: 100 },
        { id: 'age',    field: 'age',    label: 'Age',    width: 80, align: 'right' },
      ],
    },
    {
      id: 'value',
      label: 'Deal value',
      summaryLabel: 'ARR',
      leaves: [
        { id: 'arr',         field: 'arr',         label: 'ARR',         width: 130, align: 'right' },
        { id: 'probability', field: 'probability', label: 'Probability', width: 80,  align: 'right' },
        { id: 'currency',    field: 'currency',    label: 'Currency',    width: 110 },
      ],
    },
    {
      id: 'engagement',
      label: 'Engagement',
      summaryLabel: 'Status',
      leaves: [
        { id: 'lastTouch', field: 'lastTouch', label: 'Last touch', width: 120 },
        { id: 'nextStep',  field: 'nextStep',  label: 'Next step',  width: 220 },
        { id: 'health',    field: 'health',    label: 'Health',     width: 100 },
      ],
    },
  ]

  type GroupTreeState = {
    id: string
    visible: boolean
    collapsed: boolean
    leafOrder: string[]                 // leaf ids, in display order
    leafVisible: Record<string, boolean>
  }

  function initialTree(): GroupTreeState[] {
    return GROUPS.map((g) => ({
      id: g.id,
      visible: true,
      collapsed: false,
      leafOrder: g.leaves.map((l) => l.id),
      leafVisible: Object.fromEntries(g.leaves.map((l) => [l.id, true])),
    }))
  }

  let treeState = $state<GroupTreeState[]>(initialTree())
  let deals = $state<Deal[]>(seed())

  // Active cell tracking - powers the live "active group" hint in the
  // side panel so users can see which group their focus is in.
  let activeColumnId = $state<string>('')

  // Drag-and-drop within a single group (leaf reorder).
  let drag = $state<{ groupId: string; leafId: string } | null>(null)
  function onDragStart(e: DragEvent, groupId: string, leafId: string) {
    drag = { groupId, leafId }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', leafId)
    }
  }
  function onDragOver(e: DragEvent, groupId: string, _targetLeafId: string) {
    if (!drag || drag.groupId !== groupId) return
    e.preventDefault()
  }
  function onDrop(e: DragEvent, groupId: string, targetLeafId: string) {
    e.preventDefault()
    if (!drag || drag.groupId !== groupId) return
    const group = treeState.find((g) => g.id === groupId)
    if (!group) return
    const fromIx = group.leafOrder.indexOf(drag.leafId)
    const toIx = group.leafOrder.indexOf(targetLeafId)
    if (fromIx < 0 || toIx < 0 || fromIx === toIx) { drag = null; return }
    const next = group.leafOrder.slice()
    next.splice(fromIx, 1)
    next.splice(toIx, 0, drag.leafId)
    treeState = treeState.map((g) => g.id === groupId ? { ...g, leafOrder: next } : g)
    drag = null
  }
  function onDragEnd() { drag = null }

  // ---- Per-cell rendering (so collapsed-summary cells stay rich) -----

  function fmtMoney(n: number, currency: Deal['currency'] = 'USD'): string {
    return n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
  }
  function fmtMoneyShort(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
    return `$${n}`
  }
  const STAGE_TONE: Record<Stage, string> = {
    qualify:   '#94a3b8',
    discover:  '#0ea5e9',
    propose:   '#6366f1',
    negotiate: '#a855f7',
    won:       '#16a34a',
    lost:      '#dc2626',
  }
  const HEALTH_TONE: Record<Health, string> = {
    green:  '#16a34a',
    yellow: '#f59e0b',
    red:    '#dc2626',
  }

  // ---- Derived column tree for SvGrid --------------------------------

  type AnyColDef = ColumnDef<typeof features, Deal>

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columnTree = $derived.by((): AnyColDef[] => {
    const out: AnyColDef[] = []
    for (const g of treeState) {
      if (!g.visible) continue
      const spec = GROUPS.find((s) => s.id === g.id)!
      if (g.collapsed) {
        // Emit one synthetic summary column for the whole group.
        out.push({
          id: `summary_${g.id}`,
          header: `${spec.label} · summary`,
          width: 200,
          editable: false,
          cell: (ctx) => renderSnippet(SummaryCell, { row: ctx.row.original, groupId: g.id }),
        })
        continue
      }
      // Emit the group as a real nested column group.
      const visibleLeaves = g.leafOrder
        .map((id) => spec.leaves.find((l) => l.id === id)!)
        .filter((l) => g.leafVisible[l.id])
      if (visibleLeaves.length === 0) continue
      out.push({
        id: `group_${g.id}`,
        header: spec.label,
        columns: visibleLeaves.map((leaf) => buildLeaf(leaf)),
      })
    }
    return out
  })

  function buildLeaf(leaf: LeafSpec): AnyColDef {
    // Custom-rendered fields get their snippets; everything else uses
    // the default cell renderer.
    if (leaf.id === 'stage') {
      return {
        field: leaf.field,
        header: leaf.label,
        width: leaf.width,
        cell: (ctx) => renderSnippet(StagePill, { stage: ctx.row.original.stage }),
      }
    }
    if (leaf.id === 'arr') {
      return {
        field: leaf.field,
        header: leaf.label,
        width: leaf.width,
        cell: (ctx) => renderSnippet(ArrCell, { row: ctx.row.original }),
      }
    }
    if (leaf.id === 'probability') {
      return {
        field: leaf.field,
        header: leaf.label,
        width: leaf.width,
        cell: (ctx) => renderSnippet(ProbCell, { row: ctx.row.original }),
      }
    }
    if (leaf.id === 'health') {
      return {
        field: leaf.field,
        header: leaf.label,
        width: leaf.width,
        cell: (ctx) => renderSnippet(HealthCell, { health: ctx.row.original.health }),
      }
    }
    return {
      field: leaf.field,
      header: leaf.label,
      width: leaf.width,
    }
  }

  // KPI roll-ups for the side panel
  const visibleLeafCount = $derived(
    treeState
      .filter((g) => g.visible && !g.collapsed)
      .reduce((s, g) => s + g.leafOrder.filter((id) => g.leafVisible[id]).length, 0),
  )
  const hiddenLeafCount = $derived(
    treeState
      .filter((g) => g.visible && !g.collapsed)
      .reduce((s, g) => s + g.leafOrder.filter((id) => !g.leafVisible[id]).length, 0)
      + treeState.filter((g) => !g.visible).reduce((s, g) => s + g.leafOrder.length, 0),
  )
  const collapsedGroupCount = $derived(treeState.filter((g) => g.visible && g.collapsed).length)

  // ---- Side-panel handlers ------------------------------------------

  function toggleGroupCollapsed(id: string) {
    treeState = treeState.map((g) => g.id === id ? { ...g, collapsed: !g.collapsed } : g)
  }
  function toggleGroupVisible(id: string) {
    treeState = treeState.map((g) => g.id === id ? { ...g, visible: !g.visible } : g)
  }
  function toggleLeafVisible(groupId: string, leafId: string) {
    treeState = treeState.map((g) =>
      g.id === groupId
        ? { ...g, leafVisible: { ...g.leafVisible, [leafId]: !g.leafVisible[leafId] } }
        : g,
    )
  }
  function resetTree() { treeState = initialTree() }
  function hideAllExcept(groupId: string) {
    treeState = treeState.map((g) => ({ ...g, visible: g.id === groupId }))
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet StagePill(props: { stage: Stage })}
  {@const tone = STAGE_TONE[props.stage]}
  <span class="ch-stage" style={`background:${tone}1a; color:${tone}; border: 1px solid ${tone}40`}>{props.stage}</span>
{/snippet}

{#snippet ArrCell(props: { row: Deal })}
  <span class="ch-arr">
    <span class="ch-arr-amt tabular-nums">{fmtMoney(props.row.arr, props.row.currency)}</span>
    <span class="ch-arr-w tabular-nums">w. {fmtMoneyShort(props.row.arr * props.row.probability / 100)}</span>
  </span>
{/snippet}

{#snippet ProbCell(props: { row: Deal })}
  <span class="ch-prob">
    <span class="ch-prob-bar">
      <span class="ch-prob-fill" style={`width: ${props.row.probability}%`}></span>
    </span>
    <span class="tabular-nums">{props.row.probability}%</span>
  </span>
{/snippet}

{#snippet HealthCell(props: { health: Health })}
  {@const tone = HEALTH_TONE[props.health]}
  <span class="ch-health" style={`color:${tone}`}>
    <span class="ch-health-dot" style={`background:${tone}`}></span>
    {props.health}
  </span>
{/snippet}

{#snippet SummaryCell(props: { row: Deal; groupId: string })}
  {#if props.groupId === 'account'}
    <span class="ch-sum">
      <span class="ch-sum-strong">{props.row.company}</span>
      <span class="ch-sum-faint">{props.row.industry} · {props.row.region}</span>
    </span>
  {:else if props.groupId === 'pipeline'}
    {@const tone = STAGE_TONE[props.row.stage]}
    <span class="ch-sum">
      <span class="ch-stage" style={`background:${tone}1a; color:${tone}; border: 1px solid ${tone}40`}>{props.row.stage}</span>
      <span class="ch-sum-faint">{props.row.owner} · {props.row.age}d</span>
    </span>
  {:else if props.groupId === 'value'}
    <span class="ch-sum">
      <span class="ch-arr-amt tabular-nums">{fmtMoney(props.row.arr, props.row.currency)}</span>
      <span class="ch-sum-faint tabular-nums">{props.row.probability}% probability</span>
    </span>
  {:else if props.groupId === 'engagement'}
    {@const tone = HEALTH_TONE[props.row.health]}
    <span class="ch-sum">
      <span class="ch-health" style={`color:${tone}`}>
        <span class="ch-health-dot" style={`background:${tone}`}></span>
        {props.row.health}
      </span>
      <span class="ch-sum-faint">{props.row.nextStep}</span>
    </span>
  {/if}
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="ch-shell flex flex-1 min-h-0 gap-3">
  <!-- Column hierarchy manager (left) -->
  <aside class="ch-panel">
    <header class="ch-header">
      <div class="ch-header-row">
        <span class="ch-badge">COLUMNS</span>
        <span class="ch-header-title">Column hierarchy</span>
      </div>
      <p class="ch-header-sub">
        Drag leaves to reorder; click a group's chevron to collapse it
        into one summary column; toggle a checkbox to hide.
      </p>
    </header>

    <div class="ch-stats">
      <span class="ch-stat-pill ch-stat-on tabular-nums">{visibleLeafCount} visible</span>
      <span class="ch-stat-pill tabular-nums">{hiddenLeafCount} hidden</span>
      <span class="ch-stat-pill ch-stat-warn tabular-nums">{collapsedGroupCount} collapsed</span>
    </div>

    <div class="ch-tree">
      {#each treeState as g (g.id)}
        {@const spec = GROUPS.find((s) => s.id === g.id)!}
        <div class={`ch-group ${g.visible ? '' : 'ch-group-off'} ${g.collapsed ? 'ch-group-collapsed' : ''}`}>
          <div class="ch-group-head">
            <button type="button" class={`ch-chev ${g.collapsed ? '' : 'ch-chev-open'}`}
              onclick={() => toggleGroupCollapsed(g.id)}
              aria-label={g.collapsed ? 'Expand group' : 'Collapse group'}
              title={g.collapsed ? 'Expand into leaves' : 'Collapse into one summary column'}>
              <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="5 3 11 8 5 13" />
              </svg>
            </button>
            <label class="ch-check">
              <input type="checkbox" checked={g.visible} onchange={() => toggleGroupVisible(g.id)} />
              <span class="ch-group-label">{spec.label}</span>
            </label>
            <button type="button" class="ch-mini" title="Hide every other group" onclick={() => hideAllExcept(g.id)}>solo</button>
          </div>
          {#if !g.collapsed}
            <ul class="ch-leaves">
              {#each g.leafOrder as lid (lid)}
                {@const leaf = spec.leaves.find((l) => l.id === lid)!}
                {@const visible = g.leafVisible[lid]}
                <li
                  class={`ch-leaf ${visible ? '' : 'ch-leaf-off'} ${drag?.leafId === lid ? 'ch-leaf-dragging' : ''}`}
                  draggable="true"
                  ondragstart={(e) => onDragStart(e, g.id, lid)}
                  ondragover={(e) => onDragOver(e, g.id, lid)}
                  ondrop={(e) => onDrop(e, g.id, lid)}
                  ondragend={onDragEnd}
                >
                  <span class="ch-leaf-handle" aria-hidden="true">⋮⋮</span>
                  <label class="ch-check">
                    <input type="checkbox" checked={visible} onchange={() => toggleLeafVisible(g.id, lid)} />
                    <span>{leaf.label}</span>
                  </label>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="ch-collapsed-note">→ one summary column: <strong>{spec.summaryLabel}</strong></div>
          {/if}
        </div>
      {/each}
    </div>

    <footer class="ch-footer">
      <button type="button" class="ch-btn" onclick={resetTree}>Reset to default tree</button>
    </footer>
  </aside>

  <!-- Grid -->
  <div class="ch-grid-wrap flex-1 min-w-0">
    <SvGrid responsive={true}
      data={deals}
      columns={columnTree}
      features={features}
      filterMode="menu"
      selectionMode="row"
      showRowSelection={false}
      enableInlineEditing={false}
      enableCellSelection={false}
      headerHeight={44}
      rowHeight={48}
      containerHeight="100%"
      fitColumns={false}
      onActiveCellChange={(args) => { activeColumnId = args.columnId }}
    />
  </div>
</section>

<style>
  .ch-shell { min-height: 0; }

  /* Panel */
  .ch-panel {
    width: 320px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .ch-header {
    padding: 12px 14px 8px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 6%, transparent 94%);
  }
  :global([data-theme='dark']) .ch-header {
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 14%, transparent 86%);
  }
  .ch-header-row { display: flex; align-items: center; gap: 8px; }
  .ch-badge {
    background: var(--sg-accent, #6366f1);
    color: var(--sg-on-accent, #fff);
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.06em;
  }
  .ch-header-title { font-size: 14px; font-weight: 700; }
  .ch-header-sub {
    margin: 6px 0 0;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    line-height: 1.4;
  }

  .ch-stats {
    padding: 8px 14px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .ch-stat-pill {
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
  }
  .ch-stat-on { background: #dcfce7; color: #166534; }
  .ch-stat-warn { background: #fef3c7; color: #92400e; }
  :global([data-theme='dark']) .ch-stat-on   { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark']) .ch-stat-warn { background: rgba(245,158,11,.18); color: #fbbf24; }

  .ch-tree {
    flex: 1 1 auto;
    overflow: auto;
    padding: 8px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ch-group {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }
  .ch-group-off { opacity: 0.55; }
  .ch-group-collapsed { background: var(--sg-header-bg, #f1f5f9); }
  .ch-group-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
  }
  .ch-chev {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    width: 18px;
    height: 18px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 160ms ease;
    flex-shrink: 0;
  }
  .ch-chev:hover { background: var(--sg-input-bg, #e2e8f0); color: var(--sg-fg, #1e293b); }
  .ch-chev-open { transform: rotate(90deg); }
  .ch-check {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    flex: 1 1 0;
    min-width: 0;
  }
  .ch-check input[type='checkbox'] {
    accent-color: var(--sg-accent, #2563eb);
    width: 13px;
    height: 13px;
    cursor: pointer;
  }
  .ch-group-label {
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .ch-mini {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-muted, #64748b);
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 10.5px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .ch-mini:hover { color: var(--sg-fg, #1e293b); }

  .ch-leaves {
    list-style: none;
    margin: 0;
    padding: 4px 8px 8px 26px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ch-leaf {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 5px;
    cursor: grab;
    font-size: 12px;
  }
  .ch-leaf:hover { background: var(--sg-header-bg, #f1f5f9); }
  .ch-leaf-off { opacity: 0.55; }
  .ch-leaf-dragging { opacity: 0.4; }
  .ch-leaf-handle {
    color: var(--sg-muted, #64748b);
    font-size: 10px;
    letter-spacing: -0.06em;
  }
  .ch-collapsed-note {
    padding: 4px 12px 10px 32px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }
  .ch-collapsed-note strong { color: var(--sg-accent, #2563eb); font-style: normal; }

  .ch-footer {
    padding: 8px 12px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
  }
  .ch-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 11.5px;
    cursor: pointer;
    width: 100%;
  }
  .ch-btn:hover { background: var(--sg-input-bg, #e2e8f0); }

  /* Grid */
  .ch-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Cell content - global so they live in cell scope */
  :global(.ch-stage) {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.ch-arr) { display: inline-flex; flex-direction: column; line-height: 1.2; }
  :global(.ch-arr-amt) { font-weight: 700; }
  :global(.ch-arr-w) { font-size: 11px; color: var(--sg-muted, #64748b); }

  :global(.ch-prob) {
    display: inline-grid;
    grid-template-columns: 1fr 38px;
    align-items: center;
    gap: 6px;
    width: 100%;
  }
  :global(.ch-prob-bar) {
    height: 5px;
    background: var(--sg-input-bg, #e2e8f0);
    border-radius: 999px;
    overflow: hidden;
  }
  :global(.ch-prob-fill) {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--sg-accent, #2563eb);
  }

  :global(.ch-health) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 11.5px;
  }
  :global(.ch-health-dot) {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  /* Summary cells when a group is collapsed */
  :global(.ch-sum) { display: inline-flex; flex-direction: column; line-height: 1.2; min-width: 0; }
  :global(.ch-sum-strong) { font-weight: 700; }
  :global(.ch-sum-faint) { font-size: 11px; color: var(--sg-muted, #64748b); }
  /* Phone: the column groups are hidden-overflow flex children of the tree, which is
     the scroller - they shrank to their header instead of letting the tree scroll. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .ch-group { flex-shrink: 0; }
  }
</style>
