/**
 * Development-time configuration checks.
 *
 * The grid used to fail silently on the most common mistakes. A misspelled
 * `field` rendered a column of empty cells with nothing on the console; a
 * `pageSize` with no pagination was quietly ignored; a column marked
 * `sortable` with no sorting enabled just did not sort. Each of those costs
 * someone an afternoon, and none of them were detectable from the outside.
 *
 * This module is the check. It is pure and returns messages rather than
 * printing them, so it can be unit-tested; the controller runs it in an effect
 * and prints each message once, in dev builds only.
 *
 * Rules for anything added here:
 *   - Never fire on valid config. A false positive teaches people to ignore
 *     warnings, which is worse than staying silent.
 *   - Say what happened, what it means, and how to fix it - the house style set
 *     by the one pre-existing warning in server-data-source.ts.
 *   - Stay O(columns), or O(columns x a fixed row sample). This runs on data
 *     changes, and must not scale with row count.
 */
import type { ColumnDef, RowData, TableFeatures } from './core'

/** How many rows to sample when deciding whether a `field` exists. */
const FIELD_SAMPLE_ROWS = 10

const DOCS = 'https://svgrid.com/docs/getting-started/3-data-and-columns/'

export type ValidateInput<TFeatures extends TableFeatures, TData extends RowData> = {
  data: ReadonlyArray<TData>
  columns: ReadonlyArray<ColumnDef<TFeatures, TData>>
  /** The resolved feature set, after the boolean shortcuts have injected theirs. */
  features?: Record<string, unknown>
  sortable?: boolean
  pageable?: boolean
  showPagination?: boolean
  pageSize?: number
  groupBy?: ReadonlyArray<string>
  treeData?: { parentField?: string; idField?: string; column?: string }
  initialColumnPinning?: { left?: ReadonlyArray<string>; right?: ReadonlyArray<string> }
  columnVirtualization?: boolean
  externalPagination?: boolean
  rowCount?: number
  externalSort?: boolean
  onSortingChange?: unknown
  externalFilter?: boolean
  onFiltersChange?: unknown
}

/** Every leaf column, flattened through group columns. */
function leaves<TFeatures extends TableFeatures, TData extends RowData>(
  columns: ReadonlyArray<ColumnDef<TFeatures, TData>>,
  out: Array<ColumnDef<TFeatures, TData>> = [],
): Array<ColumnDef<TFeatures, TData>> {
  for (const col of columns) {
    if (col.columns?.length) leaves(col.columns, out)
    else out.push(col)
  }
  return out
}

export function validateGridConfig<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(input: ValidateInput<TFeatures, TData>): string[] {
  const messages: string[] = []
  const cols = leaves(input.columns ?? [])

  // ---- 1. A `field` that does not exist on the data -------------------------
  // The single most expensive silent failure: the column renders, and every
  // cell in it is blank. Sampled across several rows so genuinely sparse data
  // (a key absent from row 0 but present later) does not trip it.
  const sample = (input.data ?? []).slice(0, FIELD_SAMPLE_ROWS)
  if (sample.length) {
    const known = new Set<string>()
    for (const row of sample) {
      if (row && typeof row === 'object') for (const k of Object.keys(row)) known.add(k)
    }
    for (const col of cols) {
      const field = col.field as string | undefined
      // `fieldFn` computes its value, and an id-only column (actions, buttons)
      // never reads the row - neither needs a matching key.
      if (!field || col.fieldFn) continue
      if (known.has(field)) continue
      const guess = nearest(field, [...known])
      messages.push(
        `[svgrid] Column field "${field}" does not exist on your row data, so that ` +
          `column renders empty.${guess ? ` Did you mean "${guess}"?` : ''} ` +
          `Available keys: ${[...known].slice(0, 12).join(', ')}. See ${DOCS}`,
      )
    }
  }

  // ---- 2. Duplicate column ids ---------------------------------------------
  // Two columns resolving to the same id makes selection, sorting and column
  // state address the wrong one, with no error anywhere.
  const seen = new Map<string, number>()
  for (const col of cols) {
    const id = (col.id ?? (col.field as string | undefined)) as string | undefined
    if (!id) continue
    seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  for (const [id, n] of seen) {
    if (n > 1) {
      messages.push(
        `[svgrid] ${n} columns share the id "${id}". Column state (sorting, ` +
          `filtering, pinning, width) is keyed by id, so they will act as one. ` +
          `Give each an explicit \`id\`. See ${DOCS}`,
      )
    }
  }

  // ---- 3. `pageSize` with pagination never asked for ------------------------
  // Only when BOTH pagination props are absent. `pageable={false}` is a
  // deliberate statement - often a bound toggle that flips on later - whereas
  // an unset prop means the author never considered it. Warning on the former
  // fired on our own shortcut-config demo, which is exactly the kind of noise
  // that teaches people to ignore warnings.
  const paginationUnset =
    input.pageable === undefined && input.showPagination === undefined
  if (input.pageSize !== undefined && paginationUnset) {
    messages.push(
      '[svgrid] `pageSize` is set but pagination was never turned on, so it has ' +
        'no effect and every row renders. Add `pageable` to switch the pager on.',
    )
  }

  // ---- 4. A column asks to sort, but nothing enables sorting ----------------
  // `sortable` on the grid injects rowSortingFeature, so only warn when neither
  // the shortcut nor an explicitly registered feature is present.
  const sortingEnabled =
    input.sortable === true || Boolean(input.features?.rowSortingFeature)
  if (!sortingEnabled && cols.some((c) => c.sortable === true)) {
    messages.push(
      '[svgrid] A column sets `sortable: true`, but sorting is not enabled on the ' +
        'grid, so its header does nothing. Add `sortable` to <SvGrid> (it registers ' +
        'the sorting feature for you).',
    )
  }

  // ---- 5. Column ids referenced by other props ------------------------------
  // `groupBy` and `treeData.column` address columns by id. A name that matches
  // nothing is silently ignored, so grouping or the tree expander just never
  // appears and there is nothing to debug against.
  const columnIds = new Set<string>()
  for (const col of cols) {
    const id = (col.id ?? (col.field as string | undefined)) as string | undefined
    if (id) columnIds.add(id)
  }
  for (const id of input.groupBy ?? []) {
    if (columnIds.has(id)) continue
    const guess = nearest(id, [...columnIds])
    messages.push(
      `[svgrid] \`groupBy\` refers to column "${id}", which does not exist, so ` +
        `that grouping level is ignored.${guess ? ` Did you mean "${guess}"?` : ''} ` +
        `Column ids: ${[...columnIds].slice(0, 12).join(', ')}`,
    )
  }
  const treeColumn = input.treeData?.column
  if (treeColumn && !columnIds.has(treeColumn)) {
    messages.push(
      `[svgrid] \`treeData.column\` refers to column "${treeColumn}", which does ` +
        `not exist, so the expander falls back to the first visible column.`,
    )
  }

  // ---- 6. treeData pointing at fields the data does not have ----------------
  if (sample.length && input.treeData) {
    const known = new Set<string>()
    for (const row of sample) {
      if (row && typeof row === 'object') for (const k of Object.keys(row)) known.add(k)
    }
    const parentField = input.treeData.parentField
    if (parentField && !known.has(parentField)) {
      const guess = nearest(parentField, [...known])
      messages.push(
        `[svgrid] \`treeData.parentField\` is "${parentField}", which is not on ` +
          `your row data, so every row becomes a root and no hierarchy appears.` +
          `${guess ? ` Did you mean "${guess}"?` : ''}`,
      )
    }
    // `idField` defaults to 'id'; only check what was asked for explicitly.
    const idField = input.treeData.idField
    if (idField && !known.has(idField)) {
      messages.push(
        `[svgrid] \`treeData.idField\` is "${idField}", which is not on your row ` +
          `data, so parent lookups cannot match and the tree stays flat.`,
      )
    }
  }

  // ---- 7. Pinning that column virtualization will hide ----------------------
  // Documented incompatibility: the virtualizer recycles column DOM nodes, so
  // sticky pinning cannot survive it. `columnVirtualization` defaults to ON,
  // which means the natural way to write this silently does nothing.
  const pinned =
    (input.initialColumnPinning?.left?.length ?? 0) +
    (input.initialColumnPinning?.right?.length ?? 0)
  if (pinned > 0 && input.columnVirtualization !== false) {
    messages.push(
      '[svgrid] `initialColumnPinning` is set while column virtualization is on ' +
        '(its default), so the pinned columns will not stick - the virtualizer ' +
        'recycles column nodes. Add `columnVirtualization={false}`.',
    )
  }

  // ---- 8. Server-mode contracts left half-wired -----------------------------
  // Each of these makes the grid hand control to the consumer. Miss the other
  // half and the feature looks broken rather than unconfigured.
  if (input.externalPagination === true && input.rowCount === undefined) {
    messages.push(
      '[svgrid] `externalPagination` is on but `rowCount` is not set, so the pager ' +
        'cannot know how many pages exist. Pass the server total as `rowCount`.',
    )
  }
  if (input.externalSort === true && !input.onSortingChange) {
    messages.push(
      '[svgrid] `externalSort` is on but there is no `onSortingChange` handler, so ' +
        'clicking a header changes nothing - the grid stopped sorting and nobody ' +
        'is listening. Add `onSortingChange` and re-fetch in your handler.',
    )
  }
  if (input.externalFilter === true && !input.onFiltersChange) {
    messages.push(
      '[svgrid] `externalFilter` is on but there is no `onFiltersChange` handler, ' +
        'so filtering the grid changes nothing. Add `onFiltersChange` and re-fetch ' +
        'in your handler.',
    )
  }

  return messages
}

/** Closest key by edit distance, for a "did you mean" hint. Undefined if none is close. */
function nearest(target: string, candidates: string[]): string | undefined {
  let best: string | undefined
  let bestScore = Infinity
  for (const c of candidates) {
    const d = distance(target.toLowerCase(), c.toLowerCase())
    if (d < bestScore) {
      bestScore = d
      best = c
    }
  }
  // Only suggest a genuinely near miss - a third of the length, at most 3 edits.
  const limit = Math.min(3, Math.floor(target.length / 3) + 1)
  return bestScore <= limit ? best : undefined
}

/** Levenshtein distance, iterative single-row. Inputs here are identifier-length. */
function distance(a: string, b: string): number {
  if (a === b) return 0
  const prev = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    let carry = prev[0]!
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(
        prev[j]! + 1,
        prev[j - 1]! + 1,
        carry + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      carry = prev[j]!
      prev[j] = next
    }
  }
  return prev[b.length]!
}
