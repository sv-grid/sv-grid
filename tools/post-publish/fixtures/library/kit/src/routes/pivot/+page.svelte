<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { enablePivot } from '@svgrid/enterprise'

  enablePivot()

  type Order = { id: number; region: string; quarter: string; amount: number }
  const orders: Order[] = []
  for (const region of ['EMEA', 'APAC', 'Americas'])
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4'])
      orders.push({ id: orders.length + 1, region, quarter, amount: 100 * (orders.length + 1) })

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
  const columns: GridColumns<Order> = [
    { field: 'region', header: 'Region', width: 120 },
    { field: 'quarter', header: 'Quarter', width: 90 },
    { field: 'amount', header: 'Amount', width: 120, cellDataType: 'number', format: money },
  ]
</script>

<h1>pivot</h1>
<SvGrid
  data={orders}
  {columns}
  pivot={{ rows: ['region'], cols: ['quarter'], values: [{ field: 'amount', agg: 'sum', label: 'Revenue', format: money }] }}
  containerHeight={320}
/>
