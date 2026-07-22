/**
 * Realistic sample-data generator - shared by the designer preview
 * (`schema-designer.ts`) and the codegen seed (`emit-schema.ts`), so a Studio
 * app looks *believable* out of the box (real-looking people, companies,
 * amounts, dates, statuses) instead of `name 1` / `email 1` / `10, 20, 30`.
 *
 * Pure + node-safe (studio subtree: `.js` imports, types only, no Svelte / grid /
 * DOM). DETERMINISTIC by (field, row index) - no `Math.random`, so previews and
 * generated seed are stable across runs and don't churn tests or git diffs.
 */
import type { EntityField } from '../schema.js'

// --- curated value pools ----------------------------------------------------

const FIRST_NAMES = ['Ada', 'Alan', 'Grace', 'Linus', 'Barbara', 'Katherine', 'Donald', 'Margaret', 'Tim', 'Radia', 'Guido', 'Anita', 'Ken', 'Dorothy', 'Vint', 'Hedy']
const LAST_NAMES = ['Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Liskov', 'Johnson', 'Knuth', 'Hamilton', 'Berners-Lee', 'Perlman', 'van Rossum', 'Borg', 'Thompson', 'Vaughan', 'Cerf', 'Lamarr']
const COMPANIES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Soylent', 'Hooli', 'Stark Industries', 'Wayne Enterprises', 'Cyberdyne', 'Wonka Industries', 'Aperture', 'Tyrell Corp', 'Massive Dynamic', 'Pied Piper', 'Vandelay', 'Gekko & Co']
const PRODUCTS = ['Aeron Chair', 'Standing Desk', 'Mechanical Keyboard', 'Noise-Cancelling Headphones', '4K Monitor', 'Webcam Pro', 'USB-C Hub', 'Ergonomic Mouse', 'Laptop Stand', 'Desk Lamp', 'Cable Organizer', 'Wireless Charger', 'Notebook', 'Water Bottle', 'Backpack', 'Coffee Mug']
const CITIES = ['San Francisco', 'New York', 'London', 'Berlin', 'Toronto', 'Amsterdam', 'Sydney', 'Tokyo', 'Austin', 'Paris', 'Singapore', 'Dublin']
const COUNTRIES = ['United States', 'United Kingdom', 'Germany', 'Canada', 'Australia', 'France', 'Japan', 'Netherlands', 'Ireland', 'Singapore', 'Spain', 'Sweden']
const STREETS = ['Market St', 'Main St', 'Oak Ave', 'Elm St', 'Pine Rd', 'Maple Dr', '5th Ave', 'King St', 'Queen St', 'Broadway', 'High St', 'Park Ln']
const WORDS = ['Standard', 'Premium', 'Basic', 'Advanced', 'Starter', 'Professional', 'Enterprise', 'Custom', 'General', 'Priority']
const SENTENCES = [
  'Follow up on the latest changes and confirm next steps.',
  'Reviewed the proposal and shared feedback with the team.',
  'Waiting on approval before moving to the next phase.',
  'Everything looks good - ready to ship this week.',
  'Blocked by a dependency; escalating to the owner.',
  'Scheduled a call to walk through the requirements.',
  'Updated the estimate after the scope changed.',
  'Closed out the remaining items from last sprint.',
]
const COLORS = ['Black', 'White', 'Silver', 'Blue', 'Red', 'Green', 'Graphite', 'Gold']
const DOMAINS = ['example.com', 'acme.io', 'globex.co', 'mail.dev', 'company.org', 'work.app']
const CURRENCY_POOL = [1200, 340, 980, 4500, 220, 1750, 60, 8900, 430, 2600, 150, 3200, 720, 5400, 90, 1980]
// Tag pools for `chips` (SvTagsInput) fields, chosen by field name.
const SKILLS = ['TypeScript', 'React', 'Svelte', 'Python', 'Go', 'SQL', 'AWS', 'Figma', 'Rust', 'GraphQL', 'Docker', 'Kubernetes', 'Node.js', 'Leadership', 'Product', 'UX']
const AMENITIES = ['Parking', 'Pool', 'Gym', 'Balcony', 'Garden', 'A/C', 'Heating', 'Elevator', 'Pet-friendly', 'Furnished', 'Laundry', 'Dishwasher', 'Fireplace', 'Garage']
const DIET_TAGS = ['Vegan', 'Vegetarian', 'Gluten-free', 'Dairy-free', 'Nut-free', 'Halal', 'Kosher', 'Spicy', 'Organic', 'Keto']
const TOPIC_TAGS = ['Keynote', 'Workshop', 'Networking', 'Panel', 'Q&A', 'Hands-on', 'Beginner', 'Advanced', 'Remote', 'Live']
const HEX_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

// --- helpers ----------------------------------------------------------------

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
}

/** Stable small offset from a field name, so different fields don't align. */
function offsetFor(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % 997
  return h
}

const pick = <T>(pool: readonly T[], i: number): T => pool[i % pool.length]!

const firstName = (i: number) => pick(FIRST_NAMES, i)
const lastName = (i: number) => pick(LAST_NAMES, i)
const fullName = (i: number) => `${firstName(i)} ${lastName(i + 3)}`
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '')

/** A fixed "today" so date spreads are deterministic (no `new Date()`). */
const BASE_YEAR = 2026
const BASE_MONTH = 6 // July (0-based)
const BASE_DAY = 14

/** 2-4 distinct tags from the pool that best matches the field name. */
function tagArray(name: string, i: number, off: number): string[] {
  const pool = /skill|tech|stack|expert/.test(name) ? SKILLS
    : /amenit|feature|facilit/.test(name) ? AMENITIES
    : /diet|cuisine|allerg|food/.test(name) ? DIET_TAGS
    : /topic|track|tag|interest|categor|label/.test(name) ? TOPIC_TAGS
    : WORDS
  const n = 2 + ((off + i) % 3) // 2-4 tags
  const out = new Set<string>()
  for (let k = 0; k < n; k++) out.add(pick(pool, off + i * 3 + k))
  return [...out]
}

/** A masked code (VIN, plate, ISBN, SSN, ...) chosen by field name. */
function maskedCode(name: string, n: number): string {
  const d = (len: number, seed: number) => String(seed % Math.pow(10, len)).padStart(len, '0')
  if (/vin/.test(name)) return `1HGCM${d(6, n * 7)}${String.fromCharCode(65 + (n % 26))}`
  if (/plate|registration/.test(name)) return `${String.fromCharCode(65 + n % 26)}${String.fromCharCode(65 + (n + 3) % 26)}${String.fromCharCode(65 + (n + 7) % 26)}-${d(4, n * 13 + 1000)}`
  if (/isbn/.test(name)) return `978-0-${d(5, n * 271 + 10000)}-${d(3, n * 7 + 100)}-${(n % 10)}`
  if (/ssn/.test(name)) return `${d(3, n + 100)}-${d(2, n + 10)}-${d(4, n * 3 + 1000)}`
  if (/ein|tax/.test(name)) return `${d(2, n + 10)}-${d(7, n * 137 + 1000000)}`
  if (/zip|postal/.test(name)) return d(5, n * 37 + 10000)
  return d(4, n + 1000)
}

function isoDate(offsetDays: number, withTime: boolean): string {
  // Build a date by simple arithmetic off the fixed base (avoids `Date.now()`).
  const dayOfYear = (BASE_MONTH * 30 + BASE_DAY) + offsetDays
  const month = Math.max(0, Math.min(11, Math.floor(((dayOfYear % 360) + 360) % 360 / 30)))
  const day = Math.max(1, Math.min(28, (((dayOfYear % 30) + 30) % 30) + 1))
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return withTime ? `${BASE_YEAR}-${mm}-${dd}T09:${String(10 + (offsetDays % 40)).padStart(2, '0')}:00Z` : `${BASE_YEAR}-${mm}-${dd}`
}

// --- the generator ----------------------------------------------------------

/**
 * A believable value for `field` on row `i` (0-based). Type drives the shape;
 * the field NAME refines it (an `email` field gets an email, a `price` field
 * gets a currency amount, a `status` field cycles a status pool).
 */
export function generateValue(field: EntityField, i: number): unknown {
  const name = String(field.field).toLowerCase()
  const off = offsetFor(name)
  const j = i + off

  // A field with explicit options (enum / select) always cycles its options.
  if (field.options && field.options.length) return field.options[i % field.options.length]!.value

  // The chosen editor refines the shape ahead of the base type (a `slider` field
  // is a number 0-100, a `chips` field is a tag array, a `mask` field a code).
  switch (field.input?.editorType) {
    case 'chips':
      return tagArray(name, i, off)
    case 'mask':
      return maskedCode(name, j)
    case 'rating':
      return 1 + (j % 5)
    case 'slider': {
      const lo = field.min ?? 0
      const hi = field.max ?? 100
      return lo + ((j * 7) % Math.max(1, hi - lo + 1))
    }
    case 'color':
      return pick(HEX_COLORS, j)
    case 'country':
      return pick(COUNTRIES, j)
    case 'phone':
      return `+1 (${200 + (j % 700)}) ${String(100 + (j % 900)).padStart(3, '0')}-${String(1000 + (j % 9000)).padStart(4, '0')}`
  }

  switch (field.type) {
    case 'relation':
      return `${field.relation?.entity ?? 'ref'}-${i + 1}`
    case 'boolean':
      // active / enabled / paid / verified skew true; otherwise ~2/3 true.
      return /inactive|archived|deleted|disabled/.test(name) ? i % 3 === 0 : i % 3 !== 0
    case 'json':
      return {}
    case 'date':
    case 'dateString':
    case 'datetime': {
      const withTime = field.type === 'datetime'
      // created/joined in the past, due/expires in the future, else spread around now.
      const dir = /due|expire|deadline|end|renew/.test(name) ? 1 : /created|joined|start|signed|opened|order/.test(name) ? -1 : (i % 2 ? 1 : -1)
      return isoDate(dir * (5 + ((j * 7) % 90)), withTime)
    }
    case 'number': {
      if (/price|amount|total|cost|salary|mrr|arr|revenue|balance|fee|value|budget|spent|paid|subtotal|tax/.test(name)) return pick(CURRENCY_POOL, j)
      if (/qty|quantity|stock|count|units|seats|items|inventory/.test(name)) return 1 + (j % 50)
      if (/age/.test(name)) return 22 + (j % 44)
      if (/percent|discount|progress|score|rate|completion/.test(name)) return (j * 7) % 100
      if (/year/.test(name)) return 2020 + (j % 7)
      if (/rating|stars/.test(name)) return 1 + (j % 5)
      return (i + 1) * 25
    }
    default: {
      // text: refine heavily by field name.
      if (/e-?mail/.test(name)) return `${slug(firstName(i))}.${slug(lastName(i + 3))}@${pick(DOMAINS, j)}`
      if (/first.?name|given/.test(name)) return firstName(i)
      if (/last.?name|surname|family/.test(name)) return lastName(i)
      if (/full.?name|^name$|contact|customer|author|owner|assignee|manager|agent|member|person|lead|rep|user/.test(name)) return fullName(i)
      if (/compan|organi|vendor|supplier|account|client|business|employer/.test(name)) return pick(COMPANIES, j)
      if (/product|item|^sku$|part/.test(name)) return pick(PRODUCTS, j)
      if (/city|town/.test(name)) return pick(CITIES, j)
      if (/country|nation/.test(name)) return pick(COUNTRIES, j)
      if (/state|province|region/.test(name)) return pick(CITIES, j + 2)
      if (/address|street/.test(name)) return `${100 + ((j * 13) % 900)} ${pick(STREETS, j)}`
      if (/phone|mobile|tel|fax/.test(name)) return `+1 (${200 + (j % 700)}) ${String(100 + (j % 900)).padStart(3, '0')}-${String(1000 + (j % 9000)).padStart(4, '0')}`
      if (/url|website|link|site|domain/.test(name)) return `https://${slug(pick(COMPANIES, j))}.com`
      if (/description|notes?|summary|comment|message|body|detail|remark/.test(name)) return pick(SENTENCES, j)
      if (/subject|title|headline|task|name/.test(name)) return `${pick(WORDS, j)} ${pick(PRODUCTS, j + 1)}`
      if (/status|stage|priority|category|tier|plan|role|department|type|kind|level|group/.test(name)) return pick(WORDS, j)
      if (/color|colour/.test(name)) return pick(COLORS, j)
      if (/code|ref|reference|invoice|^no$|number|order|ticket|^id$/.test(name)) {
        const prefix = (name.match(/[a-z]{2,4}/)?.[0] ?? 'ref').toUpperCase().slice(0, 3)
        return `${prefix}-${1000 + i * 7 + (off % 90)}`
      }
      // Fallback: a title-cased label + index (still readable).
      return `${field.label ?? titleCase(field.field)} ${i + 1}`
    }
  }
}

/** Deterministic rows for a schema's fields (used by the designer preview). */
export function generateRows(fields: ReadonlyArray<EntityField>, count = 6): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => {
    const row: Record<string, unknown> = {}
    for (const f of fields) row[String(f.field)] = generateValue(f, i)
    return row
  })
}
