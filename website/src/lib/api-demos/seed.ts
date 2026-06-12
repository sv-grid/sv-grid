// Tiny deterministic fixture used by the interactive API-page demos. Kept
// local (and small) so each demo is self-contained and the API page never
// pulls in a heavy dataset just to show a member working.

export type Order = {
  id: string
  customer: string
  region: 'NA' | 'EMEA' | 'APAC' | 'LATAM'
  qty: number
  total: number
  margin: number
  placedAt: string
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled'
  inStock: boolean
}

const CUSTOMERS = [
  'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Soylent', 'Hooli',
  'Stark Industries', 'Wayne Enterprises', 'Wonka', 'Cyberdyne',
  'Tyrell Corp', 'Massive Dynamic', 'Vandelay', 'Pied Piper',
]
const REGIONS = ['NA', 'EMEA', 'APAC', 'LATAM'] as const
const STATUSES = ['pending', 'shipped', 'delivered', 'cancelled'] as const

/** Mulberry32 - small, fast, deterministic PRNG. */
function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function makeOrders(count: number, seed = 7): Order[] {
  const rand = rng(seed)
  const start = Date.UTC(2024, 0, 1)
  const day = 86_400_000
  return Array.from({ length: count }, (_, i) => {
    const qty = 1 + Math.floor(rand() * 40)
    const unit = 20 + Math.floor(rand() * 480)
    return {
      id: `ORD-${String(1000 + i)}`,
      customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)]!,
      region: REGIONS[Math.floor(rand() * REGIONS.length)]!,
      qty,
      total: qty * unit,
      margin: Math.round(rand() * 60) / 100,
      placedAt: new Date(start + Math.floor(rand() * 300) * day).toISOString(),
      status: STATUSES[Math.floor(rand() * STATUSES.length)]!,
      inStock: rand() > 0.4,
    }
  })
}
