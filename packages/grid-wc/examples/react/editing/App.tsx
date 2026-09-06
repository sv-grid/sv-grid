import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns, type Person } from '../data'

/**
 * Inline editing, with the change written back into React state.
 *
 * `cellvaluechange` fires once per committed edit and its detail is typed, so
 * `rowIndex`, `columnId` and `newValue` come through without a cast. Replace
 * the setState with your own save call.
 */
export default function App() {
  const [rows, setRows] = useState<Person[]>(people)
  const [log, setLog] = useState<string[]>([])

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, font: '13px system-ui', color: '#64748b' }}>
        Double-click a Name or Amount cell. Last edits: {log.slice(-3).join(' · ') || 'none yet'}
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={rows}
          columns={columns.map((c) =>
            c.id === 'name' || c.id === 'amount' ? { ...c, editable: true } : c,
          )}
          sortable
          filterable
          editable
          onCellValueChange={(e) => {
            setRows((prev) =>
              prev.map((row, i) => (i === e.rowIndex ? { ...row, [e.columnId]: e.newValue } : row)),
            )
            setLog((prev) => [...prev, `${e.columnId} = ${String(e.newValue)}`])
          }}
        />
      </div>
    </div>
  )
}
