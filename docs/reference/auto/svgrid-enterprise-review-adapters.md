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
export const blankTargets = (snapshot: ReadonlyArray<unknown>, field: string): number[] => ...
```

### `function fromSmartFill`

Proposals from an `aiSmartFill` result, its row indices resolved to row ids
through the snapshot the call ran on.

```ts
export function fromSmartFill<TData>(
  result: AISmartFillResult,
  snapshot: ReadonlyArray<TData>,
  opts: { api: RowIdApi; targets?: ReadonlyArray<number>; source?: ProposalSource },
): AdapterResult
```

### `function fromClassify`

Proposals from an `aiClassify` result, its row indices resolved to row ids
through the snapshot the call ran on.

```ts
export function fromClassify<TData>(
  result: AIClassifyResult,
  snapshot: ReadonlyArray<TData>,
  opts: { api: RowIdApi; targets?: ReadonlyArray<number>; source?: ProposalSource },
): AdapterResult
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
): AdapterResult & { unmatched: Array<Partial<TData>> }
```

### `function reviewSmartFill`

Snapshot, run `aiSmartFill`, and add the result to `review` as proposals.

```ts
export async function reviewSmartFill(
  review: Addable,
  api: ReviewGridApi,
  opts: AISmartFillOptions,
): Promise<AdapterResult>
```

### `function reviewClassify`

Snapshot, run `aiClassify`, and add the result to `review` as proposals.

```ts
export async function reviewClassify(
  review: Addable,
  api: ReviewGridApi,
  opts: AIClassifyOptions,
): Promise<AdapterResult>
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
): AdapterResult
```
