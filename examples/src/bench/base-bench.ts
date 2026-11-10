/**
 * The SvGrid Base cases of the harness: one table with a column of every
 * built-in field type, so every type's cell component is on screen while
 * the table scrolls.
 *
 * Two ways the rows arrive:
 *   - in the page: `data` holds every record (the base's default);
 *   - paged: `baseSource(ds, { serverRows: true })`, the rows read block by
 *     block from a ServerDataSource as they come on screen, the way demo 723
 *     pages a million orders. The source answers from the same generated
 *     array with no delay, so the case measures the grid and its cells, not
 *     a network.
 */
import type { ServerDataSource, ServerRequest, ServerResult } from '@svgrid/grid'

type Row = Record<string, unknown>

function rng(seed = 0xba5e) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COLORS = ['#2d7ff9', '#20c933', '#fcb400', '#8b46ff', '#f82b60']
const options = (values: string[]) => values.map((value, i) => ({ value, color: COLORS[i % COLORS.length] }))
const STATUSES = ['New', 'Paid', 'Packed', 'Shipped', 'Returned']
const TAGS = ['urgent', 'vip', 'b2b', 'promo', 'gift', 'bulk']
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
const USERS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']
export const ACCOUNT_COUNT = 50
const THUMBS = COLORS.map((c) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${c}"/><circle cx="20" cy="16" r="8" fill="#fff"/></svg>`)}`)

/** One column per built-in field type (builtin-types.ts), plus the primary text field. */
export const BASE_COLUMNS = [
  { field: 'name', header: 'Name', width: 160, fieldType: 'text' },
  { field: 'notes', header: 'Notes', width: 180, fieldType: 'longText', fieldProps: { richText: true } },
  { field: 'brief', header: 'Brief', width: 180, fieldType: 'richText' },
  { field: 'files', header: 'Files', width: 110, fieldType: 'attachment' },
  { field: 'done', header: 'Done', width: 80, fieldType: 'checkbox' },
  { field: 'status', header: 'Status', width: 120, fieldType: 'singleSelect', fieldProps: { options: options(STATUSES) } },
  { field: 'tags', header: 'Tags', width: 180, fieldType: 'multiSelect', fieldProps: { options: options(TAGS) } },
  { field: 'owner', header: 'Owner', width: 150, fieldType: 'user' },
  { field: 'due', header: 'Due', width: 130, fieldType: 'date' },
  { field: 'phone', header: 'Phone', width: 140, fieldType: 'phone' },
  { field: 'email', header: 'Email', width: 190, fieldType: 'email' },
  { field: 'site', header: 'Site', width: 190, fieldType: 'url' },
  { field: 'sku', header: 'SKU', width: 120, fieldType: 'barcode' },
  { field: 'open', header: 'Open', width: 110, fieldType: 'button', fieldProps: { label: 'Open', url: 'https://example.com/{Name}' } },
  { field: 'steps', header: 'Steps', width: 130, fieldType: 'checklist' },
  { field: 'color', header: 'Color', width: 110, fieldType: 'color' },
  { field: 'qty', header: 'Qty', width: 90, fieldType: 'number', fieldProps: { format: 'integer' } },
  { field: 'amount', header: 'Amount', width: 120, fieldType: 'currency', fieldProps: { precision: 2 } },
  { field: 'share', header: 'Share', width: 110, fieldType: 'percent' },
  { field: 'took', header: 'Took', width: 110, fieldType: 'duration' },
  { field: 'opens', header: 'Opens', width: 110, fieldType: 'timeOfDay' },
  { field: 'stars', header: 'Rating', width: 130, fieldType: 'rating', fieldProps: { max: 5 } },
  { field: 'votes', header: 'Votes', width: 100, fieldType: 'vote' },
  { field: 'trend', header: 'Trend', width: 120, fieldType: 'sparkline' },
  { field: 'tax', header: 'Tax', width: 110, fieldType: 'formula', fieldProps: { formula: '{Amount} * 0.2', result: 'currency', precision: 2 } },
  { field: 'created', header: 'Created', width: 160, fieldType: 'createdTime' },
  { field: 'modified', header: 'Modified', width: 160, fieldType: 'lastModifiedTime' },
  { field: 'createdBy', header: 'Created by', width: 150, fieldType: 'createdBy' },
  { field: 'modifiedBy', header: 'Modified by', width: 150, fieldType: 'lastModifiedBy' },
  { field: 'no', header: 'No', width: 80, fieldType: 'autoNumber' },
  { field: 'account', header: 'Account', width: 160, fieldType: 'link', fieldProps: { table: 'accounts', multiple: false, inverse: 'records' } },
  { field: 'tier', header: 'Tier', width: 100, fieldType: 'lookup', fieldProps: { linkField: 'account', field: 'tier' } },
]

/** The types in BASE_COLUMNS, for the per-type cost table. */
export const BASE_FIELD_TYPES = BASE_COLUMNS.map((c) => c.fieldType)

export function makeBaseRows(count: number): Row[] {
  const rand = rng()
  const out = new Array<Row>(count)
  const iso = (ms: number) => new Date(ms).toISOString()
  const day0 = Date.UTC(2025, 0, 1)
  for (let i = 0; i < count; i++) {
    const w = WORDS[(rand() * WORDS.length) | 0]!
    const nTags = (rand() * 3) | 0
    out[i] = {
      id: `r${i}`,
      name: `${w}-${i + 1}`,
      notes: `**${w}** note for record ${i + 1}, a _second_ sentence`,
      brief: `<p><b>${w}</b> brief with <i>style</i></p>`,
      files: i % 3 === 0 ? [{ id: `f${i}`, name: `${w}.svg`, type: 'image/svg+xml', url: THUMBS[i % THUMBS.length]! }] : [],
      done: rand() > 0.5,
      status: STATUSES[(rand() * STATUSES.length) | 0]!,
      tags: Array.from({ length: nTags }, (_, k) => TAGS[(i + k * 2) % TAGS.length]!),
      owner: USERS[(rand() * USERS.length) | 0]!,
      due: new Date(day0 + ((rand() * 700) | 0) * 86400000).toISOString().slice(0, 10),
      phone: `+1 555 ${String(1000 + ((rand() * 8999) | 0))}`,
      email: `${w}${i}@example.com`,
      site: `https://${w}.example.com`,
      sku: `SKU-${100000 + i}`,
      steps: [{ id: 'a', text: 'Draft', done: true }, { id: 'b', text: 'Review', done: rand() > 0.5 }],
      color: COLORS[(rand() * COLORS.length) | 0]!,
      qty: 1 + ((rand() * 500) | 0),
      amount: Math.round(rand() * 500000) / 100,
      share: Math.round(rand() * 100) / 100,
      took: (rand() * 20000) | 0,
      opens: `${String(8 + ((rand() * 10) | 0)).padStart(2, '0')}:${rand() > 0.5 ? '30' : '00'}`,
      stars: (rand() * 6) | 0,
      votes: USERS.slice(0, (rand() * 4) | 0),
      trend: Array.from({ length: 8 }, () => (rand() * 100) | 0),
      created: iso(day0 + ((rand() * 6e10) | 0)),
      modified: iso(day0 + ((rand() * 6e10) | 0)),
      createdBy: USERS[(rand() * USERS.length) | 0]!,
      modifiedBy: USERS[(rand() * USERS.length) | 0]!,
      no: i + 1,
      account: [`a${(rand() * ACCOUNT_COUNT) | 0}`],
    }
  }
  return out
}

export function accountRows(): Row[] {
  return Array.from({ length: ACCOUNT_COUNT }, (_, i) => ({ id: `a${i}`, name: `Account ${i + 1}`, tier: ['Gold', 'Silver', 'Bronze'][i % 3] }))
}

/** A source over `rows` with no delay: blocks, the count, and writes kept in place. */
export function memorySource(rows: Row[]): ServerDataSource<Row> {
  return {
    async getRows(req: ServerRequest): Promise<ServerResult<Row>> {
      await Promise.resolve()
      return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
    },
    async updateRow(id: string, patch: Partial<Row>) {
      const r = rows.find((x) => x.id === id)!
      Object.assign(r, patch)
      return r
    },
  }
}
