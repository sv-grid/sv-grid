<script lang="ts">
  /**
   * 31. Lazy tree - load children on demand
   * ---------------------------------------
   * A geographic hierarchy (Region -> Country -> State -> City) where
   * only the root regions are seeded up front. Clicking expand on any
   * node fires an async fetch (simulated 400-800ms via setTimeout) and
   * shows a "Loading..." row in place of the children until it
   * resolves.
   *
   * Already-loaded subtrees are cached so the second expand is instant.
   * Keyboard: Right Arrow expands a collapsed node; Left Arrow collapses
   * an expanded one; Enter / Space toggle.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type LoadState = 'unloaded' | 'loading' | 'loaded'

  type Node = {
    id: string
    parentId: string | null
    depth: number
    name: string
    kind: 'region' | 'country' | 'state' | 'city'
    population: number
    revenue: number
    expandable: boolean
    loadState: LoadState
    childIds: string[]
  }

  const STATIC_TREE: Record<string, Omit<Node, 'loadState' | 'childIds'>[]> = {
    'root': [
      { id: 'amer', parentId: null,   depth: 0, name: 'Americas', kind: 'region',  population: 1_010_000_000, revenue: 28_400_000, expandable: true },
      { id: 'emea', parentId: null,   depth: 0, name: 'EMEA',     kind: 'region',  population: 2_180_000_000, revenue: 31_900_000, expandable: true },
      { id: 'apac', parentId: null,   depth: 0, name: 'APAC',     kind: 'region',  population: 4_640_000_000, revenue: 22_700_000, expandable: true },
    ],
    'amer': [
      { id: 'amer.us', parentId: 'amer', depth: 1, name: 'United States', kind: 'country', population: 334_000_000, revenue: 18_200_000, expandable: true },
      { id: 'amer.ca', parentId: 'amer', depth: 1, name: 'Canada',        kind: 'country', population:  39_500_000, revenue:  4_100_000, expandable: true },
      { id: 'amer.br', parentId: 'amer', depth: 1, name: 'Brazil',        kind: 'country', population: 215_000_000, revenue:  3_400_000, expandable: true },
      { id: 'amer.mx', parentId: 'amer', depth: 1, name: 'Mexico',        kind: 'country', population: 128_000_000, revenue:  2_700_000, expandable: true },
    ],
    'emea': [
      { id: 'emea.uk', parentId: 'emea', depth: 1, name: 'United Kingdom', kind: 'country', population:  67_700_000, revenue:  8_200_000, expandable: true },
      { id: 'emea.de', parentId: 'emea', depth: 1, name: 'Germany',        kind: 'country', population:  83_200_000, revenue:  9_400_000, expandable: true },
      { id: 'emea.fr', parentId: 'emea', depth: 1, name: 'France',         kind: 'country', population:  67_900_000, revenue:  6_800_000, expandable: true },
      { id: 'emea.es', parentId: 'emea', depth: 1, name: 'Spain',          kind: 'country', population:  47_400_000, revenue:  4_100_000, expandable: true },
    ],
    'apac': [
      { id: 'apac.jp', parentId: 'apac', depth: 1, name: 'Japan',     kind: 'country', population: 125_000_000, revenue:  7_600_000, expandable: true },
      { id: 'apac.in', parentId: 'apac', depth: 1, name: 'India',     kind: 'country', population: 1_420_000_000, revenue: 5_900_000, expandable: true },
      { id: 'apac.au', parentId: 'apac', depth: 1, name: 'Australia', kind: 'country', population:  26_000_000, revenue:  4_800_000, expandable: true },
      { id: 'apac.sg', parentId: 'apac', depth: 1, name: 'Singapore', kind: 'country', population:   5_900_000, revenue:  2_300_000, expandable: true },
    ],
    'amer.us': [
      { id: 'amer.us.ca', parentId: 'amer.us', depth: 2, name: 'California', kind: 'state', population: 39_000_000, revenue: 5_900_000, expandable: true },
      { id: 'amer.us.ny', parentId: 'amer.us', depth: 2, name: 'New York',   kind: 'state', population: 19_500_000, revenue: 3_400_000, expandable: true },
      { id: 'amer.us.tx', parentId: 'amer.us', depth: 2, name: 'Texas',      kind: 'state', population: 30_000_000, revenue: 4_100_000, expandable: true },
    ],
    'amer.us.ca': [
      { id: 'amer.us.ca.sf', parentId: 'amer.us.ca', depth: 3, name: 'San Francisco', kind: 'city', population:   870_000, revenue:  680_000, expandable: false },
      { id: 'amer.us.ca.la', parentId: 'amer.us.ca', depth: 3, name: 'Los Angeles',   kind: 'city', population: 3_900_000, revenue:  920_000, expandable: false },
      { id: 'amer.us.ca.sd', parentId: 'amer.us.ca', depth: 3, name: 'San Diego',     kind: 'city', population: 1_400_000, revenue:  410_000, expandable: false },
    ],
    'amer.us.ny': [
      { id: 'amer.us.ny.nyc', parentId: 'amer.us.ny', depth: 3, name: 'New York City', kind: 'city', population: 8_300_000, revenue: 1_900_000, expandable: false },
      { id: 'amer.us.ny.buf', parentId: 'amer.us.ny', depth: 3, name: 'Buffalo',       kind: 'city', population:   260_000, revenue:   78_000, expandable: false },
    ],
    'amer.us.tx': [
      { id: 'amer.us.tx.hou', parentId: 'amer.us.tx', depth: 3, name: 'Houston', kind: 'city', population: 2_300_000, revenue:  410_000, expandable: false },
      { id: 'amer.us.tx.aus', parentId: 'amer.us.tx', depth: 3, name: 'Austin',  kind: 'city', population:   990_000, revenue:  295_000, expandable: false },
      { id: 'amer.us.tx.dal', parentId: 'amer.us.tx', depth: 3, name: 'Dallas',  kind: 'city', population: 1_300_000, revenue:  340_000, expandable: false },
    ],
    'emea.de': [
      { id: 'emea.de.be', parentId: 'emea.de', depth: 2, name: 'Berlin',  kind: 'city', population: 3_700_000, revenue: 980_000, expandable: false },
      { id: 'emea.de.mu', parentId: 'emea.de', depth: 2, name: 'Munich',  kind: 'city', population: 1_500_000, revenue: 720_000, expandable: false },
      { id: 'emea.de.ha', parentId: 'emea.de', depth: 2, name: 'Hamburg', kind: 'city', population: 1_900_000, revenue: 480_000, expandable: false },
    ],
    'emea.uk': [
      { id: 'emea.uk.lon', parentId: 'emea.uk', depth: 2, name: 'London',     kind: 'city', population: 8_800_000, revenue: 2_400_000, expandable: false },
      { id: 'emea.uk.man', parentId: 'emea.uk', depth: 2, name: 'Manchester', kind: 'city', population:   550_000, revenue:   180_000, expandable: false },
    ],
    'apac.jp': [
      { id: 'apac.jp.to', parentId: 'apac.jp', depth: 2, name: 'Tokyo',  kind: 'city', population: 13_900_000, revenue: 3_100_000, expandable: false },
      { id: 'apac.jp.os', parentId: 'apac.jp', depth: 2, name: 'Osaka',  kind: 'city', population:  2_700_000, revenue:   720_000, expandable: false },
      { id: 'apac.jp.ky', parentId: 'apac.jp', depth: 2, name: 'Kyoto',  kind: 'city', population:  1_500_000, revenue:   320_000, expandable: false },
    ],
  }

  let fetchCount = $state(0)
  function fetchChildren(parentId: string): Promise<Node[]> {
    fetchCount += 1
    return new Promise((resolve) => {
      setTimeout(() => {
        const raw = STATIC_TREE[parentId] ?? []
        resolve(
          raw.map((r) => ({ ...r, loadState: 'unloaded' as LoadState, childIds: [] })),
        )
      }, 400 + Math.random() * 400)
    })
  }

  function seedRoots(): Node[] {
    const raw = STATIC_TREE['root']!
    return raw.map((r) => ({ ...r, loadState: 'unloaded' as LoadState, childIds: [] }))
  }

  let allNodes = $state<Node[]>(seedRoots())
  let expanded = $state<Record<string, boolean>>({})

  async function toggle(id: string) {
    const isOpen = !!expanded[id]
    expanded = { ...expanded, [id]: !isOpen }
    if (isOpen) return

    const node = allNodes.find((n) => n.id === id)
    if (!node || !node.expandable || node.loadState === 'loaded') return

    allNodes = allNodes.map((n) => (n.id === id ? { ...n, loadState: 'loading' as LoadState } : n))

    try {
      const children = await fetchChildren(id)
      allNodes = allNodes.map((n) =>
        n.id === id
          ? { ...n, loadState: 'loaded' as LoadState, childIds: children.map((c) => c.id) }
          : n,
      ).concat(children)
    } catch (err) {
      allNodes = allNodes.map((n) => (n.id === id ? { ...n, loadState: 'unloaded' as LoadState } : n))
      console.error('fetchChildren failed', err)
    }
  }

  type ViewRow = Node | { id: string; parentId: string; depth: number; placeholder: true }

  const visibleRows = $derived.by(() => {
    const out: ViewRow[] = []
    const byId = new Map(allNodes.map((n) => [n.id, n]))
    function walk(id: string) {
      const node = byId.get(id)
      if (!node) return
      out.push(node)
      if (!expanded[id]) return
      if (node.loadState === 'loading') {
        out.push({ id: `${id}__loading`, parentId: id, depth: node.depth + 1, placeholder: true })
        return
      }
      for (const cid of node.childIds) walk(cid)
    }
    for (const root of allNodes.filter((n) => n.parentId === null)) walk(root.id)
    return out
  })

  function isPlaceholder(row: ViewRow): row is { id: string; parentId: string; depth: number; placeholder: true } {
    return 'placeholder' in row && row.placeholder === true
  }

  // KPIs
  const stats = $derived.by(() => {
    const byKind = { region: 0, country: 0, state: 0, city: 0 }
    let totalPop = 0
    let totalRev = 0
    for (const n of allNodes) {
      byKind[n.kind] += 1
      totalPop += n.population
      totalRev += n.revenue
    }
    return { byKind, totalPop, totalRev }
  })

  // Keyboard navigation: when the active cell is in the "name" column, Right
  // expands a collapsed node, Left collapses an expanded one, Enter/Space
  // toggle. Window-level capture listener so we run before SvGrid's own
  // arrow-key cell mover.
  let activeCol = $state<string>('')
  let activeRowIndex = $state<number>(0)
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (activeCol !== 'name') return
      const row = visibleRows[activeRowIndex]
      if (!row || isPlaceholder(row)) return
      if (!row.expandable) return
      const isOpen = !!expanded[row.id]
      if (e.key === 'ArrowRight' && !isOpen) {
        e.preventDefault(); void toggle(row.id)
      } else if (e.key === 'ArrowLeft' && isOpen) {
        e.preventDefault(); void toggle(row.id)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); void toggle(row.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const features = tableFeatures({ rowSortingFeature })
  const columns: ColumnDef<typeof features, ViewRow>[] = [
    {
      id: 'name',
      header: 'Geography',
      fieldFn: (row) => (isPlaceholder(row) ? '...' : row.name),
      cell: (ctx) => renderSnippet(NameCell, { row: ctx.row.original }),
      width: 380,
    },
    {
      id: 'kind',
      header: 'Type',
      fieldFn: (row) => (isPlaceholder(row) ? '' : row.kind),
      width: 130,
      cell: (ctx) => renderSnippet(KindCell, { row: ctx.row.original }),
    },
    {
      id: 'population',
      header: 'Population',
      width: 200,
      fieldFn: (row) => (isPlaceholder(row) ? null : row.population),
      cell: (ctx) => renderSnippet(PopulationCell, { row: ctx.row.original }),
    },
    {
      id: 'revenue',
      header: 'Revenue',
      width: 180,
      fieldFn: (row) => (isPlaceholder(row) ? null : row.revenue),
      cell: (ctx) => renderSnippet(RevenueCell, { row: ctx.row.original }),
    },
  ]

  const KIND_COLOR: Record<Node['kind'], string> = {
    region:  '#a855f7',
    country: '#2563eb',
    state:   '#06b6d4',
    city:    '#10b981',
  }
  const KIND_ICON: Record<Node['kind'], string> = {
    region:  'M3 12 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M3 12 H21 M12 3 c4 5 4 13 0 18 M12 3 c-4 5 -4 13 0 18',
    country: 'M4 21 V4 L20 8 L4 12',
    state:   'M4 4 H20 V20 H4 Z M4 12 H20',
    city:    'M3 21 H21 M5 21 V11 L9 8 V21 M9 21 V8 M15 21 V6 L19 8 V21 M19 21 V8',
  }
  function fmtPopulation(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
    if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)         return `${Math.round(n / 1_000)}k`
    return `${n}`
  }
  function fmtMoney(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
    return `$${n}`
  }
</script>

{#snippet NameCell(props: { row: ViewRow })}
  {#if isPlaceholder(props.row)}
    <span class="t31-loading" style={`padding-left: ${4 + props.row.depth * 22 + 28}px`}>
      <span class="t31-spinner" aria-hidden="true"></span>
      <span class="t31-loading-text">Loading children...</span>
    </span>
  {:else}
    {@const node = props.row}
    {@const isOpen = !!expanded[node.id]}
    {@const canExpand = node.expandable}
    {@const isRoot = node.depth === 0}
    {@const color = KIND_COLOR[node.kind]}
    <span class={`t31-name ${isRoot ? 't31-name-root' : ''}`} style={`padding-left: ${4 + node.depth * 22}px`}>
      {#each Array(node.depth) as _, i (i)}
        <span class="t31-guide" style={`left: ${4 + i * 22 + 11}px`}></span>
      {/each}
      {#if node.depth > 0}
        <span class="t31-elbow" style={`left: ${4 + (node.depth - 1) * 22 + 11}px`}></span>
      {/if}
      {#if canExpand}
        <button
          type="button"
          class={`t31-chev ${isOpen ? 't31-chev-open' : ''}`}
          onclick={() => toggle(node.id)}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          aria-expanded={isOpen}
        >
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="5 3 11 8 5 13" />
          </svg>
        </button>
      {:else}
        <span class="t31-dot" aria-hidden="true"></span>
      {/if}
      <span class="t31-icon" style={`background:${color}1a; color:${color}; border: 1px solid ${color}40`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d={KIND_ICON[node.kind]} />
        </svg>
      </span>
      <span class="t31-name-text">{node.name}</span>
      {#if node.loadState === 'loaded'}
        <span class="t31-cached" title="Subtree cached - no fetch on re-expand">cached</span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet KindCell(props: { row: ViewRow })}
  {#if isPlaceholder(props.row)}
    <span></span>
  {:else}
    {@const color = KIND_COLOR[props.row.kind]}
    <span class="t31-kind" style={`background:${color}1a; color:${color}; border: 1px solid ${color}40`}>
      {props.row.kind}
    </span>
  {/if}
{/snippet}

{#snippet PopulationCell(props: { row: ViewRow })}
  {#if isPlaceholder(props.row)}
    <span></span>
  {:else}
    <span class="t31-pop">
      <span class="t31-pop-num tabular-nums">{fmtPopulation(props.row.population)}</span>
      <span class="t31-pop-bar">
        <span class="t31-pop-fill" style={`width: ${Math.min(100, (props.row.population / 4_700_000_000) * 100)}%`}></span>
      </span>
    </span>
  {/if}
{/snippet}

{#snippet RevenueCell(props: { row: ViewRow })}
  {#if isPlaceholder(props.row)}
    <span></span>
  {:else}
    <span class="t31-rev tabular-nums">{fmtMoney(props.row.revenue)}</span>
  {/if}
{/snippet}

<section class="t31-shell flex flex-col flex-1 min-h-0 gap-3">
  <div class="t31-kpi-strip">
    <div class="t31-kpi t31-kpi-hero">
      <div class="t31-kpi-label">Loaded nodes</div>
      <div class="t31-kpi-value tabular-nums">{allNodes.length}</div>
      <div class="t31-kpi-foot">{fetchCount} fetch{fetchCount === 1 ? '' : 'es'} so far</div>
    </div>
    {#each (['region', 'country', 'state', 'city'] as const) as k (k)}
      {@const color = KIND_COLOR[k]}
      <div class="t31-kpi" style={`--c: ${color}`}>
        <div class="t31-kpi-bar"></div>
        <div class="t31-kpi-label">{k}s</div>
        <div class="t31-kpi-value tabular-nums">{stats.byKind[k]}</div>
      </div>
    {/each}
  </div>

  <div class="flex-1 min-h-0 t31-grid-wrap">
    <SvGrid responsive={true}
      data={visibleRows}
      columns={columns}
      features={features}
      filterMode="none"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={42}
      containerHeight="100%"
      fitColumns={true}
      onActiveCellChange={(args) => { activeCol = args.columnId; activeRowIndex = args.rowIndex }}
    />
  </div>

  <footer class="t31-foot">
    <strong>Keyboard:</strong> Right Arrow expands · Left Arrow collapses · Enter or Space toggles · arrows still move the active cell on non-tree columns
  </footer>
</section>

<style>
  .t31-shell { min-height: 0; }

  /* KPI strip */
  .t31-kpi-strip {
    display: grid;
    grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .t31-kpi {
    position: relative;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
    overflow: hidden;
  }
  .t31-kpi-bar {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--c);
  }
  .t31-kpi-hero {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.06), rgba(37, 99, 235, 0.04));
  }
  :global([data-theme='dark']) .t31-kpi-hero {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(37, 99, 235, 0.08));
  }
  .t31-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .t31-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--c, var(--sg-fg)); }
  .t31-kpi-hero .t31-kpi-value {
    color: var(--sg-accent, #2563eb);
    font-size: 26px;
  }
  .t31-kpi-foot { margin-top: 4px; font-size: 11px; color: var(--sg-muted, #64748b); }

  .t31-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }
  .t31-foot { font-size: 11.5px; color: var(--sg-muted, #64748b); }

  /* Name cell */
  :global(.t31-name) {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    position: relative;
    width: 100%;
    height: 100%;
  }
  :global(.t31-name-root .t31-name-text) { font-weight: 700; font-size: 14px; }
  :global(.t31-guide) {
    position: absolute;
    top: 0; bottom: 0;
    width: 0;
    border-left: 1px dashed rgba(148, 163, 184, 0.32);
    pointer-events: none;
  }
  :global(.t31-elbow) {
    position: absolute;
    top: 50%;
    width: 14px;
    border-top: 1px dashed rgba(148, 163, 184, 0.45);
    pointer-events: none;
  }
  :global(.t31-chev) {
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
    transition: transform 160ms ease, background 120ms ease, color 120ms ease;
    flex-shrink: 0;
  }
  :global(.t31-chev:hover) {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #1e293b);
  }
  :global(.t31-chev-open) { transform: rotate(90deg); }
  :global(.t31-dot) {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  :global(.t31-dot::before) {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(148, 163, 184, 0.6);
  }
  :global(.t31-icon) {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  :global(.t31-name-text) { font-weight: 500; }
  :global(.t31-cached) {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    background: rgba(148, 163, 184, 0.18);
    padding: 1px 6px;
    border-radius: 999px;
  }

  /* Loading row */
  :global(.t31-loading) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
    font-size: 12px;
  }
  :global(.t31-spinner) {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--sg-accent, #2563eb);
    border-top-color: transparent;
    animation: t31-spin 0.7s linear infinite;
  }
  @keyframes t31-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Kind pill */
  :global(.t31-kind) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Population */
  :global(.t31-pop) {
    display: inline-grid;
    grid-template-columns: 70px 1fr;
    gap: 8px;
    align-items: center;
    width: 100%;
  }
  :global(.t31-pop-num) { font-weight: 700; }
  :global(.t31-pop-bar) {
    height: 6px;
    background: rgba(148, 163, 184, 0.22);
    border-radius: 999px;
    overflow: hidden;
  }
  :global(.t31-pop-fill) {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #a855f7, #06b6d4);
  }

  :global(.t31-rev) {
    font-weight: 700;
    color: var(--sg-accent, #2563eb);
  }
</style>
