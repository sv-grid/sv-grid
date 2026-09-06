import { useEffect, useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns, type Person } from '../data'

type Query = { page: number; sort: Array<{ id: string; desc: boolean }> }

/**
 * Server-side data: the grid renders whatever page you hand it and tells you
 * when the user wants a different one.
 *
 * `externalSort` and `externalPagination` stop the grid doing the work
 * locally; `rowCount` is how it knows how many pages exist. `fetchPage` here
 * stands in for your API call.
 */
const PAGE_SIZE = 25

function fetchPage({ page, sort }: Query): Promise<{ rows: Person[]; total: number }> {
  // Pretend this is a network call.
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
    setTimeout(() => resolve({ rows: sorted.slice(start, start + PAGE_SIZE), total: sorted.length }), 250),
  )
}

export default function App() {
  const [query, setQuery] = useState<Query>({ page: 0, sort: [] })
  const [rows, setRows] = useState<Person[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPage(query).then((res) => {
      if (cancelled) return
      setRows(res.rows)
      setTotal(res.total)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div style={{ height: '100%', padding: 16 }}>
      <SvGrid
        data={rows}
        columns={columns}
        loading={loading}
        sortable
        externalSort
        externalPagination
        pageable
        pageSize={PAGE_SIZE}
        rowCount={total}
        pageIndex={query.page}
        onSortingChange={(sort) => setQuery((q) => ({ ...q, sort, page: 0 }))}
        onPaginationChange={(p) => setQuery((q) => ({ ...q, page: (p as { pageIndex: number }).pageIndex }))}
      />
    </div>
  )
}
