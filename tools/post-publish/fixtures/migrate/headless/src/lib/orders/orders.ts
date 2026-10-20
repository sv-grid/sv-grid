export type Order = {
  id: string
  customer: string
  total: number
  status: string
}

export const orders: Order[] = [
  { id: 'SO-1001', customer: 'Northwind', total: 1250.5, status: 'shipped' },
  { id: 'SO-1002', customer: 'Contoso', total: 89.99, status: 'pending' },
  { id: 'SO-1003', customer: 'Fabrikam', total: 4310, status: 'delivered' },
  { id: 'SO-1004', customer: 'Litware', total: 640.25, status: 'cancelled' },
]
