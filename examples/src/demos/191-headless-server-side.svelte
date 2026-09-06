<!-- Documented in: docs/help/headless/server-side.md -->
<script lang="ts">
  /**
   * 191. Headless, server-side - paging + sorting + filtering + load on demand
   * --------------------------------------------------------------------------
   * The "server" owns the data. Sorting, filtering and paging are query params
   * you send to it; it returns ONLY the current page (plus a total count). The
   * headless engine wraps that page - no local pipeline, so it never sees the
   * other 480 rows. Every state change fires one request; you watch the count
   * climb. The markup is a plain hand-styled <table>.
   */
  import { createSvGrid, createCoreRowModel, tableFeatures, type GridColumns } from '@svgrid/grid'

  type Row = { id: number; name: string; dept: string; salary: number }
  type SortKey = 'name' | 'dept' | 'salary'

  // ---- The "database" (pretend this lives behind an API) -------------------
  const DEPTS = ['Engineering', 'Sales', 'Support', 'Design', 'Finance']
  const FIRST = ['Ava', 'Liam', 'Noah', 'Mia', 'Zoe', 'Kai', 'Ivy', 'Leo', 'Ada', 'Sam']
  const DB: Row[] = Array.from({ length: 483 }, (_, i) => ({
    id: i + 1,
    name: `${FIRST[(i * 7) % FIRST.length]} ${String.fromCharCode(65 + (i % 26))}.`,
    dept: DEPTS[(i * 3) % DEPTS.length]!,
    salary: 55_000 + ((i * 811) % 90_000),
  }))

  // ---- The "endpoint": GET /employees?page&size&sort&dir&q ----------------
  type Query = { pageIndex: number; pageSize: number; sort: SortKey; desc: boolean; q: string }
  type Page = { rows: Row[]; total: number }
  function fetchEmployees(query: Query): Promise<Page> {
    return new Promise((resolve) => {
      // 350ms of pretend network + DB latency
      setTimeout(() => {
        let rows = DB
        const q = query.q.trim().toLowerCase()
        if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.dept.toLowerCase().includes(q))
        rows = [...rows].sort((a, b) => {
          const av = a[query.sort], bv = b[query.sort]
          const c = av < bv ? -1 : av > bv ? 1 : 0
          return query.desc ? -c : c
        })
        const total = rows.length
        const start = query.pageIndex * query.pageSize
        resolve({ rows: rows.slice(start, start + query.pageSize), total })
      }, 350)
    })
  }

  // ---- Client state (what we send to the server) --------------------------
  const pageSize = 8
  let pageIndex = $state(0)
  let sort = $state<SortKey>('name')
  let desc = $state(false)
  let q = $state('')

  // ---- Server response ----------------------------------------------------
  let pageRows = $state<Row[]>([])
  let total = $state(0)
  let loading = $state(false)
  let requests = $state(0)
  let reqSeq = 0

  // Any state change -> one request. A sequence guard drops stale responses.
  $effect(() => {
    const query: Query = { pageIndex, pageSize, sort, desc, q }
    const mine = ++reqSeq
    loading = true
    fetchEmployees(query).then((res) => {
      if (mine !== reqSeq) return // a newer request already superseded this one
      pageRows = res.rows
      total = res.total
      requests += 1
      loading = false
    })
  })

  // ---- Headless engine: wrap ONLY the returned page -----------------------
  const features = tableFeatures({})
  const columns: GridColumns<Row> = [
    { field: 'name', header: 'Name' },
    { field: 'dept', header: 'Department' },
    { field: 'salary', header: 'Salary' },
  ]
  const table = $derived.by(() =>
    createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      data: pageRows, // already sorted / filtered / paged by the "server"
      columns,
    }),
  )
  const rows = $derived(table.getRowModel().rows)

  const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)))
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  function toggleSort(id: SortKey) {
    if (sort === id) desc = !desc
    else { sort = id; desc = false }
    pageIndex = 0 // sorting changes the whole result -> back to page 1
  }
  function onSearch(v: string) { q = v; pageIndex = 0 }
  function go(delta: number) { pageIndex = Math.min(pageCount - 1, Math.max(0, pageIndex + delta)) }
  const ind = (id: SortKey) => (sort === id ? (desc ? ' ▼' : ' ▲') : '')
</script>

<section class="ss-wrap">
  <div class="ss-toolbar">
    <input
      class="ss-search"
      placeholder="Search name or department…"
      value={q}
      oninput={(e) => onSearch((e.currentTarget as HTMLInputElement).value)}
    />
    <span class="ss-stat">{total} matching rows</span>
    <span class="ss-stat ss-req">{requests} server requests</span>
  </div>

  <div class="ss-tablewrap" class:loading>
    <table>
      <thead>
        <tr>
          {#each columns as col (col.field)}
            <th class:num={col.field === 'salary'} onclick={() => toggleSort(col.field as SortKey)}>
              {col.header}{ind(col.field as SortKey)}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.id)}
          {@const row = r.original as Row}
          <tr>
            <td>{row.name}</td>
            <td>{row.dept}</td>
            <td class="num">{fmt(row.salary)}</td>
          </tr>
        {/each}
        {#if rows.length === 0 && !loading}
          <tr><td colspan="3" class="ss-empty">No rows match "{q}".</td></tr>
        {/if}
      </tbody>
    </table>
    {#if loading}<div class="ss-spinner">Loading…</div>{/if}
  </div>

  <div class="ss-pager">
    <button onclick={() => go(-1)} disabled={pageIndex === 0 || loading}>‹ Prev</button>
    <span class="ss-pageinfo">Page {pageIndex + 1} of {pageCount}</span>
    <button onclick={() => go(1)} disabled={pageIndex >= pageCount - 1 || loading}>Next ›</button>
  </div>
</section>

<style>
  .ss-wrap { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
  .ss-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  .ss-search {
    flex: 1 1 220px; min-width: 180px; padding: 7px 11px; font-size: 13px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 7px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .ss-search:focus { outline: 2px solid var(--sg-accent, #6366f1); outline-offset: -1px; }
  .ss-stat {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b); white-space: nowrap;
  }
  .ss-req { color: var(--sg-accent, #6366f1); }
  .ss-tablewrap { position: relative; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; overflow: hidden; min-height: 200px; }
  .ss-tablewrap.loading table { opacity: 0.45; transition: opacity 0.1s; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; color: var(--sg-fg, #0f172a); }
  th {
    text-align: left; padding: 9px 14px; cursor: pointer; user-select: none; font-weight: 700;
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc)); border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  th:hover { color: var(--sg-accent, #6366f1); }
  td { padding: 8px 14px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .ss-empty { text-align: center; color: var(--sg-muted, #94a3b8); padding: 24px; }
  .ss-spinner {
    position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none;
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-accent, #6366f1);
  }
  .ss-pager { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .ss-pager button {
    padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 7px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .ss-pager button:hover:not(:disabled) { border-color: var(--sg-accent, #6366f1); color: var(--sg-accent, #6366f1); }
  .ss-pager button:disabled { opacity: 0.4; cursor: default; }
  .ss-pageinfo { font-size: 13px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
</style>
