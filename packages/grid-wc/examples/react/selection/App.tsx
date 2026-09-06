import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns, type Person } from '../data'

/**
 * Row checkboxes, with the selected rows handed to React so you can act on
 * them. `rowselectionchange` carries both the selection map and the rows
 * themselves, so you rarely need to look anything up.
 */
export default function App() {
  const [selected, setSelected] = useState<Person[]>([])
  const total = selected.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ font: '13px system-ui', color: '#64748b' }}>
        {selected.length === 0
          ? 'Tick some rows to total them'
          : `${selected.length} selected · ${total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={people}
          columns={columns}
          sortable
          filterable
          showRowSelection
          onRowSelectionChange={(e) => setSelected(e.rows as Person[])}
        />
      </div>
    </div>
  )
}
