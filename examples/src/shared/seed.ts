/**
 * Deterministic seeded fixture generators. All demos pull from these so output
 * is reproducible across runs and machines.
 */

const FIRST = [
  'Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Donald', 'Barbara', 'John',
  'Edsger', 'Niklaus', 'Anders', 'Brendan', 'Yukihiro', 'Rasmus', 'Bjarne',
  'Tim', 'Guido', 'Larry', 'James', 'Brian', 'Dennis', 'Ken', 'Bram', 'Linus',
  'Joe', 'Rich', 'Rich', 'Anders', 'Erik', 'Mary', 'Susan', 'Karen', 'Lisa',
]
const LAST = [
  'Lovelace', 'Torvalds', 'Hopper', 'Turing', 'Hamilton', 'Knuth', 'Liskov',
  'McCarthy', 'Dijkstra', 'Wirth', 'Hejlsberg', 'Eich', 'Matsumoto', 'Lerdorf',
  'Stroustrup', 'Berners-Lee', 'van Rossum', 'Wall', 'Gosling', 'Kernighan',
  'Ritchie', 'Thompson', 'Moolenaar', 'Armstrong', 'Hickey', 'Sussman',
  'Goldberg', 'Allen', 'Meyer', 'Cox',
]
const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Sales', 'Support', 'Operations']
const COUNTRIES = ['US', 'UK', 'DE', 'FR', 'JP', 'BR', 'IN', 'AU', 'CA', 'NL']
const STATUSES = ['active', 'pending', 'inactive'] as const

export type Status = (typeof STATUSES)[number]

export type Person = {
  id: string
  firstName: string
  lastName: string
  email: string
  age: number
  department: string
  country: string
  status: Status
  joinedAt: string
  salary: number
  performance: number
  active: boolean
}

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

export function makePeople(count: number, seed = 42): Person[] {
  const rand = rng(seed)
  const out: Person[] = new Array(count)
  const now = Date.now()
  // Pre-compute lowercase-normalised forms once per source token - without
  // this every row pays for toLowerCase + replace twice per email at 100k+.
  const firstLower = FIRST.map((s) => s.toLowerCase())
  const lastLower = LAST.map((s) => s.toLowerCase().replace(/[^a-z]/g, ''))
  // Pre-compute one date per day-offset bucket so we hit `new Date.toISOString`
  // 1825 times instead of `count` times. At 100k rows that's a 50× win.
  const dateBuckets = new Array<string>(1825)
  for (let d = 0; d < 1825; d++) {
    dateBuckets[d] = new Date(now - d * 86_400_000).toISOString().slice(0, 10)
  }
  const firstLen = FIRST.length
  const lastLen = LAST.length
  const deptLen = DEPARTMENTS.length
  const countryLen = COUNTRIES.length
  const statusLen = STATUSES.length
  for (let i = 0; i < count; i++) {
    const firstIdx = Math.floor(rand() * firstLen)
    const lastIdx = Math.floor(rand() * lastLen)
    const dept = DEPARTMENTS[Math.floor(rand() * deptLen)]!
    const country = COUNTRIES[Math.floor(rand() * countryLen)]!
    const status = STATUSES[Math.floor(rand() * statusLen)]!
    const age = 21 + Math.floor(rand() * 45)
    const salary = 35_000 + Math.floor(rand() * 165_000)
    const performance = Math.floor(rand() * 100)
    const joinedAt = dateBuckets[Math.floor(rand() * 1825)]!
    const first = FIRST[firstIdx]!
    const last = LAST[lastIdx]!
    out[i] = {
      id: 'p_' + i.toString(36),
      firstName: first,
      lastName: last,
      email: firstLower[firstIdx] + '.' + lastLower[lastIdx] + '@example.com',
      age,
      department: dept,
      country,
      status,
      joinedAt,
      salary,
      performance,
      active: status === 'active',
    }
  }
  return out
}

// --- Inventory / orders dataset (used by the quick-start demo) -------------

const COMPANIES = [
  'Tagcat', 'Zoomzone', 'Meeveo', 'Buzzdog', 'Katz', 'Jaxbean', 'Wikido',
  'Browsedrive', 'Twinder', 'Jetwire', 'Chatterpoint', 'Skyba', 'Skinte',
  'Edgewire', 'Photolist', 'Quaxo', 'Vinder', 'Roomm', 'Skipfire', 'Yodel',
]
const PRODUCTS = [
  'Classic Vest', 'Cycling Cap', 'Full-Finger Gloves', 'HL Mountain Frame',
  'Half-Finger Gloves', 'HL Road Frame', 'HL Touring Frame', 'LL Mountain Frame',
  'LL Road Frame', 'LL Touring Frame', 'Long-Sleeve Logo Jersey', 'Mountain Bottle',
  'Mountain Pump', 'Patch Kit', 'Racing Socks', 'Road Bottle', 'Short-Sleeve Jersey',
  'Touring Pedal', 'Water Bottle', 'Mountain Tire',
]
const ORDER_COUNTRIES = [
  'United Kingdom', 'Indonesia', 'United States', 'Philippines', 'India',
  'China', 'Brazil', 'Germany', 'France', 'Japan',
]

export type Order = {
  id: string
  index: number
  company: string
  product: string
  sellDate: string  // YYYY-MM-DD
  inStock: boolean
  quantity: number
  orderId: string
  country: string
  price: number
}

export function makeOrders(count: number, seed = 7): Order[] {
  const rand = rng(seed)
  const out: Order[] = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    const company = COMPANIES[Math.floor(rand() * COMPANIES.length)]!
    const product = PRODUCTS[Math.floor(rand() * PRODUCTS.length)]!
    const country = ORDER_COUNTRIES[Math.floor(rand() * ORDER_COUNTRIES.length)]!
    const sellDate = new Date(now - Math.floor(rand() * 365) * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const quantity = 5 + Math.floor(rand() * 250)
    const inStock = rand() > 0.25
    const orderPrefix = String(10 + Math.floor(rand() * 89)).padStart(2, '0')
    const orderSuffix = String(1_000_000 + Math.floor(rand() * 8_999_999))
    const price = Math.round((10 + rand() * 480) * 100) / 100
    out.push({
      id: `o_${i.toString(36)}`,
      index: i + 1,
      company,
      product,
      sellDate,
      inStock,
      quantity,
      orderId: `${orderPrefix}-${orderSuffix}`,
      country,
      price,
    })
  }
  return out
}

/**
 * Used by the large-dataset demo: sales-rep rows + a rolling monthly KPI
 * ledger. The wide block is not filler - each column is one month, cycling
 * Revenue / Units sold / Margin, so a 90-column grid reads as ~30 months of
 * real performance history per rep. `metricKind(i)` tells the demo which
 * format + header a given `metric_i` column should use.
 */
export type WidePerson = Person & Record<`metric_${number}`, number>

/** revenue | units | margin - the three KPIs the wide columns cycle through. */
export type MetricKind = 0 | 1 | 2
export function metricKind(i: number): MetricKind {
  return (i % 3) as MetricKind
}

export function makeWidePeople(count: number, metricCount = 90, seed = 1337): WidePerson[] {
  const rand = rng(seed)
  const base = makePeople(count, seed)
  // Pre-allocate the metric key strings once - without this we'd allocate
  // `count * metricCount` template strings (9M for 100k × 90) just to index
  // into each row's object. Hot loop.
  const metricKeys = new Array<string>(metricCount)
  for (let m = 0; m < metricCount; m++) metricKeys[m] = 'metric_' + m
  for (let i = 0; i < count; i++) {
    const row = base[i] as unknown as Record<string, number>
    // Give each rep a stable "size" so their months trend together instead of
    // being pure noise - a big account bills big every month.
    const scale = 0.35 + rand() * 1.3
    for (let m = 0; m < metricCount; m++) {
      const r = rand()
      switch (metricKind(m)) {
        case 0: // Revenue, whole dollars
          row[metricKeys[m]!] = Math.round((6_000 + r * 78_000) * scale)
          break
        case 1: // Units sold, integer
          row[metricKeys[m]!] = Math.round((30 + r * 1_200) * scale)
          break
        default: // Gross margin, percent points (one decimal)
          row[metricKeys[m]!] = Math.round((14 + r * 46) * 10) / 10
      }
    }
  }
  return base as WidePerson[]
}
