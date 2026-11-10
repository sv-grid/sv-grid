/**
 * The "rich cells" scenario of the comparison harness.
 *
 * The main suite draws nine text columns, which says little about an app
 * whose cells are badges, avatars and progress bars. This scenario has eight
 * columns with the custom renderers apps ship most (status badge, avatar +
 * name, progress bar, star rating, checkbox, formatted date, link, tag list)
 * and four plain ones. Every adapter draws them through its own renderer API
 * (SvGrid: renderSnippet; SVAR: a cell component; AG Grid: cellRenderer;
 * TanStack: markup in its row template) with the SAME markup and the shared
 * stylesheet below, so what differs is how each grid gets that markup into a
 * cell and keeps it current while rows scroll by.
 *
 * Helpers here are shared by every adapter: one date formatter at module
 * scope, initials and colours from a small cache, star strings prebuilt.
 */
import type { BenchColumn } from './adapters'
import './rich.css'

export type RichKind = 'avatar' | 'badge' | 'progress' | 'rating' | 'check' | 'date' | 'link' | 'tags'

/** A harness column with a renderer kind; a column without `kind` is plain text. */
export type RichColumn = BenchColumn & { kind?: RichKind }

export type RichRow = Record<string, unknown> & { id: number }

const BASE_COLUMNS: RichColumn[] = [
  { field: 'id', header: 'ID', type: 'number' },
  { field: 'name', header: 'Owner', type: 'text', kind: 'avatar' },
  { field: 'status', header: 'Status', type: 'text', kind: 'badge' },
  { field: 'progress', header: 'Progress', type: 'number', kind: 'progress' },
  { field: 'rating', header: 'Rating', type: 'number', kind: 'rating' },
  { field: 'active', header: 'Active', type: 'text', kind: 'check' },
  { field: 'due', header: 'Due', type: 'text', kind: 'date' },
  { field: 'site', header: 'Site', type: 'text', kind: 'link' },
  { field: 'tags', header: 'Tags', type: 'text', kind: 'tags' },
  { field: 'amount', header: 'Amount', type: 'number' },
  { field: 'region', header: 'Region', type: 'text' },
  { field: 'qty', header: 'Qty', type: 'number' },
]

/** The rich columns, `repeat` times over for the horizontal case (fields `status_2`, ...). */
export function richColumns(repeat = 1): RichColumn[] {
  const out: RichColumn[] = []
  for (let k = 0; k < repeat; k++) {
    for (const c of BASE_COLUMNS) {
      if (k > 0 && c.field === 'id') continue
      out.push(k === 0 ? c : { ...c, field: `${c.field}_${k + 1}`, header: `${c.header} ${k + 1}` })
    }
  }
  return out
}

/** Column width every adapter uses in this scenario: 1000 px shows about eight. */
export const RICH_WIDTH = 120

function rng(seed = 0x51c4) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Ana', 'Ben', 'Cleo', 'Dev', 'Elena', 'Farah', 'Gus', 'Hana', 'Ivan', 'Jo']
const LAST = ['Ruiz', 'Okafor', 'Park', 'Shah', 'Novak', 'Haddad', 'Moreau', 'Sato']
const STATUSES = ['open', 'pending', 'shipped', 'closed', 'cancelled']
const REGIONS = ['EMEA', 'APAC', 'AMER', 'LATAM', 'ANZ']
const TAGS = ['urgent', 'vip', 'b2b', 'new', 'promo', 'bulk', 'gift', 'retry']
const SITES = ['acme.example.com', 'globex.example.com', 'initech.example.com', 'hooli.example.com', 'stark.example.com']

export function makeRichRows(count: number, repeat = 1): RichRow[] {
  const rand = rng()
  const tagLists: string[][] = []
  for (let i = 0; i < 64; i++) {
    const n = 1 + ((i * 7) % 3)
    tagLists.push(Array.from({ length: n }, (_, k) => TAGS[(i + k * 3) % TAGS.length]!))
  }
  const out = new Array<RichRow>(count)
  for (let i = 0; i < count; i++) {
    const row: RichRow = {
      id: i + 1,
      name: FIRST[(rand() * FIRST.length) | 0]! + ' ' + LAST[(rand() * LAST.length) | 0]!,
      status: STATUSES[(rand() * STATUSES.length) | 0]!,
      progress: (rand() * 101) | 0,
      rating: (rand() * 6) | 0,
      active: rand() > 0.5,
      due: new Date(Date.UTC(2024 + ((rand() * 3) | 0), (rand() * 12) | 0, 1 + ((rand() * 28) | 0))).toISOString().slice(0, 10),
      site: SITES[(rand() * SITES.length) | 0]!,
      tags: tagLists[(rand() * tagLists.length) | 0]!,
      amount: Math.round(rand() * 100000) / 100,
      region: REGIONS[(rand() * REGIONS.length) | 0]!,
      qty: 1 + ((rand() * 500) | 0),
    }
    for (let k = 1; k < repeat; k++) {
      for (const c of BASE_COLUMNS) if (c.field !== 'id') row[`${c.field}_${k + 1}`] = row[c.field]
    }
    out[i] = row
  }
  return out
}

// ---- shared render helpers -------------------------------------------------

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#4f46e5', '#be185d']
const avatarCache = new Map<string, { initials: string; color: string }>()
export function avatarOf(name: unknown): { initials: string; color: string } {
  const key = String(name ?? '')
  let hit = avatarCache.get(key)
  if (!hit) {
    const parts = key.split(' ')
    let h = 0
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
    hit = { initials: (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? ''), color: AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]! }
    avatarCache.set(key, hit)
  }
  return hit
}

export const STARS_ON = ['', '★', '★★', '★★★', '★★★★', '★★★★★']
export const STARS_OFF = ['★★★★★', '★★★★', '★★★', '★★', '★', '']

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const dateCache = new Map<string, string>()
export function fmtDate(v: unknown): string {
  const key = String(v ?? '')
  let hit = dateCache.get(key)
  if (hit === undefined) {
    hit = key ? DATE_FMT.format(new Date(key + 'T00:00:00Z')) : ''
    dateCache.set(key, hit)
  }
  return hit
}

export const tagList = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])

/**
 * The same markup as an HTML string, for a grid whose renderer API takes
 * one (AG Grid's cellRenderer). Data here is generated, never user input, so
 * it needs no escaping.
 */
export function richHtml(kind: RichKind, v: unknown): string {
  switch (kind) {
    case 'avatar': {
      const a = avatarOf(v)
      return `<span class="rc-avatar" style="background:${a.color}">${a.initials}</span><span class="rc-name">${v}</span>`
    }
    case 'badge':
      return `<span class="rc-badge rc-${v}">${v}</span>`
    case 'progress':
      return `<span class="rc-progress"><span class="rc-bar" style="width:${v}%"></span></span><span class="rc-pct">${v}%</span>`
    case 'rating': {
      const n = Number(v) | 0
      return `<span class="rc-stars">${STARS_ON[n]}<span class="rc-off">${STARS_OFF[n]}</span></span>`
    }
    case 'check':
      return `<input type="checkbox" class="rc-check" disabled${v ? ' checked' : ''}>`
    case 'date':
      return `<time class="rc-date" datetime="${v}">${fmtDate(v)}</time>`
    case 'link':
      return `<a class="rc-link" href="https://${v}/">${v}</a>`
    case 'tags':
      return tagList(v).map((t) => `<span class="rc-tag">${t}</span>`).join('')
  }
}

/** The text a rich cell shows, for the harness's top-row check (what textContent gives). */
export function richText(kind: RichKind | undefined, v: unknown): string {
  if (!kind) return String(v ?? '')
  switch (kind) {
    case 'avatar': return avatarOf(v).initials + String(v)
    case 'progress': return `${v}%`
    case 'rating': return '★★★★★'
    case 'check': return ''
    case 'date': return fmtDate(v)
    case 'tags': return tagList(v).join('')
    default: return String(v ?? '')
  }
}
