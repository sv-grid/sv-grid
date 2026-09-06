import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * A filter row under the headers, multi-column sort, and the current sort read
 * back into React state. `onSortingChange` hands you the same array the grid
 * holds, so it can drive your own UI.
 */
export default function App() {
  const [sorting, setSorting] = useState<Array<{ id: string; desc: boolean }>>([])

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, font: '13px system-ui', color: '#64748b' }}>
        Sorted by:{' '}
        {sorting.length === 0
          ? 'nothing yet - click a header, then shift-click a second one'
          : sorting.map((s) => `${s.id} ${s.desc ? 'desc' : 'asc'}`).join(', ')}
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={people}
          columns={columns}
          sortable
          filterable
          showFilterRow
          onSortingChange={setSorting}
        />
      </div>
    </div>
  )
}
