import type { Customer, Order, OrderStatus } from './types'

// Deterministic pseudo-random generator so the sample data is stable across
// reloads and SSR/CSR (no hydration mismatch). Swap any of this out for your
// own API / load function.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Ava', 'Liam', 'Noah', 'Emma', 'Mia', 'Lucas', 'Sofia', 'Ethan', 'Aria', 'Leo', 'Zoe', 'Kai']
const LAST = ['Carter', 'Nguyen', 'Patel', 'Kim', 'Garcia', 'Müller', 'Rossi', 'Silva', 'Okafor', 'Haddad', 'Novak', 'Tanaka']
const COMPANIES = ['Northwind', 'Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Stark Co', 'Wayne LLC', 'Soylent']
const PRODUCTS = ['Starter Plan', 'Team Plan', 'Enterprise Plan', 'Add-on: Storage', 'Add-on: Seats', 'Onboarding']
const COUNTRIES = ['US', 'UK', 'DE', 'FR', 'JP', 'BR', 'CA', 'AU', 'IN', 'NL']
const STATUSES: OrderStatus[] = ['paid', 'paid', 'paid', 'pending', 'refunded', 'failed']
const PLANS: Customer['plan'][] = ['Free', 'Pro', 'Pro', 'Enterprise']

function isoDaysAgo(rng: () => number, maxDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(rng() * maxDays))
  return d.toISOString().slice(0, 10)
}

export function makeOrders(count = 240): Order[] {
  const rng = mulberry32(42)
  return Array.from({ length: count }, (_, i) => {
    const customer = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
    const quantity = 1 + Math.floor(rng() * 6)
    const unit = [19, 49, 99, 149, 299][Math.floor(rng() * 5)]
    return {
      id: `ORD-${(10000 + i).toString()}`,
      customer,
      email: `${customer.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
      product: PRODUCTS[Math.floor(rng() * PRODUCTS.length)],
      status: STATUSES[Math.floor(rng() * STATUSES.length)],
      quantity,
      total: quantity * unit,
      country: COUNTRIES[Math.floor(rng() * COUNTRIES.length)],
      date: isoDaysAgo(rng, 120),
    }
  })
}

export function makeCustomers(count = 120): Customer[] {
  const rng = mulberry32(7)
  return Array.from({ length: count }, (_, i) => {
    const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
    const plan = PLANS[Math.floor(rng() * PLANS.length)]
    const seats = plan === 'Enterprise' ? 10 + Math.floor(rng() * 90) : plan === 'Pro' ? 1 + Math.floor(rng() * 10) : 1
    const perSeat = plan === 'Enterprise' ? 40 : plan === 'Pro' ? 15 : 0
    return {
      id: `CUS-${(2000 + i).toString()}`,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
      company: COMPANIES[Math.floor(rng() * COMPANIES.length)],
      plan,
      mrr: seats * perSeat,
      seats,
      active: rng() > 0.18,
      joined: isoDaysAgo(rng, 900),
    }
  })
}

/** Headline KPIs derived from the sample data - feeds the dashboard cards. */
export function summarize(orders: Order[], customers: Customer[]) {
  const revenue = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0)
  const mrr = customers.filter((c) => c.active).reduce((s, c) => s + c.mrr, 0)
  const pending = orders.filter((o) => o.status === 'pending').length
  return {
    revenue,
    mrr,
    pending,
    customers: customers.filter((c) => c.active).length,
    orders: orders.length,
  }
}
