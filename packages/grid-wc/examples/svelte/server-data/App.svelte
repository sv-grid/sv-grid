<script lang="ts">
  /**
   * Mirrors examples/react/server-data/App.tsx.
   *
   * `externalSort` and `externalPagination` stop the grid doing the work
   * locally; `rowCount` is how it knows how many pages exist. `fetchPage`
   * stands in for an API call, delay included, so the loading state is real.
   */
  import GridBody from '../../../src/GridBody.svelte'
  import { people, columns, type Person } from '../data'

  type Sort = Array<{ id: string; desc: boolean }>
  type Query = { page: number; sort: Sort }

  const PAGE_SIZE = 25

  function fetchPage({ page, sort }: Query): Promise<{ rows: Person[]; total: number }> {
    const sorted = [...people].sort((a, b) => {
      for (const s of sort) {
        const av = a[s.id as keyof Person]
        const bv = b[s.id as keyof Person]
        if (av === bv) continue
        return (av > bv ? 1 : -1) * (s.desc ? -1 : 1)
      }
      return 0
    })
    const start = page * PAGE_SIZE
    return new Promise((resolve) =>
      setTimeout(
        () => resolve({ rows: sorted.slice(start, start + PAGE_SIZE), total: sorted.length }),
        250,
      ),
    )
  }

  let query = $state<Query>({ page: 0, sort: [] })
  let rows = $state<Person[]>([])
  let total = $state(0)
  let loading = $state(true)

  // React runs this in a useEffect keyed on `query`; $effect tracks the same
  // dependency without being told, and the cleanup does the same job as the
  // `cancelled` flag - a slow response for a page the user has left is dropped.
  $effect(() => {
    const current = query
    let cancelled = false
    loading = true
    fetchPage(current).then((res) => {
      if (cancelled) return
      rows = res.rows
      total = res.total
      loading = false
    })
    return () => {
      cancelled = true
    }
  })
</script>

<div class="mirror">
  <div class="mirror-grid">
    <GridBody
      emit={(name: string, detail: unknown) => {
        if (name === 'sortingchange') query = { sort: detail as Sort, page: 0 }
        if (name === 'paginationchange')
          query = { ...query, page: (detail as { pageIndex: number }).pageIndex }
      }}
      data={rows}
      {columns}
      {loading}
      sortable
      externalSort
      externalPagination
      pageable
      pageSize={PAGE_SIZE}
      rowCount={total}
      pageIndex={query.page}
    />
  </div>
</div>

<style>
  .mirror {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    /* min-width, not just min-height: this is a flex item, and a flex item's
       automatic minimum size is its MIN-CONTENT width, which for a grid is the
       sum of its column widths. Without this it can never be laid out narrower
       than its widest possible self. */
    min-width: 0;
  }
  .mirror-grid {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
