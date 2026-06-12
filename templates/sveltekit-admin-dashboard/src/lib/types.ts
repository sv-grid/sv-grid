export type OrderStatus = 'paid' | 'pending' | 'refunded' | 'failed'

export interface Order {
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

export interface Customer {
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
