<script lang="ts">
  /**
   * 09. Server-side data
   * --------------------
   * Sort, filter, and page are pushed to a mock "server" (an async function
   * over a large seeded dataset). Only the visible page is held in memory.
   * The dev-loop pattern:
   *   1. owning state is in this component
   *   2. an effect debounces (250 ms) and turns state into a query
   *   3. an AbortController cancels stale requests
   *
   * The grid runs in `externalSort` + `externalFilter` mode so its built-in
   * sort/filter UI only updates the *query state* - the actual fetch goes
   * back to the endpoint, which sees the full 100k-row dataset.
   *
   * Replace `mockEndpoint` with `fetch('/api/people?...')` and the rest of
   * the structure stays the same.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First name', editorType: 'text' },
    { field: 'lastName',   header: 'Last name',  editorType: 'text' },
    { field: 'department', header: 'Department', editorType: 'text' },
    { field: 'country',    header: 'Country',    editorType: 'text' },
    { field: 'age',        header: 'Age',        editorType: 'number' },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  // The "remote" dataset. Held in module scope so the demo doesn't regenerate it on every key press.
  const ALL = makePeople(100_000)

  type SortClause = { id: string; desc: boolean }
  type GridFilter = {
    id: string
    operator: string
    value: string
    selectedValues?: Array<string>
  }
  type Query = {
    q: string
    department: string
    page: number
    pageSize: number
    sort: SortClause[]
    gridFilters: GridFilter[]
  }

  let q = $state('')
  let dept = $state('')
  let page = $state(0)
  const pageSize = 25
  let loading = $state(false)
  let total = $state(0)
  let rows = $state<Person[]>([])
  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let sortClauses = $state<SortClause[]>([])
  let gridFilters = $state<GridFilter[]>([])

  function getField(person: Person, id: string): unknown {
    return (person as unknown as Record<string, unknown>)[id]
  }

  function matchesGridFilter(person: Person, filter: GridFilter): boolean {
    const raw = getField(person, filter.id)
    if (filter.selectedValues && filter.selectedValues.length) {
      if (!filter.selectedValues.includes(String(raw ?? ''))) return false
    }
    const op = filter.operator
    const v = filter.value
    if (!v && op !== 'isBlank') return true
    const text = String(raw ?? '').toLowerCase()
    const needle = v.toLowerCase()
    switch (op) {
      case 'contains':    return text.includes(needle)
      case 'equals':      return text === needle
      case 'startsWith':  return text.startsWith(needle)
      case 'greaterThan': return Number(raw) > Number(v)
      case 'lessThan':    return Number(raw) < Number(v)
      case 'isBlank':     return raw === null || raw === undefined || String(raw) === ''
      default:            return true
    }
  }

  // Faked "network" latency. Kept just long enough to show a "Loading…" flash
  // on slow connections without making the demo feel laggy. Real apps obviously
  // get whatever the wire gives them.
  const NETWORK_LATENCY_MS = 60

  async function mockEndpoint(query: Query, signal: AbortSignal): Promise<{ rows: Person[]; total: number }> {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, NETWORK_LATENCY_MS)
      signal.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
    let matches = ALL.filter((p) => {
      if (query.q && !`${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(query.q.toLowerCase())) return false
      if (query.department && p.department !== query.department) return false
      for (const f of query.gridFilters) if (!matchesGridFilter(p, f)) return false
      return true
    })
    if (query.sort.length) {
      // Raw `<` / `>` is ~10x faster than Intl.Collator over 100k rows and
      // good enough for a demo. A real server would push this to the DB.
      matches = [...matches].sort((a, b) => {
        for (const clause of query.sort) {
          const av = getField(a, clause.id)
          const bv = getField(b, clause.id)
          let r: number
          if (typeof av === 'number' && typeof bv === 'number') r = av - bv
          else {
            const as = String(av ?? '')
            const bs = String(bv ?? '')
            r = as < bs ? -1 : as > bs ? 1 : 0
          }
          if (r !== 0) return clause.desc ? -r : r
        }
        return 0
      })
    }
    const start = query.page * query.pageSize
    return { rows: matches.slice(start, start + query.pageSize), total: matches.length }
  }

  let controller: AbortController | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function runQuery() {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    loading = true
    mockEndpoint(
      { q, department: dept, page, pageSize, sort: sortClauses, gridFilters },
      signal,
    )
      .then((res) => {
        if (signal.aborted) return
        rows = res.rows
        total = res.total
        loading = false
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          console.error(err)
          loading = false
        }
      })
  }

  // Click-driven inputs (page, department dropdown, column sort) fire
  // immediately - a click should never wait on a debounce timer.
  $effect(() => {
    page; dept; sortClauses
    runQuery()
  })

  // Typed inputs (search box, in-grid column filter value) are debounced so
  // we don't hammer the "server" on every keystroke.
  $effect(() => {
    q; gridFilters
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(runQuery, 120)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  })

  const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-end gap-3 text-sm shrink-0">
    <label class="flex flex-col">
      <span class="text-slate-500 dark:text-slate-400">Search</span>
      <input
        type="text"
        bind:value={q}
        oninput={() => (page = 0)}
        placeholder="name or email"
        class="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 w-56"
      />
    </label>
    <label class="flex flex-col">
      <span class="text-slate-500 dark:text-slate-400">Department</span>
      <select
        bind:value={dept}
        onchange={() => (page = 0)}
        class="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 w-48"
      >
        <option value="">All</option>
        <option>Engineering</option>
        <option>Design</option>
        <option>Product</option>
        <option>Sales</option>
        <option>Support</option>
        <option>Operations</option>
      </select>
    </label>
    <span class="ml-auto text-slate-500 dark:text-slate-400">
      {#if loading}<span aria-live="polite">Loading…</span>{:else}{total.toLocaleString()} matches{/if}
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      externalSort={true}
      externalFilter={true}
      onSortingChange={(next) => {
        sortClauses = next
        page = 0
      }}
      onFiltersChange={(next) => {
        gridFilters = next.columns
        page = 0
      }}
      onApiReady={(next) => (api = next)}
    />
  </div>

  <nav class="flex items-center justify-between text-sm shrink-0">
    <button
      type="button"
      onclick={() => (page = Math.max(0, page - 1))}
      disabled={page === 0 || loading}
      class="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 disabled:opacity-50"
    >‹ Previous</button>
    <span class="text-slate-500 dark:text-slate-400">Page {page + 1} of {pageCount.toLocaleString()}</span>
    <button
      type="button"
      onclick={() => (page = Math.min(pageCount - 1, page + 1))}
      disabled={page + 1 >= pageCount || loading}
      class="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 disabled:opacity-50"
    >Next ›</button>
  </nav>
</section>
