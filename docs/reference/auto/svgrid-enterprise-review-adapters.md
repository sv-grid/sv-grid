# `@svgrid/enterprise` · `review/adapters.ts`

Auto-generated. Source: `packages\enterprise\src\review\adapters.ts`.

### `type AdapterResult`

A change set built from another tool's output, ready for `review.add`, with
a count of the predictions that could not become proposals.

```ts
export type AdapterResult = {
  source: ProposalSource
  title: string
  proposals: ProposalInput[]
  /** Predictions dropped: an index outside the request or the snapshot. */
  dropped: number
}
```

### `const blankTargets`

Blank cells of `field`: what `aiSmartFill` targets when given no indices.

```ts
export const blankTargets = (snapshot: ReadonlyArray<unknown>, field: string): number[] =>
```

### `function fromSmartFill`

Proposals from an `aiSmartFill` result, its row indices resolved to row ids
through the snapshot the call ran on.

```ts
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
```

### `function fromClassify`

Proposals from an `aiClassify` result, its row indices resolved to row ids
through the snapshot the call ran on.

```ts
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
```

### `function fromRows`

Diff incoming rows (an import, a sync) against the grid's data by `key`:
one proposal per field that differs. Incoming rows with no match, and
fields not in `fields` when it is given, are not proposed; unmatched rows
are returned so the app can show them (adding rows comes in a later release).

```ts
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
```

### `function reviewSmartFill`

Snapshot, run `aiSmartFill`, and add the result to `review` as proposals.

```ts
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
```

### `function reviewClassify`

Snapshot, run `aiClassify`, and add the result to `review` as proposals.

```ts
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
```

### `function fromStaged`

Lift a `createStagedEditing` buffer into proposals, to route a person's
staged edits to someone else for approval instead of committing them.

Staged editing has already written its values into the grid, and a
proposal is checked against the value it saw (`before`). So revert the
stage first (`stage.revert(...)`), then add these: the cells hold the
original values again and the proposals carry the staged ones.

```ts
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
```
