export type OrderStatus = 'paid' | 'pending' | 'refunded' | 'failed'

// Type aliases, not interfaces: SvGrid's rows are `Record<string, unknown>`, and
// TypeScript only lets a type alias stand in for that (an interface has no
// implicit index signature, so `SvGrid<Order>` would not type-check).
export type Order = {
  id: string
  customer: string
  email: string
  product: string
  status: OrderStatus
  quantity: number
  total: number
  country: string
  date: string // ISO yyyy-mm-dd
}

export type Customer = {
  id: string
  name: string
  email: string
  company: string
  plan: 'Free' | 'Pro' | 'Enterprise'
  mrr: number
  seats: number
  active: boolean
  joined: string // ISO yyyy-mm-dd
}
