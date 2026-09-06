// Drives the BUILT Vue wrapper. No `isCustomElement` config and no `.prop`
// modifiers - that removal is what the wrapper is for.
import { createApp, h, ref } from 'vue'
import { SvGrid } from '../../../dist/vue/index.js'

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

const grouped = ref(false)
const gridRef = ref(null)
window.__group = () => { grouped.value = true }
window.__api = () => gridRef.value?.api
// A parent re-render that changes nothing about the grid.
const tick = ref(0)
window.__rerender = () => { tick.value++ }
window.__tick = () => tick.value

createApp({
  render: () => (tick.value, h('div', { style: { height: '420px' } }, [
    h(SvGrid, {
      ref: gridRef,
      data: rows, columns,
      sortable: true, filterable: true, editable: true,
      showRowNumbers: true,
      groupable: grouped.value || undefined,
      groupBy: grouped.value ? ['city'] : undefined,
      onCellvaluechange: (d) => window.__events.push(['cellvaluechange', d]),
      onRowclick: (d) => window.__events.push(['rowclick', d]),
      onApiready: () => window.__events.push(['apiready']),
    }),
  ])),
}).mount('#root')
