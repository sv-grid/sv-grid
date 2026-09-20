<!-- Documented in: docs/help/server/server-row-model.md -->
<script lang="ts">
  /**
   * 148. Server-Side Row Model: paged and infinite
   * ---------------------------------------------
   * One datasource contract for server-backed data. You implement a single
   * async `getRows({ startRow, endRow, sortModel, filterModel })`;
   * `createServerDataSource` owns the request lifecycle (sort, filter, page),
   * races stale responses away, and pushes `{ rows, total, loading }` back.
   *
   * Here the "server" is a 100,000-row in-memory table behind a simulated
   * 250ms latency. Switch between the two ways to consume it:
   *
   *   - PAGED: the grid holds one 50-row page and a pager moves between them.
   *   - INFINITE: one scrollable list of 100,000 rows. Blocks load as you
   *     reach them, rows you have not reached render as skeletons, and the
   *     cache keeps only the last few blocks.
   *
   * Both are the same controller and the same `getRows`; only `mode` differs.
   * Infinite mode also shows off the one-prop wiring: `rowModel={ctl}` in
   * place of the eight props the paged half spells out.
   */
  import {
    SvGrid,
    createServerDataSource,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type ServerDataSource,
    type ServerState,
    rowPlaceholderState,
  } from '@svgrid/grid'
  import BlockMap from '../shared/BlockMap.svelte'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; name: string; team: string; country: string; salary: number }
  const TEAMS = ['Research', 'Compilers', 'Kernel', 'Apollo', 'Web', 'Data']
  const COUNTRIES = ['US', 'DE', 'JP', 'UK', 'BR', 'IN', 'AU']
  const FIRST = ['Ada', 'Grace', 'Alan', 'Linus', 'Donald', 'Brian', 'Margaret', 'Dennis', 'Ken', 'Barbara']
  // The "database": 100k rows that never touch the grid wholesale.
  const DB: Row[] = Array.from({ length: 100_000 }, (_, id) => ({
    id,
    name: `${FIRST[id % FIRST.length]} #${id}`,
    team: TEAMS[id % TEAMS.length]!,
    country: COUNTRIES[id % COUNTRIES.length]!,
    salary: 40_000 + ((id * 7919) % 160_000),
  }))

  // The datasource the consumer implements - sort + filter + slice on the
  // "server", behind a fake latency.
  const source: ServerDataSource<Row> = {
    async getRows(req) {
      await new Promise((r) => setTimeout(r, 250))
      let rows = DB
      const g = req.filterModel.global?.trim().toLowerCase()
      if (g) rows = rows.filter((r) => r.name.toLowerCase().includes(g) || r.team.toLowerCase().includes(g))
      const cols = req.filterModel.columns ?? {}
      for (const [id, f] of Object.entries(cols)) {
        // Facet (checklist) selection: keep rows whose value is selected.
        if (f.selectedValues && f.selectedValues.length) {
          const allowed = new Set(f.selectedValues)
          rows = rows.filter((r) => allowed.has(String((r as Record<string, unknown>)[id])))
        }
        // Operator (text) filter: substring match.
        const v = f.value.trim().toLowerCase()
        if (v) rows = rows.filter((r) => String((r as Record<string, unknown>)[id]).toLowerCase().includes(v))
      }
      const sort = req.sortModel[0]
      if (sort) {
        rows = [...rows].sort((a, b) => {
          const av = (a as Record<string, unknown>)[sort.id]
          const bv = (b as Record<string, unknown>)[sort.id]
          const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
          return sort.desc ? -c : c
        })
      }
      return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
    },
  }

  // Server-side set-filter values: the checklist shows EVERY distinct value from
  // the 100k-row server, not just the 50 on the current page. Fetched on demand
  // when a column's filter menu opens (and cached by the grid).
  async function distinctValues(columnId: string): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 150)) // simulated server query
    if (columnId !== 'team' && columnId !== 'country') return []
    const set = new Set<string>()
    for (const r of DB) set.add(String((r as Record<string, unknown>)[columnId]))
    return [...set].sort()
  }

  const columns: GridColumns<Row> = [
    { field: 'id', header: 'ID', width: 90, align: 'right' },
    { field: 'name', header: 'Name', width: 200 },
    { field: 'team', header: 'Team', width: 140 },
    { field: 'country', header: 'Country', width: 110 },
    { field: 'salary', header: 'Salary', width: 150, align: 'right', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  let mode = $state<'page' | 'infinite'>('page')

  let s = $state<ServerState<Row>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 50, pageCount: 1, sortModel: [], filterModel: {},
  })
  const ctl = createServerDataSource(source, { pageSize: 50, onChange: (next) => (s = next) })
  ctl.refresh()

  // The same source, consumed as one long list. `maxBlocksInCache` is small
  // on purpose: scroll far enough and blocks behind you are evicted, which
  // is what keeps memory flat on a table this size.
  let inf = $state<ServerState<Row>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 100, pageCount: 1, sortModel: [], filterModel: {},
  })
  const infCtl = createServerDataSource(source, {
    mode: 'infinite',
    blockSize: 100,
    maxBlocksInCache: 6,
    onChange: (next) => (inf = next),
  })

  $effect(() => () => {
    ctl.dispose()
    infCtl.dispose()
  })

  const rangeStart = $derived(s.total === 0 ? 0 : s.pageIndex * s.pageSize + 1)
  const rangeEnd = $derived(Math.min(s.total, (s.pageIndex + 1) * s.pageSize))
  const loadedRows = $derived(
    inf.rows.reduce((n, r) => (rowPlaceholderState(r) ? n : n + 1), 0),
  )
  // Hangs off `inf`: a bare `infCtl.getCacheState()` in the markup reads no
  // rune, so Svelte would render it once and never again.
  const cachedBlocks = $derived.by(() => {
    void inf.rows
    return infCtl.getCacheState().length
  })
  // The cache drawn: with six blocks kept, the ones behind you fall out
  // as you scroll, which the map shows better than a count.
  const cacheLevels = $derived.by(() => {
    void inf.rows
    return [{ label: 'rows', rowCount: inf.rowCount ?? inf.total, blocks: infCtl.getCacheState() }]
  })
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="seg mode-seg" role="group" aria-label="Row model">
      <button type="button" class:is-on={mode === 'page'} aria-pressed={mode === 'page'} onclick={() => (mode = 'page')}>Paged</button>
      <button type="button" class:is-on={mode === 'infinite'} aria-pressed={mode === 'infinite'} onclick={() => (mode = 'infinite')}>Infinite scroll</button>
    </div>
    {#if mode === 'page'}
      <span class="note">
        100,000 rows on the "server" through <code>createServerDataSource</code>; the grid holds only the
        current 50-row page. Sort a header or open a column filter: the request goes to the datasource
        (250 ms simulated latency), and stale responses are raced away. This half spells out the props
        the controller feeds the grid.
      </span>
    {:else}
      <span class="note">
        One list of 100,000 rows. Blocks of 100 load as you scroll into them, rows you have not reached
        render as placeholders, and only the last 6 blocks are kept: scroll back far enough and they
        reload. The whole grid is wired by one <code>rowModel</code> prop.
      </span>
    {/if}
  </header>

  <div class="gridpane">
    {#if mode === 'infinite'}
      <!-- Everything the paged branch spells out below - data, loading,
           externalSort, externalFilter, the two change handlers, the
           visible range, the skeleton rows - comes from the controller. -->
      <SvGrid responsive={true}
        columnResize
        rowModel={infCtl}
        columns={columns}
        features={features}
        sortable
        filterable
        filterMode="menu"
        serverFilterValues={distinctValues}
        selectionMode="none"
        rowHeight={34}
        containerHeight="100%"
        fitColumns={true}
      />
      <BlockMap levels={cacheLevels} max={1} title="Block cache (6 kept)" />
    {:else}
    <SvGrid responsive={true}
      columnResize
      data={s.rows}
      columns={columns}
      features={features}
      sortable
      filterable
      filterMode="menu"
      serverFilterValues={distinctValues}
      externalSort
      externalFilter
      loading={s.loading}
      loadingOverlay
      pageable={false}
      selectionMode="none"
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      onSortingChange={(sorting) => ctl.setSort(sorting)}
      onFiltersChange={(f) => ctl.setFilter({
        global: f.global,
        columns: Object.fromEntries(
          f.columns.map((c) => [
            c.id,
            { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues },
          ]),
        ),
      })}
    />
    {/if}
  </div>

  <footer class="foot">
    {#if mode === 'page'}
      <div class="actions">
        <button type="button" class="btn" disabled={s.pageIndex <= 0 || s.loading} onclick={() => ctl.setPage(s.pageIndex - 1)}>Previous</button>
        <button type="button" class="btn" disabled={s.pageIndex >= s.pageCount - 1 || s.loading} onclick={() => ctl.setPage(s.pageIndex + 1)}>Next</button>
      </div>
      <span class="stat"><span class="stat-label">Rows</span><strong>{rangeStart.toLocaleString()} - {rangeEnd.toLocaleString()}</strong> of {s.total.toLocaleString()}</span>
      <span class="stat"><span class="stat-label">Page</span><strong>{s.pageIndex + 1}</strong> of {s.pageCount.toLocaleString()}</span>
      {#if s.loading}<span class="stat">loading...</span>{/if}
      {#if s.error}<span class="stat err">{String((s.error as Error).message ?? s.error)}</span>{/if}
    {:else}
      <div class="actions">
        <button type="button" class="btn" onclick={() => infCtl.purge()} title="Drop every cached block and re-read the viewport">Purge cache</button>
      </div>
      <span class="stat"><span class="stat-label">Loaded</span><strong>{loadedRows.toLocaleString()}</strong> of {inf.total.toLocaleString()} rows</span>
      <span class="stat"><span class="stat-label">Cache</span><strong>{cachedBlocks}</strong> block{cachedBlocks === 1 ? '' : 's'}</span>
      {#if inf.loading}<span class="stat">loading...</span>{/if}
      {#if inf.error}<span class="stat err">{String((inf.error as Error).message ?? inf.error)}</span>{/if}
    {/if}
  </footer>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit.
     The grid pane stacks the grid over the block map in infinite mode. */
  .gridpane { display: flex; flex-direction: column; }
  .gridpane :global(.sv-grid-root) { flex: 1; min-height: 0; }
  .gridpane :global(.blockmap) { flex: none; margin-top: 8px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; }
</style>
