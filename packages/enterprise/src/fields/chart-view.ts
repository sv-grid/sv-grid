/**
 * The chart view: the records the view shows, grouped by one field and
 * counted, summed or averaged, as a bar, line, pie or donut chart. A select
 * keeps its options' order and colors, a person and a linked record show by
 * name, a date groups by month.
 */
import type { ChartSpec } from '@svgrid/grid'
import { fieldColumns, type FieldColumn } from './grid-access'
import { fieldPropsOf, originalColumn } from './registry.svelte'
import { findFieldUser, getLinkedTable, linkedRows } from './sources.svelte'

type Row = Record<string, unknown>

export type ChartKind = 'bar' | 'barH' | 'line' | 'pie' | 'donut'

/** What a chart view draws: its kind, the field on the axis, and the value (a count without `y`). */
export type ChartSetting = {
  kind: ChartKind
  /** The field the records are grouped by. */
  x: string
  /** A number field to add up; without it, each group counts its records. */
  y?: string
  /** How `y` is combined: its sum (default) or its average. */
  aggregation?: 'sum' | 'avg'
}

export const CHART_KINDS: ReadonlyArray<{ kind: ChartKind; label: string }> = [
  { kind: 'bar', label: 'Bar' },
  { kind: 'barH', label: 'Horizontal bar' },
  { kind: 'line', label: 'Line' },
  { kind: 'pie', label: 'Pie' },
  { kind: 'donut', label: 'Donut' },
]

// A formula and a lookup group by the value they compute (Status: Low, OK, Out).
const X_TYPES = new Set(['singleSelect', 'multiSelect', 'user', 'date', 'checkbox', 'link', 'text', 'rating', 'createdTime', 'createdBy', 'formula', 'lookup'])
const NUMBER_TYPES = new Set(['number', 'currency', 'percent', 'rating', 'duration', 'count', 'rollup'])
const NUMERIC_RESULTS = new Set(['number', 'currency', 'percent'])

/** Fields a chart can group by. */
export const chartXColumns = (ctrl: any): FieldColumn[] => fieldColumns(ctrl).filter((c) => X_TYPES.has(c.fieldType ?? '') || c.def.cellDataType === 'date' || c.def.cellDataType === 'dateString')
/** Fields a chart can add up. */
export const chartYColumns = (ctrl: any): FieldColumn[] =>
  fieldColumns(ctrl).filter((c) => NUMBER_TYPES.has(c.fieldType ?? '') || (c.fieldType === 'formula' && NUMERIC_RESULTS.has(String(fieldPropsOf(originalColumn(c.def)).result))) || (!c.fieldType && c.def.cellDataType === 'number'))

/** A first setting for a new chart view: the first select (or any field it can group by), counted. */
export function defaultChart(ctrl: any): ChartSetting | null {
  const xs = chartXColumns(ctrl)
  const x = xs.find((c) => c.fieldType === 'singleSelect') ?? xs[0]
  return x ? { kind: 'bar', x: x.id } : null
}

const EMPTY = 'Empty'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The value a column shows for a row: computed for a formula, rollup or count. */
function valueOf(c: FieldColumn, row: Row): unknown {
  const fn = c.def.fieldFn as ((r: Row) => unknown) | undefined
  return fn ? fn(row) : row?.[c.field]
}

/** The group keys a row falls in for column `c` (a multiple select or a link is in several). */
function keysOf(c: FieldColumn, row: Row): string[] {
  const v = valueOf(c, row)
  const list = Array.isArray(v) ? v : v == null || v === '' ? [] : [v]
  if (c.fieldType === 'checkbox') return [v === true ? 'Checked' : 'Unchecked']
  if (!list.length) return [EMPTY]
  if (c.fieldType === 'user' || c.fieldType === 'createdBy') return list.map((id) => findFieldUser(id)?.name ?? String(id))
  if (c.fieldType === 'link') {
    const t = getLinkedTable(fieldPropsOf(originalColumn(c.def)).table)
    const names = t ? linkedRows(t, v).map((r) => String(r[t.primaryField] ?? '')) : []
    return names.length ? names : [EMPTY]
  }
  if (c.fieldType === 'lookup') {
    // Each linked value as the lookup shows it (a linked date or amount in its own format).
    const fmt = c.def.formatter as ((x: { value: unknown }) => unknown) | undefined
    const names = list.map((x) => (fmt ? String(fmt({ value: x }) ?? '') : String(x))).filter((s) => s !== '')
    return names.length ? [...new Set(names)] : [EMPTY]
  }
  if (c.fieldType === 'formula') {
    const dated = fieldPropsOf(originalColumn(c.def)).result === 'date' || c.def.cellDataType === 'date' || c.def.cellDataType === 'dateString'
    const keys = list.map((x) => {
      // A date value groups by its local month, as a stored date does.
      if (x instanceof Date) return Number.isNaN(x.getTime()) ? EMPTY : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
      if (typeof x === 'number') return String(Math.round(x * 1e10) / 1e10)
      if (dated && typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x)) return x.slice(0, 7)
      return String(x)
    })
    return [...new Set(keys)]
  }
  if (c.fieldType === 'date' || c.fieldType === 'createdTime' || c.def.cellDataType === 'date' || c.def.cellDataType === 'dateString') {
    const s = String(list[0])
    const m = /^(\d{4})-(\d{2})/.exec(s)
    return [m ? `${m[1]}-${m[2]}` : s]
  }
  return list.map((x) => String(x))
}

/** The category labels in their order: a select's options first, months by date, else as met (numbers ascending). */
function orderOf(c: FieldColumn, keys: string[]): { keys: string[]; label: (k: string) => string; colors: Record<string, string> } {
  const colors: Record<string, string> = {}
  const empty = keys.includes(EMPTY) ? [EMPTY] : []
  const rest = keys.filter((k) => k !== EMPTY)
  if (c.fieldType === 'singleSelect' || c.fieldType === 'multiSelect') {
    const options = (fieldPropsOf(originalColumn(c.def)).options as Array<{ value: string; color?: string }> | undefined) ?? []
    const rank = new Map(options.map((o, i) => [String(o.value), i]))
    for (const o of options) if (o.color) colors[String(o.value)] = o.color
    rest.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9))
    return { keys: [...rest, ...empty], label: (k) => k, colors }
  }
  const isMonth = rest.length > 0 && rest.every((k) => /^\d{4}-\d{2}$/.test(k))
  if (isMonth) {
    rest.sort()
    return { keys: [...rest, ...empty], label: (k) => (k === EMPTY ? k : `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`), colors }
  }
  if (rest.length && rest.every((k) => k !== '' && !Number.isNaN(Number(k)))) rest.sort((a, b) => Number(a) - Number(b))
  return { keys: [...rest, ...empty], label: (k) => k, colors }
}

/** The chart for `rows` (the records the view shows), or null when its fields are gone. */
export function chartSpec(ctrl: any, setting: ChartSetting, rows: ReadonlyArray<Row>): ChartSpec | null {
  const cols = fieldColumns(ctrl)
  const x = cols.find((c) => c.id === setting.x)
  if (!x) return null
  const y = setting.y ? cols.find((c) => c.id === setting.y) : undefined
  const sums = new Map<string, { total: number; n: number }>()
  for (const row of rows) {
    if (row == null) continue
    const raw = y ? Number(valueOf(y, row)) : 1
    for (const k of keysOf(x, row)) {
      const s = sums.get(k) ?? { total: 0, n: 0 }
      if (!y || Number.isFinite(raw)) {
        s.total += Number.isFinite(raw) ? raw : 0
        s.n += 1
      }
      sums.set(k, s)
    }
  }
  const { keys, label, colors } = orderOf(x, [...sums.keys()])
  const avg = !!y && setting.aggregation === 'avg'
  const values = keys.map((k) => {
    const s = sums.get(k)!
    return avg ? (s.n ? s.total / s.n : 0) : s.total
  })
  const categories = keys.map(label)
  const categoryColors: Record<string, string> = {}
  keys.forEach((k, i) => {
    if (colors[k]) categoryColors[categories[i]!] = colors[k]!
  })
  const kind = setting.kind
  return {
    type: kind === 'barH' ? 'bar' : kind === 'donut' ? 'pie' : kind,
    categories,
    series: [
      {
        label: y ? `${avg ? 'Average' : 'Sum'} of ${y.header}` : 'Records',
        values,
        // Each bar in its option's color (a pie takes them from categoryColors).
        ...(Object.keys(categoryColors).length && (kind === 'bar' || kind === 'barH') ? { colors: keys.map((k) => colors[k] ?? null) } : {}),
      },
    ],
    ...(Object.keys(categoryColors).length ? { categoryColors } : {}),
    ...(kind === 'barH' ? { orientation: 'horizontal' as const } : {}),
    ...(kind === 'donut' ? { innerRadius: 0.58 } : {}),
  }
}

/** How a value shows on the axis and in tooltips: as the summed field shows it ($48,000), a count as a whole number. */
export function chartFormatter(ctrl: any, setting: ChartSetting): ((value: number) => string) | undefined {
  const y = setting.y ? fieldColumns(ctrl).find((c) => c.id === setting.y) : undefined
  if (!y) return (v) => String(Math.round(v))
  const fmt = y.def.formatter as ((c: { value: unknown }) => unknown) | undefined
  return fmt ? (v) => String(fmt({ value: v }) ?? v) : undefined
}
