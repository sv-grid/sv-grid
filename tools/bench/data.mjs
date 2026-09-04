/**
 * Deterministic datasets for the benchmark suite.
 *
 * Seeded, not random: two runs on the same machine must produce the same
 * numbers, and a baseline recorded on one checkout must be comparable to a run
 * on another. `Math.random()` would make every regression indistinguishable
 * from noise in the data itself.
 *
 * The shape mirrors what docs/help/benchmarks.md quotes - 100k rows x 9
 * columns - so the published table and the harness describe the same workload.
 */

/** mulberry32: small, fast, and good enough for test data. Same seed, same stream. */
export function rng(seed = 0x56671d) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REGIONS = ['EMEA', 'APAC', 'AMER', 'LATAM', 'ANZ']
const STATUSES = ['open', 'pending', 'shipped', 'closed', 'cancelled']
const WORDS = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
]

/**
 * `rows` records with 9 fields: two low-cardinality strings (so grouping and
 * set-filtering have something to bucket), two numbers, a date string, a
 * boolean, and two free-text strings.
 */
export function makeRows(rows = 100_000, seed = 12345) {
  const rand = rng(seed)
  const out = new Array(rows)
  for (let i = 0; i < rows; i++) {
    const r = rand()
    out[i] = {
      id: i + 1,
      name: WORDS[(rand() * WORDS.length) | 0] + '-' + ((rand() * 9999) | 0),
      region: REGIONS[(rand() * REGIONS.length) | 0],
      status: STATUSES[(rand() * STATUSES.length) | 0],
      amount: Math.round(r * 1_000_00) / 100,
      qty: 1 + ((rand() * 500) | 0),
      // ISO strings rather than Date objects: this is the shape that comes back
      // from a JSON API, and it is what makes the date comparator expensive.
      orderedAt: new Date(Date.UTC(2020 + ((rand() * 6) | 0), (rand() * 12) | 0, 1 + ((rand() * 28) | 0))).toISOString(),
      active: rand() > 0.5,
      note: WORDS[(rand() * WORDS.length) | 0] + ' ' + WORDS[(rand() * WORDS.length) | 0],
    }
  }
  return out
}

/** Column defs matching `makeRows`. `editorType` is what picks the sort comparator. */
export function makeColumns() {
  return [
    { field: 'id', header: 'ID', editorType: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'region', header: 'Region' },
    { field: 'status', header: 'Status' },
    { field: 'amount', header: 'Amount', editorType: 'number' },
    { field: 'qty', header: 'Qty', editorType: 'number' },
    { field: 'orderedAt', header: 'Ordered', editorType: 'date' },
    { field: 'active', header: 'Active' },
    { field: 'note', header: 'Note' },
  ]
}
