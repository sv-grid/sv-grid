// Both elements in one bundle: <sv-grid> and <sv-chart> must keep their own CSS.
import '@svgrid/grid-wc'
import '@svgrid/grid-wc/chart'

const rows = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  city: ['Sofia', 'Berlin', 'Lisbon', 'Oslo'][i % 4],
  amount: (i * 37) % 900,
}))
const columns = [
  { field: 'id', header: 'ID', width: 70 },
  { field: 'city', header: 'City' },
  { field: 'amount', header: 'Amount', cellDataType: 'number' },
]

window.__check = { rowclicks: [] }

for (const id of ['plain', 'picking']) {
  const el = document.getElementById(id)
  el.columns = columns
  el.data = rows
  el.addEventListener('rowclick', (e) => window.__check.rowclicks.push({ grid: id, detail: e.detail }))
}

document.getElementById('chart').spec = {
  type: 'bar',
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ label: 'Revenue', values: [120, 180, 150, 210] }],
}
