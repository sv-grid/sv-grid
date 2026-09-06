/**
 * The fact table the whole dashboard is built on.
 *
 * A pivot summarises facts; a drill-through walks back to the exact facts
 * behind one summarised cell. Both read this one array, which is why the number
 * in the grid and the number in the drill rail can never disagree.
 *
 * Stands in for your warehouse. Swap `loadFacts` for a query and nothing
 * downstream changes - the pivot, the chart and the drill all take `Fact[]`.
 */

export type Region = 'AMER' | 'EMEA' | 'APAC'
export type Channel = 'Online' | 'Retail' | 'Wholesale'
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export type Fact = {
  id: number
  year: number
  quarter: Quarter
  region: Region
  country: string
  city: string
  channel: Channel
  customer: string
  revenue: number
  units: number
}

/** Which country and city belong to which region - keeps the seed coherent, so
 *  drilling into EMEA never turns up a US city. */
const TOPOLOGY: Record<Region, Record<string, string[]>> = {
  AMER: { USA: ['New York', 'Austin', 'Seattle'], Canada: ['Toronto', 'Vancouver'] },
  EMEA: { Germany: ['Berlin', 'Munich'], UK: ['London', 'Manchester'], France: ['Paris'] },
  APAC: { Japan: ['Tokyo', 'Osaka'], India: ['Mumbai', 'Bangalore'] },
}

const CHANNELS: Channel[] = ['Online', 'Retail', 'Wholesale']
const CUSTOMERS = [
  'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Vandelay', 'Pied Piper',
  'Hooli', 'Stark Industries', 'Tyrell', 'Wayne Ent.', 'Wonka', 'Cyberdyne',
]

/**
 * Seeded PRNG, so every reload and every server instance produces the same
 * dataset. With `Math.random` the SSR pass and the hydrated client would
 * generate different numbers and Svelte would report a hydration mismatch.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

/** Build the fact table. Deterministic for a given `count` and `seed`. */
export function loadFacts(count = 1800, seed = 0xda7a101): Fact[] {
  const rnd = makeRandom(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!
  const regions = Object.keys(TOPOLOGY) as Region[]

  const facts: Fact[] = []
  for (let id = 1; id <= count; id += 1) {
    const region = pick(regions)
    const country = pick(Object.keys(TOPOLOGY[region]))
    const city = pick(TOPOLOGY[region][country]!)
    facts.push({
      id,
      year: pick([2025, 2026] as const),
      quarter: pick(['Q1', 'Q2', 'Q3', 'Q4'] as const),
      region,
      country,
      city,
      channel: pick(CHANNELS),
      customer: pick(CUSTOMERS),
      revenue: Math.round(2_000 + rnd() * 48_000),
      units: Math.round(5 + rnd() * 300),
    })
  }
  return facts
}
