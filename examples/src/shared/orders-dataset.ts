/**
 * A large, deterministic orders table for the worker data source demo (500).
 * Built the same way on the main thread and inside the worker, so both modes
 * of the demo sort and filter identical rows. No imports with side effects:
 * this module is loaded inside a Web Worker, where there is no DOM.
 */
import type { EntitySchema } from '@svgrid/enterprise'

export type Order = {
  id: number
  customer: string
  region: string
  country: string
  product: string
  category: string
  rep: string
  status: string
  placed: string
  qty: number
  unitPrice: number
  amount: number
}

const REGIONS: Record<string, string[]> = {
  Americas: ['US', 'CA', 'BR', 'MX'],
  EMEA: ['DE', 'UK', 'FR', 'NL', 'SE', 'ES'],
  APAC: ['JP', 'AU', 'IN', 'SG'],
}
const PLACES = Object.entries(REGIONS).flatMap(([region, cs]) => cs.map((country) => ({ region, country })))

const PRODUCTS: Array<{ product: string; category: string; price: number }> = [
  { product: 'Standing desk', category: 'Furniture', price: 540 },
  { product: 'Task chair', category: 'Furniture', price: 310 },
  { product: 'Filing cabinet', category: 'Furniture', price: 220 },
  { product: 'Bookshelf', category: 'Furniture', price: 180 },
  { product: '27in monitor', category: 'Electronics', price: 290 },
  { product: 'Docking station', category: 'Electronics', price: 160 },
  { product: 'Webcam', category: 'Electronics', price: 75 },
  { product: 'Headset', category: 'Electronics', price: 95 },
  { product: 'Desk lamp', category: 'Lighting', price: 48 },
  { product: 'Floor lamp', category: 'Lighting', price: 120 },
  { product: 'Whiteboard', category: 'Office', price: 140 },
  { product: 'Paper ream', category: 'Office', price: 9 },
  { product: 'Notebook pack', category: 'Office', price: 14 },
  { product: 'Pen set', category: 'Office', price: 12 },
]

const FIRST = ['Alder', 'Birch', 'Cedar', 'Delta', 'Ember', 'Fjord', 'Granite', 'Harbor', 'Iris', 'Juniper']
const SECOND = ['Supply', 'Labs', 'Foods', 'Works', 'Logistics', 'Retail', 'Health', 'Energy']
const CUSTOMERS = FIRST.flatMap((a) => SECOND.map((b) => `${a} ${b}`))

const REP_NAMES = ['Ana', 'Ben', 'Chloe', 'Dev', 'Elif', 'Femi', 'Goran', 'Hana', 'Ivan', 'Jun']
const REP_INITIALS = ['K', 'L', 'M', 'N']
const REPS = REP_NAMES.flatMap((n) => REP_INITIALS.map((i) => `${n} ${i}.`))

const STATUS = ['open', 'confirmed', 'shipped', 'shipped', 'invoiced', 'invoiced', 'returned']

// Two years of order dates ending on a fixed day, so the table is the same
// on every visit and in every screenshot.
const LAST_DAY = Date.UTC(2026, 8, 30)
const DATES = Array.from({ length: 730 }, (_, d) => new Date(LAST_DAY - d * 86_400_000).toISOString().slice(0, 10))

/** An integer hash: every row is a pure function of its index. */
function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return (n ^ (n >>> 16)) >>> 0
}

export function makeOrders(count: number): Order[] {
  const out: Order[] = new Array(count)
  for (let i = 0; i < count; i += 1) {
    let h = mix(i + 1)
    const pick = <T>(list: readonly T[]): T => {
      h = mix(h)
      return list[h % list.length]!
    }
    const place = pick(PLACES)
    const item = pick(PRODUCTS)
    h = mix(h)
    const qty = 1 + (h % 24)
    h = mix(h)
    // Within 20% of the list price, in whole dollars.
    const unitPrice = Math.round(item.price * (0.8 + (h % 41) / 100))
    out[i] = {
      id: i + 1,
      customer: pick(CUSTOMERS),
      region: place.region,
      country: place.country,
      product: item.product,
      category: item.category,
      rep: pick(REPS),
      status: pick(STATUS),
      placed: pick(DATES),
      qty,
      unitPrice,
      amount: qty * unitPrice,
    }
  }
  return out
}

export const ORDER_SCHEMA: EntitySchema<Order> = {
  name: 'orders',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true },
    { field: 'customer', type: 'text' },
    { field: 'region', type: 'text' },
    { field: 'country', type: 'text' },
    { field: 'product', type: 'text' },
    { field: 'category', type: 'text' },
    { field: 'rep', type: 'text' },
    { field: 'status', type: 'text' },
    // ISO dates: text order is date order.
    { field: 'placed', type: 'text' },
    { field: 'qty', type: 'number' },
    { field: 'unitPrice', type: 'number' },
    { field: 'amount', type: 'number' },
  ],
}
