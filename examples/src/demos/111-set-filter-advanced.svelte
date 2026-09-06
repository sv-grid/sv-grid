<script lang="ts">
  /**
   * 111. Set filter - tree, async, Excel mode
   * -----------------------------------------
   * Three patterns for a "set list" (value-list) filter, all driven
   * through `api.setFacetFilter(columnId, values | null)`. The grid's
   * built-in column-menu facet handles the trivial case (static distinct
   * values + Excel-style search + select-all). This demo wires three
   * variants you can build on top:
   *
   *   1. EXCEL MODE - the column-menu facet itself, configured for
   *      typeahead + select-all + clear (already built into the grid).
   *
   *   2. ASYNC VALUES - a side panel that fetches the value list from a
   *      mock server endpoint, with loading + retry. Useful when the
   *      column's distinct values are too many to load up-front (e.g.
   *      every customer email).
   *
   *   3. TREE LIST - a hierarchical value picker for nested taxonomies
   *      (region → country → city). Parent checkboxes cascade to
   *      descendants; partial-checked state on parents. The same
   *      pattern that ships in demo 102, here wired to the grid.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'

  type Order = {
    id: string
    customer: string
    email: string
    region: 'Americas' | 'EMEA' | 'APAC'
    country: string
    city: string
    status: 'open' | 'paid' | 'shipped' | 'delivered' | 'returned'
    amount: number
    placedAt: string
  }

  // Geographic taxonomy used by the tree filter + the data generator.
  const GEO: Record<'Americas' | 'EMEA' | 'APAC', Record<string, string[]>> = {
    Americas: {
      'United States': ['New York', 'San Francisco', 'Chicago', 'Austin', 'Seattle'],
      'Canada':        ['Toronto', 'Montréal', 'Vancouver'],
      'Mexico':        ['Mexico City', 'Guadalajara'],
      'Brazil':        ['São Paulo', 'Rio de Janeiro'],
    },
    EMEA: {
      'United Kingdom': ['London', 'Manchester', 'Edinburgh'],
      'Germany':        ['Berlin', 'Munich', 'Hamburg'],
      'France':         ['Paris', 'Lyon'],
      'Spain':          ['Madrid', 'Barcelona'],
      'Sweden':         ['Stockholm'],
    },
    APAC: {
      'Japan':     ['Tokyo', 'Osaka'],
      'Australia': ['Sydney', 'Melbourne'],
      'Singapore': ['Singapore'],
      'India':     ['Mumbai', 'Bangalore', 'Delhi'],
    },
  }
  const ALL_REGIONS = Object.keys(GEO) as Array<keyof typeof GEO>

  // ---- Seed data -------------------------------------------------------
  let prng = 0x5EED01
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const FIRST = ['Ava', 'Liam', 'Noah', 'Emma', 'Olivia', 'Mason', 'Sophia', 'Lucas', 'Mia', 'Ethan',
                 'Carter', 'Aria', 'Henry', 'Amelia', 'Wyatt', 'Harper', 'Aurora', 'Hudson']
  const LAST  = ['Thompson', 'Park', 'Singh', 'Garcia', 'Chen', 'Rivera', 'Brown', 'Patel',
                 'Johnson', 'Wright', 'Khan', 'Sato', 'Volkov', 'Schmidt', 'Andersson']
  const STATUSES: Order['status'][] = ['open', 'paid', 'shipped', 'delivered', 'returned']

  let rows = $state<Order[]>(Array.from({ length: 320 }, (_, i) => {
    const region = pick(ALL_REGIONS)
    const countries = Object.keys(GEO[region])
    const country = pick(countries)
    const city = pick(GEO[region][country]!)
    const first = pick(FIRST); const last = pick(LAST)
    const date = new Date(); date.setDate(date.getDate() - int(0, 365))
    return {
      id: `ORD-${(40_000 + i).toString()}`,
      customer: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${pick(['acme.co', 'globex.io', 'initech.net', 'umbrella.dev'])}`,
      region, country, city,
      status: pick(STATUSES),
      amount: int(45, 4800),
      placedAt: date.toISOString().slice(0, 10),
    }
  }))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  // =====================================================================
  // 1. EXCEL-STYLE column-menu facet (BUILT-IN)
  //    Already works on every column out of the box. The column-menu's
  //    "Values" tab gives the user search + select-all + clear. We
  //    surface it in the toolbar so evaluators see it exists.
  // =====================================================================
  function openValuesFor(columnId: string) {
    // Programmatic open isn't (yet) part of the public API, so the
    // toolbar button just informs the user. The Excel UI lives behind
    // the funnel + Values tab on each header.
    alert(
      `Click the funnel icon on the "${columnId}" header.\n\n` +
      `The Excel-style Values tab shows distinct values with a search box, ` +
      `select-all, and per-value checkboxes.`,
    )
  }

  // =====================================================================
  // 2. ASYNC VALUES - server-side enum loader
  //    Pretends we have too many distinct emails to enumerate on the
  //    client; loads them on demand with a 700 ms simulated latency.
  // =====================================================================
  type AsyncState = { state: 'idle' | 'loading' | 'ready' | 'error'; values: string[]; error?: string }
  let emailValues = $state<AsyncState>({ state: 'idle', values: [] })
  let selectedEmails = $state<Set<string>>(new Set())

  async function loadEmails() {
    emailValues = { state: 'loading', values: [] }
    try {
      await new Promise<void>((r) => setTimeout(r, 700))
      // Simulate the "server" returning the distinct emails from the
      // dataset, sorted alphabetically.
      const set = new Set(rows.map((r) => r.email))
      emailValues = { state: 'ready', values: Array.from(set).sort() }
    } catch (err) {
      emailValues = { state: 'error', values: [], error: String(err) }
    }
  }
  function toggleEmail(v: string) {
    const next = new Set(selectedEmails)
    if (next.has(v)) next.delete(v); else next.add(v)
    selectedEmails = next
    api?.setFacetFilter('email', next.size === 0 ? null : Array.from(next))
  }
  function clearEmails() { selectedEmails = new Set(); api?.setFacetFilter('email', null) }
  let emailSearch = $state('')

  // =====================================================================
  // 3. TREE LIST - hierarchical Region → Country → City picker
  //    On change, computes the leaf set (cities) and applies a facet
  //    filter to the `city` column. Other levels could drive their
  //    own columns; this demo keeps it focused on city.
  // =====================================================================
  type TreeId = string  // "region:Americas" | "country:Americas/Canada" | "city:Americas/Canada/Toronto"
  function treeNodes() {
    type Node = { id: TreeId; label: string; depth: number; parentId: TreeId | null; cities: string[] }
    const out: Node[] = []
    for (const region of ALL_REGIONS) {
      const regCities: string[] = []
      const regId: TreeId = `region:${region}`
      out.push({ id: regId, label: region, depth: 0, parentId: null, cities: regCities })
      for (const country of Object.keys(GEO[region])) {
        const cnCities: string[] = []
        const cnId: TreeId = `country:${region}/${country}`
        out.push({ id: cnId, label: country, depth: 1, parentId: regId, cities: cnCities })
        for (const city of GEO[region][country]!) {
          const ctId: TreeId = `city:${region}/${country}/${city}`
          out.push({ id: ctId, label: city, depth: 2, parentId: cnId, cities: [city] })
          cnCities.push(city)
          regCities.push(city)
        }
      }
    }
    return out
  }
  const TREE = treeNodes()
  const TREE_BY_ID = new Map(TREE.map((n) => [n.id, n]))

  let selectedCities = $state<Set<string>>(new Set())
  let expandedNodes = $state<Set<TreeId>>(new Set(ALL_REGIONS.map((r) => `region:${r}`)))

  function isNodeChecked(id: TreeId): boolean {
    const n = TREE_BY_ID.get(id)!
    return n.cities.every((c) => selectedCities.has(c))
  }
  function isNodePartial(id: TreeId): boolean {
    const n = TREE_BY_ID.get(id)!
    const hits = n.cities.filter((c) => selectedCities.has(c)).length
    return hits > 0 && hits < n.cities.length
  }
  function toggleNode(id: TreeId, on: boolean) {
    const n = TREE_BY_ID.get(id)!
    const next = new Set(selectedCities)
    for (const c of n.cities) {
      if (on) next.add(c); else next.delete(c)
    }
    selectedCities = next
    api?.setFacetFilter('city', next.size === 0 ? null : Array.from(next))
  }
  function toggleExpand(id: TreeId) {
    const next = new Set(expandedNodes)
    if (next.has(id)) next.delete(id); else next.add(id)
    expandedNodes = next
  }
  function clearTree() { selectedCities = new Set(); api?.setFacetFilter('city', null) }
  function selectAllTree() {
    const all = TREE.filter((n) => n.depth === 2).map((n) => n.label)
    selectedCities = new Set(all)
    api?.setFacetFilter('city', all)
  }

  const visibleTree = $derived.by(() => {
    return TREE.filter((n) => n.parentId === null || expandedNodes.has(n.parentId))
  })

  // ---- Columns ---------------------------------------------------------
  const columns: GridColumns<Order> = [
    { field: 'id',       header: 'Order',     width: 110, editable: false },
    { field: 'customer', header: 'Customer',  width: 170, editable: false },
    { field: 'email',    header: 'Email',     width: 230, editable: false },
    { field: 'region',   header: 'Region',    width: 110, editable: false },
    { field: 'country',  header: 'Country',   width: 150, editable: false },
    { field: 'city',     header: 'City',      width: 150, editable: false },
    { field: 'status',   header: 'Status',    width: 110, editable: false,
      cellClass: (ctx) => `status-${ctx.getValue()}` },
    { field: 'amount',   header: 'Amount',    width: 110, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'placedAt', header: 'Placed',    width: 120, editable: false },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Three-mode toolbar ------------------------------------------------ -->
  <div class="modes shrink-0">
    <div class="mode-card">
      <div class="mode-head">
        <span class="mode-badge mode-badge-excel">EXCEL</span>
        <strong>Built-in column menu</strong>
      </div>
      <p>Click the funnel on any header. Distinct values, search-as-you-type, select-all, clear.</p>
      <div class="mode-cta">
        <button class="link-btn" onclick={() => openValuesFor('status')}>Show on Status</button>
        <button class="link-btn" onclick={() => openValuesFor('region')}>Show on Region</button>
      </div>
    </div>

    <div class="mode-card">
      <div class="mode-head">
        <span class="mode-badge mode-badge-async">ASYNC</span>
        <strong>Server-loaded enum (Email)</strong>
      </div>
      {#if emailValues.state === 'idle'}
        <p>Pretend the email column has 50,000 distinct values - load only on demand.</p>
        <button class="link-btn primary" onclick={loadEmails}>Load values from server →</button>
      {:else if emailValues.state === 'loading'}
        <p class="loading"><span class="spin"></span> Fetching distinct emails…</p>
      {:else if emailValues.state === 'error'}
        <p class="err">Load failed: {emailValues.error}</p>
        <button class="link-btn" onclick={loadEmails}>Retry</button>
      {:else}
        <input class="search" type="search" placeholder="Search emails…" bind:value={emailSearch} />
        <ul class="vlist">
          {#each emailValues.values.filter((v) => v.toLowerCase().includes(emailSearch.toLowerCase())).slice(0, 60) as v (v)}
            <li>
              <label>
                <input type="checkbox" checked={selectedEmails.has(v)}
                  onchange={() => toggleEmail(v)} />
                <span>{v}</span>
              </label>
            </li>
          {/each}
        </ul>
        <div class="mode-foot">
          <span>{selectedEmails.size} selected · {emailValues.values.length} total</span>
          {#if selectedEmails.size > 0}<button class="link-btn" onclick={clearEmails}>Clear</button>{/if}
        </div>
      {/if}
    </div>

    <div class="mode-card">
      <div class="mode-head">
        <span class="mode-badge mode-badge-tree">TREE</span>
        <strong>Region → Country → City</strong>
      </div>
      <p>Hierarchical checkboxes cascade to descendants. Parents show partial state.</p>
      <div class="tree-actions">
        <button class="link-btn" onclick={selectAllTree}>Select all</button>
        {#if selectedCities.size > 0}<button class="link-btn" onclick={clearTree}>Clear ({selectedCities.size})</button>{/if}
      </div>
      <ul class="tree">
        {#each visibleTree as n (n.id)}
          {@const checked = isNodeChecked(n.id)}
          {@const partial = isNodePartial(n.id)}
          {@const expandable = n.depth < 2}
          {@const expanded = expandedNodes.has(n.id)}
          <li class={`tree-node depth-${n.depth}`}>
            {#if expandable}
              <button class="chev" onclick={() => toggleExpand(n.id)} aria-label={expanded ? 'Collapse' : 'Expand'}>
                <svg class={expanded ? 'is-open' : ''} viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 4 10 8 6 12"></polyline>
                </svg>
              </button>
            {:else}
              <span class="chev-spacer"></span>
            {/if}
            <input type="checkbox" checked={checked} indeterminate={partial}
              onchange={(e) => toggleNode(n.id, (e.currentTarget as HTMLInputElement).checked)} />
            <span class="tree-label">{n.label}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .modes {
    display: grid; grid-template-columns: 1fr 1.2fr 1.3fr; gap: 10px;
  }
  /* Phone: three explainer cards in a row read one word per line. Stack. */
  @media (max-width: 639px) {
    .modes { grid-template-columns: minmax(0, 1fr); }
  }
  .mode-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 6px;
    max-height: 260px;
  }
  .mode-head { display: flex; align-items: center; gap: 8px; }
  .mode-badge {
    font-size: 10px; font-weight: 800; padding: 2px 8px;
    border-radius: 4px; letter-spacing: 0.05em;
  }
  .mode-badge-excel { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
  .mode-badge-async { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; }
  .mode-badge-tree  { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
  .mode-card strong { font-size: 13px; color: var(--sg-fg, #0f172a); }
  .mode-card p { margin: 0; font-size: 12px; color: var(--sg-muted, #64748b); }
  .mode-cta { display: flex; gap: 6px; flex-wrap: wrap; }
  .link-btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 4px 10px;
    font-size: 11.5px; font-weight: 600; cursor: pointer;
  }
  .link-btn:hover { background: color-mix(in oklab, var(--sg-accent, #6366f1) 6%, transparent); }
  .link-btn.primary {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border-color: transparent;
  }
  .link-btn.primary:hover { filter: brightness(1.08); }

  .loading { display: flex; align-items: center; gap: 6px; color: #d97706 !important; }
  .err { color: #b91c1c !important; }
  .spin {
    display: inline-block; width: 11px; height: 11px;
    border: 2px solid color-mix(in oklab, #f59e0b 30%, transparent);
    border-top-color: #f59e0b; border-radius: 50%;
    animation: spin 700ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .search {
    width: 100%;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #fff);
    border-radius: 5px; padding: 4px 8px; font-size: 12px;
  }
  .vlist {
    list-style: none; margin: 0; padding: 0;
    max-height: 140px; overflow-y: auto;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 5px;
    background: var(--sg-bg, #fff);
  }
  .vlist li { display: block; }
  .vlist label {
    display: flex; align-items: center; gap: 6px;
    padding: 3px 8px; font-size: 11.5px; cursor: pointer;
  }
  .vlist label:hover { background: color-mix(in oklab, var(--sg-accent, #6366f1) 6%, transparent); }
  .vlist input { accent-color: #f59e0b; }
  .mode-foot {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; color: var(--sg-muted, #64748b);
  }

  /* Tree */
  .tree-actions { display: flex; gap: 6px; }
  .tree {
    list-style: none; margin: 0; padding: 4px 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 5px;
    overflow-y: auto; max-height: 175px;
    background: var(--sg-bg, #fff);
  }
  .tree-node {
    display: flex; align-items: center; gap: 5px;
    padding: 2px 8px; font-size: 12px;
    cursor: pointer;
  }
  .tree-node:hover { background: color-mix(in oklab, var(--sg-accent, #6366f1) 6%, transparent); }
  .tree-node.depth-0 { padding-left: 8px;  font-weight: 700; color: var(--sg-fg, #0f172a); }
  .tree-node.depth-1 { padding-left: 26px; font-weight: 600; color: var(--sg-accent, #4338ca); }
  .tree-node.depth-2 { padding-left: 50px; }
  .chev {
    width: 14px; height: 14px;
    background: transparent; border: 0; cursor: pointer;
    color: var(--sg-muted, #64748b);
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 3px;
  }
  .chev svg { transition: transform 140ms; }
  .chev svg.is-open { transform: rotate(90deg); }
  .chev-spacer { display: inline-block; width: 14px; height: 14px; }
  .tree-node input { accent-color: var(--sg-accent, #6366f1); }

  /* Status cells */
  :global(td.status-open)      { color: #6366f1; font-weight: 600; }
  :global(td.status-paid)      { color: #1d4ed8; font-weight: 600; }
  :global(td.status-shipped)   { color: #d97706; font-weight: 600; }
  :global(td.status-delivered) { color: #16a34a; font-weight: 700; }
  :global(td.status-returned)  { color: #b91c1c; font-weight: 600; }
</style>
