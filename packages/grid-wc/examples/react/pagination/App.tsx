import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * Client-side paging. `pageSize` is read once at mount - it is the INITIAL
 * page size - so change pages through the footer or the grid api rather than
 * by reassigning the prop.
 */
export default function App() {
  return (
    <div style={{ height: '100%', padding: 16 }}>
      <SvGrid
        data={people}
        columns={columns}
        sortable
        filterable
        pageable
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        paginationPosition="bottom"
      />
    </div>
  )
}
