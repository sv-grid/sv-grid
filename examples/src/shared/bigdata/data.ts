/**
 * The big-data demo's dataset: every cell is a pure function of (row, column),
 * so 10,000,000 rows x 10,000 columns exist without being stored. The worker
 * (engine.ts) sorts, filters and groups over it; the main thread (client.ts)
 * builds the few rows on screen from the same functions.
 *
 * Each sortable column maps a row to a small non-negative integer `key` whose
 * order is the column's display order, so the worker can radix-sort exactly.
 * Name and email keys come from alphabetically sorted name tables; category
 * keys are indexes into sorted labels; numbers are offset to start at 0.
 */

/** A fast 32-bit mix of (row, salt). Same inputs, same output, everywhere. */
export function hash(row: number, salt: number): number {
  let x = (row ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  return (x ^ (x >>> 16)) >>> 0
}

const sorted = (xs: string[]) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

export const FIRST = sorted([
  'Aaliyah', 'Aiden', 'Amara', 'Andre', 'Anika', 'Arjun', 'Astrid', 'Ayumi', 'Beatriz', 'Bruno', 'Camille', 'Carlos',
  'Chen', 'Chloe', 'Dmitri', 'Elena', 'Emeka', 'Emma', 'Farah', 'Felix', 'Freya', 'Gabriel', 'Hana', 'Hugo', 'Ines',
  'Isaac', 'Jakub', 'Jamal', 'Kai', 'Kenji', 'Lars', 'Layla', 'Leon', 'Lucia', 'Mateo', 'Maya', 'Mei', 'Mila',
  'Nadia', 'Noah', 'Nora', 'Olga', 'Omar', 'Oscar', 'Pablo', 'Priya', 'Rafael', 'Rania', 'Ravi', 'Rosa', 'Sakura',
  'Samir', 'Sofia', 'Sven', 'Tariq', 'Tomas', 'Valentina', 'Viktor', 'Wei', 'Yara', 'Yusuf', 'Zainab', 'Zara', 'Zoe',
])
export const LAST = sorted([
  'Abara', 'Adeyemi', 'Andersen', 'Bauer', 'Becker', 'Bianchi', 'Brennan', 'Castillo', 'Chowdhury', 'Costa', 'Dubois',
  'Eriksson', 'Fischer', 'Fontaine', 'Garcia', 'Gonzalez', 'Haddad', 'Hansen', 'Hoffmann', 'Ibrahim', 'Ivanova',
  'Jansen', 'Kaplan', 'Kim', 'Kowalski', 'Larsen', 'Laurent', 'Lindqvist', 'Lopez', 'Marino', 'Martin', 'Mendes',
  'Moreau', 'Mueller', 'Nakamura', 'Nguyen', 'Novak', 'Nowak', 'Okafor', 'Olsen', 'Park', 'Patel', 'Petrov',
  'Quinn', 'Ramos', 'Reyes', 'Rossi', 'Sato', 'Schmidt', 'Silva', 'Singh', 'Sokolov', 'Suzuki', 'Tanaka', 'Torres',
  'Varga', 'Vasquez', 'Wagner', 'Walsh', 'Weber', 'Yamamoto', 'Yilmaz', 'Zhang', 'Zimmermann',
])
export const DOMAINS = sorted(['acme.io', 'mail.com', 'proton.me', 'outlook.com', 'gmail.com', 'fastmail.com', 'web.de', 'yahoo.com'])

export type Country = { name: string; flag: string; language: string; continent: string }
export const COUNTRIES: Country[] = [
  { name: 'Argentina', flag: '🇦🇷', language: 'Spanish', continent: 'South America' },
  { name: 'Australia', flag: '🇦🇺', language: 'English', continent: 'Oceania' },
  { name: 'Brazil', flag: '🇧🇷', language: 'Portuguese', continent: 'South America' },
  { name: 'Bulgaria', flag: '🇧🇬', language: 'Bulgarian', continent: 'Europe' },
  { name: 'Canada', flag: '🇨🇦', language: 'English', continent: 'North America' },
  { name: 'China', flag: '🇨🇳', language: 'Chinese', continent: 'Asia' },
  { name: 'Egypt', flag: '🇪🇬', language: 'Arabic', continent: 'Africa' },
  { name: 'France', flag: '🇫🇷', language: 'French', continent: 'Europe' },
  { name: 'Germany', flag: '🇩🇪', language: 'German', continent: 'Europe' },
  { name: 'India', flag: '🇮🇳', language: 'Hindi', continent: 'Asia' },
  { name: 'Ireland', flag: '🇮🇪', language: 'English', continent: 'Europe' },
  { name: 'Italy', flag: '🇮🇹', language: 'Italian', continent: 'Europe' },
  { name: 'Japan', flag: '🇯🇵', language: 'Japanese', continent: 'Asia' },
  { name: 'Kenya', flag: '🇰🇪', language: 'Swahili', continent: 'Africa' },
  { name: 'Mexico', flag: '🇲🇽', language: 'Spanish', continent: 'North America' },
  { name: 'Netherlands', flag: '🇳🇱', language: 'Dutch', continent: 'Europe' },
  { name: 'Nigeria', flag: '🇳🇬', language: 'English', continent: 'Africa' },
  { name: 'Norway', flag: '🇳🇴', language: 'Norwegian', continent: 'Europe' },
  { name: 'Poland', flag: '🇵🇱', language: 'Polish', continent: 'Europe' },
  { name: 'Portugal', flag: '🇵🇹', language: 'Portuguese', continent: 'Europe' },
  { name: 'South Korea', flag: '🇰🇷', language: 'Korean', continent: 'Asia' },
  { name: 'Spain', flag: '🇪🇸', language: 'Spanish', continent: 'Europe' },
  { name: 'Sweden', flag: '🇸🇪', language: 'Swedish', continent: 'Europe' },
  { name: 'United Kingdom', flag: '🇬🇧', language: 'English', continent: 'Europe' },
  { name: 'United States', flag: '🇺🇸', language: 'English', continent: 'North America' },
]
export const LANGUAGES = sorted([...new Set(COUNTRIES.map((c) => c.language))])
export const CONTINENTS = sorted([...new Set(COUNTRIES.map((c) => c.continent))])
export const GAMES = sorted([
  'Backgammon', 'Bridge', 'Checkers', 'Chess', 'Cribbage', 'Darts', 'Dominoes', 'Go', 'Mahjong', 'Monopoly',
  'Poker', 'Rummy', 'Scrabble', 'Snooker', 'Sudoku', 'Tetris',
])
export const STATUSES = ['Active', 'Churned', 'Pending', 'VIP'] // already alphabetical
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Ranges the value functions produce; the demo's colour scales use them. */
export const RANGES = {
  balance: [0, 999_999] as const,
  month: [-5_000, 20_000] as const,
  total: [-60_000, 240_000] as const,
  metric: [0, 999.99] as const,
  rating: [1, 5] as const,
}

const DAY0 = Date.UTC(2010, 0, 1)
const DAYS = 5844 // 2010-01-01 .. 2025-12-31
export function dayToIso(day: number): string {
  return new Date(DAY0 + day * 86_400_000).toISOString().slice(0, 10)
}
export function isoToDay(iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - DAY0) / 86_400_000)
}

export type Edits = ReadonlyMap<number, Readonly<Record<string, unknown>>>
export type ColKind = 'id' | 'text' | 'category' | 'number' | 'money' | 'rating' | 'bool' | 'date'

export type BigColumn = {
  field: string
  header: string
  kind: ColKind
  width: number
  /** Sort key of a generated value; `keyBits` bounds it. */
  key(row: number): number
  keyBits: number
  /** The generated value, before any edit. */
  value(row: number): unknown
  /** The sort key of an edited value. Absent: the column is not editable. */
  keyOfValue?(value: unknown): number
  /** Labels in key order, for category columns. */
  labels?: readonly string[]
  /** Category code (index into `labels`) of a row, for filters and groups. */
  code?(row: number): number
  groupable?: boolean
}

const nameF = (r: number) => hash(r, 1) & 63
const nameL = (r: number) => hash(r, 2) & 63
const countryOf = (r: number) => hash(r, 3) % COUNTRIES.length
// Per-country codes, looked up once rather than by indexOf per row.
const LANGUAGE_OF_COUNTRY = COUNTRIES.map((c) => LANGUAGES.indexOf(c.language))
const CONTINENT_OF_COUNTRY = COUNTRIES.map((c) => CONTINENTS.indexOf(c.continent))
const statusOf = (r: number) => {
  const p = hash(r, 9) % 100
  return p < 60 ? 0 : p < 75 ? 1 : p < 95 ? 2 : 3 // Active 60%, Churned 15%, Pending 20%, VIP 5%
}
// The twelve months come from one hash and a cheap integer step per month,
// so a row's total (the sum of all twelve) costs one hash, not twelve.
const step = (x: number) => (Math.imul(x, 1_664_525) + 1_013_904_223) >>> 0
const monthOf = (r: number, k: number) => {
  let x = hash(r, 20)
  for (let i = 0; i <= k; i += 1) x = step(x)
  return ((x >>> 8) % 25_001) - 5_000
}

function category(field: string, header: string, labels: readonly string[], code: (r: number) => number, width = 130): BigColumn {
  return {
    field, header, kind: 'category', width, labels, code, groupable: true,
    key: code, keyBits: Math.max(1, Math.ceil(Math.log2(labels.length))),
    value: (r) => labels[code(r)],
    keyOfValue: (v) => Math.max(0, labels.indexOf(String(v))),
  }
}

/** The 25 named columns. Past these, columns are generated metrics (`m26`...). */
export const BASE_COLUMNS: BigColumn[] = [
  { field: 'id', header: 'ID', kind: 'id', width: 110, key: (r) => r, keyBits: 27, value: (r) => r + 1 },
  {
    field: 'name', header: 'Name', kind: 'text', width: 170, keyBits: 12,
    key: (r) => nameF(r) * 64 + nameL(r),
    value: (r) => `${FIRST[nameF(r)]} ${LAST[nameL(r)]}`,
  },
  {
    field: 'email', header: 'Email', kind: 'text', width: 230, keyBits: 15,
    key: (r) => (nameF(r) * 64 + nameL(r)) * 8 + (hash(r, 4) & 7),
    value: (r) => `${FIRST[nameF(r)]!.toLowerCase()}.${LAST[nameL(r)]!.toLowerCase()}@${DOMAINS[hash(r, 4) & 7]}`,
  },
  category('country', 'Country', COUNTRIES.map((c) => c.name), countryOf, 170),
  category('language', 'Language', LANGUAGES, (r) => LANGUAGE_OF_COUNTRY[countryOf(r)]!, 120),
  category('continent', 'Continent', CONTINENTS, (r) => CONTINENT_OF_COUNTRY[countryOf(r)]!, 130),
  category('game', 'Game', GAMES, (r) => hash(r, 5) % GAMES.length, 120),
  {
    field: 'bought', header: 'Bought', kind: 'bool', width: 90, keyBits: 1, groupable: true,
    labels: ['false', 'true'], code: (r) => (hash(r, 6) % 3 === 0 ? 1 : 0),
    key: (r) => (hash(r, 6) % 3 === 0 ? 1 : 0), value: (r) => hash(r, 6) % 3 === 0,
    keyOfValue: (v) => (v === true || v === 'true' ? 1 : 0),
  },
  {
    field: 'rating', header: 'Rating', kind: 'rating', width: 120, keyBits: 3, groupable: true,
    labels: ['1', '2', '3', '4', '5'], code: (r) => hash(r, 7) % 5,
    key: (r) => hash(r, 7) % 5, value: (r) => 1 + (hash(r, 7) % 5),
    keyOfValue: (v) => Math.min(4, Math.max(0, Math.round(Number(v)) - 1)),
  },
  {
    field: 'balance', header: 'Bank balance', kind: 'money', width: 150, keyBits: 20,
    key: (r) => hash(r, 8) % 1_000_000, value: (r) => hash(r, 8) % 1_000_000,
    keyOfValue: (v) => Math.min(999_999, Math.max(0, Math.round(Number(v)) || 0)),
  },
  category('status', 'Status', STATUSES, statusOf, 110),
  {
    field: 'joined', header: 'Joined', kind: 'date', width: 120, keyBits: 13,
    key: (r) => hash(r, 10) % DAYS, value: (r) => dayToIso(hash(r, 10) % DAYS),
  },
  ...MONTHS.map((m, k): BigColumn => ({
    field: m, header: MONTH_LABEL[k]!, kind: 'money', width: 110, keyBits: 15,
    key: (r) => monthOf(r, k) + 5_000, value: (r) => monthOf(r, k),
    keyOfValue: (v) => Math.min(25_000, Math.max(0, (Math.round(Number(v)) || 0) + 5_000)),
  })),
  {
    field: 'total', header: 'Total winnings', kind: 'money', width: 150, keyBits: 19,
    key: (r) => totalOf(r) + 60_000, value: (r) => totalOf(r),
  },
]
function totalOf(r: number): number {
  let x = hash(r, 20)
  let t = 0
  for (let k = 0; k < 12; k += 1) {
    x = step(x)
    t += ((x >>> 8) % 25_001) - 5_000
  }
  return t
}

/** A generated metric column: 0.00 .. 999.99. */
function metricColumn(index: number): BigColumn {
  const salt = 100 + index
  return {
    field: `m${index}`, header: `Metric ${index}`, kind: 'number', width: 110, keyBits: 17,
    key: (r) => hash(r, salt) % 100_000,
    value: (r) => (hash(r, salt) % 100_000) / 100,
    keyOfValue: (v) => Math.min(99_999, Math.max(0, Math.round(Number(v) * 100) || 0)),
  }
}

/** The first `count` columns: the named ones, then metrics up to `count`. */
export function columnsFor(count: number): BigColumn[] {
  const cols = BASE_COLUMNS.slice(0, Math.min(count, BASE_COLUMNS.length))
  for (let i = BASE_COLUMNS.length; i < count; i += 1) cols.push(metricColumn(i + 1))
  return cols
}

/** A column by field, for any field `columnsFor` can produce. */
const baseByField = new Map(BASE_COLUMNS.map((c) => [c.field, c]))
const metricCache = new Map<string, BigColumn>()
export function columnByField(field: string): BigColumn | undefined {
  const base = baseByField.get(field)
  if (base) return base
  if (!/^m\d+$/.test(field)) return undefined
  let col = metricCache.get(field)
  if (!col) {
    col = metricColumn(Number(field.slice(1)))
    metricCache.set(field, col)
  }
  return col
}

/** The displayed value of a cell, edits applied. `total` follows edited months. */
export function cellValue(col: BigColumn, row: number, edits?: Edits): unknown {
  const patch = edits?.get(row)
  if (patch) {
    if (col.field in patch) return patch[col.field]
    if (col.field === 'total') {
      let t = 0
      for (let k = 0; k < 12; k += 1) {
        const m = MONTHS[k]!
        t += m in patch ? Number(patch[m]) : monthOf(row, k)
      }
      return t
    }
  }
  return col.value(row)
}

/** The sort key of a cell, edits applied. */
export function cellKey(col: BigColumn, row: number, edits?: Edits): number {
  const patch = edits?.get(row)
  if (patch) {
    if (col.field in patch && col.keyOfValue) return col.keyOfValue(patch[col.field])
    if (col.field === 'total') return Number(cellValue(col, row, edits)) + 60_000
  }
  return col.key(row)
}

/** The category code of a cell, edits applied. */
export function cellCode(col: BigColumn, row: number, edits?: Edits): number {
  const patch = edits?.get(row)
  if (patch && col.field in patch && col.keyOfValue) return col.keyOfValue(patch[col.field])
  return col.code!(row)
}

export const COUNTRY_BY_NAME = new Map(COUNTRIES.map((c) => [c.name, c]))
