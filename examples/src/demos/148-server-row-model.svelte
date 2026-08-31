<!-- Documented in: docs/help/server/server-row-model.md -->
<script lang="ts">
  /**
   * 148. Server-Side Row Model (SSRM)
   * ---------------------------------
   * One datasource contract for server-backed data. You implement a single
   * async `getRows({ startRow, endRow, sortModel, filterModel })`;
   * `createServerDataSource` owns the request lifecycle (sort, filter, page),
   * races stale responses away, and pushes `{ rows, total, loading }` back.
   *
   * Here the "server" is a 100,000-row in-memory table behind a simulated
   * 250ms latency - the grid only ever holds the current 50-row page.
   */
  import {
    SvGrid,
    createServerDataSource,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type ServerDataSource,
    type ServerState,
  } from '@svgrid/grid'

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
          rows = rows.filter((r) => allowed.has(String((r as any)[id])))
        }
        // Operator (text) filter: substring match.
        const v = f.value.trim().toLowerCase()
        if (v) rows = rows.filter((r) => String((r as any)[id]).toLowerCase().includes(v))
      }
      const sort = req.sortModel[0]
      if (sort) {
        rows = [...rows].sort((a, b) => {
          const av = (a as any)[sort.id]
          const bv = (b as any)[sort.id]
          const c = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
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

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id', header: 'ID', width: 90, align: 'right' },
    { field: 'name', header: 'Name', width: 200 },
    { field: 'team', header: 'Team', width: 140 },
    { field: 'country', header: 'Country', width: 110 },
    { field: 'salary', header: 'Salary', width: 150, align: 'right', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  let s = $state<ServerState<Row>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 50, pageCount: 1, sortModel: [], filterModel: {},
  })
  const ctl = createServerDataSource(source, { pageSize: 50, onChange: (next) => (s = next) })
  ctl.refresh()
  $effect(() => () => ctl.dispose())

  const rangeStart = $derived(s.total === 0 ? 0 : s.pageIndex * s.pageSize + 1)
  const rangeEnd = $derived(Math.min(s.total, (s.pageIndex + 1) * s.pageSize))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      100,000 rows on the "server" via <code>createServerDataSource</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      The grid holds only the current 50-row page. Sort a header or open a
      column filter - the request goes to the datasource (250ms simulated
      latency), and stale responses are raced away automatically.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
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
  </div>

  <footer class="shrink-0 flex items-center gap-3 text-sm" style="color: var(--sg-fg);">
    <button class="srm-btn" disabled={s.pageIndex <= 0 || s.loading} onclick={() => ctl.setPage(s.pageIndex - 1)}>‹ Prev</button>
    <button class="srm-btn" disabled={s.pageIndex >= s.pageCount - 1 || s.loading} onclick={() => ctl.setPage(s.pageIndex + 1)}>Next ›</button>
    <span style="color: var(--sg-muted)">
      {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {s.total.toLocaleString()}
      · page {s.pageIndex + 1}/{s.pageCount}
      {#if s.loading}· <span style="color: var(--site-accent, #2563eb)">loading…</span>{/if}
    </span>
  </footer>
</section>

<style>
  .srm-btn {
    padding: 5px 12px;
    border: 1px solid var(--sg-border);
    border-radius: 6px;
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-size: 13px;
    cursor: pointer;
  }
  .srm-btn:disabled { opacity: 0.45; cursor: default; }
</style>
