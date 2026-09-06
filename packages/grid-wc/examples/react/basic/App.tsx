import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * The smallest useful grid: rows, columns, and the two features almost every
 * table wants. `data` and `columns` are arrays, so they cross as properties -
 * the wrapper handles that on every React version.
 */
export default function App() {
  return (
    <div style={{ height: '100%', padding: 16 }}>
      <SvGrid data={people} columns={columns} sortable filterable />
    </div>
  )
}
