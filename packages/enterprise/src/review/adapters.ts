/**
 * Producers: turn what the AI helpers and imports return into proposals.
 *
 * The AI helpers key predictions by `rowIndex`, an index into `api.getData()`
 * as it was when the helper read it. A sort, a filter or an edit during the
 * await does not move data indices, but an insert or a new `data` array does,
 * so the adapters resolve indices against a snapshot taken BEFORE the call,
 * then key each proposal by row id. Indices the helper was not asked about,
 * or that fall outside the snapshot, are dropped and counted.
 */
import {
  aiClassify, aiSmartFill,
  type AIClassifyOptions, type AIClassifyResult, type AISmartFillOptions, type AISmartFillResult,
} from '@svgrid/grid'
import { isBlank, sameValue } from './equal'
import type { ReviewGridApi } from './model.svelte'
import type { ProposalInput, ProposalSource } from './types'

type RowIdApi = Pick<ReviewGridApi, 'getOption'>

/**
 * A change set built from another tool's output, ready for `review.add`, with
 * a count of the predictions that could not become proposals.
 */
export type AdapterResult = {
  source: ProposalSource
  title: string
  proposals: ProposalInput[]
  /** Predictions dropped: an index outside the request or the snapshot. */
  dropped: number
}

function rowIdOf<TData>(api: RowIdApi): (row: TData, index: number) => string {
  const fn = api.getOption('getRowId') as ((row: TData, index: number) => string) | undefined
  if (!fn) throw new Error('[svgrid review] the grid needs a getRowId prop')
  return fn
}

function fromPredictions<TData>(
  predictions: ReadonlyArray<{ rowIndex: number; value: unknown; confidence?: number }>,
  field: string,
  snapshot: ReadonlyArray<TData>,
  targets: ReadonlyArray<number>,
  api: RowIdApi,
  reason: string | undefined,
): { proposals: ProposalInput[]; dropped: number } {
  const id = rowIdOf<TData>(api)
  const asked = new Set(targets)
  const seen = new Set<number>()
  const proposals: ProposalInput[] = []
  let dropped = 0
  for (const pr of predictions) {
    const i = pr.rowIndex
    const row = snapshot[i]
    if (!Number.isInteger(i) || !asked.has(i) || row === undefined || seen.has(i)) {
      dropped++
      continue
    }
    seen.add(i)
    const before = (row as Record<string, unknown>)[field]
    if (sameValue(before, pr.value)) continue
    proposals.push({ rowId: id(row, i), field, before, after: pr.value, confidence: pr.confidence, reason })
  }
  return { proposals, dropped }
}

/** Blank cells of `field`: what `aiSmartFill` targets when given no indices. */
export const blankTargets = (snapshot: ReadonlyArray<unknown>, field: string): number[] =>
  snapshot.flatMap((row, i) => (isBlank((row as Record<string, unknown>)[field]) ? [i] : []))

/**
 * Proposals from an `aiSmartFill` result, its row indices resolved to row ids
 * through the snapshot the call ran on.
 */
export function fromSmartFill<TData>(
  result: AISmartFillResult,
  snapshot: ReadonlyArray<TData>,
  opts: { api: RowIdApi; targets?: ReadonlyArray<number>; source?: ProposalSource },
): AdapterResult {
  const targets = opts.targets ?? blankTargets(snapshot, result.field)
  const { proposals, dropped } = fromPredictions(result.predictions, result.field, snapshot, targets, opts.api, result.rationale || undefined)
  const source = opts.source ?? { kind: 'ai', id: `smart-fill:${result.field}`, label: 'Smart fill' }
  return { source, title: `Smart fill: ${result.field}`, proposals, dropped }
}

/**
 * Proposals from an `aiClassify` result, its row indices resolved to row ids
 * through the snapshot the call ran on.
 */
export function fromClassify<TData>(
  result: AIClassifyResult,
  snapshot: ReadonlyArray<TData>,
  opts: { api: RowIdApi; targets?: ReadonlyArray<number>; source?: ProposalSource },
): AdapterResult {
  const targets = opts.targets ?? snapshot.map((_, i) => i)
  const { proposals, dropped } = fromPredictions(result.predictions, result.outputField, snapshot, targets, opts.api, `classified from ${result.inputField}`)
  const source = opts.source ?? { kind: 'ai', id: `classify:${result.outputField}`, label: 'Classify' }
  return { source, title: `Classify: ${result.outputField}`, proposals, dropped }
}

/**
 * Diff incoming rows (an import, a sync) against the grid's data by `key`:
 * one proposal per field that differs. Incoming rows with no match, and
 * fields not in `fields` when it is given, are not proposed; unmatched rows
 * are returned so the app can show them (adding rows comes in a later release).
 */
export function fromRows<TData>(
  incoming: ReadonlyArray<Partial<TData>>,
  opts: {
    api: Pick<ReviewGridApi, 'getOption' | 'getData'>
    key: keyof TData & string
    source: ProposalSource
    title?: string
    fields?: ReadonlyArray<keyof TData & string>
  },
): AdapterResult & { unmatched: Array<Partial<TData>> } {
  const id = rowIdOf<TData>(opts.api)
  const data = opts.api.getData() as ReadonlyArray<TData>
  const byKey = new Map<unknown, { row: TData; index: number }>()
  data.forEach((row, index) => byKey.set((row as Record<string, unknown>)[opts.key], { row, index }))
  const proposals: ProposalInput[] = []
  const unmatched: Array<Partial<TData>> = []
  for (const next of incoming) {
    const hit = byKey.get((next as Record<string, unknown>)[opts.key])
    if (!hit) {
      unmatched.push(next)
      continue
    }
    const rowId = id(hit.row, hit.index)
    const fields = opts.fields ?? (Object.keys(next) as Array<keyof TData & string>)
    for (const field of fields) {
      if (field === opts.key || !(field in (next as object))) continue
      const before = (hit.row as Record<string, unknown>)[field]
      const after = (next as Record<string, unknown>)[field]
      if (!sameValue(before, after)) proposals.push({ rowId, field, before, after })
    }
  }
  return { source: opts.source, title: opts.title ?? opts.source.label, proposals, dropped: 0, unmatched }
}

type Addable = { add(input: { source: ProposalSource; title?: string; proposals: ReadonlyArray<ProposalInput> }): unknown }

/** Snapshot, run `aiSmartFill`, and add the result to `review` as proposals. */
export async function reviewSmartFill(
  review: Addable,
  api: ReviewGridApi,
  opts: AISmartFillOptions,
): Promise<AdapterResult> {
  const snapshot = api.getData().slice()
  const targets = opts.targetRowIndices ?? blankTargets(snapshot, opts.field)
  const result = await aiSmartFill(api as never, { ...opts, targetRowIndices: [...targets] })
  const set = fromSmartFill(result, snapshot, { api, targets })
  review.add(set)
  return set
}

/** Snapshot, run `aiClassify`, and add the result to `review` as proposals. */
export async function reviewClassify(
  review: Addable,
  api: ReviewGridApi,
  opts: AIClassifyOptions,
): Promise<AdapterResult> {
  const snapshot = api.getData().slice()
  const targets = opts.targetRowIndices ?? snapshot.map((_, i) => i)
  const result = await aiClassify(api as never, { ...opts, targetRowIndices: [...targets] })
  const set = fromClassify(result, snapshot, { api, targets })
  review.add(set)
  return set
}

/**
 * Lift a `createStagedEditing` buffer into proposals, to route a person's
 * staged edits to someone else for approval instead of committing them.
 *
 * Staged editing has already written its values into the grid, and a
 * proposal is checked against the value it saw (`before`). So revert the
 * stage first (`stage.revert(...)`), then add these: the cells hold the
 * original values again and the proposals carry the staged ones.
 */
export function fromStaged(
  changes: ReadonlyArray<{ rowId: string; columnId: string; original: unknown; staged: unknown }>,
  opts: { api: Pick<ReviewGridApi, 'getColumns'>; source: ProposalSource; title?: string },
): AdapterResult {
  const fieldOf = new Map(opts.api.getColumns().map((c) => [c.id, c.field ?? c.id]))
  const proposals: ProposalInput[] = changes
    .filter((c) => !sameValue(c.original, c.staged))
    .map((c) => ({ rowId: c.rowId, field: fieldOf.get(c.columnId) ?? c.columnId, before: c.original, after: c.staged }))
  return { source: opts.source, title: opts.title ?? opts.source.label, proposals, dropped: 0 }
}
