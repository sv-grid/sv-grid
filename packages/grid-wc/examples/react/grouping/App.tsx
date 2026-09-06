import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * Grouping by one or two columns, with an aggregate in the group row.
 *
 * `groupBy` is an array, so it is one of the props that can only be a
 * property - which is the whole reason the React wrapper exists.
 */
export default function App() {
  const [groupBy, setGroupBy] = useState<string[]>(['team'])

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, font: '13px system-ui' }}>
        {[['team'], ['country'], ['team', 'country'], []].map((g) => (
          <button
            key={g.join('+') || 'none'}
            onClick={() => setGroupBy(g)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: groupBy.join() === g.join() ? '#e2e8f0' : '#fff',
              cursor: 'pointer',
            }}
          >
            {g.join(' + ') || 'No grouping'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          data={people}
          columns={columns.map((c) => (c.id === 'amount' ? { ...c, aggregate: 'sum' } : c))}
          sortable
          filterable
          groupable
          groupBy={groupBy}
          groupFooters
        />
      </div>
    </div>
  )
}
