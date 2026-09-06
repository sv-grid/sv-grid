// Drives the BUILT React wrapper the way a consumer does: object props passed
// straight through JSX, which is the case React <=18 gets wrong without it.
import { createRoot } from 'react-dom/client'
import { createElement as h, useRef, useState } from 'react'
import { SvGrid } from '../../../dist/react/index.js'

const rows = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1, name: 'Person ' + (i + 1),
  city: ['Sofia', 'Berlin', 'Lisbon', 'Oslo'][i % 4], amount: (i * 37) % 900,
}))
const columns = [
  { id: 'id', field: 'id', header: 'ID', width: 70 },
  { id: 'name', field: 'name', header: 'Name', editable: true },
  { id: 'city', field: 'city', header: 'City' },
  { id: 'amount', field: 'amount', header: 'Amount', cellDataType: 'number' },
]
window.__events = []

function App() {
  const ref = useRef(null)
  const [grouped, setGrouped] = useState(false)
  window.__api = () => ref.current?.api
  window.__group = () => setGrouped(true)
  // A parent re-render that changes NOTHING about the grid. Used to prove the
  // wrapper does not reassign every prop and rebind every listener each time.
  const [tick, setTick] = useState(0)
  window.__rerender = () => setTick((t) => t + 1)
  window.__tick = () => tick
  return h('div', { style: { height: 420 } },
    h(SvGrid, {
      ref, data: rows, columns,
      sortable: true, filterable: true, editable: true,
      showRowNumbers: true,
      groupable: grouped || undefined,
      groupBy: grouped ? ['city'] : undefined,
      onCellValueChange: (d) => window.__events.push(['cellvaluechange', d]),
      onRowClick: (d) => window.__events.push(['rowclick', d]),
      onApiReady: () => window.__events.push(['apiready']),
    }))
}
createRoot(document.getElementById('root')).render(h(App))
