// Sample data. Replace `makeOrders()` with a fetch() from your API or your
// Supabase table; the grid only needs an array of objects.

export type OrderStatus = 'New' | 'Paid' | 'Shipped' | 'Refunded'

export type Order = {
  id: string
  customer: string
  region: string
  product: string
  status: OrderStatus
  quantity: number
  amount: number
  orderedOn: string
  priority: boolean
}

export const STATUSES: OrderStatus[] = ['New', 'Paid', 'Shipped', 'Refunded']
export const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America']

const CUSTOMERS = [
  'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Industries',
  'Wayne Enterprises', 'Wonka Industries', 'Tyrell Corp', 'Soylent', 'Vandelay', 'Cyberdyne',
]
const PRODUCTS: Array<[string, number]> = [
  ['Starter plan', 49], ['Team plan', 199], ['Business plan', 499],
  ['Onboarding pack', 1200], ['Support hours', 150], ['Data migration', 2400],
]

// Seeded, so every reload (and every screenshot) shows the same rows.
function random(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

export function makeOrders(count = 240): Order[] {
  const rnd = random(42)
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)]!
  const start = Date.UTC(2026, 0, 5)
  return Array.from({ length: count }, (_, i) => {
    const [product, price] = pick(PRODUCTS)
    const quantity = 1 + Math.floor(rnd() * 8)
    const day = new Date(start + Math.floor(rnd() * 290) * 86_400_000)
    return {
      id: `SO-${String(10_001 + i)}`,
      customer: pick(CUSTOMERS),
      region: pick(REGIONS),
      product,
      status: pick(STATUSES),
      quantity,
      amount: price * quantity,
      orderedOn: day.toISOString().slice(0, 10),
      priority: rnd() < 0.2,
    }
  })
}
