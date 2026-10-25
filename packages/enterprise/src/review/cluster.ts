/**
 * Proposal clustering: put every pending proposal in exactly one group, by
 * the transformation it applies, so a reviewer looks at a few groups instead
 * of thousands of cells. Deterministic and pure; no model is asked.
 *
 * Detectors run in a fixed order and the first that matches wins. The rule
 * detectors go first because they prove their claim for every member:
 *
 *   1. whitespace       `after` is `before` trimmed / with spaces collapsed
 *   2. case             same letters, different case
 *   3. format           same characters apart from punctuation, the same
 *                       unambiguous date, or text that parses to the number
 *   4. scale            `after / before` is the same number, 5+ members
 *
 * Then the judgment detectors, where a person has to look:
 *
 *   5. same-mapping     non-blank `before` values that each map to the same
 *                       `after` at least twice: one group per target, read
 *                       as a mapping table ("usa", "U.S." -> "United States")
 *   6. fill-empty       blank `before`, split by `after`; singletons pooled
 *   7. constant-target  many different `before`, one `after`, 3+ members
 *   8. unpatterned      the rest, per field
 *
 * A group is keyed by source, field, kind and param, so two producers never
 * share a group and neither do two fields.
 */
import { isBlank } from './equal'
import { fill, reviewMessages, type ReviewMessages } from './messages'
import type { GroupKind, Proposal, ProposalGroup } from './types'

/**
 * How `clusterProposals` labels and splits groups: field labels, the size a
 * scale group needs, the confidence below which a proposal counts as unsure,
 * and the wording.
 */
export type ClusterOptions = {
  /** Wording of the group labels (the `label*`, `case*`, `punct*` keys); English by default. */
  messages?: Partial<ReviewMessages>
  /** The header to show for a field in group labels. Default: the field itself. */
  fieldLabel?: (field: string) => string
  /** Fewest members a `scale` group needs. Default 5. */
  minScale?: number
  /** Below this, a judgment group sorts with the risky ones. Default 0.6. */
  lowConfidence?: number
}

const RULE_KINDS: ReadonlySet<GroupKind> = new Set(['whitespace', 'case', 'format', 'scale'])
const SEP = '\u0001'

type Bucket = { kind: GroupKind; param: string; field: string; sourceId: string; members: Proposal[] }

/**
 * Group proposals by the change they make (trim, case, reformat, scale, one
 * mapping, fill empty, one target, no pattern), the groups that need a person
 * first. What the panel lists.
 */
export function clusterProposals(
  proposals: ReadonlyArray<Proposal>,
  opts: ClusterOptions = {},
): ProposalGroup[] {
  const fieldLabel = opts.fieldLabel ?? ((f: string) => f)
  const msg = reviewMessages(opts.messages)
  const minScale = opts.minScale ?? 5
  const low = opts.lowConfidence ?? 0.6
  const order = new Map<string, number>()
  proposals.forEach((p, i) => order.set(p.id, i))

  const buckets = new Map<string, Bucket>()
  const put = (p: Proposal, kind: GroupKind, param: string) => {
    const key = [p.source.id, p.field, kind, param].join(SEP)
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { kind, param, field: p.field, sourceId: p.source.id, members: [] }))
    b.members.push(p)
  }
  const cell = (p: Proposal) => p.source.id + SEP + p.field

  // 1-3: provable per proposal.
  let rest: Proposal[] = []
  for (const p of proposals) {
    const r = ruleOf(p.before, p.after)
    if (r) put(p, r.kind, r.param)
    else rest.push(p)
  }

  // 4: scale, only once enough members share a ratio.
  rest = bucketPass(rest, (p) => {
    const r = ratioOf(p.before, p.after)
    return r == null ? null : cell(p) + SEP + r
  }, (members) => members.length >= minScale, (p, k) => put(p, 'scale', k.slice(k.lastIndexOf(SEP) + 1)))

  // 5: non-blank pairs seen at least twice, one group per target value.
  rest = bucketPass(rest, (p) => (isBlank(p.before) ? null : cell(p) + SEP + keyOf(p.before) + SEP + keyOf(p.after)),
    (members) => members.length >= 2,
    (p) => put(p, 'same-mapping', keyOf(p.after)))

  // 6: blank before, split by the value proposed; singletons go to one pooled group.
  rest = bucketPass(rest, (p) => (isBlank(p.before) ? cell(p) + SEP + keyOf(p.after) : null),
    () => true,
    (p, _k, members) => put(p, 'fill-empty', members.length >= 2 ? keyOf(p.after) : '*'))

  // 7: one target from at least three proposals.
  rest = bucketPass(rest, (p) => cell(p) + SEP + keyOf(p.after),
    (members) => members.length >= 3,
    (p) => put(p, 'constant-target', keyOf(p.after)))

  // 8: everything else, per field.
  for (const p of rest) put(p, 'unpatterned', '')

  const groups: ProposalGroup[] = []
  for (const [key, b] of buckets) {
    const members = b.members.sort((x, y) => order.get(x.id)! - order.get(y.id)!)
    const confs = members.map((m) => m.confidence).filter((c): c is number => typeof c === 'number')
    groups.push({
      key,
      kind: b.kind,
      rule: RULE_KINDS.has(b.kind),
      param: b.param,
      label: labelOf(b.kind, b.param, fieldLabel(b.field), members, msg),
      field: b.field,
      sourceId: b.sourceId,
      ids: members.map((m) => m.id),
      count: members.length,
      minConfidence: confs.length ? Math.min(...confs) : undefined,
      avgConfidence: confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : undefined,
      sample: sampleOf(members, low),
      beforeDistribution: b.kind === 'constant-target' || b.kind === 'same-mapping' ? distributionOf(members) : undefined,
    })
  }
  return groups.sort((a, b) => rankOf(a, low) - rankOf(b, low) || b.count - a.count || (a.key < b.key ? -1 : 1))
}

/**
 * Bucket `items` by `keyFn`. Members of buckets that pass `keep` are handed
 * to `take`; everything else (no key, or a bucket that failed) is returned,
 * in the original order.
 */
function bucketPass(
  items: Proposal[],
  keyFn: (p: Proposal) => string | null,
  keep: (members: Proposal[]) => boolean,
  take: (p: Proposal, key: string, members: Proposal[]) => void,
): Proposal[] {
  const byKey = new Map<string, Proposal[]>()
  const keys: Array<string | null> = items.map((p) => {
    const k = keyFn(p)
    if (k != null) {
      const list = byKey.get(k)
      if (list) list.push(p)
      else byKey.set(k, [p])
    }
    return k
  })
  const out: Proposal[] = []
  items.forEach((p, i) => {
    const k = keys[i]
    const members = k == null ? null : byKey.get(k)!
    if (members && keep(members)) take(p, k!, members)
    else out.push(p)
  })
  return out
}

// ---- rule detectors -------------------------------------------------------

function ruleOf(before: unknown, after: unknown): { kind: GroupKind; param: string } | null {
  if (typeof before === 'string' && typeof after === 'number') {
    const n = parseLooseNumber(before)
    return n !== null && n === after ? { kind: 'format', param: 'to-number' } : null
  }
  const dayB = dayOf(before)
  const dayA = dayOf(after)
  // The same day at a different time is a different value, not a new format.
  if (dayB && dayA && dayB === dayA && timeOf(before) === timeOf(after) && !(before instanceof Date && after instanceof Date)) {
    return { kind: 'format', param: 'date:' + (after instanceof Date ? 'Date' : shapeOf(String(after))) }
  }
  if (typeof before !== 'string' || typeof after !== 'string' || before === after) return null
  if (before.trim() === after || before.replace(/\s+/g, ' ').trim() === after) return { kind: 'whitespace', param: '' }
  if (before.toLowerCase() === after.toLowerCase()) return { kind: 'case', param: caseOf(after) }
  // Punctuation can carry meaning in a number: "3.5" -> "35" keeps every
  // digit and is still a different value. Text that reads as a number on
  // either side only counts as reformatting when both read as the same one.
  const nB = parseLooseNumber(before)
  const nA = parseLooseNumber(after)
  if ((nB !== null || nA !== null) && nB !== nA) return null
  const coreB = alnum(before)
  // Punctuation between digits can be part of a number ("$1,234.56" ->
  // "$123,456", "12.5%" -> "1.25%"): every run of digits has to stay as it was.
  if (coreB.length > 0 && coreB === alnum(after) && digitRuns(before) === digitRuns(after)) {
    const digits = coreB.replace(/\D/g, '').length
    return digits * 2 >= coreB.length
      ? { kind: 'format', param: 'shape:' + shapeOf(after) }
      : { kind: 'format', param: 'punct:' + JSON.stringify(punctDiff(before, after)) }
  }
  return null
}

function ratioOf(before: unknown, after: unknown): string | null {
  if (typeof before !== 'number' || typeof after !== 'number') return null
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0 || before === after) return null
  return String(Number((after / before).toPrecision(10)))
}

const alnum = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '')
const digitRuns = (s: string) => (s.match(/\d+/g) ?? []).join(',')

/** The time of day a date value carries, as HH:MM:SS; midnight when it carries none. */
function timeOf(v: unknown): string {
  if (v instanceof Date) return [v.getHours(), v.getMinutes(), v.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
  const m = typeof v === 'string' ? /[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(v) : null
  return m ? [m[1]!, m[2]!, m[3] ?? '00'].map((n) => n.padStart(2, '0')).join(':') : '00:00:00'
}
const shapeOf = (s: string) => s.replace(/\p{N}/gu, '9').replace(/\p{Lu}/gu, 'A').replace(/\p{Ll}/gu, 'a')

function caseOf(s: string): string {
  if (s === s.toUpperCase()) return 'upper'
  if (s === s.toLowerCase()) return 'lower'
  const words = s.split(/\s+/).filter(Boolean)
  const title = words.every((w) => {
    const head = w.charAt(0)
    return head === head.toUpperCase() && w.slice(1) === w.slice(1).toLowerCase()
  })
  return title ? 'title' : 'mixed'
}

/** The punctuation removed and added, each sorted and unique. */
function punctDiff(before: string, after: string): [string, string] {
  const count = (s: string) => {
    const m = new Map<string, number>()
    for (const ch of s.replace(/[\p{L}\p{N}]/gu, '')) m.set(ch, (m.get(ch) ?? 0) + 1)
    return m
  }
  const b = count(before)
  const a = count(after)
  const removed = [...b].filter(([ch, n]) => n > (a.get(ch) ?? 0)).map(([ch]) => ch).sort().join('')
  const added = [...a].filter(([ch, n]) => n > (b.get(ch) ?? 0)).map(([ch]) => ch).sort().join('')
  return [removed, added]
}

/**
 * A number written as text, or null. Commas count only as thousands
 * separators ("1,200"), so "1,5" (a decimal comma) is not read as 15.
 */
function parseLooseNumber(s: string): number | null {
  const t = s.trim()
  if (!/^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/.test(t) || !/\d/.test(t)) return null
  return Number(t.replace(/,/g, ''))
}

/**
 * A calendar day as YYYY-MM-DD, or null when the value is not a date or its
 * day and month cannot be told apart (03/05/2024 could be either).
 */
function dayOf(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : ymd(v.getFullYear(), v.getMonth() + 1, v.getDate())
  if (typeof v !== 'string') return null
  const s = v.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ][\d:.]+Z?)?$/.exec(s)
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!)
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (!m) return null
  const a = +m[1]!
  const b = +m[2]!
  const y = +m[3]!
  if (a === b) return valid(y, a, b)
  if (a > 12 && b <= 12) return valid(y, b, a)
  if (b > 12 && a <= 12) return valid(y, a, b)
  return null
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return ymd(y, mo, d)
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// ---- grouping helpers -----------------------------------------------------

/**
 * A key that tells values apart by type as well as content.
 * @internal
 */
export function keyOf(v: unknown): string {
  if (v instanceof Date) return 'd:' + v.getTime()
  if (isBlank(v)) return 'blank'
  if (typeof v === 'string') return 's:' + v
  if (typeof v === 'number' || typeof v === 'boolean') return typeof v.valueOf() + ':' + String(v)
  try {
    return 'j:' + JSON.stringify(v)
  } catch {
    return 'o:' + String(v)
  }
}

/**
 * What to look at first: every member below the low-confidence line (up to
 * ten), at least the two least confident, then members spread evenly across
 * the group until there are five.
 */
function sampleOf(members: Proposal[], low: number): string[] {
  if (members.length <= 5) return members.map((m) => m.id)
  const byConfidence = members
    .filter((m) => typeof m.confidence === 'number')
    .sort((x, y) => x.confidence! - y.confidence!)
  const unsure = byConfidence.filter((m) => m.confidence! < low).slice(0, 10)
  const picked: Proposal[] = unsure.length >= 2 ? unsure : byConfidence.slice(0, 2)
  const rest = members.filter((m) => !picked.includes(m))
  const need = Math.max(0, 5 - picked.length)
  for (let i = 0; i < need; i++) picked.push(rest[Math.round((i * (rest.length - 1)) / Math.max(1, need - 1))]!)
  return [...new Set(picked.map((m) => m.id))]
}

function distributionOf(members: Proposal[]): ProposalGroup['beforeDistribution'] {
  const counts = new Map<string, { value: unknown; count: number }>()
  for (const m of members) {
    const k = keyOf(m.before)
    const e = counts.get(k)
    if (e) e.count++
    else counts.set(k, { value: m.before, count: 1 })
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count)
  const top: NonNullable<ProposalGroup['beforeDistribution']> = sorted.slice(0, 5)
  const other = sorted.slice(5).reduce((s, e) => s + e.count, 0)
  if (other > 0) top.push({ value: undefined, count: other, other: true })
  return top
}

function rankOf(g: ProposalGroup, low: number): number {
  if (g.kind === 'unpatterned') return 0
  if (g.kind === 'constant-target') return 1
  if (!g.rule && g.minConfidence !== undefined && g.minConfidence < low) return 2
  return g.rule ? 4 : 3
}

// ---- labels ---------------------------------------------------------------

/**
 * Spaces a reader cannot see, drawn as `·`: leading and trailing ones and runs
 * of two or more. A trim proposal otherwise reads "Acme -> Acme".
 * @internal
 */
export function visibleSpaces(s: string): string {
  return s.replace(/^\s+|\s+$/g, (m) => '·'.repeat(m.length)).replace(/ {2,}/g, (m) => '·'.repeat(m.length))
}

/**
 * A value as a group label shows it: short, `(empty)` for blank, spaces
 * visible. A string is quoted only where the quotes tell something: around
 * spaces at its ends, or when it reads as a number, a boolean or the blank mark.
 */
export function showValue(v: unknown, empty = '(empty)'): string {
  if (isBlank(v)) return empty
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)
  const short = s.length > 40 ? s.slice(0, 39) + '...' : s
  if (typeof v !== 'string') return short
  const quote = /^\s|\s$/.test(s) || /^-?[\d.,]+$|^(true|false)$/i.test(s) || s === empty
  return quote ? `"${visibleSpaces(short)}"` : visibleSpaces(short)
}

function labelOf(kind: GroupKind, param: string, field: string, members: Proposal[], m: ReviewMessages): string {
  const first = members[0]!
  const show = (v: unknown) => showValue(v, m.empty)
  switch (kind) {
    case 'whitespace':
      return fill(m.labelWhitespace, { field })
    case 'case': {
      const name = { upper: m.caseUpper, lower: m.caseLower, title: m.caseTitle }[param] ?? m.caseMixed
      return fill(m.labelCase, { field, case: name })
    }
    case 'format': {
      if (param === 'to-number') return fill(m.labelToNumber, { field })
      if (param.startsWith('date:')) return fill(m.labelDates, { field, shape: param === 'date:Date' ? m.datesAsDates : param.slice(5) })
      if (param.startsWith('shape:')) return fill(m.labelShape, { field, shape: param.slice(6) })
      const [removed, added] = JSON.parse(param.slice(6)) as [string, string]
      const chars = (cs: string) => [...cs].map((c) => (c === ' ' ? m.punctSpaces : `"${c}"`)).join(' ')
      const parts: string[] = []
      if (removed) parts.push(fill(m.punctRemove, { chars: chars(removed) }))
      if (added) parts.push(fill(m.punctAdd, { chars: chars(added) }))
      const change = parts.join(', ')
      return fill(m.labelPunct, { field, change: change.charAt(0).toUpperCase() + change.slice(1) })
    }
    case 'scale': {
      const r = Number(param)
      const inv = 1 / r
      if (Math.abs(r) < 1 && Math.abs(inv - Math.round(inv)) < 1e-9) return fill(m.labelDivide, { field, n: Math.round(inv) })
      return fill(m.labelMultiply, { field, n: param })
    }
    case 'same-mapping': {
      const froms = new Set(members.map((p) => keyOf(p.before))).size
      const from = froms === 1 ? show(first.before) : fill(m.mappingValues, { count: froms })
      return fill(m.labelMapping, { field, from, to: show(first.after) })
    }
    case 'fill-empty':
      return param === '*' ? fill(m.labelFillVarious, { field }) : fill(m.labelFill, { field, value: show(first.after) })
    case 'constant-target':
      return fill(m.labelConstant, { field, value: show(first.after) })
    case 'unpatterned':
      return fill(m.labelUnpatterned, { field })
  }
}

